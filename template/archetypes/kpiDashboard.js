/* kpiDashboard.js — the company-tool hero slide. A multi-metric board (3..6 cells)
   where each cell boots three things together on entry: a count-up numeral, a
   scaleX meter fill, and an optional draw-in ring — all staggered via --anim-step.
   `anim` class + --anim-step = auto-playing entrance stagger (no clicks); the meter
   fill + ring draw ride keyframes gated to .present (deck.css), so peek/print/
   reduced-motion all resolve to the finished board.
   tone:"accent" marks the ONE red money metric (max one per surface; the renderer
   only honours the first accent it sees, so the invariant can't be violated by data).
   Returns ONLY the content region. */
import { esc } from "./_shared.js";

const MIN_CELLS = 1;
const MAX_CELLS = 6;

/* count-up only drives clean integers (anim.js Math.rounds); decimals/thousands
   render their literal value so the figure on screen is exactly what was authored. */
function isCountable(v) {
  return /^-?\d+$/.test(String(v == null ? "" : v).replace(/,/g, ""));
}
function clamp01(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(1, n));
}

/* One cell: numeral (+unit) · label · optional meter (scaleX) · optional ring (draw-in).
   `accent` is passed in (not read from the cell) so the parent can guarantee at most one. */
function cell(m, i, accent) {
  if (!m || typeof m !== "object") return ""; // skip malformed entries, never break the grid
  const isNum = isCountable(m.value);
  const value = isNum
    ? `<span class="kpi__value count-up" data-count-to="${String(m.value).replace(/,/g, "")}">0</span>`
    : `<span class="kpi__value">${esc(m.value)}</span>`;
  const unit = m.unit ? `<span class="kpi__unit">${esc(m.unit)}</span>` : "";
  const label = m.label ? `<span class="kpi__label">${esc(m.label)}</span>` : "";

  // meter: a thin track with a scaleX fill (0..1). Grows once on entry (transform only).
  const meterVal = clamp01(m.meter);
  const meter = meterVal != null
    ? `<div class="kpi__meter" role="img" aria-hidden="true">
         <span class="kpi__meter-fill" style="--meter-scale:${meterVal.toFixed(3)}"></span>
       </div>`
    : "";

  // ring: an optional draw-in arc that echoes the meter value when no meter is given,
  // else the ring value itself (0..1). Kept small — a corner accent, not a chart.
  const ringVal = m.ring != null ? clamp01(m.ring) : null;
  const ring = ringVal != null
    ? `<div class="kpi__ring" aria-hidden="true">
         <svg viewBox="0 0 72 72">
           <circle class="kpi__ring-track" cx="36" cy="36" r="30"/>
           <circle class="kpi__ring-arc" cx="36" cy="36" r="30"
                   pathLength="100" style="--ring-drawn:${(ringVal * 100).toFixed(2)}"/>
         </svg>
       </div>`
    : "";

  const cls = ["kpi__cell", "anim", accent ? "kpi__cell--accent" : ""].filter(Boolean).join(" ");
  return `<div class="${cls}" style="--anim-step:${i + 3}">
      <div class="kpi__head">
        <span class="kpi__figure">${value}${unit}</span>
        ${ring}
      </div>
      ${label}
      ${meter}
    </div>`;
}

export function kpiDashboard(slide) {
  const raw = Array.isArray(slide.metrics) ? slide.metrics.slice(0, MAX_CELLS) : [];
  const metrics = raw.length >= MIN_CELLS ? raw : [];

  // Enforce the one-red-stopper invariant in the renderer: only the FIRST cell whose
  // tone is "accent" gets the red treatment; every later accent falls back to plain.
  let accentSpent = false;
  const cells = metrics.map((m, i) => {
    const wantsAccent = m && m.tone === "accent" && !accentSpent;
    if (wantsAccent) accentSpent = true;
    return cell(m, i, wantsAccent);
  }).join("");

  // data-count drives grid column count so 3/4/5/6 cells all balance (CSS reads it).
  return `<div class="kpi" data-count="${metrics.length}">${cells}</div>`;
}
