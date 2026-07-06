/* ============================================================
   anim.js — motion wiring. CHROME. Never edited per-demo.
   ------------------------------------------------------------
   · KPI count-up: Chillax tabular numerals count 0→value over
     ~900ms ease-out on slide-enter (tabular = no layout shift).
   · Ring drift: toggles the 20s ≤2° loop only on the visible
     blue/dark hero slide (transform only).
   · Bookend orbit markup: the self-drawing, morphable ring the
     cover/closing archetypes render (behavior IS motion, so the
     markup lives here; _shared.orbit stays the static variant).
   · Reduced-motion HARD gate: count-ups jump to final, ring
     drift never starts, fragment fades already handled in CSS.
   ============================================================ */

const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const COUNT_MS = 900;

/*
 * bookendOrbit — the cover/closing orbital ring (A6/A7 bookend motion).
 * · pathLength="100" normalizes both radii to ONE dash keyframe, so the
 *   rings self-draw via stroke-dashoffset 100→0 (see deck.css §4).
 * · data-id="bookend-ring" sits on an HTML wrapper DIV, not the <svg>:
 *   with center:false reveal measures matched elements via offsetLeft/
 *   offsetWidth, which SVG roots don't have (NaN transform = no morph).
 *   Divs measure fine, so the wrapper is what auto-animate travels.
 * · The inner <g class="orbit__drift"> isolates the 20s drift loop from the
 *   inline transform auto-animate writes on the matched wrapper — a root
 *   animation would override that inline style and kill the morph.
 * · No transform on the wrapper for the same reason: the tl dot is MIRRORED
 *   in markup instead of rotating the whole ring 180°.
 */
export function bookendOrbit(corner /* "br" | "tl" */) {
  const dot = corner === "tl" ? { cx: 140, cy: 460 } : { cx: 620, cy: 300 };
  return `<div class="orbit orbit--${corner} orbit--bookend" data-id="bookend-ring" aria-hidden="true">
      <svg class="orbit__svg" viewBox="0 0 760 760">
        <g class="orbit__drift">
          <circle class="ring-1" cx="380" cy="380" r="300" pathLength="100"/>
          <circle class="ring-2" cx="380" cy="380" r="230" pathLength="100"/>
          <circle class="ring-dot" cx="${dot.cx}" cy="${dot.cy}" r="4"/>
        </g>
      </svg>
    </div>`;
}

/* ease-out-expo, matches --ease-out-expo */
function easeOutExpo(t) { return t === 1 ? 1 : 1 - Math.pow(2, -10 * t); }

/* Group thousands for readability, but ONLY at 10000+ so 4-digit years
   (2026) and small tallies (428) are never grouped. A big-stat like
   4820000 reads as 4,820,000; a funnel count of 428 stays 428. */
function fmtNum(n) {
  return Math.abs(n) >= 10000 ? n.toLocaleString("en-US") : String(n);
}

export function runCountUp(el) {
  const target = Number(el.getAttribute("data-count-to"));
  if (!Number.isFinite(target)) return;

  if (REDUCED) { el.textContent = fmtNum(target); return; }
  if (el.dataset.counted === "1") { el.textContent = fmtNum(target); return; }
  el.dataset.counted = "1";

  const start = performance.now();
  function frame(now) {
    const p = Math.min(1, (now - start) / COUNT_MS);
    const val = Math.round(target * easeOutExpo(p));
    el.textContent = fmtNum(val);
    if (p < 1) requestAnimationFrame(frame);
    else el.textContent = fmtNum(target);
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
    // Reveal only resets data-auto-animate when BOTH neighbors are a pair;
    // after one bookend morph the stale "pending"/"running" would suppress
    // the ring self-draw forever. Clear it on every slide we've left.
    document.querySelectorAll('.reveal .slides section[data-auto-animate]:not(.present)')
      .forEach((s) => { s.dataset.autoAnimate = ""; });
    countUpForSlide(slide);
    toggleRingDrift(slide);
  };

  if (Reveal.isReady && Reveal.isReady()) fire();
  Reveal.on("ready", fire);
  Reveal.on("slidechanged", fire);
}
