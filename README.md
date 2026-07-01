# FORMUNAUTS Demo-Deck

A reusable, on-brand **reveal.js** "Marketing Update & Look Ahead" deck for FORMUNAUTS.
Swiss/International typographic grid, run as an editorial magazine, with a Mission-Control
accent layer (rocket + drawn orbital rings). Fully **CDN-free** (reveal.js is vendored locally)
and **self-contained** (fonts, logos, and images all live in the repo).

**It is a TEMPLATE.** Content changes every fortnight; the chrome (reveal.js + brand system)
never does. A new demo = duplicate one data file, swap strings, drop in new PNGs. **Zero
markup or CSS edits.**

---

## Quick start — preview locally

The deck is plain static files but uses ES modules, so it must be served over HTTP
(opening `index.html` via `file://` will fail on the module imports).

```bash
cd demo-deck

# pick ONE:
python3 -m http.server 8000      # → http://localhost:8000
# or
npx serve .                      # → prints a local URL
```

Then open **http://localhost:8000** in Chrome. That's it.

> Tip: `?deck=2026-07-01` in the URL selects a specific deck data file. With no query it
> loads the default (currently `2026-07-01`).

---

## How to present

The deck is built for a **two-window** live presentation, then a shareable static link afterward.

1. **Open the deck** in Chrome (served as above).
2. **Press `S`** → a second **Speaker View** window opens. It shows the current slide, a
   **next-slide preview**, **your speaker notes**, a wall-clock + elapsed timer, and green/red
   **pacing** (45s budget per slide by default).
   - The **original window stays clean** (current slide only) — **that** is the one you screen-share.
   - Speaker View is a pop-up, so **allow pop-ups** for `localhost` (or the Pages origin) or `S`
     silently does nothing.
3. **Share the specific window** (not the whole screen/tab) in your video call, so viewers never
   see your notes, the OS bar, or other tabs.
