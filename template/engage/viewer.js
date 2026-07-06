/* ============================================================
   engage/viewer.js, the VIEWER SURFACE controller (CHROME).
   Wave 3 (PLATFORM-V2-CONCEPT.md §4.7): the phone-shaped page
   that MIRRORS the live slide.
   ------------------------------------------------------------
   viewer.html loads the SAME deck as index.html and boots reveal
   in LOCKED FOLLOW mode: no controls, no keyboard/touch nav. The
   only thing that ever changes the slide is the presenter, arriving
   over the Engage Transport as `set-slide` / `slide` / `state`.

   How a viewer connects + hydrates (the Wave 2 contract):
     1. makeTransport('local', { roomId, role:'viewer', clientId }).
     2. hydrate() first, jump to the last slide from localStorage
        instantly, before the round-trip.
     3. send({ t:'hello' }), the host replies with a `state` snapshot
        addressed to us (msg.to === clientId) and re-broadcasts presence.
     4. Subscribe to the authority fan-out (state|slide|presence). Render
        only authority-origin frames (msg.role === 'presenter') or, for
        our own echoes, msg.from === clientId. Filter `state` by
        (!msg.to || msg.to === clientId) so a snapshot meant for another
        late joiner is ignored.
     5. On pagehide, send { t:'bye' } so presence self-heals.

   This controller imports ONLY the Transport (engage/transport.js).
   It never speaks to a backend directly; flipping to Supabase is the
   one-line ?engage= change, exactly like the deck host. The deck is
   rendered with renderDeck() from render.js so the viewer shows the
   IDENTICAL chrome the projector shows.

   The thumb zone (reactions / ask / poll bottom-sheet) is Wave 4.
   This file leaves clean DOM hooks + a small controller API for it
   (see the return value of initViewer and the EXPORTS at the bottom).
   Reduced-motion safe: slide jumps are instant; nothing here animates
   layout-bound properties.
   ============================================================ */
import { renderDeck } from "../render.js";
import { makeTransport, STATUS } from "./transport.js";
import { manifest, ACTIVE_DECK } from "../../decks/manifest.js";
import {
  GLYPHS,
  REACTION_TITLE,
  REACTION_ORDER,
  HAND_SVG,
  UPVOTE_SVG,
  ASK_SVG,
} from "./glyphs.js";

/* Client-side input caps (defence in depth; the authority re-enforces).
   Length matches MAX_QUESTION_LEN in authority.js. */
const MAX_QUESTION_LEN = 280;
const CONTROL_CHARS = new RegExp("[\\x00-\\x1F\\x7F-\\x9F]+", "g");

/* Sanitize a viewer-typed question the same way the authority will, so what
   the sender sees locally matches what the room receives: strip control chars,
   collapse whitespace, trim, cap length. Never trust this alone. */
function cleanQuestion(v) {
  return String(v == null ? "" : v)
    .replace(CONTROL_CHARS, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_QUESTION_LEN);
}

/* ------------------------------------------------------------------
   Small helpers, mirror collab.js idioms (defensive, vanilla ES).
------------------------------------------------------------------ */
function el(tag, attrs = {}, html) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === false || v == null) continue;
    if (k === "class") node.className = v;
    else node.setAttribute(k, v === true ? "" : String(v));
  }
  if (html != null) node.innerHTML = html;
  return node;
}

/* A stable per-viewer id, persisted in sessionStorage so a reload keeps
   the same identity (vote dedupe survives a refresh; a fresh tab is a
   fresh viewer). Matches collab.js's key so the two surfaces agree. */
function ensureClientId() {
  const key = "fmnts-engage-client";
  try {
    let id = sessionStorage.getItem(key);
    if (!id) {
      id = "c-" + Math.random().toString(36).slice(2, 10);
      sessionStorage.setItem(key, id);
    }
    return id;
  } catch {
    return "c-" + Math.random().toString(36).slice(2, 10);
  }
}

/* Deck id from ?deck=, ASCII-guarded exactly like index.html. Default is
   the active demo (manifest[0]) so a bare viewer.html still follows. */
