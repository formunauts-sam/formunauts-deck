# Formunauts Present, Deck Authoring Contract (DESIGN.md)

This is the single source of truth for authoring `decks/<id>.deck.js`. A deck is
declarative data. All markup lives in `template/render.js` and the archetype
renderers in `template/archetypes/`. You never write HTML, CSS, or animation.
You write content and structure; the chrome makes it on brand by construction.

Machine-checkable version of this contract: `template/schema/deck.schema.json`.
Run the gate before shipping: `node tools/validate-deck.mjs decks/<id>.deck.js`.

---

## 1. Brand invariants (enforced)

These are rules, not suggestions. The validator checks them.

| Rule | Value | Enforcement |
|------|-------|-------------|
| Primary blue | `#0074C8` | design tokens; do not hardcode elsewhere |
| Red stopper | `#E03B50` | rare; at most one `tone:"accent"` per deck (warning if more) |
| Ink | `#1E2A33` | body text token |
| Blue-50 | `#F3F8FD` | muted surface token |
| Body font | Figtree | chrome-owned |
| Display / numerals | Chillax | chrome-owned |
| No dark mode | chrome enum is `light` \| `muted` \| `blue` only | `chrome:"dark"` is a hard ERROR |
| No emoji | anywhere in any string | flagged as WARNING (the literal arrow `->` rendered as U+2192 is allowed) |
| No em-dash or en-dash | anywhere in any string | flagged as WARNING; use commas, periods, or parentheses |
| Motion | never authored | emitted by renderers from data |

Error vs warning: `chrome:"dark"` and any schema-shape violation fail the deck
(`ok:false`, non-zero exit). Emoji, dashes, and extra red accents are surfaced
with field-level locations but do not fail an otherwise-valid deck, so legacy
decks keep validating while new copy gets cleaned up.

---

## 2. Deck shape

```js
export const deck = {
  meta: { ... },
  slides: [ { ... }, ... ]   // non-empty
};
```

### meta

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `title` | string | yes | Display title (hub, presenter, calendar). |
| `imagesBase` | string | yes | Base path for images, must start with `./`, e.g. `./assets/img/<id>/`. All slide filenames are relative to it. |
| `id` | string | recommended | ASCII `[0-9A-Za-z._-]`. Matches the filename and manifest entry. When absent, render.js derives it from the filename. |
| `date` | string | recommended | Display string, e.g. `"15.07.2026"`. Not parsed. |
| `lang` | `"en"` \| `"de"` | recommended | Deck language. |
| `occasion` | string | no | Drives calendar title and library grouping. |
| `durationMin` | integer >= 1 | no | Talk length; drives calendar end time. |
| `owner` | string | no | Library owner handle. |
| `status` | `draft` \| `ready` \| `live` \| `delivered` | no | Lifecycle (default `draft`). |
| `tags` | string[] | no | Library tags. |
| `room` | string | no | Binds a persistent Engage room code. |
| `cover` | string | no | Cover image override filename. |

### Shared slide chrome

Every slide may carry these. `id` and `archetype` are required.

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `id` | string | yes | Unique in the deck. ASCII `[0-9A-Za-z._-]`. Becomes the section DOM id. |
| `archetype` | enum | yes | One of the archetypes in section 4. |
| `eyebrow` | string | no | Small uppercase kicker above the headline. |
| `headline` | string | no | Slide headline (Chillax). |
| `lead` | string | no | One-line standfirst under the headline. |
| `notes` | string | no | Speaker notes, verbatim, shown in the presenter console (key P). |
| `timing` | number >= 0 | no | Pacing target in seconds. |
| `chrome` | `light` \| `muted` \| `blue` | no | Background treatment. Defaults per archetype (section 3). |
| `backdrop` | `"muted"` | no | Legacy alias for `chrome:"muted"`, honoured only when `chrome` is absent. Prefer `chrome`. |

Special ids: a slide whose `id` is `overview-recap` or `next-steps` gets a faint
rocket watermark automatically.

Outline first: write `eyebrow` / `headline` / `lead` / `notes` before choosing
layout details. The narrative is the deck; the archetype is how it is dressed.

---

## 3. Chrome defaults per archetype

A slide inherits this `chrome` when it does not set one. Only `light` / `muted`
/ `blue` exist. `dark` is retired.

| Archetype | Default chrome |
|-----------|----------------|
| `cover` | `blue` |
| `closing` | `blue` |
| `overviewBullets` | `light` |
| `campaignAnalysis` | `light` |
| `projectVisual` | `light` |
| `processDiagram` | `light` |
| `nextSteps` | `light` |
| `bentoBoard` | `muted` |
| `statusBoard` | `muted` (deprecated) |

`cover` and `closing` are full-bleed: they own their whole section body and do
not receive the shared eyebrow/headline/lead chrome.

---

## 4. Archetype catalogue

Each table below is derived from the actual renderer in
`template/archetypes/`. Fields not listed are not read and are rejected by the
schema (`additionalProperties:false`) so a typo cannot silently render empty.

