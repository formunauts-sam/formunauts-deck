# Formunauts Present — Platform V2 Concept

The single spec for turning the FORMUNAUTS demo deck into the company's presentation tool: authored on-brand, presented interactively, engaged with by the audience, and managed as a living library. This document is the build spec. It is decisive on purpose.

---

## 1. Product Vision

Formunauts Present is the one tool the company uses to build, run, and reuse presentations. It is not a slide editor and it is not a SaaS. It is a self-hosted, CDN-free web platform where a presentation is declarative data (`decks/<id>.deck.js`) rendered by a fixed, on-brand chrome. Because content is data and chrome is code, a deck can be written by a human copying an example, or emitted by a Claude skill against a schema, and it always looks like FORMUNAUTS.

Four surfaces, one system:

- **Author** — how a deck comes into being. A closed archetype library, a validated deck-spec schema, and a design doc that a Claude skill can drive to produce a perfect on-brand deck from a freshly created HTML pitchdeck.
- **Present** — how a deck is delivered live. The reveal-based deck with orbital motion, the presenter console (notes, pacing, jump, live annotation), and the projected big screen.
- **Engage** — how the audience participates. Follow-along on every phone, reactions, polls, upvoted Q&A, raise-hand, word clouds, shared pointer. Built once against a Transport abstraction that runs locally today and flips to a real backend later with a one-line change.
- **Manage** — how decks live as a library. The Deck Hub with live thumbnails, deck metadata and status, room binding, share links and QR, and a calendar handoff.

The through-line is the brand: orbital motion (everything decelerates, nothing bounces), the rocket-and-ring bookend, blue `#0074C8` with red `#E03B50` as a rare stopper, Figtree plus Chillax, no emoji, no em-dashes, no dark mode. These are not style suggestions. In V2 they become enforced rules the schema validator checks.

---

## 2. The Four Surfaces

### 2.1 Author
The authoring contract is the deck-spec schema (Section 6). Today content is trusted ad hoc: a typo'd field renders empty and nothing complains. V2 adds a schema, a validator, and one consolidated `template/DESIGN.md` so a human or a skill can self-check output before it ever loads. The archetype library grows from 9 to a taxonomy that can express any pitch (big-stat, timeline, comparison, pull-quote, agenda, section-divider, logo-wall, kpi-dashboard, image-full-bleed, map) while staying locked to brand tokens. The design principle is freedom within brand rails: expressive range so decks never look templated, hard rails so they never go off-brand.

### 2.2 Present
Present already works and is the strongest part of the codebase. V2 keeps the reveal core, the presenter console over BroadcastChannel, the marker plugin, and the cover-to-closing ring morph untouched as the platform signature. It adds motion range (self-drawing connectors, orchestrated KPI assembly, morphing agenda lines) and a Join panel that surfaces a room QR mid-talk. Nothing here blocks on a backend.

### 2.3 Engage
Engage is the number-one V2 ask and the one thing that currently does nothing: the whole realtime layer is undeployed and depends on a CDN import that violates the project's own rules. V2 rebuilds it against a Transport abstraction (Section 4) so the entire audience-interaction UI is built and tested locally with zero backend, then flips to Supabase for real phones with a one-line change. Features: synced follow-along, reactions, live polls, upvoted Q&A, raise-hand, word cloud, shared pointer, all on-brand and all with static fallbacks.

### 2.4 Manage
The Hub becomes a real library: deck metadata (status, owner, occasion, tags, duration, room), grouping (Up next, Recent, Archive), lazy-booted live thumbnails, per-deck share link plus QR, and a calendar handoff that reads the deck's own occasion and duration instead of a hard-coded 09:00 slot. The active deck stops being a code edit in three files and becomes a single data flag.

---

## 3. Current State (what we build on)

The codebase is a genuinely disciplined content/chrome split and that is the asset that makes everything below possible.

