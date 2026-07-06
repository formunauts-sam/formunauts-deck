/* bigStat.js — the money-number slide. ONE hero Chillax numeral that counts up
   (class count-up + data-count-to, driven by anim.js), a unit, and one line of
   context. Optional supporting sub-stat and a thin draw-in accent — either a
   sparkbar (scaleY bars) or a ring (stroke-dashoffset), both compositor-safe.
   `anim` class + --anim-step = auto-playing entrance stagger (no clicks).
   The hero numeral carries data-id="hero-stat" so reveal auto-animate CAN morph
   it across a paired slide (bonus). Returns ONLY the content region. */
import { esc } from "./_shared.js";

/* count-up only drives clean integers (anim.js Math.rounds); anything with a
   decimal or thousands separator renders its literal value, no count-up — so the
   number on screen is always exactly the authored figure (no rounding surprise). */
function isCountable(v) {
  return /^-?\d+$/.test(String(v == null ? "" : v).replace(/,/g, ""));
}
function heroValue(value) {
  const raw = String(value == null ? "" : value);
  if (isCountable(raw)) {
    return `<span class="bigstat__value count-up" data-id="hero-stat" data-count-to="${raw.replace(/,/g, "")}">0</span>`;
  }
  return `<span class="bigstat__value" data-id="hero-stat">${esc(raw)}</span>`;
}

/* Sparkbar — a thin row of bars that draw in (scaleY from the baseline). Values
   are normalized to the max so the tallest bar reaches full height. Pure decoration
   for the money number; capped at 12 bars so it stays a spark, not a chart. */
function sparkbar(values) {
  const nums = (Array.isArray(values) ? values : [])
    .map(Number).filter(Number.isFinite).slice(0, 12);
  if (!nums.length) return "";
  const max = Math.max(...nums, 1);
  const bars = nums.map((v, i) => {
    const h = Math.max(0.06, v / max); // floor so a zero-ish value still shows a nub
    return `<span class="bigstat__spark-bar anim" style="--anim-step:${i + 4};--bar-scale:${h.toFixed(3)}"></span>`;
  }).join("");
  return `<div class="bigstat__spark" role="img" aria-hidden="true">${bars}</div>`;
}

/* Ring — a single draw-in arc (stroke-dashoffset 100→0, pathLength-normalized like
   the bookend ring). `pct` (0..1) sets how far the arc sweeps as the final state. */
function accentRing(pct) {
  const p = Math.max(0, Math.min(1, Number(pct)));
  const drawn = (p * 100).toFixed(2);
  return `<div class="bigstat__ring" aria-hidden="true">
      <svg viewBox="0 0 120 120">
        <circle class="bigstat__ring-track" cx="60" cy="60" r="52"/>
        <circle class="bigstat__ring-arc" cx="60" cy="60" r="52"
                pathLength="100" style="--ring-drawn:${drawn}"/>
      </svg>
    </div>`;
}

export function bigStat(slide) {
  const unit = slide.unit
    ? `<span class="bigstat__unit anim" style="--anim-step:2">${esc(slide.unit)}</span>`
    : "";
  const label = slide.label
    ? `<p class="bigstat__label anim" style="--anim-step:3">${esc(slide.label)}</p>`
    : "";
  const context = slide.context
    ? `<p class="bigstat__context anim" style="--anim-step:4">${esc(slide.context)}</p>`
    : "";

  // Supporting sub-stat — a small second figure that grounds the hero number.
  const sub = slide.sub
    ? `<div class="bigstat__sub anim" style="--anim-step:5">
         <span class="bigstat__sub-value${isCountable(slide.sub.value) ? " count-up" : ""}"${
           isCountable(slide.sub.value) ? ` data-count-to="${String(slide.sub.value).replace(/,/g, "")}"` : ""
         }>${isCountable(slide.sub.value) ? "0" : esc(slide.sub.value)}</span>
         <span class="bigstat__sub-label">${esc(slide.sub.label || "")}</span>
       </div>`
    : "";

  // Optional thin accent — sparkbar OR ring (sparkbar wins if both are given).
  const accent = Array.isArray(slide.spark) && slide.spark.length
    ? sparkbar(slide.spark)
    : (slide.ring != null ? accentRing(slide.ring) : "");

  return `<div class="bigstat">
      <div class="bigstat__hero">
        <span class="bigstat__figure anim" style="--anim-step:1">${heroValue(slide.value)}${unit}</span>
        ${label}
        ${context}
      </div>
      <div class="bigstat__aside">
        ${accent}
        ${sub}
      </div>
    </div>`;
}
