/* logo-wall.js — a partner / charity logo grid.
   Every mark flows through assetFrame() (object-fit:contain) so wordmarks,
   squares and lockups of different aspect ratios coexist without squishing.
   The grid stagger-settles on entry (--anim-step ripple, no clicks); hovering
   any tile SPOTLIGHTS it by dimming the rest (CSS :hover on the wall, opacity
   only — compositor-safe). Returns ONLY the content region (shared chrome
   wraps it in render.js). Unique CSS prefix: .logowall__ / .logowall-tile.

   DECK DATA SHAPE:
   { archetype:"logo-wall",
     lead?,                                  // handled by shared chrome
     logos:[{ src, alt?, url? }] }           // url is a display-only caption label
   ------------------------------------------------------------ */
import { esc, assetFrame } from "./_shared.js";

/* One logo → a white card seating the contained mark. A per-tile aspect frame
   keeps mixed shapes tidy; the ghost mat reads as a deliberate cool surface. */
function logoTile(item, i, base) {
  const it = typeof item === "string" ? { src: item } : (item || {});
  if (!it.src) return ""; // skip malformed entries, never crash the wall
  const alt = it.alt || it.src.replace(/[-_]/g, " ").replace(/\.\w+$/, "");
  const label = it.url
    ? `<span class="logowall-tile__label">${esc(it.url)}</span>`
    : "";
  return `<figure class="logowall-tile anim" style="--anim-step:${i + 3}">
      ${assetFrame(base, it.src, { alt, ratioClass: "ratio-logo-cell" })}
      ${label}
    </figure>`;
}

export function logoWall(slide, ctx) {
  const base = (ctx && ctx.base) || "./assets/img/";
  const logos = Array.isArray(slide.logos) ? slide.logos : [];
  const tiles = logos.map((item, i) => logoTile(item, i, base)).join("");

  // data-count feeds a subtle balance hint; the grid auto-fills so 4..12 marks
  // all fill the band edge-to-edge without a lonely trailing row.
  return `<div class="logowall" data-count="${logos.length}">
      <div class="logowall__grid">${tiles}</div>
    </div>`;
}
