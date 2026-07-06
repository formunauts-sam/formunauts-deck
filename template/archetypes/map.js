/* map.js — an inline SVG outline (Austria / Switzerland / Europe, simplified)
   whose routes DRAW via stroke-dashoffset and whose pins fade-up. The outline
   is a clean stylised silhouette, not geographic truth: readable + on-brand.
   All motion is compositor-safe (opacity + stroke-dashoffset, normalised via
   pathLength=100). Coordinates in pins/routes are 0..100 viewBox percentages.
   Returns ONLY the content region. Unique CSS prefix: .fmap__.

   DECK DATA SHAPE:
   { archetype:"map",
     region?,                                // "at" | "ch" | "eu" (default "at")
     lead?,                                   // handled by shared chrome
     pins:[{ x, y, label, tone? }],           // tone:"accent" = the ONE red stopper
     routes?:[{ from, to }],                  // indices into pins[] → drawn great-arcs
     caption? }                               // small footnote under the map
   ------------------------------------------------------------ */
import { esc } from "./_shared.js";

/* Stylised country outlines. Each path is a single closed silhouette sized to
   the 0..100 viewBox so pin coordinates map 1:1 onto it. Not to scale. */
const OUTLINES = {
  at: "M8 58 L20 52 L27 55 L34 50 L41 53 L49 47 L57 50 L66 45 L74 49 L86 44 L92 50 L88 58 L79 61 L70 58 L61 63 L52 60 L44 65 L35 62 L27 66 L18 63 Z",
  ch: "M14 46 L26 40 L37 44 L46 39 L58 43 L69 40 L80 47 L74 57 L63 61 L52 58 L43 63 L33 60 L23 63 L15 57 Z",
  eu: "M22 14 L34 10 L44 16 L52 11 L60 18 L55 27 L63 33 L58 44 L66 52 L60 63 L50 70 L54 80 L44 86 L36 78 L30 84 L24 74 L31 66 L22 60 L28 50 L20 42 L27 34 L18 26 Z",
};

const TONE = new Set(["accent"]);

/* One pin → a dot + label, fade-up staggered. The single accent pin is the
   red stopper (max one per surface) and gets a soft one-shot pulse ring. */
function pin(p, i) {
  const it = p || {};
  const x = clamp(it.x);
  const y = clamp(it.y);
  const accent = TONE.has(it.tone) ? " fmap-pin--accent" : "";
  const label = it.label
    ? `<span class="fmap-pin__label">${esc(it.label)}</span>`
    : "";
  // absolute-positioned overlay pin (percent coords) so labels use real type,
  // not <text> — crisper and reuses brand tokens.
  return `<div class="fmap-pin${accent} anim" style="--anim-step:${i + 6};left:${x}%;top:${y}%">
      <span class="fmap-pin__dot" aria-hidden="true"></span>
      ${label}
    </div>`;
}

/* One route → a quadratic arc between two pins, drawn on entry. The control
   point lifts the midpoint so routes read as gentle great-circle hops. */
function route(r, pins, i) {
  const a = pins[r && r.from];
  const b = pins[r && r.to];
  if (!a || !b) return ""; // dangling index → skip, never break the SVG
  const x1 = clamp(a.x), y1 = clamp(a.y), x2 = clamp(b.x), y2 = clamp(b.y);
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2 - Math.abs(x2 - x1) * 0.22 - 4; // arc lift
  return `<path class="fmap__route" pathLength="100" style="--route-step:${i}"
       d="M${x1} ${y1} Q${mx} ${my.toFixed(2)} ${x2} ${y2}"/>`;
}

function clamp(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 50;
  return Math.min(100, Math.max(0, n));
}

export function map(slide) {
  const region = OUTLINES[slide && slide.region] ? slide.region : "at";
  const outline = OUTLINES[region];
  const pins = Array.isArray(slide && slide.pins) ? slide.pins : [];
  const routes = Array.isArray(slide && slide.routes) ? slide.routes : [];

  const routePaths = routes.map((r, i) => route(r, pins, i)).join("");
  const pinEls = pins.map((p, i) => pin(p, i)).join("");
  const caption = slide && slide.caption
    ? `<p class="fmap__caption anim" style="--anim-step:${pins.length + 7}">${esc(slide.caption)}</p>`
    : "";

  // The outline draws first, then routes sweep, then pins drop — a coherent
  // build. Static (peek/print/reduced-motion) → the finished map (CSS gates).
  return `<div class="fmap fmap--${esc(region)}">
      <div class="fmap__stage">
        <svg class="fmap__svg" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
          <path class="fmap__outline" pathLength="100" d="${outline}"/>
          ${routePaths}
        </svg>
        <div class="fmap__pins">${pinEls}</div>
      </div>
      ${caption}
    </div>`;
}
