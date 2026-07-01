/* ============================================================
   interactive.js — in-slide interactivity engine. CHROME.
   Never edited per-demo. ES module: `initInteractive(Reveal)`.
   ------------------------------------------------------------
   Progressive enhancement. Archetype renderers emit plain,
   fully-readable semantic markup tagged with `data-fx-*`
   attributes; this controller upgrades it into interactive
   components on the live deck and degrades every one to a
   fully-VISIBLE static state under print-pdf / presenter peek
   / forced `data-fx-static="open"` / any thrown error.

   If this module never runs, the raw markup is already a clean
   slide — the five behaviours only ADD affordances.

   Behaviours (opt-in via `data-fx` on markup):
     funnel        interactive drop-off funnel + tooltip
     carousel      hero + filmstrip + lightbox (fixes tiny posts)
     slider        draggable compare (clip-path) / metric scrub
     reveal-card   click-to-expand disclosure / accordion
     count-replay  click a KPI numeral to re-run 0→N count-up

   Contracts:
     · Native DOM events (click/focus/input) → ZERO coordinate
       math needed even under reveal's scaled canvas.
     · Motion is compositor-only (transform/opacity/clip-path).
     · Everything keyboard + ARIA accessible, touch-friendly.
     · matchMedia reduced-motion HARD-gates tweened reveals.
   ============================================================ */

/* ---- environment flags ------------------------------------------------- */
const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Presenter peek preview (?present=peek) — calm, exploded static thumbnails. */
function isPeek() {
  return new URLSearchParams(window.location.search).get("present") === "peek";
}
/** Static-export mode: PDF print gate OR presenter peek. Show everything. */
function isStatic() {
  return document.body.classList.contains("print-pdf") || isPeek();
}

/* ---- tiny DOM helpers -------------------------------------------------- */
function el(tag, attrs = {}, html) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === "class") node.className = v;
    else node.setAttribute(k, v === true ? "" : String(v));
  }
  if (html != null) node.innerHTML = html;
  return node;
}
function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function fmt(n) {
  // thousands separators for the drop-off chips (matches deck numeral tone)
  return Number(n).toLocaleString("en-US");
}

/* ---- inline icons (no CDN; stroke owned by CSS) ------------------------ */
const SVG = {
  chevron: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>',
  prev: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>',
  next: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>',
  zoom: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Z"/><path d="m21 21-4.35-4.35"/><path d="M11 8v6M8 11h6"/></svg>',
  close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  drag: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 9 4 12l4 3M16 9l4 3-4 3"/></svg>',
};

/* =======================================================================
   FOCUS TRAP — shared by the lightbox. Returns a release() fn.
   ======================================================================= */
