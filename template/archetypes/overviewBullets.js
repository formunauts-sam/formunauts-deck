/* overviewBullets.js — Slides 02 (default) & 09 (quiet, dark).
   Default: index-numeral bullets (left) + muted "also shipped" aside (right).
   Quiet:   two calm muted columns (used on dark chrome).
   `anim` class + --anim-step = auto-playing entrance stagger (no clicks).
   Returns ONLY the content region; chrome comes from render.js. */
import { esc } from "./_shared.js";

export function overviewBullets(slide) {
  if (slide.variant === "quiet") return quiet(slide);

  const bullets = (slide.bullets || []).map((b, i) => {
    const idx = String(i + 1).padStart(2, "0");
    return `<li class="bullet anim" style="--anim-step:${i + 3}">
        <span class="bullet__idx">${idx}</span>
        <span class="bullet__text">${esc(b)}</span>
      </li>`;
  }).join("");

  const asideItems = (slide.aside || []).map((a) => `<li>${esc(a)}</li>`).join("");
  const asidePanel = asideItems
    ? `<aside class="aside-panel anim" style="--anim-step:8">
         <div class="aside-panel__title">Also shipped</div>
         <ul class="aside-panel__list">${asideItems}</ul>
       </aside>`
    : "";

  return `<div class="overview">
      <ul class="bullet-list">${bullets}</ul>
      ${asidePanel}
    </div>`;
}

function quiet(slide) {
  const cols = (slide.columns || []).map((col, ci) => {
    const items = (col.items || []).map((it) => `<li>${esc(it)}</li>`).join("");
    return `<div class="quiet-col anim" style="--anim-step:${ci + 3}">
        <div class="quiet-col__title">${esc(col.title || "")}</div>
        <ul class="quiet-col__list">${items}</ul>
      </div>`;
  }).join("");

  return `<div class="overview overview--quiet">${cols}</div>`;
}
