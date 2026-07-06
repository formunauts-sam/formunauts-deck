/* ============================================================
   hub.js — the Deck Hub (platform front door).
   CHROME. Imported by hub.html. Twin of template/presenter/.
   ------------------------------------------------------------
   Reads decks/manifest.js (the ONE list a non-dev edits),
   dynamically imports each decks/<id>.deck.js and renders a
   real LIBRARY (concept §2.4):
     · "Up next" hero band — the active deck (live > newest),
       big Open + share + a deck-driven calendar handoff
     · a "Plan the next demo" ghost card (the 4-step recipe)
     · grouped sections (Up next / Recent / Archive) derived
       from meta.status + meta.date; decks without status
       degrade into a sensible bucket so the hub is never blank
     · a library card per deck: an IntersectionObserver
       lazy-booted ?present=peek thumbnail (read-only — a peek
       never publishes Engage/presenter state), Open / Share
       (copy link + a small QR) / Add to calendar, and an
       expandable slide strip (iframes only on first expand).
   A deck that fails to import is skipped with console.warn;
   the hub never renders broken. Every deck URL is RELATIVE so
   the page works on GitHub Pages under a subpath.
   NOTE: manifest.js is the one file a non-dev edits, so it is
   imported DYNAMICALLY inside loadEntries() — a typo there must
   show a fix-it message, not blank the whole hub module.
   QR: vendor/qr.mjs is imported OPTIONALLY (a parallel wave
   ships it). If it is missing or its API differs, share
   degrades to copy-link only — the import never breaks the hub.
   ============================================================ */
import { initHubBrandbar } from "../nav.js";

const ID_SAFE = /^[0-9A-Za-z._-]+$/;   // same gate index.html applies to ?deck=
const PEEK_W = 1280;                    // deck canvas width — peeks scale down from this
const COPY_RESET_MS = 1600;

/* Calendar defaults — used ONLY when a deck omits the field.
   The title/time now come from each deck's own meta (occasion +
   durationMin), so this hard-coded 09:00 slot is a fallback, not
   the rule it used to be. No em-dash in the title (brand rule). */
const CAL_TITLE_FALLBACK = "Demo and Look Ahead, Marketing";
const CAL_START_HHMM = "0900";          // 09:00 when a deck sets no start
const CAL_DEFAULT_MIN = 30;             // 30 min slot when durationMin absent

/* Status lifecycle (concept §6.2). Unknown/absent → "draft". */
const KNOWN_STATUS = new Set(["draft", "ready", "live", "delivered"]);
const RECENT_WINDOW_DAYS = 21;          // delivered within this window → "Recent", else "Archive"

/* QR module resolves once (or to null). Probed defensively — the
   parallel vendor file may export any of a few common shapes. */
let qrModulePromise = null;

/* --- HTML escaping (all data strings pass through here) --- */
function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

const pad2 = (n) => String(n).padStart(2, "0");

/* Deck-relative URL (resolved against hub.html — subpath-safe on Pages) */
const openUrl = (id) => `index.html?deck=${id}`;
const absUrl = (rel) => new URL(rel, location.href).href;

/* meta.date is dd.mm.yyyy (see decks/*.deck.js). Round-trip check rejects
   rolling dates like 31.02. — Date() would silently roll them to March and
   the calendar link would carry a malformed stamp. */
function parseDate(raw) {
  const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(String(raw || "").trim());
  if (!m) return null;
  const date = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  if (date.getFullYear() !== Number(m[3]) ||
      date.getMonth() !== Number(m[2]) - 1 ||
      date.getDate() !== Number(m[1])) return null;
  return { dd: m[1], mm: m[2], yyyy: m[3], date };
}

function formatDate(raw) {
  const p = parseDate(raw);
  if (!p) return String(raw || "");
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short", day: "2-digit", month: "short", year: "numeric",
  }).format(p.date);
}

/* --- Google Calendar template link ---------------------------------
   Reads the DECK's own occasion (title) and durationMin (end time)
   instead of a single hard-coded 09:00-09:30 slot. Falls back to the
   demo-cadence defaults when a field is absent. Relative-safe: the
   details field carries the deck's absolute URL. Returns null only
   when the date itself is unusable (a link with no day is useless). */
