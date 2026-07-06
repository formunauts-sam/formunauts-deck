/* poll.js — the ENGAGE-NATIVE poll slide (Wave 4).
   An interaction archetype: the deck slide poses a question and its options
   on-brand, and when the audience votes (over the Engage Transport) the same
   slide fills each option's result bar. Reaching this slide auto-opens the
   poll to viewers (collab/hud host wiring); the presenter can close/reveal.

   Data shape (schema-checked): { archetype:"poll", question, options:[{id,label}] }.
   `question` is the poll prompt; each option needs an `id` (stable, ASCII, used
   as the vote token the authority tallies) and a `label` (what viewers read).

   The renderer is PURE fn(slide, ctx) -> string like every archetype: it draws
   the STATIC on-brand board (question + options as a numbered list, each with a
   scaleX result track sitting at 0). Live vote counts are painted in by the deck
   host (collab.js / hud.js) via data hooks, NOT by this renderer, so the file
   stays declarative and motion stays the chrome's job:
     · [data-poll-id]         on the root, so the host finds this slide's board
     · [data-poll-option]     on each row, valued with the option id
     · .poll-opt__fill        the scaleX(0..1) result track (brand blue)
     · .poll-opt__pct         the live percentage (Chillax tabular numerals)
     · .poll-opt__count       the live vote count
   Entrance is the standard .anim + --anim-step stagger; the fill only animates
   when the host sets its transform. One red stopper max: the LEADING option gets
   a subtle accent when the host marks it .is-lead (never more than one).
   Returns ONLY the content region (shared chrome wraps it in render.js). */
import { esc } from "./_shared.js";

/* Small ASCII guard for option ids — the id becomes the vote token on the wire,
   so it must be stable and safe. Falls back to the row index when missing. */
function optionId(opt, i) {
  const raw = opt && typeof opt.id === "string" ? opt.id.trim() : "";
  return /^[0-9A-Za-z._-]+$/.test(raw) ? raw : "opt-" + i;
}

export function poll(slide) {
  const question = slide.question || slide.headline || "";
  const options = Array.isArray(slide.options) ? slide.options : [];

  // Each option is a static row: index chip, label, and an empty result track
  // the host fills (scaleX) once votes arrive. Numbers start at zero so the
  // slide reads correctly before any vote and in print/peek/reduced-motion.
  const rows = options
    .map((opt, i) => {
      const id = optionId(opt, i);
      const label = esc((opt && opt.label) || "");
      const n = String(i + 1);
      return `<li class="poll-opt anim" data-poll-option="${esc(id)}" style="--anim-step:${i + 3}">
          <span class="poll-opt__index" aria-hidden="true">${n}</span>
          <span class="poll-opt__fill" aria-hidden="true"></span>
          <span class="poll-opt__row">
            <span class="poll-opt__label">${label}</span>
            <span class="poll-opt__meta">
              <span class="poll-opt__count">0</span>
              <span class="poll-opt__pct">0%</span>
            </span>
          </span>
        </li>`;
    })
    .join("");

  // A live/closed status chip + a "votes so far" line the host keeps in sync.
  // Both render in a calm default state so the static slide is complete.
  const q = esc(question);

  return `<div class="poll-board" data-fx="poll" data-poll-id="${esc(slide.id || "")}">
      <div class="poll-board__head anim" style="--anim-step:2">
        <span class="poll-board__status" data-poll-status>Waiting for votes</span>
        <span class="poll-board__total"><b class="poll-board__totaln" data-poll-total>0</b> votes</span>
      </div>
      ${q ? `<p class="poll-board__q anim" style="--anim-step:2">${q}</p>` : ""}
      <ol class="poll-board__opts">${rows}</ol>
    </div>`;
}
