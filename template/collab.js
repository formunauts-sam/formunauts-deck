/* ============================================================
   collab.js — LIVE COLLABORATION client (CHROME)
   ------------------------------------------------------------
   Optional audience layer over PartyKit. PURELY ADDITIVE:

     initCollab(Reveal, opts?)

   No-ops (and the deck is byte-for-byte the static experience)
   unless BOTH are true:
     1. a PARTY host is configured  (opts.host, or <meta
        name="party-host">, or window.PARTY_HOST, or ?party=)
     2. a room is present           (?room=<id>)

   URL params (read like index.html reads ?deck):
     ?room=<id>                which session to join (required)
     ?role=presenter|viewer    default viewer
     ?t=<token>                presenter token (matched server-side)
     ?party=<host>             optional PARTY host override
     ?name=<label>             optional display name

   Roles are SEPARATE and SERVER-ENFORCED:
     · presenter  broadcasts the slide index + (reveal `q`) pointer,
                  sees the HUD (presence · reactions · hands · Q&A ·
                  poll tally), and can open/close a poll.
     · viewer     follows the presenter's slide, votes in polls,
                  raises a hand, asks questions, sends reactions.

   Transport (DEFAULT): local BroadcastChannel — zero network, zero
   CDN, works offline. The PartyKit transport is an ALTERNATE that
   needs a vendored partysocket (vendor/partysocket.mjs — see
   PLATFORM-V2-CONCEPT.md Wave 6); it is NOT bundled here, so if it is
   ever selected it warns once and falls back to local. Either way
   initCollab degrades to a silent no-op unless a room + host are set.

   Everything visual is injected into a single scoped <style> that
   references ONLY brand tokens (--fmnts-*, --blue-*, --radius-*,
   --elevation-*, --ease-out-expo). Motion is transform/opacity
   only. Reactions are on-brand inline-SVG glyphs (no emoji, no red).
   ============================================================ */

/* ------------------------------------------------------------------
   Config discovery — where is the PartyKit host?
   Priority: explicit opts.host > ?party= > <meta party-host> >
             window.PARTY_HOST. Absent → collab disabled.
------------------------------------------------------------------ */
function resolveHost(opts) {
  const q = new URLSearchParams(location.search);
  const fromOpts = opts && typeof opts.host === "string" ? opts.host.trim() : "";
  const fromQuery = (q.get("party") || "").trim();
  const meta = document.querySelector('meta[name="party-host"]');
  const fromMeta = meta ? (meta.getAttribute("content") || "").trim() : "";
  const fromGlobal = typeof window.PARTY_HOST === "string" ? window.PARTY_HOST.trim() : "";
  return fromOpts || fromQuery || fromMeta || fromGlobal || "";
}

/* Normalize a host into what partysocket wants: bare host[:port],
   no scheme, no trailing slash. partysocket adds ws/wss itself. */
