/* statusBoard.js — Slide 09. Internal workstreams as a state board on dark.
   Adds a status signal (done / active / next) the recap slide didn't carry.
   `anim` class + --anim-step = auto-playing entrance stagger (no clicks). */
import { esc } from "./_shared.js";

const STATES = { done: "done", active: "active", next: "next" };

export function statusBoard(slide) {
  const groups = (slide.groups || []).map((g, gi) => {
    const rows = (g.items || []).map((it) => {
      const state = STATES[it.state] || "active";
      return `<li class="sb-row sb-row--${state}">
          <span class="sb-dot"></span>
          <span class="sb-label">${esc(it.t)}</span>
          <span class="sb-state">${esc(it.state || "")}</span>
        </li>`;
    }).join("");
    return `<div class="sb-col anim" style="--anim-step:${gi + 3}">
        <h3 class="sb-col__title">${esc(g.title)}</h3>
        <ul class="sb-col__list">${rows}</ul>
      </div>`;
  }).join("");

  return `<div class="statusboard">${groups}</div>`;
}