function trapFocus(container, onEscape) {
  const SELECTOR =
    'a[href],button:not([disabled]),input:not([disabled]),[tabindex]:not([tabindex="-1"])';
  const previouslyFocused = document.activeElement;

  function focusables() {
    return Array.from(container.querySelectorAll(SELECTOR)).filter(
      (n) => n.offsetParent !== null || n === document.activeElement
    );
  }
  function onKey(e) {
    if (e.key === "Escape") {
      e.preventDefault();
      onEscape();
      return;
    }
    if (e.key !== "Tab") return;
    const items = focusables();
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
  container.addEventListener("keydown", onKey);
  const firstFocusable = focusables()[0];
  if (firstFocusable) firstFocusable.focus();

  return function release() {
    container.removeEventListener("keydown", onKey);
    if (previouslyFocused && typeof previouslyFocused.focus === "function") {
      previouslyFocused.focus();
    }
  };
}

/* =======================================================================
   BEHAVIOUR 1 — FUNNEL
   Markup contract (campaignAnalysis.js emits):
     .funnel[data-fx="funnel"]
       button.funnel__stage[data-step][data-fx-stage][data-fx-value]
                            [data-fx-prev][data-fx-tip?][data-fx-drop-label?]
         .funnel__label / .funnel__value
   We append a drop chip (−N · X% retained), a proportional delta ribbon,
   and a tooltip (step conversion + prose). Click toggles a pinned state;
   hover/focus previews. All numbers are computed here from data-fx-value /
   data-fx-prev, so the deck data stays declarative.
   ======================================================================= */
function funnel(root) {
  const stages = Array.from(root.querySelectorAll(".funnel__stage"));
  if (stages.length === 0) return;

  root.setAttribute("role", "list");
  root.setAttribute("aria-label", "Conversion funnel — activate a stage for drop-off detail");

  stages.forEach((stage, i) => {
    const value = num(stage.dataset.fxValue);
    const prev = num(stage.dataset.fxPrev);
    stage.setAttribute("role", "listitem");

    // Build the drop-off chip only when we have a comparable previous value.
    if (value != null && prev != null && prev > 0) {
      const dropped = prev - value;
      const retained = Math.round((value / prev) * 100);
      const stepConv = retained; // step conversion == retained % of previous stage
      const label = stage.dataset.fxDropLabel || "retained";

      const chip = el("span", { class: "funnel__drop" });
      chip.innerHTML =
        `<span class="funnel__drop-drop">−${fmt(dropped)}</span>` +
        `<span class="funnel__drop-sep">·</span>` +
        `<span class="funnel__drop-retained">${retained}% ${label}</span>`;
      stage.appendChild(chip);

      // proportional delta ribbon: taller when more dropped off
      const ribbon = el("span", { class: "funnel__ribbon" });
      const dropFrac = Math.max(0.08, Math.min(1, dropped / prev));
      ribbon.style.top = "0";
      ribbon.style.height = `${Math.round(dropFrac * 100)}%`;
      stage.appendChild(ribbon);

      // tooltip: step conversion + optional prose
      const tip = el("div", { class: "funnel__tip", role: "tooltip" });
      const prose = stage.dataset.fxTip ? `${stage.dataset.fxTip}` : "";
      tip.innerHTML =
        `<span class="funnel__tip-metric">${stepConv}% step conversion</span>` +
        `${fmt(value)} of ${fmt(prev)} continued${prose ? `<br>${escapeText(prose)}` : ""}`;
      const tipId = `fx-tip-${Math.random().toString(36).slice(2, 8)}`;
      tip.id = tipId;
      stage.appendChild(tip);
      stage.setAttribute("aria-describedby", tipId);

      // accessible label so a screen reader hears the delta, not just the raw value
      const stageLabel =
        stage.querySelector(".funnel__label")?.textContent?.trim() || `Stage ${i + 1}`;
      stage.setAttribute(
        "aria-label",
        `${stageLabel}: ${fmt(value)}. ${retained}% ${label} from ${fmt(prev)}, ${fmt(dropped)} dropped off.`
      );
    }

    // click / Enter / Space pins this stage open; Esc or re-click clears
    stage.addEventListener("click", () => togglePinned(root, stage));
    stage.addEventListener("keydown", (e) => {
      if (e.key === "Escape") clearPinned(root);
    });
    stage.addEventListener("focus", () => root.setAttribute("data-fx-active", ""));
    stage.addEventListener("blur", () => {
      if (!root.querySelector('[data-fx-open]')) root.removeAttribute("data-fx-active");
    });
  });

  // hover on the whole funnel dims siblings (data-fx-active); leaving clears
  root.addEventListener("pointerenter", () => root.setAttribute("data-fx-active", ""));
  root.addEventListener("pointerleave", () => {
    if (!root.querySelector("[data-fx-open]")) root.removeAttribute("data-fx-active");
  });
}
function togglePinned(root, stage) {
  const already = stage.hasAttribute("data-fx-open");
  clearPinned(root);
  if (!already) {
    stage.setAttribute("data-fx-open", "");
    root.setAttribute("data-fx-active", "");
  } else {
    root.removeAttribute("data-fx-active");
  }
}
function clearPinned(root) {
  root.querySelectorAll("[data-fx-open]").forEach((n) => n.removeAttribute("data-fx-open"));
}

/* =======================================================================
   BEHAVIOUR 2 — CAROUSEL + LIGHTBOX
   Markup contract (projectVisual.hero() emits, wrapping existing frames):
     [data-fx="carousel"][data-fx-start?]
       > items each: [data-fx-item][data-fx-caption?][data-fx-badge?]
                     containing a .asset-frame (aspect-locked) + optional img
   We build: a focal stage (cross-fade), a filmstrip of thumbs (tablist),
   prev/next + dots, and a full-viewport focus-trapped lightbox.
   This fixes "planned images too small": thumbs enlarge into the focal
   frame and the lightbox shows any post at real size.
   ======================================================================= */
function carousel(root) {
  const items = Array.from(root.querySelectorAll("[data-fx-item]"));
  if (items.length === 0) return;

  // Snapshot each item's frame HTML + metadata BEFORE we rebuild the DOM.
  const slides = items.map((item) => {
    const frame = item.querySelector(".asset-frame");
    const img = item.querySelector("img");
    return {
      frameHTML: frame ? frame.outerHTML : item.innerHTML,
      full: item.dataset.fxFull || (img ? img.getAttribute("src") : ""),
      caption: item.dataset.fxCaption || "",
      badge: (item.dataset.fxBadge || "").toUpperCase(),
      alt: img ? img.getAttribute("alt") : "",
    };
  });

  const startIndex = Math.max(0, Math.min(slides.length - 1, num(root.dataset.fxStart) ?? 0));
  let current = startIndex;

  // --- build structure ---
  root.classList.add("fx-carousel");
  root.textContent = "";

  const stage = el("div", { class: "fx-carousel__stage" });
  const slideNodes = slides.map((s, i) => {
    const slide = el("div", { class: "fx-carousel__slide" });
    if (i === current) slide.setAttribute("data-fx-current", "");
    // focal button → opens lightbox
    const focal = el("button", {
      class: "fx-carousel__focal",
      type: "button",
      "aria-label": `View ${s.caption || s.alt || "post"} full size`,
    });
    focal.innerHTML = s.frameHTML + `<span class="fx-carousel__zoom" aria-hidden="true">${SVG.zoom}</span>`;
    focal.addEventListener("click", () => openLightbox(root, slides, i));
    slide.appendChild(focal);
    return slide;
  });
  slideNodes.forEach((n) => stage.appendChild(n));
  root.appendChild(stage);

  // --- filmstrip (tablist) ---
  const strip = el("div", { class: "fx-carousel__strip", role: "tablist", "aria-label": "Post gallery" });
  const thumbs = slides.map((s, i) => {
    const thumb = el("button", {
      class: "fx-carousel__thumb",
      type: "button",
      role: "tab",
      "aria-selected": i === current ? "true" : "false",
      "aria-label": `Show ${s.caption || s.alt || `post ${i + 1}`}`,
      tabindex: i === current ? "0" : "-1",
    });
    thumb.innerHTML = s.frameHTML;
    thumb.addEventListener("click", () => go(i));
    thumb.addEventListener("keydown", (e) => onStripKey(e, i));
    strip.appendChild(thumb);
    return thumb;
  });
  root.appendChild(strip);

  // --- controls: prev / dots / next / caption ---
  const controls = el("div", { class: "fx-carousel__controls" });
  const prevBtn = el("button", { class: "fx-carousel__nav", type: "button", "aria-label": "Previous post" }, SVG.prev);
  const nextBtn = el("button", { class: "fx-carousel__nav", type: "button", "aria-label": "Next post" }, SVG.next);
  const dots = el("div", { class: "fx-carousel__dots" });
  const dotNodes = slides.map((s, i) => {
    const dot = el("button", {
      class: "fx-carousel__dot",
      type: "button",
      "aria-label": `Go to post ${i + 1}`,
      "aria-current": i === current ? "true" : "false",
    });
    dot.addEventListener("click", () => go(i));
    dots.appendChild(dot);
    return dot;
  });
  const caption = el("p", { class: "fx-carousel__caption", "aria-live": "polite" });
  prevBtn.addEventListener("click", () => go(current - 1));
  nextBtn.addEventListener("click", () => go(current + 1));
  controls.append(prevBtn, dots, nextBtn, caption);
  root.appendChild(controls);

  function paint() {
    slideNodes.forEach((n, i) =>
      i === current ? n.setAttribute("data-fx-current", "") : n.removeAttribute("data-fx-current")
    );
    thumbs.forEach((t, i) => {
      const on = i === current;
      t.setAttribute("aria-selected", on ? "true" : "false");
      t.tabIndex = on ? 0 : -1;
    });
    dotNodes.forEach((d, i) => d.setAttribute("aria-current", i === current ? "true" : "false"));
    caption.textContent = slides[current].caption || "";
  }
  function go(i) {
    current = (i + slides.length) % slides.length;
    paint();
  }
  function onStripKey(e, i) {
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      const t = thumbs[(i + 1) % thumbs.length];
      go((i + 1) % thumbs.length);
      t.focus();
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      const nextI = (i - 1 + thumbs.length) % thumbs.length;
      go(nextI);
      thumbs[nextI].focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      go(0);
      thumbs[0].focus();
    } else if (e.key === "End") {
      e.preventDefault();
      go(thumbs.length - 1);
      thumbs[thumbs.length - 1].focus();
    }
  }
  paint();
}