function normalizeHost(raw) {
  let h = raw.replace(/^wss?:\/\//i, "").replace(/^https?:\/\//i, "");
  h = h.replace(/\/+$/, "");
  return h;
}

/* Reaction kinds must match the server whitelist exactly. */
const REACTIONS = ["spark", "up", "clap", "eyes", "plus"];

const PROTO = 1; // bump if the message vocabulary changes
const MAX_FLYING = 40; // cap concurrent reaction nodes (perf)
const POINTER_MIN_MS = 40; // throttle pointer broadcasts (~25/s)
const AUTHOR_W = 1280; // deck canvas (matches Reveal config)
const AUTHOR_H = 720;

/* ------------------------------------------------------------------
   On-brand reaction glyphs — hand-authored 24x24 inline SVG.
   currentColor so brand blue is applied via CSS. NEVER emoji.
------------------------------------------------------------------ */
const GLYPHS = {
  // spark / rocket-trail: a four-point sparkle
  spark:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2c.5 3.6 1.8 4.9 5.4 5.4-3.6.5-4.9 1.8-5.4 5.4-.5-3.6-1.8-4.9-5.4-5.4C10.2 6.9 11.5 5.6 12 2Z" fill="currentColor"/><path d="M18.5 13c.3 1.9 1 2.6 2.9 2.9-1.9.3-2.6 1-2.9 2.9-.3-1.9-1-2.6-2.9-2.9 1.9-.3 2.6-1 2.9-2.9Z" fill="currentColor" opacity=".7"/></svg>',
  // thumbs-up
  up: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10v9H4a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1h3Zm3 0 3.2-6.4A1.6 1.6 0 0 1 15.6 3c1 0 1.7.9 1.5 1.9L16.4 9H20a2 2 0 0 1 2 2.3l-1 6A2 2 0 0 1 19 19h-8a1 1 0 0 1-1-1v-8Z" fill="currentColor"/></svg>',
  // applause / clapping hands
  clap:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11.5 12.7 6.9 8.1a1.4 1.4 0 0 1 2-2l3.4 3.4-.8 3.2ZM9 5.2l3.2 3.2 1.5-1.5-3.2-3.2a1.4 1.4 0 0 0-2 2l.5-.5Zm5.6-.2 2.7 2.7a1.4 1.4 0 0 1-2 2l-2.7-2.7 2-2Zm-9 8.3 3.9 3.9a5 5 0 0 0 7.3-.3l3.6-4.2-1.8-1.1-2.3 2 4.1-6.9a1.4 1.4 0 0 0-2.4-1.4l-2.9 5 .5-.9a1.4 1.4 0 0 0-2.3-1.6l-2 3a5 5 0 0 1-5.5 3.1l-.2-.3Z" fill="currentColor"/></svg>',
  // eyes / watching
  eyes:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 7c-3.3 0-6 2.5-6 5s2.7 5 6 5 6-2.5 6-5-2.7-5-6-5Zm0 8a3 3 0 1 1 0-6 3 3 0 0 1 0 6Z" fill="currentColor"/><path d="M16.5 8c-1 0-1.9.2-2.7.6.8.9 1.4 2 1.6 3.2a2.5 2.5 0 1 0 3.4 2.9c1.3-.8 2.2-2 2.2-2.7 0-2-2-4-4.5-4Z" fill="currentColor" opacity=".8"/></svg>',
  // plus-one
  plus:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 4a1 1 0 1 0-2 0v7H4a1 1 0 1 0 0 2h7v7a1 1 0 1 0 2 0v-7h7a1 1 0 1 0 0-2h-7V4Z" fill="currentColor"/></svg>',
};
const REACTION_TITLE = {
  spark: "Spark",
  up: "Agree",
  clap: "Applause",
  eyes: "Watching",
  plus: "+1",
};

/* small hand / raise-hand icon for the viewer toggle + HUD */
const HAND_SVG =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5a1.4 1.4 0 0 0-1.4 1.4v6.3h-.8V2.9a1.4 1.4 0 1 0-2.8 0v9.8l-1.2-1.5a1.5 1.5 0 0 0-2.4 1.8l3.2 4.6A5.6 5.6 0 0 0 11 21h2.3a5.6 5.6 0 0 0 5.6-5.6V6.1a1.4 1.4 0 1 0-2.8 0v4.1h-.8V4.4a1.4 1.4 0 0 0-2.7 0v5.8h-.8V3.9A1.4 1.4 0 0 0 12 2.5Z" fill="currentColor"/></svg>';

/* ------------------------------------------------------------------
   Scoped styles — injected once. Tokens only.
------------------------------------------------------------------ */
const STYLE_ID = "fmnts-collab-style";
function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const css = `
  .fc-root, .fc-root * { box-sizing: border-box; }
  .fc-root {
    position: fixed; inset: 0; z-index: 55;
    pointer-events: none;
    font-family: var(--font-body);
    color: var(--fg-default);
  }
  .fc-root button { font-family: inherit; cursor: pointer; }

  /* ---- presence badge (both roles) ---- */
  .fc-presence {
    position: absolute; left: 20px; top: 18px;
    display: inline-flex; align-items: center; gap: var(--space-2);
    padding: 7px 12px 7px 10px;
    background: var(--bg-surface); color: var(--fg-default);
    border-radius: var(--radius-pill);
    box-shadow: var(--elevation-3);
    font-size: var(--body-sm); line-height: 1; font-weight: 600;
    pointer-events: auto;
    transition: opacity var(--duration-normal) var(--ease-out-expo);
  }
  .fc-presence .fc-dot {
    width: 8px; height: 8px; border-radius: 50%;
    background: var(--fmnts-primary);
    box-shadow: 0 0 0 4px rgba(0,116,200,.16);
  }
  .fc-presence.is-off .fc-dot { background: var(--fg-subtle); box-shadow: none; }
  .fc-presence .fc-count { font-family: var(--font-display); font-feature-settings: "tnum" 1; }
  .fc-presence .fc-hands {
    display: inline-flex; align-items: center; gap: 4px;
    padding-left: 8px; margin-left: 2px;
    border-left: 1px solid var(--border-subtle);
    color: var(--fmnts-primary);
  }
  .fc-presence .fc-hands svg { width: 14px; height: 14px; }
  .fc-presence .fc-hands[hidden] { display: none; }
  .fc-role-tag {
    text-transform: uppercase; letter-spacing: .16em;
    font-size: var(--overline); color: var(--fg-muted); font-weight: 600;
    padding-left: 8px; margin-left: 2px; border-left: 1px solid var(--border-subtle);
  }

  /* ---- reaction bar (viewer) ---- */
  .fc-reactbar {
    position: absolute; left: 50%; bottom: 22px; transform: translateX(-50%);
    display: inline-flex; gap: var(--space-2);
    padding: 8px; pointer-events: auto;
    background: var(--bg-surface);
    border-radius: var(--radius-pill);
    box-shadow: var(--elevation-4);
  }
  .fc-reactbar button {
    width: 40px; height: 40px; padding: 8px;
    display: inline-flex; align-items: center; justify-content: center;
    border: none; border-radius: var(--radius-pill);
    background: transparent; color: var(--fmnts-primary);
    transition: transform var(--duration-fast) var(--ease-out-expo),
                background var(--duration-fast) var(--ease-out-expo);
  }
  .fc-reactbar button svg { width: 22px; height: 22px; display: block; }
  .fc-reactbar button:hover { background: var(--blue-50); transform: translateY(-2px); }
  .fc-reactbar button:active { transform: translateY(0) scale(.92); }
  .fc-reactbar button:focus-visible {
    outline: none; box-shadow: 0 0 0 3px var(--border-focus);
  }

  /* ---- flying reactions ---- */
  .fc-fly {
    position: absolute; bottom: 74px;
    width: 30px; height: 30px; color: var(--fmnts-primary);
    will-change: transform, opacity; pointer-events: none;
    animation: fc-float 2200ms var(--ease-out-expo) forwards;
  }
  .fc-fly svg { width: 100%; height: 100%; display: block;
    filter: drop-shadow(0 4px 10px rgba(0,116,200,.28)); }
  @keyframes fc-float {
    0%   { opacity: 0; transform: translateY(0) scale(.5); }
    12%  { opacity: 1; transform: translateY(-12px) scale(1); }
    100% { opacity: 0; transform: translateY(-260px) scale(1.05); }
  }

  /* ---- ghost pointer (viewer sees presenter's laser dot) ---- */
  .fc-pointer {
    position: absolute; top: 0; left: 0; width: 18px; height: 18px;
    margin-left: -9px; margin-top: -9px; border-radius: 50%;
    background: var(--fmnts-secondary);
    box-shadow: 0 0 0 4px rgba(224,59,80,.22), 0 2px 8px rgba(0,0,0,.25);
    opacity: 0; pointer-events: none;
    transition: opacity var(--duration-fast) linear;
    will-change: transform, opacity;
  }
  .fc-pointer.is-on { opacity: .92; }

  /* ---- poll card ---- */
  .fc-poll {
    position: absolute; right: 20px; bottom: 20px; width: 340px; max-width: calc(100vw - 40px);
    background: var(--bg-surface); color: var(--fg-default);
    border-radius: var(--radius-lg); box-shadow: var(--elevation-4);
    padding: var(--space-5); pointer-events: auto;
    transform: translateY(8px); opacity: 0;
    transition: opacity var(--duration-normal) var(--ease-out-expo),
                transform var(--duration-normal) var(--ease-out-expo);
  }
  .fc-poll.is-open { opacity: 1; transform: translateY(0); }
  .fc-poll[hidden] { display: none; }
  .fc-poll__eyebrow {
    text-transform: uppercase; letter-spacing: .24em; font-weight: 600;
    font-size: var(--overline); color: var(--fmnts-primary);
    display: flex; justify-content: space-between; align-items: center;
    margin-bottom: var(--space-2);
  }
  .fc-poll__eyebrow .fc-live { color: var(--fg-muted); }
  .fc-poll__eyebrow .fc-live.is-live { color: var(--fmnts-secondary); }
  .fc-poll__q {
    font-size: var(--h5); line-height: var(--h5-lh); font-weight: 600;
    margin: 0 0 var(--space-4);
  }
  .fc-opt {
    position: relative; display: block; width: 100%; text-align: left;
    border: 1px solid var(--border-subtle); border-radius: var(--radius-md);
    background: var(--bg-surface); color: var(--fg-default);
    padding: 10px 12px; margin-bottom: var(--space-2); overflow: hidden;
    font-size: var(--body-md);
    transition: border-color var(--duration-fast) var(--ease-out-expo),
                background var(--duration-fast) var(--ease-out-expo);
  }
  .fc-opt:last-child { margin-bottom: 0; }
  .fc-opt .fc-fill {
    position: absolute; inset: 0; transform-origin: left center;
    transform: scaleX(0); background: var(--blue-100); z-index: 0;
    transition: transform var(--duration-slow) var(--ease-out-expo);
  }
  .fc-opt .fc-optrow {
    position: relative; z-index: 1; display: flex; justify-content: space-between; gap: 12px;
  }
  .fc-opt .fc-pct { font-family: var(--font-display); font-feature-settings: "tnum" 1; color: var(--fmnts-primary); }
  .fc-opt:not([disabled]):hover { border-color: var(--fmnts-primary); background: var(--blue-50); }
  .fc-opt:focus-visible { outline: none; border-color: var(--fmnts-primary); box-shadow: 0 0 0 3px var(--border-focus); }
  .fc-opt.is-mine { border-color: var(--fmnts-primary); }
  .fc-opt.is-mine .fc-check { color: var(--fmnts-primary); font-weight: 700; }
  .fc-poll__foot {
    display: flex; justify-content: space-between; align-items: center;
    margin-top: var(--space-4); font-size: var(--body-sm); color: var(--fg-muted);
  }
  .fc-poll__foot button {
    border: 1px solid var(--border-default); background: var(--bg-surface);
    color: var(--fg-default); border-radius: var(--radius-pill);
    padding: 5px 12px; font-size: var(--body-sm); font-weight: 600;
  }
  .fc-poll__foot button:hover { border-color: var(--fmnts-primary); color: var(--fmnts-primary); }

  /* ---- viewer question composer ---- */
  .fc-ask {
    position: absolute; left: 50%; bottom: 74px; transform: translateX(-50%);
    width: 420px; max-width: calc(100vw - 40px);
    background: var(--bg-surface); border-radius: var(--radius-lg);
    box-shadow: var(--elevation-4); padding: var(--space-4);
    pointer-events: auto; display: none;
  }
  .fc-ask.is-open { display: block; }
  .fc-ask textarea {
    width: 100%; resize: none; border: 1px solid var(--border-default);
    border-radius: var(--radius-md); padding: 10px 12px;
    font-family: inherit; font-size: var(--body-md); color: var(--fg-default);
    background: var(--bg-surface);
  }
  .fc-ask textarea:focus-visible { outline: none; border-color: var(--fmnts-primary); box-shadow: 0 0 0 3px var(--border-focus); }
  .fc-ask__row { display: flex; justify-content: space-between; align-items: center; margin-top: var(--space-2); }
  .fc-ask__row .fc-counter { font-size: var(--body-xs); color: var(--fg-subtle); }
  .fc-ask__send {
    border: none; border-radius: var(--radius-pill); padding: 7px 16px;
    background: var(--fmnts-primary); color: var(--fg-on-primary);
    font-weight: 600; font-size: var(--body-sm);
  }
  .fc-ask__send:hover { background: var(--fmnts-primary-mid); }
  .fc-ask__send:disabled { background: var(--neutral-300); color: var(--fg-inverse); cursor: not-allowed; }

  /* ---- viewer action buttons (hand + ask) ---- */
  .fc-actions {
    position: absolute; right: 20px; bottom: 22px;
    display: inline-flex; gap: var(--space-2); pointer-events: auto;
  }
  .fc-actions button {
    height: 40px; padding: 0 14px 0 12px;
    display: inline-flex; align-items: center; gap: 7px;
    border: 1px solid var(--border-default); border-radius: var(--radius-pill);
    background: var(--bg-surface); color: var(--fg-default);
    font-size: var(--body-sm); font-weight: 600;
    transition: transform var(--duration-fast) var(--ease-out-expo),
                background var(--duration-fast) var(--ease-out-expo),
                border-color var(--duration-fast) var(--ease-out-expo);
  }
  .fc-actions button svg { width: 18px; height: 18px; }
  .fc-actions button:hover { border-color: var(--fmnts-primary); transform: translateY(-2px); }
  .fc-actions button:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--border-focus); }
  .fc-actions button.is-on {
    background: var(--fmnts-primary); border-color: var(--fmnts-primary); color: var(--fg-on-primary);
  }

  /* ---- presenter HUD (reactions tally + hands + Q&A) ---- */
  .fc-hud {
    position: absolute; right: 20px; top: 18px; width: 300px; max-width: calc(100vw - 40px);
    background: var(--bg-surface); color: var(--fg-default);
    border-radius: var(--radius-lg); box-shadow: var(--elevation-4);
    padding: var(--space-4); pointer-events: auto;
    display: flex; flex-direction: column; gap: var(--space-3);
  }
  .fc-hud__head {
    display: flex; justify-content: space-between; align-items: center;
    font-size: var(--overline); text-transform: uppercase; letter-spacing: .2em;
    color: var(--fg-muted); font-weight: 600;
  }
  .fc-hud__head button {
    border: none; background: transparent; color: var(--fg-subtle);
    font-size: var(--body-md); line-height: 1; padding: 2px 4px;
  }
  .fc-hud__head button:hover { color: var(--fmnts-primary); }
  .fc-hud__stats { display: flex; gap: var(--space-4); }
  .fc-stat { display: flex; flex-direction: column; gap: 2px; }
  .fc-stat b { font-family: var(--font-display); font-feature-settings: "tnum" 1; font-size: var(--h3); color: var(--fmnts-primary); line-height: 1; }
  .fc-stat span { font-size: var(--body-xs); color: var(--fg-muted); }
  .fc-hud__qa {
    border-top: 1px solid var(--border-subtle); padding-top: var(--space-3);
    max-height: 210px; overflow-y: auto; display: flex; flex-direction: column; gap: var(--space-2);
  }
  .fc-qa-item {
    font-size: var(--body-sm); line-height: var(--body-sm-lh);
    background: var(--blue-50); border-radius: var(--radius-sm);
    padding: 8px 10px; color: var(--fg-default);
  }
  .fc-qa-empty { font-size: var(--body-sm); color: var(--fg-subtle); font-style: italic; }
  .fc-hud__poll {
    border-top: 1px solid var(--border-subtle); padding-top: var(--space-3);
    display: flex; gap: var(--space-2);
  }
  .fc-hud__poll button {
    flex: 1; border: 1px solid var(--border-default); border-radius: var(--radius-pill);
    background: var(--bg-surface); color: var(--fg-default);
    padding: 7px 10px; font-size: var(--body-sm); font-weight: 600;
  }
  .fc-hud__poll button:hover { border-color: var(--fmnts-primary); color: var(--fmnts-primary); }

  /* ---- connection status chip ---- */
  .fc-status {
    position: absolute; left: 20px; bottom: 22px;
    font-size: var(--body-xs); color: var(--fg-subtle);
    background: var(--bg-surface); border-radius: var(--radius-pill);
    padding: 5px 10px; box-shadow: var(--elevation-2); pointer-events: none;
    opacity: 0; transition: opacity var(--duration-normal) var(--ease-out-expo);
  }
  .fc-status.is-shown { opacity: 1; }

  /* never render collab chrome in print/peek exports */
  body.print-pdf .fc-root, body.is-peek .fc-root { display: none !important; }

  @media (prefers-reduced-motion: reduce) {
    .fc-fly { animation-duration: 1400ms; }
    .fc-reactbar button:hover, .fc-actions button:hover { transform: none; }
  }
  `;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = css;
  document.head.appendChild(style);
}