4. **Press `F`** on the shared window → native fullscreen, zero browser chrome. `Esc` exits.
   (There's also a small **"Present ▸"** button bottom-right that triggers fullscreen.)

### Keys on stage

| Key | Action |
|-----|--------|
| `→` / `Space` | next slide · `←` previous |
| `S` | Speaker View (notes + next preview + timer) |
| `F` | Fullscreen · `Esc` exit / slide overview |
| `Q` | Laser pointer (red dot) |
| `C` | Draw / annotate on the current slide |
| `B` | Chalkboard (blank draw surface) |
| right-drag | erase · `DEL` clear · `X` / `Y` cycle pen colour |

> The annotation toolbar icons expect Font Awesome (not vendored, to stay fully offline) — the
> **keyboard shortcuts work regardless**, and the on-slide `✎` / `▤` buttons are wired too.

### Motion & accessibility

- Every slide is **fully composed on entry** — content fades up in a gentle stagger automatically,
  **no clicks needed**. The shared screen never shows an empty slide waiting for an arrow press.
- The **Switzerland funnel** numbers count up 0 → value on entry; the orbital rings drift slowly on
  the blue cover/closing.
- **`prefers-reduced-motion`** is honored as a hard gate: count-ups jump to final, ring drift stops,
  and the entrance stagger becomes instant.

---

## How to host → a shareable link

### Recommended: GitHub Pages (free, matches the `formunauts-sam` account)

A one-shot script is included:

```bash
./deploy.sh
```

It runs `git init`, creates **`formunauts-sam/formunauts-deck`** (public), pushes, and enables Pages.
Live within ~1 min at:

**https://formunauts-sam.github.io/formunauts-deck/**

**Update later** (same link auto-updates):

```bash
git add -A && git commit -m "feat: <next date> marketing demo" && git push
```

<details>
<summary>Manual equivalent of <code>deploy.sh</code></summary>

```bash
git init && touch .nojekyll
git add -A && git commit -m "feat: formunauts marketing demo deck"
gh repo create formunauts-sam/formunauts-deck --public --source=. --push
gh api -X POST repos/formunauts-sam/formunauts-deck/pages \
  -f "source[branch]=main" -f "source[path]=/"
```
`.nojekyll` is already committed so `dist/` and `plugin/` serve verbatim.
</details>

### Runner-up: Vercel (best per-change preview links)

```bash
npm i -g vercel
vercel          # first run: links/creates the project, gives a preview URL
vercel --prod   # promote to the production URL
```
`vercel.json` (already present) sets `cleanUrls` + `trailingSlash:false`.

### One-off: Netlify Drop

Drag the `demo-deck/` folder onto **https://app.netlify.com/drop** → instant public link.
Great for a quick share, less ideal for ongoing edits.

---

## How to make the NEXT demo (edit ONE file)

The reveal.js chrome, brand styling, and contain-safe image framing are all **inherited**. To
produce the next fortnight's deck you touch **only content**:

1. **Duplicate the newest data file:**
   ```bash
   cp decks/2026-07-01.deck.js decks/2026-07-15.deck.js
   ```
2. **Swap the strings** in the new file: `meta.title`, `meta.date`, `meta.imagesBase`, and every
   slide's `headline` / `eyebrow` / `lead` / `bullets` / `columns` — **and each slide's `notes`**
   (speaker notes travel with the content).
3. **For data visuals:** just change the numbers — `funnel:[{label,value,note}]` + `pills:[...]`
   for the funnel, `steps:[{n,label,icon}]` for the process diagram. New numbers, no markup.
4. **Drop new PNGs** into `assets/img/2026-07-15/` and reference them by **filename only**
   (`hero.src`, `thumbs[].src`, `gallery[]`). The renderer wraps each in an aspect-correct frame,
   so **squishing is impossible.**
5. **Point at the new deck** — either edit one line in `index.html`
   (`const DEFAULT_DECK = "2026-07-15";`) **or** just open `?deck=2026-07-15` in the URL (no HTML
   edit at all).
6. **Preview** (`python3 -m http.server`), press `S` to check notes, `F` to rehearse.
7. **Publish:** `git add -A && git commit -m "feat: 2026-07-15 demo" && git push` → same link updates.

### The one time you touch chrome (additive, one line)

If a new image has an aspect ratio **not already known**, add it in two places (both are one-liners):
- `template/deck.css` → a new `.ratio-*` class with `aspect-ratio: <W> / <H>` (its intrinsic pixels).
- `template/archetypes/_shared.js` → add the filename to `RATIO` (→ that class) and `PX` (→ `[W, H]`).

Get the intrinsic pixels with `sips -g pixelWidth -g pixelHeight yourimage.png` on macOS.

### Never do (it breaks the template contract)

Hardcode an image path in markup · set both width+height on an `<img>` in CSS · write a raw
hex/px in author CSS · add a third font · use Chillax for body text · make red a fill or a CTA ·
put on-slide copy that belongs in the notes · redraw the rocket/rings from a logo lockup.

---

## Architecture (CONTENT / CHROME split)

```
demo-deck/
├── index.html                 CHROME · boots reveal.js, imports the active deck, inits plugins
├── decks/
│   └── 2026-07-01.deck.js      CONTENT · the ONLY file you edit/duplicate per demo (incl. notes)
├── template/                   CHROME · the reusable engine + brand system (never edited per-demo)
│   ├── brand.css               design tokens (:root) + @font-face  (§2 + §3)
│   ├── deck.css                archetype layouts, chrome, framed-image system, motion  (§4/§5/§6)
│   ├── render.js               THE ONLY PLACE MARKUP LIVES — switches on `archetype`, injects notes
│   ├── anim.js                 KPI count-up + reduced-motion gate + ring drift
│   └── archetypes/             one render fn per archetype (+ _shared.js helpers, RATIO/PX lookup)
├── dist/  plugin/              VENDORED reveal.js core + plugins (CDN-free)
├── fonts/                      Figtree (.ttf) + Chillax (.otf), 10 files
├── assets/logos/               rocket SVGs + wordmark/lockup/claim PNGs
├── assets/img/2026-07-01/      this demo's post/card images (ASCII-safe filenames)
├── deploy.sh  vercel.json  .nojekyll
└── BUILD-SPEC.md               the authoritative spec this was built from
```

**The template contract**
1. `index.html` imports one deck data file and hands it to `render.js`. `render.js` switches on
   `archetype` **only** — it never knows about a specific deck.
2. Images are declared by **filename + `meta.imagesBase`**; the renderer always wraps media in an
   aspect-correct `.asset-frame` with `object-fit: contain`. **Distortion is impossible by construction.**
3. Speaker notes are a `notes` string in the data → dropped verbatim into reveal's `<aside class="notes">`.
4. Brand tokens live in `brand.css`; all layout CSS references only `var(--token)`.

**Archetype vocabulary** (drawn visuals are data-driven features):
`cover · overviewBullets · campaignAnalysis (funnel) · projectVisual (hero|masonry|single) ·
processDiagram · nextSteps · closing`.

---

## Collaboration plan (live "everyone follows me" + audience cursors)

**What ships now is 100% static — no server.** Present live (Speaker View + fullscreen + laser +
annotate), then share the static Pages link afterward; everyone self-navigates. This is the
recommended, least-fragile path and needs **zero infrastructure**.

Only two things need a tiny realtime (WebSocket) server, because a static host can't broadcast
slide-change events by itself:

- **"Audience's screen follows mine live" (multiplex).** reveal.js **Multiplex** has three parts:
  (1) a **master** (your local copy, holds the `secret`, never deployed publicly), (2) the **client**
  (the public Pages copy, `secret: null`, read-only), and (3) a **socket.io relay**. Run
  `reveal-multiplex` once on Railway/Render/Fly (`npm i reveal-multiplex && node node_modules/reveal-multiplex`
  → listens on `:1948`; get token/secret from `https://YOUR_SERVER:1948/token`), publish the client
  deck to Pages, and drive it from your master copy.
- **Audience cursors / cursor-chat.** Add **PartyKit "Cursor Party"** — a single
  `<script src="https://YOUR-PROJECT.partykit.dev/cursors">` before `</body>` gives multiplayer
  cursors + `/` cursor-chat on the static deck. (Deploy: clone `partykit/cursor-party`, `npm install`,
  `npx partykit login`, set username + deck URL in `.env`, `npm run deploy`. Runs on the Cloudflare
  edge; effectively free for a pitch audience.)

Minimal footprint for full follow-along + pointing = **Pages (client) + one `reveal-multiplex`
server + the PartyKit script.** See **Known gaps** below — neither realtime piece is wired yet.

---

## Known gaps / TODO

- **Realtime collaboration is not wired.** Present-live + share-a-link works today with no server.
  "Everyone follows my slide" (Multiplex) and "audience cursors" (PartyKit) each need a small
  WebSocket server stood up and 1–2 config lines added — deliberately left out so the deck stays a
  pure static artifact. Follow the **Collaboration plan** above when you want either.
- **Lucide icons on slide 07 are a flagged placeholder** (inline SVG paths for `database`,
  `scan-search`, `sparkles`). They are provisional per the brand system — never used to substitute
  the rocket, and there is no emoji anywhere. Swap for the final icon set when it lands.
- **Annotation toolbar icons need Font Awesome** to render as glyphs. To stay fully offline it isn't
  vendored, so the toolbar buttons may show as unstyled boxes — the **keyboard shortcuts and the
  on-slide `✎`/`▤` buttons work regardless.** Vendor a Font Awesome build locally if you want the
  toolbar glyphs.
- **`gh` account.** `deploy.sh` targets `formunauts-sam/formunauts-deck`. If your active `gh` account
  differs, edit the `REPO` variable at the top of `deploy.sh`.

---

## Brand guardrails (kept passing)

Tokens only (no raw hex/px in author CSS) · direct English voice (sanctioned exception to the
German-first brand voice; no gender-colon) · `FORMUNAUTS` all-caps, `formunauts.com` no-www ·
supplied logo/rocket assets only, correct lockup for the background · no emoji · Figtree for
body/UI/headlines, Chillax only for logo/ONE-APP/display/numerals · primary blue `#0074C8` is the
hero + default accent, red `#E03B50` is a single stopper (≤3 slides, never a fill/CTA) · EN numbers
(`$24.00`, `26.8%`) but `.font-num`/`tnum` kept on numeral columns.