function openLightbox(deckRoot, slides, index) {
  const revealEl = document.querySelector(".reveal") || document.body;
  let current = index;

  const overlay = el("div", {
    class: "fx-lightbox",
    role: "dialog",
    "aria-modal": "true",
    "aria-label": "Post preview",
  });
  const figure = el("figure", { class: "fx-lightbox__figure" });
  const img = el("img", { class: "fx-lightbox__img", alt: "" });
  const cap = el("figcaption", { class: "fx-lightbox__cap" });
  const closeBtn = el("button", { class: "fx-lightbox__close", type: "button", "aria-label": "Close preview" }, SVG.close);
  const prevBtn = el("button", { class: "fx-lightbox__nav fx-lightbox__nav--prev", type: "button", "aria-label": "Previous post" }, SVG.prev);
  const nextBtn = el("button", { class: "fx-lightbox__nav fx-lightbox__nav--next", type: "button", "aria-label": "Next post" }, SVG.next);

  figure.append(closeBtn, img, cap);
  overlay.append(prevBtn, figure, nextBtn);
  revealEl.appendChild(overlay);
  // next frame → CSS transition to visible
  requestAnimationFrame(() => overlay.setAttribute("data-fx-open", ""));

  function paint() {
    const s = slides[current];
    img.src = s.full;
    img.alt = s.alt || s.caption || "Post preview";
    const badge = s.badge
      ? `<span class="fx-lightbox__badge fx-lightbox__badge--${
          s.badge === "LIVE" ? "success" : "planned"
        }">${escapeText(s.badge)}</span>`
      : "";
    cap.innerHTML = badge + `<span>${escapeText(s.caption || "")}</span>`;
    const multi = slides.length > 1;
    prevBtn.style.display = multi ? "" : "none";
    nextBtn.style.display = multi ? "" : "none";
  }
  function move(delta) {
    current = (current + delta + slides.length) % slides.length;
    paint();
  }
  prevBtn.addEventListener("click", () => move(-1));
  nextBtn.addEventListener("click", () => move(1));
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });
  overlay.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") move(-1);
    else if (e.key === "ArrowRight") move(1);
  });
  closeBtn.addEventListener("click", close);

  paint();
  const release = trapFocus(overlay, close);

  function close() {
    overlay.removeAttribute("data-fx-open");
    release();
    const remove = () => overlay.remove();
    if (REDUCED) remove();
    else {
      overlay.addEventListener("transitionend", remove, { once: true });
      // safety: force-remove if no transitionend fires
      setTimeout(remove, 500);
    }
  }
}