function calendarUrl(entry) {
  const p = parseDate(entry.dateRaw);
  if (!p) return null;

  const startClock = /^\d{4}$/.test(entry.startHHMM) ? entry.startHHMM : CAL_START_HHMM;
  const startMin = Number(startClock.slice(0, 2)) * 60 + Number(startClock.slice(2));
  const durMin = Number.isFinite(entry.durationMin) && entry.durationMin > 0
    ? Math.round(entry.durationMin)
    : CAL_DEFAULT_MIN;
  const endMin = startMin + durMin;                    // may cross into a later hour
  const endClock = pad2(Math.floor(endMin / 60) % 24) + pad2(endMin % 60);

  const stamp = `${p.yyyy}${p.mm}${p.dd}`;
  const title = entry.occasion
    ? `${entry.occasion}, ${entry.title}`
    : CAL_TITLE_FALLBACK;

  const url = new URL("https://calendar.google.com/calendar/render");
  url.searchParams.set("action", "TEMPLATE");
  url.searchParams.set("text", title.replace(/[–—]/g, ",")); // never ship an em/en-dash
  url.searchParams.set("details", absUrl(openUrl(entry.id)));
  url.searchParams.set("dates", `${stamp}T${startClock}00/${stamp}T${endClock}00`);
  return url.href;
}

/* ---------------------------------------------------------------
   Grouping — status + date decide the bucket. The active deck
   (hero) is the one live deck, else the newest; it is pulled OUT
   of the grouped sections so it never appears twice. Remaining
   decks bucket by status/date:
     · Up next  — ready or draft (a deck being prepared/queued)
     · Recent   — delivered within RECENT_WINDOW_DAYS, or live
     · Archive  — delivered older than the window
   Decks with no status default to "draft" → they land in "Up
   next", which is exactly right for the two current decks (neither
   sets status yet) and keeps the hub from ever going blank.
--------------------------------------------------------------- */
function statusOf(entry) {
  const s = String(entry.status || "").toLowerCase();
  return KNOWN_STATUS.has(s) ? s : "draft";
}

function daysSince(entry, now) {
  const p = parseDate(entry.dateRaw);
  if (!p) return Infinity;               // undatable → treat as old (Archive)
  return Math.floor((now - p.date.getTime()) / 86400000);
}

/* Pick the hero: the live deck if any, otherwise manifest[0] (newest
   first is the manifest contract). entries is already newest-first. */
function pickHeroIndex(entries) {
  if (!entries.length) return -1;
  const live = entries.findIndex((e) => statusOf(e) === "live");
  return live >= 0 ? live : 0;
}

function groupEntries(entries, heroIndex) {
  const now = Date.now();
  const groups = { upNext: [], recent: [], archive: [] };
  entries.forEach((entry, i) => {
    if (i === heroIndex) return;         // the hero is shown in its own band
    const status = statusOf(entry);
    if (status === "delivered") {
      if (daysSince(entry, now) <= RECENT_WINDOW_DAYS) groups.recent.push(entry);
      else groups.archive.push(entry);
    } else if (status === "live") {
      groups.recent.push(entry);         // a second live deck is unusual; surface it near the top
    } else {
      groups.upNext.push(entry);         // ready / draft (and status-less decks)
    }
  });
  return groups;
}

/* ---------------------------------------------------------------
   Load the manifest — invalid ids and broken modules are skipped
   with a console.warn (same posture as renderDeck's array guard).
   Carries the new library meta fields through (all optional).
--------------------------------------------------------------- */
async function loadEntries() {
  let manifest;
  try {
    ({ manifest } = await import("../../decks/manifest.js"));
  } catch (err) {
    console.warn("[hub] could not read decks/manifest.js — check its syntax", err);
    return { entries: [], manifestBroken: true };
  }
  const ids = Array.isArray(manifest) ? manifest : [];
  const entries = [];
  for (const id of ids) {
    if (typeof id !== "string" || !ID_SAFE.test(id)) {
      console.warn("[hub] skipping invalid deck id:", id);
      continue;
    }
    try {
      const { deck } = await import(`../../decks/${id}.deck.js`);
      if (!deck || !Array.isArray(deck.slides)) throw new Error("module has no { deck.slides }");
      const meta = deck.meta || {};
      entries.push({
        id,
        title: meta.title || id,
        dateRaw: meta.date || "",
        slideCount: deck.slides.length,
        notesCount: deck.slides.filter((s) => s && typeof s.notes === "string" && s.notes.trim()).length,
        /* new, all optional (concept §6.2) — degrade cleanly when absent */
        status: meta.status,
        occasion: typeof meta.occasion === "string" ? meta.occasion.trim() : "",
        durationMin: typeof meta.durationMin === "number" ? meta.durationMin : NaN,
        owner: typeof meta.owner === "string" ? meta.owner.trim() : "",
        room: typeof meta.room === "string" ? meta.room.trim() : "",
        tags: Array.isArray(meta.tags) ? meta.tags.filter((t) => typeof t === "string" && t.trim()) : [],
        startHHMM: typeof meta.startHHMM === "string" ? meta.startHHMM.trim() : "",
      });
    } catch (err) {
      console.warn(`[hub] could not load deck "${id}", skipping`, err);
    }
  }
  return { entries, manifestBroken: false };
}

