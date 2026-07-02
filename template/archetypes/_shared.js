/* ============================================================
   _shared.js — helpers used by every archetype renderer.
   CHROME. Never edited per-demo.
   ------------------------------------------------------------
   THE image contract: no renderer ever emits a bare <img> with
   a CSS width+height. Media always goes through assetFrame(),
   which wraps it in an aspect-correct .asset-frame with
   object-fit:contain. Squishing is impossible by construction.
   ============================================================ */

/* --- HTML escaping (all data strings pass through here) --- */
export function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/* --- Filename → ratio class (§5). gallery[] needs only filenames. --- */
export const RATIO = {
  "formunauts-post-1.png": "ratio-post-portrait",
  "formunauts-post-2.png": "ratio-post-square",
  "formunauts-post-3.png": "ratio-post-portrait",
  "formunauts-post-4.png": "ratio-post-portrait",
  "formunauts-post-5.png": "ratio-post-near",
  "reinhard-intro-1.png": "ratio-amb-intro",
  "reinhard-planned-2.png": "ratio-amb-portrait",
  "reinhard-planned-3.png": "ratio-amb-portrait",
  "reinhard-planned-4.png": "ratio-amb-portrait",
  "reinhard-linkedin-banner.png": "ratio-li-banner",
  "barbara-card-proof.png": "ratio-card-proof",
  "beispiel-cover.jpg": "ratio-tablet-portrait",
  "beispiel-zitat.jpg": "ratio-tablet-portrait",
  "beispiel-boarding.jpg": "ratio-tablet-portrait",
};

/* --- Per-file intrinsic pixel dims → <img width/height> (kills CLS). --- */
/* Verified with `sips` against the real assets. */
export const PX = {
  "formunauts-post-1.png": [914, 1184],
  "formunauts-post-2.png": [914, 890],
  "formunauts-post-3.png": [914, 1192],
  "formunauts-post-4.png": [914, 1152],
  "formunauts-post-5.png": [914, 976],
  "reinhard-intro-1.png": [914, 1658],
  "reinhard-planned-2.png": [890, 1112],
  "reinhard-planned-3.png": [890, 1112],
  "reinhard-planned-4.png": [890, 1108],
  "reinhard-linkedin-banner.png": [3168, 792],
  "barbara-card-proof.png": [2198, 745],
  "beispiel-cover.jpg": [1668, 2388],
  "beispiel-zitat.jpg": [1668, 2388],
  "beispiel-boarding.jpg": [1668, 2388],
};

/* Aspect-ratio classes keyed by ratio-name so a per-tile aspect can be
   set even when a file is missing from RATIO (defensive). */
const RATIO_DIMS = {
  "ratio-post-portrait": [914, 1184],
  "ratio-post-square": [914, 890],
  "ratio-post-near": [914, 976],
  "ratio-amb-portrait": [890, 1112],
  "ratio-amb-intro": [914, 1658],
  "ratio-li-banner": [3168, 792],
  "ratio-card-proof": [2198, 745],
  "ratio-tablet-portrait": [834, 1194],
};

/* Intrinsic pixel dims for the product-ui / web captures deviceFrame consumes.
   Verified with `sips`. Long portrait captures → cover-cropped (window-card)
   or phone-framed; never squished. */
export const DEVICE_PX = {
  "dashboard.png": [1600, 3570],
  "donor-feedback.png": [1600, 2016],
  "training-center.png": [1518, 2552],
  "achievement-gallery.png": [1768, 2372],
  "individual-achievement.png": [1768, 2388],
  "photo-verification-1.png": [1200, 1800],
  "photo-verification-2.png": [1224, 1836],
  "photo-verification-3.png": [1224, 1836],
  "beispiel-cover.jpg": [1668, 2388],
  "beispiel-zitat.jpg": [1668, 2388],
  "beispiel-boarding.jpg": [1668, 2388],
};

