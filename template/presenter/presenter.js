/* ============================================================
   presenter.js — FORMUNAUTS presenter console (CHROME).
   ------------------------------------------------------------
   A separate window that mirrors the SHARED deck (index.html)
   over BroadcastChannel (same-origin) with a localStorage
   snapshot fallback for late/early joiners. It NEVER touches
   the shared deck's DOM — it drives it purely via commands and
   renders its own console: current + next slide previews,
   big scrollable speaker notes, wall clock + elapsed/rolling
   timer, slide x/N, a jump list, and prev/next/blank controls.

   Transport (channel + snapshot) is self-contained here so the
   presenter has zero import dependencies on other CHROME files
   and always works when opened standalone.

   Contract with the shared deck (see the index.html snippet):
     deck  → presenter : {t:'state', h,v,f,index,total,notes,title,eyebrow,timing,paused}
     deck  → presenter : {t:'bye'}                     (on pagehide)
     presenter → deck  : {t:'hello'}                   (request a fresh snapshot)
     presenter → deck  : {t:'cmd', name, h?, v?}       (next|prev|goto|pause|black)

   Notes are ALWAYS delivered as channel data (the deck reads its
   own <aside class="notes"> innerHTML and broadcasts it) — never
   scraped through the preview iframe. When no deck is live, the
   console imports the deck data module directly (same-origin) so
   notes, titles and the jump list still populate.
   ============================================================ */

/* ---- Protocol constants (kept in lock-step with the deck side) ---- */
const CHANNEL = "fmnts-deck";
const SNAPSHOT_KEY = "fmnts-deck-state";
const PROTO = 1;

/* Default per-slide speaking budget (seconds) when a slide has no
   data-timing. Mirrors reveal's defaultTiming in index.html. */
const DEFAULT_TIMING = 45;

/* How long we wait for any deck signal before declaring the shared
   window "not detected" and showing the reconnect banner. */
const WATCHDOG_MS = 2000;

/* The active demo. Kept in sync with index.html's DEFAULT_DECK so the
   standalone / jump-list fallback loads the same content the deck shows.
   Overridable with ?deck=YYYY-MM-DD (same rule as index.html). */
const DEFAULT_DECK = "2026-07-01";

/* --------------------------------------------------------------
   Tiny helpers
-------------------------------------------------------------- */
const $ = (sel, root = document) => root.querySelector(sel);
const pad2 = (n) => String(n).padStart(2, "0");
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