/* ---------------------------------------------------------------
   Live thumbnails — ?present=peek iframes (read-only: deck-link.js
   never publishes from a peek, so thumbnails can't clobber the
   presenter's BroadcastChannel/localStorage state). One shared
   ResizeObserver maps wrapper width → --peek-scale (transform only).

   NEW: a card's peek is only BOOTED (its <iframe> injected) when the
   card scrolls near the viewport. A large library no longer spins up
   N reveal instances at once — one IntersectionObserver watches every
   stage and fills the peek lazily, then unobserves it.
--------------------------------------------------------------- */
const peekScaler = new ResizeObserver((records) => {
  for (const r of records) {
    r.target.style.setProperty("--peek-scale", (r.contentRect.width / PEEK_W).toFixed(4));
  }
});

/* Boot the iframe held on a placeholder .hub-peek (data-* holds the
   deferred src). Idempotent: a peek only ever boots once. */
function bootPeek(peek) {
  if (!peek || peek.dataset.booted) return;
  const id = peek.dataset.peekId;
  const slide = peek.dataset.peekSlide || "0";
  if (!id) return;
  const frame = document.createElement("iframe");
  frame.src = `index.html?deck=${encodeURIComponent(id)}&present=peek#/${slide}`;
  frame.loading = "lazy";
  frame.setAttribute("scrolling", "no");
  frame.setAttribute("tabindex", "-1");
  frame.setAttribute("aria-hidden", "true");
  peek.appendChild(frame);
  peek.dataset.booted = "1";
  peekScaler.observe(peek);              // scale once the frame exists
}

/* Near-viewport lazy boot. rootMargin gives us a screen of runway so
   a peek is warm by the time it scrolls in. Fallback: if IO is
   unavailable, boot immediately (correctness over the optimization). */
const peekBooter = ("IntersectionObserver" in window)
  ? new IntersectionObserver((records, obs) => {
      for (const r of records) {
        if (r.isIntersecting) { bootPeek(r.target); obs.unobserve(r.target); }
      }
    }, { rootMargin: "600px 0px" })
  : null;

/* A placeholder peek (no iframe yet); boots lazily via peekBooter. */
function peekHtml(id, slideIndex, extraClass) {
  return `<span class="hub-peek${extraClass ? ` ${extraClass}` : ""}"
      data-peek data-peek-id="${esc(id)}" data-peek-slide="${slideIndex}"></span>`;
}

function observePeeks(root) {
  root.querySelectorAll(".hub-peek[data-peek]:not([data-booted])").forEach((el) => {
    if (peekBooter) peekBooter.observe(el);
    else bootPeek(el);                   // no IO → boot now
  });
}

/* ---------------------------------------------------------------
   QR — vendor/qr.mjs is optional. Probe common export shapes so we
   are resilient to whatever the parallel wave lands. Any of:
     · export function toSVG(text, opts) -> svg string
     · export function makeQR(text) -> svg string | {svg}
     · export default (text) -> svg string
     · export function toCanvas / render(el, text)
   are accepted. If none match (or the file is absent), we return
   null and every share affordance degrades to copy-link only.
--------------------------------------------------------------- */
async function loadQr() {
  if (qrModulePromise) return qrModulePromise;
  qrModulePromise = (async () => {
    let mod;
    try {
      mod = await import("../qr.js"); // shared brand-QR helper (wraps vendor/qr.mjs)
    } catch (err) {
      console.info("[hub] template/qr.js not available, share degrades to copy-link", err);
      return null;
    }
    return mod || null;
  })();
  return qrModulePromise;
}

