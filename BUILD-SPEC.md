# FORMUNAUTS Demo-Deck — Authoritative BUILD SPEC

> **Read this literally.** This is the single source of truth for building a reusable, on-brand reveal.js "Marketing Demo & Look Ahead" deck for FORMUNAUTS. A builder should be able to implement the entire deck from this file **without guessing**. Every color/space/radius/shadow/type value resolves to a CSS token — never write a raw hex or bare px in author CSS except fixed canvas geometry (1280, 720, margins) and the aspect-ratio numbers baked into image frames.
>
> **The design direction:** *Swiss/International typographic grid, run as an editorial magazine, with a Mission-Control accent layer* (rocket + orbital rings). Big quiet fields, one loud number, a visible baseline, generous margins, asymmetry that sharpens hierarchy. **NOT** "clean minimal." NOT centered-hero-with-gradient-blob.
>
> **The two hard failures we are solving at the template level:** (1) too much on-slide text — detail lives in the speaker-notes pane, never on the slide; (2) squished images — every image sits in an aspect-correct frame that adapts to the image, never the reverse.
>
> **This is a TEMPLATE, not a one-off.** Content (what changes every fortnight) is fully separated from Chrome (reveal.js + brand system that never changes). To make the next demo: duplicate one data file, swap strings, drop new PNGs into an images folder. Zero markup/CSS edits.

---

## 0. Canonical facts (pin these)

| Fact | Value |
|---|---|
| Framework | reveal.js (vendored, CDN-free, static folder) |
| Canvas | **1280 × 720** logical (16:9), reveal `margin: 0` |
| Outer safe margin | **80px** L/R, **64px** T/B → live area **1120 × 592** |
| Grid | 12 cols × 72px, 24px gutters; **8px baseline** vertical rhythm |
| Language | **English** (sanctioned exception to German-first brand voice) |
| Number format | **EN**: `$24.00`, `12.5%`, `26.8%`, period decimals. (NOT German `24,00 €`.) Still apply `.font-num` / `tnum` to numeral columns. |
| Slide count | **11 slides** (see §4 — this is the concise plan; the 13-slide design brief maps down to these 11) |
| Fonts | **Figtree** (body/UI/headlines, all weights) + **Chillax** (logo, ONE/APP wordmarks, display accents, numerals ONLY). Never a third family. |
| Primary blue | `#0074C8` (`--fmnts-primary`) — the hero, the default CTA, the lead chart series |
| Stopper red | `#E03B50` (`--fmnts-secondary`) — max ~1 per surface, never a fill, never a CTA. Across the whole deck appears on **≤3 slides**. |
| Dark chrome | `#1E2A33` (`--bg-inverse` / APP shell) |
| Motion | subtle 200–400ms, ease-out-expo `cubic-bezier(0.16,1,0.3,1)`. No spring, no bounce, no parallax. Honor `prefers-reduced-motion`. |
| Icons | **Lucide** (`stroke-width: 2.25`, round caps) as a **flagged placeholder**. Never Lucide-substitute the rocket. **No emoji, ever.** |
| Rocket mark | SVG `formunauts_visual_white.svg` / `_blue.svg` (square 360×360 viewBox) — decorative, low-opacity, cover/closing. |
| Orbital rings | **Draw in CSS/SVG.** Do **NOT** use `key-visual-space.png` as "rings" — it is a 4000×1415 logo lockup, not orbital arcs. |

---

## 1. File Structure (CONTENT / CHROME separation → it's a TEMPLATE)

Target dir: `/Users/samuelzierlinger/Documents/Cowork/Claude Code/formunauts-demo/demo-deck/`

```
demo-deck/
├── index.html                     # CHROME. Boots reveal.js + <script type="module"> that renders slides from the active deck data file. NEVER edited per-demo.
├── .nojekyll                      # so GitHub Pages serves dist/ and plugin/ verbatim (dirs are fine, but keep for underscore-safety)
├── vercel.json                    # optional Vercel static config
├── README.md                      # how to run, present, deploy, and author the next demo
├── BUILD-SPEC.md                  # this file
│
├── dist/                          # VENDORED reveal.js core (copied from node_modules, CDN-free)
│   ├── reveal.css
│   ├── reveal.js
│   ├── reset.css
│   └── theme/                     # (we override almost everything; link a minimal base theme)
│
├── plugin/                        # VENDORED reveal.js plugins
│   ├── notes/notes.js             # Speaker View (press S)
│   ├── highlight/                 # code highlight (optional; harmless to include)
│   ├── markdown/                  # (optional)
│   ├── pointer/plugin.js          # laser pointer (press Q) — from reveal.js-pointer
│   ├── chalkboard/                # draw on slides (C) / chalkboard (B) — from reveal.js-plugins
│   │   ├── plugin.js
│   │   └── style.css
│   └── customcontrols/            # toolbar for chalkboard
│       ├── plugin.js
│       └── style.css
│
├── template/                      # CHROME. The reusable engine + brand system. NEVER edited per-demo.
│   ├── brand.css                  # §2 + §3 — the FULL token set (:root) + @font-face. Verbatim from colors_and_type.css :root, block-variant fonts.
│   ├── deck.css                   # §4/§5/§7 — archetype layouts, persistent chrome, framed-image system, motion classes. References ONLY var(--token).
│   ├── render.js                  # THE ONLY PLACE MARKUP LIVES. Switches on `archetype`, emits <section> HTML, drops notes into <aside class="notes">.
│   ├── anim.js                    # count-up (KPI), reduced-motion gate, ring-drift toggle
│   └── archetypes/               # one render fn per archetype (imported by render.js)
│       ├── cover.js
│       ├── overviewBullets.js
│       ├── campaignAnalysis.js    # the funnel (drawn SVG/CSS, data-driven)
│       ├── projectVisual.js       # layout: hero | masonry | single  (postings, cards, banner)
│       ├── processDiagram.js      # the 3-step Ad QA diagram (drawn, data-driven)
│       ├── nextSteps.js
│       └── closing.js
│
├── decks/                         # CONTENT ONLY. This is the file a non-dev edits/duplicates each demo.
│   └── 2026-07-01.deck.js         # data array — one object per slide, incl. speaker notes. §4 shows the full object.
│
├── fonts/                         # 10 font files (siblings of brand.css so @font-face relative URLs resolve). See §3.
│   ├── Figtree-Regular.ttf  Figtree-Italic.ttf  Figtree-Medium.ttf
│   ├── Figtree-SemiBold.ttf  Figtree-Bold.ttf  Figtree-ExtraBold.ttf
│   └── Chillax-Regular.otf  Chillax-Medium.otf  Chillax-Semibold.otf  Chillax-Bold.otf
│
└── assets/
    ├── logos/                     # ONLY the logos the deck uses (keep it lean)
    │   ├── formunauts_visual_white.svg   formunauts_visual_blue.svg   # rocket mark (cover/closing/chrome)
    │   ├── logo-visual-type-blue.png     logo-visual-type-white.png   # footer chrome lockup (2.73:1)
    │   ├── logo-type-white.png                                        # optional small wordmark
    │   └── logo-claim-wide-white.png                                  # cover claim lockup (2.827:1)
    ├── img/                       # deck posting/card images for the ACTIVE demo, namespaced per date
    │   └── 2026-07-01/
    │       ├── Formunauts Post #1.png … #5.png
    │       ├── Reinhard Ambassador Intro Post #1.png
    │       ├── Reinhard Ambassador Post #2(planned not live).png
    │       ├── Reinhard Ambassador Post (planned not live) #3.png
    │       ├── Reinhard Ambassador Post (planned not live) #4.png
    │       ├── Reinhard_Ambassador_LinkedInBanner.png
    │       └── proof_front+back.png        # copied from ~/Downloads so the deck is self-contained
    └── key-visual/                # (not used for rings; kept only if a hero band ever wants the supplied PNG)
```

