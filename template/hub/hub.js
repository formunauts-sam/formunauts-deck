/* ============================================================
   hub.js — the Deck Hub (platform front door).
   CHROME. Imported by hub.html. Twin of template/presenter/.
   ------------------------------------------------------------
   Reads decks/manifest.js (the ONE list a non-dev edits),
   dynamically imports each decks/<id>.deck.js and renders:
     · "Next demo" hero band — the newest deck, big Open
     · a "Plan the next demo" ghost card (the 4-step recipe)
     · a library card per deck: live ?present=peek thumbnail
       (no screenshot pipeline — always current), Open /
       Copy link / Add to calendar, and an expandable slide
       strip (iframes render only on first expand).
   A deck that fails to import is skipped with console.warn;
   the hub never renders broken. Every deck URL is RELATIVE so
   the page works on GitHub Pages under a subpath.
   NOTE: manifest.js is the one file a non-dev edits, so it is
   imported DYNAMICALLY inside loadEntries() — a typo there must
   show a fix-it message, not blank the whole hub module.
   ============================================================ */
const ID_SAFE = /^[0-9A-Za-z._-]+$/;   // same gate index.html applies to ?deck=
const PEEK_W = 1280;                    // deck canvas width — peeks scale down from this
const CAL_TITLE = "Demo and Look Ahead, Marketing";
const CAL_START = "T090000";            // 09:00 on the deck date
const CAL_END = "T093000";              // 30 min demo slot
const COPY_RESET_MS = 1600;

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

/* Google Calendar template link — 09:00 to 09:30 on the deck date */
function calendarUrl(entry) {
  const p = parseDate(entry.dateRaw);
  if (!p) return null;
  const stamp = `${p.yyyy}${p.mm}${p.dd}`;
  const url = new URL("https://calendar.google.com/calendar/render");
  url.searchParams.set("action", "TEMPLATE");
  url.searchParams.set("text", CAL_TITLE);
  url.searchParams.set("details", absUrl(openUrl(entry.id)));
  url.searchParams.set("dates", `${stamp}${CAL_START}/${stamp}${CAL_END}`);
  return url.href;
}

/* ---------------------------------------------------------------
   Load the manifest — invalid ids and broken modules are skipped
   with a console.warn (same posture as renderDeck's array guard).
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
      entries.push({
        id,
        title: (deck.meta && deck.meta.title) || id,
        dateRaw: (deck.meta && deck.meta.date) || "",
        slideCount: deck.slides.length,
        notesCount: deck.slides.filter((s) => s && typeof s.notes === "string" && s.notes.trim()).length,
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
--------------------------------------------------------------- */
const peekScaler = new ResizeObserver((records) => {
  for (const r of records) {
    r.target.style.setProperty("--peek-scale", (r.contentRect.width / PEEK_W).toFixed(4));
  }
});

function peekHtml(id, slideIndex, extraClass) {
  return `<span class="hub-peek${extraClass ? ` ${extraClass}` : ""}">
      <iframe src="index.html?deck=${id}&amp;present=peek#/${slideIndex}"
              loading="lazy" scrolling="no" tabindex="-1" aria-hidden="true"></iframe>
    </span>`;
}

function observePeeks(root) {
  root.querySelectorAll(".hub-peek").forEach((el) => peekScaler.observe(el));
}

/* ---------------------------------------------------------------
   Markup builders (render.js idiom: template strings + esc)
--------------------------------------------------------------- */
function metaLine(entry) {
  return `${entry.slideCount} slides · notes on ${entry.notesCount} of ${entry.slideCount}`;
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
      <p class="hub-hero__eyebrow"><span class="hub-hero__pip" aria-hidden="true"></span>Next demo</p>
      <h3 class="hub-hero__title">${esc(entry.title)}</h3>
      <p class="hub-hero__date">${esc(formatDate(entry.dateRaw))}</p>
      <p class="hub-hero__meta">${metaLine(entry)}</p>
      <div class="hub-hero__actions">
        <a class="hub-btn hub-btn--hero" href="${openUrl(entry.id)}">Open deck</a>
        <button class="hub-btn hub-btn--onblue" type="button" data-copy="${esc(absUrl(openUrl(entry.id)))}">Copy link</button>
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
      <p class="hub-card__date">${esc(formatDate(entry.dateRaw))}</p>
      <h3 class="hub-card__title">${esc(entry.title)}</h3>
      <p class="hub-card__meta">${metaLine(entry)}</p>
      <div class="hub-card__actions">
        <a class="hub-btn hub-btn--primary" href="${openUrl(entry.id)}">Open</a>
        <button class="hub-btn" type="button" data-copy="${esc(absUrl(openUrl(entry.id)))}">Copy link</button>
        ${cal ? `<a class="hub-btn" href="${esc(cal)}" target="_blank" rel="noopener">Add to calendar</a>` : ""}
        <button class="hub-btn hub-btn--ghost" type="button" data-strip-toggle aria-expanded="false">Slides</button>
      </div>
    </div>
    <div class="hub-strip" data-strip hidden></div>
  </article>`;
}

/* Slide strip — built lazily on first expand (one peek iframe per slide) */
function buildStrip(mount, entry) {
  const tiles = [];
  for (let i = 0; i < entry.slideCount; i++) {
    tiles.push(`
      <a class="hub-strip__slide" href="index.html?deck=${entry.id}#/${i}"
         target="_blank" rel="noopener" aria-label="Open slide ${i + 1} of ${esc(entry.title)}">
        ${peekHtml(entry.id, i, "hub-peek--mini")}
        <span class="hub-strip__num font-num">${pad2(i + 1)}</span>
      </a>`);
  }
  mount.innerHTML = `<div class="hub-strip__scroller">${tiles.join("")}</div>`;
  observePeeks(mount);
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

/* ---------------------------------------------------------------
   Boot
--------------------------------------------------------------- */
(async function init() {
  const heroMount = document.getElementById("hub-hero");
  const planMount = document.getElementById("hub-plan");
  const gridMount = document.getElementById("hub-grid");
  if (!heroMount || !planMount || !gridMount) {
    console.warn("[hub] mount points missing — check hub.html");
    return;
  }

  const { entries, manifestBroken } = await loadEntries();
  const entriesById = new Map(entries.map((e) => [e.id, e]));

  heroMount.innerHTML = entries.length
    ? heroHtml(entries[0])
    : `<p class="hub-empty">${manifestBroken
        ? "Could not read <code>decks/manifest.js</code>. Check its syntax (a missing quote or comma) and reload."
        : "No decks yet. Add an id to <code>decks/manifest.js</code> and reload."}</p>`;
  planMount.innerHTML = planHtml(entries.length ? entries[0].id : "");
  gridMount.innerHTML = entries.map((e, i) => cardHtml(e, i)).join("");
  observePeeks(document);

  document.addEventListener("click", (ev) => {
    const copyBtn = ev.target.closest("[data-copy]");
    if (copyBtn) { copyLink(copyBtn); return; }
    const stripBtn = ev.target.closest("[data-strip-toggle]");
    if (stripBtn) toggleStrip(stripBtn, entriesById);
  });
})();
