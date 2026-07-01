# Live Collaboration layer (PartyKit)

Optional audience layer for the FORMUNAUTS deck: **slide-follow · presenter pointer mirror ·
presence count · on-brand reactions · raise-hand · Q&A · live polls.**

It is **purely additive**. The deck on GitHub Pages keeps working byte-for-byte with no server.
Collaboration only switches on when the client has both a **PartyKit host** and a **`?room=`** in
the URL. No host or no room → `initCollab()` returns immediately and nothing renders.

- **Server:** `party/deck.ts` — one Durable Object per room, hibernates when idle (effectively $0).
- **Client:** `template/collab.js` — `initCollab(Reveal, opts)`, loads `partysocket` from esm.sh (no build step).
- **Config:** `partykit.json` at the repo root.

---

## What needs the server vs. what works static

| Capability | Needs PartyKit server? | Notes |
|---|---|---|
| The whole deck (slides, motion, PDF, presenter *console* via BroadcastChannel) | **No** | Ships on GitHub Pages exactly as today. The BroadcastChannel presenter view is same-machine and server-free. |
| Presence count (`N watching`) | **Yes** | Live over the WebSocket. |
| Slide-follow (viewers track the presenter) | **Yes** | Presenter broadcasts its slide index; viewers `Reveal.slide()` to match. |
| Presenter pointer mirror (ghost dot on viewer screens) | **Yes** | Presenter's reveal `q` pointer, normalized 0–1 so it lands on the same word at any resolution. |
| On-brand reactions (spark / agree / applause / eyes / +1) | **Yes** | Inline-SVG glyphs in brand blue. No emoji, no red. |
| Raise hand + Q&A queue | **Yes** | Questions reach the presenter HUD only. |
| Live poll (open / vote / close, live tally) | **Yes** | Presenter opens & closes; viewers vote once each. |

If you never deploy the server, delete nothing — the deck simply never shows collab UI.

---

## Deploy the server

