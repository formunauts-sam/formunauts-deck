/* ============================================================
   bentoBoard.js — the anti-empty-lower-third layout (masterplan §3.1 B).
   CHROME. Never edited per-demo.
   ------------------------------------------------------------
   A reusable 12-column bento that FILLS .content edge-to-edge:
   tiles are white cards (--radius-lg, --elevation-2) on --blue-50,
   each placing itself via data-span (columns) / data-rowspan (rows).
   Bento fills by definition — the structural fix for "slides aren't
   filled." Selective-emphasis rule (§1.3): if a tile carries a
   screenshot, keep its neighbours text-only.

   Returns ONLY the content region (shared chrome wraps it in render.js).
   All media flows through assetFrame()/deviceFrame() → aspect-locked,
   never squished. Every tile is fully visible on entry; only the
   fade-up TIMING staggers (--anim-step), so peek/print/reduced-motion
   all show the finished board (gates live in deck.css).

   ------------------------------------------------------------
   DECK DATA SHAPE (declarative — lives in decks/*.deck.js):

   {
     archetype: "bentoBoard",
     eyebrow, headline, lead,           // handled by shared chrome
     meter: {                           // OPTIONAL completion meter across the top
       done: 3, total: 4,               //   → thin --fmnts-primary fill to done/total
       label: "workstreams shipped"     //   → "<b>3</b> of 4 workstreams shipped · 75%"
     },
     tiles: [
       {
         span: 6, rowspan: 2,           // 12-col grid placement (defaults 4 / 1; clamped)
         tone: "hero"|"accent"|"ghost"|"plain",   // optional emphasis (default plain)
         state: "done"|"active"|"next", // optional status dot + pill (engine-room re-skin)
         eyebrow: "STRATEGY & WEB",     // small uppercase label
         title: "UK inhouse page",      // Chillax-eligible tile heading
         text: "Structure shipped…",    // supporting body
         stat: { value: "26.8", unit:"%", label:"accept rate" },  // OPTIONAL giant numeral
         media: {                       // OPTIONAL — ONE of asset|device per tile
           kind: "device",              //   "device" → deviceFrame, else assetFrame
           file: "dashboard.png",
           device: "browser",           //   phone|browser|desk (device kind only)
           url: "formunauts.com/uk",    //   browser address-bar label
           treatment: "duotone",        //   assetFrame supporting-cast wash
           crop: "top",                 //   device cover-crop anchor
           badge: { text:"LIVE", tone:"success" },
           alt: "UK inhouse page"
         }
       }
     ]
   }
   ============================================================ */
import { esc, assetFrame, deviceFrame } from "./_shared.js";

const TONES = new Set(["hero", "accent", "ghost", "plain"]);
const STATES = new Set(["done", "active", "next"]);
const MAX_COLS = 12;

/* clamp a span into [1, MAX_COLS] with a sane default (never NaN → grid break). */
function spanCols(v, fallback) {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(MAX_COLS, Math.max(1, n));
}
function spanRows(v) {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(4, n); // rows are bounded so one tile can't blow out the 720 canvas
}

/* One tile's media (never a bare <img> — always framed, aspect-locked). */
function tileMedia(media, base) {
  if (!media || !media.file) return "";
  const badge = media.badge || null;
  if (media.kind === "device") {
    return `<div class="bento-tile__media bento-tile__media--device">${
      deviceFrame(base, media.file, {
        device: media.device,
        url: media.url,
        crop: media.crop,
        badge,
        alt: media.alt,
        floating: true,
      })
    }</div>`;
  }
  return `<div class="bento-tile__media">${
    assetFrame(base, media.file, {
      treatment: media.treatment,
      ratioClass: media.ratioClass,
      badge,
      alt: media.alt,
    })
  }</div>`;
}

/* One tile → a white card that places itself on the 12-col grid. */
function tile(t, i, base) {
  if (!t || typeof t !== "object") return ""; // skip malformed entries, never crash the board
  const tone = TONES.has(t.tone) ? t.tone : "plain";
  const state = STATES.has(t.state) ? t.state : "";
  const cols = spanCols(t.span, tone === "hero" ? 6 : 4);
  const rows = spanRows(t.rowspan);

  const dot = state ? `<span class="bento-tile__dot" aria-hidden="true"></span>` : "";
  const pill = state
    ? `<span class="bento-tile__state">${esc(t.stateLabel || state)}</span>`
    : "";
  const eyebrow = t.eyebrow
    ? `<span class="bento-tile__eyebrow">${dot}${esc(t.eyebrow)}</span>`
    : (dot ? `<span class="bento-tile__eyebrow">${dot}</span>` : "");
  const title = t.title ? `<h3 class="bento-tile__title">${esc(t.title)}</h3>` : "";
  const text = t.text ? `<p class="bento-tile__text">${esc(t.text)}</p>` : "";

  const stat = t.stat
    ? `<p class="bento-tile__stat">
         <b class="count-up"${
           statCountAttr(t.stat)
         }>${esc(startValue(t.stat))}</b>${
           t.stat.unit ? `<span class="bento-tile__unit">${esc(t.stat.unit)}</span>` : ""
         }
         ${t.stat.label ? `<span class="bento-tile__stat-label">${esc(t.stat.label)}</span>` : ""}
       </p>`
    : "";

  const media = tileMedia(t.media, base);

  const cls = [
    "bento-tile", "anim",
    tone !== "plain" ? `bento-tile--${tone}` : "",
    state ? `bento-tile--${state}` : "",
  ].filter(Boolean).join(" ");

  return `<div class="${cls}" data-span="${cols}" data-rowspan="${rows}"
       style="--tile-span:${cols};--tile-rowspan:${rows};--anim-step:${i + 3}">
      ${eyebrow}${stat}${title}${text}${media}${pill}
    </div>`;
}

/* Numeric stat → count-up attribute (only when value is a clean number). */
function statCountAttr(stat) {
  const raw = String(stat.value == null ? "" : stat.value).replace(/,/g, "");
  const n = Number(raw);
  return Number.isFinite(n) ? ` data-count-to="${n}"` : "";
}
function startValue(stat) {
  const raw = String(stat.value == null ? "" : stat.value).replace(/,/g, "");
  return Number.isFinite(Number(raw)) ? "0" : String(stat.value);
}

/* Optional completion meter across the top — the engine, quantified (count-up). */
function meterBlock(meter) {
  if (!meter) return "";
  const total = Number(meter.total);
  const done = Number(meter.done);
  const hasCounts = Number.isFinite(total) && total > 0 && Number.isFinite(done);
  const pct = hasCounts ? Math.round((done / total) * 100) : 0;
  const label = esc(meter.label || "complete");
  return `<div class="bento-meter anim" style="--anim-step:2">
      <div class="bento-meter__track"><div class="bento-meter__fill" style="width:${pct}%"></div></div>
      <p class="bento-meter__label">${
        hasCounts ? `<b class="count-up" data-count-to="${done}">0</b> of ${total} ${label} · ` : ""
      }<b>${pct}&thinsp;%</b></p>
    </div>`;
}

export function bentoBoard(slide, ctx) {
  const base = (ctx && ctx.base) || "./assets/img/";
  const tiles = Array.isArray(slide.tiles) ? slide.tiles : [];
  const cells = tiles.map((t, i) => tile(t, i, base)).join("");
  const meter = meterBlock(slide.meter);

  return `<div class="bento-wrap">
      ${meter}
      <div class="bento">${cells}</div>
    </div>`;
}
