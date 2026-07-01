/* nextSteps.js — Slide 10. Two columns: active (blue) vs ongoing (muted).
   Mirrors slide 02's language so the deck bookends recap → next.
   Data-driven: columns[{title,tone,items[]}].
   `anim` class + --anim-step = auto-playing entrance stagger (no clicks).
   Returns ONLY content region. */
import { esc } from "./_shared.js";

export function nextSteps(slide) {
  const cols = (slide.columns || []).map((col, ci) => {
    const tone = col.tone === "muted" ? "ns-col--muted" : "ns-col--active";
    const items = (col.items || []).map((it) => `<li>${esc(it)}</li>`).join("");
    return `<div class="ns-col ${tone} anim" style="--anim-step:${ci + 3}">
        <div class="ns-col__head">
          <span class="ns-col__dot"></span>
          <span class="ns-col__title">${esc(col.title || "")}</span>
        </div>
        <ul class="ns-col__list">${items}</ul>
      </div>`;
  }).join("");

  return `<div class="nextsteps">${cols}</div>`;
}
