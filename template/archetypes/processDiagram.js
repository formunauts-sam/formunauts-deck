/* processDiagram.js — Slide 07. Drawn 3-step process (design-system cards).
   Data-driven: steps[{n,label,icon}] + footnote. Arrows use the blue accent.
   `anim` class + --anim-step = auto-playing entrance stagger (no clicks).
   Returns ONLY the content region. */
import { esc, icon, arrowRight } from "./_shared.js";

export function processDiagram(slide) {
  const steps = slide.steps || [];
  const parts = [];

  steps.forEach((s, i) => {
    parts.push(`<div class="proc-card anim" style="--anim-step:${i * 2 + 3}">
        <span class="proc-card__n">${esc(String(s.n ?? i + 1))}</span>
        <span class="proc-card__icon">${icon(s.icon)}</span>
        <span class="proc-card__label">${esc(s.label)}</span>
        ${s.sub ? `<span class="proc-card__sub">${esc(s.sub)}</span>` : ""}
      </div>`);
    if (i < steps.length - 1) {
      parts.push(`<div class="proc-arrow anim" style="--anim-step:${i * 2 + 4}">${arrowRight()}</div>`);
    }
  });

  const footnote = slide.footnote
    ? `<p class="process__footnote anim" style="--anim-step:9">${esc(slide.footnote)}</p>`
    : "";

  return `<div class="process">${parts.join("")}</div>${footnote}`;
}
