# FORMUNAUTS Deck → Production Presentation Tool — Authoritative Build Spec

**Status:** implementation-ready. Merged and reconciled from five research tracks (presenter view, marker/annotation, in-slide interactivity, brand/logo + slide redesign, live collaboration).
**Scope:** upgrade the vendored reveal.js 6.0.1 deck at `/Users/samuelzierlinger/Documents/Cowork/Claude Code/formunauts-demo/demo-deck` into a presenter-grade, interactive, optionally-collaborative tool — while preserving the CONTENT/CHROME split and guaranteeing clean static/PDF degradation.

---

## 0. Ground truth (verified against the codebase — read this before touching anything)

Every line-number reference in the source research was **re-verified**; several were stale. This spec anchors edits to **selectors and exact code snippets**, not line numbers. Verified facts:

| Fact | Verified value | Consequence |
|---|---|---|
| Host / origin | `python3 -m http.server 8748` via `.claude/launch.json` (name `deck`); `package.json` also has `npm run serve` (`npx serve`) | **Same-origin** → BroadcastChannel works; reveal `file://` fragility avoided. |
| Reveal version | 6.0.1 vendored at `dist/reveal.js` | All APIs below confirmed present. |
| Reveal APIs present | `getIndices, getTotalSlides, getSlidePastCount, getScale, getSlidesElement, getState, setState, isPaused, togglePause, toggleOverview, addKeyBinding, getSlideNotes, on()` | Presenter + marker + interactivity can rely on them. `BroadcastChannel` count in reveal = 0 (we add it). |
| `index.html` | **112 lines total.** Plugins wired: `RevealNotes, RevealChalkboard, RevealCustomControls, RevealPointer`. customcontrols has exactly 2 draw buttons. Print gate = `location.search.includes("print-pdf")` → `body.print-pdf` + fills `.count-up`. | Integration points are the module script block + `Reveal.initialize` config object + the customcontrols array. |
| Notes ARE in the DOM | `render.js` injects `<aside class="notes">${esc(slide.notes)}</aside>` for every slide with `notes`. `plugin/notes.js` id `notes`, exposes `.open()`, binds `S`. | "Speaking text not in here" = **transport/discoverability**, not missing data. Notes plugin uses `window.open('about:blank')`+`document.write`+500ms `postMessage` handshake — the fragile mechanism we bypass. |
| Pointer plugin | global `RevealPointer`, plugin id `pointer`, key `q`. Reads `document.body.style.transform` with regex `scale\((.)\)` — **single-digit scale only, wrong element in v6**. | Fragile. The marker plugin replaces it with `Reveal.getScale()`. |
| Chalkboard | global `RevealChalkboard`, id `RevealChalkboard`, exposes `toggleNotesCanvas()`, `toggleChalkboard()`. Ink is permanent, off-brand, no fade. | Replaced by the marker plugin (kept available only if the user still wants a full whiteboard — see §1.1 decision). |
| customcontrols | builds `<li><button onclick="<action>">{icon}</button>`, raw `icon` innerHTML (inline SVG OK). Its container `#customcontrols` is `z-index:40`; `deck.css` already forces it to `right:12px; bottom:50px`. | New marker toolbar sits above at `z-index:60`. |
| Canvas | `1280×720`, `.slides section { width:1280px; height:720px; overflow:hidden }`. Reveal scales `.slides` via `transform: translate(-50%,-50%) scale(S)`. Config `width:1280,height:720,margin:0,center:false,fragments:false`. | Coordinate math for marker/pointer uses `getScale()` + `getSlidesElement().getBoundingClientRect()`; native DOM events (click/focus/input) need **zero** coord math. |
| Backgrounds / greys | `.reveal .backgrounds { background: var(--bg-base) }` where `--bg-base = #F8F9FA`. `.slide--light` = `--bg-base` (grey). `.slide--muted` = `--bg-muted` = `#F2F4F5` (greyer). `--blue-50 = #F3F8FD` exists. | The "grayish bg" is real and two-fold — fixed in §2 deck.css. |
| Rocket art | `assets/logos/formunauts_visual_{blue,white}.svg` = `viewBox 0 0 360 360`, 1:1, nose/flame top-right, exhaust bottom-left. Cover uses white SVG. `.rocket-mark { opacity:.10; height:560px }`, `--tr { top:-120px; right:-110px }`. | "Rocket cut off" confirmed — the nose is shoved off-canvas. Fixed in §2. |
| `orbit()` SVG | `viewBox 0 0 760 760`, rings r=300/230, dot at (620,300). Rendered into `.orbit--br` / `.orbit--tl` (both 760×760 boxes). | Ring resizing in §2 must keep the 760 viewBox in mind (scale the box, not the viewBox). |
| Logo asset dims (sips-verified) | claim-wide-white `4000×1415` (2.827:1); visual-type-blue `4000×1464`; visual-type-white `4000×1466` (≈2.73:1); type-white `4000×400` (10:1). | Drives every logo sizing decision below. |
| Asset ratios in use | `_shared.js RATIO/PX` already correct & sips-verified (e.g. `reinhard-intro-1.png` 914×1658 = 0.55 tall; planned 890×1112 = 0.80; banner 3168×792 = 4:1; cards 2198×745 = 2.95:1). All 11 imgs present in `assets/img/2026-07-01/`. | Ambassador restructure (§2) reuses these frames verbatim. |
| Slide 09 today | `archetype:"overviewBullets", variant:"quiet", chrome:"dark", columns:[{title,items[]}]` handled by `overviewBullets.js quiet()`. | The "behind the scenes" redesign either edits data in place OR swaps to a new `statusBoard` archetype — decision in §2 FIX-9. |
| `runCountUp` | Defined in `anim.js` but **not exported** (only `initAnim` is). | Interactivity's count-replay needs it exported — one-word edit in §2. |

**Two non-negotiable contracts that every feature obeys:**
1. **CONTENT/CHROME split.** `decks/*.deck.js` stays 100% declarative (a non-dev edits only strings + new `data-fx`/`status`-style fields). All logic lives in CHROME (`template/*`, `plugin/*`, `index.html`). New per-fortnight demo = new data file, zero JS/CSS edits.
2. **Degrade to clean static/PDF.** Every new feature force-renders a fully-readable static state under `body.print-pdf` (and the presenter "peek" iframe), and no-ops safely when its dependency (channel, server, JS) is absent. The static export must show **more** than today, never less.

---

## 1. New files to create (NEW files only — exact paths)

All paths under `/Users/samuelzierlinger/Documents/Cowork/Claude Code/formunauts-demo/demo-deck/`.

### 1.1 Marker / annotation plugin — `plugin/marker/`

One custom reveal plugin that **replaces both** the vendored `pointer` and `chalkboard` plugins with a single on-brand annotation system: Google-style vanishing laser (default) + persistent ink toggle + spotlight + auto-hiding brand toolbar. CDN-free, inline SVG only (no Font Awesome, no emoji).

> **Reconciliation decision (marker is ONE system).** The research proposed three overlapping draw layers (`plugin/marker/`, `template/presenter/ink.js`, `template/present-tools.js`). We ship exactly **one**: the `plugin/marker/` plugin. It is a proper reveal plugin (`id` + `init(deck)` + public methods callable as `RevealMarker.method()`), it fixes the fragile pointer transform read, and it exposes `setMode()/toggle()` that the presenter view drives over the channel and customcontrols drives via `onclick`. The `ink.js` and `present-tools.js` variants are **dropped** to avoid two canvases fighting for the same viewport.

