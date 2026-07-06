/* timeline.js — a spine that self-draws end to end, milestone nodes fading up
   in sequence as the spine passes them. The recap/roadmap archetype: a run of
   dated milestones, each with a state (done | active | next).

   The spine is an inline SVG line drawn with stroke-dashoffset (like the
   bookend ring in anim.js/deck.css) — pathLength=100 normalizes it so ONE
   keyframe sweeps the whole track regardless of orientation. Nodes ride the
   §6 .anim fade-up, their --anim-step staggered so they appear to light up
   behind the advancing draw. Everything resolves to its final composed state
   under print/peek/reduced-motion (guards in deck.css).

   Orientation: slide.orientation "vertical" | "horizontal" (default horizontal).
   Data-driven: milestones[{when,title,note?,state?}].
   `anim` class + --anim-step = auto-playing entrance stagger (no clicks).
   Returns ONLY the content region (shared chrome wraps it in render.js). */
import { esc } from "./_shared.js";

const STATES = new Set(["done", "active", "next"]);

function node(m, i) {
  const it = m || {};
  const state = STATES.has(it.state) ? it.state : "next";
  const when = it.when ? `<span class="timeline__when">${esc(it.when)}</span>` : "";
  const note = it.note ? `<span class="timeline__note">${esc(it.note)}</span>` : "";
  // nodes trail the spine draw: base step 3 + index keeps them rippling in order.
  return `<li class="timeline__node timeline__node--${state} anim" style="--anim-step:${i + 3}">
      <span class="timeline__dot" aria-hidden="true"></span>
      <span class="timeline__card">
        ${when}
        <span class="timeline__title">${esc(it.title || "")}</span>
        ${note}
      </span>
    </li>`;
}

export function timeline(slide) {
  const milestones = Array.isArray(slide.milestones) ? slide.milestones : [];
  const vertical = slide.orientation === "vertical";
  const orient = vertical ? "timeline--vertical" : "timeline--horizontal";

  const nodes = milestones.map((m, i) => node(m, i)).join("");

  // The spine: a single normalized line the CSS draws via stroke-dashoffset.
  // Horizontal runs L→R across the middle band; vertical runs top→bottom the
  // left rail. Two coordinate sets, one pathLength contract.
  const spine = vertical
    ? `<line x1="1" y1="0" x2="1" y2="100" pathLength="100"/>`
    : `<line x1="0" y1="1" x2="100" y2="1" pathLength="100"/>`;
  const spineView = vertical ? "0 0 2 100" : "0 0 100 2";

  return `<div class="timeline ${orient}">
      <svg class="timeline__spine" viewBox="${spineView}" preserveAspectRatio="none" aria-hidden="true">
        ${spine}
      </svg>
      <ol class="timeline__track">${nodes}</ol>
    </div>`;
}
