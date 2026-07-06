/* ============================================================
   engage/join.js — the presenter-facing JOIN PANEL (CHROME).
   Wave 5a (PLATFORM-V2-CONCEPT.md §4.7 "Join flow" / §2.2 "a Join
   panel that surfaces a room QR mid-talk").
   ------------------------------------------------------------
   A dismissible on-brand overlay the presenter surfaces DURING a
   talk so the room can join in one glance. It renders, for the
   live Engage room:

     · a big brand-blue QR of the viewer URL (from vendor/qr.mjs,
       a zero-dependency, CDN-free encoder), sized to stay crisp on
       a projector;
     · the 6-character room CODE, large in Chillax, as a typing
       fallback for anyone who cannot scan;
     · the plain join URL in text;
     · a live "N watching" count wired to the Engage presence the
       host already publishes.

   It imports ONLY the QR encoder (vendored) and the Engage handle
   initCollab returned (its transport, for presence). It opens NO
   second transport, sends NOTHING on the wire, and renders nothing
   in print/peek (its chrome is gated the same way .fc-* is). If the
   QR module fails to load, the panel still shows the code + URL, so
   the room can always join by typing (graceful degradation).

   Public API:
     initJoin(engage, opts?) -> { open, close, toggle, isOpen,
                                  update, destroy, enabled }
       engage  the handle from initCollab: { transport, room, ... }.
               transport.presence() and transport.on('presence'|'state')
               drive the live count; transport.roomId is the room.
       opts.deckId   the resolved deck id (index.html computes it), so
                     the viewer URL carries ?deck=<id> like collab/viewer.
       opts.room     explicit room override (else engage.room / transport)
       opts.title    optional heading (default "Join the room")
   buildJoinPanel(opts) is exported too for callers that want the DOM
   without the presence wiring (kept thin; initJoin is the main entry).
   ============================================================ */

/* The QR encoder is vendored at the repo root (like dist/reveal.mjs) and
   imported RELATIVELY so it works under the GitHub Pages subpath. It is
   loaded lazily on first open() so a talk that never surfaces Join pays
   nothing, and a missing/blocked module degrades to code + URL only. */
const QR_MODULE_URL = "../qr.js"; // shared brand-QR helper (wraps vendor/qr.mjs)

/* Room code shape shown as the typing fallback: 6 uppercase alnum chars.
   Ambiguous glyphs (0/O, 1/I) are dropped so a code read off a projector
   is unambiguous when typed back. */
const CODE_LEN = 6;
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no O,0,I,1