function resolveDeckId() {
  let wanted = ACTIVE_DECK;
  try {
    wanted = new URLSearchParams(location.search).get("deck") || ACTIVE_DECK;
  } catch {
    /* no location, stay on default */
  }
  return /^[0-9A-Za-z._-]+$/.test(wanted) ? wanted : ACTIVE_DECK;
}

/* Room resolution mirrors collab.js: ?room= wins, else the deck's own
   meta.room, else the deck id. The deck host derives the SAME room, so a
   bare viewer.html?deck=<id> lands in the right room with no extra param. */
function resolveRoom(deck, deckId) {
  let fromQuery = "";
  try {
    fromQuery = (new URLSearchParams(location.search).get("room") || "").trim();
  } catch {
    /* no location */
  }
  const metaRoom =
    deck && deck.meta && typeof deck.meta.room === "string"
      ? deck.meta.room.trim()
      : "";
  return fromQuery || metaRoom || deckId || "default";
}

/* Transport mode from ?engage= (default local). Same knob as the host. */
function resolveModeParam() {
  try {
    return new URLSearchParams(location.search).get("engage") || "local";
  } catch {
    return "local";
  }
}

/* ==================================================================
   initViewer(Reveal, opts) -> viewer controller
   ------------------------------------------------------------------
   Called by viewer.html AFTER the deck is rendered and Reveal has
   initialized. opts:
     deck    the loaded deck data (for meta.room / meta.id)
     deckId  the resolved, ASCII-safe deck id
     mount   the DOM hooks object viewer.html built (presence count
             node, status chip, thumb-zone container, stage element)

   Returns a small controller the Wave 4 interaction layer builds on:
     { transport, room, clientId,
       getSlide(): {h,v,id},            // last authoritative slide
       onSlide(cb): unsubscribe,        // fires on every follow
       thumbZone: HTMLElement }         // the empty container to fill
================================================================== */
export function initViewer(Reveal, opts = {}) {
  const deck = opts.deck || null;
  const deckId = opts.deckId || resolveDeckId();
  const mount = opts.mount || {};
  const room = resolveRoom(deck, deckId);
  const clientId = ensureClientId();
  const mode = resolveModeParam();

  /* Last authoritative slide we rendered, and slide subscribers (Wave 4
     may want to know the current slide to show slide-scoped controls). */
  const slideSubs = new Set();
  let currentSlide = { h: 0, v: 0, id: "" };

  const transport = makeTransport(mode, {
    roomId: room,
    role: "viewer",
    clientId,
    // a viewer is never the authority; the deck (host) tab reduces state.
    authority: false,
  });

  /* ---- LOCKED FOLLOW: the viewer never drives its own navigation. ----
     Reveal is configured with keyboard/touch off in viewer.html, but we
     also guard the programmatic path: followSlide sets suppress so the
     'slidechanged' it triggers is not mistaken for user intent. There is
     no outbound set-slide from a viewer at all, the guard is belt and
     braces for any future nav wiring. */
  let suppress = false;
  function followSlide(slide) {
    if (!slide) return;
    const h = Number(slide.h) || 0;
    const v = Number(slide.v) || 0;
    currentSlide = { h, v, id: typeof slide.id === "string" ? slide.id : "" };
    const cur = Reveal.getIndices ? Reveal.getIndices() : { h: 0, v: 0 };
    if (cur.h === h && cur.v === v) {
      notifySlide();
      return; // already there, still notify (id may differ)
    }
    suppress = true;
    try {
      Reveal.slide(h, v);
    } catch {
      /* out-of-range index (deck mismatch), ignore, next state resyncs */
    }
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        suppress = false;
      });
    });
    notifySlide();
  }

  function notifySlide() {
    for (const cb of Array.from(slideSubs)) {
      try {
        cb(currentSlide);
      } catch (err) {
        console.warn("[viewer] slide subscriber threw", err);
      }
    }
  }

  /* ---- presence bar (live viewer count) ---- */
  function renderPresence(count) {
    const n = Math.max(0, Number(count) || 0);
    if (mount.count) mount.count.textContent = String(n);
    if (mount.presenceBar) mount.presenceBar.classList.toggle("is-live", n > 0);
  }

  /* ---- status chip: subtle connecting / reconnecting / offline ---- */
  function renderStatus(status) {
    if (!mount.status) return;
    const map = {
      [STATUS.CONNECTING]: { text: "Connecting", cls: "is-connecting" },
      [STATUS.LIVE]: { text: "Following live", cls: "is-live" },
      [STATUS.RECONNECTING]: { text: "Reconnecting", cls: "is-reconnecting" },
      [STATUS.CLOSED]: { text: "Offline", cls: "is-offline" },
    };
    const s = map[status] || map[STATUS.CONNECTING];
    mount.status.textContent = s.text;
    mount.status.className = "vw-status " + s.cls;
  }

  /* ================================================================
     Subscribe to the authority fan-out. On BroadcastChannel a viewer
     also sees OTHER viewers' raw sends, so we accept a frame only when
     it is authority-origin (role:presenter), the host stamps that on
     every fan-out, or our own echo. This is the exact filtering the
     Wave 2 brief mandates.
  ================================================================ */

  // Full snapshot (hello reply + any host re-broadcast). Filter by `to`:
  // a snapshot addressed to another late joiner is not ours to render.
  transport.on("state", (msg) => {
    if (msg.to && msg.to !== clientId) return;
    if (msg.presence) renderPresence(msg.presence.count);
    if (msg.slide) followSlide(msg.slide);
  });

  // Incremental slide change from the authority.
  transport.on("slide", (msg) => {
    if (msg.role !== "presenter") return; // only the host drives the slide
    followSlide(msg);
  });

  // Presence broadcasts (viewer count + raised hands; we show the count).
  transport.on("presence", (msg) => {
    if (msg.role !== "presenter") return;
    renderPresence(msg.count);
  });

  transport.onStatus(renderStatus);

  /* ================================================================
     Connect flow: hydrate from the snapshot for an INSTANT landing on
     the current slide, then say hello for a live, addressed snapshot
     (which also bumps the host's presence count to include us).
  ================================================================ */
  // Optimistic hydrate BEFORE connect resolves, the localStorage
  // snapshot the authority persists lets a late joiner jump immediately.
  const cached = transport.hydrate ? transport.hydrate() : null;
  if (cached) {
    if (cached.presence) renderPresence(cached.presence.count);
    if (cached.slide) followSlide(cached.slide);
  }

  transport
    .connect()
    .then(() => {
      // Announce ourselves; the host hydrates us with a `to`-addressed
      // `state` and re-broadcasts presence including this viewer.
      transport.send({ t: "hello" });
    })
    .catch((err) => {
      console.warn("[viewer] transport failed to connect", err);
    });

  // Leave cleanly so the host's presence count self-heals. pagehide is the
  // reliable mobile-Safari lifecycle event (unload does not fire there).
  window.addEventListener("pagehide", () => {
    try {
      transport.send({ t: "bye" });
    } catch {
      /* ignore */
    }
  });

  /* ================================================================
     Controller surface for the Wave 4 interaction layer. Everything a
     reaction bar / ask composer / poll sheet needs is here, so Wave 4
     never re-derives room/clientId or re-subscribes to the transport.
  ================================================================ */
  return {
    transport,
    room,
    clientId,
    deckId,
    getSlide: () => ({ ...currentSlide }),
    onSlide(cb) {
      if (typeof cb !== "function") return () => {};
      slideSubs.add(cb);
      try {
        cb(currentSlide);
      } catch {
        /* ignore a throwing subscriber on registration */
      }
      return () => slideSubs.delete(cb);
    },
    // the empty thumb-zone container viewer.html built; Wave 4 fills it.
    thumbZone: mount.thumbZone || null,
    // the DOM hooks (stage etc.) so the Wave 4 layer can host a fly layer.
    mount,
  };
}

