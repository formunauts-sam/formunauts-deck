/* agenda.js — a numbered section list that doubles as a nav map.
   Each line is a "chapter" for the talk: an index numeral, a title, an
   optional note. The whole list is the map; the matching section-divider
   is the landing.

   MORPH CONTRACT: every line carries data-id="agenda-<n>" so reveal's
   auto-animate can FLIP-morph the line into the matching section-divider
   headline (which carries the same data-id). Pairing is opt-in at the deck
   level (put a section-divider with number N after the agenda); this
   renderer stays fully standalone — the data-id is inert until a paired
   slide exists, and the agenda renders + reads correctly on its own.

   `anim` class + --anim-step = auto-playing entrance stagger (no clicks).
   Returns ONLY the content region (shared chrome wraps it in render.js). */
import { esc } from "./_shared.js";

export function agenda(slide) {
  const items = Array.isArray(slide.items) ? slide.items : [];

  const rows = items.map((raw, i) => {
    const it = typeof raw === "string" ? { title: raw } : (raw || {});
    if (!it.title) return "";
    // author may pin the numeral (n); otherwise it's the 1-based position.
    // The numeral is the morph anchor: data-id pairs with section-divider "number".
    const n = it.n != null ? String(it.n) : String(i + 1);
    const num = String(n).padStart(2, "0");
    const note = it.note
      ? `<span class="agenda__note">${esc(it.note)}</span>`
      : "";
    return `<li class="agenda__row anim" style="--anim-step:${i + 3}" data-id="agenda-${esc(n)}">
        <span class="agenda__num">${esc(num)}</span>
        <span class="agenda__body">
          <span class="agenda__title">${esc(it.title)}</span>
          ${note}
        </span>
        <span class="agenda__rule" aria-hidden="true"></span>
      </li>`;
  }).join("");

  return `<div class="agenda">
      <ol class="agenda__list">${rows}</ol>
    </div>`;
}