/* =======================================================================
   BEHAVIOUR 3 — SLIDER (compare | scrub)
   Markup contract:
     [data-fx="slider"][data-fx-slider-mode="compare|scrub"][data-fx-start?]
       compare: two layers [data-fx-layer="before|after"] (img/.asset-frame),
                labels via data-fx-label-before / data-fx-label-after
       scrub:   data-fx-scrub='[{"at":0,"value":"…","label":"…"}, …]'
   A visually-hidden native <input type=range> overlays the full track, so
   drag is scale-correct (browser maps the pointer internally), and keyboard/
   SR/touch all work with no coordinate math.
   ======================================================================= */
function slider(root) {
  const mode = root.dataset.fxSliderMode === "scrub" ? "scrub" : "compare";
  if (mode === "scrub") return scrubSlider(root);
  return compareSlider(root);
}

function compareSlider(root) {
  const before = root.querySelector('[data-fx-layer="before"]');
  const after = root.querySelector('[data-fx-layer="after"]');
  if (!before || !after) return;

  root.classList.add("fx-slider");
  const start = clampPct(num(root.dataset.fxStart) ?? 50);
  root.style.setProperty("--fx-pos", `${start}%`);

  const labelBefore = root.dataset.fxLabelBefore;
  const labelAfter = root.dataset.fxLabelAfter;

  const layers = el("div", { class: "fx-slider__layers" });
  before.classList.add("fx-slider__layer");
  before.setAttribute("data-fx-layer", "before");
  after.classList.add("fx-slider__layer");
  after.setAttribute("data-fx-layer", "after");
  layers.append(before, after);

  const seam = el("span", { class: "fx-slider__seam", "aria-hidden": "true" });
  const handle = el("span", { class: "fx-slider__handle", "aria-hidden": "true" }, SVG.drag);
  const range = el("input", {
    type: "range",
    class: "fx-slider__range",
    min: "0",
    max: "100",
    value: String(start),
    "aria-label": "Reveal comparison — before versus after",
  });
  range.setAttribute("aria-valuetext", `${start}% after revealed`);

  root.textContent = "";
  root.appendChild(layers);
  if (labelBefore) root.appendChild(el("span", { class: "fx-slider__label fx-slider__label--before" }, escapeText(labelBefore)));
  if (labelAfter) root.appendChild(el("span", { class: "fx-slider__label fx-slider__label--after" }, escapeText(labelAfter)));
  root.append(seam, handle, range);

  function update() {
    // "after" layer clips from the LEFT, so pos% of "after" is hidden on the left
    const pct = clampPct(Number(range.value));
    root.style.setProperty("--fx-pos", `${pct}%`);
    range.setAttribute("aria-valuetext", `${pct}% after revealed`);
  }
  range.addEventListener("input", update);
  range.addEventListener("pointerdown", () => root.classList.add("is-dragging"));
  window.addEventListener("pointerup", () => root.classList.remove("is-dragging"));
  update();
}

