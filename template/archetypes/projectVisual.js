/* projectVisual.js — Slides 04 (hero) · 05 & 06 (single) · 08 (masonry).
   All media flows through assetFrame()/deviceFrame() → aspect-locked, never squished.
   `anim` class + --anim-step = auto-playing entrance stagger (no clicks).
   Returns ONLY the content region. */
import { esc, assetFrame, deviceFrame } from "./_shared.js";

export function projectVisual(slide, ctx) {
  switch (slide.layout) {
    case "hero":    return hero(slide, ctx);
    case "masonry": return masonry(slide, ctx);
    case "single":  return single(slide, ctx);
    default:        return single(slide, ctx);
  }
}

/* --- layout: hero (slide 04) — the flagship, filled top→bottom (masterplan §3.2 #2).
   Left rail: the LIVE post seated in a .device-frame--phone (finally a reason for
   the tall 0.55 ratio). Right column fills with THREE stacked rows:
     1) planned thumbs (PLANNED ghost treatment so the LIVE hero pops — semantic state)
     2) a metrics strip (Chillax stat pills, count-up)
     3) the profile banner as a true full-width cover strip.
   A cadence chip pulses once on entry; a hairline connector links the LIVE badge to
   the first PLANNED thumb — "a series, not a one-off." Static composition, not the
   focal-carousel (which failed on the tall portrait). */
function hero(slide, ctx) {
  const base = ctx.base;
  const h = slide.hero || {};

  // LIVE post inside a phone — object-fit:cover top-crop (aspect-locked, never squished).
  const heroFrame = deviceFrame(base, h.src, {
    device: "phone",
    crop: "top",
    floating: true,
    badge: h.tag ? { text: h.tag, tone: "success" } : null,
    alt: "Reinhard ambassador intro post — live on LinkedIn",
  });

  const thumbs = (slide.thumbs || []).map((t, i) =>
    `<div class="amb-thumb amb-thumb--planned anim" style="--anim-step:${i + 5}">
       ${assetFrame(base, t.src, {
         badge: t.tag ? { text: t.tag, tone: "planned" } : null,
         alt: "Planned ambassador post",
       })}
     </div>`
  ).join("");

  // metrics strip — declarative stats[{value,label,unit?,tone?}]; numeric → count-up.
  const metrics = (slide.metrics || []).map((m, i) => {
    const isNum = /^-?\d[\d,]*\.?\d*$/.test(String(m.value));
    const countAttr = isNum ? ` data-count-to="${String(m.value).replace(/,/g, "")}"` : "";
    const startTxt = isNum ? "0" : esc(m.value);
    const tone = m.tone === "accent" ? " amb-metric--accent" : "";
    return `<div class="amb-metric${tone} anim" style="--anim-step:${i + 8}">
        <span class="amb-metric__value count-up"${countAttr}>${startTxt}</span>${
          m.unit ? `<span class="amb-metric__unit">${esc(m.unit)}</span>` : ""
        }
        <span class="amb-metric__label">${esc(m.label)}</span>
      </div>`;
  }).join("");
  const metricStrip = metrics
    ? `<div class="amb-metrics">${metrics}</div>`
    : "";

  const band = slide.band
    ? `<div class="amb-band anim" style="--anim-step:11">
         ${assetFrame(base, slide.band.src, { alt: "Reinhard LinkedIn profile banner — optimised for the ambassador content" })}
       </div>`
    : "";

  const cadence = slide.cadence
    ? `<span class="amb-cadence anim" style="--anim-step:4">
         <span class="amb-cadence__pulse" aria-hidden="true"></span>${esc(slide.cadence)}
       </span>`
    : "";

  return `<div class="project project--amb">
      <div class="amb-live anim" style="--anim-step:3">
        ${heroFrame}
        <span class="amb-connector" aria-hidden="true"></span>
      </div>
      <div class="amb-side">
        <div class="amb-side__head">
          <span class="amb-side__label">Prepared & scheduled</span>
          ${cadence}
        </div>
        <div class="amb-thumbs">${thumbs}</div>
        ${metricStrip}
        ${band}
      </div>
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

/* --- layout: masonry (slide 08) — a TRUE content-wall bento (masterplan §3.2 #3).
   ONE feature post spans a tall column (cover-crop — sanctioned money shot); the
   supporting posts fill a 2×2 cluster (contain, so portraits/squares coexist);
   the final cell is a "+N more this quarter" ghost tile that turns the wall into
   a drumbeat and fills the last grid slot. Each post carries a small channel badge
   (IG/LinkedIn glyph in brand blue) so it reads as a live feed. Fills .content
   edge-to-edge — no centered shy row, no side-gap. */
const CHANNEL_GLYPH = {
  instagram: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" stroke="none"/>',
  linkedin: '<path d="M4.5 3.8A1.7 1.7 0 1 0 4.5 7.2 1.7 1.7 0 0 0 4.5 3.8Z"/><path d="M3.1 9h2.8v11H3.1zM8.5 9h2.7v1.5h.04c.4-.7 1.4-1.5 2.9-1.5 3 0 3.6 1.9 3.6 4.5V20h-2.8v-4.9c0-1.2 0-2.7-1.7-2.7s-1.9 1.3-1.9 2.6V20H8.5z" fill="currentColor" stroke="none"/>',
};
function channelBadge(kind) {
  const glyph = CHANNEL_GLYPH[kind];
  if (!glyph) return "";
  return `<span class="wall-tile__channel" aria-hidden="true">
      <svg viewBox="0 0 24 24">${glyph}</svg>
    </span>`;
}
function wallTile(item, i, base) {
  const it = typeof item === "string" ? { src: item } : (item || {});
  if (!it.src) return "";
  const feature = it.feature === true;
  const cls = ["wall-tile", "anim", feature ? "wall-tile--feature" : ""].filter(Boolean).join(" ");
  const frame = feature
    // feature = sanctioned cover crop, filling the tall column
    ? deviceFrame(base, it.src, {
        device: "browser",
        url: it.url || "instagram.com/formunauts",
        crop: "top",
        floating: true,
        alt: it.alt || "Featured Formunauts social post",
      })
    // supporting = contain (its own aspect wins), framed
    : assetFrame(base, it.src, { alt: it.alt || "Formunauts social post" });
  return `<div class="${cls}" style="--anim-step:${i + 3}">
      ${channelBadge(it.channel)}
      ${frame}
    </div>`;
}
function masonry(slide, ctx) {
  const base = ctx.base;
  const tiles = (slide.gallery || []).map((item, i) => wallTile(item, i, base)).join("");

  const more = slide.more
    ? `<div class="wall-tile wall-tile--more anim" style="--anim-step:${(slide.gallery || []).length + 3}">
         <span class="wall-more__value">${esc(slide.more.value || "40+")}</span>
         <span class="wall-more__label">${esc(slide.more.label || "more this quarter")}</span>
       </div>`
    : "";

  return `<div class="project project--wall">
      <div class="content-wall">${tiles}${more}</div>
    </div>`;
}