/* Turn text → an inline SVG string using whatever the module exposes.
   Returns null when no compatible entry point is found. Never throws. */
async function qrSvg(text) {
  const mod = await loadQr();
  if (!mod) return null;
  const candidates = [mod.toSVG, mod.qrSvg, mod.toSvg, mod.makeQR, mod.render, mod.default];
  for (const fn of candidates) {
    if (typeof fn !== "function") continue;
    try {
      const out = fn(text, { margin: 1 });
      const resolved = out && typeof out.then === "function" ? await out : out;
      if (typeof resolved === "string" && resolved.includes("<svg")) return resolved;
      if (resolved && typeof resolved.svg === "string" && resolved.svg.includes("<svg")) return resolved.svg;
    } catch (err) {
      console.info("[hub] qr entry point failed, trying next", err);
    }
  }
  return null;
}

/* Fill a share popover's QR slot. Only booted on first open (a QR per
   card up front is wasted work). Degrades silently to the copy row. */
async function fillQr(slot, url) {
  if (!slot || slot.dataset.qrDone) return;
  slot.dataset.qrDone = "1";
  const svg = await qrSvg(url);
  if (svg) {
    slot.innerHTML = svg;
    slot.classList.add("has-qr");
  } else {
    slot.remove();                       // no QR module → drop the empty frame
  }
}

/* ---------------------------------------------------------------
   Markup builders (render.js idiom: template strings + esc)
--------------------------------------------------------------- */
function metaLine(entry) {
  const bits = [`${entry.slideCount} slides · notes on ${entry.notesCount} of ${entry.slideCount}`];
  if (entry.durationMin > 0) bits.push(`${entry.durationMin} min`);
  return bits.join(" · ");
}

/* A small status chip (only when a deck actually sets a status). */
function statusChip(entry) {
  const raw = String(entry.status || "").toLowerCase();
  if (!KNOWN_STATUS.has(raw)) return "";
  return `<span class="hub-chip hub-chip--${raw}">${esc(raw)}</span>`;
}

/* Owner / tags footnote (only rendered when present). */
function ownerLine(entry) {
  const bits = [];
  if (entry.owner) bits.push(esc(entry.owner));
  if (entry.tags.length) bits.push(entry.tags.map((t) => `#${esc(t)}`).join(" "));
  return bits.length ? `<p class="hub-card__owner">${bits.join(" · ")}</p>` : "";
}

/* Per-deck share affordance — copy-link button + a QR slot the QR
   module fills on first open. The details/summary keeps it collapsed
   so a big library is not a wall of QR codes. */
function shareHtml(entry, onBlue) {
  const url = absUrl(openUrl(entry.id));
  const btnClass = onBlue ? "hub-btn hub-btn--onblue" : "hub-btn";
  return `
    <details class="hub-share${onBlue ? " hub-share--onblue" : ""}" data-share>
      <summary class="${btnClass} hub-share__summary">Share</summary>
      <div class="hub-share__panel">
        <button class="hub-btn hub-btn--primary hub-share__copy" type="button"
                data-copy="${esc(url)}">Copy link</button>
        <div class="hub-share__qr" data-qr aria-hidden="true"></div>
        <p class="hub-share__url">${esc(url)}</p>
      </div>
    </details>`;
}

function heroHtml(entry) {
  const cal = calendarUrl(entry);
  return `
  <article class="hub-hero" data-id="${entry.id}">
    <svg class="hub-orbit" viewBox="0 0 800 800" aria-hidden="true">
      <circle cx="400" cy="400" r="300" class="ring-1"/>
      <circle cx="400" cy="400" r="392" class="ring-2"/>
      <circle cx="400" cy="103" r="5" class="ring-dot"/>
    </svg>
    <div class="hub-hero__copy">
      <p class="hub-hero__eyebrow"><span class="hub-hero__pip" aria-hidden="true"></span>${
        statusOf(entry) === "live" ? "Live now" : "Next demo"
      }</p>
      <h3 class="hub-hero__title">${esc(entry.title)}</h3>
      <p class="hub-hero__date">${esc(formatDate(entry.dateRaw))}${
        entry.occasion ? ` · ${esc(entry.occasion)}` : ""
      }</p>
      <p class="hub-hero__meta">${metaLine(entry)}</p>
      <div class="hub-hero__actions">
        <a class="hub-btn hub-btn--hero" href="${openUrl(entry.id)}">Open deck</a>
        ${shareHtml(entry, true)}
        ${cal ? `<a class="hub-btn hub-btn--onblue" href="${esc(cal)}" target="_blank" rel="noopener">Add to calendar</a>` : ""}
      </div>
    </div>
    <a class="hub-hero__stage" href="${openUrl(entry.id)}" aria-label="Open ${esc(entry.title)}">
      ${peekHtml(entry.id, 0, "hub-peek--hero")}
    </a>
  </article>`;
}