function scrubSlider(root) {
  let stops = [];
  try {
    stops = JSON.parse(root.dataset.fxScrub || "[]");
  } catch (e) {
    stops = [];
  }
  if (!Array.isArray(stops) || stops.length === 0) return;

  root.classList.add("fx-slider", "fx-slider--scrub");
  const startAt = num(root.dataset.fxStart);
  let idx = 0;
  if (startAt != null) {
    idx = stops.findIndex((s) => Number(s.at) === startAt);
    if (idx < 0) idx = 0;
  }

  const readout = el("div", { class: "fx-scrub__readout", "aria-live": "polite" });
  const track = el("div", { class: "fx-scrub__track" });
  const fill = el("span", { class: "fx-scrub__fill" });
  track.appendChild(fill);
  const scale = el("div", { class: "fx-scrub__scale" });
  stops.forEach((s) => scale.appendChild(el("span", {}, escapeText(String(s.label ?? s.at)))));

  const range = el("input", {
    type: "range",
    class: "fx-slider__range",
    min: "0",
    max: String(stops.length - 1),
    step: "1",
    value: String(idx),
    "aria-label": "Scrub metric across stops",
  });
  // give the scrub range a visible track (unlike the compare overlay)
  range.style.position = "static";
  range.style.opacity = "1";
  range.style.height = "22px";

  root.textContent = "";
  root.append(readout, track, range, scale);

  function paint() {
    const s = stops[idx] || {};
    readout.innerHTML = `${escapeText(String(s.value ?? ""))}<small>${escapeText(String(s.label ?? ""))}</small>`;
    const pct = stops.length > 1 ? (idx / (stops.length - 1)) * 100 : 100;
    root.style.setProperty("--fx-pos", `${pct}%`);
    range.setAttribute("aria-valuetext", `${s.label ?? ""}: ${s.value ?? ""}`);
  }
  range.addEventListener("input", () => {
    idx = clampInt(Number(range.value), 0, stops.length - 1);
    paint();
  });
  paint();
}

/* =======================================================================
   BEHAVIOUR 4 — REVEAL-CARD (disclosure / accordion)
   Markup contract:
     [data-fx="reveal-card"][data-fx-summary?][data-fx-group?]
       (summary from data-fx-summary OR child .fx-card__summary)
       child .fx-card__detail  (the concrete action / detail)
   ======================================================================= */