### How the separation works (the template contract)
1. **Chrome never knows about a specific deck.** `index.html` imports one deck data file and hands it to `render.js`. `render.js` switches on `archetype` **only**. A new fortnight = new `decks/YYYY-MM-DD.deck.js` + repoint `index.html`'s import. No HTML/CSS edits, ever.
2. **Images are declared by filename + `imagesBase`**, never hardcoded paths in markup. Renderers always wrap media in a sized frame with `object-fit: contain` (or `cover` only for the sanctioned circular photo). **Image distortion is impossible by construction.**
3. **Speaker notes are a `notes` string in the data** → the renderer drops them verbatim into reveal's `<aside class="notes">`. Notes and content stay in sync and travel together.
4. **Brand tokens live in `brand.css`** (copied verbatim from `colors_and_type.css` `:root`, using the `block` font-display variant). Archetype CSS references only tokens → a brand tweak propagates everywhere.
5. **Archetypes are the reusable vocabulary:** `cover · overviewBullets · campaignAnalysis · projectVisual (hero|masonry|single) · processDiagram · nextSteps · closing`. Drawn visuals (funnel, process diagram) are archetype **features driven by data arrays** — next month's different numbers need only new data.

### Vendoring commands (run once inside `demo-deck/`)

```bash
npm init -y
npm install reveal.js reveal.js-plugins reveal.js-pointer

# core
mkdir -p dist plugin
cp -R node_modules/reveal.js/dist/.   dist/
cp -R node_modules/reveal.js/plugin/. plugin/

# drawing + laser plugins (separate packages)
mkdir -p plugin/chalkboard plugin/customcontrols plugin/pointer
cp -R node_modules/reveal.js-plugins/chalkboard/.     plugin/chalkboard/
cp -R node_modules/reveal.js-plugins/customcontrols/. plugin/customcontrols/
cp -R node_modules/reveal.js-pointer/.                plugin/pointer/   # ships plugin.js

# brand assets
mkdir -p fonts assets/logos "assets/img/2026-07-01"
SRC="/Users/samuelzierlinger/.claude/skills/formunauts-design/assets"
cp "$SRC"/fonts/Figtree-Regular.ttf "$SRC"/fonts/Figtree-Italic.ttf "$SRC"/fonts/Figtree-Medium.ttf \
   "$SRC"/fonts/Figtree-SemiBold.ttf "$SRC"/fonts/Figtree-Bold.ttf "$SRC"/fonts/Figtree-ExtraBold.ttf \
   "$SRC"/fonts/Chillax-Regular.otf "$SRC"/fonts/Chillax-Medium.otf "$SRC"/fonts/Chillax-Semibold.otf "$SRC"/fonts/Chillax-Bold.otf \
   fonts/
cp "$SRC"/logos/formunauts_visual_white.svg "$SRC"/logos/formunauts_visual_blue.svg \
   "$SRC"/logos/logo-visual-type-blue.png "$SRC"/logos/logo-visual-type-white.png \
   "$SRC"/logos/logo-type-white.png "$SRC"/logos/logo-claim-wide-white.png \
   assets/logos/

# deck images for this demo
IMG="/Users/samuelzierlinger/Documents/Cowork/Claude Code/formunauts-demo/01.07.2026/images"
cp "$IMG"/*.png "assets/img/2026-07-01/"
cp "/Users/samuelzierlinger/Downloads/Barbara_Visitenkarte_PRINT/proof_front+back.png" "assets/img/2026-07-01/"

touch .nojekyll
```

> **Note on `brand.css`:** copy the `:root` block **verbatim** from `/Users/samuelzierlinger/.claude/skills/formunauts-design/assets/colors_and_type.css`, but use `font-display: block` in the `@font-face` rules (Chrome waits for the font so no fallback flash — matters for screenshots/exports). The portable `/assets/_base.css` already carries the `block` variant + `print-color-adjust: exact`; you may copy its `@font-face` + `:root` blocks directly and add the deck.css archetype layer on top. Do **not** ship the `swap` variant.

---

## 2. Brand CSS Variables — full token set (`:root` in `brand.css`)

Copy verbatim. Exact hex below (source of truth = `colors_and_type.css`).

```css
:root {
  /* ---- Brand blue (the hero) ---- */
  --fmnts-primary:       #0074C8;
  --fmnts-primary-dark:  #054D85;
  --fmnts-primary-mid:   #0074BE;
  --fmnts-primary-75:    #4096D6;
  --fmnts-primary-50:    #80B9E3;
  --fmnts-primary-25:    #BFDCF1;
  --blue-50:  #F3F8FD;
  --blue-100: #E3F0FF;
  --blue-200: #DDEEFB;
  --blue-300: #AFD2F8;
  --blue-500: #0074C8;
  --blue-600: #0074BE;
  --blue-700: #054D85;

  /* ---- Secondary red (STOPPER ONLY, max ~1/surface, never a fill/CTA) ---- */
  --fmnts-secondary:     #E03B50;
  --fmnts-secondary-75:  #E76475;
  --fmnts-secondary-50:  #EF8C97;
  --fmnts-secondary-25:  #F7C5CB;

  /* ---- Neutrals (cool, deep — not pure grey) ---- */
  --neutral-0:    #FFFFFF;
  --neutral-50:   #F8F9FA;
  --neutral-100:  #F2F4F5;
  --neutral-150:  #EDF0F3;
  --neutral-200:  #ECF0F3;
  --neutral-300:  #D5DDE5;
  --neutral-400:  #AFBECD;
  --neutral-500:  #99A9B3;
  --neutral-600:  #6D7B8A;
  --neutral-700:  #3E4C5A;
  --neutral-800:  #212934;
  --neutral-900:  #1E2A33;   /* APP dark-chrome shell */
  --neutral-1000: #000F1A;
  --black-06: rgba(0,15,26,.06);
  --black-10: rgba(0,15,26,.10);

  /* ---- Semantic (status — use the role, never decoratively) ---- */
  --success-100: #EAF3EB;  --success-300: #B7DDC2;  --success-500: #1F8643;  --success-700: #0F5527;
  --warning-100: #FEF9E6;  --warning-300: #FEEAB4;  --warning-500: #E0A82E;  --warning-700: #8A5A00;
  --danger-100:  #FBE8E5;  --danger-300:  #F3B8B8;  --danger-500:  #D41303;  --danger-600:  #E03B50;  --danger-700: #8A0E00;

  /* ---- Accents (gamification only, sparingly) ---- */
  --purple-100: #F1EEF8;  --purple-500: #9747FF;  --purple-600: #765EB7;
  --pink-500:   #DF5DB1;
  --yellow-amber: #FEEAB4;

  /* ---- Semantic role tokens (reach for these FIRST) ---- */
  --bg-base:      var(--neutral-50);   /* #F8F9FA page background behind white cards */
  --bg-surface:   var(--neutral-0);    /* #FFFFFF card/panel */
  --bg-muted:     var(--neutral-100);  /* #F2F4F5 muted surface */
  --bg-inverse:   var(--neutral-900);  /* #1E2A33 dark field */
  --fg-default:   var(--neutral-900);  /* #1E2A33 body on light */
  --fg-muted:     var(--neutral-600);  /* #6D7B8A */
  --fg-subtle:    var(--neutral-400);  /* #AFBECD */
  --fg-inverse:   var(--neutral-0);    /* #FFFFFF text on dark/blue */
  --fg-link:      var(--fmnts-primary);
  --fg-on-primary:var(--neutral-0);
  --border-default: var(--neutral-300);/* #D5DDE5 */
  --border-subtle:  var(--neutral-150);/* #EDF0F3 */
  --border-strong:  var(--neutral-400);/* #AFBECD */
  --border-focus:   var(--fmnts-primary);

  /* ---- Type families (selected by token, never literal font-family) ---- */
  --font-body:    "Figtree", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-display: "Chillax", "Figtree", sans-serif;  /* logo, ONE/APP, display accents, NUMERALS only */
  --font-mono:    ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;

  /* ---- Type scale — Display (Chillax-eligible) ---- */
  --display-2xl: 96px;  --display-2xl-lh: 96px;
  --display-xl:  80px;  --display-xl-lh:  96px;
  --display-lg:  64px;  --display-lg-lh:  78px;
  --display-md:  48px;  --display-md-lh:  56px;
  --display-sm:  36px;  --display-sm-lh:  48px;

  /* ---- Type scale — Headings (Figtree 600) ---- */
  --h1: 40px; --h1-lh: 48px;   /* letter-spacing -0.01em */
  --h2: 32px; --h2-lh: 44px;   /* letter-spacing -0.01em */
  --h3: 24px; --h3-lh: 32px;
  --h4: 20px; --h4-lh: 28px;
  --h5: 18px; --h5-lh: 26px;
  --h6: 16px; --h6-lh: 24px;

  /* ---- Type scale — Body (Figtree 400) ---- */
  --body-lg: 18px; --body-lg-lh: 28px;
  --body-md: 16px; --body-md-lh: 26px;
  --body-sm: 14px; --body-sm-lh: 22px;
  --body-xs: 12px; --body-xs-lh: 18px;

  /* ---- Overline (uppercase, wide-tracked) ---- */
  --overline:    11px; --overline-lh: 15px;   /* letter-spacing 0.30em */
  --overline-sm:  8px; --overline-sm-lh: 10px; /* letter-spacing 0.30em */

  /* ---- Spacing (4-pt grid) ---- */
  --space-1: 4px;   --space-2: 8px;   --space-3: 12px;  --space-4: 16px;
  --space-5: 20px;  --space-6: 24px;  --space-8: 32px;  --space-10: 40px;
  --space-12: 48px; --space-16: 64px; --space-20: 80px; --space-24: 96px;

  /* ---- Radii ---- */
  --radius-xs: 4px;  --radius-sm: 8px;  --radius-md: 12px;
  --radius-lg: 16px; /* DEFAULT card/panel */
  --radius-xl: 20px; --radius-2xl: 24px; --radius-pill: 9999px;

  /* ---- Elevation (soft cool-blue shadows — never pure black; card = border OR shadow, rarely both) ---- */
  --elevation-1: 0 2.33px 5px -1px rgba(213,221,229,1);
  --elevation-2: 0 4px 6px -1px rgba(48,48,48,.10), 0 2px 4px -2px rgba(48,48,48,.10);
  --elevation-3: 0 10px 15px -3px rgba(0,0,0,.10), 0 4px 6px -4px rgba(0,0,0,.10);
  --elevation-4: 0 20px 25px -5px rgba(0,0,0,.10), 0 8px 10px -6px rgba(0,0,0,.10);
  --elevation-5: 0 25px 50px -12px rgba(0,0,0,.25);

  /* ---- Motion ---- */
  --ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
  --duration-fast: 150ms; --duration-normal: 300ms; --duration-slow: 400ms;
}
```