/* ------------------------------------------------------------------
   Tiny DOM helper.
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
   Pointer normalization — decompose the SAME transform the pointer
   plugin reads (document.body.style.transform), but INVERT it to
   emit author-normalized (0..1) coords. This is the one place we
   read body transform; it's fine because it's the presenter's own
   screen and matches plugin/pointer/plugin.js exactly. A viewer on
   a phone and a presenter on 4K then land on the same word.
------------------------------------------------------------------ */
function readDeckTransform() {
  const t = document.body.style.transform || "";
  if (!t) return { tx: 0, ty: 0, scale: 1 };
  const tr = /translate\((.*)px,\s*(.*)px\)/.exec(t);
  const sc = /scale\(([0-9.]+)\)/.exec(t); // tolerate multi-digit scale
  return {
    tx: tr ? parseFloat(tr[1]) : 0,
    ty: tr ? parseFloat(tr[2]) : 0,
    scale: sc ? parseFloat(sc[1]) : 1,
  };
}

/* ==================================================================
   PUBLIC API
   ------------------------------------------------------------------
   initCollab(Reveal, opts?)
     opts.host   optional PARTY host (else discovered from URL/meta)
     opts.name   optional display name
   Returns { enabled: boolean } and is safe to call unconditionally.
================================================================== */
export function initCollab(Reveal, opts = {}) {
  const q = new URLSearchParams(location.search);
  const room = (q.get("room") || "").trim();
  const host = normalizeHost(resolveHost(opts));

  // --- graceful no-op: static deck must keep working untouched ---
  if (!room || !host) return { enabled: false };
  if (!Reveal || typeof Reveal.on !== "function") return { enabled: false };

  const role = q.get("role") === "presenter" ? "presenter" : "viewer";
  const token = q.get("t") || "";
  const name = (opts.name || q.get("name") || "").trim();

  injectStyles();

  /* one root overlay for all collab chrome */
  const root = el("div", { class: "fc-root", "aria-live": "polite" });
  document.body.appendChild(root);

  const ui = role === "presenter" ? buildPresenterUI(root) : buildViewerUI(root);

  // Load partysocket lazily; if it fails, tear the overlay down and no-op.
  connect({ Reveal, role, room, host, token, name, root, ui }).catch((err) => {
    console.warn("[collab] disabled — partysocket unavailable", err);
    root.remove();
  });

  return { enabled: true };
}

