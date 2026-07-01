/* cover.js — Slide 01. Full-blue field, rocket + drawn rings.
   Returns the FULL section body (cover owns its own layout). */
import { esc, orbit } from "./_shared.js";

export function cover(slide, ctx) {
  const claim = ctx.logo("logo-claim-wide-white.png");
  const rocket = ctx.logo("formunauts_visual_white.svg");

  return `
    <img class="cover__claim" src="${esc(claim)}" alt="FORMUNAUTS" height="44">
    <img class="rocket-mark rocket-mark--tr" src="${esc(rocket)}" alt="" aria-hidden="true">
    ${orbit("br")}

    <div class="cover__eyebrow anim" style="--anim-step:0">${esc(slide.eyebrow || "")}</div>
    <h1 class="cover__headline anim" style="--anim-step:1">${esc(slide.headline || "")}</h1>
    <hr class="cover__rule anim" style="--anim-step:2">
    <p class="cover__sub anim" style="--anim-step:3">${esc(slide.sub || "")}</p>
  `;
}