**Helper presets (in `brand.css`):**
```css
.font-display { font-family: var(--font-display); }
.font-num { font-family: var(--font-display); font-feature-settings: "tnum" 1; } /* Chillax tabular numerals */
.overline {
  font-family: var(--font-body); font-weight: 600; text-transform: uppercase;
  font-size: var(--overline); line-height: var(--overline-lh); letter-spacing: 0.30em;
}
h1,h2,h3,h4,h5,h6 { font-family: var(--font-body); font-weight: 600; }
h1 { font-size: var(--h1); line-height: var(--h1-lh); letter-spacing: -0.01em; }
h2 { font-size: var(--h2); line-height: var(--h2-lh); letter-spacing: -0.01em; }
h3 { font-size: var(--h3); line-height: var(--h3-lh); }
body, p, li { font-family: var(--font-body); font-weight: 400; font-size: var(--body-lg); line-height: var(--body-lg-lh); }
```

**Pairing rule:** primary blue pairs with white (`--neutral-0`) or near-black (`--neutral-900`) text ONLY. Never primary-on-primary-tint without a contrast check.

---

## 3. @font-face setup (in `brand.css`)

Fonts are siblings of `brand.css` under `./fonts/` — `@font-face` URLs resolve relative to the CSS file, not the HTML. **Figtree = `.ttf` (truetype), Chillax = `.otf` (opentype).** Use `font-display: block` for a rendered/screenshotted deck.

```css
/* ---------- Figtree (body / UI / headlines — all weights) ---------- */
@font-face { font-family:"Figtree"; font-style:normal; font-weight:400; font-display:block;
  src:url("./fonts/Figtree-Regular.ttf") format("truetype"); }
@font-face { font-family:"Figtree"; font-style:italic; font-weight:400; font-display:block;
  src:url("./fonts/Figtree-Italic.ttf") format("truetype"); }
@font-face { font-family:"Figtree"; font-style:normal; font-weight:500; font-display:block;
  src:url("./fonts/Figtree-Medium.ttf") format("truetype"); }
@font-face { font-family:"Figtree"; font-style:normal; font-weight:600; font-display:block;
  src:url("./fonts/Figtree-SemiBold.ttf") format("truetype"); }
@font-face { font-family:"Figtree"; font-style:normal; font-weight:700; font-display:block;
  src:url("./fonts/Figtree-Bold.ttf") format("truetype"); }
@font-face { font-family:"Figtree"; font-style:normal; font-weight:800; font-display:block;
  src:url("./fonts/Figtree-ExtraBold.ttf") format("truetype"); }

/* ---------- Chillax (logo / ONE-APP wordmarks / display accents / NUMERALS only) ---------- */
@font-face { font-family:"Chillax"; font-style:normal; font-weight:400; font-display:block;
  src:url("./fonts/Chillax-Regular.otf") format("opentype"); }
@font-face { font-family:"Chillax"; font-style:normal; font-weight:500; font-display:block;
  src:url("./fonts/Chillax-Medium.otf") format("opentype"); }
@font-face { font-family:"Chillax"; font-style:normal; font-weight:600; font-display:block;
  src:url("./fonts/Chillax-Semibold.otf") format("opentype"); }
@font-face { font-family:"Chillax"; font-style:normal; font-weight:700; font-display:block;
  src:url("./fonts/Chillax-Bold.otf") format("opentype"); }
```

**Rule (L-006):** Chillax **never** for body text. Figtree carries body/UI/headlines (400/500/600/700/800). Chillax = logo, sub-brand wordmarks (ONE/APP), display accents, numerals only.

---

## 4. Slide-by-slide implementation

### The persistent chrome (every non-cover/non-closing slide) — build once as a shared layout so "the line" holds

- **Reference canvas:** 1280×720. Author in fixed px; reveal transform-scales it crisp to any display.
- **Kicker rail:** top-left at `x=80, y=64`. An `.overline` (11px, .30em tracking, uppercase). `--fg-muted` on light fields / `--fg-inverse` at 70% opacity on dark/blue.
- **Anchor y-stack (hold across ALL content slides):** kicker baseline `y=64` → headline block `~y=140–210` → content/focal block starts `y=248`, runs to `y≤592` → footer chrome `y=636`.
- **Left edge:** everything starts at `x=80` (the single consistent left edge = "the line").
- **Footer bottom-left:** `logo-visual-type-blue.png` (light) / `-white.png` (dark/blue) at **height 20px, width auto** (respects 2.73:1). `x=80, y=636`.
- **Footer bottom-right:** slide index `03 / 11` in `.font-num` (Chillax tabular), 14px, `--fg-subtle`, right-aligned at `x=1200`.
- **Optional 1px hairline** (`--border-subtle`) under the kicker on content slides — recommended, anchors the top baseline.
- **Standard editorial split:** text column = cols 1–5 (≈432px), focal column = cols 7–12 (≈576px), col 6 is the breathing gutter. Body measure caps at ~52 chars naturally.

### Global on-slide text budget (fixes "too much text")
- **One headline, one idea per slide.** Max body copy = **2 short sentences OR ≤5 bullet lines, each ≤8 words.**
- If the speaker notes have more, it lives in the **notes pane**, not the slide.
- Numbers are the hero: when a slide has data, the **Chillax KPI is the largest thing on the slide** and prose shrinks to captions.
- Density is a hard gate: if a slide feels full, **move copy to notes — never shrink type below floors** (body ≥18px, titles use `--h1`/`--h2`, never <28px).

---

### Slide 01 — Cover
- **id:** `cover` · **archetype:** `cover` · **chrome:** **Full blue** field. Gradient `--fmnts-primary-dark → --fmnts-primary` (top-left → bottom-right).
- **On-slide content:**
  - Small claim lockup `logo-claim-wide-white.png` at top-left (height ~44px, width auto).
  - Eyebrow (overline, tracked, white 70%): `MARKETING · UPDATE`
  - Headline (Figtree ExtraBold 800, `--display-xl` 80/96, white): **The last 3 weeks — and what's next**
  - One thin white rule (1px, `--fg-inverse` at ~30%) under the headline.
  - Sub (`.font-num`, `--body-lg`, white 80%): `01.07.2026 · Marketing`