function planHtml(newestId) {
  const srcFile = newestId ? `decks/${newestId}.deck.js` : "decks/<latest>.deck.js";
  return `
  <details class="hub-plan">
    <summary class="hub-plan__summary">
      <span class="hub-plan__plus" aria-hidden="true">+</span>
      <span class="hub-plan__label">Plan the next demo</span>
      <span class="hub-plan__hint">4 steps</span>
    </summary>
    <ol class="hub-plan__steps">
      <li>Copy the newest deck file: <code>cp ${esc(srcFile)} decks/YYYY-MM-DD.deck.js</code></li>
      <li>Swap the strings and speaker notes for the new demo.</li>
      <li>Drop the new PNGs into <code>assets/img/YYYY-MM-DD/</code> and point <code>meta.imagesBase</code> at that folder.</li>
      <li>Add the new id to <code>decks/manifest.js</code>, newest first. Reload the hub, done.</li>
    </ol>
  </details>`;
}

function cardHtml(entry, index) {
  const cal = calendarUrl(entry);
  return `
  <article class="hub-card" data-id="${entry.id}">
    <a class="hub-card__stage" href="${openUrl(entry.id)}" aria-label="Open ${esc(entry.title)}">
      ${peekHtml(entry.id, 0)}
    </a>
    <div class="hub-card__body">
      <span class="hub-card__ghost font-num" aria-hidden="true">${pad2(index + 1)}</span>
      <p class="hub-card__date">${esc(formatDate(entry.dateRaw))}${statusChip(entry)}</p>
      <h3 class="hub-card__title">${esc(entry.title)}</h3>
      <p class="hub-card__meta">${metaLine(entry)}</p>
      ${ownerLine(entry)}
      <div class="hub-card__actions">
        <a class="hub-btn hub-btn--primary" href="${openUrl(entry.id)}">Open</a>
        ${shareHtml(entry, false)}
        ${cal ? `<a class="hub-btn" href="${esc(cal)}" target="_blank" rel="noopener">Add to calendar</a>` : ""}
        <button class="hub-btn hub-btn--ghost" type="button" data-strip-toggle aria-expanded="false">Slides</button>
      </div>
    </div>
    <div class="hub-strip" data-strip hidden></div>
  </article>`;
}

/* Slide strip — built lazily on first expand (one peek placeholder per
   slide; each boots when it scrolls into the strip's viewport). */
function buildStrip(mount, entry) {
  const tiles = [];
  for (let i = 0; i < entry.slideCount; i++) {
    tiles.push(`
      <a class="hub-strip__slide" href="index.html?deck=${esc(entry.id)}#/${i}"
         target="_blank" rel="noopener" aria-label="Open slide ${i + 1} of ${esc(entry.title)}">
        ${peekHtml(entry.id, i, "hub-peek--mini")}
        <span class="hub-strip__num font-num">${pad2(i + 1)}</span>
      </a>`);
  }
  mount.innerHTML = `<div class="hub-strip__scroller">${tiles.join("")}</div>`;
  observePeeks(mount);
}

/* A grouped library section. Returns "" when the bucket is empty so
   the section header never sits over nothing. The `startIndex` keeps
   the ghost numerals continuous across sections. */
function sectionHtml(label, entries, startIndex) {
  if (!entries.length) return "";
  const cards = entries.map((e, i) => cardHtml(e, startIndex + i)).join("");
  return `
  <section class="hub-group" aria-label="${esc(label)}">
    <h2 class="hub-section__label overline">${esc(label)}</h2>
    <div class="hub-grid">${cards}</div>
  </section>`;
}

