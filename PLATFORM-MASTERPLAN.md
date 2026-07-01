# FORMUNAUTS Presentation Platform — MASTER PLAN

> The single authoritative plan. Merges five research tracks (inspiration/design-system, motion, per-slide redesign, interaction model, platform architecture) into one build.
> Scope: turn the existing demo-deck into **The Formunauts Presentation Platform + a best-in-class, on-brand pitch-deck template**.
> Date: 2026-07-01 · Owner: Samuel · Repo: `formunauts-sam.github.io/formunauts-deck` (GitHub Pages, static host)

---

## 0. Reading guide & the one load-bearing insight

**You are not building a platform from scratch. You are adding a front door and a handful of additive layers over an engine that already does the hard parts.** Verified in the codebase:

- Per-deck routing already exists: `index.html` dynamic-imports `decks/${id}.deck.js`, guarded by `/^[0-9A-Za-z._-]+$/`.
- A **thumbnail renderer already exists**: `?present=peek` renders any deck motion-stripped, cursor-hidden, count-up-filled, chrome-free. The presenter console already uses it for live previews.
- A **presenter console already exists** (`template/presenter/presenter.js`) driving the shared window over **BroadcastChannel**.
- A **complete, server-enforced collaboration layer already exists** (`template/collab.js` + `party/deck.ts`) — follow-slide, pointer ghost, reactions, polls, Q&A, hand-raise, role gates — it is simply **undeployed**.
- The **marker plugin already stores ink in author-space (1280×720) coordinates** and exposes `serialize()` / `loadInk()` / `onStroke` — the exact seam needed to broadcast annotation.

Everything below either (a) surfaces what exists, (b) adds thin additive modules, or (c) requires exactly **one ~$0 deployment** (`npx partykit deploy`). **No OAuth is required for the team's real workflow.**

### The two non-negotiable invariants (do not break these)

1. **CONTENT / CHROME split.** Per-demo content lives ONLY in `decks/YYYY-MM-DD.deck.js` as declarative data. All rendering, layout, motion, and logic live in `template/*` (archetypes, CSS, JS). A new visual capability = a new declarative field + logic in chrome. Never inline layout/logic into a deck file.
2. **Static / PDF degradation contract.** Three environments MUST flatten to a fully-visible static state. This is already half-built; every new effect must honor it:

   | Trigger | Behavior | Status |
   |---|---|---|
   | `prefers-reduced-motion: reduce` | count-ups jump to final, drift never starts, entrances instant, morphs → cross-fade, line-draw → final stroke, tilt off, mesh static, grain kept | built in `anim.js` + `deck.css`; extend to every new effect |
   | `body.print-pdf` (`?print-pdf`) | every effect renders final state; 1 PDF page per slide (`pdfMaxPagesPerSlide:1`, `pdfSeparateFragments:false`) | built; each new effect adds its own `body.print-pdf … !important` override |
   | `?present=peek` (thumbnails) | exploded static; `is-peek` strips overlays; count-ups filled | built in `interactive.js` `isStatic()`; reuse the same gate |

   **Encode as: "default is the reduced/static state; motion is the enhancement."** Any effect that *starts hidden* (e.g. a fragment) must default visible and only hide when `no-preference` AND live (not peek/print).

---

## 1. Vision & Principles

### 1.1 What we are building

A **meeting-aware presentation platform** for the Formunauts marketing team: a deck hub (library + planner) fronting a world-class deck engine, where every slide is on-brand and "fills the canvas," the presenter can point and annotate **from the console** (mirrored to the room and remote viewers), and any deck can be shared to viewers via a QR/room link and attached to a Google Calendar meeting.

### 1.2 Brand guardrails (held throughout — every pattern below obeys these)

- **Blue `#0074C8` (`--fmnts-primary`) is the hero.** It carries cover, closing, active states, laser, primary data.
- **Red `#E03B50` (`--fmnts-secondary`) is a stopper**, used ~1× per surface (the single hot-lead metric, a "today" marker, the transient laser comet — its one sanctioned motion use).
- **Ink `#1E2A33` for text.** Shadows are cool-blue `--elevation-*`, never pure black.
- **Figtree** for body, **Chillax** for display + tabular numerals (numerals count up with zero layout shift by design).
- **Rocket + orbital-ring motif** for atmosphere. **Zero emoji** anywhere — reactions are on-brand inline-SVG glyphs.
- **No dark mode by default.** Cover (01) and closing (11) are the ONLY sanctioned blue fields; nothing in the body is dark.

### 1.3 The five design principles (the bar every surface must clear)

Distilled from `awesome-design-md` Do's/Don'ts + the user's `web/design-quality.md` (≥4 qualities per surface):

1. **Hierarchy through scale, not weight.** One dominant element per slide (a 2×2 bento hero, a full-bleed photo, one giant numeral). Chillax 64–96px vs Figtree 16px is the contrast engine.
2. **Selective emphasis.** When one tile is loud (photo/video), neighbors go quiet (text-only). Never two heroes.
3. **Depth is layered surfaces + soft cool-blue shadow + deliberate overlap.** Never flat, never pure-black shadow, never glass on body text.
4. **Photos are unified and integrated** — duotone the supporting cast, full-bleed or device-framed the hero. Never centered thumbnails floating in dead space.
5. **Motion clarifies causality.** Every animation answers "what changed / where did this come from." If it doesn't explain a relationship, it's decoration — cut it.

### 1.4 The three explicit complaints this plan fixes