- **Images / decoration (undistorted):**
  - Rocket mark `formunauts_visual_white.svg` — large, low-opacity (~8–12%), bleeding off the **top-right** corner. `height:<px>; width:auto` (1:1, so either dim is safe). Never `cover` on a logo.
  - **1–2 orbital-ring arcs drawn in CSS/SVG** sweeping from the **bottom-right** corner (thin strokes, `--fmnts-primary-25` / white at low opacity). NOT `key-visual-space.png`.
  - Optional bottom-left small wordmark `logo-type-white.png`, `height:28px; width:auto`.
- **Animation:** kicker fades (0ms) → headline fade + 4px-up (80ms) → rule draws (160ms) → sub (240ms). Ring drift: very slow 20s ≤2° rotation loop (transform only), disabled under reduced-motion.
- **Speaker notes:**
  > Hey altogether! Quick marketing update — what we did the last weeks, what's ongoing, and what's coming up. I'll keep it tight, mostly show you the work, and we can dig into anything you want at the end. Let's go.

---

### Slide 02 — The last 3 weeks at a glance
- **id:** `overview-recap` · **archetype:** `overviewBullets` · **chrome:** **Light** (`--bg-base`). (Dense info reads best on light.)
- **On-slide content:** Kicker `MARKETING · RECAP`. Headline (`--h1`) **Last 3 weeks — at a glance**.
  - **Left column** — 5 talk-anchor bullets, each with a small blue index numeral (`.font-num`, `--fmnts-primary`):
    1. Switzerland charity outreach — full funnel analysed, reviewing with Max today
    2. Ambassador postings live — Reinhard on LinkedIn
    3. Italy F2F founder campaign — learnings pulled
    4. Company & social content — series kept running
    5. Ad Quality Assurance — new review routine
  - **Right column** — a compact muted "also shipped" list (`--body-sm`, `--fg-muted`), so it doesn't crowd the headline: `UK inhouse page started · APP NPS newsletter sent · Q2→Q3 OKRs · SSOT + Klausur kicked off · asset cleanup`.
- **Images:** none. Faint rocket-mark watermark bottom-right at ~6% opacity for texture (`formunauts_visual_blue.svg`, `height:<px>; width:auto`).
- **Animation:** bullets stagger in fade + 4px-up, 80ms step. Right list fades last as a group.
- **Speaker notes:**
  > So the last weeks were pretty packed. The big one is the Switzerland charity outreach — full analysis done, and I'm sitting down with Max on next steps today. On top of that: Reinhard's ambassador postings are live, we pulled the Italy learnings, kept the company content going, and I set up a new ad quality-assurance routine. And a bunch of internal things on the right — UK page, the APP NPS newsletter, the whole Q2-to-Q3 OKR round, and we kicked off SSOT and the Klausur. I'll show you the highlights on the next few slides. And much more behind the scenes.

---

### Slide 03 — Switzerland charity outreach (funnel)
- **id:** `switzerland-funnel` · **archetype:** `campaignAnalysis` · **chrome:** **Light** (data clarity).
- **On-slide content:** Kicker `SWITZERLAND · CHARITY OUTREACH`. Headline (`--h1`) **The funnel**. One-line takeaway (`--body-lg`): *"428 charities in, 53 real replies out — reviewing next steps with Max today."*
- **The hero visual = a drawn SVG/CSS funnel** (part of the design system, NOT a screenshot). Focal column (right ~60% width): 4 descending stages, each a step down the blue ramp (`--fmnts-primary → --fmnts-primary-75 → -50 → -25`), Chillax tabular numerals right-aligned so they form a clean vertical:
  - `428` Targeted → `365` Invited → `98` Accepted (**26.8%**) → `53` Replied
  - Below the funnel: three stat pills — `~25 real conversations · 7 hot · 8 warm · 10 referrals`. **The "7 hot" pill is the single red stopper** (`--fmnts-secondary`).
- **Data shape (from `deck.js`):** `funnel: [{label,value,note?}]`, `pills: [{label,value,tone?:"accent"}]`.
- **Images:** none photographic.
- **Animation (the "living funnel"):** bars wipe in left-to-right / top-to-bottom on 80ms stagger; Chillax numbers **count up from 0 to value over 900ms ease-out** (tabular = no layout shift); only the terminal **"7 hot"** node lights red last. Reduced-motion → jump to final.
- **Speaker notes:**
  > Ok so the Switzerland charity outreach — the full funnel. We targeted 428 charities, invited 365, 98 accepted — about 27 percent — and 53 replied. Out of that around 25 real conversations, 7 of them properly hot, plus some warm ones and referrals. Sitting down with Max this afternoon for next steps. imho a really solid base to build the follow-up on. Any questions on this?

---

### Slide 04 — Ambassador postings: Reinhard is live
- **id:** `ambassador-reinhard` · **archetype:** `projectVisual` (layout `hero`) · **chrome:** **Light** (image showcase).
- **On-slide content:** Kicker `AMBASSADOR · LINKEDIN`. Headline (`--h1`) **Reinhard is live**. Lead (`--body-lg`): *"Intro post out, profile optimised, new post every Tuesday 09:30."* Rest is visuals.
- **Images (all `object-fit: contain`, aspect-locked — see §7):**
  - **Hero (left):** `Reinhard Ambassador Intro Post #1.png` (914×1658, ratio **0.551**, tall) → tall contained card / phone-portrait frame, `aspect-ratio: 914/1658`. Pin a green `LIVE` tag (`--success-500` on `--success-100`) to the card corner.
  - **Right stack/row:** the three PLANNED posts `#2/#3/#4` (890×1112, ratio **0.80**) as smaller contained cards (`aspect-ratio: 890/1112`), each with a muted `PLANNED` badge (`--warning-500` on `--warning-300`). Do NOT shrink these to match the taller intro.
  - **Bottom band (full width, own row):** `Reinhard_Ambassador_LinkedInBanner.png` (3168×792, ratio **4.0**) as a thin full-bleed-width contained strip, `aspect-ratio: 4/1`. **Never** put a 4:1 banner in a portrait slot — contain, don't crop.
- **Data shape:** `hero:{src,tag,tone}`, `thumbs:[{src,tag}]`, `band:{src}`.
- **Animation:** headline → hero card grows in (auto-animate-friendly) → thumbs stagger → banner strip fades in last.
- **Speaker notes:**
  > Ok nice — the ambassador postings are live. Reinhard's intro post is out, that's the big one on the left, and the engagement is really good so far. We optimised his whole LinkedIn profile for the ambassador content — you can see the banner along the bottom. And from now there's a new post every Tuesday at half nine; on the right are the next ones already prepared. Any questions on this?

---

### Slide 05 — Italy F2F founder campaign (the honest learning)
- **id:** `italy-learnings` · **archetype:** `projectVisual` (layout `single`) · **chrome:** **Light, muted** (`--bg-muted`) — reflective tone.
- **On-slide content:** Kicker `ITALY · F2F FOUNDER CAMPAIGN`. Headline (`--h1`) **What we learned**. Frame as honest, not a failure. Left = a "pivot" list (≤5 tight bullets — first is the learning, arrows are actions):
  - LinkedIn wasn't the right environment for founder recruiting
  - → Barbara business cards produced
  - → Indeed Smart CV set up
  - → Facebook group postings
  - → Collab check: Melandri & Zanella
  - (The single red stopper may mark the honest "not the right environment" line — this is one of the ≤3 red slides.)
- **Images:** Right = one small contained teaser thumbnail of the Barbara card (`proof_front+back.png`, 2198×745, ratio **2.951**) in a `aspect-ratio: 2198/745` frame, handing off to slide 06.
- **Animation:** bullets stagger; teaser thumb fades in.
- **Speaker notes:**
  > The Italy F2F founder campaign — honestly not a big success, and I want to be straight about that. LinkedIn just wasn't the right environment for this kind of founder recruiting. But we didn't waste the time: we set up Barbara's business cards, the Indeed Smart CV, some Facebook group postings, and we're now checking collabs with Melandri and Zanella to reach the right people directly. Let's see what we can do with that.

---