| File | Purpose |
|---|---|
| `plugin/marker/plugin.js` | State machine (`idle/laser/ink/spotlight`), one viewport-sized `<canvas class="marker-overlay">`, laser RAF fade, per-slide vector ink model, spotlight, brand toolbar, keybindings, reveal wiring. Self-executing global `window.RevealMarker`. Target ≤700 lines; split if it nears the 800 ceiling. |
| `plugin/marker/marker.css` | Overlay + spotlight + toolbar styles, token-driven (`--fmnts-*`, `--radius-pill`, `--elevation-*`, `--ease-out-expo`). Print + reduced-motion guards. |
| `plugin/marker/icons.js` | Hand-authored 24×24 inline SVG strings: laser, pen, highlighter, eraser, undo, redo, spotlight, palette, trash. Imported by `plugin.js` (or inlined if kept as a global). |

**Architecture (crux = coordinate conversion, done the robust way):**
- One `<canvas class="marker-overlay">` appended to `.reveal`, sized `window.innerWidth × innerHeight × devicePixelRatio`, `position:fixed; inset:0; pointer-events:none` by default. **Not** CSS-transformed with the deck — full-viewport, convert coordinates instead (mirrors the chalkboard's proven model, avoids the pointer plugin's brittle regex).
- Recompute the letterbox map on `ready`/`resize`/`slidechanged` from public API:
  ```js
  function computeViewport() {
    const cfg = Reveal.getConfig();                        // width:1280, height:720
    const scale = Reveal.getScale();                       // clean API, not regex
    const rect = Reveal.getSlidesElement().getBoundingClientRect();
    return { scale, offsetX: rect.left, offsetY: rect.top, w: cfg.width, h: cfg.height };
  }
  const toAuthor = (px,py) => ({ x:(px-vp.offsetX)/vp.scale, y:(py-vp.offsetY)/vp.scale });
  const toScreen = (ax,ay) => ({ x:vp.offsetX+ax*vp.scale, y:vp.offsetY+ay*vp.scale });
  ```
- **Persistent ink stored in author (1280×720) coords**, re-rendered through `toScreen` on every resize → ink stays pinned to the slide at any projector resolution. Vanishing laser stays in screen space (ephemeral, one fewer transform/frame).
- Use **`pointer` events** (`pointerdown/move/up`) + `touch-action:none` + `evt.preventDefault()`. `pressure` optionally modulates width.

**Modes (state machine, one active at a time):**
```
IDLE      overlay pointer-events:none, cursor normal
LASER     (default) vanishing comet; pointer-events:none (presenter can still click slide UI); nothing persists
INK       persistent pen; pointer-events:auto; strokes saved per-slide in author coords
SPOTLIGHT dim wash + soft radial hole following cursor; pointer-events:none
```