Prereq: a free [PartyKit](https://www.partykit.io/) / Cloudflare account. `npx` pulls PartyKit on
demand — no global install required.

```bash
cd demo-deck        # the directory that contains partykit.json

# first time (interactive login), then deploy:
npx partykit login
npx partykit deploy
```

`deploy` prints your host, e.g.:

```
Deployed formunauts-deck to https://formunauts-deck.<your-account>.partykit.dev
```

That hostname (without the `https://`) is your **PARTY host** — you point the deck at it below.

### Lock down presenter control (recommended for public rooms)

By default `partykit.json` sets `PRESENTER_TOKEN: ""` → **open mode**: anyone with
`?role=presenter` is accepted (fine for local/offline demos). For a shared/public room, set a
secret so only *you* can drive slides, move the pointer, and run polls:

```bash
# store a secret (not committed to git)
npx partykit env add PRESENTER_TOKEN
# → paste a value, e.g.  demo-2026-07

npx partykit deploy   # redeploy so the var takes effect
```

The server checks it: a `?role=presenter` client with the wrong (or missing) `?t=` is silently
**demoted to viewer** — it cannot set slides, broadcast a pointer, or open/close polls. Role
enforcement is server-side, not just hidden buttons.

Health check any room over HTTP:

```bash
# deck.ts is the "main" party, so the room path is /parties/main/<room>
curl https://formunauts-deck.<your-account>.partykit.dev/parties/main/demo0701
# → {"room":"demo0701","viewers":0,"hands":0,...}
```

---

## Point the deck at the server

Pick **one** (the client checks them in this order): `initCollab` option → `?party=` →
`<meta>` → `window.PARTY_HOST`.

**A. `<meta>` in `index.html`** (simplest for a fixed deployment) — add inside `<head>`:

```html
<meta name="party-host" content="formunauts-deck.<your-account>.partykit.dev" />
```

**B. Per-link** with `?party=` (handy while testing, overrides the meta):

```
…/index.html?room=demo0701&party=formunauts-deck.<your-account>.partykit.dev
```

**C. In code** via the init option (see the integration snippet below).

---

## Presenter vs. viewer links

The deck reads `?room`, `?role`, and `?t` from the URL — exactly like it already reads `?deck`.
Roles are **separate**: presenters and viewers get different UI and different capabilities.

Assume host `formunauts-deck.acme.partykit.dev`, room `demo0701`, and (if locked down) token
`demo-2026-07`.

**Presenter (you) — drives the deck, sees the audience HUD:**

```
https://formunauts-sam.github.io/formunauts-deck/?room=demo0701&role=presenter&t=demo-2026-07&party=formunauts-deck.acme.partykit.dev
```

**Viewer (audience) — follows you, reacts, votes, raises a hand, asks questions:**

```
https://formunauts-sam.github.io/formunauts-deck/?room=demo0701&party=formunauts-deck.acme.partykit.dev
```

Notes:
- Omit `&role=…` for viewers (viewer is the default). Never share the presenter link/token with the audience.
- If you set the host via `<meta>` (option A), drop `&party=…` from both links — they get shorter:
  - Presenter: `…/?room=demo0701&role=presenter&t=demo-2026-07`
  - Viewer: `…/?room=demo0701`
- **Open mode** (empty `PRESENTER_TOKEN`): drop `&t=…` entirely; any `role=presenter` link works. Use this for offline/local demos only.
- The viewer link is what you put behind an audience **QR code** on the cover/closing slide.
- `room` is any short id (`[A-Za-z0-9._-]`), one Durable Object per distinct value. Use a fresh id per session to start clean.

---

## `index.html` integration snippet

`initCollab` is already wired in `index.html` per PRO-BUILD-SPEC §2.1(d)/(g). For reference, the
whole integration is three lines — an import and a call (plus the optional `<meta>` host above):

```js
// with the other template imports:
import { initCollab } from "./template/collab.js";

// after Reveal.initialize(...) and initAnim(Reveal):
initCollab(Reveal);
// self-disables unless a PARTY host + ?room= are present.
```

Passing the host in code instead of `<meta>`/`?party=`:

```js
initCollab(Reveal, { host: "formunauts-deck.acme.partykit.dev" });
```

`initCollab(Reveal, opts?)` accepts:

| opt | type | purpose |
|---|---|---|
| `host` | `string` | PARTY host (bare `host[:port]`, no scheme). Highest-priority host source. |
| `name` | `string` | Optional display label for this connection (else `?name=`). |

It returns `{ enabled: boolean }` and is always safe to call — on the static deck it no-ops.

---

## Local end-to-end test

Run the server and the deck side by side:

```bash
# terminal 1 — the collaboration server on :1999 (PartyKit default)
cd demo-deck
npx partykit dev

# terminal 2 — the deck (same-origin static host)
cd demo-deck
python3 -m http.server 8748
```

Then open, in open mode (no token needed with `npx partykit dev`):

- Presenter: `http://localhost:8748/?room=test&role=presenter&party=localhost:1999`
- Viewer:    `http://localhost:8748/?room=test&party=localhost:1999`

Advance slides in the presenter tab → the viewer tab follows. Click a reaction in the viewer tab →
it flies on both. Toggle the reveal `q` pointer in the presenter tab → the ghost dot appears for the
viewer. Open a poll from the presenter HUD → the viewer sees tappable options and you see the live
tally. Raise a hand / ask a question in the viewer tab → it shows only in the presenter HUD.

---

## Message protocol (reference)

JSON frames, `{ type, ... }`. The server validates every one at the boundary (JSON-guarded,
reaction whitelist, poll bounds + option index, question length cap, one vote per connection) and
enforces roles.

**Client → server**

| type | who | payload |
|---|---|---|
| `set-slide` | presenter | `{ h, v, id }` |
| `pointer` | presenter | `{ x, y, visible }` (x,y normalized 0–1) |
| `reaction` | anyone | `{ kind }` — one of `spark \| up \| clap \| eyes \| plus` |
| `hand` | viewer | `{ on }` |
| `question` | viewer | `{ text }` (≤240 chars) |
| `poll-open` | presenter | `{ id, q, options[] }` (2–6 options) |
| `poll-vote` | anyone | `{ id, option }` (option = index) |
| `poll-close` | presenter | `{ id }` |

**Server → client**

| type | payload |
|---|---|
| `state` | snapshot to a new joiner: `{ role, slide, poll, presence, reactionsTotal, questions }` — `role` is the **granted** role |
| `slide` | `{ h, v, id }` |
| `pointer` | `{ x, y, visible }` |
| `reaction` | `{ kind }` |
| `presence` | `{ count, hands }` |
| `poll` | `{ id, q, options, votes, open }` |
| `question` | `{ id, text, ts }` — **presenters only** |

---

## Cost & lifecycle

- One Durable Object **per room id**. `hibernate: true` → it spins down when the last socket
  closes and wakes on the next connect. Idle rooms cost effectively nothing.
- Room state (current slide, open poll, question queue, reaction counter) is mirrored to
  `party.storage`, so a room survives hibernation and redeploys.
- `partysocket` auto-reconnects; the client gates sends on an open socket and resyncs from the
  next `state`/`slide` — a dropped server never crashes the deck.