### cover (`cover.js`), full-bleed

The rocket + self-drawing rings; morphs into `closing` (bookend).

| Field | Type | Required | Renders |
|-------|------|----------|---------|
| `eyebrow` | string | no | Cover eyebrow line. |
| `headline` | string | no | Cover headline. |
| `sub` | string | no | Sub-line under the headline rule. |

### closing (`closing.js`), full-bleed

Blue bookend of the cover; rocket has landed.

| Field | Type | Required | Renders |
|-------|------|----------|---------|
| `statement` | string | no | The closing statement (large). |
| `sub` | string | no | Sub-line under the statement. |
| `site` | string | no | Site line, e.g. `formunauts.com`. |

### overviewBullets (`overviewBullets.js`)

Two variants. `variant:"quiet"` renders two calm columns; otherwise numbered
bullets plus an optional side panel.

| Field | Type | Required | Renders |
|-------|------|----------|---------|
| `variant` | `default` \| `quiet` | no | Chooses the layout. |
| `bullets` | string[] | default only | Numbered bullet lines. |
| `aside` | string[] | default only | "Also shipped" side-panel lines. |
| `columns` | array of `{ title, items[] }` | quiet only | Two calm columns; `items` is string[]. |

### campaignAnalysis (`campaignAnalysis.js`)

The drawn funnel plus a 2x2 metric grid and one next-step callout.

| Field | Type | Required | Renders |
|-------|------|----------|---------|
| `funnel` | array of stage | no | Funnel stages, widest first. |
| `funnel[].label` | string | yes (per stage) | Stage label. |
| `funnel[].value` | string \| number | yes (per stage) | Numeric counts up from 0. |
| `funnel[].note` | string | no | Small note beside the label (e.g. a percentage). |
| `funnel[].tip` | string | no | Hover/click tooltip. |
| `pills` | array of pill | no | The 2x2 metric cards. |
| `pills[].label` | string | yes (per pill) | Card label. |
| `pills[].value` | string \| number | yes (per pill) | Numeric counts up. |
| `pills[].tone` | `"accent"` | no | The one red money metric. |
| `nextStep` | `{ label, detail, when }` | no | Blue-keyline callout; all three optional strings. |

### projectVisual (`projectVisual.js`)

Four sub-layouts via `layout`. Absent falls back to `single`. All media flows
through the frame primitives, never a bare image.

| Field | Type | Required | Renders |
|-------|------|----------|---------|
| `layout` | `hero` \| `masonry` \| `single` | no | Selects the sub-layout. |

hero layout:

| Field | Type | Required | Renders |
|-------|------|----------|---------|
| `hero` | `{ src, tag?, tone? }` | no | Live post in a phone frame; `src` required, `tag` is the badge text. |
| `thumbs` | array of `{ src, tag? }` | no | Planned-post thumbnails. |
| `metrics` | array of `{ value, label, unit?, tone? }` | no | Stat pills; numeric `value` counts up; `tone:"accent"` for red. |
| `band` | `{ src, url? }` | no | Full-width banner strip. |
| `cadence` | string | no | Pulsing cadence chip text. |

single layout:

| Field | Type | Required | Renders |
|-------|------|----------|---------|
| `bullets` | array of string or `{ t, arrow?, tone? }` | no | Pivot list; `arrow:true` shows an arrow mark; `tone:"accent"` for the red lead line. |
| `teaser` | `{ src }` | no | Small teaser image beside the bullets. |
| `showcase` | `{ src }` | no | One centered showcase image (owns the slide). |

masonry layout:

| Field | Type | Required | Renders |
|-------|------|----------|---------|
| `gallery` | array of string or `{ src, feature?, channel?, url?, alt? }` | no | Wall tiles; `feature:true` is the one cover-crop money shot; `channel` is `instagram` or `linkedin`. |
| `more` | `{ value?, label? }` | no | The "+N more" ghost tile. |

### processDiagram (`processDiagram.js`)

Drawn steps joined by blue arrows.

| Field | Type | Required | Renders |
|-------|------|----------|---------|
| `steps` | array of step | no | Ordered steps. |
| `steps[].label` | string | yes (per step) | Step label. |
| `steps[].n` | string \| number | no | Step number (defaults to position). |
| `steps[].sub` | string | no | Sub-label under the step. |
| `steps[].icon` | icon enum | no | Lucide glyph id (see section 6). |
| `footnote` | string | no | Footnote under the process. |

### nextSteps (`nextSteps.js`)

Two horizontal timeline lanes.

| Field | Type | Required | Renders |
|-------|------|----------|---------|
| `columns` | array of lane | no | Timeline lanes. |
| `columns[].title` | string | no | Lane header. |
| `columns[].tone` | `active` \| `muted` | no | `muted` = ongoing/dashed lane; `active` or absent = forward/blue lane. |
| `columns[].items` | array of string or `{ t, icon?, when? }` | no | Lane nodes; `icon` from the icon enum; `when` is a datestamp tag. |

### bentoBoard (`bentoBoard.js`)

