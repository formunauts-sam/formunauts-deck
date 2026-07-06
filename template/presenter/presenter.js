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
     presenter → deck  : {type:'tool'|'toolColor'|'pointer'|'pointerHide'|
                          'strokeStart'|'strokePoint'|'strokeEnd'|'clearInk'}
                         (annotation remote-drive → RevealMarker via
                          deck-link.js; nx/ny are 0..1 in slide space)

   Notes are ALWAYS delivered as channel data (the deck reads its
   own <aside class="notes"> innerHTML and broadcasts it) — never
   scraped through the preview iframe. When no deck is live, the
   console imports the deck data module directly (same-origin) so
   notes, titles and the jump list still populate.
   ============================================================ */

import { ACTIVE_DECK } from "../../decks/manifest.js";
import {
  getNote,
  setNote,
  clearNote,
  listOverrides,
  clearDeck,
  isStorageAvailable,
} from "./notes-store.js";

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

/* The active demo. Derived from the manifest's newest entry (ACTIVE_DECK
   = manifest[0]) — the SAME single source of truth index.html and the hub
   hero use, so the standalone / jump-list fallback always loads the deck
   the shared window shows. Overridable with ?deck=YYYY-MM-DD (same rule as
   index.html). */
const DEFAULT_DECK = ACTIVE_DECK;

/* Annotation remote-drive. The preview maps pointer positions onto the
   same 16:9 aspect-fit letterbox reveal applies inside the peek iframe,
   so nx/ny land on the deck exactly where they sat on the preview. */
const SLIDE_W = 1280; // author frame — mirrors index.html's reveal width
const SLIDE_H = 720; // author frame — mirrors index.html's reveal height
const PEEK_MIN_SCALE = 0.2; // mirrors index.html minScale — the peek deck
const PEEK_MAX_SCALE = 2.0; // clamps too, so our letterbox math must match
const POINTER_SEND_MS = 33; // ~30Hz pointer/stroke send throttle
const INK_PREVIEW_WIDTH = 4; // author px — mirrors marker ink defaultWidth
const INK_DEFAULT_COLOR = "#0074C8"; // brand primary — default ink colour
const LASER_CORE = "#E03B50"; // brand secondary — the deck laser core colour
const LASER_DOT_R = 6; // author px — mirrors the deck laser dotRadius
const LASER_TRAIL_MS = 900; // ms a mirror trail point lives before it fades
const SPOTLIGHT_VEIL = "rgba(4,15,26,0.55)"; // preview dim wash (lighter than deck)
const SPOTLIGHT_RADIUS = 140; // author px — mirrors the deck spotlight radius

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
/* The resolved deck id for THIS console: ?deck= value (validated) or the
   active deck. This is the SAME id notes overrides are keyed under, so the
   store, the previews and the deck-data fallback never disagree about which
   deck they are looking at. */
function resolveDeckId() {
  const wanted =
    new URLSearchParams(location.search).get("deck") || DEFAULT_DECK;
  return /^[0-9A-Za-z._-]+$/.test(wanted) ? wanted : DEFAULT_DECK;
}

