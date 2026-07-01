/* campaignAnalysis.js — Slide 03. The drawn funnel (SVG/CSS, NOT a screenshot).
   Data-driven: funnel[{label,value,note?}] + pills[{label,value,tone?}].
   Numerals are Chillax tabular and count up via anim.js (data-count-to).
   `anim` class + --anim-step = auto-playing entrance stagger (no clicks).
   Returns ONLY the content region. */
import { esc } from "./_shared.js";

export function campaignAnalysis(slide) {
  const funnel = slide.funnel || [];
  const n = funnel.length || 1;

  const stages = funnel.map((s, i) => {
    // Descend the width so it reads as a real converging funnel; keep the last stage legible.
    const width = 100 - (i * (56 / Math.max(1, n - 1)));
    const note = s.note ? `<span class="funnel__note">${esc(s.note)}</span>` : "";
    const isNum = typeof s.value === "number";
    const valueAttr = isNum ? ` data-count-to="${s.value}"` : "";
    const valueTxt = isNum ? "0" : esc(s.value);
    // data-fx-* → interactive.js funnel(): hover/click a stage reveals drop-off + retention.
    // All numbers stay declarative in the deck data; the engine computes the chips.
    const prev = funnel[i - 1];
    const fx = ` data-fx-stage data-fx-value="${isNum ? s.value : esc(s.value)}"`
      + (prev && typeof prev.value === "number" ? ` data-fx-prev="${prev.value}"` : "")
      + (s.tip ? ` data-fx-tip="${esc(s.tip)}"` : "");
    return `<button type="button" class="funnel__stage anim" data-step="${i}"${fx} style="--anim-step:${i + 3}; width:${width.toFixed(1)}%">
        <span class="funnel__label">${esc(s.label)}${note}</span>
        <span class="funnel__value count-up"${valueAttr}>${valueTxt}</span>
      </button>`;
  }).join("");

  // Left column: the 4 stats as a 2×2 metric-card grid (white cards, bigger Chillax
  // numerals) — fills the empty left column top→bottom (masterplan §3.2 #4). Numeric
  // values count up; the single red hot-lead card pulses once on entry (the money metric).
  const metrics = (slide.pills || []).map((p, i) => {
    const tone = p.tone === "accent" ? " metric-card--accent" : "";
    const isNum = /^-?\d[\d,]*\.?\d*$/.test(String(p.value));
    const countAttr = isNum ? ` data-count-to="${String(p.value).replace(/,/g, "")}"` : "";
    const startTxt = isNum ? "0" : esc(p.value);
    return `<div class="metric-card${tone} anim" style="--anim-step:${i + 7}">
        <span class="metric-card__value count-up"${countAttr}>${startTxt}</span>
        <span class="metric-card__label">${esc(p.label)}</span>
      </div>`;
  }).join("");

  // "Next step" callout — blue-100 bg + primary left keyline (the ONE sanctioned
  // activity-stripe use). Declarative slide.nextStep {label,detail,when?}.
  const ns = slide.nextStep;
  const nextStep = ns
    ? `<div class="analysis-next anim" style="--anim-step:11">
         <span class="analysis-next__eyebrow">${esc(ns.label || "Next step")}</span>
         <p class="analysis-next__detail">${esc(ns.detail || "")}</p>
         ${ns.when ? `<span class="analysis-next__when">${esc(ns.when)}</span>` : ""}
       </div>`
    : "";

  return `<div class="analysis">
      <div class="analysis__side">
        <div class="metric-grid">${metrics}</div>
        ${nextStep}
      </div>
      <div class="funnel" data-fx="funnel">${stages}</div>
    </div>`;
}
