/* cover.js — Slide 01. Full-blue field, rocket + self-drawing rings.
   Returns the FULL section body (cover owns its own layout).
   Ring + rocket carry data-id="bookend-*" so reveal's auto-animate
   morphs them into the closing bookend (render.js pairs both
   sections via data-auto-animate-id="bookend"). The rocket's tilt
   lives on the INNER img — auto-animate writes an inline transform
   on the matched wrapper and would clobber a root-level pose. */
import { esc } from "./_shared.js";
import { bookendOrbit } from "../anim.js";

export function cover(slide, ctx) {
  const claim = ctx.logo("logo-claim-wide-white.png");
  const rocket = ctx.logo("formunauts_visual_white.svg");

  return `
    <img class="cover__claim" src="${esc(claim)}" alt="FORMUNAUTS" height="44">
    <div class="rocket-mark rocket-mark--tr" data-id="bookend-rocket">
      <img class="rocket-mark__img" src="${esc(rocket)}" alt="" aria-hidden="true">
    </div>
    ${bookendOrbit("br")}

    <div class="cover__eyebrow anim" style="--anim-step:0">${esc(slide.eyebrow || "")}</div>
    <h1 class="cover__headline anim" style="--anim-step:1">${esc(slide.headline || "")}</h1>
    <hr class="cover__rule anim" style="--anim-step:2">
    <p class="cover__sub anim" style="--anim-step:3">${esc(slide.sub || "")}</p>
  `;
}
