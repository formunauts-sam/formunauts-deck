/* projectVisual.js — Slides 04 (hero) · 05 & 06 (single) · 08 (masonry).
   All media flows through assetFrame() → aspect-locked, contain, never squished.
   `anim` class + --anim-step = auto-playing entrance stagger (no clicks).
   Returns ONLY the content region. */
import { esc, assetFrame } from "./_shared.js";

export function projectVisual(slide, ctx) {
  switch (slide.layout) {
    case "hero":    return hero(slide, ctx);
    case "masonry": return masonry(slide, ctx);
    case "single":  return single(slide, ctx);
    default:        return single(slide, ctx);
  }
}

/* --- layout: hero (slide 04) — tall LIVE intro + planned thumbs + banner band --- */
function hero(slide, ctx) {
  const base = ctx.base;
  const h = slide.hero || {};
  const heroFrame = assetFrame(base, h.src, {
    badge: h.tag ? { text: h.tag, tone: "success" } : null,
    alt: "Reinhard ambassador intro post — live on LinkedIn",
  });

  const thumbs = (slide.thumbs || []).map((t, i) =>
    `<div class="project__thumb anim" style="--anim-step:${i + 4}">
       ${assetFrame(base, t.src, {
         badge: t.tag ? { text: t.tag, tone: "planned" } : null,
         alt: "Planned ambassador post",
       })}
     </div>`
  ).join("");

  const band = slide.band
    ? `<div class="project__band anim" style="--anim-step:8">
         ${assetFrame(base, slide.band.src, { alt: "Reinhard LinkedIn banner", caption: "Profile banner — optimised for the ambassador content" })}
       </div>`
    : "";

  return `<div class="project project--hero">
      <div class="project__hero anim" style="--anim-step:3">${heroFrame}</div>
      <div class="project__thumbs">${thumbs}</div>
      ${band}
    </div>`;
}

/* --- layout: single (slides 05 & 06) ---
   05: pivot bullets (left) + small teaser (right).
   06: single centered showcase (business cards on a surface). */
function single(slide, ctx) {
  const base = ctx.base;

  // Slide 06 — pure showcase
  if (slide.showcase) {
    return `<div class="project project--single project--showcase">
        <div class="showcase-wrap anim" style="--anim-step:3">
          ${assetFrame(base, slide.showcase.src, { alt: "Barbara business card — front and back, print-ready", floating: true })}
        </div>
      </div>`;
  }

  // Slide 05 — learning list + teaser
  const bullets = (slide.bullets || []).map((b, i) => {
    const item = typeof b === "string" ? { t: b } : b;
    const cls = ["pivot"];
    if (item.tone === "accent") cls.push("pivot--accent");
    else if (!item.arrow) cls.push("pivot--lead");
    const mark = item.arrow
      ? `<span class="pivot__mark">→</span>`
      : (item.tone === "accent" ? "" : `<span class="pivot__mark">·</span>`);
    return `<div class="${cls.join(" ")} anim" style="--anim-step:${i + 3}">
        ${mark}
        <span class="pivot__text">${esc(item.t)}</span>
      </div>`;
  }).join("");

  const teaser = slide.teaser
    ? `<div class="project__teaser anim" style="--anim-step:8">
         ${assetFrame(base, slide.teaser.src, { alt: "Barbara business card preview", caption: "Barbara's cards → next slide" })}
       </div>`
    : "";

  return `<div class="project project--single${slide.teaser ? " has-teaser" : ""}">
      <div class="pivot-list">${bullets}</div>
      ${teaser}
    </div>`;
}

/* --- layout: masonry (slide 08) — contained editorial bento ---
   Each tile is height-capped in CSS and gets its width from its OWN
   aspect-ratio class (via assetFrame), so portraits and near-squares
   coexist without any uniform grid squishing them. */
function masonry(slide, ctx) {
  const base = ctx.base;
  const tiles = (slide.gallery || []).map((file, i) =>
    `<div class="masonry__tile anim" style="--anim-step:${i + 3}">
        ${assetFrame(base, file, { alt: "Formunauts social post" })}
      </div>`
  ).join("");

  return `<div class="project project--masonry">
      <div class="masonry">${tiles}</div>
    </div>`;
}