function revealCard(root) {
  root.classList.add("fx-card");
  const group = root.dataset.fxGroup || null;

  // resolve summary text + detail region
  let summaryText = root.dataset.fxSummary || "";
  let existingSummary = root.querySelector(".fx-card__summary");
  let detail = root.querySelector(".fx-card__detail");
  if (!detail) return; // nothing to disclose → leave markup as-is

  if (!summaryText && existingSummary) summaryText = existingSummary.textContent.trim();

  const detailId = `fx-card-d-${Math.random().toString(36).slice(2, 8)}`;
  detail.id = detailId;
  // wrap detail content so grid-rows 0fr→1fr can clip it
  if (!detail.querySelector(".fx-card__detail-inner")) {
    const inner = el("div", { class: "fx-card__detail-inner" });
    while (detail.firstChild) inner.appendChild(detail.firstChild);
    detail.appendChild(inner);
  }

  // build the summary button
  const btn = el("button", {
    class: "fx-card__summary",
    type: "button",
    "aria-expanded": "false",
    "aria-controls": detailId,
  });
  btn.innerHTML = `<span class="fx-card__summary-text">${escapeText(summaryText)}</span><span class="fx-card__chevron" aria-hidden="true">${SVG.chevron}</span>`;
  if (existingSummary) existingSummary.replaceWith(btn);
  else root.insertBefore(btn, detail);

  btn.addEventListener("click", () => {
    const open = btn.getAttribute("aria-expanded") === "true";
    if (!open && group) {
      // accordion: close siblings in the same group under the same slide
      const scope = root.closest("section") || document;
      scope
        .querySelectorAll(`[data-fx="reveal-card"][data-fx-group="${cssEscape(group)}"] .fx-card__summary[aria-expanded="true"]`)
        .forEach((other) => other.setAttribute("aria-expanded", "false"));
    }
    btn.setAttribute("aria-expanded", open ? "false" : "true");
  });
}

/* =======================================================================
   BEHAVIOUR 5 — COUNT-REPLAY
   Any `.count-up[data-count-to]` gains click/Enter-to-replay. We import
   runCountUp lazily from anim.js so this stays decoupled; if the export
   isn't available, we fall back to a local re-count. Non-interactive
   fallback = final value (anim.js already renders it).
   ======================================================================= */
let _runCountUp = null;
async function ensureCountUp() {
  if (_runCountUp) return _runCountUp;
  try {
    const mod = await import("./anim.js");
    if (typeof mod.runCountUp === "function") _runCountUp = mod.runCountUp;
  } catch (e) {
    /* fall through to local */
  }
  if (!_runCountUp) _runCountUp = localCountUp;
  return _runCountUp;
}
function localCountUp(node) {
  const target = num(node.getAttribute("data-count-to"));
  if (target == null) return;
  if (REDUCED) {
    node.textContent = String(target);
    return;
  }
  const DURATION = 900;
  const start = performance.now();
  const easeOutExpo = (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));
  function frame(now) {
    const p = Math.min(1, (now - start) / DURATION);
    node.textContent = String(Math.round(target * easeOutExpo(p)));
    if (p < 1) requestAnimationFrame(frame);
    else node.textContent = String(target);
  }
  requestAnimationFrame(frame);
}
function countReplay(node) {
  if (node.getAttribute("data-count-to") == null) return;

  // upgrade the numeral to a real button for keyboard + SR
  node.setAttribute("data-fx-replay", "");
  node.setAttribute("role", "button");
  node.setAttribute("tabindex", "0");
  node.setAttribute("aria-label", `Replay count to ${node.getAttribute("data-count-to")}`);
  node.style.cursor = "pointer";

  async function replay() {
    node.dataset.counted = ""; // clear anim.js's one-shot guard so it re-runs
    const run = await ensureCountUp();
    run(node);
  }
  node.addEventListener("click", replay);
  node.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      replay();
    }
  });
}

/* =======================================================================
   STATIC STATE — the universal fallback renderer.
   Runs under print-pdf / peek / data-fx-static="open" / on any thrown
   enhance() error. Guarantees a fully-VISIBLE, readable component with no
   interaction chrome. The CSS §7 block reinforces each of these.
   ======================================================================= */