**Strengths to protect:**
- `render.js` is the only place markup lives; archetypes are pure `fn(slide, ctx) -> string`; deck files are pure data.
- Defensive everywhere: unknown archetype renders a visible warning, not a crash; malformed tiles are skipped; every `data-fx` enhancement degrades to a static twin under print, peek, reduced-motion, or error.
- Coordinate discipline: marker, presenter annotation, and collab pointer all standardize on author-space 1280x720, so a 4K presenter and a phone land on the same word.
- The cover-to-closing ring morph and the auto-playing entrance stagger are the motion spine and they are correct.

**The real gaps V2 must close:**
1. No deck-spec schema or validator. A skill cannot self-check its output. This is the single biggest blocker for skill-drivability.
2. No consolidated `template/DESIGN.md`. Archetype shapes live as scattered prose comments. A skill would have to reverse-engineer each renderer.
3. The whole Engage layer is undeployed and no-ops.
4. `collab.js` imports `partysocket` from `https://esm.sh` — a hard CDN dependency that breaks under the project's own CSP and offline.
5. Brand invariants are documented but not enforced. `chrome: "dark"` is freely settable and a live deck uses it, contradicting the stated no-dark rule.
6. The active deck is hard-coded in `index.html`, `presenter.js`, and manifest ordering.
7. No deck-level metadata for a real library (status, owner, occasion, duration, room).
8. Calendar handoff is half-real: hard-coded title and 09:00-09:30 for every deck.
9. Hub boots N full reveal iframes with only `loading="lazy"`; a large library will boot many heavy instances.
10. No tests, CI, or visual-regression harness for a tool meant to become company-critical.

---

## 4. Engagement Architecture — the Transport Abstraction

This is the load-bearing technical decision. Engage must work locally now and flip to a real backend later without rewriting a single feature.

### 4.1 The rule
Every Engage feature imports **only** `template/engage/transport.js`. Nothing else. Flipping the backend is one line:

```js
const transport = makeTransport(mode, { roomId, role, token, name, clientId });
// mode is resolved from ?engage=local|supabase|partykit  (default: local)
```

No feature code is rewritten when the backend changes. The message vocabulary `collab.js` and `party/deck.ts` already speak becomes the Transport envelope, so about 90% of the wire protocol already exists and is battle-tested.

### 4.2 The envelope
A single flat shape extending the existing `deck-link` proto:1 convention:

```
{ proto: 1, t: <type>, room, from, role: 'presenter'|'viewer', seq, ts, ...payload }
```

- **presenter to all:** `set-slide {h,v,id}`, `pointer {x,y,visible}` (author-normalized 0..1), `poll-open {id,q,options[]}`, `poll-close {id}`, `word-open {id,prompt}`, `word-close {id}`
- **viewer to authority:** `reaction {kind}`, `hand {on}`, `question {text}`, `question-upvote {id}`, `poll-vote {id,option}`, `word {token}`, `vpointer {x,y,visible}`
- **authority to clients:** `state` (full snapshot), `slide`, `pointer`, `reaction`, `presence {count,hands}`, `poll`, `question`, `wordcloud {tokens}`

Reactions, pointer, and word tokens are ephemeral (fan-out only, aggregated into counters). Slide, poll, and questions are authoritative state (persisted so late joiners hydrate to the right slide).

### 4.3 The interface (identical across all three adapters)
```
makeTransport(mode, opts) -> Transport
transport.connect(): Promise<void>
transport.send(msg): void                 // adapter stamps proto/room/from/seq/ts
transport.on(type, handler): unsubscribe
transport.onStatus(cb)                     // connecting|live|reconnecting|closed
transport.presence(): {count, hands}
transport.close()
transport.mode                             // 'local'|'supabase'|'partykit'
transport.isAuthority                      // true in presenter tab for local
```

An `authority.js` reducer (validate inbound, whitelist reaction kinds, cap question length, enforce one-vote-per-poll, tally words, ignore presenter-only messages from viewers) is the single choke point. It runs in the presenter tab for local, in the presenter's session for Supabase, and already lives server-side in `party/deck.ts` for PartyKit.

### 4.4 The three adapters

