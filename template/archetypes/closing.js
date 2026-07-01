/* closing.js — Slide 11. Full-blue bookend of the cover.
   Rocket + rings echo the cover but sweep the OPPOSITE (top-left) corner,
   so read back-to-back they form one continuous enclosing arc.
   Returns the FULL section body. */
import { esc, orbit } from "./_shared.js";

export function closing(slide, ctx) {
  const claim = ctx.logo("logo-claim-wide-white.png");   // white claim lockup on blue

  return `
    ${orbit("tl")}

    <h2 class="closing__statement anim" style="--anim-step:0">${esc(slide.statement || "")}</h2>
    <p class="closing__sub anim" style="--anim-step:1">${esc(slide.sub || "")}</p>

    <img class="closing__claim anim" style="--anim-step:2" src="${esc(claim)}"
         alt="FORMUNAUTS — Fundraising Space Navigators" width="300">
    <p class="closing__site anim" style="--anim-step:3">${esc(slide.site || "")}</p>
  `;
}