/* ------------------------------------------------------------------
   Scoped styles — injected once, tokens only (mirrors collab.js).
   Motion is transform/opacity; the panel is a centred card over a
   dimming scrim, with an orbital-ring accent behind the QR.
------------------------------------------------------------------ */
const STYLE_ID = "fmnts-join-style";
function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const css = `
  .jn-root, .jn-root * { box-sizing: border-box; }
  .jn-root {
    position: fixed; inset: 0; z-index: 70;
    display: flex; align-items: center; justify-content: center;
    font-family: var(--font-body); color: var(--fg-default);
    pointer-events: none; opacity: 0;
    transition: opacity var(--duration-normal) var(--ease-out-expo);
  }
  .jn-root.is-open { pointer-events: auto; opacity: 1; }
  .jn-root button { font-family: inherit; cursor: pointer; }

  /* dimming scrim — click to dismiss */
  .jn-scrim {
    position: absolute; inset: 0;
    background: rgba(30,42,51,.44);
    backdrop-filter: blur(2px);
  }

  /* the join card */
  .jn-card {
    position: relative; z-index: 1;
    width: 440px; max-width: calc(100vw - 40px);
    background: var(--bg-surface); color: var(--fg-default);
    border-radius: var(--radius-2xl); box-shadow: var(--elevation-5);
    padding: var(--space-8) var(--space-8) var(--space-6);
    text-align: center;
    transform: translateY(10px) scale(.98);
    transition: transform var(--duration-normal) var(--ease-out-expo);
  }
  .jn-root.is-open .jn-card { transform: translateY(0) scale(1); }

  .jn-close {
    position: absolute; top: 12px; right: 12px;
    width: 34px; height: 34px; padding: 0;
    display: inline-flex; align-items: center; justify-content: center;
    border: none; border-radius: var(--radius-pill);
    background: transparent; color: var(--fg-subtle);
    font-size: 20px; line-height: 1;
    transition: background var(--duration-fast) var(--ease-out-expo),
                color var(--duration-fast) var(--ease-out-expo);
  }
  .jn-close:hover { background: var(--blue-50); color: var(--fmnts-primary); }
  .jn-close:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--border-focus); }

  .jn-eyebrow {
    text-transform: uppercase; letter-spacing: .22em; font-weight: 600;
    font-size: var(--overline); color: var(--fmnts-primary);
    margin-bottom: var(--space-2);
  }
  .jn-title {
    font-size: var(--h4); line-height: var(--h4-lh); font-weight: 600;
    margin: 0 0 var(--space-5);
  }

  /* QR + orbital-ring accent */
  .jn-qr {
    position: relative;
    width: 232px; height: 232px; margin: 0 auto var(--space-5);
    display: flex; align-items: center; justify-content: center;
  }
  /* the orbital ring the brand rides — decelerating, never bouncing */
  .jn-qr::before {
    content: ""; position: absolute; inset: -14px;
    border: 2px solid var(--blue-100); border-radius: 50%;
    border-top-color: var(--fmnts-primary);
    opacity: .8;
    animation: jn-orbit 9s linear infinite;
  }
  .jn-qr svg {
    position: relative; z-index: 1;
    width: 200px; height: 200px; display: block;
    border-radius: var(--radius-sm);
    box-shadow: var(--elevation-2);
  }
  .jn-qr.is-empty::before { animation: none; }
  @keyframes jn-orbit { to { transform: rotate(360deg); } }

  /* the big typing-fallback code */
  .jn-code {
    font-family: var(--font-display); font-feature-settings: "tnum" 1;
    font-size: clamp(2rem, 1.4rem + 3vw, 3rem); font-weight: 600;
    letter-spacing: .18em; color: var(--fmnts-primary);
    line-height: 1; margin-bottom: var(--space-1);
  }
  .jn-code-lbl {
    text-transform: uppercase; letter-spacing: .2em;
    font-size: var(--overline); color: var(--fg-muted); font-weight: 600;
    margin-bottom: var(--space-4);
  }

  /* the plain join URL */
  .jn-url {
    display: inline-block; max-width: 100%;
    font-size: var(--body-sm); color: var(--fg-muted);
    word-break: break-all; padding: 6px 12px;
    background: var(--blue-50); border-radius: var(--radius-pill);
    margin-bottom: var(--space-4);
  }

  /* live watching count */
  .jn-watching {
    display: inline-flex; align-items: center; gap: var(--space-2);
    font-size: var(--body-sm); font-weight: 600; color: var(--fg-default);
  }
  .jn-watching .jn-dot {
    width: 8px; height: 8px; border-radius: 50%;
    background: var(--fmnts-primary);
    box-shadow: 0 0 0 4px rgba(0,116,200,.16);
  }
  .jn-watching.is-off .jn-dot { background: var(--fg-subtle); box-shadow: none; }
  .jn-watching b {
    font-family: var(--font-display); font-feature-settings: "tnum" 1;
    color: var(--fmnts-primary);
  }

  /* never render the join panel in print/peek exports */
  body.print-pdf .jn-root, body.is-peek .jn-root { display: none !important; }

  @media (prefers-reduced-motion: reduce) {
    .jn-qr::before { animation: none; }
    .jn-root, .jn-card { transition: none; }
  }
  `;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = css;
  document.head.appendChild(style);
}

/* ------------------------------------------------------------------
   Tiny DOM helper — mirrors collab.js el().
------------------------------------------------------------------ */
function el(tag, attrs = {}, html) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === false || v == null) continue;
    if (k === "class") node.className = v;
    else node.setAttribute(k, v === true ? "" : String(v));
  }
  if (html != null) node.innerHTML = html;
  return node;
}

