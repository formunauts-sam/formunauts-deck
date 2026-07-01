/* ============================================================
   anim.js — motion wiring. CHROME. Never edited per-demo.
   ------------------------------------------------------------
   · KPI count-up: Chillax tabular numerals count 0→value over
     ~900ms ease-out on slide-enter (tabular = no layout shift).
   · Ring drift: toggles the 20s ≤2° loop only on the visible
     blue/dark hero slide (transform only).
   · Reduced-motion HARD gate: count-ups jump to final, ring
     drift never starts, fragment fades already handled in CSS.
   ============================================================ */

const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const COUNT_MS = 900;

/* ease-out-expo, matches --ease-out-expo */
function easeOutExpo(t) { return t === 1 ? 1 : 1 - Math.pow(2, -10 * t); }

export function runCountUp(el) {
  const target = Number(el.getAttribute("data-count-to"));
  if (!Number.isFinite(target)) return;

  if (REDUCED) { el.textContent = String(target); return; }
  if (el.dataset.counted === "1") { el.textContent = String(target); return; }
  el.dataset.counted = "1";

  const start = performance.now();
  function frame(now) {
    const p = Math.min(1, (now - start) / COUNT_MS);
    const val = Math.round(target * easeOutExpo(p));
    el.textContent = String(val);
    if (p < 1) requestAnimationFrame(frame);
    else el.textContent = String(target);
  }
  requestAnimationFrame(frame);
}

function countUpForSlide(slide) {
  if (!slide) return;
  slide.querySelectorAll(".count-up[data-count-to]").forEach(runCountUp);
}

function toggleRingDrift(currentSlide) {
  // stop all, then start only on the visible slide (keeps compositor calm)
  document.querySelectorAll(".orbit").forEach((o) => o.classList.remove("is-drifting"));
  if (REDUCED || !currentSlide) return;
  currentSlide.querySelectorAll(".orbit").forEach((o) => o.classList.add("is-drifting"));
}

/**
 * initAnim — wire count-up + ring drift to reveal's slide lifecycle.
 * @param {Reveal} Reveal  the initialized Reveal instance
 */
export function initAnim(Reveal) {
  const fire = () => {
    const slide = Reveal.getCurrentSlide();
    countUpForSlide(slide);
    toggleRingDrift(slide);
  };

  if (Reveal.isReady && Reveal.isReady()) fire();
  Reveal.on("ready", fire);
  Reveal.on("slidechanged", fire);
}