/* ------------------------------------------------------------------
   PartyKit transport loader — ALTERNATE, not wired up in Wave 0.
   Resolves the PartySocket class from a LOCALLY vendored module only
   (vendor/partysocket.mjs, added in Wave 6). No CDN, no static import
   specifier — so bundlers/CSP never see a remote host. Returns null
   when the vendor file is absent; the caller warns and falls back to
   the local BroadcastChannel transport.
------------------------------------------------------------------ */
async function loadPartySocket() {
  try {
    // Built at runtime so there is no literal CDN/remote string in source.
    const spec = new URL("../vendor/partysocket.mjs", import.meta.url).href;
    const mod = await import(spec);
    return mod.PartySocket || mod.default || null;
  } catch {
    return null; // vendor module not present yet — caller falls back
  }
}

/* ------------------------------------------------------------------
   Networking + wiring (async so we can load the vendored partysocket).
------------------------------------------------------------------ */
async function connect(cx) {
  const { Reveal, role, room, host, token, name, root, ui } = cx;

  // partysocket is NOT vendored in Wave 0 — the PartyKit transport is an
  // alternate that Wave 6 wires up (vendor/partysocket.mjs). We must never
  // reach a CDN here (CSP-safe, buildless), so this path degrades cleanly.
  const PartySocket = await loadPartySocket();
  if (!PartySocket) {
    console.warn(
      "[collab] PartyKit transport needs vendor/partysocket.mjs (see PLATFORM-V2-CONCEPT.md Wave 6); falling back to local."
    );
    throw new Error("PartySocket transport unavailable");
  }

  const query = { t: token };
  if (name) query.name = name;

  const socket = new PartySocket({
    host,
    party: "main", // deck.ts is the `main` party (partykit.json → "main" field)
    room,
    query,
  });

  const state = {
    self: role, // provisional; server confirms in `state`
    poll: null, // last poll payload
    votedOption: null,
    flying: 0,
  };

  const send = (obj) => {
    try {
      if (socket.readyState === 1) socket.send(JSON.stringify(obj));
    } catch {
      /* dropped frame — reconnect will resync */
    }
  };

  /* ---- status chip helpers ---- */
  let statusTimer = 0;
  function flashStatus(text) {
    if (!ui.status) return;
    ui.status.textContent = text;
    ui.status.classList.add("is-shown");
    clearTimeout(statusTimer);
    statusTimer = setTimeout(() => ui.status.classList.remove("is-shown"), 2600);
  }

  /* ---- socket lifecycle ---- */
  socket.addEventListener("open", () => {
    flashStatus(role === "presenter" ? "Live — you are presenting" : "Connected — following presenter");
  });
  socket.addEventListener("close", () => flashStatus("Reconnecting…"));
  socket.addEventListener("error", () => flashStatus("Connection issue — retrying"));

  socket.addEventListener("message", (evt) => {
    let msg;
    try {
      msg = JSON.parse(evt.data);
    } catch {
      return;
    }
    if (!msg || typeof msg.type !== "string") return;
    routeMessage(msg);
  });

  /* ================= inbound routing ================= */
  function routeMessage(msg) {
    switch (msg.type) {
      case "state": {
        state.self = msg.role || role;
        if (ui.setRole) ui.setRole(state.self);
        if (msg.presence) updatePresence(msg.presence.count, msg.presence.hands);
        if (msg.poll) applyPoll(msg.poll);
        // viewer: jump to the presenter's current slide on join
        if (state.self === "viewer" && msg.slide) followSlide(msg.slide);
        // presenter: hydrate any standing questions
        if (state.self === "presenter" && Array.isArray(msg.questions)) {
          msg.questions.forEach((qq) => ui.addQuestion(qq));
        }
        break;
      }
      case "slide":
        if (state.self === "viewer") followSlide(msg);
        break;
      case "pointer":
        if (state.self === "viewer") movePointer(msg);
        break;
      case "reaction":
        flyReaction(msg.kind);
        if (state.self === "presenter" && ui.incReaction) ui.incReaction();
        break;
      case "presence":
        updatePresence(msg.count, msg.hands);
        break;
      case "poll":
        applyPoll(msg);
        break;
      case "question":
        if (state.self === "presenter") ui.addQuestion(msg);
        break;
      default:
        break;
    }
  }

  /* ---- presence ---- */
  function updatePresence(count, hands) {
    if (ui.presence) ui.presence(count, hands);
  }

  /* ---- viewer: follow presenter's slide (guarded, no echo) ---- */
  let suppressBroadcast = false;
  function followSlide(slide) {
    const cur = Reveal.getIndices();
    if (cur.h === slide.h && cur.v === slide.v) return; // already there
    suppressBroadcast = true;
    Reveal.slide(slide.h, slide.v);
    // clear the guard after reveal settles this transition
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        suppressBroadcast = false;
      });
    });
  }

  /* ---- viewer: ghost pointer ---- */
  function movePointer(p) {
    if (!ui.pointer) return;
    const rect = getSlideRect();
    const sx = rect.left + p.x * rect.width;
    const sy = rect.top + p.y * rect.height;
    ui.pointer.style.transform = `translate(${sx}px, ${sy}px)`;
    ui.pointer.classList.toggle("is-on", p.visible === true);
  }

  /* ---- reactions: fly one glyph (capped) ---- */
  function flyReaction(kind) {
    const glyph = GLYPHS[kind];
    if (!glyph) return;
    if (state.flying >= MAX_FLYING) return;
    state.flying += 1;
    const node = el("div", { class: "fc-fly" }, glyph);
    const spread = 120; // px of horizontal jitter around center
    const dx = Math.random() * spread - spread / 2;
    node.style.left = `calc(50% + ${dx}px)`;
    root.appendChild(node);
    node.addEventListener(
      "animationend",
      () => {
        node.remove();
        state.flying -= 1;
      },
      { once: true }
    );
  }

  /* ---- poll rendering (both roles) ---- */
  function applyPoll(poll) {
    state.poll = poll;
    if (ui.renderPoll) ui.renderPoll(poll, state.votedOption, castVote);
  }
  function castVote(idx) {
    if (!state.poll || !state.poll.open) return;
    if (state.votedOption != null) return; // one vote per poll, client-side guard
    state.votedOption = idx;
    send({ type: "poll-vote", id: state.poll.id, option: idx });
    if (ui.renderPoll) ui.renderPoll(state.poll, state.votedOption, castVote); // optimistic lock
  }

  /* ================= presenter outbound ================= */
  if (role === "presenter") {
    // Broadcast slide index on every change (and once on ready).
    const broadcastSlide = () => {
      if (suppressBroadcast) return;
      const idx = Reveal.getIndices();
      const cur = Reveal.getCurrentSlide();
      send({ type: "set-slide", h: idx.h, v: idx.v, id: cur ? cur.id || "" : "" });
    };
    if (Reveal.isReady && Reveal.isReady()) broadcastSlide();
    Reveal.on("ready", broadcastSlide);
    Reveal.on("slidechanged", broadcastSlide);

    // Mirror reveal's `q` pointer to viewers (normalized 0..1), throttled.
    let lastPointer = 0;
    const onMove = (e) => {
      const now = performance.now();
      if (now - lastPointer < POINTER_MIN_MS) return;
      lastPointer = now;
      const { tx, ty, scale } = readDeckTransform();
      const ax = (e.pageX - tx) / scale / AUTHOR_W;
      const ay = (e.pageY - ty) / scale / AUTHOR_H;
      if (ax < -0.05 || ax > 1.05 || ay < -0.05 || ay > 1.05) return;
      send({ type: "pointer", x: ax, y: ay, visible: true });
    };
    // reveal toggles body.no-cursor when the `q` pointer is active;
    // observe that class to start/stop mirroring in lockstep.
    const syncPointerMirror = () => {
      const on = document.body.classList.contains("no-cursor");
      if (on) document.addEventListener("mousemove", onMove);
      else {
        document.removeEventListener("mousemove", onMove);
        send({ type: "pointer", x: 0, y: 0, visible: false });
      }
    };
    const mo = new MutationObserver(syncPointerMirror);
    mo.observe(document.body, { attributes: true, attributeFilter: ["class"] });

    // wire HUD poll controls
    ui.onOpenPoll(() => {
      const built = promptPoll();
      if (built) send({ type: "poll-open", ...built });
    });
    ui.onClosePoll(() => {
      if (state.poll) send({ type: "poll-close", id: state.poll.id });
    });
  }

  /* ================= viewer outbound ================= */
  if (role === "viewer") {
    // reactions
    ui.onReact((kind) => {
      send({ type: "reaction", kind });
      flyReaction(kind); // local echo for snappiness (server also fans out)
    });
    // raise hand
    ui.onHand((on) => send({ type: "hand", on }));
    // ask question
    ui.onAsk((text) => send({ type: "question", text }));
  }

  /* geometry helper for the ghost pointer */
  function getSlideRect() {
    const slidesEl =
      (Reveal.getSlidesElement && Reveal.getSlidesElement()) ||
      document.querySelector(".reveal .slides");
    if (slidesEl) {
      const r = slidesEl.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) return r;
    }
    return { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
  }

  return socket;
}

