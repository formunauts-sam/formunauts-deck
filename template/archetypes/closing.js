/* closing.js — Slide 11. Full-blue bookend of the cover.
   The ring echoes the cover but sweeps the OPPOSITE (top-left)
   corner, larger and lower — so read back-to-back they form one
   continuous enclosing arc, and the cover↔closing auto-animate
   morph (matched via data-id="bookend-*") reads as the same orbit
   traveling across the deck. The rocket has LANDED: small, upright,
   settled above the site line. Returns the FULL section body. */
import { esc } from "./_shared.js";
import { bookendOrbit } from "../anim.js";

export function closing(slide, ctx) {
  const claim = ctx.logo("logo-claim-wide-white.png");   // white claim lockup on blue
  const rocket = ctx.logo("formunauts_visual_white.svg");

  return `
    ${bookendOrbit("tl")}
    <div class="rocket-mark rocket-mark--landed" data-id="bookend-rocket">
      <img class="rocket-mark__img" src="${esc(rocket)}" alt="" aria-hidden="true">
    </div>

    <h2 class="closing__statement anim" style="--anim-step:0">${esc(slide.statement || "")}</h2>
    <p class="closing__sub anim" style="--anim-step:1">${esc(slide.sub || "")}</p>

    <!-- NO .anim here: reveal implicitly pairs this img with the cover's claim
         (same src) and measures its morph destination BEFORE .anim plays — an
         opacity-0 base would get pinned as "opacity:0 !important" for the whole
         running state. Static like the cover's claim; the pair morphs instead. -->
    <img class="closing__claim" src="${esc(claim)}"
         alt="FORMUNAUTS — Fundraising Space Navigators" width="300">
    <p class="closing__site anim" style="--anim-step:2">${esc(slide.site || "")}</p>
  `;
}