function staticState(root) {
  const kind = root.dataset.fx;
  switch (kind) {
    case "funnel":
      return staticFunnel(root);
    case "carousel":
      return staticCarousel(root);
    case "slider":
      return staticSlider(root);
    case "reveal-card":
      return staticCard(root);
    case "count-replay":
      return staticCount(root);
    default:
      return;
  }
}

function staticFunnel(root) {
  // inline the computed drop-off chip into every stage (no interaction)
  root.querySelectorAll(".funnel__stage").forEach((stage) => {
    if (stage.querySelector(".funnel__drop")) return;
    const value = num(stage.dataset.fxValue);
    const prev = num(stage.dataset.fxPrev);
    if (value == null || prev == null || prev <= 0) return;
    const dropped = prev - value;
    const retained = Math.round((value / prev) * 100);
    const label = stage.dataset.fxDropLabel || "retained";
    const chip = el("span", { class: "funnel__drop" });
    chip.innerHTML =
      `<span class="funnel__drop-drop">−${fmt(dropped)}</span>` +
      `<span class="funnel__drop-sep">·</span>` +
      `<span class="funnel__drop-retained">${retained}% ${label}</span>`;
    stage.appendChild(chip);
  });
}

function staticCarousel(root) {
  // turn the item list into a clean captioned grid at good size
  root.classList.add("fx-static-grid");
  root.querySelectorAll("[data-fx-item]").forEach((item) => {
    const cap = item.dataset.fxCaption;
    if (cap && item.querySelector(".asset-frame") && !item.querySelector(".caption")) {
      const frame = item.querySelector(".asset-frame");
      frame.appendChild(el("figcaption", { class: "caption" }, escapeText(cap)));
    }
  });
}

function staticSlider(root) {
  const mode = root.dataset.fxSliderMode === "scrub" ? "scrub" : "compare";
  root.classList.add("fx-slider");
  if (mode === "scrub") {
    root.classList.add("fx-slider--scrub");
    let stops = [];
    try {
      stops = JSON.parse(root.dataset.fxScrub || "[]");
    } catch (e) {
      stops = [];
    }
    const startAt = num(root.dataset.fxStart);
    let s = stops[0] || {};
    if (startAt != null) s = stops.find((x) => Number(x.at) === startAt) || s;
    root.style.setProperty("--fx-pos", "100%");
    const readout = el("div", { class: "fx-scrub__readout" });
    readout.innerHTML = `${escapeText(String(s.value ?? ""))}<small>${escapeText(String(s.label ?? ""))}</small>`;
    const track = el("div", { class: "fx-scrub__track" }, '<span class="fx-scrub__fill"></span>');
    const scale = el("div", { class: "fx-scrub__scale" });
    stops.forEach((st) => scale.appendChild(el("span", {}, escapeText(String(st.label ?? st.at)))));
    root.textContent = "";
    root.append(readout, track, scale);
    return;
  }
  // compare static → show "after" fully (pos 0%), keep both labels + seam
  root.style.setProperty("--fx-pos", "0%");
  const before = root.querySelector('[data-fx-layer="before"]');
  const after = root.querySelector('[data-fx-layer="after"]');
  const labelBefore = root.dataset.fxLabelBefore;
  const labelAfter = root.dataset.fxLabelAfter;
  const layers = el("div", { class: "fx-slider__layers" });
  if (before) {
    before.classList.add("fx-slider__layer");
    layers.appendChild(before);
  }
  if (after) {
    after.classList.add("fx-slider__layer");
    layers.appendChild(after);
  }
  root.textContent = "";
  root.appendChild(layers);
  if (labelBefore) root.appendChild(el("span", { class: "fx-slider__label fx-slider__label--before" }, escapeText(labelBefore)));
  if (labelAfter) root.appendChild(el("span", { class: "fx-slider__label fx-slider__label--after" }, escapeText(labelAfter)));
  root.appendChild(el("span", { class: "fx-slider__seam", "aria-hidden": "true" }));
}

