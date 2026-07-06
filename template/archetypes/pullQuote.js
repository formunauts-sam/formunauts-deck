/* pullQuote.js — an oversized editorial quote (Chillax display), stroke-drawn
   quotation marks, word-groups fading up in sequence. The testimonial / big-
   statement archetype: a fundraiser, a donor, or a partner voice, given the
   whole stage.

   The opening quote mark is an inline SVG glyph drawn with stroke-dashoffset
   (like the bookend ring) so it "writes itself" on entry. The quote body is
   split into word-groups (clauses) that ride the §6 .anim fade-up staggered
   so the sentence lands phrase by phrase. Optional attribution (cite + role).
   Optional portrait routes through deviceFrame (device:"phone") or assetFrame
   and is revealed with a clip-path wipe (compositor-safe).

   Everything resolves to its final composed state under print/peek/reduced-
   motion (guards in deck.css). Media NEVER a bare <img> — always framed.
   `anim` class + --anim-step = auto-playing entrance stagger (no clicks).
   Returns ONLY the content region (shared chrome wraps it in render.js). */
import { esc, assetFrame, deviceFrame } from "./_shared.js";

/* Split the quote into clause-sized word-groups so the sentence lands in
   readable beats (not word-by-word jitter, not one dump). Break on sentence
   punctuation and commas; keep the delimiter attached. Each group fades up on
   its own --anim-step. Falls back to the whole string as one group. */
function wordGroups(quote) {
  const parts = String(quote).match(/[^,;.!?]+[,;.!?]*\s*/g);
  const groups = (parts || [String(quote)])
    .map((s) => s.trim())
    .filter(Boolean);
  return groups.length ? groups : [String(quote)];
}

/* Optional portrait — phone frame by default (a person reads well tall);
   assetFrame when the author asks for a matted still. Wrapped in a wipe box
   whose clip-path reveal is driven in deck.css. */
function portrait(p, base) {
  if (!p || !p.file) return "";
  const isDevice = p.kind !== "asset";
  const frame = isDevice
    ? deviceFrame(base, p.file, {
        device: p.device || "phone",
        crop: p.crop || "center",
        floating: true,
        alt: p.alt || "Portrait",
      })
    : assetFrame(base, p.file, {
        ratioClass: p.ratioClass,
        floating: true,
        alt: p.alt || "Portrait",
      });
  return `<div class="pquote__portrait anim" style="--anim-step:2">
      <span class="pquote__wipe">${frame}</span>
    </div>`;
}

export function pullQuote(slide, ctx) {
  const base = (ctx && ctx.base) || "./assets/img/";
  const groups = wordGroups(slide.quote || "");

  // word-groups start at step 2 and ripple; the mark draws first (CSS, no step).
  const body = groups.map((g, i) =>
    `<span class="pquote__group anim" style="--anim-step:${i + 2}">${esc(g)} </span>`
  ).join("");

  const cite = slide.cite
    ? `<span class="pquote__cite">${esc(slide.cite)}</span>`
    : "";
  const role = slide.role
    ? `<span class="pquote__role">${esc(slide.role)}</span>`
    : "";
  const attribution = (slide.cite || slide.role)
    ? `<figcaption class="pquote__attr anim" style="--anim-step:${groups.length + 3}">
         <span class="pquote__attr-rule" aria-hidden="true"></span>
         <span class="pquote__attr-body">${cite}${role}</span>
       </figcaption>`
    : "";

  const pic = portrait(slide.portrait, base);
  const hasPortrait = pic ? " pquote--portrait" : "";

  // The opening quotation glyph — stroke-drawn on entry (pathLength normalized).
  const mark = `<svg class="pquote__mark" viewBox="0 0 100 80" aria-hidden="true">
      <path pathLength="100" d="M42 8 C22 8 10 24 10 46 C10 64 22 74 34 74 C46 74 54 66 54 54 C54 42 46 34 34 34 C30 34 26 35 24 37 C26 20 34 12 46 10 Z
                               M90 8 C70 8 58 24 58 46 C58 64 70 74 82 74 C94 74 100 66 100 54 C100 42 94 34 82 34 C78 34 74 35 72 37 C74 20 82 12 94 10 Z"/>
    </svg>`;

  return `<figure class="pquote${hasPortrait}">
      <div class="pquote__col">
        ${mark}
        <blockquote class="pquote__body">${body}</blockquote>
        ${attribution}
      </div>
      ${pic}
    </figure>`;
}