/* ==================================================================
   VIEWER UI
================================================================== */
function buildViewerUI(root) {
  // presence badge
  const presenceEl = el("div", { class: "fc-presence is-off" });
  const dot = el("span", { class: "fc-dot" });
  const count = el("span", { class: "fc-count" }, "0");
  const label = el("span", {}, " watching");
  const handsWrap = el("span", { class: "fc-hands", hidden: true }, `${HAND_SVG}<span class="fc-hval">0</span>`);
  presenceEl.append(dot, count, label, handsWrap);
  root.appendChild(presenceEl);

  // reaction bar
  const reactbar = el("div", { class: "fc-reactbar", role: "group", "aria-label": "Send a reaction" });
  const reactHandlers = { fn: null };
  REACTIONS.forEach((kind) => {
    const b = el("button", { type: "button", title: REACTION_TITLE[kind], "aria-label": REACTION_TITLE[kind] }, GLYPHS[kind]);
    b.addEventListener("click", () => reactHandlers.fn && reactHandlers.fn(kind));
    reactbar.appendChild(b);
  });
  root.appendChild(reactbar);

  // ghost pointer
  const pointer = el("div", { class: "fc-pointer" });
  root.appendChild(pointer);

  // actions: raise hand + ask
  const actions = el("div", { class: "fc-actions" });
  const handBtn = el("button", { type: "button", "aria-pressed": "false" }, `${HAND_SVG}<span>Raise hand</span>`);
  const askBtn = el("button", { type: "button" }, `<span>Ask</span>`);
  actions.append(handBtn, askBtn);
  root.appendChild(actions);

  // ask composer
  const ask = el("div", { class: "fc-ask" });
  const ta = el("textarea", { rows: "2", maxlength: "240", placeholder: "Ask the presenter a question…" });
  const row = el("div", { class: "fc-ask__row" });
  const counter = el("span", { class: "fc-counter" }, "0 / 240");
  const sendBtn = el("button", { class: "fc-ask__send", type: "button", disabled: true }, "Send");
  row.append(counter, sendBtn);
  ask.append(ta, row);
  root.appendChild(ask);

  // poll card
  const poll = el("div", { class: "fc-poll", hidden: true, role: "group", "aria-label": "Live poll" });
  root.appendChild(poll);

  // status chip
  const status = el("div", { class: "fc-status" });
  root.appendChild(status);

  /* ---- behaviour wiring ---- */
  const handlers = { hand: null, ask: null };
  let handOn = false;
  handBtn.addEventListener("click", () => {
    handOn = !handOn;
    handBtn.classList.toggle("is-on", handOn);
    handBtn.setAttribute("aria-pressed", String(handOn));
    handBtn.querySelector("span").textContent = handOn ? "Hand raised" : "Raise hand";
    handlers.hand && handlers.hand(handOn);
  });
  askBtn.addEventListener("click", () => {
    ask.classList.toggle("is-open");
    if (ask.classList.contains("is-open")) ta.focus();
  });
  ta.addEventListener("input", () => {
    const n = ta.value.trim().length;
    counter.textContent = `${ta.value.length} / 240`;
    sendBtn.disabled = n === 0;
  });
  ta.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submitAsk();
    if (e.key === "Escape") ask.classList.remove("is-open");
  });
  sendBtn.addEventListener("click", submitAsk);
  function submitAsk() {
    const text = ta.value.trim();
    if (!text) return;
    handlers.ask && handlers.ask(text);
    ta.value = "";
    counter.textContent = "0 / 240";
    sendBtn.disabled = true;
    ask.classList.remove("is-open");
  }

  return {
    pointer,
    status,
    presence(cnt, hands) {
      count.textContent = String(cnt);
      presenceEl.classList.toggle("is-off", cnt <= 0);
      if (hands > 0) {
        handsWrap.hidden = false;
        handsWrap.querySelector(".fc-hval").textContent = String(hands);
      } else {
        handsWrap.hidden = true;
      }
    },
    onReact(fn) {
      reactHandlers.fn = fn;
    },
    onHand(fn) {
      handlers.hand = fn;
    },
    onAsk(fn) {
      handlers.ask = fn;
    },
    renderPoll(pollData, votedOption, castVote) {
      renderPollCard(poll, pollData, { votedOption, castVote, interactive: true });
    },
    setRole() {},
    addQuestion() {},
  };
}