/* ---------------------------------------------------------------
   Actions
--------------------------------------------------------------- */
const copyTimers = new WeakMap();

async function copyLink(btn) {
  let label = "Copied";
  try {
    await navigator.clipboard.writeText(btn.getAttribute("data-copy") || "");
  } catch (err) {
    console.warn("[hub] clipboard write failed", err);
    label = "Copy failed";
  }
  if (!btn.dataset.label) btn.dataset.label = btn.textContent;
  btn.textContent = label;
  btn.classList.add("is-copied");
  clearTimeout(copyTimers.get(btn));
  copyTimers.set(btn, setTimeout(() => {
    btn.textContent = btn.dataset.label;
    btn.classList.remove("is-copied");
  }, COPY_RESET_MS));
}

function toggleStrip(btn, entriesById) {
  const card = btn.closest(".hub-card");
  const strip = card ? card.querySelector("[data-strip]") : null;
  const entry = card ? entriesById.get(card.getAttribute("data-id")) : null;
  if (!strip || !entry) return;
  const expand = strip.hidden;
  if (expand && !strip.dataset.built) {   // lazy: iframes exist only after first expand
    buildStrip(strip, entry);
    strip.dataset.built = "1";
  }
  strip.hidden = !expand;
  btn.setAttribute("aria-expanded", String(expand));
}

/* First open of a Share popover fills its QR (deck's absolute URL). */
function onShareToggle(details, entriesById) {
  if (!details.open) return;
  const card = details.closest("[data-id]");
  const entry = card ? entriesById.get(card.getAttribute("data-id")) : null;
  const slot = details.querySelector("[data-qr]");
  if (entry && slot) fillQr(slot, absUrl(openUrl(entry.id)));
}

/* ---------------------------------------------------------------
   Boot
--------------------------------------------------------------- */
(async function init() {
  // Persistent wordmark bar — anchors the hub as the tool's home
  // ("you are here: Library"). Idempotent; safe before the mounts load.
  initHubBrandbar();

  const heroMount = document.getElementById("hub-hero");
  const planMount = document.getElementById("hub-plan");
  const gridMount = document.getElementById("hub-grid");
  if (!heroMount || !planMount || !gridMount) {
    console.warn("[hub] mount points missing — check hub.html");
    return;
  }

  const { entries, manifestBroken } = await loadEntries();
  const entriesById = new Map(entries.map((e) => [e.id, e]));

  const heroIndex = pickHeroIndex(entries);
  const hero = heroIndex >= 0 ? entries[heroIndex] : null;

  heroMount.innerHTML = hero
    ? heroHtml(hero)
    : `<p class="hub-empty">${manifestBroken
        ? "Could not read <code>decks/manifest.js</code>. Check its syntax (a missing quote or comma) and reload."
        : "No decks yet. Add an id to <code>decks/manifest.js</code> and reload."}</p>`;
  planMount.innerHTML = planHtml(hero ? hero.id : "");

  /* Grouped library. Numerals stay continuous across the three buckets. */
  const groups = groupEntries(entries, heroIndex);
  let n = 0;
  const upNext = sectionHtml("Up next", groups.upNext, n); n += groups.upNext.length;
  const recent = sectionHtml("Recent", groups.recent, n); n += groups.recent.length;
  const archive = sectionHtml("Archive", groups.archive, n); n += groups.archive.length;
  const anyGrouped = groups.upNext.length + groups.recent.length + groups.archive.length;
  gridMount.innerHTML = anyGrouped
    ? upNext + recent + archive
    : (hero
        ? `<p class="hub-empty hub-empty--calm">That is the whole library for now. Add the next demo to <code>decks/manifest.js</code>.</p>`
        : "");

  observePeeks(document);

  document.addEventListener("click", (ev) => {
    const copyBtn = ev.target.closest("[data-copy]");
    if (copyBtn) { copyLink(copyBtn); return; }
    const stripBtn = ev.target.closest("[data-strip-toggle]");
    if (stripBtn) toggleStrip(stripBtn, entriesById);
  });

  /* Share popovers fill their QR on first open (native <details> event). */
  document.addEventListener("toggle", (ev) => {
    const details = ev.target;
    if (details instanceof HTMLElement && details.matches("[data-share]")) {
      onShareToggle(details, entriesById);
    }
  }, true);
})();