### Slide 06 — Barbara's business cards
- **id:** `barbara-cards` · **archetype:** `projectVisual` (layout `single`) · **chrome:** **Light** — soft `--neutral-100` studio backdrop.
- **On-slide content:** Kicker `ITALY · PRINT`. Headline (`--h1`) **Barbara's business cards**. Lead: *"Front + back, print-ready."* Pure design showcase.
- **Images:** `proof_front+back.png` (2198×745, ratio **2.951**, already front+back side-by-side) → large **centered contained** frame, `aspect-ratio: 2198/745`, `object-fit: contain`, on a `--bg-muted` field with `--elevation-3`, generous margin so it reads as a physical object. **Do NOT stretch to fill 16:9** — contain and center, let the backdrop breathe. (Editorial "laid on a surface" — optional slight rotation for the wow detail; if split into two faces, one at `-3°`, one at `+2°`, offset, each with `--elevation-2`.)
- **Animation:** card fades + subtle `scale(1.02)` settle on enter.
- **Speaker notes:**
  > And of course — here are Barbara's business cards for Italy, front and back. Turned out really clean, I'm happy with these. Print-ready and off to her.

---

### Slide 07 — Ad Quality Assurance (new routine)
- **id:** `ad-qa` · **archetype:** `processDiagram` · **chrome:** **Light** (data/tool).
- **On-slide content:** Kicker `PERFORMANCE · NEW ROUTINE`. Headline (`--h1`) **Ad Quality Assurance**. Lead: *"One analysis over all running ads — big picture plus optimisation tips."* The visual = a drawn **3-step process diagram** (design-system cards, in code):
  - `1 · Pull all running ads` → `2 · One holistic analysis` → `3 · Optimisation tips`
  - Footer note (`--body-sm`, `--fg-muted`): *"first step toward automating ad reviews."*
- **Layout:** three connected cards left-to-right; **arrows use the blue accent** (`--fmnts-primary`); each card white surface, `--radius-lg`, `--elevation-2`, 24px pad, a Lucide icon (`stroke-width:2.25`, flagged placeholder) + 3-word label. Clean/diagrammatic — reads as process, not data.
- **Data shape:** `steps: [{n,label,icon}]`, `footnote`.
- **Animation:** cards reveal 1→2→3 with arrows drawing between them, 100ms stagger.
- **Speaker notes:**
  > One new thing I'm quite happy about — ad quality assurance. Instead of manually sweeping through every dashboard ad by ad, I now pull everything into one analysis: insights over all the running ads plus concrete optimisation tips. It helps me manage performance more holistically and catch things I'd otherwise miss — and imho it's the first real step toward automating our ad reviews. Any questions on this?

---

### Slide 08 — Company & social content
- **id:** `company-content` · **archetype:** `projectVisual` (layout `masonry`) · **chrome:** **Light** (gallery).
- **On-slide content:** Kicker `CONTENT · SOCIAL`. Headline (`--h1`) **Keeping the channel alive**. Lead: *"Company posts, the donor-feedback series, the congress tour."* Visuals carry it.
- **Images (contained masonry/bento — NOT a uniform square grid; the uniform grid is what squished them before):** five Formunauts posts, mixed ratios:
  - `Formunauts Post #1.png` 914×1184 (**0.772**, portrait)
  - `Formunauts Post #2.png` 914×890 (**1.027**, ~square — the only landscape-ish; spans wider)
  - `Formunauts Post #3.png` 914×1192 (**0.767**, portrait)
  - `Formunauts Post #4.png` 914×1152 (**0.793**, portrait)
  - `Formunauts Post #5.png` 914×976 (**0.937**, ~square)
  - Use a **masonry column layout**: each tile is a contained card sized to its own `aspect-ratio`; `#2` spans wider, portraits sit in columns. Each: `--elevation-2`, `--radius-lg`. Editorial, not a flush 5-up strip. Offset alternating tiles ~24px for the staggered feel.
