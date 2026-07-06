/* comparison.js — two columns with a central drawn divider (stroke-dashoffset), each
   column a stack of rows with an optional per-row score bar (scaleX fill, 0..1).
   Declarative only — no viewer-interactive slider in this wave.
   `anim` class + --anim-step = auto-playing entrance stagger (no clicks); the divider
   draw + bar fills ride keyframes gated to .present (deck.css), so peek/print/
   reduced-motion resolve to the finished, fully-visible comparison.
   Optional column-level accent (side a or b) is the ONE red stopper (max one; the
   renderer only honours the first side that asks for it). Returns ONLY content. */
import { esc } from "./_shared.js";

function clamp01(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(1, n));
}

/* One row: a label and an optional score bar. Score is 0..1; the fill scaleX-grows
   on entry. Rows with no score render as a plain labelled line (still on the grid). */
function row(item, i, side, stepBase, accent) {
  const it = typeof item === "string" ? { label: item } : (item || {});
  if (!it.label) return "";
  const score = clamp01(it.score);
  const bar = score != null
    ? `<div class="compare__bar" role="img" aria-hidden="true">
         <span class="compare__bar-fill" style="--bar-scale:${score.toFixed(3)}"></span>
       </div>`
    : "";
  const valueTag = it.value != null
    ? `<span class="compare__value">${esc(it.value)}</span>`
    : "";
  const cls = ["compare__row", "anim", accent ? "compare__row--accent" : ""].filter(Boolean).join(" ");
  return `<li class="${cls}" style="--anim-step:${stepBase + i}">
      <span class="compare__row-head">
        <span class="compare__label">${esc(it.label)}</span>
        ${valueTag}
      </span>
      ${bar}
    </li>`;
}

/* One side (a | b). `stepBase` staggers this column after the other; `accent` flags
   the single red column. */
function column(col, side, stepBase, accent) {
  const c = col || {};
  const items = Array.isArray(c.items) ? c.items : [];
  const rows = items.map((it, i) => row(it, i, side, stepBase + 1, accent)).join("");
  const title = c.title
    ? `<div class="compare__col-head anim" style="--anim-step:${stepBase}">
         <span class="compare__col-title">${esc(c.title)}</span>
       </div>`
    : "";
  const cls = [
    "compare__col", `compare__col--${side}`, accent ? "compare__col--accent" : "",
  ].filter(Boolean).join(" ");
  return `<div class="${cls}">
      ${title}
      <ol class="compare__rows">${rows}</ol>
    </div>`;
}

export function comparison(slide) {
  const a = slide.a || {};
  const b = slide.b || {};

  // One-red-stopper invariant: at most one column carries the accent. If both ask
  // (or neither), side a wins only when it explicitly asks; otherwise no accent.
  const aAccent = a.tone === "accent";
  const bAccent = b.tone === "accent" && !aAccent;

  // The central divider draws in on entry (stroke-dashoffset, pathLength-normalized).
  const divider = `<div class="compare__divider anim" style="--anim-step:2" aria-hidden="true">
      <svg viewBox="0 0 2 100" preserveAspectRatio="none">
        <line class="compare__divider-line" x1="1" y1="0" x2="1" y2="100" pathLength="100"/>
      </svg>
    </div>`;

  return `<div class="compare">
      ${column(a, "a", 3, aAccent)}
      ${divider}
      ${column(b, "b", 8, bAccent)}
    </div>`;
}
