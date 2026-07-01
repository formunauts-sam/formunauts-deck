/* ============================================================
   FORMUNAUTS Demo-Deck — plugin/marker/plugin.js
   ------------------------------------------------------------
   CHROME. Never edited per-demo.

   RevealMarker — one on-brand annotation system that replaces the
   vendored `pointer` + `chalkboard` plugins:

     • LASER      (default) Google-style vanishing comet trail,
                  ~1.2s fade, nothing persists, click-through.
     • INK        persistent pen — colours / widths / stroke eraser /
                  undo / redo, stored per-slide in author (1280×720)
                  coords so it stays pinned at any projector scale.
     • SPOTLIGHT  dim wash with a soft radial hole following the cursor.

   Coordinate crux is solved the robust way: ONE full-viewport canvas
   (position:fixed, NOT transformed with the deck) + convert points
   through Reveal.getScale() + getSlidesElement().getBoundingClientRect().
   This fixes the pointer plugin's brittle `scale(.)` single-digit regex.

   Valid reveal 6.x plugin: exposes { id:'marker', init(reveal) }.
   Public methods are callable as RevealMarker.method() (driven by the
   customcontrols onclick actions and the presenter console: deck-link.js
   forwards annotation messages to the remote API — setTool / setColor /
   pointerMove / pointerHide / strokeStart / strokePoint / strokeEnd /
   clearInk — with nx/ny 0..1 normalized to the slide viewport).

   Inline 24×24 SVG icons only — no Font Awesome, no emoji.
   ============================================================ */