/* ==================================================================
   PRESENTER UI
================================================================== */
function buildPresenterUI(root) {
  // presence badge (with a role tag)
  const presenceEl = el("div", { class: "fc-presence is-off" });
  const dot = el("span", { class: "fc-dot" });
  const count = el("span", { class: "fc-count" }, "0");
  const label = el("span", {}, " watching");
  const roleTag = el("span", { class: "fc-role-tag" }, "Presenter");
  presenceEl.append(dot, count, label, roleTag);
  root.appendChild(presenceEl);

  // HUD
  const hud = el("div", { class: "fc-hud", role: "region", "aria-label": "Audience" });
  const head = el("div", { class: "fc-hud__head" }, `<span>Audience — live</span>`);
  const collapseBtn = el("button", { type: "button", title: "Hide", "aria-label": "Hide audience panel" }, "▾");
  head.appendChild(collapseBtn);

  const stats = el("div", { class: "fc-hud__stats" });
  const stViewers = statBlock("0", "watching");
  const stHands = statBlock("0", "hands up");
  const stReacts = statBlock("0", "reactions");
  stats.append(stViewers.wrap, stHands.wrap, stReacts.wrap);

  const pollRow = el("div", { class: "fc-hud__poll" });
  const openPollBtn = el("button", { type: "button" }, "Open poll");
  const closePollBtn = el("button", { type: "button" }, "Close poll");
  pollRow.append(openPollBtn, closePollBtn);

  const qaHead = el("div", { class: "fc-hud__head" }, `<span>Questions</span>`);
  const qa = el("div", { class: "fc-hud__qa" });
  const qaEmpty = el("div", { class: "fc-qa-empty" }, "No questions yet.");
  qa.appendChild(qaEmpty);

  hud.append(head, stats, pollRow, qaHead, qa);
  root.appendChild(hud);

  // live poll tally card (read-only for presenter)
  const poll = el("div", { class: "fc-poll", hidden: true, role: "region", "aria-label": "Poll results" });
  root.appendChild(poll);

  // status chip
  const status = el("div", { class: "fc-status" });
  root.appendChild(status);

  // collapse toggle
  let collapsed = false;
  collapseBtn.addEventListener("click", () => {
    collapsed = !collapsed;
    stats.style.display = collapsed ? "none" : "";
    pollRow.style.display = collapsed ? "none" : "";
    qaHead.style.display = collapsed ? "none" : "";
    qa.style.display = collapsed ? "none" : "";
    collapseBtn.textContent = collapsed ? "▸" : "▾";
  });

  let reactionCount = 0;
  const pollHandlers = { open: null, close: null };
  openPollBtn.addEventListener("click", () => pollHandlers.open && pollHandlers.open());
  closePollBtn.addEventListener("click", () => pollHandlers.close && pollHandlers.close());

  return {
    status,
    // presenter has no ghost pointer of its own
    pointer: null,
    presence(cnt, hands) {
      count.textContent = String(cnt);
      presenceEl.classList.toggle("is-off", cnt <= 0);
      stViewers.set(String(cnt));
      stHands.set(String(hands));
    },
    renderPoll(pollData) {
      renderPollCard(poll, pollData, { interactive: false });
    },
    addQuestion(qq) {
      if (qaEmpty.parentNode) qaEmpty.remove();
      const item = el("div", { class: "fc-qa-item" });
      item.textContent = qq.text;
      qa.appendChild(item);
      qa.scrollTop = qa.scrollHeight;
    },
    onOpenPoll(fn) {
      pollHandlers.open = fn;
    },
    onClosePoll(fn) {
      pollHandlers.close = fn;
    },
    setRole() {},
    // expose a reaction incrementer via a property the router calls
    incReaction() {
      reactionCount += 1;
      stReacts.set(String(reactionCount));
    },
  };
}

