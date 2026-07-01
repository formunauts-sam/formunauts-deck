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
    return `<div class="funnel__stage anim" data-step="${i}" style="--anim-step:${i + 3}; width:${width.toFixed(1)}%">
        <span class="funnel__label">${esc(s.label)}${note}</span>
        <span class="funnel__value count-up"${valueAttr}>${valueTxt}</span>
      </div>`;
  }).join("");

  const pills = (slide.pills || []).map((p, i) => {
    const tone = p.tone === "accent" ? " pill--accent" : "";
    return `<span class="pill${tone} anim" style="--anim-step:${i + 8}">
        <span class="pill__value">${esc(p.value)}</span>
        <span class="pill__label">${esc(p.label)}</span>
      </span>`;
  }).join("");

  return `<div class="analysis">
      <div class="analysis__side">
        <p class="analysis__caption anim" style="--anim-step:7">Charities engaged this cycle. The blue ramp shows conversion at each step; hot leads flagged in red.</p>
        <div class="pills">${pills}</div>
      </div>
      <div class="funnel">${stages}</div>
    </div>`;
}