**BroadcastChannelTransport — DEFAULT, buildable and testable NOW.** Same-origin, cross-tab, reusing the exact pattern already proven in `deck-link.js`: a `BroadcastChannel('fmnts-engage:'+roomId)` plus a `localStorage` snapshot for late-joiner hydration and Safari-iframe fallback. The presenter tab holds the canonical state via the in-tab `authority.js`. This lets us open the deck in one tab and `viewer.html` in another (or a phone via a same-origin tunnel) and exercise reactions, polls, Q&A, and follow-along end to end with zero backend and zero cost. It is a local simulator and a genuine second-screen transport (presenter laptop plus presenter phone). It is NOT a remote-audience transport, because same-origin means real phones on their own network cannot reach it. That limit is documented, not hidden.

**SupabaseRealtimeTransport — RECOMMENDED production backend.** Samuel already runs Supabase across marswalk, time-tracker, and leadgen, so this is one client library, one env var, RLS-gated rooms, and it hibernates to roughly $0 at his audience sizes. Broadcast carries the ephemeral fan-out (`channel.send({type:'broadcast', event: msg.t, payload: msg})` maps 1:1 onto our envelope). Presence carries live viewer count and the raised-hands set natively, replacing hand-tracking bookkeeping for free. The `@supabase/supabase-js` ESM build is vendored into `vendor/` exactly like `reveal.mjs`, no CDN. Presenter authority is enforced two ways: an RLS broadcast policy keyed on the presenter token, AND the `authority.js` reducer ignoring presenter-only messages from non-presenter roles. Never rely on hiding buttons.

**PartyKitTransport — the alternate, already-written.** `party/deck.ts` is excellent (server-enforced roles, poll bounds, question ring-buffer, hibernation). Keep it as an adapter behind the same interface; vendor `partysocket` into `vendor/partysocket.mjs` and delete the `esm.sh` import. It introduces a second platform (Cloudflare) that Samuel does not otherwise run, so it is the alternate, not the primary.

### 4.5 Why Supabase over the others
Rejected: raw WebSocket (an always-on server to babysit, no hibernation), WebRTC (needs signaling anyway, does not scale past ~10 peers, brittle on conference wifi), Ably/Pusher (another vendor and bill for primitives Supabase already gives). Supabase is the least new infrastructure for this specific user, gives Broadcast plus Presence out of the box, hibernates to near-zero idle, and slots behind Transport with no feature-code rewrite. PartyKit stays available for anyone who prefers a per-room Durable Object authority.

### 4.6 Security-critical notes
- The Supabase anon key is public in `viewer.html`. This is fine ONLY if RLS is correctly scoped to room plus presenter-token. Treat RLS as security-critical and review before going public; a misconfigured policy lets anyone drive any room.
- All three vendored libraries (`partysocket`, `@supabase/supabase-js`, the QR encoder) MUST be vendored, never CDN. The `esm.sh` line in `collab.js` must be deleted or the layer breaks under CSP.
- Anonymous phone input (words, questions) needs control-char stripping, length caps, per-clientId rate limiting, and a light empty/profanity filter, mirroring what `party/deck.ts` already applies.
- Cap flying reaction nodes (already 40 in `collab.js`) and throttle pointer to ~25/s (already 40ms min); batch reactions into windowed counts if a room gets loud.

### 4.7 Join flow (zero external dependency)
Short link plus QR, both generated with no network call. Short link: `.../viewer.html?deck=<id>&room=<6charRoom>`, with the 6-char code shown big on-screen as a typing fallback. QR: vendor `paulmillr/qr` into `vendor/qr.mjs`, an ESM-native zero-dependency encoder that emits an SVG string, imported like `reveal.mjs`. Render inline SVG (brand blue modules on white, optional rocket in the quiet zone) so it scales crisply on the projector. `viewer.html` is a standalone same-origin page that boots the same reveal deck in locked FOLLOW mode (no manual nav; slide changes arrive only via Transport), portrait, one-thumb: presence bar on top, mirrored slide in the center, reaction bar plus raise-hand plus Ask composer plus poll bottom-sheet in the thumb zone. No login; viewers are anonymous with a `sessionStorage` clientId to dedupe votes.

