/* nextSteps.js — Slide 10. Two HORIZONTAL timeline lanes (masterplan §3.2 #6):
   "Web · campaigns · content" = active lane (blue, forward); "Data · ops" = ongoing
   lane (subtle, dashed). Each lane is a full-width track running near-term → Q3, its
   items rendered as nodes so the slide fills L-to-R and top-to-bottom. A thin red
   "today" marker anchors the left edge (the one sanctioned stopper). Mirrors slide 02's
   language so the deck bookends recap → next.
   Data-driven: columns[{title,tone,items[]}]. Each item may be a string or
   {t, icon?, when?} — icon renders a small Lucide chip, `when` a datestamp tag.
   `anim` class + --anim-step = auto-playing entrance stagger (no clicks).
   Returns ONLY content region. */
import { esc, icon, ICONS } from "./_shared.js";

function laneNode(item, i, laneStep) {
  const it = typeof item === "string" ? { t: item } : (item || {});
  if (!it.t) return "";
  const glyph = it.icon && ICONS[it.icon]
    ? `<span class="ns-node__icon" aria-hidden="true">${icon(it.icon)}</span>`
    : "";
  const when = it.when ? `<span class="ns-node__when">${esc(it.when)}</span>` : "";
  return `<li class="ns-node anim" style="--anim-step:${laneStep + i}">
      <span class="ns-node__dot" aria-hidden="true"></span>
      <span class="ns-node__body">
        ${glyph}<span class="ns-node__text">${esc(it.t)}</span>${when}
      </span>
    </li>`;
}

export function nextSteps(slide) {
  const lanes = (slide.columns || []).map((col, ci) => {
    const tone = col.tone === "muted" ? "ns-lane--ongoing" : "ns-lane--active";
    // stagger: lane header first, then its nodes ripple L→R
    const headStep = ci === 0 ? 3 : 8;
    const nodes = (col.items || []).map((it, i) => laneNode(it, i, headStep + 1)).join("");
    return `<div class="ns-lane ${tone}">
        <div class="ns-lane__head anim" style="--anim-step:${headStep}">
          <span class="ns-lane__dot"></span>
          <span class="ns-lane__title">${esc(col.title || "")}</span>
        </div>
        <div class="ns-lane__track">
          <span class="ns-lane__rail" aria-hidden="true"></span>
          <ol class="ns-lane__nodes">${nodes}</ol>
        </div>
      </div>`;
  }).join("");

  return `<div class="nextsteps nextsteps--timeline">
      <span class="ns-today" aria-hidden="true"><span class="ns-today__label">today</span></span>
      ${lanes}
    </div>`;
}
