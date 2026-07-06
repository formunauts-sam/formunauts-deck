/* ============================================================
   nav.js — shared front-of-house navigation affordances.
   CHROME. Imported by index.html (deck) and hub.html (library).
   ------------------------------------------------------------
   The user's #1 UX complaint was "I don't even know how to come
   into the library". This module renders the two ends of that
   round-trip in one visual language (styled by template/nav.css):

     initDeckNav()      — a small "Library" pill on the deck launch
                          state, top-left, linking to ./hub.html.
                          Hidden under fullscreen / peek / print via
                          nav.css so it never reaches the audience.

     initHubBrandbar()  — a persistent wordmark bar on the hub that
                          anchors it as the company tool's home
                          ("you are here: Library").

   Zero-dep. Every URL is RELATIVE (resolved against the page),
   so both work on GitHub Pages under a subpath. No emoji, no
   em-dash. Each initializer is idempotent and guards its own DOM
   so a double-call (or a missing <body>) can never throw.
   ============================================================ */

/* The orbital-ring + rocket motif, inline so the affordance needs
   no image request and inherits currentColor from its chip. */
const RING_GLYPH =
  '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">' +
  '<circle cx="12" cy="12" r="8.5" stroke="currentColor" stroke-width="1.6"/>' +
  '<circle cx="12" cy="12" r="2.4" fill="currentColor"/>' +
  '<circle cx="20" cy="6.5" r="1.6" fill="currentColor"/>' +
  "</svg>";

/* --------------------------------------------------------------
   DECK — "Library" pill (the discoverable way back to the hub).
   Injected as a sibling AFTER .reveal so it is never clipped by
   reveal's scaled slide stage. Safe to call once per deck boot.
-------------------------------------------------------------- */
export function initDeckNav(opts = {}) {
  if (typeof document === "undefined" || !document.body) return null;
  if (document.querySelector(".deck-nav")) return document.querySelector(".deck-nav");

  const href = opts.href || "hub.html";   // relative → subpath-safe
  const label = opts.label || "Library";

  const link = document.createElement("a");
  link.className = "deck-nav";
  link.href = href;
  link.setAttribute("aria-label", "Back to the deck library");
  link.innerHTML =
    `<span class="deck-nav__glyph">${RING_GLYPH}</span>` +
    `<span class="deck-nav__label">${escapeText(label)}</span>`;
  document.body.appendChild(link);

  /* Belt-and-braces fullscreen hide: :fullscreen in nav.css already
     covers the standard case (Present ▸ fullscreens <html>), but some
     engines/paths leave it unreliable, so mirror the state on <body>
     too. Compositor-free, listener removed with the page. */
  const syncFullscreen = () => {
    const fs = !!(document.fullscreenElement || document.webkitFullscreenElement);
    document.body.classList.toggle("is-fullscreen", fs);
  };
  document.addEventListener("fullscreenchange", syncFullscreen);
  document.addEventListener("webkitfullscreenchange", syncFullscreen);
  syncFullscreen();

  return link;
}

/* --------------------------------------------------------------
   HUB — persistent wordmark bar. Prepended to <body> above the
   existing masthead so the hub always names itself as the home
   of the company tool, with a quiet "you are here" breadcrumb.
-------------------------------------------------------------- */
export function initHubBrandbar(opts = {}) {
  if (typeof document === "undefined" || !document.body) return null;
  if (document.querySelector(".hub-brandbar")) return document.querySelector(".hub-brandbar");

  const href = opts.href || "hub.html";        // home = the hub itself
  const wordmark = opts.wordmark || "FORMUNAUTS Present";
  const here = opts.here || "Library";

  const bar = document.createElement("nav");
  bar.className = "hub-brandbar";
  bar.setAttribute("aria-label", "Platform");
  bar.innerHTML =
    `<a class="hub-brandbar__home" href="${escapeAttr(href)}" aria-current="page">` +
    `<span class="hub-brandbar__glyph">${RING_GLYPH}</span>` +
    `<span class="hub-brandbar__wordmark">${escapeText(wordmark)}</span>` +
    `</a>` +
    `<span class="hub-brandbar__sep" aria-hidden="true">&middot;</span>` +
    `<span class="hub-brandbar__here">${escapeText(here)}</span>`;
  document.body.insertBefore(bar, document.body.firstChild);

  return bar;
}

/* --- Minimal escaping (label/wordmark are static today, but guard
   the boundary anyway so a future dynamic value can never inject) --- */
function escapeText(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function escapeAttr(s) {
  return escapeText(s).replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