---

## 5. Prioritized Gap List (impact vs effort)

Ordered by build value. Impact and effort are H/M/L.

| # | Gap | Impact | Effort | Notes |
|---|-----|--------|--------|-------|
| 1 | Deck-spec schema + validator | H | M | Unblocks the Claude skill. Everything Author depends on it. |
| 2 | `template/DESIGN.md` consolidated contract | H | M | The one machine-readable source of truth for the skill. |
| 3 | Transport abstraction + local adapter | H | M | Unblocks all of Engage locally, no backend. |
| 4 | Viewer surface (`viewer.html` + follow-along) | H | M | The visible payoff of Transport; testable on local. |
| 5 | Reactions + polls + upvoted Q&A + raise-hand | H | M | The core audience interactions; build on local. |
| 6 | Vendor QR + Join panel | H | L | Cheap, high perceived value, no backend. |
| 7 | Delete `esm.sh` import, vendor `partysocket` | H | L | Fixes a live CSP violation. |
| 8 | Brand-invariant enforcement (kill/guard dark) | H | L | Schema rejects `chrome:"dark"`; migrate the one offending deck. |
| 9 | Deck metadata + manifest-as-objects | M | M | Enables library grouping, status, room binding, single active-deck flag. |
| 10 | New archetypes (big-stat, timeline, comparison, agenda, section-divider, kpi-dashboard, etc.) | M | M | Expressive range for the skill; each is one file + two registrations. |
| 11 | Supabase adapter + RLS | H | M | Flips Engage to real phones. Blocks on Samuel's login (deferred, never blocks earlier waves). |
| 12 | Motion range upgrades per archetype | M | M | Self-draw connectors, KPI assembly, agenda morph. |
| 13 | Hub upgrades (grouping, QR, calendar-from-deck, IO lazy-boot) | M | M | Library polish; independent of Engage. |
| 14 | Visual-regression + validator CI | M | M | Guards the platform once it is company-critical. |
| 15 | Presenter.js extraction (annotation out, <800 lines) | L | M | Health, not feature. Do opportunistically. |
| 16 | Word cloud + shared viewer pointer | M | M | Second-tier Engage; build on local, ship with Supabase. |
| 17 | Async send-mode + per-viewer analytics | M | H | Post-V2. Real value but needs the backend and new schema. |

---

## 6. Deck-Spec Schema and Authoring Conventions

This is how we prepare everything the future Claude skill needs. The skill only ever writes `decks/<id>.deck.js` plus one manifest entry. It never touches chrome.

### 6.1 Schema mechanism
Author the schema as a **JSON Schema** in `template/schema/deck.schema.json` plus a hand-written validator `tools/validate-deck.mjs` (Node, zero deps, importable both at build time and by a skill). We avoid a heavy dependency: a plain validator that walks the schema is enough and stays CDN-free and buildless, consistent with the rest of the repo. The validator returns `{ ok, errors: [{ slideIndex, field, message }] }` so the skill gets field-level feedback instead of a silently empty slide. `render.js` keeps its permissive guards for runtime safety; the validator is the strict gate the skill runs first.

### 6.2 Deck shape
```
deck = {
  meta: {
    id: "2026-07-15",              // required, matches filename, ASCII [0-9A-Za-z._-]
    title: "Marketing Update",     // required
    date: "15.07.2026",            // required, display string
    lang: "en"|"de",               // required
    imagesBase: "./assets/img/<id>/",  // required
    occasion: "All-Hands",         // optional, drives calendar + library grouping
    durationMin: 30,               // optional, drives calendar end time
    owner: "samuel",               // optional, library
    status: "draft"|"ready"|"live"|"delivered",  // optional, default "draft"
    tags: ["marketing"],           // optional
    room: "K7QP2M",                // optional, binds a persistent Engage room
    cover: "cover-override.png"     // optional
  },
  slides: [ <slide>, ... ]         // required, non-empty array
}
```