/*
 * assetFrame — the ONLY way flat media enters the DOM.
 * @param {string} base   meta.imagesBase (e.g. "./assets/img/2026-07-01/")
 * @param {string} file   filename only (looked up in RATIO/PX)
 * @param {object} opts   { alt, badge:{text,tone}, floating, caption, ratioClass,
 *                          treatment:"duotone" }
 * Emits real width/height attributes so space is reserved; CSS height:auto
 * keeps the ratio locked, object-fit:contain guarantees no distortion.
 * treatment:"duotone" → adds .media--duotone (grayscale + multiply-blue wash)
 * for the supporting cast; reserve full-colour for money shots.
 */
export function assetFrame(base, file, opts = {}) {
  const ratioClass = opts.ratioClass || RATIO[file] || "ratio-post-portrait";
  const dims = PX[file] || RATIO_DIMS[ratioClass] || [1000, 1000];
  const [w, h] = dims;
  const floating = opts.floating ? " asset-frame--floating" : "";
  const duotone = opts.treatment === "duotone" ? " media--duotone" : "";
  const alt = esc(opts.alt || file.replace(/[-_]/g, " ").replace(/\.\w+$/, ""));
  const src = esc(base + file);

  const badge = opts.badge
    ? `<span class="asset-badge asset-badge--${esc(opts.badge.tone || "success")}">${esc(opts.badge.text)}</span>`
    : "";
  const caption = opts.caption
    ? `<figcaption class="caption">${esc(opts.caption)}</figcaption>`
    : "";

  return `<figure class="asset-frame ${ratioClass}${floating}${duotone}">
      ${badge}
      <img src="${src}" width="${w}" height="${h}" alt="${alt}" loading="lazy">
      ${caption}
    </figure>`;
}

/*
 * deviceFrame — the photo-INTEGRATION primitive (masterplan §3.1 A). Sibling to
 * assetFrame: instead of matting a contained image, it seats a screenshot inside
 * a piece of hardware/browser chrome and crops it with object-fit:cover so it
 * FILLS the frame (top-anchored) — never squished, because the frame's own
 * aspect-ratio is fixed by CSS and the image covers it.
 *
 * @param {string} base   meta.imagesBase
 * @param {string} file   filename only (looked up in DEVICE_PX for width/height)
 * @param {object} opts
 *   @prop {"phone"|"browser"|"desk"} device   frame style (default "browser")
 *   @prop {string} alt                        accessible label
 *   @prop {string} caption                    optional caption under the frame
 *   @prop {string} url                        browser: address-bar label (escaped, display-only)
 *   @prop {boolean} floating                  lift shadow (on blue/muted fields)
 *   @prop {"top"|"center"|"bottom"} crop      object-position (default "top")
 *   @prop {string} badge / {object} badge     {text,tone} corner badge (reuses .asset-badge)
 *
 * device "phone"   → .device-frame--phone  (rounded body + notch + bezel, elevation-4)
 * device "browser" → .window-card          (mac title bar w/ 3 dots + cover top-crop)
 * device "desk"    → .window-card + .window-card--desk (wider chrome; same crop contract)
 */
