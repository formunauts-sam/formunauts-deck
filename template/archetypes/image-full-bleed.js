/* image-full-bleed.js — an edge-to-edge photo that owns the whole section feel.
   The image flows through assetFrame() with the sanctioned .asset-frame--cover
   crop (object-fit:cover, never squished — the frame's own aspect is fixed by
   the section and the image covers it). A clip-path WIPE reveals the photo on
   entry; a bottom scrim carries an optional eyebrow / headline / caption over
   the image. Because this archetype is dramatic it renders its OWN eyebrow +
   headline inside the scrim (shared chrome sits above but stays subordinate;
   author leaves eyebrow/headline empty and uses `caption`/`credit`, OR sets
   chrome:"muted"/"blue" and lets the scrim titles carry it). Returns ONLY the
   content region. Unique CSS prefix: .fullbleed__.

   DECK DATA SHAPE:
   { archetype:"image-full-bleed",
     src,                                    // required filename (registered in PX/DEVICE_PX)
     eyebrow?, title?,                       // over-scrim titles (distinct from shared chrome)
     caption?, credit?,                      // caption line + small credit
     focal? }                                // "top"|"center"|"bottom" cover anchor (default center)
   ------------------------------------------------------------ */
import { esc, assetFrame } from "./_shared.js";

const FOCAL = new Set(["top", "center", "bottom"]);

export function imageFullBleed(slide, ctx) {
  const base = (ctx && ctx.base) || "./assets/img/";
  if (!slide || !slide.src) {
    // graceful empty state — never crash the deck on a missing photo
    return `<div class="fullbleed fullbleed--empty"></div>`;
  }
  const focal = FOCAL.has(slide.focal) ? slide.focal : "center";

  // Sanctioned cover crop; the wipe clip lives on the wrapper, not the img,
  // so object-fit still governs and nothing distorts.
  const frame = assetFrame(base, slide.src, {
    alt: slide.alt || slide.title || "Full-bleed photograph",
    ratioClass: "ratio-fullbleed",
  });

  const eyebrow = slide.eyebrow
    ? `<span class="fullbleed__eyebrow anim" style="--anim-step:4">${esc(slide.eyebrow)}</span>`
    : "";
  const title = slide.title
    ? `<h2 class="fullbleed__title anim" style="--anim-step:5">${esc(slide.title)}</h2>`
    : "";
  const caption = slide.caption
    ? `<p class="fullbleed__caption anim" style="--anim-step:6">${esc(slide.caption)}</p>`
    : "";
  const credit = slide.credit
    ? `<span class="fullbleed__credit">${esc(slide.credit)}</span>`
    : "";

  const scrim = (eyebrow || title || caption || credit)
    ? `<figcaption class="fullbleed__scrim">
         ${eyebrow}${title}${caption}${credit}
       </figcaption>`
    : "";

  return `<figure class="fullbleed" data-focal="${focal}">
      <div class="fullbleed__media">${frame}</div>
      ${scrim}
    </figure>`;
}