### 6.3 Slide shape and shared chrome
Every content slide shares: `id` (required, unique, ASCII), `archetype` (required, enum), `eyebrow`, `headline`, `lead`, `notes`, and optional `timing` (seconds, for presenter pacing). `chrome` is constrained: **enum is `light|muted|blue` only. `dark` is removed and the validator rejects it.** This is how the no-dark invariant becomes enforceable rather than aspirational.

### 6.4 Archetype catalogue (enumerated fields)
Each archetype below is a required entry in `template/DESIGN.md` with a full field table. The schema encodes required fields, optional fields, enums, and numeric bounds. Enums in play across the library:

- `tone`: `hero|accent|ghost|plain`
- `state`: `done|active|next`
- `device`: `phone|browser|desk`
- `chrome`: `light|muted|blue`
- `layout` (projectVisual): `hero|masonry|single`
- `variant` (overviewBullets): `default|quiet`
- bento `span`: 1..12, `rowspan`: 1..4 (clamped)

Existing archetypes (kept): `cover`, `overviewBullets`, `campaignAnalysis`, `projectVisual`, `processDiagram`, `nextSteps`, `closing`, `bentoBoard`. `statusBoard` is deprecated (it defaults to dark); migrate its uses to `bentoBoard` with `state` tones, then remove it.

New archetypes (each is one file in `template/archetypes/` plus two one-line registrations in `render.js`):
- `big-stat` — one hero Chillax numeral (count-up plus optional draw-in ring/sparkbar), one line of context. Numeral carries a `data-id` to morph from an agenda line or into a kpi tile.
- `pull-quote` — oversized editorial quote, stroke-drawn quote marks, word-group fade-up, optional portrait with clip-path wipe.
- `timeline` — spine self-draws end to end, milestone nodes fade up in sequence as the spine passes.
- `comparison` — two columns with a central drawn divider, per-row score bars scaleX-fill, hover dims the other column; optional draggable before/after image slider (`data-fx=compare`) as the viewer-interactive variant.
- `agenda` — numbered section list doubling as a nav map; each line carries a `data-id` so it FLIP-morphs into the matching section-divider headline.
- `section-divider` — full-bleed blue interstitial, receives the morphed agenda line, ring re-draws, giant ghost section number.
- `logo-wall` — partner/charity grid, stagger-settle, hover spotlight (dim the rest).
- `kpi-dashboard` — multi-metric board where each cell orchestrates count-up plus scaleX meter plus draw-in ring, all booting together. The company-tool hero slide.
- `image-full-bleed` — edge-to-edge photo with clip-path wipe entrance and scrimmed caption.
- `map` — Austria/CH/EU SVG outline whose routes/pins draw via stroke-dashoffset.

Interaction archetypes (Engage-native, emit a `data-engage` block the viewer surface renders): `poll`, `wordCloud`, `rating`, `ranking`, `openText`, `quiz`. These give the skill a clean taxonomy for audience interaction, mirroring the Mentimeter question types, so interaction is an archetype INSIDE the deck, never a detour.

### 6.5 Asset intake convention
A new image needs an entry in `PX` (intrinsic width/height) and, if a fixed ratio is wanted, `RATIO` in `_shared.js`, so rendering is CLS-free. All media flows through `assetFrame()` or `deviceFrame()`; a bare `<img>` is banned by construction. New Lucide icons go in the `ICONS` map. `template/DESIGN.md` documents the exact registration steps so the skill knows to populate these tables when it adds imagery. Filenames are ASCII-safe, no spaces or `#`.

### 6.6 Motion is automatic, not authored
The skill never writes animation. Entrance stagger (`.anim` + `--anim-step`), count-ups, self-draws, and morphs are emitted by the archetype renderers from declarative data. Every animated element resolves to its final composed state under print-pdf, peek, and reduced-motion. The skill's job is content and structure; motion is the chrome's job. This keeps output on-brand by construction.

### 6.7 Authoring conventions the skill enforces
- Outline first: the narrative (eyebrow/headline/lead/notes) exists and validates before archetype/layout is chosen. This mirrors the category standard (Beautiful.ai, Gamma) and is exactly the text-first, layout-second contract the skill needs.
- No emoji, no em-dashes, in any string. The validator flags both.
- One red stopper per deck at most; `tone:"accent"` and `E03B50` usage is bounded.
- Human, specific, branded phrasing. No placeholder-bullet business-English.