export function deviceFrame(base, file, opts = {}) {
  const device = opts.device === "phone" ? "phone"
    : opts.device === "desk" ? "desk" : "browser";
  const [w, h] = DEVICE_PX[file] || PX[file] || [1200, 2400];
  const alt = esc(opts.alt || file.replace(/[-_]/g, " ").replace(/\.\w+$/, ""));
  const src = esc(base + file);
  const floating = opts.floating ? " is-floating" : "";
  const crop = opts.crop === "center" ? "center" : opts.crop === "bottom" ? "bottom" : "top";

  const badgeData = typeof opts.badge === "string" ? { text: opts.badge } : opts.badge;
  const badge = badgeData
    ? `<span class="asset-badge asset-badge--${esc(badgeData.tone || "success")}">${esc(badgeData.text)}</span>`
    : "";
  const caption = opts.caption
    ? `<figcaption class="caption">${esc(opts.caption)}</figcaption>`
    : "";

  // The <img> carries real width/height (CLS guard); .device-screen owns the
  // fixed aspect box and cover-crop so nothing distorts regardless of ratio.
  const screen =
    `<div class="device-screen" data-crop="${crop}">
       <img src="${src}" width="${w}" height="${h}" alt="${alt}" loading="lazy">
     </div>`;

  if (device === "phone") {
    return `<figure class="device-frame device-frame--phone${floating}">
        ${badge}
        <span class="device-frame__notch" aria-hidden="true"></span>
        ${screen}
        ${caption}
      </figure>`;
  }

  // browser / desk → window-card with mac chrome
  const deskCls = device === "desk" ? " window-card--desk" : "";
  const urlBar = opts.url
    ? `<span class="window-card__url">${esc(opts.url)}</span>`
    : "";
  return `<figure class="device-frame window-card${deskCls}${floating}">
      ${badge}
      <div class="window-card__bar" aria-hidden="true">
        <span class="window-card__dots"><i></i><i></i><i></i></span>
        ${urlBar}
      </div>
      ${screen}
      ${caption}
    </figure>`;
}

/* --- Persistent chrome shared by content archetypes ---
   `.anim` = auto-playing entrance stagger (runs when the parent
   <section> becomes .present — NO clicks). --anim-step orders it.
   Everything is fully visible on slide entry; only the timing
   of the fade-up staggers. This is deliberately NOT reveal's
   fragment mechanism (which would hide content until arrow-press
   and risk an empty shared screen). */
export function kicker(text) {
  return text ? `<div class="kicker anim" style="--anim-step:0">${esc(text)}</div>
                 <hr class="kicker-rule">` : "";
}
export function headline(text) {
  return text ? `<h1 class="headline anim" style="--anim-step:1">${esc(text)}</h1>` : "";
}
export function lead(text) {
  return text ? `<p class="lead anim" style="--anim-step:2">${esc(text)}</p>` : "";
}

/* --- Lucide icon set (inline SVG paths; stroke-width owned by CSS). ---
   FLAGGED PLACEHOLDER per spec §0 — Lucide icons are provisional.
   Never used to substitute the rocket. */
export const ICONS = {
  database: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5"/><path d="M3 12a9 3 0 0 0 18 0"/>',
  "scan-search": '<path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><circle cx="11" cy="11" r="3"/><path d="m13.5 13.5 2 2"/>',
  sparkles: '<path d="M9.5 3 11 7.5 15.5 9 11 10.5 9.5 15 8 10.5 3.5 9 8 7.5 9.5 3Z"/><path d="M18 3.5 18.8 6 21 6.8 18.8 7.6 18 10 17.2 7.6 15 6.8 17.2 6 18 3.5Z"/><path d="M18 15.5 18.6 17.4 20.5 18 18.6 18.6 18 20.5 17.4 18.6 15.5 18 17.4 17.4 18 15.5Z"/>',
  camera: '<path d="M14.5 4h-5L8 6H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-4l-1.5-2Z"/><circle cx="12" cy="13" r="3.5"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18Z"/>',
  "git-branch": '<line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/>',
};
export function icon(name) {
  const path = ICONS[name] || ICONS.sparkles;
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${path}</svg>`;
}

/* Rightward arrow used between process steps */
export function arrowRight() {
  return `<svg viewBox="0 0 40 20" aria-hidden="true"><path d="M2 10h34"/><path d="M30 4l6 6-6 6"/></svg>`;
}

/* --- Decorative rocket + drawn orbital rings (cover/closing) --- */
export function orbit(corner /* "br" | "tl" */) {
  return `<svg class="orbit orbit--${corner}" viewBox="0 0 760 760" aria-hidden="true">
      <circle class="ring-1" cx="380" cy="380" r="300"/>
      <circle class="ring-2" cx="380" cy="380" r="230"/>
      <circle class="ring-dot" cx="620" cy="300" r="4"/>
    </svg>`;
}