async function loadDeckData() {
  const safe = resolveDeckId();
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
      /* Notes editing (prep) */
      editedFlag: $("#pv-edited-flag"),
      btnEdit: $("#pv-notes-edit"),
      btnExport: $("#pv-notes-export"),
      btnClearOverrides: $("#pv-notes-clear"),
      editor: $("#pv-notes-editor"),
      editorField: $("#pv-notes-input"),
      editorStatus: $("#pv-editor-status"),
      btnSave: $("#pv-notes-save"),
      btnCancel: $("#pv-notes-cancel"),
      jumpList: $("#pv-jump-list"),
      jumpPanel: $("#pv-jump"),
      btnPrev: $("#pv-prev"),
      btnNext: $("#pv-next"),
      btnBlank: $("#pv-blank"),
      btnJump: $("#pv-jump-toggle"),
      btnReset: $("#pv-reset-timer"),
      btnReconnect: $("#pv-reconnect"),
      openDeck: $("#pv-open-deck"),
      toolShell: $("#pv-current-shell"),
      inkOverlay: $("#pv-ink-overlay"),
      toolButtons: Array.from(document.querySelectorAll(".pv-tool[data-tool]")),
      colorDots: Array.from(document.querySelectorAll(".pv-tool-color")),
      btnClearInk: $("#pv-tool-clear"),
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

    /* Notes overrides. deckId is the SAME id the store keys under; the slide
       id comes from the deck data at the live index. `editing` gates the
       editor so it never fights live navigation or the timer. */
    this.deckId = resolveDeckId();
    this.editing = false;
    this.editingSlideId = null; // which slide the open editor belongs to

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

    /* Annotation tool strip (remote-drives the deck's marker plugin). */
    this.tool = null; // 'laser' | 'ink' | 'spotlight' | null
    this.toolColor = INK_DEFAULT_COLOR;
    this.inkDrawing = false;
    this.annotPointerId = null;
    this.inkLastLocal = null; // last overlay-space point of the live stroke
    this.lastPointerSentAt = 0; // performance.now() of the last send (throttle)
    this.overlayCtx = null;
    /* Laser mirror: short fading trail of overlay-space points {x,y,scale,t}
       so the presenter sees WHERE they are pointing (the deck laser is
       otherwise only visible to the audience). Redrawn on throttled move —
       no RAF loop, so it stays compositor-light. */
    this.laserTrail = [];
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
    this.wireAnnotation();

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

  /* The stable id of the slide currently shown, resolved from deck data at
     the live index. Notes overrides key on THIS (not the volatile index), so a
     saved override follows its slide even if the deck is reordered. Returns
     null when we can't identify the slide (no deck data) — the store is then
     skipped and deck-file notes show, exactly as before. */
  currentSlideId() {
    const slide = this.deckData?.slides?.[this.state.index];
    const id = slide && slide.id;
    return typeof id === "string" && id ? id : null;
  }

  /* The EFFECTIVE notes for the current slide: a saved override wins, else the
     notes carried by state (live broadcast OR standalone deck data). This is
     the single choke point both paths flow through, so an override applies
     whether the notes came over the channel or from the deck file. Returns
     RAW text; callers escape on display. */
  effectiveNotes() {
    const slideId = this.currentSlideId();
    if (slideId) {
      const override = getNote(this.deckId, slideId);
      // A saved override is RAW plain text the presenter typed. Return it
      // VERBATIM so literal angle brackets ("revenue > cost", "<config>") and
      // ampersands survive — never run tag-stripping on it. ("" is a real
      // override meaning "intentionally no notes".)
      if (override != null) return override;
    }
    // Deck-sourced notes are real HTML (the <aside class="notes"> innerHTML),
    // so normalize THOSE to plain text here — the one and only place it happens.
    return this.notesToText(this.state.notes || "");
  }

  /* True when the current slide carries a saved override (drives the flag). */
  currentHasOverride() {
    const slideId = this.currentSlideId();
    return slideId != null && getNote(this.deckId, slideId) != null;
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

    /* If the active slide changed out from under an open editor (live nav,
       jump, remote deck move), close it WITHOUT saving — editing must never
       trap the presenter on a stale slide. */
    if (this.editing && this.editingSlideId !== this.currentSlideId()) {
      this.closeEditor();
    }

    /* Notes — rendered as plain text, injection-proof. The deck sends the
       innerHTML of its own <aside class="notes"> (already esc()'d, so it is
       entity-escaped plain text); the standalone fallback sends a raw data
       string. A saved override wins over either. Either way we normalize to
       text and build <p> nodes with textContent, so no markup from data can
       ever execute here. While the editor is open we leave the read view
       untouched (the editor owns the panel). */
    if (this.el.notes && !this.editing) this.renderNotes(this.effectiveNotes());
    this.renderEditedFlag();

    /* Preview iframes — only reload when the target slide changed. */
    this.updatePreviews();

    /* Blank state on the console mirrors the deck being paused/black. */
    document.body.classList.toggle("is-blank", !!this.blank);
    if (this.el.btnBlank)
      this.el.btnBlank.setAttribute("aria-pressed", String(!!this.blank));

    this.tick(); // refresh pacing immediately
  }

  /* Paint the speaker notes as safe plain-text paragraphs. The input is
     ALREADY display-ready plain text (effectiveNotes normalized deck HTML and
     returns overrides verbatim), so we never tag-strip here — that would eat a
     presenter's literal angle brackets. */
  renderNotes(raw) {
    const box = this.el.notes;
    box.textContent = ""; // clear
    const text = String(raw == null ? "" : raw).trim();
    if (!text) {
      /* No effective notes → an obvious add-notes invitation, not a dead end.
         Only offer the button when storage is usable AND we can identify the
         slide (else the override could not be saved anyway). */
      box.appendChild(this.buildEmptyState());
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

  /* Build the add-notes empty state. When editing is possible it invites the
     presenter to add notes; otherwise it degrades to the plain read-only line
     (e.g. private mode, or a slide we can't identify to key an override). */
  buildEmptyState() {
    const canEdit = isStorageAvailable() && this.currentSlideId() != null;
    if (!canEdit) {
      const p = document.createElement("p");
      p.className = "pv-note-empty";
      p.textContent = "No speaker notes for this slide.";
      return p;
    }
    const wrap = document.createElement("div");
    wrap.className = "pv-note-addcta";

    const text = document.createElement("p");
    text.className = "pv-note-addcta__text";
    const lead = document.createElement("span");
    lead.className = "pv-note-addcta__lead";
    lead.textContent = "No notes yet";
    text.appendChild(lead);
    text.appendChild(
      document.createTextNode(
        "Jot down what you want to say on this slide. Saved on this device."
      )
    );

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "pv-note-addcta__btn";
    btn.textContent = "Add notes for this slide";
    btn.addEventListener("click", () => this.openEditor());

    wrap.appendChild(text);
    wrap.appendChild(btn);
    return wrap;
  }

  /* Reflect whether the current slide has a saved override: show the "edited"
     flag and keep the Edit trigger available. Cheap; called every render. */
  renderEditedFlag() {
    const flag = this.el.editedFlag;
    if (!flag) return;
    const on = this.currentHasOverride();
    flag.hidden = !on;
    /* Hide the Edit trigger entirely when there is no way to persist edits, so
       we never offer an action that silently no-ops. */
    if (this.el.btnEdit) {
      const canEdit = isStorageAvailable() && this.currentSlideId() != null;
      this.el.btnEdit.hidden = !canEdit;
    }
  }

  /* ---- Notes editor (prep) ----
     Editing is a PREP activity: it swaps the read panel for a raw textarea but
     leaves navigation, the timer and previews fully live. Save/Cancel/Escape
     all return to the read view. */
  openEditor() {
    const slideId = this.currentSlideId();
    if (!slideId || !isStorageAvailable()) return; // nothing we could persist
    if (this.editing) return;
    this.editing = true;
    this.editingSlideId = slideId;

    /* Seed the field with the EFFECTIVE notes (override if any, else the deck
       notes as plain text). effectiveNotes already returns display-ready text,
       so we do NOT tag-strip again (that would corrupt typed angle brackets). */
    if (this.el.editorField) this.el.editorField.value = this.effectiveNotes();
    this.setEditorStatus("");

    if (this.el.notes) this.el.notes.hidden = true;
    if (this.el.editor) this.el.editor.hidden = false;
    if (this.el.btnEdit) this.el.btnEdit.classList.add("is-active");

    /* Focus the field for immediate typing; place the caret at the end. */
    const f = this.el.editorField;
    if (f) {
      f.focus();
      const len = f.value.length;
      try {
        f.setSelectionRange(len, len);
      } catch {
        /* ignore (unsupported) */
      }
    }
  }

  /* Close the editor and return to the read view. Never saves. */
  closeEditor() {
    this.editing = false;
    this.editingSlideId = null;
    if (this.el.editor) this.el.editor.hidden = true;
    if (this.el.notes) this.el.notes.hidden = false;
    if (this.el.btnEdit) this.el.btnEdit.classList.remove("is-active");
    /* Repaint the read view from the (possibly just-saved) effective notes. */
    if (this.el.notes) this.renderNotes(this.effectiveNotes());
    this.renderEditedFlag();
  }

  /* Persist the textarea as this slide's override, then return to reading.
     Saving the field verbatim (raw text) — display escaping happens on paint. */
  saveEditor() {
    if (!this.editing) return;
    const slideId = this.editingSlideId;
    if (!slideId) {
      this.closeEditor();
      return;
    }
    const text = this.el.editorField ? this.el.editorField.value : "";
    const ok = setNote(this.deckId, slideId, text);
    if (!ok) {
      /* Storage refused (quota / private mode) — keep the editor open so the
         presenter doesn't lose what they typed, and say why. */
      this.setEditorStatus("Could not save on this device.", "warn");
      return;
    }
    this.closeEditor();
  }

  setEditorStatus(text, state) {
    const el = this.el.editorStatus;
    if (!el) return;
    el.textContent = text || "";
    if (state) el.dataset.state = state;
    else delete el.dataset.state;
  }

  /* ---- Export / clear overrides ----
     Export copies EVERY override for this deck as a JSON object
     { "<slideId>": "<notes text>", ... } — the exact shape Claude Code folds
     back into decks/<deckId>.deck.js. Clipboard with a visible confirmation;
     falls back to a textarea-select copy when the async clipboard is blocked. */
  async exportOverrides() {
    const btn = this.el.btnExport;
    const overrides = listOverrides(this.deckId);
    const count = Object.keys(overrides).length;
    if (!count) {
      this.flashButton(btn, "No overrides to export");
      return;
    }
    const json = JSON.stringify(overrides, null, 2);
    const copied = await this.copyText(json);
    if (copied) {
      this.flashButton(btn, `Copied ${count} override${count === 1 ? "" : "s"}`);
      console.info(
        `[presenter] Copied ${count} notes override(s) for deck "${this.deckId}". ` +
          `Hand this JSON to Claude Code to merge into decks/${this.deckId}.deck.js ` +
          `(match each key to the slide's id and update its notes):\n` +
          json
      );
    } else {
      /* Last resort: drop it in the console so it is never lost. */
      this.flashButton(btn, "Copy blocked, see console");
      console.info(
        `[presenter] Notes overrides for deck "${this.deckId}" ` +
          `(merge into decks/${this.deckId}.deck.js):\n` +
          json
      );
    }
  }

  /* Copy text via the async Clipboard API, falling back to a hidden-textarea
     execCommand copy for browsers/contexts that block it. */
  async copyText(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {
      /* fall through to the legacy path */
    }
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.top = "-1000px";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }

  /* Momentary label swap on a button (its own visible confirmation), then
     restore its original text. Each button caches its own resting label +
     timer on its dataset, so Export and Clear confirmations never clobber
     each other and rapid clicks don't stack timers. */
  flashButton(btn, label) {
    if (!btn) return;
    if (!btn.dataset.rest) btn.dataset.rest = btn.textContent;
    btn.textContent = label;
    if (btn._flashTimer) clearTimeout(btn._flashTimer);
    btn._flashTimer = setTimeout(() => {
      btn.textContent = btn.dataset.rest || "";
      btn._flashTimer = null;
    }, 1600);
  }

  /* Escape hatch: wipe every override for this deck (with a confirm), then
     repaint so the panel falls back to the deck-file notes immediately. */
  clearDeckOverrides() {
    const btn = this.el.btnClearOverrides;
    const count = Object.keys(listOverrides(this.deckId)).length;
    if (!count) {
      this.flashButton(btn, "No overrides to clear");
      return;
    }
    const ok = window.confirm(
      `Clear ${count} saved notes override${count === 1 ? "" : "s"} for this deck? ` +
        `This reverts to the deck file's notes and cannot be undone.`
    );
    if (!ok) return;
    if (this.editing) this.closeEditor();
    clearDeck(this.deckId);
    if (this.el.notes) this.renderNotes(this.effectiveNotes());
    this.renderEditedFlag();
    this.flashButton(btn, "Overrides cleared");
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
      /* New slide → the deck's ink is per-slide; drop the local mirror
         (ink strokes AND any laser trail) so nothing bleeds across slides. */
      this.laserTrail = [];
      this.clearOverlay();
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

    /* Notes editing (prep). These never send anything to the deck. */
    this.el.btnEdit?.addEventListener("click", () => this.openEditor());
    this.el.btnSave?.addEventListener("click", () => this.saveEditor());
    this.el.btnCancel?.addEventListener("click", () => this.closeEditor());
    this.el.btnExport?.addEventListener("click", () => this.exportOverrides());
    this.el.btnClearOverrides?.addEventListener("click", () =>
      this.clearDeckOverrides()
    );
    /* Storage availability is a fixed property of the browser context, so gate
       the deck-level prep buttons once. Per-slide Edit visibility is handled in
       renderEditedFlag (it also needs a resolvable slide id). */
    if (!isStorageAvailable()) {
      if (this.el.btnExport) this.el.btnExport.hidden = true;
      if (this.el.btnClearOverrides) this.el.btnClearOverrides.hidden = true;
      if (this.el.btnEdit) this.el.btnEdit.hidden = true;
    }
    /* Cmd/Ctrl+Enter saves from inside the textarea; Escape cancels. Scoped to
       the field so it does not shadow the global nav keys elsewhere. */
    this.el.editorField?.addEventListener("keydown", (ev) => {
      if ((ev.metaKey || ev.ctrlKey) && ev.key === "Enter") {
        ev.preventDefault();
        this.saveEditor();
      } else if (ev.key === "Escape") {
        ev.preventDefault();
        this.closeEditor();
      }
    });

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
      /* Leave browser shortcuts (Cmd/Ctrl/Alt combos) alone. */
      if (ev.metaKey || ev.ctrlKey || ev.altKey) return;

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
        case "l":
        case "L":
          ev.preventDefault();
          this.setTool("laser");
          break;
        case "i":
        case "I":
          ev.preventDefault();
          this.setTool("ink");
          break;
        case "s":
        case "S":
          ev.preventDefault();
          this.setTool("spotlight");
          break;
        case "c":
        case "C":
          ev.preventDefault();
          this.clearAnnotations();
          break;
        case "e":
        case "E":
          ev.preventDefault();
          this.openEditor();
          break;
        case "Escape":
          this.closeJump();
          break;
        default:
          break;
      }
    });
  }

  /* ---- Annotation tools (remote-drive the deck's marker plugin) ----
     The strip under the current preview arms laser / ink / spotlight.
     Pointer positions are normalized to the slide's 0..1 space via the
     SAME aspect-fit letterbox reveal applies inside the peek iframe,
     then broadcast; deck-link.js forwards them to RevealMarker. Sends
     no-op gracefully when no deck window is listening. */
  wireAnnotation() {
    this.el.toolButtons.forEach((btn) =>
      btn.addEventListener("click", () => this.setTool(btn.dataset.tool))
    );
    this.el.colorDots.forEach((dot) =>
      dot.addEventListener("click", () => this.setToolColor(dot.dataset.color))
    );
    this.el.btnClearInk?.addEventListener("click", () => this.clearAnnotations());

    const shell = this.el.toolShell;
    if (!shell) return;
    shell.addEventListener("pointerdown", (ev) => this.onAnnotDown(ev));
    shell.addEventListener("pointermove", (ev) => this.onAnnotMove(ev));
    shell.addEventListener("pointerup", (ev) => this.onAnnotUp(ev));
    shell.addEventListener("pointercancel", (ev) => this.onAnnotUp(ev));
    shell.addEventListener("pointerleave", () => this.onAnnotLeave());
    window.addEventListener("resize", () => this.sizeInkOverlay());
  }

  /* Toggle a tool on the strip. Re-selecting the active tool disarms it. */
  setTool(tool) {
    const next = this.tool === tool ? null : tool;
    if (this.inkDrawing) {
      /* Never strand a half-drawn stroke on a tool switch. */
      this.inkDrawing = false;
      this.annotPointerId = null;
      this.inkLastLocal = null;
      this.bus.send({ type: "strokeEnd" });
    }
    /* Wipe the laser/spotlight mirror on any tool change — the veil or comet
       must not linger under a different tool (or after disarming). Ink keeps
       its mirror until the slide changes, exactly as before. */
    this.laserTrail = [];
    if (this.tool === "laser" || this.tool === "spotlight") this.clearOverlay();
    this.tool = next;
    this.bus.send({ type: "tool", tool: next });
    this.syncToolStrip();
  }

  /* Pick an ink colour. Mirrors the deck toolbar semantics: choosing a
     colour arms the pen (the deck's setColor switches to ink mode too). */
  setToolColor(color) {
    if (!color) return;
    this.toolColor = color;
    this.tool = "ink";
    this.bus.send({ type: "toolColor", color });
    this.syncToolStrip();
  }

  /* Clear both sides: the local mirror and the deck's current-slide ink. */
  clearAnnotations() {
    this.laserTrail = [];
    this.clearOverlay();
    this.bus.send({ type: "clearInk" });
  }

  syncToolStrip() {
    this.el.toolButtons.forEach((btn) => {
      btn.setAttribute("aria-pressed", String(btn.dataset.tool === this.tool));
    });
    this.el.colorDots.forEach((dot) => {
      dot.setAttribute("aria-pressed", String(dot.dataset.color === this.toolColor));
    });
    if (this.el.toolShell) {
      this.el.toolShell.classList.toggle("is-annotating", !!this.tool);
    }
  }

  /* ---- Pointer handlers on the current-preview shell ---- */
  onAnnotDown(ev) {
    if (this.tool !== "ink") return;
    if (ev.button != null && ev.button !== 0) return;
    if (this.inkDrawing) return; // secondary touch (palm) must not steal the stroke
    const n = this.normFromEvent(ev);
    if (!n) return;
    this.inkDrawing = true;
    this.annotPointerId = ev.pointerId ?? null;
    try {
      this.el.toolShell.setPointerCapture &&
        this.el.toolShell.setPointerCapture(ev.pointerId);
    } catch {
      /* ignore */
    }
    this.sizeInkOverlay();
    this.inkLastLocal = this.overlayPoint(n);
    this.drawOverlayDot(this.inkLastLocal);
    this.lastPointerSentAt = performance.now();
    this.bus.send({ type: "strokeStart", nx: n.nx, ny: n.ny });
    ev.preventDefault();
  }

  onAnnotMove(ev) {
    if (!this.tool) return;
    const n = this.normFromEvent(ev);
    if (!n) return;

    if (this.tool === "ink") {
      if (!this.inkDrawing) return;
      if (this.annotPointerId != null && ev.pointerId !== this.annotPointerId)
        return;
      if (performance.now() - this.lastPointerSentAt < POINTER_SEND_MS) return;
      this.lastPointerSentAt = performance.now();
      const p = this.overlayPoint(n);
      this.drawOverlaySegment(this.inkLastLocal, p);
      this.inkLastLocal = p;
      this.bus.send({ type: "strokePoint", nx: n.nx, ny: n.ny });
      ev.preventDefault();
      return;
    }

    /* Laser + spotlight ride bare movement (no button), ~30Hz. */
    if (performance.now() - this.lastPointerSentAt < POINTER_SEND_MS) return;
    this.lastPointerSentAt = performance.now();
    /* Mirror the SAME normalized point locally so the presenter sees where
       they are pointing — the deck laser/spotlight is otherwise audience-only. */
    this.drawPointerMirror(n);
    this.bus.send({ type: "pointer", nx: n.nx, ny: n.ny });
  }

  onAnnotUp(ev) {
    if (this.tool !== "ink" || !this.inkDrawing) return;
    if (this.annotPointerId != null && ev.pointerId !== this.annotPointerId)
      return;
    this.inkDrawing = false;
    this.annotPointerId = null;
    try {
      this.el.toolShell.releasePointerCapture &&
        this.el.toolShell.releasePointerCapture(ev.pointerId);
    } catch {
      /* ignore */
    }
    /* Flush the final point past the throttle so the stroke ends exactly
       where the pen lifted, then commit on the deck side. */
    const n = this.normFromEvent(ev);
    if (n) {
      this.drawOverlaySegment(this.inkLastLocal, this.overlayPoint(n));
      this.bus.send({ type: "strokePoint", nx: n.nx, ny: n.ny });
    }
    this.inkLastLocal = null;
    this.bus.send({ type: "strokeEnd" });
  }

  onAnnotLeave() {
    /* The vanishing laser fades on its own; the spotlight must hide. */
    if (this.tool === "laser" || this.tool === "spotlight") {
      /* Clear the local mirror too, mirroring the deck: the pointer left the
         preview, so the comet/veil should not stay frozen on the overlay. */
      this.laserTrail = [];
      this.clearOverlay();
      this.bus.send({ type: "pointerHide" });
    }
  }

  /* ---- Geometry: preview pixels ↔ normalized slide space ----
     Reveal aspect-fits the 1280×720 author frame inside the peek iframe
     (scale = min(w/1280, h/720), centred), which produces letterbox bars
     when the shell is not exactly 16:9. Map through that SAME rect so a
     point on the preview lands on the identical spot on the deck. */
  normFromEvent(ev) {
    const shell = this.el.toolShell;
    if (!shell) return null;
    const r = shell.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    const scale = clamp(Math.min(r.width / SLIDE_W, r.height / SLIDE_H),
      PEEK_MIN_SCALE, PEEK_MAX_SCALE); // the peek deck clamps identically
    const w = SLIDE_W * scale;
    const h = SLIDE_H * scale;
    const left = r.left + (r.width - w) / 2;
    const top = r.top + (r.height - h) / 2;
    return {
      nx: clamp((ev.clientX - left) / w, 0, 1),
      ny: clamp((ev.clientY - top) / h, 0, 1),
    };
  }

  /* Convert a normalized slide point back to overlay CSS px (+ scale so
     stroke width tracks the preview size). */
  overlayPoint(n) {
    const r = this.el.toolShell.getBoundingClientRect();
    const scale = clamp(Math.min(r.width / SLIDE_W, r.height / SLIDE_H),
      PEEK_MIN_SCALE, PEEK_MAX_SCALE); // keep in lockstep with normFromEvent
    const w = SLIDE_W * scale;
    const h = SLIDE_H * scale;
    return {
      x: (r.width - w) / 2 + n.nx * w,
      y: (r.height - h) / 2 + n.ny * h,
      scale,
    };
  }

  /* ---- Local ink mirror (lightweight canvas above the preview) ---- */
  /* Size the mirror to the shell at device-pixel sharpness. Resizing a
     canvas wipes it — acceptable for a live mirror layer. */
  sizeInkOverlay() {
    const shell = this.el.toolShell;
    const cv = this.el.inkOverlay;
    if (!shell || !cv) return;
    const ratio = Math.max(1, window.devicePixelRatio || 1);
    const r = shell.getBoundingClientRect();
    const w = Math.round(r.width * ratio);
    const h = Math.round(r.height * ratio);
    if (cv.width !== w || cv.height !== h) {
      cv.width = w;
      cv.height = h;
    }
    this.overlayCtx = cv.getContext("2d");
    this.overlayCtx.setTransform(ratio, 0, 0, ratio, 0, 0); // draw in CSS px
  }

  drawOverlayDot(p) {
    const ctx = this.overlayCtx;
    if (!ctx || !p) return;
    ctx.save();
    ctx.fillStyle = this.toolColor;
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(0.75, (INK_PREVIEW_WIDTH * p.scale) / 2), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawOverlaySegment(a, b) {
    const ctx = this.overlayCtx;
    if (!ctx || !a || !b) return;
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = this.toolColor;
    ctx.lineWidth = Math.max(1.5, INK_PREVIEW_WIDTH * b.scale);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.restore();
  }

  /* ---- Laser / spotlight local mirror ----
     The deck renders these for the AUDIENCE; the presenter needs the same
     feedback on their own preview. We redraw on throttled move (no RAF), so
     it stays compositor-light. `n` is the SAME normalized point sent to the
     deck, so what the presenter sees matches the audience exactly. */
  drawPointerMirror(n) {
    if (!this.overlayCtx) this.sizeInkOverlay(); // lazily size (no pointerdown here)
    const p = this.overlayPoint(n);
    if (this.tool === "spotlight") {
      this.laserTrail = [];
      this.drawSpotlightMirror(p);
    } else if (this.tool === "laser") {
      const now = performance.now();
      this.laserTrail.push({ x: p.x, y: p.y, scale: p.scale, t: now });
      while (this.laserTrail.length && now - this.laserTrail[0].t > LASER_TRAIL_MS) {
        this.laserTrail.shift();
      }
      if (this.laserTrail.length > 120) this.laserTrail.shift(); // hard cap
      this.drawLaserMirror(now);
    }
  }

  /* Brand-red comet: a faint fading tail under a bright glowing head dot. */
  drawLaserMirror(now) {
    const ctx = this.overlayCtx;
    if (!ctx) return;
    this.clearOverlay();
    const trail = this.laserTrail;
    if (!trail.length) return;
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = LASER_CORE;
    for (let i = 1; i < trail.length; i++) {
      const a = trail[i - 1];
      const b = trail[i];
      const age = (now - b.t) / LASER_TRAIL_MS;
      ctx.globalAlpha = Math.max(0, 1 - age) * 0.6;
      ctx.lineWidth = Math.max(1, LASER_DOT_R * b.scale * (1 - age));
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    const head = trail[trail.length - 1];
    ctx.globalAlpha = 1;
    ctx.shadowColor = LASER_CORE;
    ctx.shadowBlur = 12;
    ctx.fillStyle = LASER_CORE;
    ctx.beginPath();
    ctx.arc(head.x, head.y, Math.max(1.5, LASER_DOT_R * head.scale), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /* Dim veil with a bright clear circle at the pointer. Uses destination-out
     to punch the hole, mirroring the deck spotlight's soft radial cut. */
  drawSpotlightMirror(p) {
    const ctx = this.overlayCtx;
    const shell = this.el.toolShell;
    if (!ctx || !shell) return;
    const r = shell.getBoundingClientRect();
    if (!r.width || !r.height) return;
    this.clearOverlay();
    ctx.save();
    ctx.fillStyle = SPOTLIGHT_VEIL;
    ctx.fillRect(0, 0, r.width, r.height); // CSS px (ctx carries the DPR transform)
    const rOuter = SPOTLIGHT_RADIUS * p.scale;
    const g = ctx.createRadialGradient(p.x, p.y, rOuter * 0.55, p.x, p.y, rOuter);
    g.addColorStop(0, "rgba(0,0,0,1)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.globalCompositeOperation = "destination-out";
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(p.x, p.y, rOuter, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  clearOverlay() {
    const cv = this.el.inkOverlay;
    if (!cv || !cv.width) return;
    const ctx = cv.getContext("2d");
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.restore();
  }
}

/* --------------------------------------------------------------
   Boot
-------------------------------------------------------------- */
const presenter = new Presenter();
presenter.init();