- **"Slides aren't filled" (dead lower third).** Structural, not per-slide: every content archetype pins content to `top:248px`, stops at `bottom:128px`, and lets a ghost numeral do 100% of the lower-third work. Fixed by the **bento / editorial / split archetypes** (§3) that fill by definition + entrance choreography that fills with *meaning*.
- **"The dark slide (09) must go."** The `statusBoard` is the only dark content slide — a jarring mode-switch. Rebuilt as a **light "engine room" bento** (§3 #1); the `slide--dark` default is deleted.
- **"Photos are under-integrated."** Every image currently goes through ONE `assetFrame` primitive (contain-on-a-mat) → nothing bleeds, overlaps, or fills. Fixed by **`deviceMockup` + duotone treatment + split/full-bleed** (§3).

### 1.5 The design-system spine (`template/DESIGN.md`)

Formalize the token set the code already gropes toward, using the `awesome-design-md` 9-section model as the machine-readable source of truth: Visual Theme · Color Palette · Typography · Components · Layout Principles · Depth/Elevation · Do's/Don'ts · Responsive Behavior · Agent Prompts. This makes "stay 100% on brand" enforceable and lets new archetypes be added without drift. Add the two token classes the current set lacks: **motion tokens** (§2) and **layout tokens** (named grid templates `--grid-bento`, `--grid-split`, `--grid-editorial`).

---

## 2. The Motion System — "Orbital Motion"

**Metaphor (matches the brand):** things arrive on an easing curve like a craft settling into orbit — fast approach, gentle capture. Everything decelerates (ease-out family); **nothing bounces** (bounce reads as toy, off-brand for a fundraising-tech pitch). One coherent system = four token groups + five choreography rules. This **extends** the existing seeds (`--ease-out-expo`, `--duration-fast/normal/slow`), it does not replace them.

### 2.1 Token group 1 — Durations (add to `:root` in `brand.css`)

```css
:root {
  /* Motion · durations (extends existing fast/normal/slow) */
  --dur-instant: 80ms;    /* micro state: chip toggle, focus ring        */
  --dur-fast:    150ms;   /* (existing) hover, small fades               */
  --dur-normal:  300ms;   /* (existing) default UI transition            */
  --dur-slow:    400ms;   /* (existing) entrance fade-up per element     */
  --dur-slower:  600ms;   /* slide morph / auto-animate (matches config) */
  --dur-count:   900ms;   /* KPI count-up (matches anim.js COUNT_MS)     */
  --dur-draw:    1400ms;  /* SVG line-draw (rocket trail, rings)         */
}
```

Rule baked into the names: **anything a viewer reads waits ≤ 600ms; anything decorative (draw, drift) is slow enough to feel ambient (≥ 900ms).**

### 2.2 Token group 2 — Easings (the Orbital family; all decelerate)

```css
:root {
  --ease-orbit:    cubic-bezier(0.16, 1, 0.3, 1);  /* = existing --ease-out-expo, the signature */
  --ease-standard: cubic-bezier(0.4, 0, 0.2, 1);   /* symmetric, for moves that also exit       */
  --ease-exit:     cubic-bezier(0.4, 0, 1, 1);     /* accelerate-in, for departures             */
}
```

Keep `--ease-out-expo` as an alias of `--ease-orbit` so nothing breaks. **95% of motion uses `--ease-orbit`.** No `ease-in-out` grab-bag, no springs.

### 2.3 Token group 3 — Choreography constants

```css
:root {
  --stagger-step:   90ms;  /* (existing --anim-step) delay between sibling reveals */
  --stagger-tight:  45ms;  /* dense lists (masonry tiles, jump list)              */
  --rise-distance:  8px;   /* (existing) fade-up travel — never more              */
  --lift-hover:     4px;   /* (existing) card hover lift                          */
}
```

### 2.4 The 5 choreography rules (the actual "system")

1. **One curve, one direction.** Everything eases OUT and moves UP/IN. A deck where every element decelerates on the same curve reads as one designed object.
2. **Read-distance capped at 8px.** Entrances translate `--rise-distance` max, never 40px swoop-ins. Small travel + opacity = "expensive," not "busy," and sidesteps vestibular triggers.
3. **Stagger by role, not by count.** Kicker → headline → lead → body is the fixed spine (`--anim-step` 0,1,2,3…). Dense collections use `--stagger-tight`. Never > ~8 steps or the last item feels late.
4. **Motion clarifies causality.** (Principle 1.3 #5, restated as a motion contract.)
5. **Two audiences, two motion budgets.** VIEWER motion is calm, automatic, screen-share-safe (never hides content behind a click). PRESENTER motion is richer and interactive (laser, spotlight, count-replay, live pacing). This split is the spine of the effect ranking and the interaction model (§4).

### 2.5 Motion is compositor-only

Animate **transform / opacity / clip-path** (and `filter` sparingly). Never animate `width/height/top/left/margin/padding/border/font-size`. Use `will-change` narrowly and only while an element is visible; remove it after. This matches the user's `performance.md` and the existing `anim.js` discipline.

### 2.6 Ranked effects list

Ranked by **(impact on "stunning") × (fit with fixed-canvas reveal + brand) ÷ (risk to print/reduced-motion/screen-share)**. **V** = viewer-facing, **P** = presenter-facing. Full per-effect implementation notes live in §6 roadmap; the ranking:

| # | Effect | Aud. | Where | Risk |
|---|---|---|---|---|
| 1 | **Auto-animate morphs on content pairs** (numbers/bars physically travel between slides) | V | KPI + funnel + before/after pairs | low |
| 2 | **Rocket-launch + orbital-ring self-draw** (SVG line-draw on entry) | V | cover 01, closing 11 | low |
| 3 | **Kill dark status-board → light "mission-control" with fill-in bars** | V | slide 09 | low |
| 4 | **Grouped fragment builds, opt-in per slide** (presenter-paced reveals) | P→V | funnel + any "land points sequentially" slide | **medium** — the one effect that can create an empty shared screen; gate behind explicit per-slide opt-in |
| 5 | **Marker tools in the presenter view** (point/mark from the console) | P | presenter preview + marker plugin | medium (message bridge) |
| 6 | **Subtle mesh/atmosphere behind cover + dividers** (radial-gradient wash + baked grain) | V | cover, closing, "empty-feeling" slides | low (static); medium if animated → don't animate first |
| 7 | **Count-up everywhere + click-to-replay** | V+P | every KPI/stat | none (pure adoption) |
| 8 | **Entrance parallax within the fixed canvas** (ghost-index + media at different translateY) | V | hero + masonry | low |
| 9 | **Designed hover/focus/active on every interactive element** | V+P | funnel, tiles, thumbs, nav, presenter buttons | none |
| 10 | **Backdrop-transition depth between sections** (per-section bg tint + bg slide/zoom) | V | section openers only | low |
| 11 | **3D tilt on ONE showcase slide** (±3–4° pointer-driven) | V | business-card showcase (06) | medium (taste + scaled-canvas coordinate trap) — ship last, one slide, cut if in doubt |

---

## 3. Per-Slide Redesign Spec (all 11 + new archetypes)

**Diagnostic baseline (from code):** `DEFAULT_CHROME` in `render.js` = cover/closing blue, **statusBoard dark**, everything else light; slides 05/06 force `slide--muted` (blue-50). A slide CAN override via `slide.chrome` — the plumbing exists, it's unused. **Chrome discipline for the whole redesign: only 01 + 11 stay `slide--blue`; NO slide stays `slide--dark`; use `slide--muted` (blue-50) for candid/quiet slides (05, 06); light + bento everywhere else.**

**Unused brand assets to deploy** (the single biggest missed lever — the deck tells stories about charities/products while showing none): `marketing-photo.jpg` (sanctioned circular-photo signature), `key-visual-space.png` (rocket key visual), 8 `product-ui/` screenshots (dashboard, donor-feedback, training-center, achievement-gallery, photo-verification×3, individual-achievement), 34 partner-charity logos (amnesty, wwf, unicef, msf, greenpeace, sos, care…). All in `/Users/samuelzierlinger/.claude/skills/formunauts-design/assets/`.

### 3.1 Three new archetypes (the structural fixes)

**A. `deviceMockup` — the photo-integration fix (highest leverage).** A sibling to `assetFrame`: `deviceFrame(base, file, { device: "phone" | "browser" | "desk" })`.
- `.device-frame--phone`: 36px-radius body, notch, bezel, `--elevation-4` — LinkedIn/app posts, future APP screenshots.
- `.device-frame--browser` (`.window-card`): Mac title bar (three dots) + `object-fit:cover` top-crop — web-page screenshots (UK page, Key Value page, `dashboard.png`, `training-center.png`).
- Unlocks the 8 unused `product-ui` screenshots and every future web/app capture. **Fixes "photos under-integrated" across the whole tool, not one slide.**

**B. `bentoBoard` — the anti-empty-lower-third layout.** Reusable `grid-template-columns: repeat(12,1fr)` bento with `data-span`/`data-rowspan` per tile; tiles auto-styled as white cards (`--radius-lg`, `--elevation-2`) on `--blue-50`. Powers slide 09 (replacing dark statusBoard), slide 08 content wall, and any "mixed stats + text + thumbnail" slide. **The structural fix for "slides aren't filled" — bento fills by definition.** One hero tile spans 2×2; selective-emphasis rule: if one tile holds a screenshot, neighbors go text-only.

**C. `calendarMoment` — the platform ask as a first-class slide.** Renders a compact agenda/meeting block bound to the connected Google Calendar (via the Lane-A cache file, §5). "This deck is attached to: Marketing Demo · today 14:00" + attendee chips + an "Invite viewers" affordance. Satisfies three platform asks at once. Pairs with the slide-03 and slide-10 calendar hooks.

Also add a **duotone utility** (CSS-only, no preprocessing): `.media--duotone` = `filter: grayscale(1) contrast(1.05)` + a `mix-blend-mode: multiply` blue overlay; expose as `{ treatment: "duotone" }` on `assetFrame()`. Reserve full-color for money shots (product UI, business cards); duotone the supporting cast.

### 3.2 Per-slide spec (most-impactful first)

> Each: chrome · fill-strategy · photo-integration · depth · one signature move. Content edits stay in `decks/2026-07-01.deck.js`; layout/logic in `template/*`.

**#1 — Slide 09 "Foundations under the highlights" (statusBoard) — KILL THE DARK.**
- **Chrome:** drop `statusBoard` default to `slide--muted` (blue-50) in `DEFAULT_CHROME`. No dark anywhere.
- **Fill:** replace the 2-col chip list with a **4-tile bento** (`bentoBoard`). "Strategy & web" = tall hero tile (2×2), "Data & ops" a wide tile, two accent stat tiles bottom-right. White `--bg-surface` cards fill edge-to-edge.
- **State system, re-skinned for light:** `done` → `--success-500` dot + `--success-100` pill; `active` → `--fmnts-primary` dot with the existing `0 0 0 4px rgba(0,116,200,.18)` glow-ring (keep — best micro-detail on the slide); `next` → `--fg-subtle`.
- **Photo:** the hero tile carries a framed `.window-card` screenshot of the UK inhouse / Key Value page.
- **Depth:** tiles at `--elevation-2` on blue-50; a progress ring (SVG arc, `--fmnts-primary`) top-right of "Data & ops" showing "3/4 done."
- **Signature:** a thin `--fmnts-primary` **completion meter** across the top of the bento, filling to the % of `state:"done"` items (computed from data, animated via the `anim.js` count-up pattern). "The engine, quantified."

**#2 — Slide 04 "Reinhard is live" (projectVisual/hero) — the flagship, make it fill.**
- **Chrome:** `slide--light` with a full-bleed left rail: the hero LinkedIn post sits inside `.device-frame--phone` (finally giving the tall 0.55 ratio a reason to be tall).
- **Fill:** rebalance grid to `minmax(0,3.6fr) minmax(0,6.4fr)`; right column gets THREE rows — planned thumbs, a **metrics strip** (3 Chillax stat pills: impressions / reactions / profile views, count-up), the banner. Fills top-to-bottom.
- **Photo:** thumbs get a "PLANNED" ghost treatment (`filter: grayscale(0.3) opacity(0.85)`) so the LIVE hero pops (semantic state, not decoration); banner `object-fit:cover` as a true full-width strip.
- **Depth:** phone mockup overlaps the kicker rule `-12px` (editorial depth); soft `--elevation-4`.
- **Signature:** a **"NEW POST EVERY TUE 09:30" cadence chip** that pulses once on entry (the `active` glow-ring keyframe) + a hairline connector line from the LIVE badge to the first PLANNED thumb — "a series, not a one-off."

**#3 — Slide 08 "Keeping the channel alive" (projectVisual/masonry) — real bento, not a shy row.**
- **Chrome:** `slide--light`, faint `--blue-50` behind the wall so white posts read as pinned cards.
- **Fill:** convert the centered flex row to a true bento (`bentoBoard`) filling `.content` edge-to-edge: ONE feature post large (`span 5 × full height`), four smaller in a 2×2 cluster. No centering, no side-gap.
- **Photo:** feature tile `object-fit:cover` (sanctioned cover crop); supporting tiles `contain`. Small channel badge (IG/LinkedIn glyph in `--fmnts-primary`) top-left of each = live feed.
- **Depth:** stagger `translateY` ±8px per tile; hover `scale(1.02)` (exists); feature tile overlaps the lead line 12px.
- **Signature:** a **"+ 40 more this quarter" ghost tile** (dashed `--border-default`, Chillax "40+") as the last cell — turns the wall into a drumbeat and fills the final grid cell.

**#4 — Slide 03 "The funnel" (campaignAnalysis) — fill the left column, land the payoff.**
- **Chrome:** `slide--light` (keep; the blue funnel is the color story).
- **Fill:** rebuild the empty left column as a vertical stack reaching the bottom: (1) the 4 stat pills as a 2×2 **metric grid** of white cards (`--elevation-1`, bigger Chillax numerals); (2) a **"Next step" callout card** — `--blue-100` bg, `--fmnts-primary` left keyline (the ONE sanctioned activity-stripe use), "Reviewing next steps with Max — today 14:00," wired to Google Calendar (§5).
- **Photo:** none (data slide). The single red hot-lead pill gets a subtle entry pulse so the eye lands on the money metric.
- **Depth:** funnel stages `--elevation-1`; a faint drawn conversion-rate arc (SVG, `--fmnts-primary-50`) hugging the funnel's right edge labeling the 26.8% accept step.
- **Signature:** clicking the last funnel stage (already reveals drop-off) resolves a "so what" ribbon → the 25/7/8/10 breakdown, connecting funnel to pills as one system.

**#5 — Slide 02 "Last 3 weeks — at a glance" (overviewBullets) — anchor the agenda.**
- **Chrome:** `slide--light`.
- **Fill:** left bullets become a **numbered agenda with per-item progress meaning** — each gets a thin `--fmnts-primary` under-rule whose length hints "how far along," turning 5 flat lines into vertical rhythm. Right aside becomes a taller "Also shipped" panel with a mini 5-item list + the **rocket key-visual** (`key-visual-space.png`, ~180px, VISIBLE at ~0.5 opacity, not the invisible 0.05 watermark) anchored bottom-right.
- **Depth:** aside panel gets a `--border-subtle` left rule + soft `--blue-50` fill (distinct surface); bullets ride above the now-visible rocket.
- **Signature:** each agenda item is a **live jump-link** (clicking "01 Switzerland" → `Reveal.slideto` slide 03). The agenda becomes the deck's nav — doubly useful in the presenter console.

**#6 — Slide 10 "Next weeks & ongoing" (nextSteps) — bookend that fills.**
- **Chrome:** `slide--light` (mirrors slide 02).
- **Fill:** convert two lists into two **horizontal timeline lanes** (`grid-template-rows: 1fr 1fr`), each a full-width track with items as nodes (near-term → Q3). "Web · campaigns · content" = active lane (`--fmnts-primary`); "Data · ops" = ongoing lane (`--fg-subtle` dashed). Fills L-to-R and top-to-bottom.
- **Photo:** none, but the camera/WEBB and UK-live items get Lucide icon chips (`camera`, `globe`).
- **Depth:** active lane forward (`--elevation-1` nodes); a **"today" marker** (thin red `--fmnts-secondary` vertical line — the one stopper) anchors the left edge.
- **Signature:** **"Add to calendar" affordance** on datestamped items (UK live, camera ~2wks) → hooks Google Calendar (§5). The "associate presentations with meetings" ask, concrete on the one slide that lists dated deliverables.

**#7 — Slide 05 "What we learned" (projectVisual/single, muted) — dignify the honest slide.**
- **Chrome:** keep `slide--muted` (blue-50; suits a candid "this didn't work" moment).
- **Fill:** split into a **two-column "what died / what we salvaged" board** (`5fr 5fr`). Left: the red-keyline verdict card ("LinkedIn wasn't the right environment") — large, `--danger-100`-tinted, `--fmnts-secondary` stopper. Right: a 2×2 grid of "carry-forward" cards (Barbara cards / Indeed Smart CV / FB groups / Melandri & Zanella), white cards + Lucide icon + arrow. Both reach the bottom.
- **Photo:** the "Barbara business cards" card holds a tiny thumbnail of `barbara-card-proof.png` (teasing slide 06) — visual continuity into the next slide.
- **Depth:** verdict card visually heavier (larger type, `--elevation-2`, red keyline) vs four lighter cards — real hierarchy, not five equal lines.
- **Signature:** a diagonal **"PIVOT →" ribbon** (drawn, `--fmnts-primary`) bridging the two columns — the turn from failure to salvage.

**#8 — Slide 06 "Barbara's business cards" (projectVisual/single showcase, muted) — hero the artifact.**
- **Chrome:** keep `slide--muted` (or `slide--light` with a faint paper texture).
- **Fill:** keep the centered hero card but fill the empty bands — add a left meta-column (`3fr 7fr`) with print specs as small Chillax-labeled data ("Front + back," "Print-ready," "→ shipped to Barbara," stock/size); card proof stays hero on the right, larger.
- **Photo:** card proof gets a realistic print-mockup treatment — soft paper drop-shadow (`--elevation-4`), the existing `-1.2deg` tilt, plus a faint "back of card" layer peeking behind (overlap/stacking) = physical cards on a surface.
- **Depth:** stacked-cards overlap + strong elevation; faint `--blue-50` radial behind lifts them off the mat.
- **Signature:** a **front/back hover-flip** (or auto-alternate on entry) — the proof already shows both; split them and cross-fade so a static proof feels interactive. **This is also the home for the §2 #11 3D tilt (ship last).**

**#9 — Slide 07 "Ad Quality Assurance" (processDiagram) — fill under the pipeline.**
- **Chrome:** `slide--light`.
- **Fill:** keep the 3-card flow but add a **before/after band** filling the lower third: "BEFORE: dashboard-by-dashboard (N tabs)" vs "AFTER: one analysis" — the value prop currently only spoken. Cards upper 60%, band lower 40%, footnote integrated into the "after" side.
- **Photo:** step 1 ("Pull all running ads") gets a stacked-dashboards thumbnail (reuse `dashboard.png` as a stand-in platform tile).
- **Depth:** connect the 3 cards with a continuous drawn **pipe/flow line** (`--fmnts-primary`, arrows become nodes) rather than detached cards + arrows — one system.
- **Signature:** an **"→ automated" end-cap** — a 4th ghosted/dashed node labeled "next: automated reviews," promising the roadmap item and filling the pipe's right end.

**#10 — Slide 01 Cover — already strong, push depth.**
- **Chrome:** keep `slide--blue`. Do NOT lighten.
- **Fill:** the composition is intentionally airy (a cover should breathe) — leave the headline zone, add a faint **star/particle field** (tiny drawn dots, `rgba(255,255,255,0.06–0.14)`, parallax on the rings) in the upper-right negative space so it's atmosphere, not emptiness.
- **Photo:** optional circular-masked `marketing-photo.jpg` bleeding the far-right edge behind the rocket (the layout signature), low prominence, if a human face is wanted.
- **Depth:** make the orbit rings a **3-layer parallax** (foreground 2°, mid 1°, new far ring static); rocket gets a subtle floating bob (`translateY` 6px, 6s, reduced-motion off).
- **Signature:** a one-shot **"ignition" on entry** — rocket `drop-shadow` blooms and one ring-dot traces its arc once, then settles (900ms). Bookends with closing's arc.

**#11 — Slide 11 Closing — bookend, add the payoff.**
- **Chrome:** keep `slide--blue`.
- **Fill:** give the thesis ("From many channels to one data-driven engine") a **visual echo** — a small drawn diagram bottom-right of many lines (channels) converging into one node (the engine), `rgba(255,255,255,.7)` strokes. Fills the empty corner AND visualizes the sentence.
- **Photo:** the **partner-charity logo wall** — a faint single-row strip of 6–8 charity logos (amnesty, wwf, unicef, msf, greenpeace, sos…) at low white-opacity along the bottom. The 34 unused logos belong here.
- **Depth:** converging-lines diagram + rings share the top-left/bottom-right diagonal; claim lockup anchored.
- **Signature:** the **cover→closing ring arc completes** on entry (half-built via `data-auto-animate-id="bookend"`) — the ring-dot finishes its orbit and the channel-lines animate into the single node on the same beat. The deck visibly "closes the loop."

---

## 4. Interaction Model — Presenter vs Viewer

**The request:** point and mark **from the presenter console** (not only fullscreen slideshow), mirrored to the audience screen — same machine (BroadcastChannel) AND remote viewers (PartyKit).

**The insight that makes it work:** the marker already speaks **author coordinates** — the same 1280×720 space the peek iframe, the shared window, and every viewer render at. An annotation event is therefore projector-independent: capture `{x,y}` in author space → replay it verbatim through the marker on the shared window and viewers. A presenter on 4K and a viewer on a phone land on the same word, because nobody ships screen pixels — they ship author points.

**Design in one line:** the presenter console becomes the annotation **source** (a live author-space canvas over the current-slide preview); the marker plugin gains an inbound `remote*` API so the shared window (BroadcastChannel) and remote viewers (PartyKit, presenter-gated) **render** those exact strokes; viewers are draw-locked and only send feedback (reactions, hands, Q&A, votes) upstream; timer/notes/pacing/preview stay private to the console.

### 4.1 Who can do what

| Capability | Presenter (console **or** shared) | Viewer (remote) | Enforced where |
|---|---|---|---|
| Navigate slides | ✅ | ❌ (follows) | `deck.ts` `set-slide` role gate |
| Laser / pointer | ✅ emits | 👁 sees comet/ghost | console/shared → BC + Party |
| Ink (pen) strokes | ✅ emits, persists per-slide | 👁 sees, cannot draw | marker `onStroke` → transport; server relay |
| Spotlight | ✅ emits | 👁 sees dim+hole | transport (ephemeral) |
| Erase / undo / redo / clear | ✅ | ❌ | presenter-only op types |
| Blackout / freeze | ✅ | 👁 sees black | `pause` cmd (exists) |
| Timer / pacing / notes / next-preview | ✅ (private) | ❌ never sent | console-local only |
| Open/close poll | ✅ | ❌ | `deck.ts` `poll-open` gate |
| Vote in poll | ✅ | ✅ | `deck.ts` `poll-vote` |
| Raise hand | ❌ | ✅ | `deck.ts` `hand` gate |
| Ask question (Q&A) | ❌ (reads queue) | ✅ | `deck.ts` `question` → presenters |
| Send reaction (on-brand glyph) | 👁 sees tally | ✅ | `deck.ts` `reaction` fan-out |

**Rule of thumb:** anything that changes *what's on the shared screen* is presenter-only and flows **downstream** (presenter → everyone). Anything that is *audience feedback* is viewer-originated and flows **upstream**, aggregated. Timer/notes/preview never leave the console.

### 4.2 The two sync paths

- **BroadcastChannel** (`"fmnts-deck"`, `proto:1`) = same-origin, same-machine, zero-latency. Primary path for presenter-laptop → projector (console drives fullscreen). Already proven by existing state/cmd sync.
- **PartyKit** (`party/deck.ts`, Durable Object per room) = remote viewers on other devices. Additive; silent no-op unless `?room=` + host present. The console, when in a room, is the authenticated **presenter** socket and emits marks upstream; `deck.ts` validates + fans out.

**One emitter per session (no double-draw):** if the console is in the room → the console emits to Party; the shared window (if also in the room) joins as a silent relay/renderer. If only the shared window is in the room → it emits (today's `collab.js` presenter path, extended to marks). A `sid`/`origin` stamp on every mark lets receivers dedupe and ignore their own echo.

### 4.3 Presenter-view annotation — detailed design

Today `#pv-current-frame` is a dead `?present=peek` iframe. Turn it into a live annotation stage **without touching the child deck's DOM**:

- Add a transparent **canvas overlay sibling** (`#pv-annot`, `position:absolute; inset:0`) + a small toolbar inside `.pv-frame-shell` (laser | pen | spot | erase | undo | clear).
- **Author mapping from the preview shell** (zero cross-frame coupling — derive scale from the shell's own `getBoundingClientRect()`):
  ```js
  function previewAuthorBox(shellRect) {
    const s = Math.min(shellRect.width / 1280, shellRect.height / 720); // reveal's fit
    const w = 1280 * s, h = 720 * s;
    return { scale: s,
             offsetX: shellRect.left + (shellRect.width  - w) / 2,
             offsetY: shellRect.top  + (shellRect.height - h) / 2 };
  }
  const toAuthor = (px, py, box) => ({ x:(px-box.offsetX)/box.scale, y:(py-box.offsetY)/box.scale });
  ```
  This is the same decomposition the marker already does with `Reveal.getScale()` + `getBoundingClientRect()`, sourced from the shell instead of a live reveal.
- **Local echo + transmit.** The console renders strokes on `#pv-annot` for zero-latency presenter feedback AND emits the author-space ops so the shared window's real marker draws the canonical version on the projector. Both consume the *same author ops* → identical render.
- **Per tool:** Laser = throttled `{op:'laser', x, y, on}` + local vanishing-comet; Pen = `{op:'ink-begin', id, color, width, x, y}` / `{op:'ink-point', id, x, y}` (batched) / `{op:'ink-end', id}` with the same 0.75px author-space jitter filter; Spotlight = `{op:'spot', x, y, r}` (`r` via wheel/`[`/`]`); Erase/Undo/Redo/Clear = id-addressed, per-slide-keyed structural ops.

### 4.4 The pivotal code change — inbound marker API

The marker today is **output-only** and **inert in peek**. Add a small, guarded **inbound API** (author-space, idempotent, id-addressed) so any window can be told "apply this op":

```js
api.remoteLaser    = (x, y, on) => {…};
api.remoteInkBegin = (id, slideKey, color, width, x, y) => {…};
api.remoteInkPoint = (id, x, y) => {…};
api.remoteInkEnd   = (id) => {…};
api.remoteSpot     = (x, y, r) => {…};            // view-only
api.remoteOp       = (op, arg) => {…};            // erase|undo|redo|clear|clear-all
api.setViewerLock  = (on) => {…};                 // block local pointer drawing on viewers
```

Two guards make it safe:
1. **Peek stays inert for local input**, but `remote*` still functions on the **shared window** (not peek). On **viewers**, the marker initializes normally + `setViewerLock(true)` so their own pointer can't draw — they only render remote ops. **Result: viewers see the real laser comet, real ink, real spotlight — not a degraded dot.**
2. Every `remote*` op carries the **slide key** it belongs to; if the receiver isn't on that slide yet (slide event + mark event race), the op is buffered in `inkFor(slideKey)` and painted when `onSlideChanged` lands there. Ink is per-slide already, so it self-heals.

### 4.5 Event protocol

- **BroadcastChannel** extends the existing `proto:1` vocab with a bidirectional `t:'mark'` message (author-px coords): `op:'laser'|'ink-begin'|'ink-point'|'ink-end'|'spot'|'spot-off'|'erase'|'undo'|'redo'|'clear'|'clear-all'|'mode'`, each stamped `origin` + `sid` + `slide:'h.v'`. The shared window's `deck-link.js` grows a handler mapping `t:'mark'` → `RevealMarker.remote*`.
- **`state` payload** gains one additive field `ink: RevealMarker.getInk()` (sent on `hello` + slide change) so a freshly-opened console/viewer shows existing marks. Small; serialize already skips empty slides.
- **PartyKit** `deck.ts` gains a `mark` message type, **presenter-gated exactly like `set-slide`/`pointer`**: coords clamped, id/slide length-capped, color against the ink whitelist; laser/spot are **ephemeral (relay only, never persisted)**; ink ops update `this.state.ink[slideKey]` (persisted, ring-capped: ≤300 strokes/slide, ≤2000 pts/stroke) so mid-talk joiners get committed ink in the `onConnect` snapshot. Viewer `collab.js` `routeMessage` gains `case "mark"` → `RevealMarker.remote*`; hydrates `loadInk` from `state.ink`.
- **Dedupe:** every mark carries `sid` (per-window) + `origin`; receivers ignore marks where `sid === mySid`. A one-time `role:'relay'` handshake at room join decides whether the shared window bridges BC→Party (only if it's the sole presenter-rights member and the console is not in the room). Each op applied exactly once per renderer.

### 4.6 The rest of the console (beyond annotation)

Mostly exists; the new surfaces slot alongside: Current + Next preview (current gains the annotation overlay) · big speaker notes · timer + wall clock + per-slide pacing bar (green→warm→stopper-red vs `data-timing`) · jump/overview · blackout — **exist**. New: **annotation toolbar + surface** (§4.3) · **audience mini-HUD** (viewers · hands · reactions · Q&A count, shown IN the console via a presenter Party socket) · **reactions/poll control** (Open/Close poll buttons drive `poll-open/close` upstream; Q&A list). When there's no room, all of this silently collapses to the BC-only local case.

---

## 5. Platform — Deck Hub, Calendar, Invites

### 5.1 The honest boundary table (read first)

| Capability | Ships **static now** (Pages, zero backend) | Needs a **small backend** (one Worker/PartyKit) | Needs **OAuth / server secrets** |
|---|---|---|---|
| Deck hub grid (thumbnails, title, date, status) | ✅ `hub.html` + `decks/index.json` + `?present=peek` iframes | — | — |
| Open / Present / Duplicate-as-download / PDF | ✅ URLs + a client file generator | — | — |
| "Plan/attach" a deck to a meeting | ✅ **authoring-time** via Calendar MCP in a Claude session | live "my upcoming meetings w/ deck" widget → needs a read endpoint | ✅ a self-serve (non-Claude) button → Google OAuth |
| Invite viewers — QR + `?room=` link | ✅ QR renders client-side; links are static | the room only *does* something once PartyKit is deployed | — |
| Live follow / reactions / polls / presence | already coded (`collab.js`+`party/deck.ts`) | ✅ `npx partykit deploy` + `PARTY_HOST` (~$0, hibernates) | presenter lock = `PRESENTER_TOKEN` env (a shared secret, not OAuth) |
| Marker/annotation **in presenter view** | ✅ pure client — extend BC `cmd` vocab (§4) | — | — |
| Email the viewer link / calendar invite | ✅ **now**, via Gmail/Calendar MCP in a Claude session; `mailto:` self-serve | a self-serve "Email invite" button that sends on our behalf | ✅ self-serve send → OAuth or API key |

**The load-bearing honesty point:** the connected Calendar MCP (`mcp__92c178d3-…`) and Gmail MCP are tools available to **Claude inside a Code session**, NOT JavaScript APIs the deployed `hub.html` can call. A teammate opening the hub in their browser has no MCP. So calendar/email split into two lanes:

- **Lane A — "Claude does it" (ships today):** you ask Claude (or a saved `/attach-deck` prompt) "attach the 07-01 deck to the Monday sync," and Claude uses the MCP to create/patch the event and paste the links. **Zero deployment.**
- **Lane B — "the page does it" (needs OAuth):** an `[Add to Calendar]` button on the hub any teammate clicks. Needs Google OAuth + token store. **Deferred — not needed for a team this size; Lane A covers it.**

> **Note for the implementer:** the Calendar MCP tools are **deferred** — load via ToolSearch (`select:mcp__92c178d3-d30a-46a8-a4fe-67e3b38075b3__list_events,…`) before calling. Same for Gmail (`mcp__590490b6-…__create_draft`) and scheduled-tasks (`mcp__scheduled-tasks__*`).

### 5.2 Deck Hub / Planner (`hub.html`)

**File shape (all additive, nothing existing changes; mirrors the existing `template/presenter/` sibling-folder pattern):**

```
demo-deck/
├── hub.html                     NEW — the platform front door (overview grid)
├── decks/
│   ├── index.json               NEW — the MANIFEST (powers the hub)
│   ├── agenda.json              NEW — written by a nightly routine (calendar cache)
│   └── 2026-07-01.deck.js        (existing — unchanged)
├── template/hub/                NEW — hub chrome (twin of template/presenter/)
│   ├── hub.js                   grid render, filter/sort, actions, QR, share sheet
│   ├── hub.css                  token-driven (brand.css), bento grid — NOT uniform cards
│   └── manifest.js              load + validate index.json; deriveStatus()
└── tools/new-deck.mjs           NEW (optional) — scaffolds a deck + appends to index.json
```

`hub.html` loads `brand.css` first (like `presenter.html`) so it **is** Formunauts, not a dev tool.

**The manifest `decks/index.json`** is the contract — the ONLY thing an author edits to make a deck appear (plus dropping the `.deck.js`). Hand-authored, not auto-scanned (GitHub Pages has no directory listing; a static page can't `readdir()`). Per-deck fields: `id` (must match `decks/<id>.deck.js` and `?deck=`, validated with the existing `/^[0-9A-Za-z._-]+$/` regex), `title`, `date` (ISO; hub sorts/groups by this), `occasion`, `status` (draft|ready|live|delivered|archived), `owner`, `slideCount`, `durationMin`, `cover` (`{kind:"peek"}` default = render slide 1 live, or `{kind:"image", src}`), `accent`, `tags`, `links` (share/present/room/pdf/calendarEventId), `updatedAt`. **Validation:** guard every field at the boundary; unknown `status` → `"draft"`; missing `cover` → `{kind:"peek"}`; a malformed entry is skipped with `console.warn`, never crashes the grid (same posture as `renderDeck`'s array guard). `deriveStatus()` can upgrade at render time (e.g. date within the meeting window + a room exists → badge `live`).

**Thumbnails with ZERO screenshot pipeline** — the payoff of `?present=peek`. Each tile is a lazy, self-rendering, always-current live iframe:
```html
<iframe class="hub-tile__peek" src="index.html?deck=2026-07-01&present=peek#/0"
        loading="lazy" scrolling="no" tabindex="-1" aria-hidden="true"></iframe>
```
`loading="lazy"` + IntersectionObserver so only ~6 visible iframes boot (each peek deck is light — motion stripped). The `cover.kind:"image"` escape hatch handles 20+ decks or an OG still.

**Layout — deliberately NOT a uniform card grid** (banned by design rules): **bento composition** — the next/most-recent deck is a hero tile (2×2, large peek), older decks smaller, drafts in a muted "In progress" rail; grouped **"Up next" · "Recent" · "Archive"** with editorial section headers; each tile carries title (Chillax), date + `slideCount·durationMin` chip, a **status pill reusing the exact statusBoard dot semantics** (`delivered/live/draft` → `--success-500`/`--fmnts-primary`/`--fg-subtle`), an accent hairline. Hover lifts (`translateY(-4px)`, `--elevation-4`) and fades in a row of actions (the exact `transform`/`opacity` + `--ease-orbit` idiom the codebase uses).

**Per-tile actions (all client-side URLs or a small JS generator):** Open (`index.html?deck=`) · Present (`presenter.html?deck=`, reusing the existing popup+fallback) · PDF (`?deck=&print-pdf` or `links.pdf`) · Invite (share sheet §5.4) · Plan (calendar §5.3) · Duplicate · Copy link.

**Create/Duplicate on a static host — the honest version (ship both):**
1. **Duplicate-as-download (pure static, works today):** fetch `decks/<id>.deck.js` as text, rewrite `meta.date`/`meta.title`, trigger a `Blob` download of the new file + a copy-paste `index.json` snippet. Author drops it in and commits. Matches the "I keep multiple copies" workflow.
2. **Scaffold via CLI (the real authoring path):** `node tools/new-deck.mjs 2026-07-15 "Marketing Update"` copies the file + appends to `index.json`. This is where *creation* belongs — automating the flow the deck header comments already document.

> A "New deck" button that truly writes to the repo from the browser needs a commit-proxy Worker with a GitHub token. **Not recommended** — the CLI/duplicate flow is simpler and safer for a non-dev with backups.

**`hub.html` becomes the platform front door.** `deploy.sh` already publishes the whole folder; link people to `…/hub.html` (or make it the Pages index and move the deck to `deck.html`).

### 5.3 Google Calendar — attach a deck to a meeting

The connected MCP (`mcp__92c178d3-…`) has full read/write (`list_calendars`, `list_events`, `get_event`, `create_event`, `update_event`, `delete_event`, `respond_to_event`, `suggest_time`) — usable by Claude in a session, not by the page.

**Lane A — ships today (Claude-driven).** The concrete flow, 1:1 with MCP calls:
1. `list_calendars` → pick the target calendar.
2. `list_events { timeMin: now, q:"marketing" }` → find the meeting (or `suggest_time`/`create_event` for a fresh "Marketing DEMO" slot).
3. Build the deterministic links from the manifest entry: `share = …/?deck=2026-07-01`, `presenter = …/presenter.html?deck=2026-07-01`, (if live) the room viewer link (§5.4).
4. `update_event { eventId, description += a Formunauts block (Present / Audience view / PDF links), location: share link }`.
5. Write back `links.calendarEventId` into `decks/index.json` so the hub can show "attached to <meeting>."

Because the link is deterministic (`?deck=<date>`), Claude can `create_event` for the next fortnight's demo and pre-attach the not-yet-built deck's predicted URL. Slides 09/10 already reference the "Demo and Look Ahead" cadence — this wires the deck *to* that recurring event.

**The reverse — "upcoming meetings that have a deck" — cache-file variant (the sweet spot, no OAuth):** a scheduled Claude routine (`mcp__scheduled-tasks__*`) runs each morning, calls `list_events`, and writes `decks/agenda.json` (next 7 days of deck-tagged meetings). `hub.html` fetches that flat file for an "Up next: Marketing DEMO — Mon 10:00 · deck ready ▶" strip, and the `calendarMoment` archetype (§3) reads it too. **No OAuth, no server** — a nightly agent writing a JSON the page reads.

**Recommended:** ship Lane A + the `agenda.json` cache variant. Reserve Lane B OAuth for the (unlikely) day teammates must self-attach without Claude.

### 5.4 Invite viewers — share flow

The collab layer is **already written and correct** — `collab.js` reads `?room=&role=&t=&name=`, server-enforces roles (`party/deck.ts authorize()`), no-ops unless `PARTY_HOST` + `?room` are both present. **Inviting is URL-construction + QR + delivery, not new code.**

**The two links (contract already exists):**
```
Viewer:    …/index.html?deck=2026-07-01&room=demo0701[&party=<host>]   → role defaults to viewer, no token
Presenter: …/index.html?deck=2026-07-01&room=demo0701&role=presenter&t=<PRESENTER_TOKEN>[&party=<host>]
           → server demotes to viewer if the token is wrong
```
Bake `<meta name="party-host">` into `index.html` and the viewer link becomes just `?deck=…&room=…` — clean enough for a QR.

**The share sheet (client-side, brand-styled via the `collab.js` scoped-style idiom):** a **QR** of the viewer link (vendor a ~4KB QR lib, no CDN — like reveal's plugins) · Copy viewer link / Copy presenter link · Room-name field (defaults to `deck.id`-derived `demo0701`, writes `links.room` back) · "Open presenter for this room" · Email/calendar-invite (Lane A now via Gmail/Calendar MCP; `mailto:` as the honest static self-serve default).

**QR on the cover (deck-data-only, no chrome edit):** the cover/closing archetype reads an optional `slide.qr` / `meta.room` field and renders the QR in-slide — so the first slide the room sees on the projector shows "Scan to follow along." Consistent with the CONTENT/CHROME split.

**What makes invites *do* something:** everything above renders statically today; for the links to actually sync viewers, **one command:** `npx partykit deploy` (`partykit.json` exists), then set `PARTY_HOST` (bake into `<meta>` or pass `?party=`). Optionally `PRESENTER_TOKEN` to lock control. Cost: hibernates to ~$0 (`party/deck.ts` `hibernate:true`). **This is the only deployment the whole platform needs.**

---

## 6. Phased Build Roadmap

Legend: **[now]** buildable-now (static, no backend) · **[backend]** needs the one PartyKit deploy · **[oauth]** needs OAuth (deferred) · **[mcp]** driven by a Claude session's MCP (no deploy). Effort: **S** ≤ half-day · **M** ~1–2 days · **L** ~3–5 days.

### Phase A — Static wins (slide redesigns + effects + presenter-view annotation + deck hub)

Nothing here blocks on a backend. Deployable via the existing `deploy.sh`.

| # | Item | Track | Now/Backend/OAuth | Effort |
|---|---|---|---|---|
| A1 | Motion tokens into `brand.css` (§2.1–2.3) + `template/DESIGN.md` spine (§1.5) | motion + inspiration | [now] | S |
| A2 | **Kill dark slide 09** → light `bentoBoard` "engine room" + completion meter (§3 #1, §2 #3) | per-slide + motion | [now] | M |
| A3 | Count-ups everywhere + click-to-replay (§2 #7) — pure adoption of existing engine | motion | [now] | S |
| A4 | Micro-interaction system: shared `:hover/:focus-visible/:active` off tokens (§2 #9) | motion | [now] | S |
| A5 | New archetypes: `deviceMockup` (`.device-frame--phone`/`.window-card`) + `bentoBoard` + duotone utility (§3.1) | per-slide | [now] | M |
| A6 | Auto-animate morphs on content pairs — generalize `sectionOpen` to data-driven `autoAnimate`/`autoAnimateId` (§2 #1) | motion | [now] | M |
| A7 | Rocket/ring self-draw on cover + closing (§2 #2) + cover ignition/parallax (§3 #10) | motion + per-slide | [now] | M |
| A8 | Remaining slide redesigns 02–08, 10, 11 (§3 #2–#9, #11-prep) using A5 archetypes + fill strategies | per-slide | [now] | L |
| A9 | Entrance parallax (§2 #8) + mesh/grain atmosphere on bookends (§2 #6, baked grain, static mesh) | motion | [now] | M |
| A10 | **Presenter-view annotation** — marker inbound `remote*` API (§4.4) + `annotate.js` console overlay (§4.3) + BC `t:'mark'` bridge (§4.5) + console toolbar | interaction | [now] | L |
| A11 | **Deck Hub** — `decks/index.json` + `hub.html` + `template/hub/*` with `?present=peek` bento tiles + actions + duplicate-as-download (§5.2) | platform | [now] | L |
| A12 | Opt-in fragment builds, per-slide only (§2 #4) — gate behind explicit flag | motion | [now] | S |

### Phase B — Connected platform (calendar attach + invites + collab deploy)

| # | Item | Track | Now/Backend/OAuth | Effort |
|---|---|---|---|---|
| B1 | **`npx partykit deploy` + `PARTY_HOST`** — turns invites live (follow/react/poll/presence); set `PRESENTER_TOKEN` | platform | [backend] | S |
| B2 | Share sheet + QR (client-side) + `?deck=&room=` link builder on hub + optional cover `qr` field (§5.4) | platform | [now] render / [backend] to sync | M |
| B3 | Extend annotation to remote viewers — PartyKit `mark` message + `ink` in `RoomState` + `onConnect` snapshot (§4.5); viewer `collab.js` `case "mark"` + `setViewerLock` | interaction | [backend] | M |
| B4 | Presenter console audience mini-HUD + poll/Q&A controls via a presenter Party socket (§4.6) | interaction | [backend] | M |
| B5 | **Calendar Lane A** — a saved `/attach-deck` prompt using the Calendar MCP (§5.3) | platform | [mcp] | S |
| B6 | Nightly `agenda.json` routine (scheduled-tasks MCP) feeding the hub "Up next" strip + `calendarMoment` archetype (§3, §5.3) | platform | [mcp] | M |
| B7 | Slide-03 "Next step" + slide-10 "Add to calendar" hooks wired to the calendar flow (§3 #4, #6) | per-slide + platform | [mcp] | S |

### Phase C — Stretch

| # | Item | Track | Now/Backend/OAuth | Effort |
|---|---|---|---|---|
| C1 | 3D tilt on the business-card showcase (06) — one slide, ±4°, live-only (§2 #11) | motion | [now] | S |
| C2 | Backdrop-transition depth between sections (§2 #10) | motion | [now] | S |
| C3 | Console-preview ink broadcast via `?present=console` mode (marker kept, motion stripped) — presenter draws on the preview, strokes forward over BC (§4.3 layer 2) | interaction | [now] | M |
| C4 | Live polls / word-cloud / reactions as first-class interactive archetypes (`poll` sibling in `interactive.js`) | inspiration + interaction | [backend] | M |
| C5 | CLI `tools/new-deck.mjs` scaffolder (§5.2) | platform | [now] | S |
| C6 | Lane-B OAuth calendar button — only if teammates ever need to self-attach without Claude (§5.1) | platform | [oauth] | L |

---

## 7. What to build FIRST — maximum wow, least risk

Ship this exact order. Each step is deployable on its own via `deploy.sh`; nothing here needs a backend or OAuth.

1. **A2 — Kill the dark slide 09** (light `bentoBoard` + completion meter). It's a stated requirement, it's mostly CSS + one existing count-up pattern, and it visibly proves the "filled canvas, on-brand, no dark" direction on the worst offender. Highest satisfaction-per-effort.
2. **A3 + A4 — Count-ups everywhere + the micro-interaction system.** Nearly free (the engine exists), instantly reads as "a product, not a template," and establishes the motion tokens in real use.
3. **A6 + A7 — Auto-animate morphs + the rocket/ring self-draw.** The two signature "how did they do that" moments: numbers physically travel between slides, and the orbital rings draw themselves on the blue bookends (literally on-brand). Biggest bespoke jump for the effort.
4. **A10 — Presenter-view annotation (BroadcastChannel path).** The top *platform* ask, and feasible without a rewrite because the console preview is already a live same-origin peek iframe and the marker already speaks author coordinates. Add the inbound `remote*` API + the console overlay; it works same-machine with zero deployment. (Remote-viewer fan-out is B3, after the one PartyKit deploy.)
5. **A11 — The Deck Hub.** The front door that makes this a "platform," built entirely on `?present=peek` tiles — no screenshot pipeline, always current. This is where the library + planner + (later) calendar/invite affordances live.

**Then** flip B1 (`npx partykit deploy`) to make invites + remote annotation live, and B5/B6 for the calendar attach — the connected-platform phase, gated on exactly one ~$0 command and the in-session MCP, never OAuth.

**Guiding thread:** Phase A delivers a stunning, on-brand, filled-canvas deck + a working hub + presenter annotation with **zero infrastructure**. Phase B lights up sharing and calendar with **one deploy**. Phase C is polish. At no point is OAuth on the critical path for the team's real workflow.

---

## 8. Files touched (absolute paths)

**New:**
- `/Users/samuelzierlinger/Documents/Cowork/Claude Code/formunauts-demo/demo-deck/template/DESIGN.md`
- `/Users/samuelzierlinger/Documents/Cowork/Claude Code/formunauts-demo/demo-deck/template/archetypes/deviceMockup.js`
- `/Users/samuelzierlinger/Documents/Cowork/Claude Code/formunauts-demo/demo-deck/template/archetypes/bentoBoard.js`
- `/Users/samuelzierlinger/Documents/Cowork/Claude Code/formunauts-demo/demo-deck/template/archetypes/calendarMoment.js`
- `/Users/samuelzierlinger/Documents/Cowork/Claude Code/formunauts-demo/demo-deck/template/presenter/annotate.js`
- `/Users/samuelzierlinger/Documents/Cowork/Claude Code/formunauts-demo/demo-deck/hub.html`
- `/Users/samuelzierlinger/Documents/Cowork/Claude Code/formunauts-demo/demo-deck/decks/index.json`
- `/Users/samuelzierlinger/Documents/Cowork/Claude Code/formunauts-demo/demo-deck/decks/agenda.json` (written by the nightly routine)
- `/Users/samuelzierlinger/Documents/Cowork/Claude Code/formunauts-demo/demo-deck/template/hub/hub.js`
- `/Users/samuelzierlinger/Documents/Cowork/Claude Code/formunauts-demo/demo-deck/template/hub/hub.css`
- `/Users/samuelzierlinger/Documents/Cowork/Claude Code/formunauts-demo/demo-deck/template/hub/manifest.js`
- `/Users/samuelzierlinger/Documents/Cowork/Claude Code/formunauts-demo/demo-deck/tools/new-deck.mjs` (optional)

**Edit (additive):**
- `/Users/samuelzierlinger/Documents/Cowork/Claude Code/formunauts-demo/demo-deck/template/brand.css` — motion tokens (§2), layout tokens (§1.5)
- `/Users/samuelzierlinger/Documents/Cowork/Claude Code/formunauts-demo/demo-deck/template/deck.css` — light `.statusboard`, `.device-frame--*`, `.window-card`, `.bento`, `.media--duotone`, fill fixes on `.analysis__side`/`.pivot-list`/`.process`/`.masonry`, fill-in bar keyframes, new `.fragment.rise` effect
- `/Users/samuelzierlinger/Documents/Cowork/Claude Code/formunauts-demo/demo-deck/template/anim.js` — line-draw + parallax hooks
- `/Users/samuelzierlinger/Documents/Cowork/Claude Code/formunauts-demo/demo-deck/template/render.js` — `DEFAULT_CHROME.statusBoard: "muted"`; register new archetypes; generalize `sectionOpen` auto-animate to data-driven
- `/Users/samuelzierlinger/Documents/Cowork/Claude Code/formunauts-demo/demo-deck/template/archetypes/_shared.js` — `deviceFrame()`, partner-logo helper, converging-lines/particle SVG helpers
- `/Users/samuelzierlinger/Documents/Cowork/Claude Code/formunauts-demo/demo-deck/index.html` — optional `<meta name="party-host">`; per-slide `build`/`autoAnimate` plumbing
- `/Users/samuelzierlinger/Documents/Cowork/Claude Code/formunauts-demo/demo-deck/plugin/marker/plugin.js` — **inbound `remote*` API + stroke ids + `setViewerLock`** (the pivotal change; marker becomes bidirectional)
- `/Users/samuelzierlinger/Documents/Cowork/Claude Code/formunauts-demo/demo-deck/template/presenter/presenter.js` — mount annotation surface; emit/receive `t:'mark'`; audience mini-HUD + poll/Q&A controls
- `/Users/samuelzierlinger/Documents/Cowork/Claude Code/formunauts-demo/demo-deck/presenter.html` — `<canvas id="pv-annot">` + annotation toolbar in `.pv-frame-shell`; audience HUD markup
- `/Users/samuelzierlinger/Documents/Cowork/Claude Code/formunauts-demo/demo-deck/template/presenter/presenter.css` — `.pv-annot`, toolbar, HUD (brand tokens only)
- `/Users/samuelzierlinger/Documents/Cowork/Claude Code/formunauts-demo/demo-deck/template/presenter/deck-link.js` — `t:'mark'` → `RevealMarker.remote*`; add `ink` to `state`; `mark`/`point` `exec()` cases
- `/Users/samuelzierlinger/Documents/Cowork/Claude Code/formunauts-demo/demo-deck/template/collab.js` — viewer `case "mark"` → `RevealMarker.remote*`; presenter emits marks; `setViewerLock(true)`; hydrate `loadInk`
- `/Users/samuelzierlinger/Documents/Cowork/Claude Code/formunauts-demo/demo-deck/party/deck.ts` — `mark` message (presenter-gated, validated, laser/spot ephemeral, ink persisted+capped) + `ink` in `RoomState` + `onConnect` snapshot
- `/Users/samuelzierlinger/Documents/Cowork/Claude Code/formunauts-demo/demo-deck/decks/2026-07-01.deck.js` — content-only edits per the §3 redesign (new declarative fields; NO layout/logic)

**Assets (read-only, drive the redesign):** `/Users/samuelzierlinger/.claude/skills/formunauts-design/assets/` — `product-ui/` (8 screenshots), `partner-logos/` (34 logos), `marketing-photo.jpg`, `key-visual-space.png`, `logos/formunauts_visual_blue.svg`, `barbara-card-proof.png`.

**Design-system references to STUDY for structure (not to copy visually):** [awesome-design-md](https://github.com/voltagent/awesome-design-md) (9-section `DESIGN.md` model — the spine) · [Awesome-Design-Tokens](https://github.com/sturobson/Awesome-Design-Tokens) · [alexpate/awesome-design-systems](https://github.com/alexpate/awesome-design-systems) · [Material 3 motion](https://m3.material.io/styles/motion/easing-and-duration/tokens-specs) · [Fluent 2 motion](https://fluent2.microsoft.design/motion) · [reveal auto-animate](https://revealjs.com/auto-animate/) · [reveal fragments](https://revealjs.com/fragments/) · [Bento Grids](https://bentogrids.com/).