---

## 7. Phased Build Roadmap

Waves are ordered so we always ship something testable and never block on Samuel's login. Everything through Wave 5 is fully testable on the local BroadcastChannel transport with zero backend. Supabase (Wave 6) is the only wave that needs his login, and by then the entire Engage UI is already built and demoed.

### Wave 0 — Fix the violations and unlock the platform
**Goal:** remove the CSP violation and make the active deck a data flag, so the ground is clean before building up.
**Deliverables:** delete the `esm.sh` import in `collab.js`; vendor `partysocket` into `vendor/partysocket.mjs`; derive the default deck from `manifest` (newest or an `active` flag) instead of hard-coding in `index.html` and `presenter.js`.
**Files:** `template/collab.js`, `vendor/partysocket.mjs` (new), `index.html`, `template/presenter/presenter.js`, `decks/manifest.js`.
**Testable without backend:** yes.

### Wave 1 — The authoring contract (schema + validator + design doc)
**Goal:** make the platform skill-drivable and brand-invariants enforceable.
**Deliverables:** `template/schema/deck.schema.json`; `tools/validate-deck.mjs` returning field-level errors; `template/DESIGN.md` (archetype catalogue with field tables, token set, asset registration steps, brand rules as enforceable rules); constrain `chrome` enum to `light|muted|blue` and reject `dark`; migrate the one deck using `chrome:"dark"` and deprecate `statusBoard`.
**Files:** `template/schema/deck.schema.json` (new), `tools/validate-deck.mjs` (new), `template/DESIGN.md` (new), `decks/2026-07-02-ai-pitchdecks.deck.js` (migrate), `template/render.js` (drop dark from DEFAULT_CHROME).
**Testable without backend:** yes — run the validator against both existing decks; both must pass.

### Wave 2 — Transport abstraction + local adapter + authority
**Goal:** the seam that makes Engage buildable now and flippable later.
**Deliverables:** `template/engage/transport.js` (interface + `makeTransport`); `template/engage/authority.js` (the reducer, ported from `party/deck.ts` validation); `BroadcastChannelTransport` with localStorage hydration; refactor `collab.js` so its `routeMessage()` and `send()` sit on Transport.
**Files:** `template/engage/transport.js` (new), `template/engage/authority.js` (new), `template/collab.js` (refactor).
**Testable without backend:** yes — two tabs, presenter and a stub viewer, exchange `state`/`slide`/`reaction` over BroadcastChannel.

### Wave 3 — Viewer surface + follow-along
**Goal:** the visible payoff — a phone-shaped page that mirrors the live slide.
**Deliverables:** `viewer.html` (standalone, same-origin, locked FOLLOW mode, portrait one-thumb layout); presence bar; late-joiner hydration via `hello` -> `state` snapshot; presenter broadcasts `set-slide` on every slidechanged (already exists) over Transport.
**Files:** `viewer.html` (new), `template/engage/viewer.js` (new), `template/collab.js` (presenter branch to Transport).
**Testable without backend:** yes — open deck in one tab, `viewer.html` in another, advance slides, watch the viewer follow.

### Wave 4 — Core audience interactions
**Goal:** reactions, polls, upvoted Q&A, raise-hand.
**Deliverables:** on-brand SVG reaction bar with float animation; poll bottom-sheet with animated bar results (one vote, locked); Q&A composer plus shared list plus upvote (the one new field over the existing base); raise-hand toggle with presence-driven count; presenter HUD to open/close polls and mark questions answered.
**Files:** `template/engage/viewer.js`, `template/engage/hud.js` (new, presenter-side), `template/engage/authority.js` (poll/question/upvote reducers), `template/engage/engage.css` (new).
**Testable without backend:** yes — full end to end on local transport across two tabs.