/** Escape text so notes/titles coming from data are inert as HTML. */
function escapeHtml(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Format seconds → H:MM:SS or M:SS. */
function fmtClock(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  if (hrs > 0) return `${hrs}:${pad2(mins)}:${pad2(secs)}`;
  return `${mins}:${pad2(secs)}`;
}

/** Format the wall clock as HH:MM (24h). */
function fmtWall(date) {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

/* --------------------------------------------------------------
   Transport — a null-guarded BroadcastChannel wrapper plus a
   localStorage snapshot mirror. Falls back gracefully when
   BroadcastChannel is unavailable (e.g. Safari private mode):
   the console still hydrates from the last snapshot and can
   react to storage events written by the deck.
-------------------------------------------------------------- */
function makeBus(onMessage) {
  let bc = null;
  try {
    if (typeof BroadcastChannel !== "undefined") {
      bc = new BroadcastChannel(CHANNEL);
      bc.onmessage = (ev) => {
        const data = ev && ev.data;
        if (data && data.proto === PROTO) onMessage(data, "channel");
      };
    }
  } catch (err) {
    console.warn("[presenter] BroadcastChannel unavailable", err);
    bc = null;
  }

  /* Cross-window fallback: the deck also mirrors state to localStorage,
     which fires a 'storage' event in OTHER windows on the same origin. */
  window.addEventListener("storage", (ev) => {
    if (ev.key !== SNAPSHOT_KEY || !ev.newValue) return;
    const data = safeParse(ev.newValue);
    if (data && data.proto === PROTO) onMessage(data, "storage");
  });

  return {
    /** True when we have a real channel (bidirectional) available. */
    hasChannel: !!bc,
    /** Send a message to the deck. No-op when the channel is absent. */
    send(msg) {
      if (!bc) return false;
      try {
        bc.postMessage({ proto: PROTO, ...msg });
        return true;
      } catch (err) {
        console.warn("[presenter] channel send failed", err);
        return false;
      }
    },
    close() {
      try {
        bc && bc.close();
      } catch {
        /* ignore */
      }
    },
  };
}

function safeParse(json) {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/** Read the last snapshot the deck mirrored to localStorage. */
function readSnapshot() {
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY);
    const data = safeParse(raw);
    return data && data.proto === PROTO ? data : null;
  } catch {
    return null;
  }
}

/* --------------------------------------------------------------
   Deck data fallback — used for the jump list and for the notes /
   titles when NO live deck is publishing (standalone open, or the
   deck window closed). Loaded lazily, same-origin, never fatal.
-------------------------------------------------------------- */
async function loadDeckData() {
  const wanted =
    new URLSearchParams(location.search).get("deck") || DEFAULT_DECK;
  const safe = /^[0-9A-Za-z._-]+$/.test(wanted) ? wanted : DEFAULT_DECK;
  try {
    const mod = await import(`../../decks/${safe}.deck.js`);
    return mod.deck || null;
  } catch (err) {
    console.warn(`[presenter] deck data "${safe}" not loadable`, err);
    if (safe !== DEFAULT_DECK) {
      try {
        const mod = await import(`../../decks/${DEFAULT_DECK}.deck.js`);
        return mod.deck || null;
      } catch (err2) {
        console.warn("[presenter] default deck data not loadable", err2);
      }
    }
    return null;
  }
}

/** Pick the best display title for a slide object from the deck data. */
function slideTitle(slide, i) {
  if (!slide) return `Slide ${i + 1}`;
  return (
    slide.headline ||
    slide.statement ||
    slide.title ||
    (slide.eyebrow ? slide.eyebrow : `Slide ${i + 1}`)
  );
}

/* --------------------------------------------------------------
   The console controller.
-------------------------------------------------------------- */
class Presenter {
  constructor() {
    /* DOM refs */
    this.el = {
      wallClock: $("#pv-wall"),
      elapsed: $("#pv-elapsed"),
      pace: $("#pv-pace"),
      paceFill: $("#pv-pace-fill"),
      index: $("#pv-index"),
      indexTotal: $("#pv-index-total"),
      title: $("#pv-title"),
      eyebrow: $("#pv-eyebrow"),
      current: $("#pv-current-frame"),
      next: $("#pv-next-frame"),
      nextLabel: $("#pv-next-label"),
      notes: $("#pv-notes"),
      status: $("#pv-status"),
      jumpList: $("#pv-jump-list"),
      jumpPanel: $("#pv-jump"),
      btnPrev: $("#pv-prev"),
      btnNext: $("#pv-next"),
      btnBlank: $("#pv-blank"),
      btnJump: $("#pv-jump-toggle"),
      btnReset: $("#pv-reset-timer"),
      btnReconnect: $("#pv-reconnect"),
      openDeck: $("#pv-open-deck"),
    };

    /* Live state (last snapshot from the deck, or a synthesized one). */
    this.state = {
      h: 0,
      v: 0,
      f: -1,
      index: 0,
      total: 0,
      notes: "",
      title: "",
      eyebrow: "",
      timing: DEFAULT_TIMING,
      paused: false,
    };

    /* Deck data (fallback source for titles/notes/jump list). */
    this.deckData = null;

    /* Timer: elapsed since first slide interaction; per-slide rolling. */
    this.startedAt = null; // ms when the presentation timer started
    this.slideEnteredAt = null; // ms when current slide became active
    this.connected = false;
    this.lastSignalAt = 0;
    this.blank = false;

    /* Which slide the previews currently point at (avoid reloading iframes
       when the index hasn't actually changed). */
    this.currentSrcKey = null;
    this.nextSrcKey = null;
  }

  async init() {
    /* Load deck data for jump list + standalone notes. Non-fatal. */
    this.deckData = await loadDeckData();
    if (this.deckData?.meta?.title) {
      document.title = `Presenter — ${this.deckData.meta.title}`;
    }
    if (this.deckData?.slides?.length && !this.state.total) {
      this.state.total = this.deckData.slides.length;
    }

    this.bus = makeBus((msg, source) => this.onDeckMessage(msg, source));

    /* Hydrate immediately from any snapshot the deck left behind, so a
       standalone open paints real content instead of an empty shell. */
    const snap = readSnapshot();
    if (snap) this.applyState(snap, /*fromSnapshot*/ true);
    else {
      /* No snapshot at all → seed previews/notes/jump list from deck data. */
      this.hydrateFromDeckData();
    }

    this.buildJumpList();
    this.wireControls();
    this.wireKeyboard();

    /* Ask a live deck (if any) to send a fresh snapshot right away. */
    this.bus.send({ t: "hello" });

    /* Ticking clocks. */
    this.tick();
    this.clockTimer = setInterval(() => this.tick(), 250);

    /* Connection watchdog: if no deck signal arrives, show the banner. */
    this.watchdogTimer = setInterval(() => this.checkConnection(), 500);
    this.checkConnection();

    /* Be polite on close. */
    window.addEventListener("pagehide", () => {
      this.bus.send({ t: "bye-presenter" });
      this.bus.close();
    });
  }

  /* ---- Inbound from the deck ---- */
  onDeckMessage(msg, source) {
    if (!msg || !msg.t) return;

    if (msg.t === "state") {
      this.lastSignalAt = Date.now();
      this.setConnected(true);
      this.applyState(msg, /*fromSnapshot*/ false);
      return;
    }

    if (msg.t === "bye") {
      /* Deck window is closing. Keep last-known content on screen but
         flip to disconnected so the reconnect banner returns. */
      this.setConnected(false);
      this.setStatus("Deck window closed — content frozen at last slide.");
      return;
    }
  }

  /* ---- Apply a state snapshot (from channel OR localStorage) ---- */
  applyState(s, fromSnapshot) {
    const prevIndex = this.state.index;
    const prevActiveKey = `${this.state.h}.${this.state.v}`;
    const nextActiveKey = `${s.h ?? 0}.${s.v ?? 0}`;

    /* Merge — a snapshot carries the full paint; be defensive on fields. */
    this.state = {
      h: s.h ?? 0,
      v: s.v ?? 0,
      f: s.f ?? -1,
      index: s.index ?? 0,
      total: s.total || this.state.total || 0,
      notes: s.notes != null ? s.notes : this.state.notes,
      title: s.title != null ? s.title : this.state.title,
      eyebrow: s.eyebrow != null ? s.eyebrow : this.state.eyebrow,
      timing: s.timing || DEFAULT_TIMING,
      paused: !!s.paused,
    };

    /* Start the overall timer on the first REAL (channel) signal, not from
       a stale snapshot — so the clock reflects this session's start. */
    if (!fromSnapshot && this.startedAt == null) {
      this.startedAt = Date.now();
      this.slideEnteredAt = Date.now();
    }
    /* Reset the per-slide rolling timer whenever the active slide changes. */
    if (prevActiveKey !== nextActiveKey) {
      this.slideEnteredAt = Date.now();
    }

    this.blank = !!this.state.paused;

    /* Fall back to deck-data notes/title if the deck didn't supply them
       (e.g. hydrating from a partial snapshot). */
    this.fillMissingFromDeckData();

    this.render();
    if (prevIndex !== this.state.index) this.highlightJump();
  }

  /* When the deck omitted notes/title (rare), borrow from the data module. */
  fillMissingFromDeckData() {
    if (!this.deckData?.slides) return;
    const slide = this.deckData.slides[this.state.index];
    if (!slide) return;
    if (!this.state.notes) this.state.notes = slide.notes || "";
    if (!this.state.title) this.state.title = slideTitle(slide, this.state.index);
    if (!this.state.eyebrow && slide.eyebrow) this.state.eyebrow = slide.eyebrow;
  }

  /* Seed the console purely from deck data when there is no snapshot yet. */
  hydrateFromDeckData() {
    if (!this.deckData?.slides?.length) return;
    const slide = this.deckData.slides[0];
    this.state.index = 0;
    this.state.total = this.deckData.slides.length;
    this.state.h = 0;
    this.state.v = 0;
    this.state.notes = slide.notes || "";
    this.state.title = slideTitle(slide, 0);
    this.state.eyebrow = slide.eyebrow || "";
    this.state.timing = Number(slide.timing) || DEFAULT_TIMING;
    this.render();
  }

  /* ---- Outbound commands to the deck ---- */
  cmd(name, extra = {}) {
    const sent = this.bus.send({ t: "cmd", name, ...extra });
    if (!sent) {
      /* No live channel — optimistically move the previews so the console
         stays useful standalone, and remind the user the deck is offline. */
      this.optimisticLocalNav(name, extra);
      this.setStatus(
        "No deck connected — preview only. Open the deck to drive it live."
      );
    }
    return sent;
  }

  /* Standalone navigation: shift the local index and repaint previews.
     This is preview-only; it does NOT (and cannot) move a real deck. */
  optimisticLocalNav(name, extra) {
    const total = this.state.total || (this.deckData?.slides?.length ?? 0);
    if (!total) return;
    let idx = this.state.index;
    if (name === "next") idx = clamp(idx + 1, 0, total - 1);
    else if (name === "prev") idx = clamp(idx - 1, 0, total - 1);
    else if (name === "goto" && Number.isInteger(extra.h))
      idx = clamp(extra.h, 0, total - 1);
    else if (name === "black") {
      this.blank = !this.blank;
      this.render();
      return;
    } else return;

    this.state.index = idx;
    this.state.h = idx;
    this.state.v = 0;
    if (this.deckData?.slides) {
      const slide = this.deckData.slides[idx];
      this.state.notes = slide?.notes || "";
      this.state.title = slideTitle(slide, idx);
      this.state.eyebrow = slide?.eyebrow || "";
      this.state.timing = Number(slide?.timing) || DEFAULT_TIMING;
    }
    this.slideEnteredAt = Date.now();
    this.render();
    this.highlightJump();
  }

  /* ---- Rendering ---- */
  render() {
    const s = this.state;

    /* Index x / N */
    if (this.el.index) this.el.index.textContent = pad2(s.index + 1);
    if (this.el.indexTotal)
      this.el.indexTotal.textContent = pad2(s.total || 0);

    /* Title + eyebrow */
    if (this.el.eyebrow) this.el.eyebrow.textContent = s.eyebrow || "";
    if (this.el.title) this.el.title.textContent = s.title || "";

    /* Notes — rendered as plain text, injection-proof. The deck sends the
       innerHTML of its own <aside class="notes"> (already esc()'d, so it is
       entity-escaped plain text); the standalone fallback sends a raw data
       string. Either way we normalize to text and build <p> nodes with
       textContent, so no markup from data can ever execute here. */
    if (this.el.notes) this.renderNotes(s.notes || "");

    /* Preview iframes — only reload when the target slide changed. */
    this.updatePreviews();

    /* Blank state on the console mirrors the deck being paused/black. */
    document.body.classList.toggle("is-blank", !!this.blank);
    if (this.el.btnBlank)
      this.el.btnBlank.setAttribute("aria-pressed", String(!!this.blank));

    this.tick(); // refresh pacing immediately
  }

  /* Paint the speaker notes as safe plain-text paragraphs. */
  renderNotes(raw) {
    const box = this.el.notes;
    box.textContent = ""; // clear
    const text = this.notesToText(raw).trim();
    if (!text) {
      const p = document.createElement("p");
      p.className = "pv-note-empty";
      p.textContent = "No speaker notes for this slide.";
      box.appendChild(p);
      box.scrollTop = 0;
      return;
    }
    /* Split on blank lines into paragraphs; single newlines become <br>. */
    const paras = text.split(/\n{2,}/);
    for (const para of paras) {
      const p = document.createElement("p");
      p.className = "pv-note-para";
      const lines = para.split("\n");
      lines.forEach((line, i) => {
        if (i > 0) p.appendChild(document.createElement("br"));
        p.appendChild(document.createTextNode(line));
      });
      box.appendChild(p);
    }
    box.scrollTop = 0;
  }

  /* Normalize notes to plain text regardless of source, WITHOUT ever parsing
     the string as HTML (no innerHTML/DOMParser → no <img onerror> or script
     can fire). The deck sends esc()'d text (entities + maybe <br>); the
     standalone fallback sends a raw data string. We turn <br> into newlines,
     strip any residual tags as literal text, and decode the small, known set
     of entities esc() produces. */
  notesToText(raw) {
    let s = String(raw == null ? "" : raw);
    s = s.replace(/<br\s*\/?>/gi, "\n"); // deck line breaks → newlines
    s = s.replace(/<[^>]*>/g, ""); // drop any stray tags (never executed)
    /* Decode named + numeric entities produced by esc() and friends. */
    s = s.replace(/&#(\d+);/g, (_, d) => {
      const code = Number(d);
      return Number.isFinite(code) ? String.fromCodePoint(code) : _;
    });
    s = s.replace(/&#x([0-9a-f]+);/gi, (_, h) => {
      const code = parseInt(h, 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : _;
    });
    const NAMED = {
      "&amp;": "&",
      "&lt;": "<",
      "&gt;": ">",
      "&quot;": '"',
      "&#39;": "'",
      "&apos;": "'",
      "&nbsp;": " ",
    };
    s = s.replace(/&(amp|lt|gt|quot|apos|nbsp);/g, (m) => NAMED[m] || m);
    return s;
  }

  updatePreviews() {
    const s = this.state;
    const curKey = `${s.h}.${s.v}`;
    /* The deck is flat (center:false, no vertical stacks), so the "next"
       slide is simply the next horizontal index. */
    const nextIdx = clamp(s.index + 1, 0, Math.max(0, (s.total || 1) - 1));
    const hasNext = s.total > 0 && s.index + 1 < s.total;

    /* Current slide preview. */
    if (this.el.current && this.currentSrcKey !== curKey) {
      this.pointPreview(this.el.current, s.h, s.v);
      this.currentSrcKey = curKey;
    }

    /* Next slide preview. */
    if (this.el.next) {
      const nextKey = hasNext ? `idx-${nextIdx}` : "end";
      if (this.nextSrcKey !== nextKey) {
        if (hasNext) this.pointPreview(this.el.next, nextIdx, 0);
        else {
          this.el.next.src = "about:blank";
          delete this.el.next.dataset.booted;
        }
        this.nextSrcKey = nextKey;
      }
      if (this.el.nextLabel) {
        this.el.nextLabel.textContent = hasNext
          ? this.previewLabelForIndex(nextIdx)
          : "End of deck";
      }
    }
  }

  /* Point a preview iframe at slide (h,v).

     Robust two-phase strategy:
       • First time: set the iframe src (peek URL WITH the slide hash) so the
         fresh reveal reads the hash on init and paints the right slide.
       • Afterwards: navigate the ALREADY-LOADED peek deck in place by calling
         its own Reveal.slide(h,v) over the same-origin boundary. This avoids
         a reload (smooth) AND sidesteps the browser's "same query, different
         hash = no reload" trap that would otherwise strand the preview.
       • If the child's Reveal isn't reachable yet (still booting), fall back
         to a hard reload via a cache-busting query param so a fresh init can
         read the hash. */
  pointPreview(iframe, h, v) {
    const booted = iframe.dataset.booted === "1";
    if (!booted) {
      iframe.dataset.booted = "1";
      iframe.dataset.target = `${h}.${v}`;
      iframe.src = this.peekUrl(this.slideHash(h, v));
      /* Once it loads, re-assert the target in case reveal settled elsewhere. */
      iframe.addEventListener(
        "load",
        () => this.driveChild(iframe, h, v, /*allowReload*/ false),
        { once: true }
      );
      return;
    }
    iframe.dataset.target = `${h}.${v}`;
    this.driveChild(iframe, h, v, /*allowReload*/ true);
  }

  /* Try to navigate a peek iframe's reveal directly; retry briefly while it
     boots; hard-reload as a last resort. */
  driveChild(iframe, h, v, allowReload, attempt = 0) {
    /* Bail if the target changed under us (a newer navigation won). */
    if (iframe.dataset.target !== `${h}.${v}`) return;
    let ok = false;
    try {
      const rv = iframe.contentWindow && iframe.contentWindow.Reveal;
      if (rv && typeof rv.slide === "function" && rv.isReady && rv.isReady()) {
        rv.slide(h, v);
        ok = true;
      }
    } catch {
      /* cross-origin or not ready — fall through */
    }
    if (ok) return;
    if (attempt < 12) {
      setTimeout(
        () => this.driveChild(iframe, h, v, allowReload, attempt + 1),
        120
      );
      return;
    }
    /* Give up on in-place nav → force a fresh load that reads the hash. */
    if (allowReload) {
      iframe.dataset.booted = "1";
      iframe.src = this.peekUrl(this.slideHash(h, v)) + `&_r=${Date.now()}`;
    }
  }

  /* Reveal hash fragment for a horizontal (h) / vertical (v) index. Numeric
     addressing is the most robust form for this flat deck; reveal rewrites
     it to its canonical id-hash on load. */
  slideHash(h, v) {
    return v ? `#/${h}/${v}` : `#/${h}`;
  }

  /* Resolve index.html relative to THIS document (presenter.html), then add
     the peek query + a slide hash. Using new URL() avoids brittle "../../"
     paths — it works no matter where presenter.html is served from.
     Peek mode strips motion + cursor-hiding and pre-fills count-ups (see the
     index.html snippet) so previews stay calm and correct. */
  peekUrl(hash) {
    const url = new URL("index.html", document.baseURI);
    url.searchParams.set("present", "peek");
    const deckParam = new URLSearchParams(location.search).get("deck");
    if (deckParam) url.searchParams.set("deck", deckParam);
    return url.toString() + (hash || "");
  }

  previewLabelForIndex(idx) {
    if (!this.deckData?.slides) return `Slide ${idx + 1}`;
    return slideTitle(this.deckData.slides[idx], idx);
  }

  /* ---- Clocks + pacing (runs ~4×/s) ---- */
  tick() {
    const now = Date.now();

    if (this.el.wallClock) this.el.wallClock.textContent = fmtWall(new Date());

    /* Elapsed since the presentation timer started (null until first move). */
    const elapsedS = this.startedAt ? (now - this.startedAt) / 1000 : 0;
    if (this.el.elapsed) this.el.elapsed.textContent = fmtClock(elapsedS);

    /* Per-slide rolling pace vs the slide's budget. */
    const budget = this.state.timing || DEFAULT_TIMING;
    const onSlideS = this.slideEnteredAt
      ? (now - this.slideEnteredAt) / 1000
      : 0;
    const ratio = clamp(onSlideS / budget, 0, 1.5);

    if (this.el.paceFill) {
      this.el.paceFill.style.transform = `scaleX(${clamp(ratio, 0, 1)})`;
    }
    if (this.el.pace) {
      this.el.pace.textContent = `${fmtClock(onSlideS)} / ${fmtClock(budget)}`;
    }
    /* Color state: under budget = calm, near = warm, over = stopper red. */
    let paceState = "ok";
    if (onSlideS > budget) paceState = "over";
    else if (onSlideS > budget * 0.8) paceState = "warn";
    if (this.el.pace) {
      this.el.pace.dataset.state = paceState;
      if (this.el.paceFill) this.el.paceFill.dataset.state = paceState;
    }
  }

  /* ---- Connection watchdog ---- */
  checkConnection() {
    const alive =
      this.connected && Date.now() - this.lastSignalAt < WATCHDOG_MS;
    if (alive) {
      this.setConnected(true);
      return;
    }
    /* No recent signal. If we've never had one, we're standalone. */
    this.setConnected(false);
    if (!this.bus.hasChannel) {
      this.setStatus(
        "No BroadcastChannel in this browser — preview-only from saved state."
      );
    } else if (this.lastSignalAt === 0) {
      this.setStatus("Deck window not detected. Open the deck to sync.");
    }
  }

  setConnected(v) {
    if (this.connected === v) return;
    this.connected = v;
    document.body.classList.toggle("is-connected", v);
    document.body.classList.toggle("is-disconnected", !v);
    if (v) this.setStatus("");
  }

  setStatus(text) {
    if (!this.el.status) return;
    this.el.status.textContent = text || "";
    this.el.status.hidden = !text;
  }

  /* ---- Jump list ---- */
  buildJumpList() {
    const list = this.el.jumpList;
    if (!list) return;
    const slides = this.deckData?.slides || [];
    if (!slides.length) {
      list.innerHTML = `<li class="pv-jump-empty">No slide list available.</li>`;
      return;
    }
    list.innerHTML = slides
      .map((slide, i) => {
        const title = escapeHtml(slideTitle(slide, i));
        const eyebrow = slide.eyebrow ? escapeHtml(slide.eyebrow) : "";
        return `<li>
          <button type="button" class="pv-jump-item" data-index="${i}">
            <span class="pv-jump-num">${pad2(i + 1)}</span>
            <span class="pv-jump-text">
              ${eyebrow ? `<span class="pv-jump-eyebrow">${eyebrow}</span>` : ""}
              <span class="pv-jump-title">${title}</span>
            </span>
          </button>
        </li>`;
      })
      .join("");

    list.addEventListener("click", (ev) => {
      const btn = ev.target.closest(".pv-jump-item");
      if (!btn) return;
      const idx = Number(btn.dataset.index);
      if (!Number.isInteger(idx)) return;
      this.cmd("goto", { h: idx, v: 0 });
      this.closeJump();
    });

    this.highlightJump();
  }

  highlightJump() {
    const list = this.el.jumpList;
    if (!list) return;
    list.querySelectorAll(".pv-jump-item").forEach((btn) => {
      const on = Number(btn.dataset.index) === this.state.index;
      btn.classList.toggle("is-current", on);
      if (on) btn.setAttribute("aria-current", "true");
      else btn.removeAttribute("aria-current");
    });
  }

  toggleJump() {
    if (!this.el.jumpPanel) return;
    const open = this.el.jumpPanel.classList.toggle("is-open");
    if (this.el.btnJump) this.el.btnJump.setAttribute("aria-expanded", String(open));
    if (open) {
      this.highlightJump();
      const cur = this.el.jumpList?.querySelector(".pv-jump-item.is-current");
      cur?.scrollIntoView({ block: "center" });
      cur?.focus();
    }
  }

  closeJump() {
    if (!this.el.jumpPanel) return;
    this.el.jumpPanel.classList.remove("is-open");
    if (this.el.btnJump) this.el.btnJump.setAttribute("aria-expanded", "false");
  }

  /* ---- Controls ---- */
  wireControls() {
    this.el.btnPrev?.addEventListener("click", () => this.cmd("prev"));
    this.el.btnNext?.addEventListener("click", () => this.cmd("next"));
    this.el.btnBlank?.addEventListener("click", () => this.cmd("black"));
    this.el.btnJump?.addEventListener("click", () => this.toggleJump());
    this.el.btnReset?.addEventListener("click", () => this.resetTimer());
    this.el.btnReconnect?.addEventListener("click", () => this.reconnect());

    /* The "Open deck" affordance in the banner opens the shared deck in a
       new tab (user gesture → never popup-blocked). Resolve the URL relative
       to THIS document via new URL() (no brittle "../.." paths). */
    if (this.el.openDeck) {
      const url = new URL("index.html", document.baseURI);
      const deckParam = new URLSearchParams(location.search).get("deck");
      if (deckParam) url.searchParams.set("deck", deckParam);
      this.el.openDeck.href = url.toString();
    }
  }

  resetTimer() {
    this.startedAt = Date.now();
    this.slideEnteredAt = Date.now();
    this.tick();
  }

  reconnect() {
    this.lastSignalAt = 0;
    this.bus.send({ t: "hello" });
    this.setStatus("Reconnecting…");
  }

  wireKeyboard() {
    window.addEventListener("keydown", (ev) => {
      /* Don't steal typing focus (there are no inputs, but be safe). */
      const tag = (ev.target && ev.target.tagName) || "";
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      switch (ev.key) {
        case "ArrowRight":
        case "PageDown":
        case " ":
        case "Spacebar":
          ev.preventDefault();
          this.cmd("next");
          break;
        case "ArrowLeft":
        case "PageUp":
          ev.preventDefault();
          this.cmd("prev");
          break;
        case "b":
        case "B":
          ev.preventDefault();
          this.cmd("black");
          break;
        case "g":
        case "G":
          ev.preventDefault();
          this.toggleJump();
          break;
        case "r":
        case "R":
          ev.preventDefault();
          this.resetTimer();
          break;
        case "Escape":
          this.closeJump();
          break;
        default:
          break;
      }
    });
  }
}

/* --------------------------------------------------------------
   Boot
-------------------------------------------------------------- */
const presenter = new Presenter();
presenter.init();