function staticCard(root) {
  root.classList.add("fx-card");
  const detail = root.querySelector(".fx-card__detail");
  const summaryText = root.dataset.fxSummary || root.querySelector(".fx-card__summary")?.textContent?.trim() || "";
  let existing = root.querySelector(".fx-card__summary");
  // render summary as a static, fully-open header
  const head = el("div", { class: "fx-card__summary", "aria-expanded": "true" });
  head.innerHTML = `<span class="fx-card__summary-text">${escapeText(summaryText)}</span>`;
  if (existing) existing.replaceWith(head);
  else if (detail) root.insertBefore(head, detail);
  if (detail && !detail.querySelector(".fx-card__detail-inner")) {
    const inner = el("div", { class: "fx-card__detail-inner" });
    while (detail.firstChild) inner.appendChild(detail.firstChild);
    detail.appendChild(inner);
  }
  if (detail) detail.style.gridTemplateRows = "1fr"; // fully open in export
}

function staticCount(node) {
  // final value already rendered by anim.js's print hook; ensure it's there
  const target = node.getAttribute("data-count-to");
  if (target != null && (node.textContent.trim() === "" || node.textContent.trim() === "0")) {
    node.textContent = target;
  }
}

/* ---- misc utilities ---------------------------------------------------- */
function clampPct(n) {
  return Math.max(0, Math.min(100, Number.isFinite(n) ? n : 50));
}
function clampInt(n, lo, hi) {
  n = Math.round(Number(n));
  return Math.max(lo, Math.min(hi, Number.isFinite(n) ? n : lo));
}
/** Escape text for safe innerHTML use (data may contain <, &, quotes). */
function escapeText(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
/** CSS.escape shim for attribute-selector values (group names). */
function cssEscape(s) {
  if (window.CSS && typeof window.CSS.escape === "function") return window.CSS.escape(s);
  return String(s).replace(/[^a-zA-Z0-9_-]/g, "\\$&");
}

/* ---- behaviour registry ------------------------------------------------ */
const BEHAVIOURS = {
  funnel,
  carousel,
  slider,
  "reveal-card": revealCard,
  "count-replay": countReplay,
};

/* =======================================================================
   enhance() — idempotent, per-root. Guarded by data-fx-enhanced="1".
   In static mode (print/peek) OR when data-fx-static="open", render the
   fully-visible fallback instead of the live behaviour. Any thrown error
   downgrades that single element to its static state — never breaks the slide.
   ======================================================================= */
function enhance(root) {
  if (!root || !root.querySelectorAll) return;
  const targets = root.querySelectorAll("[data-fx]");
  targets.forEach((node) => {
    if (node.dataset.fxEnhanced === "1" || node.dataset.fxStaticDone === "1") return;
    const behaviour = BEHAVIOURS[node.dataset.fx];
    if (!behaviour) return;

    if (isStatic() || node.dataset.fxStatic === "open") {
      try {
        staticState(node);
      } catch (e) {
        console.warn("[fx] static render failed", node.dataset.fx, e);
      }
      node.dataset.fxStaticDone = "1";
      return;
    }
    try {
      behaviour(node);
      node.dataset.fxEnhanced = "1";
    } catch (e) {
      console.warn("[fx] enhance failed, falling back to static", node.dataset.fx, e);
      try {
        staticState(node);
      } catch (e2) {
        /* raw markup remains as last-resort fallback */
      }
      node.dataset.fxStaticDone = "1";
    }
  });
}

/* =======================================================================
   initInteractive — wire enhancement to reveal's lifecycle.
   · ready            → enhance the whole deck once
   · slidechanged     → enhance the entering slide (idempotent)
   · overviewhidden   → re-assert after returning from overview
   Static/peek gate is read at enhance-time, so index.html's print block
   (which runs before this) is already reflected in body.print-pdf.
   ======================================================================= */
export function initInteractive(Reveal) {
  const runAll = () => enhance(document);

  if (Reveal && typeof Reveal.isReady === "function" && Reveal.isReady()) {
    runAll();
  }
  if (Reveal && typeof Reveal.on === "function") {
    Reveal.on("ready", runAll);
    Reveal.on("slidechanged", (e) => enhance(e && e.currentSlide ? e.currentSlide : document));
    Reveal.on("overviewhidden", runAll);
  } else {
    // No reveal instance (defensive) — enhance whatever is in the DOM now.
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", runAll, { once: true });
    } else {
      runAll();
    }
  }
}

export default initInteractive;