/* ==================================================================
   initThumbZone(controller) — the Wave 4 interaction layer.
   ------------------------------------------------------------------
   Mounts the audience controls into the viewer's thumb zone (the
   #vw-thumb container initViewer handed back) and wires them to the
   SAME transport the follow-along uses:

     · reaction bar  — 5 on-brand SVG glyphs; tap sends {t:'reaction',kind}
                        with a brief local pop; flying glyphs float over the
                        mirrored slide (transform/opacity only).
     · raise-hand    — a toggle that sends {t:'hand',on}; reflects the shared
                        hand count from presence.
     · ask + Q&A     — a composer (sanitized, capped) that sends
                        {t:'question',text}; the shared question list shows
                        upvote buttons ({t:'question-upvote',id}); the viewer's
                        own question is highlighted; anonymous throughout.
     · poll sheet    — a bottom-sheet that appears when a poll is open; tap an
                        option to send {t:'poll-vote',id,option}; the vote locks
                        (one per clientId) and animated result bars fill.

   BroadcastChannel makes raw peer sends visible to every tab, so this layer
   renders ONLY authority-origin frames (msg.role === 'presenter') or its own
   echo (msg.from === clientId) for ephemeral verbs, exactly like the follow
   path. It imports nothing new: it rides controller.transport from initViewer.

   Returns a small controller { destroy() } so a host can tear it down.
================================================================== */
export function initThumbZone(controller) {
  if (!controller || !controller.thumbZone || !controller.transport) {
    return { destroy() {} };
  }
  const { transport, clientId } = controller;
  const zone = controller.thumbZone;

  // clear the "arrives here soon" placeholder the static viewer.html shipped
  zone.innerHTML = "";
  zone.classList.add("tz-root");

  const unsubs = [];
  const on = (type, fn) => {
    const off = transport.on(type, fn);
    if (typeof off === "function") unsubs.push(off);
  };

  /* ---------------- reaction bar (+ flying layer) ---------------- */
  // flying reactions float over the mirrored stage, so the layer lives on the
  // viewer's stage frame if present, else the thumb zone (still transform-only).
  const flyLayer = el("div", { class: "tz-fly-layer", "aria-hidden": "true" });
  const stageHost =
    (controller.mount && controller.mount.stage && controller.mount.stage.parentElement) ||
    document.body;
  stageHost.appendChild(flyLayer);
  let flying = 0;
  const MAX_FLYING = 24; // phones are small; keep the layer calm
  function flyReaction(kind) {
    const glyph = GLYPHS[kind];
    if (!glyph || flying >= MAX_FLYING) return;
    flying += 1;
    const node = el("div", { class: "tz-fly" }, glyph);
    const spread = 90;
    node.style.left = `calc(50% + ${Math.random() * spread - spread / 2}px)`;
    flyLayer.appendChild(node);
    node.addEventListener(
      "animationend",
      () => {
        node.remove();
        flying -= 1;
      },
      { once: true }
    );
  }

  const reactbar = el("div", {
    class: "tz-reactbar",
    role: "group",
    "aria-label": "Send a reaction",
  });
  REACTION_ORDER.forEach((kind) => {
    const b = el(
      "button",
      { type: "button", title: REACTION_TITLE[kind], "aria-label": REACTION_TITLE[kind] },
      GLYPHS[kind]
    );
    b.addEventListener("click", () => {
      transport.send({ t: "reaction", kind });
      // brief local pop feedback (does not wait on the round-trip)
      b.classList.remove("is-pop");
      // force reflow so the animation restarts on rapid taps
      void b.offsetWidth;
      b.classList.add("is-pop");
    });
    reactbar.appendChild(b);
  });

  /* ---------------- action row: raise hand + ask ---------------- */
  const actions = el("div", { class: "tz-actions" });
  const handBtn = el(
    "button",
    { type: "button", class: "tz-hand", "aria-pressed": "false" },
    `${HAND_SVG}<span class="tz-hand__lbl">Raise hand</span><span class="tz-hand__n" hidden>0</span>`
  );
  const askBtn = el(
    "button",
    { type: "button", class: "tz-askbtn", "aria-expanded": "false" },
    `${ASK_SVG}<span>Ask</span>`
  );
  actions.append(handBtn, askBtn);

  const bar = el("div", { class: "tz-bar" });
  bar.append(reactbar, actions);
  zone.appendChild(bar);

  /* raise-hand toggle */
  let handOn = false;
  handBtn.addEventListener("click", () => {
    handOn = !handOn;
    handBtn.classList.toggle("is-on", handOn);
    handBtn.setAttribute("aria-pressed", String(handOn));
    handBtn.querySelector(".tz-hand__lbl").textContent = handOn
      ? "Hand raised"
      : "Raise hand";
    transport.send({ t: "hand", on: handOn });
  });

  /* ---------------- Ask sheet (composer + shared Q&A list) ------- */
  const askSheet = el("section", {
    class: "tz-sheet tz-ask",
    "aria-label": "Ask a question",
    hidden: true,
  });
  const askHead = el("div", { class: "tz-sheet__head" });
  askHead.append(
    el("span", { class: "tz-sheet__title" }, "Questions"),
    (() => {
      const c = el("button", { type: "button", class: "tz-sheet__close", "aria-label": "Close" }, "Done");
      c.addEventListener("click", () => toggleAsk(false));
      return c;
    })()
  );
  const qList = el("ol", { class: "tz-qlist", "aria-live": "polite" });
  const qEmpty = el("li", { class: "tz-qempty" }, "No questions yet. Be the first.");
  qList.appendChild(qEmpty);

  const composer = el("div", { class: "tz-composer" });
  const ta = el("textarea", {
    class: "tz-ta",
    rows: "2",
    maxlength: String(MAX_QUESTION_LEN),
    placeholder: "Ask the presenter a question...",
    "aria-label": "Your question",
  });
  const composerRow = el("div", { class: "tz-composer__row" });
  const counter = el("span", { class: "tz-counter" }, `0 / ${MAX_QUESTION_LEN}`);
  const sendBtn = el("button", { type: "button", class: "tz-send", disabled: true }, "Send");
  composerRow.append(counter, sendBtn);
  composer.append(ta, composerRow);
  askSheet.append(askHead, qList, composer);
  zone.appendChild(askSheet);

  function toggleAsk(force) {
    const open = typeof force === "boolean" ? force : askSheet.hidden;
    askSheet.hidden = !open;
    askBtn.classList.toggle("is-on", open);
    askBtn.setAttribute("aria-expanded", String(open));
    if (open) ta.focus();
  }
  askBtn.addEventListener("click", () => toggleAsk());

  ta.addEventListener("input", () => {
    counter.textContent = `${ta.value.length} / ${MAX_QUESTION_LEN}`;
    sendBtn.disabled = cleanQuestion(ta.value).length === 0;
  });
  ta.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submitQuestion();
    if (e.key === "Escape") toggleAsk(false);
  });
  sendBtn.addEventListener("click", submitQuestion);
  function submitQuestion() {
    const text = cleanQuestion(ta.value);
    if (!text) return;
    transport.send({ t: "question", text });
    ta.value = "";
    counter.textContent = `0 / ${MAX_QUESTION_LEN}`;
    sendBtn.disabled = true;
    // optimistically mark: the authority assigns the id, so we track our
    // own submitted text to highlight the matching row when it echoes back.
    myQuestionTexts.add(text);
  }

  /* shared question state, rendered by upvotes desc then recency. We key on the
     authority-assigned id. A viewer can upvote each question once (locked
     client-side too); own questions are highlighted. */
  const questions = new Map(); // id -> { id, text, ts, upvotes }
  const myUpvoted = new Set(); // ids this viewer has upvoted
  const myQuestionTexts = new Set(); // texts this viewer authored (for highlight)

  function upsertQuestion(q) {
    if (!q || !q.id) return;
    const prev = questions.get(q.id) || {};
    questions.set(q.id, {
      id: q.id,
      text: typeof q.text === "string" ? q.text : prev.text || "",
      ts: typeof q.ts === "number" ? q.ts : prev.ts || Date.now(),
      upvotes: typeof q.upvotes === "number" ? q.upvotes : prev.upvotes || 0,
    });
    renderQuestions();
  }

  function renderQuestions() {
    const items = Array.from(questions.values()).sort(
      (a, b) => b.upvotes - a.upvotes || a.ts - b.ts
    );
    qList.innerHTML = "";
    if (items.length === 0) {
      qList.appendChild(qEmpty);
      return;
    }
    for (const q of items) {
      const mine = myQuestionTexts.has(q.text);
      const upvoted = myUpvoted.has(q.id);
      const li = el("li", { class: "tz-qitem" + (mine ? " is-mine" : "") });
      const txt = el("span", { class: "tz-qitem__text" });
      txt.textContent = q.text; // textContent — never innerHTML on viewer input
      const vote = el(
        "button",
        {
          type: "button",
          class: "tz-upvote" + (upvoted ? " is-voted" : ""),
          "aria-pressed": String(upvoted),
          "aria-label": `Upvote (${q.upvotes})`,
          disabled: upvoted ? "" : false,
        },
        `${UPVOTE_SVG}<span class="tz-upvote__n">${q.upvotes}</span>`
      );
      if (!upvoted) {
        vote.addEventListener("click", () => {
          if (myUpvoted.has(q.id)) return;
          myUpvoted.add(q.id);
          transport.send({ t: "question-upvote", id: q.id });
          renderQuestions();
        });
      }
      li.append(txt, vote);
      qList.appendChild(li);
    }
  }

  /* ---------------- poll bottom-sheet ---------------- */
  const pollSheet = el("section", {
    class: "tz-sheet tz-poll",
    "aria-label": "Live poll",
    hidden: true,
  });
  zone.appendChild(pollSheet);

  let pollState = null; // last poll payload
  let votedOption = null; // this viewer's locked choice (index)

  function applyPoll(poll) {
    // No poll, or the authority signalled dismissal (presenter left the poll
    // slide): tear the sheet down and reset the vote lock for the next poll.
    if (!poll || poll.dismissed) {
      pollState = null;
      votedOption = null;
      pollSheet.hidden = true;
      pollSheet.classList.remove("is-open");
      return;
    }
    // a fresh poll id resets this viewer's vote lock
    if (!pollState || pollState.id !== poll.id) votedOption = null;
    pollState = poll;
    renderPoll();
  }

  function castVote(idx) {
    if (!pollState || !pollState.open || votedOption != null) return;
    votedOption = idx;
    transport.send({ t: "poll-vote", id: pollState.id, option: idx });
    renderPoll();
  }

  function renderPoll() {
    const poll = pollState;
    if (!poll) return;
    pollSheet.hidden = false;
    const total = poll.votes.reduce((a, b) => a + b, 0);
    const showResults = votedOption != null || !poll.open;

    pollSheet.innerHTML = "";
    const head = el("div", { class: "tz-sheet__head" });
    head.append(
      el("span", { class: "tz-sheet__title" }, "Live poll"),
      el(
        "span",
        { class: "tz-poll__live" + (poll.open ? " is-live" : "") },
        poll.open ? "OPEN" : "CLOSED"
      )
    );
    const q = el("p", { class: "tz-poll__q" });
    q.textContent = poll.q;
    pollSheet.append(head, q);

    poll.options.forEach((opt, i) => {
      const votes = poll.votes[i] || 0;
      const pct = total > 0 ? Math.round((votes / total) * 100) : 0;
      const btn = el("button", {
        type: "button",
        class: "tz-opt" + (votedOption === i ? " is-mine" : ""),
        disabled: votedOption != null || !poll.open ? "" : false,
      });
      const fill = el("span", { class: "tz-opt__fill", "aria-hidden": "true" });
      if (showResults) fill.style.transform = `scaleX(${pct / 100})`;
      const row = el("span", { class: "tz-opt__row" });
      const label = el("span", { class: "tz-opt__label" });
      label.textContent = opt;
      const pctEl = el("span", { class: "tz-opt__pct" }, showResults ? `${pct}%` : "");
      row.append(label, pctEl);
      btn.append(fill, row);
      if (votedOption == null && poll.open) {
        btn.addEventListener("click", () => castVote(i));
      }
      pollSheet.appendChild(btn);
    });

    const foot = el("div", { class: "tz-poll__foot" });
    foot.append(
      el("span", {}, `${total} vote${total === 1 ? "" : "s"}`),
      el(
        "span",
        {},
        poll.open ? (votedOption != null ? "Thanks!" : "Tap to vote") : "Final"
      )
    );
    pollSheet.appendChild(foot);
    requestAnimationFrame(() => pollSheet.classList.add("is-open"));
  }

  /* ---------------- transport subscriptions ---------------- */
  // reactions: fly ONLY authority fan-out (role:presenter) or our own echo,
  // so a peer's raw send is not double-counted (matches the follow filtering).
  on("reaction", (msg) => {
    // Render ONLY the authority fan-out (role:presenter). Our own raw send also
    // self-dispatches here (from===clientId, role:viewer); rendering that too
    // would double-fly our own reaction, since the authority echoes it back to
    // everyone including us. The local round-trip is instant.
    if (msg.role !== "presenter") return;
    flyReaction(msg.kind);
  });

  // The host announces host-online when it (re)boots. Say hello again so a
  // presenter refreshing the deck mid-talk does not drop us from the count,
  // and a viewer opened before the host still gets counted + hydrated.
  on("host-online", () => transport.send({ t: "hello" }));

  // presence carries the raised-hand count; reflect it on the hand toggle.
  function renderHands(hands) {
    const n = Math.max(0, Number(hands) || 0);
    const nEl = handBtn.querySelector(".tz-hand__n");
    if (n > 0) {
      nEl.hidden = false;
      nEl.textContent = String(n);
    } else {
      nEl.hidden = true;
    }
  }
  on("presence", (msg) => {
    if (msg.role !== "presenter") return;
    renderHands(msg.hands);
  });

  // questions: render only the authority's fan-out (carries id + upvotes).
  on("question", (msg) => {
    if (msg.role !== "presenter") return;
    upsertQuestion(msg);
  });

  // polls: render only the authority's fan-out.
  on("poll", (msg) => {
    if (msg.role !== "presenter") return;
    applyPoll(msg);
  });

  // full snapshot (hello reply / re-broadcast): hydrate poll + questions +
  // hands so a late joiner sees the current interaction state immediately.
  on("state", (msg) => {
    if (msg.to && msg.to !== clientId) return;
    if (msg.presence) renderHands(msg.presence.hands);
    // Pass null through so a snapshot with no active poll dismisses a stale sheet.
    applyPoll(msg.poll || null);
    if (Array.isArray(msg.questions)) {
      questions.clear();
      msg.questions.forEach((q) => {
        if (q && q.id) {
          questions.set(q.id, {
            id: q.id,
            text: q.text || "",
            ts: q.ts || Date.now(),
            upvotes: q.upvotes || 0,
          });
        }
      });
      renderQuestions();
    }
  });

  return {
    destroy() {
      for (const off of unsubs) {
        try {
          off();
        } catch {
          /* ignore */
        }
      }
      flyLayer.remove();
      zone.innerHTML = "";
    },
  };
}

/* ------------------------------------------------------------------
   loadDeck, resolve + import the deck module, mirroring index.html's
   guarded import so viewer.html stays a thin boot shell. Returns
   { deck, deckId }; falls back to the active deck on a bad id.
------------------------------------------------------------------ */
export async function loadDeck() {
  const deckId = resolveDeckId();
  let deck;
  try {
    ({ deck } = await import(`../../decks/${deckId}.deck.js`));
    return { deck, deckId };
  } catch (err) {
    console.error(
      `[viewer] could not load deck "${deckId}", falling back to ${ACTIVE_DECK}`,
      err
    );
    ({ deck } = await import(`../../decks/${ACTIVE_DECK}.deck.js`));
    return { deck, deckId: ACTIVE_DECK };
  }
}

/* Re-export render so viewer.html imports one module for the whole boot. */
export { renderDeck, manifest, ACTIVE_DECK };
