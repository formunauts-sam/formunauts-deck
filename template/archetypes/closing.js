/* closing.js — Slide 11. Full-blue bookend of the cover.
   Rocket + rings echo the cover but sweep the OPPOSITE (top-left) corner,
   so read back-to-back they form one continuous enclosing arc.
   Returns the FULL section body. */
import { esc, orbit } from "./_shared.js";

export function closing(slide, ctx) {
  const rocket = ctx.logo("formunauts_visual_white.svg");
  const wordmark = ctx.logo("logo-type-white.png");

  return `
    <img class="rocket-mark rocket-mark--tl" src="${esc(rocket)}" alt="" aria-hidden="true">
    ${orbit("tl")}

    <h2 class="closing__statement anim" style="--anim-step:0">${esc(slide.statement || "")}</h2>
    <p class="closing__sub anim" style="--anim-step:1">${esc(slide.sub || "")}</p>

    <img class="closing__wordmark" src="${esc(wordmark)}" alt="FORMUNAUTS" height="28">
    <p class="closing__site anim" style="--anim-step:2">${esc(slide.site || "")}</p>
  `;
}