A 12-column bento of white cards that fills the content region. Preferred
replacement for the deprecated `statusBoard` (use tile `state` tones).

| Field | Type | Required | Renders |
|-------|------|----------|---------|
| `meter` | `{ done?, total?, label? }` | no | Optional completion meter across the top. |
| `tiles` | array of tile | no | The cards. |
| `tiles[].span` | integer 1..12 | no | Column span (clamped; default 6 for hero, else 4). |
| `tiles[].rowspan` | integer 1..4 | no | Row span (clamped; default 1). |
| `tiles[].tone` | `hero` \| `accent` \| `ghost` \| `plain` | no | Emphasis (default `plain`). |
| `tiles[].state` | `done` \| `active` \| `next` | no | Status dot + pill. |
| `tiles[].stateLabel` | string | no | Override the pill text. |
| `tiles[].eyebrow` | string | no | Small uppercase tile label. |
| `tiles[].title` | string | no | Tile heading. |
| `tiles[].text` | string | no | Supporting body. |
| `tiles[].stat` | `{ value, unit?, label? }` | no | Giant Chillax numeral; numeric `value` counts up. |
| `tiles[].media` | media object | no | ONE framed asset or device (see section 5). |

### statusBoard (`statusBoard.js`), DEPRECATED

Retired because it reads as a dark board. Migrate to `bentoBoard` with tile
`state` tones. Kept only so in-flight decks still validate.

| Field | Type | Required | Renders |
|-------|------|----------|---------|
| `groups` | array of `{ title, items[] }` | no | Status columns. |
| `groups[].items[]` | `{ t, state? }` | no | `state` is `done` \| `active` \| `next`. |

---

## 5. Media (assets and devices)

Media is authored as a `media` object (bentoBoard) or via `src` fields
(projectVisual). It never becomes a bare image; the renderer wraps every image
in an aspect-locked frame. `assetFrame` mats the image (contain, no crop);
`deviceFrame` seats it in hardware or browser chrome (cover-crop, never
squished).

`media` object (bentoBoard tiles):

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `file` | string | yes | Filename only, relative to `meta.imagesBase`. |
| `kind` | `asset` \| `device` | no | `device` routes through deviceFrame; anything else assetFrame. |
| `device` | `phone` \| `browser` \| `desk` | device only | Frame style (default browser). |
| `url` | string | browser/desk | Address-bar label (display only). |
| `crop` | `top` \| `center` \| `bottom` | device only | Cover-crop anchor (default top). |
| `treatment` | `"duotone"` | asset only | Grayscale + blue wash for supporting cast. |
| `ratioClass` | string | asset only | Override the RATIO lookup. |
| `badge` | `{ text, tone? }` | no | Corner badge; `tone` is `success` \| `planned` \| `accent`. |
| `alt` | string | no | Accessible label. |

---

## 6. Asset registration (do this when adding imagery)

Rendering is CLS-free only if intrinsic dimensions are known. Before a new image
can be used, register it in `template/archetypes/_shared.js`:

1. Filename must be ASCII-safe: no spaces, no `#`.
2. Add intrinsic pixel dimensions to `PX` (matted images) as `"file.png": [w, h]`.
   Verify with `sips -g pixelWidth -g pixelHeight <file>`.
3. For screenshots seated in a device frame, add to `DEVICE_PX` instead (same shape).
4. Optional: add a ratio class to `RATIO` if you want a fixed aspect, e.g.
   `"file.png": "ratio-post-portrait"`.
5. A new icon goes in the `ICONS` map (inline SVG path data, 24x24 viewBox).
   Existing ids: `database`, `scan-search`, `sparkles`, `camera`, `globe`,
   `git-branch`. Only these are valid for `icon` fields.

Icons are provisional placeholders per the platform spec and are never used to
substitute the rocket.

---

## 7. Motion is automatic, never authored

You never write animation. Entrance stagger (`.anim` plus `--anim-step`),
count-ups on numerals, self-draws, and the cover/closing ring morph are all
emitted by the renderers from your declarative data. Every animated element
resolves to its final composed state under print-pdf, peek, and reduced-motion,
so the deck is always readable even with motion off. Your job is content and
structure; motion is the chrome's job.

---

## 8. Add a new deck (the 4-step recipe)

1. Copy an existing deck: `cp decks/2026-07-01.deck.js decks/<id>.deck.js`.
   Set `meta.id` to `<id>` (matches the filename) and update `title`, `date`,
   `lang`, and `imagesBase` to `./assets/img/<id>/`.
2. Drop new images into `assets/img/<id>/` and register each in
   `PX` / `DEVICE_PX` / `RATIO` / `ICONS` in `_shared.js` (section 6).
3. Add `<id>` at the TOP of `decks/manifest.js` (newest first). It becomes the
   active deck automatically; nothing else to wire.
4. Validate before shipping: `node tools/validate-deck.mjs decks/<id>.deck.js`.
   Fix every error (exit is non-zero until clean) and clear the warnings
   (emoji, em-dashes, extra red accents) out of new copy.