function statBlock(value, labelText) {
  const wrap = el("div", { class: "fc-stat" });
  const b = el("b", {}, value);
  const span = el("span", {}, labelText);
  wrap.append(b, span);
  return { wrap, set: (v) => (b.textContent = v) };
}

/* ------------------------------------------------------------------
   Shared poll card renderer (viewer = interactive, presenter = tally)
------------------------------------------------------------------ */
function renderPollCard(container, poll, { votedOption = null, castVote = null, interactive = true } = {}) {
  if (!poll) {
    container.hidden = true;
    container.classList.remove("is-open");
    return;
  }
  const total = poll.votes.reduce((a, b) => a + b, 0);
  container.innerHTML = "";
  container.hidden = false;

  const eyebrow = el("div", { class: "fc-poll__eyebrow" });
  eyebrow.append(
    el("span", {}, interactive ? "Live poll" : "Poll — results"),
    el("span", { class: `fc-live ${poll.open ? "is-live" : ""}` }, poll.open ? "OPEN" : "CLOSED")
  );
  const question = el("div", { class: "fc-poll__q" });
  question.textContent = poll.q;
  container.append(eyebrow, question);

  poll.options.forEach((opt, i) => {
    const votes = poll.votes[i] || 0;
    const pct = total > 0 ? Math.round((votes / total) * 100) : 0;
    const showResults = !interactive || votedOption != null || !poll.open;

    const btn = el(interactive ? "button" : "div", {
      class: `fc-opt ${votedOption === i ? "is-mine" : ""}`,
      type: interactive ? "button" : false,
    });
    const fill = el("span", { class: "fc-fill" });
    if (showResults) fill.style.transform = `scaleX(${pct / 100})`;
    const rowInner = el("span", { class: "fc-optrow" });
    const labelSpan = el("span", {}, "");
    labelSpan.textContent = (votedOption === i ? "✓ " : "") + opt;
    labelSpan.className = votedOption === i ? "fc-check" : "";
    const pctSpan = el("span", { class: "fc-pct" }, showResults ? `${pct}%` : "");
    rowInner.append(labelSpan, pctSpan);
    btn.append(fill, rowInner);

    if (interactive) {
      const locked = votedOption != null || !poll.open;
      if (locked) btn.setAttribute("disabled", "");
      btn.addEventListener("click", () => {
        if (votedOption != null || !poll.open) return;
        castVote && castVote(i);
      });
    }
    container.appendChild(btn);
  });

  const foot = el("div", { class: "fc-poll__foot" });
  foot.append(
    el("span", {}, `${total} vote${total === 1 ? "" : "s"}`),
    el("span", {}, poll.open ? (interactive ? (votedOption != null ? "Thanks!" : "Tap to vote") : "Voting open") : "Final")
  );
  container.appendChild(foot);

  requestAnimationFrame(() => container.classList.add("is-open"));
}

/* ------------------------------------------------------------------
   Minimal presenter poll builder (uses window.prompt — zero deps,
   works from any window; a richer composer can replace this later).
------------------------------------------------------------------ */
function promptPoll() {
  const q = window.prompt("Poll question:", "How's the pace so far?");
  if (!q || !q.trim()) return null;
  const raw = window.prompt("Options (comma-separated, 2–6):", "Too slow, Just right, Too fast");
  if (!raw) return null;
  const options = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 6);
  if (options.length < 2) return null;
  return { id: `poll-${Date.now()}`, q: q.trim(), options };
}
