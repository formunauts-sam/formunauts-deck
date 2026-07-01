/* ============================================================
   render.js — THE ONLY PLACE MARKUP LIVES.
   CHROME. Never edited per-demo.
   ------------------------------------------------------------
   Switches on slide.archetype, emits <section> HTML, composes
   the persistent chrome (kicker / headline / lead / footer /
   page-index) for content slides, and drops speaker notes
   verbatim into reveal's <aside class="notes">.
   A new fortnight = new decks/*.deck.js + repoint index.html.
   No HTML/CSS edits, ever.
   ============================================================ */
import { esc, kicker, headline, lead } from "./archetypes/_shared.js";
import { cover } from "./archetypes/cover.js";
import { overviewBullets } from "./archetypes/overviewBullets.js";
import { campaignAnalysis } from "./archetypes/campaignAnalysis.js";
import { projectVisual } from "./archetypes/projectVisual.js";
import { processDiagram } from "./archetypes/processDiagram.js";
import { nextSteps } from "./archetypes/nextSteps.js";
import { closing } from "./archetypes/closing.js";
import { statusBoard } from "./archetypes/statusBoard.js";

const ARCHETYPE = {
  cover, overviewBullets, campaignAnalysis, projectVisual, processDiagram, nextSteps, closing, statusBoard,
};

/* Default chrome color per archetype (a slide can override via slide.chrome). */
const DEFAULT_CHROME = {
  cover: "blue",
  overviewBullets: "light",
  campaignAnalysis: "light",
  projectVisual: "light",
  processDiagram: "light",
  nextSteps: "light",
  closing: "blue",
  statusBoard: "dark",
};

/* Archetypes that own their entire section body (no shared chrome added). */
const FULL_BLEED = new Set(["cover", "closing"]);

/* Slides that get a faint rocket watermark for texture (recap / look-ahead). */
const WATERMARK_IDS = new Set(["overview-recap", "next-steps"]);

function chromeClass(slide) {
  if (slide.chrome) return `slide--${slide.chrome}`;
  if (slide.backdrop === "muted") return "slide--muted";
  return `slide--${DEFAULT_CHROME[slide.archetype] || "light"}`;
}

/**
 * renderDeck — build the whole .slides DOM from a deck data object.
 * @param {object} deck  { meta:{imagesBase,...}, slides:[...] }
 * @param {HTMLElement} mount  the .slides container
 */
export function renderDeck(deck, mount) {
  if (!deck || !Array.isArray(deck.slides)) {
    console.error("[render] invalid deck data — expected { slides: [...] }");
    return;
  }
  const base = (deck.meta && deck.meta.imagesBase) || "./assets/img/";
  const logosBase = "./assets/logos/";
  const total = deck.slides.length;

  // shared context handed to every archetype
  const ctx = {
    base,
    meta: deck.meta || {},
    logo: (file) => logosBase + file,
  };

  const html = deck.slides.map((slide, i) => renderSlide(slide, i, total, ctx)).join("\n");
  mount.innerHTML = html;
}

function renderSlide(slide, i, total, ctx) {
  const fn = ARCHETYPE[slide.archetype];
  const idx = String(i + 1).padStart(2, "0");
  const totalStr = String(total).padStart(2, "0");

  let body;
  if (typeof fn !== "function") {
    console.warn(`[render] unknown archetype "${slide.archetype}" on slide ${idx}`);
    body = `<div class="content"><h1 class="headline">Unknown archetype: ${esc(slide.archetype)}</h1></div>`;
  } else {
    body = fn(slide, ctx);
  }

  const notes = slide.notes
    ? `<aside class="notes">${esc(slide.notes)}</aside>`
    : "";

  // Full-bleed archetypes (cover/closing) build everything themselves.
  if (FULL_BLEED.has(slide.archetype)) {
    return sectionOpen(slide, idx) +
      body +
      notes +
      `</section>`;
  }

  // Content slides: persistent chrome wraps the archetype's content region.
  const cls = chromeClass(slide);
  const isDark = cls === "slide--dark" || cls === "slide--blue";
  const watermark = WATERMARK_IDS.has(slide.id)
    ? `<img class="rocket-watermark" src="${esc(ctx.logo("formunauts_visual_blue.svg"))}" alt="" aria-hidden="true">`
    : "";

  return sectionOpen(slide, idx) +
    `<div class="ghost-index" aria-hidden="true">${idx}</div>` +
    watermark +
    kicker(slide.eyebrow) +
    headline(slide.headline) +
    lead(slide.lead) +
    body +
    `<div class="page-index"><b>${idx}</b> / ${totalStr}</div>` +
    notes +
    `</section>`;
}

function sectionOpen(slide, idx) {
  const cls = chromeClass(slide);
  const timing = slide.timing ? ` data-timing="${Number(slide.timing)}"` : "";
  // data-auto-animate pairs the cover & closing (continuous ring arc bookend).
  const auto = (slide.archetype === "cover" || slide.archetype === "closing")
    ? ` data-auto-animate data-auto-animate-id="bookend"` : "";
  return `<section id="slide-${esc(slide.id || idx)}" class="slide ${cls}"${auto}${timing} data-archetype="${esc(slide.archetype)}">`;
}