/* ------------------------------------------------------------------
   Derive a stable, human 6-char CODE from the room id.
   ------------------------------------------------------------------
   Many rooms are ALREADY a short code (deck.meta.room like "K7QP2M").
   If the room id is a clean short alnum token we uppercase and use it
   verbatim so what the presenter sees matches the bound room exactly.
   Otherwise (a long deck id like "2026-07-02-ai-pitchdecks") we hash
   it deterministically into 6 unambiguous chars, so the SAME room
   always shows the SAME code across reloads and devices. The code is
   a TYPING FALLBACK only; the QR/URL carry the real room verbatim, so
   a derived code never has to round-trip back to the room id.
------------------------------------------------------------------ */
export function roomCode(roomId) {
  const raw = typeof roomId === "string" ? roomId.trim() : "";
  if (!raw) return "".padEnd(CODE_LEN, "-");

  // Already a short, clean code — normalize to uppercase and pad/truncate.
  const upper = raw.toUpperCase();
  if (/^[A-Z0-9]{4,8}$/.test(upper)) {
    if (upper.length === CODE_LEN) return upper;
    if (upper.length < CODE_LEN) return upper.padEnd(CODE_LEN, "X");
    return upper.slice(0, CODE_LEN);
  }

  // Long / punctuated id — deterministic FNV-1a hash into the alphabet.
  // 32-bit FNV-1a, then pull CODE_LEN chars by successive mixing so the
  // spread across positions is even (not just low bits repeated).
  let h = 0x811c9dc5;
  for (let i = 0; i < raw.length; i++) {
    h ^= raw.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  let out = "";
  for (let i = 0; i < CODE_LEN; i++) {
    out += CODE_ALPHABET[h % CODE_ALPHABET.length];
    // re-mix between characters so each position draws from a fresh state
    h = (Math.imul(h ^ (h >>> 13), 0x01000193) >>> 0) || 1;
  }
  return out;
}

/* ------------------------------------------------------------------
   Build the viewer join URL, RELATIVE to the current page so it works
   under the GitHub Pages subpath. viewer.html resolves the same room
   from ?room= (collab.js / viewer.js), and ?deck= from the deck id, so
   a scan lands in the right room following the right deck.
------------------------------------------------------------------ */
function buildJoinUrl(room, deckId) {
  try {
    const u = new URL("viewer.html", document.baseURI);
    if (deckId) u.searchParams.set("deck", deckId);
    if (room) u.searchParams.set("room", room);
    return u.toString();
  } catch {
    // No document.baseURI (non-browser) — a best-effort relative string.
    const params = [];
    if (deckId) params.push("deck=" + encodeURIComponent(deckId));
    if (room) params.push("room=" + encodeURIComponent(room));
    return "viewer.html" + (params.length ? "?" + params.join("&") : "");
  }
}

/* ==================================================================
   buildJoinPanel(opts) -> { root, els, setQr, setWatching, destroy }
   ------------------------------------------------------------------
   Renders the DOM (scrim + card) and returns handles the caller wires.
   Thin on purpose: no transport, no QR import here. initJoin() is the
   full entry that lazy-loads the QR and wires presence.
     opts.room     the live room id (verbatim, drives URL + QR)
     opts.deckId   deck id for the viewer URL
     opts.title    heading text
     opts.onClose  called when the panel is dismissed (Esc / scrim / ✕)
================================================================== */
export function buildJoinPanel(opts = {}) {
  injectStyles();
  const room = (opts.room || "").trim();
  const deckId = (opts.deckId || "").trim();
  const title = opts.title || "Join the room";
  const url = buildJoinUrl(room, deckId);
  const code = roomCode(room);

  const root = el("div", { class: "jn-root", role: "dialog", "aria-modal": "true", "aria-label": title, hidden: true });
  const scrim = el("div", { class: "jn-scrim" });
  const card = el("div", { class: "jn-card" });

  const closeBtn = el("button", { class: "jn-close", type: "button", "aria-label": "Close join panel" }, "&#215;");
  const eyebrow = el("div", { class: "jn-eyebrow" }, "Formunauts Present");
  const heading = el("h2", { class: "jn-title" });
  heading.textContent = title;

  // QR host — filled by setQr(); a placeholder keeps the ring/box sized
  // before the encoder resolves, and stays as the fallback if it fails.
  const qrHost = el("div", { class: "jn-qr is-empty" });

  const codeEl = el("div", { class: "jn-code" });
  codeEl.textContent = code;
  const codeLbl = el("div", { class: "jn-code-lbl" }, "Room code");

  const urlEl = el("div", { class: "jn-url" });
  urlEl.textContent = url;

  const watching = el("div", { class: "jn-watching is-off" });
  const dot = el("span", { class: "jn-dot" });
  const wcount = el("b", {}, "0");
  const wlabel = el("span", {}, "watching");
  watching.append(dot, wcount, wlabel);

  card.append(closeBtn, eyebrow, heading, qrHost, codeEl, codeLbl, urlEl, watching);
  root.append(scrim, card);

  /* dismissal — scrim click, ✕, and Esc (Esc bound while open only). */
  const requestClose = () => opts.onClose && opts.onClose();
  scrim.addEventListener("click", requestClose);
  closeBtn.addEventListener("click", requestClose);

  return {
    root,
    els: { qrHost, codeEl, urlEl, watching, wcount },
    url,
    code,
    /* setQr(svgString) — inject the brand QR, or leave the fallback if empty. */
    setQr(svg) {
      if (typeof svg === "string" && svg.startsWith("<svg")) {
        qrHost.innerHTML = svg;
        qrHost.classList.remove("is-empty");
      }
    },
    /* setWatching(n) — update the live count + the "live" dot state. */
    setWatching(n) {
      const c = Number(n) || 0;
      wcount.textContent = String(c);
      watching.classList.toggle("is-off", c <= 0);
    },
    destroy() {
      scrim.removeEventListener("click", requestClose);
      closeBtn.removeEventListener("click", requestClose);
      root.remove();
    },
  };
}

/* ==================================================================
   initJoin(engage, opts) -> control handle
   ------------------------------------------------------------------
   The main entry the deck HUD drives. Builds the panel, lazy-loads the
   QR encoder on first open, and keeps the "N watching" count in sync
   with the Engage presence the host publishes.

   Safe to call unconditionally: with no room it returns a disabled
   handle whose open/toggle are no-ops (so the HUD button can always
   exist and simply do nothing when there is no room).
================================================================== */
export function initJoin(engage, opts = {}) {
  const transport = engage && engage.transport;
  const room =
    (opts.room && String(opts.room).trim()) ||
    (engage && typeof engage.room === "string" && engage.room.trim()) ||
    (transport && typeof transport.roomId === "string" && transport.roomId.trim()) ||
    "";

  // No room → a disabled handle. The HUD can still mount its button; it
  // just won't open anything (there is nothing to join).
  if (!room) {
    return {
      enabled: false,
      isOpen: () => false,
      open() {},
      close() {},
      toggle() {},
      update() {},
      destroy() {},
    };
  }

  const panel = buildJoinPanel({
    room,
    deckId: opts.deckId,
    title: opts.title,
    onClose: () => api.close(),
  });
  document.body.appendChild(panel.root);

  let open = false;
  let qrLoaded = false;
  let qrTried = false;
  const unsubs = [];

  /* Presence: seed from the transport's last-known count, then track live
     `presence` and `state` broadcasts (the host publishes both). */
  function currentCount() {
    try {
      const p = transport && typeof transport.presence === "function" ? transport.presence() : null;
      return p && Number.isFinite(p.count) ? p.count : 0;
    } catch {
      return 0;
    }
  }
  panel.setWatching(currentCount());
  if (transport && typeof transport.on === "function") {
    const offPresence = transport.on("presence", (msg) => {
      panel.setWatching(Number(msg && msg.count) || 0);
    });
    const offState = transport.on("state", (msg) => {
      if (msg && msg.presence) panel.setWatching(Number(msg.presence.count) || 0);
    });
    if (typeof offPresence === "function") unsubs.push(offPresence);
    if (typeof offState === "function") unsubs.push(offState);
  }

  /* Lazy-load + render the QR the first time the panel opens. A failed or
     blocked import is swallowed: the code + URL are enough to join, so the
     panel degrades gracefully instead of erroring. */
  async function ensureQr() {
    if (qrLoaded || qrTried) return;
    qrTried = true;
    try {
      const mod = await import(QR_MODULE_URL);
      const make = mod && (mod.qrSvg || mod.default);
      if (typeof make === "function") {
        // brand blue on white, generous quiet zone, crisp on a projector
        const svg = make(panel.url, { ecc: "medium", border: 3 });
        panel.setQr(svg);
        qrLoaded = true;
      }
    } catch (err) {
      console.warn("[join] QR encoder unavailable; showing code + URL only", err);
    }
  }

  /* Esc-to-close is bound only while the panel is open. */
  function onKeydown(e) {
    if (e.key === "Escape") api.close();
  }

  const api = {
    enabled: true,
    isOpen: () => open,
    open() {
      if (open) return;
      open = true;
      panel.root.hidden = false;
      // next frame so the CSS transition runs from the hidden state
      requestAnimationFrame(() => panel.root.classList.add("is-open"));
      panel.setWatching(currentCount());
      document.addEventListener("keydown", onKeydown);
      ensureQr();
    },
    close() {
      if (!open) return;
      open = false;
      panel.root.classList.remove("is-open");
      document.removeEventListener("keydown", onKeydown);
      // hide after the fade so it stops intercepting pointer events
      const hide = () => {
        if (!open) panel.root.hidden = true;
      };
      setTimeout(hide, 320); // matches --duration-normal (300ms) + slack
    },
    toggle() {
      if (open) api.close();
      else api.open();
    },
    /* update({ watching }) — let a caller push a count (e.g. the HUD that
       already tracks presence) without waiting on a broadcast. */
    update(next = {}) {
      if (next && next.watching != null) panel.setWatching(next.watching);
    },
    destroy() {
      document.removeEventListener("keydown", onKeydown);
      for (const off of unsubs) {
        try {
          off();
        } catch {
          /* ignore */
        }
      }
      panel.destroy();
    },
  };

  return api;
}

export default initJoin;