- **Data shape:** `gallery: ["Formunauts Post #1.png", ...]` (renderer reads each file's ratio from a lookup, see §5).
- **Animation:** tiles fade + 4px-up in a gentle stagger; hover `scale(1.02)` on inner image (frame fixed, `overflow:hidden`).
- **Speaker notes:**
  > Here are some more of our postings — company content, the donor-feedback series continuing, the congress tour, and a few more initiatives. Nothing revolutionary on its own, but this is the consistent drumbeat that keeps the channel alive and the brand present. And much more where that came from.

---

### Slide 09 — Strategy & internal (compact bullets)
- **id:** `strategy-internal` · **archetype:** `overviewBullets` (variant `quiet`) · **chrome:** **Dark** (`--bg-inverse` #1E2A33) — "behind the scenes," literal + rhythmic contrast.
- **On-slide content:** Kicker `INTERNAL · CONTEXT` (white 70%). Headline (`--h1`, white) **Behind the scenes**. Two tight columns, ≤5 bullets each, muted styling (smaller type, `--fg-subtle`/white-muted, no imagery) — signals "context, not showcase":
  - **Strategy & web:** Q2→Q3 OKRs done · UK inhouse page started · Key Value page in progress → website focus this sprint · job-posting target groups set
  - **Data & ops:** SSOT first steps with Elias (customer-first) · Klausur kickoff done · APP NPS newsletter sent · asset cleanup underway
- **Images:** none. (On dark: any accents survive in `--fmnts-primary`; text white.)
- **Animation:** columns fade in; deliberately calmer than the project pages.
- **Speaker notes:**
  > Then the internal stuff, quickly. On strategy and web: I closed out the Q2 OKRs and built the Q3 ones, started the UK inhouse page, and the Key Value page is in progress — so that's the website focus this sprint. I also set the target groups for our job postings. On data and ops: first steps on the SSOT tool with Elias — really thinking about what we need first, customer-focused — the Klausur kickoff is done, the APP NPS newsletter went out, and asset cleanup is underway. I won't go deep here, but shout if you want detail on any of it.

---

### Slide 10 — Next weeks & ongoing
- **id:** `next-steps` · **archetype:** `nextSteps` · **chrome:** **Light** (planning clarity). (Mirrors slide 02's visual language so the deck bookends recap → next.)
- **On-slide content:** Kicker `LOOK AHEAD · NEXT WEEKS`. Headline (`--h1`) **Next weeks & ongoing**. Two columns, ≤5 bullets each:
  - **Web · campaigns · content** (near-term / active tint, `--fmnts-primary` index): UK webpage live · Key Value page online · adapt CH + Italy learnings · ambassador content + boost postings · CH email campaign (non-LinkedIn leads) + final outreach strategy
  - **Data · ops (ongoing, Q3)** (muted tint, `--fg-muted`): SSOT concept — map where data lives (whole Q3) · asset cleanup · new camera in WEBB (~2 wks) · ONE NPS newsletter · pitchdeck knowledge transfer with CC · more automation — ad reviews & A/B tests
- **Images:** none. Faint rocket-mark watermark for continuity.
- **Data shape:** `columns: [{title,tone,items:[]}, {title,tone,items:[]}]`.
- **Animation:** columns stagger; left (active) leads, right (ongoing) follows.
- **Speaker notes:**
  > Ok — what's next. On web, campaigns and content: the new UK webpage, the Key Value page online, adapting the Switzerland and Italy learnings, the next ambassador content plus boosting the postings, and a Switzerland email campaign for all the leads that didn't connect on LinkedIn — with a final strategy for new outreach. On data and ops: the single-source-of-truth concept — mapping which data sits where, that's a whole-Q3 thing, not one sprint — more asset cleanup, the new camera arriving in WEBB, the ONE NPS newsletter, a pitchdeck knowledge transfer with CC, and more automation like ad reviews and A/B testing. Let's see what we can do.

---

### Slide 11 — Closing
- **id:** `closing` · **archetype:** `closing` · **chrome:** **Full blue** (bookends the cover).
- **On-slide content:** Big Chillax-accent statement (`--display-md` 48/56 or `--display-lg`, white): **From many channels to one data-driven engine.** Small sub (`--body-lg`, white 80%): `Thank you`. Bottom-right: `formunauts.com` (`.font-num` / `--body-sm`, white 70%).
- **Images:** rocket mark `formunauts_visual_white.svg` + orbital-ring arcs echo the cover, but sweeping the **opposite (top-left) corner** — read back-to-back with the cover they form one continuous arc enclosing the deck. Optional `logo-type-white.png`, `height:<px>; width:auto`.
- **Animation:** statement fades + 4px-up; ring completes the bookend arc. Ring drift 20s loop (reduced-motion off).
- **Speaker notes:**
  > The direction behind all of this: slowly getting to integrated, multi-platform marketing on clean data processes — so we can scale marketing data-driven. That's the bigger picture. Ok then — thank you! Any last questions?

---

### Archetype → slide map (the reusable vocabulary)
| Archetype | Slides | Drawn/data feature |
|---|---|---|
| `cover` | 01 | rocket + CSS rings |
| `overviewBullets` | 02, 09 (`quiet`) | index numerals; 2-col |
| `campaignAnalysis` | 03 | **funnel** from `funnel[]`+`pills[]`, count-up, 1 red stopper |
| `projectVisual` (`hero`/`masonry`/`single`) | 04, 05, 06, 08 | framed images by aspect ratio |
| `processDiagram` | 07 | **3-step** from `steps[]` |
| `nextSteps` | 10 | 2-col active/ongoing tint |
| `closing` | 11 | rocket + CSS rings (bookend) |

### The active content data file (the ONLY thing a non-dev touches) — `decks/2026-07-01.deck.js`
```js
export const deck = {
  meta: { title: "Marketing Update", date: "01.07.2026", lang: "en",
          imagesBase: "./assets/img/2026-07-01/" },
  slides: [
    { id:"cover", archetype:"cover",
      eyebrow:"MARKETING · UPDATE",
      headline:"The last 3 weeks — and what's next",
      sub:"01.07.2026 · Marketing",
      notes:"Hey altogether! Quick marketing update ..." },

    { id:"overview-recap", archetype:"overviewBullets",
      eyebrow:"MARKETING · RECAP", headline:"Last 3 weeks — at a glance",
      bullets:[
        "Switzerland charity outreach — full funnel analysed, reviewing with Max today",
        "Ambassador postings live — Reinhard on LinkedIn",
        "Italy F2F founder campaign — learnings pulled",
        "Company & social content — series kept running",
        "Ad Quality Assurance — new review routine" ],
      aside:["UK inhouse page started","APP NPS newsletter sent","Q2→Q3 OKRs",
             "SSOT + Klausur kicked off","asset cleanup"],
      notes:"So the last weeks were pretty packed ..." },

    { id:"switzerland-funnel", archetype:"campaignAnalysis",
      eyebrow:"SWITZERLAND · CHARITY OUTREACH", headline:"The funnel",
      lead:"428 charities in, 53 real replies out — reviewing next steps with Max today.",
      funnel:[ {label:"Targeted",value:428},{label:"Invited",value:365},
               {label:"Accepted",value:98,note:"26.8%"},{label:"Replied",value:53} ],
      pills:[ {label:"real conversations",value:"~25"},{label:"hot",value:7,tone:"accent"},
              {label:"warm",value:8},{label:"referrals",value:10} ],
      notes:"Ok so the Switzerland charity outreach ..." },

    { id:"ambassador-reinhard", archetype:"projectVisual", layout:"hero",
      eyebrow:"AMBASSADOR · LINKEDIN", headline:"Reinhard is live",
      lead:"Intro post out, profile optimised, new post every Tuesday 09:30.",
      hero:{ src:"Reinhard Ambassador Intro Post #1.png", tag:"LIVE", tone:"success" },
      thumbs:[ {src:"Reinhard Ambassador Post #2(planned not live).png", tag:"PLANNED"},
               {src:"Reinhard Ambassador Post (planned not live) #3.png", tag:"PLANNED"},
               {src:"Reinhard Ambassador Post (planned not live) #4.png", tag:"PLANNED"} ],
      band:{ src:"Reinhard_Ambassador_LinkedInBanner.png" },
      notes:"Ok nice — the ambassador postings are live ..." },

    { id:"italy-learnings", archetype:"projectVisual", layout:"single",
      eyebrow:"ITALY · F2F FOUNDER CAMPAIGN", headline:"What we learned",
      bullets:[
        {t:"LinkedIn wasn't the right environment for founder recruiting", tone:"accent"},
        {t:"Barbara business cards produced", arrow:true},
        {t:"Indeed Smart CV set up", arrow:true},
        {t:"Facebook group postings", arrow:true},
        {t:"Collab check: Melandri & Zanella", arrow:true} ],
      teaser:{ src:"proof_front+back.png" },
      notes:"The Italy F2F founder campaign — honestly not a big success ..." },

    { id:"barbara-cards", archetype:"projectVisual", layout:"single", backdrop:"muted",
      eyebrow:"ITALY · PRINT", headline:"Barbara's business cards",
      lead:"Front + back, print-ready.",
      showcase:{ src:"proof_front+back.png" },
      notes:"And of course — here are Barbara's business cards ..." },

    { id:"ad-qa", archetype:"processDiagram",
      eyebrow:"PERFORMANCE · NEW ROUTINE", headline:"Ad Quality Assurance",
      lead:"One analysis over all running ads — big picture plus optimisation tips.",
      steps:[ {n:1,label:"Pull all running ads",icon:"database"},
              {n:2,label:"One holistic analysis",icon:"scan-search"},
              {n:3,label:"Optimisation tips",icon:"sparkles"} ],
      footnote:"first step toward automating ad reviews.",
      notes:"One new thing I'm quite happy about — ad quality assurance ..." },

    { id:"company-content", archetype:"projectVisual", layout:"masonry",
      eyebrow:"CONTENT · SOCIAL", headline:"Keeping the channel alive",
      lead:"Company posts, the donor-feedback series, the congress tour.",
      gallery:[ "Formunauts Post #1.png","Formunauts Post #2.png","Formunauts Post #3.png",
                "Formunauts Post #4.png","Formunauts Post #5.png" ],
      notes:"Here are some more of our postings ..." },

    { id:"strategy-internal", archetype:"overviewBullets", variant:"quiet", chrome:"dark",
      eyebrow:"INTERNAL · CONTEXT", headline:"Behind the scenes",
      columns:[
        { title:"Strategy & web", items:["Q2→Q3 OKRs done","UK inhouse page started",
          "Key Value page in progress → website focus this sprint","job-posting target groups set"] },
        { title:"Data & ops", items:["SSOT first steps with Elias (customer-first)",
          "Klausur kickoff done","APP NPS newsletter sent","asset cleanup underway"] } ],
      notes:"Then the internal stuff, quickly ..." },

    { id:"next-steps", archetype:"nextSteps",
      eyebrow:"LOOK AHEAD · NEXT WEEKS", headline:"Next weeks & ongoing",
      columns:[
        { title:"Web · campaigns · content", tone:"active",
          items:["UK webpage live","Key Value page online","adapt CH + Italy learnings",
                 "ambassador content + boost postings",
                 "CH email campaign (non-LinkedIn leads) + final outreach strategy"] },
        { title:"Data · ops (ongoing, Q3)", tone:"muted",
          items:["SSOT concept — map where data lives (whole Q3)","asset cleanup",
                 "new camera in WEBB (~2 wks)","ONE NPS newsletter",
                 "pitchdeck knowledge transfer with CC","more automation — ad reviews & A/B tests"] } ],
      notes:"Ok — what's next ..." },

    { id:"closing", archetype:"closing",
      statement:"From many channels to one data-driven engine.",
      sub:"Thank you", site:"formunauts.com",
      notes:"The direction behind all of this ..." }
  ]
};
```

---

## 5. Global image / logo rules that GUARANTEE no squishing (in `deck.css`)

**Root cause of prior squishing:** source images have wildly different aspect ratios and were dropped into uniform slots. Fix at the template level: **every image lives in an aspect-correct frame; the frame adapts to the image, not the reverse.** `render.js` always wraps media in `.asset-frame`. There is **no code path** that emits a bare `<img>` with both width and height set in CSS.

```css
/* 1. Baseline: no raster ever exceeds its box; ratio always preserved. */
img, svg { max-width: 100%; height: auto; display: block; }

/* 2. Fixed-ratio frame. Set the frame aspect-ratio to the ASSET's real ratio so 'contain' never letterboxes. */
.asset-frame {
  position: relative; width: 100%; overflow: hidden;
  border-radius: var(--radius-lg);
  background: var(--neutral-100);          /* any transparent pad / letterbox reads as an intentional mat */
  box-shadow: var(--elevation-2);          /* frame shadow — do NOT also put a border on the same box */
}
.asset-frame--floating { box-shadow: var(--elevation-3); } /* when floating on blue/dark */
.asset-frame > img {
  width: 100%; height: 100%;
  object-fit: contain; object-position: center;            /* show the whole asset, never distort */
}
/* inner hairline = a divider, not a second shadow */
.asset-frame > img { border: 1px solid var(--border-subtle); border-radius: var(--radius-md); }

/* Crop variant — ONLY for the sanctioned decorative circular marketing photo / a hero band */
.asset-frame--cover > img { object-fit: cover; }

/* 3. Per-ratio frames (aspect-ratio = intrinsic W/H of the asset). render.js picks the class by filename. */
.ratio-post-portrait { aspect-ratio: 914 / 1184; }  /* Formunauts #1/#3/#4 ≈ 0.77 */
.ratio-post-square   { aspect-ratio: 914 / 890;  }  /* Formunauts #2 ≈ 1.03 */
.ratio-post-near     { aspect-ratio: 914 / 976;  }  /* Formunauts #5 ≈ 0.94 */
.ratio-amb-portrait  { aspect-ratio: 890 / 1112; }  /* Reinhard #2/#3/#4 = 0.80 */
.ratio-amb-intro     { aspect-ratio: 914 / 1658; }  /* Reinhard intro, tall 0.55 */
.ratio-li-banner     { aspect-ratio: 4 / 1;      }  /* LinkedIn banner 3168×792 */
.ratio-card-proof    { aspect-ratio: 2198 / 745; }  /* business-card proof front+back 2.95 */
.ratio-keyvisual     { aspect-ratio: 4000 / 1415;}  /* key-visual / wide claim (if ever used) */
.ratio-marketing     { aspect-ratio: 660 / 1173; }  /* marketing-photo.jpg (circular/cover only) */

/* 4. Logos: lock HEIGHT, width auto. NEVER set logo width+height together. Never object-fit:cover a logo. */
.logo           { height: 32px; width: auto; }   /* square mark / SVG (1:1) */
.logo--wordmark { height: 24px; width: auto; }   /* logo-type-* (10:1) */
.logo--lockup   { height: 40px; width: auto; }   /* logo-visual-type-* (2.73:1) — footer chrome */
.logo--claim    { height: 44px; width: auto; }   /* logo-claim-wide-* (2.83:1) — cover */
.logo--product  { height: 40px; width: auto; }   /* logo-*-white-tight (ONE/APP, dark bg only) */
```

**Renderer usage (always emits real `width`/`height` HTML attributes to reserve space / kill CLS; the CSS `height:auto` keeps ratio locked):**
```html
<figure class="asset-frame ratio-post-portrait">
  <img src="./assets/img/2026-07-01/Formunauts Post #1.png" width="914" height="1184" alt="Formunauts post">
  <figcaption class="caption">…optional 14px --body-sm --fg-muted…</figcaption>
</figure>
```

**Filename → ratio lookup in `render.js`** (so `gallery:[...]` needs only filenames):
```js
const RATIO = {
  "Formunauts Post #1.png":"ratio-post-portrait","Formunauts Post #2.png":"ratio-post-square",
  "Formunauts Post #3.png":"ratio-post-portrait","Formunauts Post #4.png":"ratio-post-portrait",
  "Formunauts Post #5.png":"ratio-post-near",
  "Reinhard Ambassador Intro Post #1.png":"ratio-amb-intro",
  "Reinhard Ambassador Post #2(planned not live).png":"ratio-amb-portrait",
  "Reinhard Ambassador Post (planned not live) #3.png":"ratio-amb-portrait",
  "Reinhard Ambassador Post (planned not live) #4.png":"ratio-amb-portrait",
  "Reinhard_Ambassador_LinkedInBanner.png":"ratio-li-banner",
  "proof_front+back.png":"ratio-card-proof",
  "Visitenkarte_Barbara.png":"ratio-card-proof" // 662×754 → if used alone, override to aspect-ratio 662/754
};
const PX = { /* width,height per file for the <img> attributes */ };
```

**Logo background rule (cheat sheet):** light bg → `*-blue` (or `*-duotone`); dark/blue bg → `*-white`. Product logos (`logo-app-*`, `logo-one-*`) are **white-only** → require a dark/blue backing panel, never on white. Square mark in chrome → prefer the SVG (crisp, truly 1:1). The rocket is a supplied asset only — **never Lucide-substitute or redraw it.**

**Absolute don'ts:** no free-stretched `<img>` without aspect lock; no `width:100%;height:100%` without `object-fit`; no forcing a portrait post into a landscape box; no blue tint over photography; no border **and** shadow on the same frame; `object-fit: cover` only on the circular `marketing-photo.jpg` (not used in this deck) and hero bands.

---

## 6. Presenter view + fullscreen + animation config (`index.html`)

### `index.html` head/body skeleton (CDN-free)
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>FORMUNAUTS — Marketing Update</title>
  <link rel="stylesheet" href="dist/reset.css" />
  <link rel="stylesheet" href="dist/reveal.css" />
  <link rel="stylesheet" href="template/brand.css" />
  <link rel="stylesheet" href="template/deck.css" />
  <link rel="stylesheet" href="plugin/customcontrols/style.css" />
  <link rel="stylesheet" href="plugin/chalkboard/style.css" />
</head>
<body>
  <div class="reveal"><div class="slides"><!-- render.js injects <section>s here --></div></div>

  <script src="dist/reveal.js"></script>
  <script src="plugin/notes/notes.js"></script>
  <script src="plugin/pointer/plugin.js"></script>
  <script src="plugin/chalkboard/plugin.js"></script>
  <script src="plugin/customcontrols/plugin.js"></script>

  <script type="module">
    import { deck } from "./decks/2026-07-01.deck.js";   // ← the ONLY per-demo line
    import { renderDeck } from "./template/render.js";
    import { initAnim } from "./template/anim.js";

    renderDeck(deck, document.querySelector(".slides"));  // build DOM from data

    Reveal.initialize({
      // Item 4 — scaling (author at 1280×720, no reveal margin; we own margins in deck.css)
      width: 1280, height: 720, margin: 0, minScale: 0.2, maxScale: 2.0, center: false,

      // Item 3 — motion (brand ease-out-expo)
      transition: 'fade', transitionSpeed: 'default', backgroundTransition: 'fade',
      autoAnimateEasing: 'cubic-bezier(0.16, 1, 0.3, 1)', autoAnimateDuration: 0.6,
      autoAnimateUnmatched: false,
      fragments: true, fragmentInURL: true,

      // Item 2 — clean share
      hideInactiveCursor: true, hideCursorTime: 3000,
      controls: false, progress: false,   // cleaner shared frame (toggle on if you want nav UI)

      // routing
      hash: true,

      // pacing (optional): green/red indicator in speaker view
      defaultTiming: 45,   // seconds budget per slide (per-slide override via data-timing)

      // Items 1 + 6 — plugins (all vendored locally)
      plugins: [ RevealNotes, RevealChalkboard, RevealCustomControls, RevealPointer ],
      pointer: { key: 'q', color: 'red', pointerSize: 16 },
      chalkboard: { boardmarkerWidth: 3, chalkWidth: 7, theme: 'whiteboard' }
    });

    initAnim(Reveal);  // wires KPI count-up + reduced-motion gate + ring-drift on slide change
  </script>
</body>
</html>
```

### 1 · Speaker / Presenter view (TWO windows)
- Press **`S`** → opens a second window (speaker view): current slide, **next-slide preview**, your notes (from `<aside class="notes">` that `render.js` injects from the `notes` field), wall-clock + **elapsed timer**, and green/red **pacing** (driven by `defaultTiming` / per-slide `data-timing`).
- The original window stays clean (current slide only) — **that** is the one you screen-share.
- **Do NOT set `showNotes: true`** (that prints notes onto shared slides). Notes stay private to the speaker window.
- Speaker view is a pop-up → allow pop-ups for the deck origin/localhost or `S` silently does nothing.

### 2 · Fullscreen (zero browser chrome)
- Press **`F`** (native Fullscreen API); **`Esc`** exits. `hideInactiveCursor` removes the floating arrow on the share.
- **Share the specific window, not the whole screen/tab,** then press `F` → viewers never see OS bar/dock/other tabs.
- Fullscreen needs a user gesture (can't auto-trigger). Optional button: `<button onclick="document.documentElement.requestFullscreen()">Present</button>`.

### 3 · Animations (premium, not gimmicky) — three layers
- **Auto-animate** (the star): put `data-auto-animate` on paired `<section>`s and reuse `data-id` on the shared element. Signature morphs to build:
  - **Divider/section numeral → first content slide's kicker index** (chapter number becomes the running head).
  - **Cover → closing:** the orbital ring sweeps bottom-right → top-left as one continuous arc.
  - (Optional) a bento "Switzerland" cell blooming into the funnel focal object.
- **Fragments** (staged reveals within a slide): `fade-up`, `fade-in-then-semi-out`, order via `data-fragment-index`. `fragmentInURL: true` so a refreshed link lands on the right step. The anchor-stack stagger (kicker→headline→focal→captions, 80–100ms) is implemented as fragments.
- **Transitions:** global `fade` (disciplined). Let auto-animate carry the "wow" on 3–5 hero moments. Avoid `zoom`/`convex` everywhere.
- **KPI count-up** (`anim.js`): Chillax tabular numbers count 0→value over 900ms ease-out on slide-enter (funnel). Tabular figures = no layout shift.
- **Ring drift:** 20s ≤2° rotation loop on blue/dark hero slides (transform only).
- **Reduced-motion (hard gate):** count-ups jump to final; auto-animate → cross-fade; ring drift stops; fragments become instant opacity. `anim.js` checks `window.matchMedia('(prefers-reduced-motion: reduce)')`.

### 4 · Scaling
- Author once at **1280×720**; reveal transform-scales to any display. `maxScale: 2.0` keeps text crisp on 4K. Validate at **1920×1080, 1440×900, 1280×720** — uniform scaling means if it's right at one aspect it holds at the others. Verify no overflow and every image `contain`.

### Keys on stage
`S` speaker view · `F` fullscreen · `Esc` exit/overview · `C` draw on slide · `B` chalkboard · `Q` laser · right-drag = erase · `DEL` clear · `X`/`Y` cycle pen color.

> **Font Awesome note:** chalkboard toolbar icons expect Font Awesome; to stay fully offline either vendor a Font Awesome build locally or accept unstyled toolbar icons — the keyboard shortcuts work regardless.

---

## 7. Hosting drop-in → shareable link + collaboration architecture

### What ships now vs needs a server
- **Everything in this spec (present live, share a static link afterward) is 100% static — no server.**
- Only **"audience's screen follows mine live" (multiplex)** and **audience cursors/comments** need a tiny realtime (WebSocket) server. A pure static host (GitHub Pages) cannot broadcast slide-change events by itself.

### Recommended: GitHub Pages via `gh` CLI (matches user `formunauts-sam`, `gh` active)
From inside `demo-deck/`:
```bash
git init
git add -A
git commit -m "feat: formunauts marketing demo deck"

# create the repo under the account and push (public so Pages is free)
gh repo create formunauts-sam/formunauts-deck --public --source=. --push

# turn on Pages: serve repo root of main
gh api -X POST repos/formunauts-sam/formunauts-deck/pages \
  -f "source[branch]=main" -f "source[path]=/"

# .nojekyll already present so dist/ & plugin/ serve verbatim; ensure it's committed
git add .nojekyll && git commit -m "chore: disable jekyll" && git push
```
Live within ~1 min at **`https://formunauts-sam.github.io/formunauts-deck/`**.
**Update later:** `git add -A && git commit -m "..." && git push` → same link auto-updates.

### Runner-up: Vercel (best per-change preview links)
```bash
npm i -g vercel
vercel        # first run: links/creates project, gives preview URL
vercel --prod # promote to production URL
```
Optional `vercel.json`: `{ "cleanUrls": true, "trailingSlash": false }` (a plain static deck works without it).

### One-off: Netlify Drop
Drag `demo-deck/` onto **https://app.netlify.com/drop** → instant public link. Great for a quick share; less ideal for ongoing edits.

### Collaboration architecture (lightest real path)
- **Normal pitch (recommended):** skip realtime. Present live (speaker view + fullscreen + laser/chalkboard), share the static Pages link afterward — everyone self-navigates. Zero servers, least fragile.
- **If you truly need "everyone follows mine":** reveal.js **Multiplex** — three parts: (1) **master** (your copy, holds the `secret` — never deployed publicly), (2) **client** (the public Pages copy, `secret: null`, read-only), (3) a **socket.io relay**. Run `reveal-multiplex` once on Railway/Render/Fly (`npm install reveal-multiplex; node node_modules/reveal-multiplex` → listens on `:1948`); get token/secret from `https://YOUR_SERVER:1948/token`. Publish the client deck to Pages; drive from your master copy.
- **If you also want audience cursors/chat:** add **PartyKit Cursor Party** — one `<script src="https://YOUR-PROJECT.partykit.dev/cursors">` before `</body>` adds multiplayer cursors + `/` cursor-chat to the static Pages deck (deploy: clone `partykit/cursor-party`, `npm install`, `npx partykit login`, set username + deck URL in `.env`, `npm run deploy`). Runs on Cloudflare edge; effectively free for a pitch audience. (Liveblocks is the heavier managed option if you later need persistent comments/reactions.)

Minimal footprint for full follow-along + pointing = **Pages (client) + one `reveal-multiplex` server + PartyKit script.**

---

## 8. How to make the NEXT demo (drop-in new content)

The reveal.js chrome, brand styling, and contain-safe image framing are all **inherited**. To produce the next fortnight's deck:

1. **Duplicate the newest data file:** `cp decks/2026-07-01.deck.js decks/2026-07-15.deck.js`.
2. **Swap the strings** in the new file: `meta.title`, `meta.date`, `meta.imagesBase` (point to the new dated image folder), every slide's `headline` / `eyebrow` / `lead` / `bullets` / `columns`, and — importantly — each slide's **`notes`** (speaker notes travel with the content).
3. **For data visuals:** just change the numbers — `funnel:[{label,value,note}]` and `pills:[...]` for a funnel, `steps:[{n,label,icon}]` for a process diagram. New numbers, no markup.
4. **Drop new PNGs** into `assets/img/2026-07-15/`. Reference them by **filename only** in the data (`hero.src`, `thumbs[].src`, `gallery[]`). The renderer wraps each in an aspect-correct `.asset-frame` → **squishing is impossible.**
   - If a new image has a ratio not already in the `RATIO`/`PX` lookup in `render.js`, add one line: its filename → a new `.ratio-*` class (aspect = its intrinsic W/H) in `deck.css`, and its `width,height` in `PX`. (This is the only time you touch chrome — and it's additive, one line.)
5. **Repoint the import** in `index.html`: `import { deck } from "./decks/2026-07-15.deck.js";`. (One line. Optionally read `?deck=2026-07-15` from the URL so you don't edit HTML at all — recommended enhancement in `index.html`.)
6. **Preview locally:** `npx serve .` (or `python3 -m http.server 8000`) → open, press `S` to check notes, `F` to rehearse.
7. **Publish:** `git add -A && git commit -m "feat: 2026-07-15 marketing demo" && git push` → same Pages link updates.

**Never do (it breaks the template contract):** hardcode an image path in markup, set both width+height on an `<img>` in CSS, write a raw hex/px in author CSS, add a third font, use Chillax for body, make red a fill/CTA, put on-slide copy that belongs in the notes, or redraw the rocket/rings from the supplied logo lockup.

**Brand guardrails to keep passing (from LEARNINGS):** tokens only (L-001); direct/verb-driven English voice, drop the German gender-colon for this EN deck (L-002); `FORMUNAUTS` all-caps, `formunauts.com` no-www, CamelCase hashtags (L-003); supplied logo/key-visual PNGs only, correct lockup for the background (L-004); no emoji, Lucide is a flagged placeholder (L-005); Figtree body/UI/headlines, Chillax only logo/ONE-APP/display/numerals (L-006); primary blue is the hero + default CTA, red `#E03B50` is a single stopper max ~1/surface (L-007); EN numbers `$24.00`/`12.5%` but keep `.font-num`/`tnum` on numeral columns (L-008 adapted).
