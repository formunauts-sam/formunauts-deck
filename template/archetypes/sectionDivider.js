/* sectionDivider.js — a full-bleed BLUE interstitial that opens a section.
   The talk crosses from the agenda into a chapter: a giant ghost section
   number fills the field, the title lands as the headline, an orbital ring
   re-draws to signal "new territory."

   MORPH CONTRACT: the title headline carries data-id="agenda-<number>" so
   reveal's auto-animate pairs it with the matching agenda line (same
   data-id) — the agenda row FLIPs across the slide gap into this headline.
   render.js must place this archetype in the FULL_BLEED set and pair it
   with the agenda via data-auto-animate; but the divider is also fully
   renderable standalone (the data-id is inert without a partner slide).

   This archetype owns its whole section body (like cover/closing) — it does
   NOT receive the shared kicker/headline/lead chrome. chromeDefault: blue.
   `anim` class + --anim-step = auto-playing entrance stagger (no clicks).
   The ring re-draw reuses the §4 bookend stroke-dashoffset mechanism via a
   local .secdiv__ring class (guarded for print/peek/reduced-motion in CSS). */
import { esc } from "./_shared.js";

export function sectionDivider(slide) {
  // number drives BOTH the ghost numeral and the morph pairing id.
  const number = slide.number != null ? String(slide.number) : "";
  const ghost = number ? number.padStart(2, "0") : "";
  const morphId = number ? ` data-id="agenda-${esc(number)}"` : "";

  const kicker = number
    ? `<span class="secdiv__index anim" style="--anim-step:0">Section ${esc(number)}</span>`
    : "";
  const sub = slide.sub
    ? `<p class="secdiv__sub anim" style="--anim-step:2">${esc(slide.sub)}</p>`
    : "";

  return `
    ${ghost ? `<div class="secdiv__ghost" aria-hidden="true">${esc(ghost)}</div>` : ""}

    <svg class="secdiv__ring" viewBox="0 0 760 760" aria-hidden="true">
      <circle class="secdiv__ring-1" cx="380" cy="380" r="300" pathLength="100"/>
      <circle class="secdiv__ring-2" cx="380" cy="380" r="230" pathLength="100"/>
      <circle class="secdiv__ring-dot" cx="620" cy="300" r="4"/>
    </svg>

    <div class="secdiv">
      ${kicker}
      <h2 class="secdiv__title anim" style="--anim-step:1"${morphId}>${esc(slide.title || "")}</h2>
      ${sub}
    </div>
  `;
}