var RevealMarker = (function () {
  "use strict";

  /* -----------------------------------------------------------
     Config defaults (any omitted key falls back to these).
  ----------------------------------------------------------- */
  var DEFAULTS = {
    defaultMode: "laser",
    laser: {
      lifetime: 1200,   // ms a trail point lives before it fully fades
      tension: 0.35,    // Catmull-Rom smoothing
      maxWidth: 9,      // head thickness (px, screen space)
      minWidth: 0,      // tail thickness
      glowBlur: 16,
      core: "#E03B50",  // brand secondary — transient laser only (rare-stopper honoured: never persists)
      halo: "rgba(224,59,80,0.35)",
      dotRadius: 6,
    },
    ink: {
      colors: ["#0074C8", "#1E2A33", "#E03B50", "#1F8643", "#E0A82E"],
      defaultColor: "#0074C8",
      widths: [2, 4, 8],
      defaultWidth: 4,
      eraser: "stroke",       // "stroke" (vector hit-test, undoable) | "pixel"
      persistPerSlide: true,
    },
    spotlight: {
      radius: 140,            // author px
      dim: "rgba(4,15,26,0.72)",
      softness: 0.55,         // 0..1 → inner/outer gradient stop ratio
      wheelResize: true,
    },
    toolbar: {
      position: "bottom-center",
      autoHide: true,
      idleMs: 3000,
    },
    respectReducedMotion: true,
  };

  var MODE = { IDLE: "idle", LASER: "laser", INK: "ink", SPOTLIGHT: "spotlight" };
  var MIN_RADIUS = 60;
  var MAX_RADIUS = 420;
  var ERASE_HIT = 12; // author-px radius for stroke hit-testing

  /* -----------------------------------------------------------
     Inline SVG icons (24×24, currentColor). Hand-authored.
  ----------------------------------------------------------- */
  var ICON = {
    laser:
      '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      '<circle cx="12" cy="12" r="3" fill="currentColor"/>' +
      '<path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" ' +
      'stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
    pen:
      '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      '<path d="M4 20l1-4L15.5 5.5a2.12 2.12 0 0 1 3 3L8 19l-4 1z" ' +
      'stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>' +
      '<path d="M14 7l3 3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
    spotlight:
      '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      '<circle cx="12" cy="12" r="4.5" stroke="currentColor" stroke-width="1.6"/>' +
      '<circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.6" ' +
      'stroke-dasharray="2.4 3.2" opacity="0.7"/></svg>',
    eraser:
      '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      '<path d="M8.5 19H20" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>' +
      '<path d="M15.5 5.5l3 3a1.8 1.8 0 0 1 0 2.6L11 18.5H7.4L4.8 15.9a1.8 1.8 0 0 1 0-2.6l8.1-7.8a1.8 1.8 0 0 1 2.6 0z" ' +
      'stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>',
    undo:
      '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      '<path d="M9 7L4 12l5 5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<path d="M4 12h11a5 5 0 0 1 0 10h-2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
    redo:
      '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      '<path d="M15 7l5 5-5 5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<path d="M20 12H9a5 5 0 0 0 0 10h2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
    trash:
      '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      '<path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" ' +
      'stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  };

  /* -----------------------------------------------------------
     Instance state.
  ----------------------------------------------------------- */
  var reveal = null;
  var cfg = null;

  var canvas = null;
  var ctx = null;
  var toolbar = null;

  var mode = MODE.LASER;
  var eraserOn = false;

  // Letterbox map: how the 1280×720 author frame is placed in the viewport.
  var vp = { scale: 1, offsetX: 0, offsetY: 0, w: 1280, h: 720 };

  // Persistent ink, per slide "h.v" → [ stroke ], stroke = {color,width,points:[{x,y}]}
  var inkBySlide = new Map();
  var undoBySlide = new Map();   // "h.v" → [ {type, ...} ]  actions for undo
  var redoBySlide = new Map();
  var currentKey = "0.0";

  // Live ink drawing
  var drawing = false;
  var activePointerId = null;
  var liveStroke = null;

  // Ink brush selection
  var inkColor = null;
  var inkWidth = null;

  // Laser trail (screen space), points {x,y,t}
  var trail = [];
  var laserRAF = 0;

  // Spotlight
  var spotRadius = 140;   // author px
  var spotPos = null;     // {x,y} author coords, null → not shown yet

  // Toolbar auto-hide
  var idleTimer = 0;

  var reduced = false;

  /* ===========================================================
     Small helpers
  =========================================================== */
  function num(v, d) { return typeof v === "number" && isFinite(v) ? v : d; }

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

  function slideKey() {
    var i = reveal.getIndices();
    return i.h + "." + i.v;
  }

  function dpr() {
    return Math.max(1, window.devicePixelRatio || 1);
  }

  /* Recompute the author→screen letterbox from public reveal API.
     Robust replacement for the pointer plugin's regex on body.transform. */
  function computeViewport() {
    var conf = reveal.getConfig();
    var scale = reveal.getScale();
    var rect = reveal.getSlidesElement().getBoundingClientRect();
    vp = {
      scale: scale || 1,
      offsetX: rect.left,
      offsetY: rect.top,
      w: num(conf.width, 1280),
      h: num(conf.height, 720),
    };
  }

  function toAuthor(px, py) {
    return { x: (px - vp.offsetX) / vp.scale, y: (py - vp.offsetY) / vp.scale };
  }
  function toScreen(ax, ay) {
    return { x: vp.offsetX + ax * vp.scale, y: vp.offsetY + ay * vp.scale };
  }

  /* ===========================================================
     Canvas sizing — full viewport at device pixel ratio.
  =========================================================== */
  function sizeCanvas() {
    var ratio = dpr();
    // Guard against a transient 0-size viewport (some embeds/reloads report
    // innerWidth 0 for a frame) so we never leave a 0×0, un-drawable canvas.
    var w = window.innerWidth || document.documentElement.clientWidth || 0;
    var h = window.innerHeight || document.documentElement.clientHeight || 0;
    canvas.width = Math.round(w * ratio);
    canvas.height = Math.round(h * ratio);
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0); // draw in CSS px
  }

  /* ===========================================================
     Persistent ink store
  =========================================================== */
  function inkFor(key) {
    if (!inkBySlide.has(key)) inkBySlide.set(key, []);
    return inkBySlide.get(key);
  }
  function undoStack(key) {
    if (!undoBySlide.has(key)) undoBySlide.set(key, []);
    return undoBySlide.get(key);
  }
  function redoStack(key) {
    if (!redoBySlide.has(key)) redoBySlide.set(key, []);
    return redoBySlide.get(key);
  }

  /* ===========================================================
     Rendering
  =========================================================== */
  function clearFull() {
    // clearRect in CSS px (transform already applied)
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  }

  /* Redraw everything appropriate for the current mode (except the
     live laser trail, which the RAF loop composites on top). */
  function renderStatic() {
    clearFull();
    if (mode === MODE.SPOTLIGHT) {
      paintSpotlight();
      return;
    }
    // INK + IDLE both show persisted strokes for the current slide.
    paintInk();
  }

  function strokePath(points) {
    if (!points.length) return;
    if (points.length === 1) {
      var p0 = toScreen(points[0].x, points[0].y);
      ctx.beginPath();
      ctx.arc(p0.x, p0.y, ctx.lineWidth / 2, 0, Math.PI * 2);
      ctx.fillStyle = ctx.strokeStyle;
      ctx.fill();
      return;
    }
    var first = toScreen(points[0].x, points[0].y);
    ctx.beginPath();
    ctx.moveTo(first.x, first.y);
    for (var i = 1; i < points.length; i++) {
      var a = toScreen(points[i - 1].x, points[i - 1].y);
      var b = toScreen(points[i].x, points[i].y);
      var mx = (a.x + b.x) / 2;
      var my = (a.y + b.y) / 2;
      ctx.quadraticCurveTo(a.x, a.y, mx, my);
    }
    var last = toScreen(points[points.length - 1].x, points[points.length - 1].y);
    ctx.lineTo(last.x, last.y);
    ctx.stroke();
  }

  function paintInk() {
    var strokes = inkFor(currentKey);
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (var i = 0; i < strokes.length; i++) {
      var s = strokes[i];
      ctx.strokeStyle = s.color;
      ctx.lineWidth = Math.max(0.5, s.width * vp.scale);
      strokePath(s.points);
    }
    ctx.restore();
  }

  /* Spotlight: dark wash minus a soft radial hole at the cursor. */
  function paintSpotlight() {
    var W = window.innerWidth;
    var H = window.innerHeight;
    ctx.save();
    ctx.fillStyle = cfg.spotlight.dim;
    ctx.fillRect(0, 0, W, H);
    if (spotPos) {
      var c = toScreen(spotPos.x, spotPos.y);
      var rOuter = spotRadius * vp.scale;
      var inner = clamp(cfg.spotlight.softness, 0.05, 0.95);
      var g = ctx.createRadialGradient(c.x, c.y, rOuter * inner, c.x, c.y, rOuter);
      g.addColorStop(0, "rgba(0,0,0,1)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(c.x, c.y, rOuter, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /* ===========================================================
     Vanishing laser — RAF fade, comet trail.
  =========================================================== */
  function armLaser() {
    if (laserRAF) return;
    laserRAF = requestAnimationFrame(laserFrame);
  }

  function laserFrame() {
    laserRAF = 0;
    var now = performance.now();
    var life = cfg.laser.lifetime;

    // Drop expired points.
    while (trail.length && now - trail[0].t > life) trail.shift();

    clearFull();

    if (!trail.length) return; // nothing left → stop scheduling

    if (reduced) {
      // Reduced motion: just a plain head dot, no comet.
      var head = trail[trail.length - 1];
      ctx.save();
      ctx.fillStyle = cfg.laser.core;
      ctx.beginPath();
      ctx.arc(head.x, head.y, cfg.laser.dotRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      laserRAF = requestAnimationFrame(laserFrame);
      return;
    }

    // Two-pass glow: wide low-alpha halo under a thin bright core.
    drawTrailPass(now, life, cfg.laser.halo, cfg.laser.maxWidth + 6, cfg.laser.glowBlur);
    drawTrailPass(now, life, cfg.laser.core, cfg.laser.maxWidth, 0);

    // Bright head dot with bloom.
    var h = trail[trail.length - 1];
    var headAlpha = 1 - (now - h.t) / life;
    ctx.save();
    ctx.globalAlpha = clamp(headAlpha, 0, 1);
    ctx.shadowColor = cfg.laser.core;
    ctx.shadowBlur = cfg.laser.glowBlur;
    ctx.fillStyle = cfg.laser.core;
    ctx.beginPath();
    ctx.arc(h.x, h.y, cfg.laser.dotRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    laserRAF = requestAnimationFrame(laserFrame);
  }

  function easeOut(t) { return 1 - Math.pow(1 - t, 2); }

  /* Draw one tapered, faded pass along the trail as short segments so we
     can vary width + alpha head→tail without a single flat stroke. */
  function drawTrailPass(now, life, color, headWidth, blur) {
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = color;
    if (blur) {
      ctx.shadowColor = color;
      ctx.shadowBlur = blur;
    }
    var n = trail.length;
    for (var i = 1; i < n; i++) {
      var p0 = trail[i - 1];
      var p1 = trail[i];
      var frac = i / (n - 1);                    // 0 tail → 1 head
      var age = (now - p1.t) / life;             // 0 fresh → 1 gone
      var alpha = easeOut(clamp(1 - age, 0, 1));
      var w = cfg.laser.minWidth + (headWidth - cfg.laser.minWidth) * frac;
      ctx.globalAlpha = alpha;
      ctx.lineWidth = Math.max(0.5, w);
      ctx.beginPath();
      // midpoint smoothing for a fluid comet
      var mx = (p0.x + p1.x) / 2;
      var my = (p0.y + p1.y) / 2;
      ctx.moveTo(p0.x, p0.y);
      ctx.quadraticCurveTo(p0.x, p0.y, mx, my);
      ctx.lineTo(p1.x, p1.y);
      ctx.stroke();
    }
    ctx.restore();
  }

  function pushLaserPoint(px, py) {
    trail.push({ x: px, y: py, t: performance.now() });
    // hard cap so a long stationary sweep never grows unbounded
    if (trail.length > 400) trail.shift();
    armLaser();
  }

  /* ===========================================================
     Pointer handling
  =========================================================== */
  function onPointerDown(e) {
    revealToolbar();
    if (mode === MODE.INK) {
      if (e.button != null && e.button !== 0) return;
      canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
      activePointerId = e.pointerId;
      drawing = true;
      var a = toAuthor(e.clientX, e.clientY);
      if (eraserOn) {
        eraseAt(a.x, a.y);
      } else {
        liveStroke = { color: inkColor, width: inkWidth, points: [a] };
        renderStatic();
        drawLiveHead(liveStroke);
      }
      e.preventDefault();
    }
  }

  function onPointerMove(e) {
    // laser + spotlight both react to bare movement (no button needed)
    if (mode === MODE.LASER) {
      pushLaserPoint(e.clientX, e.clientY);
      return;
    }
    if (mode === MODE.SPOTLIGHT) {
      spotPos = toAuthor(e.clientX, e.clientY);
      renderStatic();
      return;
    }
    if (mode === MODE.INK && drawing && e.pointerId === activePointerId) {
      var a = toAuthor(e.clientX, e.clientY);
      if (eraserOn) {
        eraseAt(a.x, a.y);
      } else if (liveStroke) {
        var prev = liveStroke.points[liveStroke.points.length - 1];
        // skip sub-pixel jitter (author space)
        if (Math.abs(a.x - prev.x) + Math.abs(a.y - prev.y) >= 0.75) {
          liveStroke.points.push(a);
          drawLiveSegment(prev, a, liveStroke.color, liveStroke.width);
        }
      }
      e.preventDefault();
    }
  }

  function onPointerUp(e) {
    if (mode === MODE.INK && drawing && e.pointerId === activePointerId) {
      drawing = false;
      activePointerId = null;
      canvas.releasePointerCapture && canvas.releasePointerCapture(e.pointerId);
      if (!eraserOn && liveStroke && liveStroke.points.length) {
        commitStroke(liveStroke);
      }
      liveStroke = null;
      renderStatic();
      e.preventDefault();
    }
  }

  // Incrementally draw the just-added segment (low latency) on top of
  // the already-rendered static ink. Colour/width are passed in so the
  // same painters serve the local pen AND remote (presenter) strokes.
  function drawLiveSegment(prevAuthor, curAuthor, color, width) {
    var a = toScreen(prevAuthor.x, prevAuthor.y);
    var b = toScreen(curAuthor.x, curAuthor.y);
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(0.5, width * vp.scale);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.restore();
  }
  function drawLiveHead(stroke) {
    if (!stroke || !stroke.points.length) return;
    var p = stroke.points[0];
    var s = toScreen(p.x, p.y);
    ctx.save();
    ctx.fillStyle = stroke.color;
    ctx.beginPath();
    ctx.arc(s.x, s.y, Math.max(0.5, stroke.width * vp.scale) / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /* ===========================================================
     Ink mutations (undo/redo aware) — immutable-ish action log.
  =========================================================== */
  function commitStroke(stroke) {
    var key = currentKey;
    inkFor(key).push(stroke);
    undoStack(key).push({ type: "add", stroke: stroke });
    redoBySlide.set(key, []); // any new action clears redo
    emitStroke(stroke);
  }

  function eraseAt(ax, ay) {
    var key = currentKey;
    var strokes = inkFor(key);
    // hit-test from topmost stroke down
    for (var i = strokes.length - 1; i >= 0; i--) {
      if (strokeHit(strokes[i], ax, ay)) {
        var removed = strokes.splice(i, 1)[0];
        undoStack(key).push({ type: "erase", stroke: removed, index: i });
        redoBySlide.set(key, []);
        renderStatic();
        return;
      }
    }
  }

  function strokeHit(stroke, ax, ay) {
    var tol = ERASE_HIT + stroke.width / 2;
    var pts = stroke.points;
    if (pts.length === 1) {
      return dist2(pts[0].x, pts[0].y, ax, ay) <= tol * tol;
    }
    for (var i = 1; i < pts.length; i++) {
      if (segDist2(pts[i - 1], pts[i], ax, ay) <= tol * tol) return true;
    }
    return false;
  }
  function dist2(x1, y1, x2, y2) { var dx = x1 - x2, dy = y1 - y2; return dx * dx + dy * dy; }
  function segDist2(p, q, x, y) {
    var vx = q.x - p.x, vy = q.y - p.y;
    var wx = x - p.x, wy = y - p.y;
    var len = vx * vx + vy * vy;
    var t = len ? clamp((wx * vx + wy * vy) / len, 0, 1) : 0;
    var cx = p.x + t * vx, cy = p.y + t * vy;
    return dist2(cx, cy, x, y);
  }

  function undo() {
    var key = currentKey;
    var us = undoStack(key);
    if (!us.length) return;
    var action = us.pop();
    var strokes = inkFor(key);
    if (action.type === "add") {
      var idx = strokes.indexOf(action.stroke);
      if (idx !== -1) strokes.splice(idx, 1);
    } else if (action.type === "erase") {
      strokes.splice(Math.min(action.index, strokes.length), 0, action.stroke);
    } else if (action.type === "clear") {
      // restore every stroke wiped by a Clear
      inkBySlide.set(key, action.strokes.slice());
    }
    redoStack(key).push(action);
    renderStatic();
    syncToolbarState();
  }

  function redo() {
    var key = currentKey;
    var rs = redoStack(key);
    if (!rs.length) return;
    var action = rs.pop();
    var strokes = inkFor(key);
    if (action.type === "add") {
      strokes.push(action.stroke);
    } else if (action.type === "erase") {
      var i = strokes.indexOf(action.stroke);
      if (i !== -1) strokes.splice(i, 1);
    } else if (action.type === "clear") {
      inkBySlide.set(key, []);
    }
    undoStack(key).push(action);
    renderStatic();
    syncToolbarState();
  }

  function clear() {
    var key = currentKey;
    var strokes = inkFor(key);
    if (!strokes.length) return;
    var snapshot = strokes.slice();
    inkBySlide.set(key, []);
    undoStack(key).push({ type: "clear", strokes: snapshot });
    redoBySlide.set(key, []);
    renderStatic();
    syncToolbarState();
  }

  function clearAll() {
    inkBySlide = new Map();
    undoBySlide = new Map();
    redoBySlide = new Map();
    renderStatic();
    syncToolbarState();
  }

  /* ===========================================================
     Mode switching
  =========================================================== */
  // Single source of truth for "what the DOM looks like for `mode`".
  // Called by setMode AND once at init so the default mode's classes are
  // present from frame one (setMode's no-op early-return would skip them).
  function applyModeClasses() {
    var rc = reveal.getRevealElement();
    rc.classList.remove("marker-mode-idle", "marker-mode-laser", "marker-mode-ink", "marker-mode-spotlight");
    rc.classList.add("marker-mode-" + mode);
    // INK is the only mode that captures pointer events (so the pen draws);
    // laser/spotlight stay click-through so slide UI still works.
    canvas.classList.toggle("is-drawable", mode === MODE.INK);
  }

  function setMode(next) {
    if (!next) next = MODE.LASER;
    if (next === mode) { applyModeClasses(); return mode; }
    // leave current
    if (mode === MODE.LASER) {
      trail = [];
      if (laserRAF) { cancelAnimationFrame(laserRAF); laserRAF = 0; }
    }
    mode = next;
    eraserOn = false;

    applyModeClasses();

    clearFull();
    if (mode === MODE.SPOTLIGHT) {
      spotPos = null;
      renderStatic();
    } else if (mode === MODE.INK || mode === MODE.IDLE) {
      renderStatic();
    }
    revealToolbar();
    syncToolbarState();
    return mode;
  }

  /* Toggle a mode against IDLE (used by the customcontrols buttons). */
  function toggle(target) {
    if (!target) target = MODE.INK;
    return setMode(mode === target ? MODE.IDLE : target);
  }

  function setColor(c) {
    inkColor = c;
    eraserOn = false;
    if (mode !== MODE.INK) setMode(MODE.INK);
    syncToolbarState();
  }
  function setWidth(w) {
    inkWidth = w;
    if (mode !== MODE.INK) setMode(MODE.INK);
    syncToolbarState();
  }
  function eraser(on) {
    eraserOn = on == null ? !eraserOn : !!on;
    if (eraserOn && mode !== MODE.INK) setMode(MODE.INK);
    syncToolbarState();
  }

  function setSpotRadius(r) {
    spotRadius = clamp(r, MIN_RADIUS, MAX_RADIUS);
    if (mode === MODE.SPOTLIGHT) renderStatic();
  }

  /* ===========================================================
     Toolbar
  =========================================================== */
  function buildToolbar() {
    toolbar = document.createElement("div");
    toolbar.className = "marker-toolbar";
    toolbar.setAttribute("role", "toolbar");
    toolbar.setAttribute("aria-label", "Annotation tools");

    // Mode buttons
    toolbar.appendChild(iconButton("laser", ICON.laser, "Laser (L)", function () { setMode(MODE.LASER); }));
    toolbar.appendChild(iconButton("ink", ICON.pen, "Marker (M)", function () { toggle(MODE.INK); }));
    toolbar.appendChild(iconButton("spotlight", ICON.spotlight, "Spotlight (K)", function () { toggle(MODE.SPOTLIGHT); }));

    toolbar.appendChild(divider());

    // Colours
    var sw = document.createElement("div");
    sw.className = "marker-swatches";
    cfg.ink.colors.forEach(function (c) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "marker-swatch";
      b.style.background = c;
      b.setAttribute("data-color", c);
      b.setAttribute("aria-label", "Ink colour " + c);
      b.addEventListener("click", function () { setColor(c); });
      sw.appendChild(b);
    });
    toolbar.appendChild(sw);

    // Widths
    var wr = document.createElement("div");
    wr.className = "marker-widths";
    cfg.ink.widths.forEach(function (w) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "marker-width";
      b.setAttribute("data-width", String(w));
      b.setAttribute("aria-label", "Pen width " + w);
      var dot = document.createElement("span");
      dot.className = "marker-width__dot";
      var d = clamp(4 + w, 6, 16);
      dot.style.width = d + "px";
      dot.style.height = d + "px";
      b.appendChild(dot);
      b.addEventListener("click", function () { setWidth(w); });
      wr.appendChild(b);
    });
    toolbar.appendChild(wr);

    toolbar.appendChild(divider());

    // Eraser / undo / redo / clear
    toolbar.appendChild(iconButton("eraser", ICON.eraser, "Eraser (E)", function () { eraser(); }));
    toolbar.appendChild(iconButton("undo", ICON.undo, "Undo (Z)", function () { undo(); }));
    toolbar.appendChild(iconButton("redo", ICON.redo, "Redo (Y)", function () { redo(); }));
    toolbar.appendChild(iconButton("clear", ICON.trash, "Clear slide (X)", function () { clear(); }));

    reveal.getRevealElement().appendChild(toolbar);
  }

  function iconButton(name, svg, title, onClick) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "marker-btn";
    b.setAttribute("data-marker-btn", name);
    b.setAttribute("title", title);
    b.setAttribute("aria-label", title);
    b.innerHTML = svg;
    b.addEventListener("click", function (e) {
      e.preventDefault();
      onClick();
      revealToolbar();
    });
    return b;
  }
  function divider() {
    var d = document.createElement("div");
    d.className = "marker-toolbar__divider";
    return d;
  }

  /* Reflect state (pressed buttons, active swatch/width, undo/redo enabled). */
  function syncToolbarState() {
    if (!toolbar) return;
    setPressed("laser", mode === MODE.LASER);
    setPressed("ink", mode === MODE.INK && !eraserOn);
    setPressed("spotlight", mode === MODE.SPOTLIGHT);
    setPressed("eraser", eraserOn);

    toolbar.querySelectorAll(".marker-swatch").forEach(function (el) {
      el.setAttribute("aria-pressed", String(el.getAttribute("data-color") === inkColor));
    });
    toolbar.querySelectorAll(".marker-width").forEach(function (el) {
      el.setAttribute("aria-pressed", String(Number(el.getAttribute("data-width")) === inkWidth));
    });

    var us = undoBySlide.get(currentKey);
    var rs = redoBySlide.get(currentKey);
    disable("undo", !(us && us.length));
    disable("redo", !(rs && rs.length));
    disable("clear", !(inkBySlide.get(currentKey) && inkBySlide.get(currentKey).length));
  }
  function setPressed(name, on) {
    var b = toolbar.querySelector('[data-marker-btn="' + name + '"]');
    if (b) b.setAttribute("aria-pressed", String(!!on));
  }
  function disable(name, on) {
    var b = toolbar.querySelector('[data-marker-btn="' + name + '"]');
    if (b) { if (on) b.setAttribute("disabled", ""); else b.removeAttribute("disabled"); }
  }

  function revealToolbar() {
    if (!toolbar) return;
    toolbar.classList.remove("is-hidden");
    if (!cfg.toolbar.autoHide) return;
    clearTimeout(idleTimer);
    idleTimer = setTimeout(function () {
      // never hide mid-stroke
      if (drawing) { revealToolbar(); return; }
      toolbar.classList.add("is-hidden");
    }, cfg.toolbar.idleMs);
  }

  /* ===========================================================
     Slide change / resize
  =========================================================== */
  function onSlideChanged() {
    currentKey = slideKey();
    computeViewport();
    // Laser is ephemeral → always cleared on slide change.
    trail = [];
    if (laserRAF) { cancelAnimationFrame(laserRAF); laserRAF = 0; }
    spotPos = null;
    renderStatic(); // repaint this slide's persistent ink (per-slide model)
    syncToolbarState();
  }

  function onResize() {
    sizeCanvas();
    computeViewport();
    // Persistent ink is stored in author coords → re-render pins it to the
    // slide at the new scale. Laser is screen-space + ephemeral, drop it.
    trail = [];
    renderStatic();
  }

  /* ===========================================================
     Keyboard
  =========================================================== */
  function onKeyDown(e) {
    // Don't hijack typing in inputs / editable regions.
    var t = e.target;
    if (t && (t.isContentEditable || /^(input|textarea|select)$/i.test(t.tagName))) return;

    // Ctrl/Cmd+Z / +Y handled explicitly.
    if ((e.ctrlKey || e.metaKey) && !e.altKey) {
      var k = e.key.toLowerCase();
      if (k === "z") { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
      if (k === "y") { e.preventDefault(); redo(); return; }
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    var key = e.key;
    switch (key) {
      case "l": case "L": setMode(MODE.LASER); e.preventDefault(); break;
      case "m": case "M": toggle(MODE.INK); e.preventDefault(); break;
      case "k": case "K": toggle(MODE.SPOTLIGHT); e.preventDefault(); break;
      case "e": case "E": eraser(); e.preventDefault(); break;
      case "z": case "Z": undo(); e.preventDefault(); break;
      case "y": case "Y": redo(); e.preventDefault(); break;
      case "x": clear(); e.preventDefault(); break;
      case "X": clearAll(); e.preventDefault(); break;
      case "Escape": if (mode !== MODE.IDLE) { setMode(MODE.IDLE); e.preventDefault(); } break;
      case "1": case "2": case "3": case "4": case "5":
        var idx = Number(key) - 1;
        if (cfg.ink.colors[idx]) { setColor(cfg.ink.colors[idx]); e.preventDefault(); }
        break;
      case "[":
        if (mode === MODE.SPOTLIGHT) { setSpotRadius(spotRadius - 20); }
        else { stepWidth(-1); }
        e.preventDefault();
        break;
      case "]":
        if (mode === MODE.SPOTLIGHT) { setSpotRadius(spotRadius + 20); }
        else { stepWidth(1); }
        e.preventDefault();
        break;
      default: return;
    }
    revealToolbar();
  }

  function stepWidth(dir) {
    var widths = cfg.ink.widths;
    var i = widths.indexOf(inkWidth);
    if (i === -1) i = 0;
    i = clamp(i + dir, 0, widths.length - 1);
    setWidth(widths[i]);
  }

  function onWheel(e) {
    if (mode !== MODE.SPOTLIGHT || !cfg.spotlight.wheelResize) return;
    setSpotRadius(spotRadius + (e.deltaY < 0 ? 16 : -16));
    e.preventDefault();
  }

  /* ===========================================================
     Public serialize / load (author-space; collab + PDF seam)
  =========================================================== */
  function serialize() {
    var out = {};
    inkBySlide.forEach(function (strokes, key) {
      if (strokes.length) out[key] = strokes.map(function (s) {
        return { color: s.color, width: s.width, points: s.points.map(function (p) { return { x: p.x, y: p.y }; }) };
      });
    });
    return out;
  }
  function loadInk(json) {
    inkBySlide = new Map();
    undoBySlide = new Map();
    redoBySlide = new Map();
    if (json && typeof json === "object") {
      Object.keys(json).forEach(function (key) {
        var strokes = (json[key] || []).map(function (s) {
          return { color: s.color, width: s.width, points: (s.points || []).slice() };
        });
        inkBySlide.set(key, strokes);
      });
    }
    renderStatic();
    syncToolbarState();
  }

  function emitStroke(stroke) {
    if (typeof api.onStroke === "function") {
      try { api.onStroke(stroke); } catch (err) { /* host callback must never break drawing */ }
    }
  }

  /* ===========================================================
     Remote driving — presenter console via deck-link.js.
     nx/ny arrive 0..1 normalized to the slide viewport; multiply
     by the author frame (vp.w × vp.h) to land in author space so
     remote input renders EXACTLY like local input at any scale.
     Every entry point no-ops when the plugin is inert (peek/print
     or not yet initialised): ctx is the mounted-ness sentinel.
  =========================================================== */
  var remoteStroke = null;

  function remoteToAuthor(nx, ny) {
    return {
      x: clamp(num(nx, 0), 0, 1) * vp.w,
      y: clamp(num(ny, 0), 0, 1) * vp.h,
    };
  }

  function setTool(name) {
    if (!ctx) return mode;
    if (name === MODE.LASER || name === MODE.INK || name === MODE.SPOTLIGHT) {
      return setMode(name);
    }
    return setMode(MODE.IDLE); // null / unknown → tools down
  }

  function remotePointerMove(nx, ny) {
    if (!ctx) return;
    var a = remoteToAuthor(nx, ny);
    if (mode === MODE.LASER) {
      var s = toScreen(a.x, a.y);
      pushLaserPoint(s.x, s.y); // same trail as local → identical comet
    } else if (mode === MODE.SPOTLIGHT) {
      spotPos = a;
      renderStatic();
    }
  }

  function remotePointerHide() {
    if (!ctx) return;
    // Laser needs no explicit hide — the comet trail vanishes on its own.
    if (mode === MODE.SPOTLIGHT) {
      spotPos = null;
      renderStatic();
    }
  }

  function remoteStrokeStart(nx, ny) {
    if (!ctx) return;
    if (mode !== MODE.INK) setMode(MODE.INK);
    remoteStroke = { color: inkColor, width: inkWidth, points: [remoteToAuthor(nx, ny)] };
    renderStatic();
    drawLiveHead(remoteStroke);
  }

  function remoteStrokePoint(nx, ny) {
    if (!ctx || !remoteStroke) return;
    var a = remoteToAuthor(nx, ny);
    var prev = remoteStroke.points[remoteStroke.points.length - 1];
    // skip sub-pixel jitter (author space) — same gate as the local pen
    if (Math.abs(a.x - prev.x) + Math.abs(a.y - prev.y) >= 0.75) {
      remoteStroke.points.push(a);
      drawLiveSegment(prev, a, remoteStroke.color, remoteStroke.width);
    }
  }

  function remoteStrokeEnd() {
    if (!ctx || !remoteStroke) return;
    if (remoteStroke.points.length) commitStroke(remoteStroke);
    remoteStroke = null;
    renderStatic();
    syncToolbarState();
  }

  /* ===========================================================
     Config merge
  =========================================================== */
  function mergeConfig(user) {
    user = user || {};
    function pick(a, b) {
      var o = {};
      for (var k in a) o[k] = a[k];
      if (b) for (var j in b) if (b[j] !== undefined) o[j] = b[j];
      return o;
    }
    return {
      defaultMode: user.defaultMode || DEFAULTS.defaultMode,
      laser: pick(DEFAULTS.laser, user.laser),
      ink: pick(DEFAULTS.ink, user.ink),
      spotlight: pick(DEFAULTS.spotlight, user.spotlight),
      toolbar: pick(DEFAULTS.toolbar, user.toolbar),
      respectReducedMotion:
        user.respectReducedMotion === undefined ? DEFAULTS.respectReducedMotion : user.respectReducedMotion,
    };
  }

  /* ===========================================================
     Reveal plugin entry
  =========================================================== */
  function init(deck) {
    reveal = deck;
    cfg = mergeConfig((deck.getConfig() || {}).marker);

    // Do NOT mount any draw chrome in print/PDF or peek — clean exports.
    var isPrint = /print-pdf/.test(location.search);
    var isPeek = new URLSearchParams(location.search).get("present") === "peek";
    if (isPrint || isPeek) {
      return; // plugin is inert; API methods below become safe no-ops
    }

    inkColor = cfg.ink.defaultColor;
    inkWidth = cfg.ink.defaultWidth;
    spotRadius = num(cfg.spotlight.radius, 140);

    reduced =
      cfg.respectReducedMotion &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Canvas
    canvas = document.createElement("canvas");
    canvas.className = "marker-overlay";
    canvas.setAttribute("aria-hidden", "true");
    ctx = canvas.getContext("2d");
    reveal.getRevealElement().appendChild(canvas);
    sizeCanvas();

    buildToolbar();

    // Geometry + first paint after reveal is laid out.
    reveal.on("ready", function () {
      currentKey = slideKey();
      computeViewport();
      setMode(cfg.defaultMode === "idle" ? MODE.IDLE : cfg.defaultMode);
      renderStatic();
      revealToolbar();
    });
    reveal.on("slidechanged", onSlideChanged);
    reveal.on("slidetransitionend", function () { computeViewport(); renderStatic(); });
    reveal.on("resize", onResize);
    reveal.on("overviewshown", function () { if (toolbar) toolbar.classList.add("is-hidden"); });
    reveal.on("overviewhidden", function () { computeViewport(); renderStatic(); revealToolbar(); });

    // Pointer + wheel on the canvas / window.
    canvas.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove, { passive: false });
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("resize", onResize);

    // Keyboard — window-level so it works regardless of focus, but yields
    // inside inputs. Reveal's own bindings (S=notes, B/F/O/arrows) are left
    // untouched because we only claim L/M/K/E/Z/Y/X and 1–5/[/].
    window.addEventListener("keydown", onKeyDown, true);

    // If ready already fired (defensive), initialise now.
    if (reveal.isReady && reveal.isReady()) {
      currentKey = slideKey();
      computeViewport();
      setMode(cfg.defaultMode === "idle" ? MODE.IDLE : cfg.defaultMode);
      renderStatic();
    }
  }

  /* Public API — reveal plugin contract. */
  var api = {
    id: "marker",
    init: init,
    setMode: function (m) { return setMode(m); },
    toggle: function (m) { return toggle(m); },
    setColor: setColor,
    setWidth: setWidth,
    eraser: eraser,
    undo: undo,
    redo: redo,
    clear: clear,
    clearAll: clearAll,
    getMode: function () { return mode; },
    getInk: function () { return serialize(); },
    loadInk: loadInk,
    onStroke: null,
    /* Remote API — the presenter console drives these via deck-link.js. */
    setTool: setTool,
    pointerMove: remotePointerMove,
    pointerHide: remotePointerHide,
    strokeStart: remoteStrokeStart,
    strokePoint: remoteStrokePoint,
    strokeEnd: remoteStrokeEnd,
    clearInk: clear,
  };
  return api;
})();

// Some bundlers/importers look for a default-ish export; keep the global.
if (typeof window !== "undefined") {
  window.RevealMarker = RevealMarker;
  window.__fmntsMarker = RevealMarker; // stable handle for deck-link.js remote driving
}