### Wave 5 — Join flow + QR + Hub library
**Goal:** frictionless join and a library that feels designed.
**Deliverables:** vendor `vendor/qr.mjs`; Join panel (QR + 6-char code + live viewer count) as a presenter-toggleable overlay and a cover Join moment; Hub grouping (Up next/Recent/Archive) from deck metadata; per-deck share link plus QR; calendar handoff that reads `occasion` and `durationMin` from the deck; IntersectionObserver lazy-boot for thumbnails.
**Files:** `vendor/qr.mjs` (new), `template/engage/join.js` (new), `template/hub/hub.js`, `template/hub/hub.css`, `hub.html`.
**Testable without backend:** yes — QR renders, code shows, local viewer count updates; calendar link carries the right time.

### Wave 6 — Supabase adapter (real phones)
**Goal:** flip Engage to real cross-device audiences. This is the only wave that needs Samuel's login.
**Deliverables:** vendor `vendor/supabase.mjs`; `SupabaseRealtimeTransport` (Broadcast + Presence); RLS policies scoped to room + presenter token; presenter-authority via RLS plus the reducer; `?engage=supabase` flips it on.
**Files:** `vendor/supabase.mjs` (new), `template/engage/transport.js` (add adapter), Supabase project + RLS (Samuel).
**Testable without backend:** no — needs the Supabase project. Everything demoable before this on local; this wave changes one line and real phones join. PartyKit remains available as `?engage=partykit` for the already-written server.

### Wave 7 — Motion range + new archetypes
**Goal:** expressive range for the skill and the wow moments.
**Deliverables:** the new archetypes from 6.4 (each one file + two registrations); per-archetype motion upgrades (self-draw connectors on processDiagram, KPI assembly on kpi-dashboard, agenda-to-section-divider morph); the three-tier transition system.
**Files:** `template/archetypes/*.js` (new files), `template/render.js` (registrations), `template/deck.css` (motion), `template/anim.js` (morph cleanup for new pairs).
**Testable without backend:** yes — render a demo deck using every new archetype and check peek/print/reduced-motion twins.

### Wave 8 — Guardrails
**Goal:** protect the platform now that it is company-critical.
**Deliverables:** validator in CI; Playwright visual-regression at 320/768/1024/1440 for hero, campaignAnalysis, kpi-dashboard, the bookend morph, and the viewer surface; a smoke test that every manifest deck validates and renders.
**Files:** `tools/validate-deck.mjs` (CI entry), `tests/visual/*.spec.ts` (new), `.github/workflows/*` (new).
**Testable without backend:** yes.

Waves 7 and 8 are independent of Engage and can run in parallel with or before Wave 6 whenever Samuel's login is not yet available. Word cloud and shared viewer pointer (Gap 16) slot into Wave 4's structure and ship visibly with Wave 6.

---

## 8. Open Decisions (flag, do not block)

1. **Primary Engage backend: Supabase vs PartyKit.** Recommendation is Supabase (Samuel already runs it, hibernates to ~$0). PartyKit is written and works. Both stay behind Transport, so this is reversible and does not block Waves 0-5. Decide before Wave 6.
2. **Vanity short domain (`fmnts.link`).** Nice polish for the join code but the raw Pages URL works day one. Defer.
3. **Per-viewer analytics and async send-mode.** Real value (turns a sent deck into a lead signal, lets a deck present itself), but needs the backend and new schema. Post-V2; design the schema hooks in `meta` now, build later.
4. **Gamified quiz mode with leaderboard.** Great energy for internal kickoffs, wrong for an investor pitch. Build as an opt-in Engage archetype, clearly separated so game-show energy never leaks into serious decks. Sequence after Wave 6.
5. **statusBoard removal timing.** Deprecate in Wave 1, remove once the one live deck is migrated. Flag so no in-flight deck breaks.
6. **presenter.js extraction (~1137 lines).** A health task, not a feature. Do opportunistically when touching annotation, not as a blocking wave.
7. **Deck status lifecycle semantics.** `draft/ready/live/delivered` proposed; confirm the exact set and who sets `live` (manual flag vs room-active detection) when building the Hub in Wave 5.