**Vanishing laser (default), RAF fade:** point buffer `{x,y,time}`; per frame drop points older than `lifetime` (~1200ms), `clearRect` full (no smear), rebuild a smooth Catmull-Rom→Bézier path, taper `lineWidth` head→tail, `alpha = easeOut((now-time)/lifetime)`, two-pass glow (wide low-alpha halo with `shadowBlur` under a thin bright core), plus a filled head dot with bloom. Stop scheduling frames when buffer empties; any `pointermove` re-arms. Ink color = brand `--fmnts-secondary` (#E03B50) here **only** — transient laser red honours the "rare stopper" rule because it never persists.

**Persistent ink:** `inkBySlide = Map("h.v" → [{color,width,points[]}])`. Draw incremental segment on `pointermove` (low latency), commit on `pointerup`, re-render current slide's strokes on slidechange/resize. **Stroke eraser** (vector hit-test, removes whole stroke — undoable, survives resize) is the default; pixel eraser optional. Undo/redo stacks per slide. Colors: brand set `['#0074C8','#1E2A33','#E03B50','#1F8643','#E0A82E']`, default `#0074C8`; widths `[2,4,8]` author px, default 4.

**Spotlight:** dark wash `rgba(4,15,26,0.72)`, punch a soft hole via `globalCompositeOperation='destination-out'` + radial gradient, radius ~140 author px adjustable with `[` `]` / wheel. Optional magnifier gated behind a config flag (v1.1, screenshot-fragile).

**Brand toolbar:** `<div class="marker-toolbar">` appended to `.reveal`, `z-index:60` (above customcontrols' 40). Pill container (`--radius-pill`, `--elevation-4`, `--bg-surface`), 36×36 buttons, hover `--blue-50`, active `--fmnts-primary`/white, `:focus-visible` ring `--border-focus`. Auto-hides after ~3s idle (reset on pointermove), reappears on move/`A`. `@media print { display:none }`. Bottom-center, clear of the ghost numeral (bottom-left) and page-index (bottom-right).

**Public API (reveal plugin contract):**
```js
window.RevealMarker = { id:'marker', init,
  setMode, toggle, setColor, setWidth, eraser, undo, redo, clear, clearAll,
  getInk:()=>serialize(inkBySlide), loadInk:(json)=>{...},   // author-space export (collab/PDF seam)
  onStroke: null };   // optional callback(strokeInAuthorCoords) → future broadcast hook
```

**Config (defaults; omit to accept):**
```js
marker: {
  defaultMode: 'laser',
  laser: { lifetime:1200, headHold:90, tension:0.35, maxWidth:9, minWidth:0, glowBlur:16,
           core:'#E03B50', halo:'rgba(224,59,80,0.35)', dotRadius:6 },
  ink:   { colors:['#0074C8','#1E2A33','#E03B50','#1F8643','#E0A82E'], defaultColor:'#0074C8',
           widths:[2,4,8], defaultWidth:4, eraser:'stroke', persistPerSlide:true },
  spotlight: { radius:140, dim:'rgba(4,15,26,0.72)', softness:0.55, wheelResize:true },
  toolbar: { position:'bottom-center', autoHide:true, idleMs:3000, magnifier:false },
  respectReducedMotion: true
}
```

**Keybindings (via `Reveal.addKeyBinding`, avoiding reveal defaults B/C/F/O/arrows/space):**
`L` laser · `M` ink · `S`… **NOTE: `S` is taken by RevealNotes.** Use `K` for spotlight (not `S`). `E` eraser · `Z`/`Ctrl+Z` undo, `Y` redo · `X` clear slide, `Shift+X` clear all · `1–5` color · `[` `]` size/radius · `Esc` idle.

> **Conflict fix vs research:** the marker track proposed `S` for spotlight, but `S` opens speaker notes (RevealNotes). Rebind spotlight to `K`. Also the marker track and presenter track both wanted `P` — presenter view keeps `P` (open console); marker does not use `P`.

### 1.2 Presenter view — `presenter.html` + `template/presenter/`

A purpose-built presenter console synced to the shared deck over **BroadcastChannel** (same-origin), with a `localStorage` snapshot mirror for late/early joiners. The shared window (`index.html`) stays clean (slide-only, `controls:false, progress:false`); the console is the only place chrome lives. Presenter **drives** shared (single source of truth, no echo loops).

| File | Purpose |
|---|---|
| `presenter.html` | The console document. Loads `template/brand.css` + `presenter.css` + `template/presenter/presenter.js`. Header (wall clock, elapsed timer, pacing, index), current+next slide iframes, big scrollable notes, controls (prev/next/blank/slide-list), status + jump-list regions. `<meta name="robots" content="noindex,nofollow">`. |
| `presenter.css` | Console styling, brand-token-driven so it feels like FORMUNAUTS, not a dev tool. |
| `template/presenter/channel.js` | Shared transport: `CHANNEL="fmnts-deck"`, `SNAPSHOT_KEY="fmnts-deck-state"`, `PROTO=1`, `makeBus(onMessage)` — a null-guarded BroadcastChannel wrapper (falls back gracefully when BC is unavailable, e.g. Safari private mode). Imported by both windows. |
| `template/presenter/deck-link.js` | Imported by `index.html`. Makes the shared deck the broadcaster: on `ready/slidechanged/paused/resumed` it publishes a full `state` snapshot (indices, total, notes innerHTML, title, eyebrow, per-slide `data-timing`, paused) to the channel + mirrors to `localStorage`; executes inbound `cmd` (`next/prev/goto/pause/black`); replies to `hello` (late-joiner). Also owns the `?present=peek` gate (see §3). |
| `template/presenter/presenter.js` | Console logic: channel client, `hello` handshake, `localStorage` hydrate, 2s alive-watchdog, render (index/notes/current+next peek iframes), elapsed timer + wall clock + per-slide pacing (reads `data-timing`, default `defaultTiming:45`), jump list, blank/pause, keyboard (`→/space/PageDown`=next, `←/PageUp`=prev, `b`=black, `g`=jump list). |

**Message vocabulary (small, versioned):**
- deck → presenter: `{t:'state', h,v,f,index,total,notes,title,eyebrow,timing,paused}` (full paint); `{t:'bye'}` on `pagehide`.
- presenter → deck: `{t:'hello'}` (request snapshot); `{t:'cmd', name:'next'|'prev'|'goto'|'pause'|'black', h?,v?}`.
- (marker, optional): `{t:'mark', mode}` if you later want the presenter to switch the shared marker mode remotely — routes to `RevealMarker.setMode()` on the shared side.

**Current/next thumbnails** = `<iframe src="index.html?present=peek#/H/V">` locked to a slide. Peek mode (see §3) strips motion + cursor-hiding + pre-fills count-ups so previews are calm and correct. **All notes/timing/index arrive as channel data — never scraped through the iframe.**

**Jump list** built once from slide titles: deck replies to a `{t:'toc'}` request (iterate `.slides > section`, read `.headline`/`.cover__headline`/`.closing__statement`) OR the presenter imports `decks/2026-07-01.deck.js` directly (same-origin) and maps `slide.headline`. Click → `{t:'cmd', name:'goto', h:i}`.

**Open + popup-block fallback** lives in `index.html` (§2): a `Presenter ▸` button + `P` keybinding call `window.open("presenter.html", ...)`; if blocked, show a branded banner with a real `<a href="presenter.html" target="_blank">Open presenter ↗</a>` (a user-gesture anchor is never popup-blocked).

### 1.3 In-slide interactivity engine — `template/interactive.js` + `template/interactive.css`

One enhancement controller (CHROME) that upgrades plain semantic markup carrying `data-fx-*` attributes into interactive components, and degrades every one to a fully-visible static state under print/peek. Progressive-enhancement: if JS fails, the raw markup is already a clean readable slide.

| File | Purpose |
|---|---|
| `template/interactive.js` | `initInteractive(Reveal)`: behaviour registry keyed by `data-fx`; idempotent `enhance()` (guarded by `data-fx-enhanced="1"`); runs on `ready`, per-slide on `slidechanged`, and re-asserts on `overviewhidden`. Print/peek/`data-fx-static="open"`/thrown-error → shared `staticState(el)` renderer. Behaviours: `funnel, carousel, slider, reveal-card, count-replay`. |
| `template/interactive.css` | Token-only styles for all five behaviours + a11y focus rings + reduced-motion gate (§7) + print/peek static export (§8) that mirrors `deck.css`'s `body.print-pdf` block. Loaded **after** `deck.css`. |

**The five behaviours** (all opt-in via `data-fx` on archetype markup; all keyboard + ARIA accessible; all compositor-friendly motion):
- **`funnel`** — funnel stages become focusable `<button>`s; hover/focus/click reveals a computed drop-off chip (`−63 · 85% retained`) + tooltip (step conversion + `data-fx-tip` prose); un-focused stages dim; a delta ribbon between stages fills proportional to drop-off. Reveals numbers today's static funnel doesn't show.
- **`carousel`** — hero + filmstrip of thumbnails with prev/next + dots; click a thumb → cross-fade into the focal frame; click focal (or ⤢) → **lightbox** (`position:fixed` overlay appended to `.reveal`, fills the real viewport, focus-trapped, Esc/click-outside/✕ to close). This is the fix for "planned images too small." Static fallback = a clean responsive grid of all posts at good size with captions/badges.
- **`slider`** — `compare` (before/after `clip-path` wipe) or `scrub` (metric scrubber snapping to stops). Backed by a visually-hidden native `<input type="range">` overlaid full-track (best keyboard/SR/touch; drag is scale-correct for free because the browser maps the pointer to the range internally). Static fallback = "after" state fully shown with both labels + a seam marker (compare) or readout at default stop with the full scale printed (scrub).
- **`reveal-card`** — disclosure pattern (`<button aria-expanded aria-controls>` + `hidden` detail region, `grid-template-rows:0fr→1fr` reveal, rotating chevron); optional accordion via `data-fx-group`. Static fallback = all details open (`hidden` removed, `aria-expanded="true"`). Turns "behind-the-scenes repeats context" into collapsed-overview / expand-on-demand; fully open in PDF.
- **`count-replay`** — any `.count-up[data-count-to]` gains click/Enter-to-replay via the (now-exported) `runCountUp`; faint "↺" affordance on hover. Non-interactive fallback = final value (today's behaviour).

**`data-fx-*` attribute API** (namespaced, never collides with reveal's `data-auto-animate/data-timing` or the deck's `data-count-to/data-step`):
- Global: `data-fx` (behaviour id), `data-fx-enhanced` (engine-set), `data-fx-static="open"` (force revealed state / print override).
- funnel stages: `data-fx-stage, data-fx-value, data-fx-prev, data-fx-tip, data-fx-drop-label`.
- carousel: wrapper `data-fx-start`; items `data-fx-item, data-fx-caption, data-fx-badge (LIVE|PLANNED), data-fx-full`.
- slider: `data-fx-slider-mode (compare|scrub)`, layers `data-fx-layer (before|after)`, `data-fx-label-before/after`, `data-fx-scrub` (JSON stops), `data-fx-start`.
- reveal-card: `data-fx-summary` (or child `.fx-card__summary`), child `.fx-card__detail`, `data-fx-group`.

**Controller shape:**
```js
const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;
const PEEK = () => new URLSearchParams(location.search).get("present") === "peek";
const STATIC = () => document.body.classList.contains("print-pdf") || PEEK();
const BEHAVIOURS = { funnel, carousel, slider, "reveal-card":revealCard, "count-replay":countReplay };

function enhance(root){
  root.querySelectorAll("[data-fx]").forEach(el=>{
    if (el.dataset.fxEnhanced==="1") return;
    const b = BEHAVIOURS[el.dataset.fx]; if (!b) return;
    if (STATIC() || el.dataset.fxStatic==="open") { staticState(el); return; }
    try { b(el); el.dataset.fxEnhanced="1"; }
    catch(e){ console.warn("[fx] enhance failed", el.dataset.fx, e); staticState(el); }
  });
}
export function initInteractive(Reveal){
  const run = ()=> enhance(document);
  if (Reveal.isReady?.()) run();
  Reveal.on("ready", run);
  Reveal.on("slidechanged", e => enhance(e.currentSlide));
  Reveal.on("overviewhidden", run);
}
```

> **Reconciliation note (interactivity vs presenter peek).** Interactivity's static signal is extended to also fire in **peek** mode (`?present=peek`), so the presenter's current/next thumbnails show the fully-exploded static component (grid, open cards) instead of a live-but-inert widget. This is a one-line addition (`PEEK()` in `STATIC()` above) beyond the research's print-only gate.

### 1.4 Live collaboration — `template/collab.js` + `party/deck.ts` + `partykit.json`

Optional audience layer (slide-follow, presenter pointer mirror, presence, on-brand reactions, raise-hand/Q&A, live polls) over **PartyKit on Cloudflare** (one Durable Object per room, hibernates when idle, effectively $0). **Purely additive:** gated behind `PARTY_HOST` + `?room=`; with either absent, `collab.js` returns immediately and the deck is byte-for-byte the current experience. The static GitHub-Pages deck needs no server.

| File | Purpose |
|---|---|
| `template/collab.js` | CHROME client. Reads `?room` + `?role` (+ `?t` presenter token) from the URL (like `index.html` reads `?deck`). No-ops when `PARTY_HOST` unset or `?room` absent. Hooks `Reveal.on("slidechanged"/"ready")` (presenter broadcasts slide), mirrors reveal's `q` pointer normalized (0–1) to viewers, injects a scoped `<style>` using brand tokens, renders presence pill / reaction bar / flying reactions / ghost pointer / poll card / Q&A drawer. Loads `partysocket` from CDN (`https://esm.sh/partysocket`) — no build step. |
| `party/deck.ts` | The server: one `Party.Server` Durable Object per room. In-memory state (slide, poll, presence, questions, reactionsTotal) mirrored to `party.storage`, `hibernate:true`. Validates all inbound (JSON-guarded, reaction-kind whitelist, poll bounds, question length cap, one-vote-per-connection). **Server-enforced roles** (viewers can't `set-slide`/`open-poll`/broadcast pointer). Presenter gate via `PRESENTER_TOKEN` var (empty = open mode for local/offline). |
| `partykit.json` | Server config at repo root: `name:"formunauts-deck"`, `main:"party/deck.ts"`, `compatibilityDate`, `vars:{ PRESENTER_TOKEN:"" }`. |

**Event protocol** (JSON `{type,...}`):
- Client→Server: `hello{role,token?,name?}`, `set-slide{h,v,id}` (presenter), `pointer{x,y,visible}` (presenter, normalized, ephemeral), `reaction{kind}` (whitelist `spark|up|clap|eyes|plus`), `hand{on}` (viewer), `question{text}` (viewer, ≤240 chars), `poll-open{id,q,options[]}` / `poll-vote{id,option}` / `poll-close{id}`.
- Server→Client: `state` (snapshot to new joiner incl. authenticated `role`), `slide`, `pointer`, `reaction`, `presence{count,hands}`, `poll{id,q,options,votes,open}`, `question{id,text,ts}` (presenters only).

**Roles by capability (server-enforced, not just hidden buttons):** presenter drives slide + pointer + polls, sees full HUD (presence, tally, hands, questions). Viewer follows slide, votes, raises hand, asks questions, reacts. A viewer `set-slide`/`open-poll` is ignored unless authenticated as presenter.

**On-brand reactions, no emoji:** five inline-SVG glyphs in FORMUNAUTS blue (spark/rocket-trail, thumbs-up, applause, eyes, +1). Red (`--fmnts-secondary`) deliberately **not** used (rare stopper). Flying reactions animate `transform`/`opacity` only, cap ~40 concurrent nodes, never persist.

**Pointer normalization** reuses the pointer plugin's transform decomposition but inverts to broadcast `((pageX−tx)/scale)/1280, ((pageY−ty)/scale)/720` → a presenter on 4K and a viewer on a phone see the pointer land on the same word. (This is the one place we still read `body.style.transform`; it's fine because it's only the presenter's own screen and matches the plugin exactly.)

> **Reconciliation note.** Collaboration is **Phase 5** — build/verify presenter view, marker, interactivity, and the brand/redesign first. Collab reuses the same `Reveal.on("slidechanged")` mechanism as the presenter view but over a WebSocket instead of BroadcastChannel; the two are independent (BroadcastChannel = same-machine presenter console; PartyKit = remote audience). They can coexist without interference.

---

## 2. Integration edits (for the human integrator — grouped by file)

> **Apply order:** do §2 brand/redesign first (pure CSS + small archetype edits, no new deps, verify by rendering), then wire the feature modules (§3). Anchor every edit to the quoted selector/snippet — **do not trust line numbers.**

### 2.1 `index.html`

All edits are inside the `<head>` link block, the `<body>` button area, and the `<script type="module">`.

**(a) Stylesheets — swap pointer+chalkboard CSS for marker, add interactive CSS.** Replace:
```html
<link rel="stylesheet" href="plugin/customcontrols/style.css" />
<link rel="stylesheet" href="plugin/chalkboard/style.css" />
<link rel="stylesheet" href="plugin/pointer/pointer.css" />
```
with:
```html
<link rel="stylesheet" href="plugin/customcontrols/style.css" />
<link rel="stylesheet" href="plugin/marker/marker.css" />
<link rel="stylesheet" href="template/interactive.css" />
```
(`interactive.css` must come **after** `deck.css`, which it already does here.)

**(b) Scripts — replace pointer+chalkboard plugin scripts with marker.** Replace:
```html
<script src="plugin/pointer/plugin.js"></script>
<script src="plugin/chalkboard/plugin.js"></script>
```
with:
```html
<script src="plugin/marker/plugin.js"></script>
```
(Keep `plugin/notes.js` and `plugin/customcontrols/plugin.js`.)

**(c) Presenter button** — next to the existing `.present-btn`:
```html
<button class="present-btn present-btn--console" type="button" id="open-presenter">Presenter ▸</button>
```

**(d) Module imports** — after the two existing imports add:
```js
import { initInteractive } from "./template/interactive.js";
import { initDeckLink } from "./template/presenter/deck-link.js";
import { initCollab } from "./template/collab.js";
```

**(e) `Reveal.initialize` plugins + config** — in the `plugins:` array replace `RevealChalkboard, ..., RevealPointer` with `RevealMarker`:
```js
plugins: [ RevealNotes, RevealCustomControls, RevealMarker ],
```
Delete the `pointer:{...}` and `chalkboard:{...}` config lines. Add (or omit for defaults) `marker:{ /* §1.1 config */ }`. Keep everything else (`width/height/margin/center/fragments:false/hideInactiveCursor/controls:false/progress:false/hash/defaultTiming/pdfMaxPagesPerSlide` — see §3 for the full authoritative block).

**(f) customcontrols array** — replace the two chalkboard buttons with marker actions (inline SVG icons from `plugin/marker/icons.js`, or simple glyphs to start), and add a Notes button for discoverability:
```js
customcontrols: {
  collapseIcon: "▾", expandIcon: "▸",
  controls: [
    { icon: "◉", title: "Laser (L)",      action: "RevealMarker.setMode('laser');" },
    { icon: "✎", title: "Marker (M)",     action: "RevealMarker.toggle('ink');" },
    { icon: "◍", title: "Spotlight (K)",  action: "RevealMarker.toggle('spotlight');" },
    { icon: "☰", title: "Speaker notes (S)", action: "RevealNotes.open();" },
  ],
},
```

**(g) After `initAnim(Reveal);`** add:
```js
initInteractive(Reveal);
const { peek } = initDeckLink(Reveal);      // publishes state + executes cmds; owns ?present=peek
initCollab(Reveal);                          // self-disables if PARTY_HOST/?room absent

// Peek thumbnails: strip motion + cursor-hiding, pre-fill count-ups (calm, correct previews)
if (peek) {
  document.body.classList.add("is-peek");
  document.querySelectorAll(".count-up[data-count-to]")
    .forEach(el => { el.textContent = el.getAttribute("data-count-to"); });
}

// Presenter open + popup-block fallback
const openBtn = document.getElementById("open-presenter");
function openPresenter(){
  const w = window.open("presenter.html","fmnts-presenter","width=1280,height=800,menubar=no,toolbar=no");
  if (!w || w.closed || typeof w.closed === "undefined") showPresenterFallback();
}
openBtn.addEventListener("click", openPresenter);
Reveal.addKeyBinding({ keyCode:80, key:"P", description:"Open presenter view" }, openPresenter);
function showPresenterFallback(){
  if (document.getElementById("pv-fallback")) return;
  const bar = document.createElement("div");
  bar.id = "pv-fallback"; bar.className = "pv-fallback";
  bar.innerHTML = 'Allow pop-ups, or <a href="presenter.html" target="_blank" rel="noopener">Open presenter ↗</a>';
  document.body.appendChild(bar);
}
```

**(h) Print gate** — the existing `if (window.location.search.includes("print-pdf"))` block stays as-is. `interactive.js`'s `STATIC()` already reads `body.print-pdf` at enhance time, and `initInteractive` runs after this block, so ordering is safe.

### 2.2 `template/deck.css` — brand/logo redesign, grey-bg removal, ambassador restructure, status board

All are pure CSS (a couple pair with §2.4/§2.5 archetype markup). Anchor to the quoted selectors.

**FIX-BG — kill the greys (the "grayish bg" complaint).** Light slides → clean white; the two `muted` slides → subtle brand-blue tint, not grey.
- Change `.reveal .backgrounds { background: var(--bg-base); }` → `background: var(--bg-surface);`
- Change `.slide--light { background: var(--bg-base); ... }` → `background: var(--bg-surface);`
- Change `.slide--muted { background: var(--bg-muted); ... }` → `background: var(--blue-50);`
- Keep `.slide--muted .ghost-index { opacity: 0.06; }` (fine on blue tint).
- Recommended: `.asset-frame { background: var(--blue-50); }` so any letterbox mat reads as a deliberate cool mat instead of grey `--neutral-100`.

**FIX-ROCKET — the rocket shows complete, launching out of the ring nest; only exhaust bleeds.** Replace the `.rocket-mark`, `.rocket-mark--tr`, `.rocket-mark--tl`, `.rocket-watermark` rules:
```css
.rocket-mark {
  position: absolute; pointer-events: none; user-select: none;
  height: 300px; width: 300px;                 /* was 560px & clipped; SVG is 1:1 */
  opacity: 0.92;                                /* a real object, not a 0.10 ghost */
  filter: drop-shadow(0 24px 60px rgba(0,15,26,0.35));
  z-index: 0;
}
.rocket-mark--tr {                              /* cover: nose up-and-in, exhaust bleeds the corner */
  right: 40px; bottom: -46px; top: auto; left: auto;
  transform: rotate(-4deg);
}
/* closing paints NO rocket — see §2.5 closing.js */
.rocket-watermark {
  position: absolute; right: 48px; bottom: 44px; height: 200px; width: 200px;
  opacity: 0.05; pointer-events: none; user-select: none;
}
```
Enlarge/soften the ring boxes so the rocket nests in them (viewBox stays 760; we scale the *box*):
```css
.orbit--br { right: -180px; bottom: -220px; width: 820px; height: 820px; }
.orbit--tl { left: -200px;  top: -240px;    width: 760px; height: 760px; transform: rotate(180deg); }
.orbit .ring-1   { stroke: rgba(255,255,255,0.34); stroke-width: 1.5; }
.orbit .ring-2   { stroke: rgba(255,255,255,0.16); stroke-width: 1.25; }
.orbit .ring-dot { fill: rgba(255,255,255,0.95); stroke: none; }
```

**FIX-COVER-LOGO — confident claim lockup.** Replace `.cover__claim`:
```css
.cover__claim { position: absolute; left: 80px; top: 72px; width: 320px; height: auto; }
/* 320 / 2.827 ≈ 113px tall — well above the 300px-min-width claim rule */
```
Push the cover headline stack down to clear it: `.cover__eyebrow { top: 300px }` → `top: 330px`; `.cover__headline { top: 336px }` → `top: 366px`. (`.cover__rule`/`.cover__sub` unchanged.) The bottom `.cover__wordmark` is now redundant — the cover.js markup does **not** emit it today, so leave `.cover__wordmark` CSS in place unused (or delete it; harmless).

**FIX-FOOTER-LOGO — remove the footer lockup; the ghost numeral + accented page-index carry the brand.** (The 20px lockup on top of the giant ghost numeral is visual mud.) The emit is deleted in §2.3. Restyle `.page-index` so the current page reads in brand blue:
```css
.page-index {
  position: absolute; right: 80px; bottom: 60px;
  font-family: var(--font-display); font-feature-settings: "tnum" 1;
  font-size: var(--body-sm); color: var(--fg-subtle); text-align: right; letter-spacing: 0.02em;
}
.page-index b { color: var(--fmnts-primary); font-weight: 600; }
.slide--dark .page-index b, .slide--blue .page-index b { color: var(--fmnts-primary-50); }
```
(Keep the existing `.slide--dark .page-index, .slide--blue .page-index { color: rgba(255,255,255,0.55); }` rule.)

**FIX-CLOSING-LOGO — centered claim sign-off (bookends the cover).** Replace `.closing__wordmark`:
```css
.closing__claim {
  position: absolute; left: 80px; bottom: 88px; width: 300px; height: auto; opacity: 0.96;
}
/* .closing__site stays right:80px; bottom:64px */
```

**FIX-AMBASSADOR — LIVE feature + PLANNED carousel + labeled profile strip (slide 04).** Replace the `.project--hero` block (and its children `.project__hero/.project__thumbs/.project__thumb/.project__band` rules) with:
```css
.project--hero {
  display: grid;
  grid-template-columns: minmax(0, 4.2fr) minmax(0, 5.8fr);
  grid-template-rows: 1fr auto;
  grid-template-areas: "hero carousel" "hero profile";
  column-gap: 40px; row-gap: 18px; align-items: stretch; min-height: 0;
}
.project__hero { grid-area: hero; min-height: 0; height: 100%; display: flex; align-items: stretch; justify-content: flex-start; }
.reveal .project--hero .project__hero .asset-frame { height: 100%; width: auto; max-width: 100%; box-shadow: var(--elevation-3); }
.project__thumbs { grid-area: carousel; min-height: 0; display: flex; gap: 16px; align-items: flex-start; overflow: hidden; }
.project__thumb { min-height: 0; height: 300px; flex: 0 0 auto; scroll-snap-align: start; transition: transform var(--duration-normal) var(--ease-out-expo); }
.reveal .project--hero .project__thumb .asset-frame { height: 100%; width: auto; max-width: 100%; }
.project__thumb:hover { transform: translateY(-4px); }
.project__band { grid-area: profile; align-self: end; display: flex; align-items: center; gap: var(--space-4); min-width: 0; }
.reveal .project--hero .project__band .asset-frame { height: 84px; width: auto; max-width: 100%; }
.project__band .caption { margin: 0; }
.hero-cadence { position: absolute; right: 0; top: -40px; }
```
This makes the LIVE post full content-region height (dominant), PLANNED cards 300px (3× their old 150px), banner an 84px labeled strip. The PLANNED thumbs become the interactivity `carousel` (§2.4 + §1.3).

**FIX-9 — "Behind the scenes" → a value-adding status board (recommended).** Add a status-board layout (the archetype + data are in §2.4/§2.6). Append to deck.css:
```css
.statusboard {
  position: absolute; inset: 248px 80px 128px 80px;
  display: grid; grid-template-columns: 1fr 1fr; column-gap: 56px; align-content: start;
}
.sb-col__title {
  font-family: var(--font-body); font-weight: 600; text-transform: uppercase;
  font-size: var(--overline); letter-spacing: 0.24em; color: var(--fmnts-primary-50);
  margin-bottom: var(--space-5); padding-bottom: var(--space-3);
  border-bottom: 1px solid rgba(255,255,255,0.12);
}
.sb-col__list { display: flex; flex-direction: column; gap: var(--space-3); }
.sb-row {
  display: grid; grid-template-columns: 12px 1fr auto; align-items: center; column-gap: var(--space-4);
  padding: 10px 14px; border-radius: var(--radius-md);
  background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.06);
}
.sb-dot { width: 8px; height: 8px; border-radius: 50%; }
.sb-label { font-size: var(--body-md); line-height: var(--body-md-lh); color: rgba(255,255,255,0.90); }
.sb-state { font-family: var(--font-body); font-weight: 600; text-transform: uppercase; font-size: var(--overline); letter-spacing: 0.16em; }
.sb-row--done   .sb-dot { background: var(--success-500); } .sb-row--done   .sb-state { color: var(--success-300); }
.sb-row--active .sb-dot { background: var(--fmnts-primary); box-shadow: 0 0 0 4px rgba(0,116,200,0.18); } .sb-row--active .sb-state { color: var(--fmnts-primary-50); }
.sb-row--next   .sb-dot { background: var(--fg-subtle); } .sb-row--next   .sb-state { color: var(--fg-subtle); }
```

**Fallback banner + presenter-console affordance styles** (used by §2.1(g)) — append:
```css
.pv-fallback {
  position: fixed; left: 50%; bottom: 64px; transform: translateX(-50%); z-index: 50;
  background: var(--bg-surface); color: var(--fg-default); box-shadow: var(--elevation-3);
  border-radius: var(--radius-pill); padding: 10px 18px; font: 600 var(--body-sm)/1 var(--font-body);
}
.pv-fallback a { color: var(--fmnts-primary); text-decoration: none; margin-left: 6px; }
.present-btn--console { right: 132px; }   /* sit left of the Present button */
.reveal.overview .present-btn--console, body.print-pdf .present-btn--console { display: none; }
```

**Interactivity + marker print/peek guards** — append (mirrors the existing `body.print-pdf` block):
```css
/* Peek previews (presenter thumbnails): freeze motion like reduced-motion, hide draw chrome */
body.is-peek .orbit.is-drifting { animation: none !important; }
body.is-peek .marker-overlay, body.is-peek .marker-toolbar, body.is-peek .customcontrols { display: none !important; }
body.is-peek .present-btn, body.is-peek .present-btn--console { display: none !important; }
/* Print: draw layers + toolbar never in exports */
body.print-pdf .marker-overlay, body.print-pdf .marker-toolbar { display: none !important; }
```

### 2.3 `template/render.js`

**Remove the footer logo emit.** Delete the `footerLogo` const line:
```js
const footerLogo = ctx.logo(isDark ? "logo-visual-type-white.png" : "logo-visual-type-blue.png");
```
and delete the `<img class="footer-logo" ...>` line from the returned string. (Leave `isDark` — it may still be used; if it becomes unused, drop it too.)

**Accent the current page index.** Change the page-index emit from `${idx} / ${totalStr}` to bold the current numeral:
```js
`<div class="page-index"><b>${idx}</b> / ${totalStr}</div>` +
```

**Register the status board archetype** (only if you take FIX-9's recommended path). Add the import + map entries:
```js
import { statusBoard } from "./archetypes/statusBoard.js";
// in ARCHETYPE:  ..., statusBoard,
// in DEFAULT_CHROME:  statusBoard: "dark",
```

### 2.4 `template/archetypes/*` — additive markup for interactivity + ambassador + status board

**`campaignAnalysis.js` (funnel → interactive).** On the `.funnel` container add `data-fx="funnel"`; make each stage a `<button class="funnel__stage">` (keeps the existing `[data-step]` CSS) carrying `data-fx-stage`, `data-fx-value`, `data-fx-prev` (the previous stage's numeric value), and optional `data-fx-tip` from `slide.funnel[i].note`. The engine injects the drop chip + tooltip. Static/peek fallback (from `interactive.js`) fills the chip inline. No change to the pills.

**`projectVisual.js` `hero()` (ambassador carousel + cadence chip).** Wrap the hero+thumbs in the carousel markup: the `.project__thumbs` becomes a `role="tablist"` of `<button class="fx-carousel__thumb" data-fx-item data-fx-badge="PLANNED" data-fx-caption>` inside `data-fx="carousel"`; the LIVE hero is item 0 (`data-fx-badge="LIVE"`). Each item still calls `assetFrame()` verbatim (aspect-locked, never squishes). Add the cadence pill after the band when `slide.cadence` is set:
```js
const cadence = slide.cadence
  ? `<div class="hero-cadence anim" style="--anim-step:9">
       <span class="pill"><span class="pill__value">Tue 09:30</span>
       <span class="pill__label">${esc(slide.cadence)}</span></span></div>`
  : "";
```
Raw markup (no JS) = the clean grid; `interactive.js` collapses it into the carousel + lightbox when live. This satisfies "planned images too small / structure nicer."

**`overviewBullets.js` (optional reveal-cards).** If you want the Italy "What we learned" (slide 05) or the internal recap to be tap-to-expand, wrap each item in `data-fx="reveal-card"` markup (`<button class="fx-card__summary" aria-expanded>` + `.fx-card__detail` with the concrete action). Additive; raw markup shows everything (static).

**NEW `template/archetypes/statusBoard.js` (FIX-9 recommended path):**
```js
/* statusBoard.js — Slide 09. Internal workstreams as a state board on dark.
   Adds a status signal (done / active / next) the recap slide didn't carry. */
import { esc } from "./_shared.js";
const DOT = { done:"done", active:"active", next:"next" };
export function statusBoard(slide) {
  const groups = (slide.groups || []).map((g, gi) => {
    const rows = (g.items || []).map((it) => {
      const state = DOT[it.state] || "active";
      return `<li class="sb-row sb-row--${state}">
          <span class="sb-dot"></span>
          <span class="sb-label">${esc(it.t)}</span>
          <span class="sb-state">${esc(it.state || "")}</span>
        </li>`;
    }).join("");
    return `<section class="sb-col anim" style="--anim-step:${gi + 3}">
        <h3 class="sb-col__title">${esc(g.title)}</h3>
        <ul class="sb-col__list">${rows}</ul>
      </section>`;
  }).join("");
  return `<div class="statusboard">${groups}</div>`;
}
```

### 2.5 `template/archetypes/cover.js` + `closing.js`

**`cover.js`** — no markup change needed for the rocket (all handled by FIX-ROCKET CSS). It keeps emitting `.cover__claim`, `.rocket-mark--tr`, `orbit("br")`. The claim `height="44"` attr is now overridden by CSS width:320 — optionally update the attribute to a hint or leave it (CSS wins).

**`closing.js`** — remove the rocket, swap the small wordmark for a centered claim lockup:
```js
import { esc, orbit } from "./_shared.js";
export function closing(slide, ctx) {
  const claim = ctx.logo("logo-claim-wide-white.png");   // white claim on blue
  return `
    ${orbit("tl")}
    <h2 class="closing__statement anim" style="--anim-step:0">${esc(slide.statement || "")}</h2>
    <p class="closing__sub anim" style="--anim-step:1">${esc(slide.sub || "")}</p>
    <img class="closing__claim anim" style="--anim-step:2" src="${esc(claim)}"
         alt="FORMUNAUTS — Fundraising Space Navigators" width="300">
    <p class="closing__site anim" style="--anim-step:3">${esc(slide.site || "")}</p>
  `;
}
```
(Delete the now-unused `rocket`/`wordmark` consts. The `data-auto-animate-id="bookend"` ring arc still animates cover→closing; dropping the rocket makes closing read as "landed / quiet.")

### 2.6 `decks/2026-07-01.deck.js` — content-only edits

**Slide 04 (ambassador)** — add `cadence: "new post every week"` (and optional `data-fx-caption`-style captions per planned post via a `caption` field the archetype can read). No structural change; existing `hero/thumbs/band` keys stay.

**Slide 09 (behind the scenes) — the decision.** Two options:
- **(A) Recommended — repurpose as a status board.** Change `archetype:"overviewBullets", variant:"quiet"` → `archetype:"statusBoard"`, and reshape `columns[]` → `groups[]` with per-item `state`:
  ```js
  {
    id: "strategy-internal", archetype: "statusBoard",
    eyebrow: "INTERNAL · THE ENGINE", headline: "Foundations under the highlights",
    lead: "The operational work that makes the campaigns above repeatable.",
    groups: [
      { title: "Strategy & web", items: [
        { t: "Q2 → Q3 OKRs", state: "done" },
        { t: "UK inhouse page", state: "active" },
        { t: "Key Value page → website focus", state: "active" },
        { t: "Job-posting target groups", state: "done" },
      ]},
      { title: "Data & ops", items: [
        { t: "SSOT first steps with Elias", state: "active" },
        { t: "Klausur kickoff", state: "done" },
        { t: "APP NPS newsletter", state: "done" },
        { t: "Asset cleanup", state: "next" },
      ]},
    ],
    notes: "…(keep existing slide-09 notes)…",
  }
  ```
  This keeps the facts but shows momentum (shipped vs in-flight vs queued), earning the slot and setting up the closing "one engine" line.
- **(B) Cut it.** Delete the slide-09 object entirely — one-line removal, zero code change (the `overviewBullets` quiet path stays available for future decks). Choose (B) only if the meeting wants a shorter deck; (A) is the stronger beat.

> **Chosen default for this build: (A).** It directly answers the "behind the scenes just repeats context" complaint by adding information (state) rather than removing the slide, and it reuses the CONTENT/CHROME contract (new archetype + declarative data).

---

## 3. `Reveal.initialize` — authoritative plugin/config block

Replace the current `Reveal.initialize({...})` config with this (only the plugin/marker/notes-relevant parts change; everything else is preserved verbatim from the current deck):

```js
Reveal.initialize({
  width: 1280, height: 720, margin: 0, minScale: 0.2, maxScale: 2.0, center: false,
  pdfMaxPagesPerSlide: 1, pdfSeparateFragments: false,
  transition: "fade", transitionSpeed: "default", backgroundTransition: "fade",
  autoAnimateEasing: "cubic-bezier(0.16, 1, 0.3, 1)", autoAnimateDuration: 0.6,
  autoAnimateUnmatched: false,
  fragments: false,
  hideInactiveCursor: true, hideCursorTime: 3000,
  controls: false, progress: false,        // shared screen stays slide-only
  hash: true,
  defaultTiming: 45,                        // per-slide override via data-timing (speaker pacing)

  plugins: [ RevealNotes, RevealCustomControls, RevealMarker ],  // pointer + chalkboard removed
  marker: {                                 // omit entirely to accept §1.1 defaults
    defaultMode: "laser",
    ink: { defaultColor: "#0074C8", widths: [2,4,8], defaultWidth: 4, eraser: "stroke", persistPerSlide: true },
    spotlight: { radius: 140 },
    toolbar: { position: "bottom-center", autoHide: true, idleMs: 3000 },
    respectReducedMotion: true
  },
  customcontrols: {
    collapseIcon: "▾", expandIcon: "▸",
    controls: [
      { icon: "◉", title: "Laser (L)",         action: "RevealMarker.setMode('laser');" },
      { icon: "✎", title: "Marker (M)",        action: "RevealMarker.toggle('ink');" },
      { icon: "◍", title: "Spotlight (K)",     action: "RevealMarker.toggle('spotlight');" },
      { icon: "☰", title: "Speaker notes (S)", action: "RevealNotes.open();" },
    ],
  },
});
```

**Global names to reference (verified):** `RevealNotes`, `RevealCustomControls`, `RevealMarker` (new). Removed: `RevealChalkboard`, `RevealPointer`. The marker plugin script must load **before** `Reveal.initialize` runs (it does — it's a `<script src>` in the head-of-body block, same as the others).

**`?present=peek` handling** is owned by `template/presenter/deck-link.js`: it reads `new URLSearchParams(location.search).get("present") === "peek"`, and in peek mode it (1) never accepts channel commands, (2) never publishes state, and returns `{peek:true}` so `index.html` adds `body.is-peek` and pre-fills count-ups. No `Reveal.initialize` change is required for peek.

---

## 4. Graceful degradation + print-pdf rules (every feature)

| Feature | No-JS / error | `body.print-pdf` (PDF export) | Peek (`?present=peek`) | Dependency absent |
|---|---|---|---|---|
| **Brand/logo + bg redesign** (§2.2) | Pure CSS — always applied. | Backgrounds/logos render exactly (`print-color-adjust:exact` already set). Rocket/claim are static art. | Same as live. | n/a |
| **Marker plugin** | Plugin is chrome; if `plugin.js` fails, deck runs without draw tools (customcontrols buttons become inert no-ops — wrap actions so a missing `RevealMarker` doesn't throw: the customcontrols `onclick` calls a global that simply won't exist; acceptable, but optionally guard with `window.RevealMarker&&RevealMarker...`). | `body.print-pdf .marker-overlay, .marker-toolbar { display:none }` — never in exports. Persistent ink is **not** baked into PDF in v1 (v1.1 optional via `getInk()`). | `body.is-peek` hides overlay + toolbar (calm thumbnails). | Reduced-motion: laser degrades to a plain dot (no comet), ink/spotlight unaffected. |
| **Presenter view** | `presenter.html` is a separate document; if its JS fails it still shows the two peek iframes (which load `index.html?present=peek` directly) — only live nav is inert. | Presenter is never part of a PDF (it's a separate window). The shared deck's PDF is unaffected. | The shared deck opened as a peek iframe never publishes/accepts — no feedback. | **Channel absent** (Safari private mode): `makeBus` null-guards BroadcastChannel; presenter paints from the `localStorage` snapshot and shows a "Deck window not detected — Reconnect / Open deck ↗" banner after a 2s watchdog. **Deck opened before/after presenter:** `hello`→`state` handshake + `localStorage` mirror cover both orderings; last `publish()` wins (idempotent, self-healing). |
| **Interactivity engine** | Raw markup **is** the clean static slide (funnel with all numbers, image grid, open cards). JS only adds affordances. Any thrown behaviour → `staticState(el)`. | `STATIC()` true → every component force-renders fully-revealed: funnel chips filled + captions inline, carousel exploded to a captioned grid, slider pinned to "after"/default with labels + full scale, cards open, count-ups pre-filled (existing print hook). Export shows **more** than today. | `STATIC()` includes peek → thumbnails show the exploded static component, never a live-but-inert widget. | Native DOM events need no coord math; `resize` needs no work (getBoundingClientRect is scale-agnostic). |
| **Collaboration** | `collab.js` returns immediately if `PARTY_HOST` unset **or** `?room` absent → deck byte-for-byte unchanged. | No collab UI in print (nothing renders without `?room`). | Peek deck has no `?room` → collab off. | **Server down / socket closed:** `partysocket` auto-reconnects; sends are gated on `readyState===1`; UI simply shows no presence/reactions until reconnect. **BroadcastChannel-only** presenter view works with zero server. |

**Universal rules:** all new motion animates `transform`/`opacity`/`clip-path`/`filter` only (compositor-friendly, per the web rules); `will-change` is set narrowly during drags and removed on release; every new interactive element has a designed `:focus-visible` ring (`--border-focus`); every new module honours `prefers-reduced-motion` (fades → instant). No new render-blocking resources; `partysocket` loads from CDN as ESM only when collab is active.

---

## 5. QA checklist (what to render/click to verify each feature)

**Setup:** `python3 -m http.server 8748` in `demo-deck/`, open `http://localhost:8748`. (Do **not** use `file://` — notes popup blocks and BroadcastChannel/collab break.)

**A. Brand / logo / bg redesign (do first)**
- [ ] Cover: rocket is **complete** (nose + flame visible), nestled bottom-right in the ring system, only exhaust bleeds the corner; claim lockup top-left reads big and confident; headline stack clears it.
- [ ] Every content slide: **no footer logo**; page-index bottom-right shows current numeral in brand blue (`01 / 11` with `01` blue). Giant ghost numeral still present.
- [ ] Light slides (02,03,04,07,08,10) are **white**, not grey. Slides 05,06 are a faint **blue tint** (#F3F8FD), not grey. Nothing shows `#F8F9FA`/`#F2F4F5` on screen.
- [ ] Closing: **no rocket**; centered claim lockup low; ring arc top-left; site bottom-right. Reads as a calm bookend of the cover.
- [ ] Slide 04: LIVE post large/dominant left; PLANNED cards ~300px browsable top-right; banner an 84px labeled strip bottom-right; cadence pill visible.
- [ ] Slide 09 (path A): dark status board, two columns, each row with a colored state dot + `done/active/next` label. Reads as momentum, not a re-list.
- [ ] `?print-pdf` render (or the existing `Marketing-Demo-*.pdf` regenerated): all of the above render; count-ups filled; no draw overlay/toolbar/present buttons.

**B. Marker plugin**
- [ ] Press `L` (or ◉): move mouse → glowing red dot with a short comet tail that **melts ~1.2s after you stop**; nothing persists. Clicking slide UI still works (pointer-events pass through).
- [ ] Press `M` (or ✎): draw → blue ink **persists**; navigate away and back → ink returns on that slide (per-slide). Resize the window → ink stays pinned to the slide.
- [ ] `E` erases a whole stroke; `Z` undo, `Y` redo; `X` clears the slide; `1–5` change color; `[` `]` change pen size.
- [ ] Press `K` (or ◍): spotlight dims the slide with a soft hole following the cursor; `[` `]` resize it. (Confirm `S` still opens **notes**, not spotlight.)
- [ ] Toolbar: bottom-center pill, auto-hides after ~3s idle, reappears on move; hover/active states look designed; hidden in print + peek.
- [ ] Reduced-motion (OS setting or DevTools emulate): laser becomes a plain dot (no comet); ink/spotlight still work.

**C. Presenter view**
- [ ] Click `Presenter ▸` (or `P`): a new window opens with wall clock, elapsed timer, current + next slide thumbnails, and the **full speaker notes** for the current slide (the exact text from `decks/2026-07-01.deck.js`).
- [ ] In the presenter window press `→`/`Next`: the **shared** window advances and the presenter re-paints (notes, index, thumbnails). Press `←`: both go back. No echo/oscillation.
- [ ] Blank (`b`): shared screen pauses/blanks; press again to resume.
- [ ] Jump list (`g`): shows slide titles; clicking one navigates both windows.
- [ ] Pacing: elapsed timer runs; pacing indicator reflects `data-timing`/`defaultTiming:45`.
- [ ] **Degrade:** open `presenter.html` directly with no deck window → it paints from the `localStorage` snapshot (if any) and shows the "Deck not detected — Reconnect / Open deck ↗" banner; the two thumbnails still render real slides via `?present=peek`.
- [ ] **Popup block:** block popups, click `Presenter ▸` → the branded fallback bar appears with a working `Open presenter ↗` link.
- [ ] Confirm the shared window still shows **only the slide** (no controls/progress) throughout.

**D. Interactivity engine**
- [ ] Slide 03 funnel: hover/focus/click a stage → drop-off chip + tooltip with retained % / step conversion; other stages dim; keyboard Tab reaches each stage, Enter/Space activates, Esc closes the tooltip.
- [ ] Slide 04 carousel: click a PLANNED thumb → it swaps into the focal frame; click the focal (or ⤢) → full-viewport lightbox at readable size with caption; Esc/click-outside closes; focus returns to the thumb. Arrow keys cycle.
- [ ] Any slider you add (e.g. Ad-QA compare or a funnel scrub): drag the handle (mouse + touch) and use arrow keys/Home/End; SR announces `aria-valuetext`; static export shows the readable end state.
- [ ] reveal-card (if added): click/Enter expands with a smooth reveal + chevron; accordion group closes siblings; print shows all open.
- [ ] count-replay: click a KPI numeral → it re-runs 0→N (uses exported `runCountUp`).
- [ ] **Degrade:** `?print-pdf` and the presenter peek thumbnails show every component fully exploded/open (grid, filled chips, cards open) — never a blank or inert widget. Temporarily rename `interactive.js` → deck still shows all content statically.

**E. Collaboration (Phase 5, only after `npx partykit deploy` + setting `PARTY_HOST`)**
- [ ] Presenter link `?room=demo0701&role=presenter&t=<TOKEN>` drives slides; audience link `?room=demo0701` (no role) **follows** automatically.
- [ ] Presence pill shows `N watching`; opening/closing a second viewer tab updates the count.
- [ ] Viewer taps a reaction glyph → it flies across **all** connected screens and vanishes (never persists); reactions are FORMUNAUTS-blue SVGs, no emoji, no red.
- [ ] Presenter turns on the `q` pointer → viewers see a ghost pointer land on the same word (normalized coords) regardless of screen size.
- [ ] Viewer raise-hand / question → appears only in the presenter's HUD; a poll opened by the presenter shows tappable bars to viewers and a live tally to the presenter; a viewer `set-slide`/`poll-open` attempt is ignored (server-enforced role).
- [ ] **Degrade:** open the deck with **no** `?room=` → identical to the current static deck (no collab UI, no errors). Stop the PartyKit server mid-session → `partysocket` reconnects; no crash.

---

## 6. Suggested build order

1. **Brand/logo + bg redesign + ambassador restructure + status board** (§2.2–§2.6). Pure CSS + small archetype/data edits, zero new deps. Render and run QA-A. Regenerate the PDF.
2. **Marker plugin** (§1.1) + `index.html` swap (§2.1 a/b/e/f). Verify QA-B; confirm `S` still opens notes.
3. **Presenter view** (§1.2) + `index.html` wiring (§2.1 c/d/g) + `?present=peek` gate. Verify QA-C (live sync both directions, degrade, popup fallback).
4. **Interactivity engine** (§1.3) + additive archetype markup (§2.4) + `anim.js` `export runCountUp` (§2.3-adjacent). Verify QA-D (including peek/print static).
5. **Collaboration** (§1.4): `npx partykit deploy`, set `PARTY_HOST`, optional `PRESENTER_TOKEN`. Verify QA-E. Ship the audience QR on the cover/closing (deck data only).

---

## 7. Key file paths (quick reference)

**New:**
- `plugin/marker/{plugin.js,marker.css,icons.js}`
- `presenter.html`, `presenter.css`, `template/presenter/{channel.js,deck-link.js,presenter.js}`
- `template/interactive.js`, `template/interactive.css`
- `template/archetypes/statusBoard.js`
- `template/collab.js`, `party/deck.ts`, `partykit.json`

**Edit (surgical, anchored to selectors/snippets — not line numbers):**
- `index.html` — stylesheet + script swaps, presenter button, module imports, `Reveal.initialize` plugins/config, customcontrols, post-init wiring.
- `template/deck.css` — FIX-BG, FIX-ROCKET, FIX-COVER-LOGO, FIX-FOOTER-LOGO, FIX-CLOSING-LOGO, FIX-AMBASSADOR, FIX-9 statusboard, fallback/peek/print guards.
- `template/render.js` — drop footer-logo emit, bold page-index numeral, register statusBoard.
- `template/anim.js` — add `export` to `runCountUp` (one word).
- `template/archetypes/{campaignAnalysis,projectVisual,overviewBullets,cover,closing}.js` — additive `data-fx-*` / carousel / cadence markup; closing rocket→claim swap.
- `decks/2026-07-01.deck.js` — slide 04 `cadence`; slide 09 → `statusBoard` data (path A).

**Reference only (do not edit):**
- `plugin/notes.js` (transport we bypass), `plugin/pointer/plugin.js` + `plugin/chalkboard/plugin.js` (replaced by marker), `plugin/customcontrols/plugin.js` (action/toolbar pattern), `template/brand.css` (tokens), `dist/reveal.js` (API surface).
- Serve via `.claude/launch.json` (`http://localhost:8748`) — same-origin, so BroadcastChannel + notes work and `file://` fragility is avoided.
