/* ============================================================
   engage/authority.js — the ENGAGE REDUCER (the single choke point).
   CHROME. Ported from party/deck.ts validation (PLATFORM-V2-CONCEPT §4.3).
   ------------------------------------------------------------
   The one place inbound Engage messages are validated and turned
   into canonical state. It runs:
     · in the deck (host) tab for the local BroadcastChannel transport,
     · in the presenter's session for Supabase (Wave 6),
     · already server-side in party/deck.ts for PartyKit.

   It is PURE-ISH: reduce(state, msg) -> { state, emit:[messages] }.
   It never touches the DOM, the network, or the clock beyond a
   timestamp; the host wires `emit` to transport.send and re-broadcasts
   `state`. That keeps the trust boundary in exactly one file.

   NON-NEGOTIABLE CONTRACTS (mirrors party/deck.ts):
   - Validate every inbound message: JSON already parsed by transport;
     here we whitelist reaction kinds, cap question length (~280),
     strip control chars, enforce one-vote-per-poll per clientId, and
     bound poll options.
   - IGNORE presenter-only messages (set-slide, pointer, poll-open,
     poll-close, word-open, word-close) from viewers. Authority never
     trusts a hidden button; it checks the sender's role on the envelope.

   Emitted messages are { t, ...payload } — the host stamps the
   full envelope (proto/room/from/role/seq/ts) on send.
   ============================================================ */

/* ---- Reactions: fixed ON-BRAND whitelist (NO emoji). Mirrors
   party/deck.ts and collab.js exactly. Red is excluded on purpose
   (rare stopper). Anything off this list is dropped. ---- */
export const REACTION_KINDS = ["spark", "up", "clap", "eyes", "plus"];
function isReactionKind(v) {
  return typeof v === "string" && REACTION_KINDS.includes(v);
}

/* ---- Limits (named — no magic numbers at call sites) ---------
   Question cap is ~280 per the Wave 2 brief (party/deck.ts used 240;
   the concept widened it). The rest mirror party/deck.ts. ---- */
const MAX_QUESTION_LEN = 280;
const MAX_QUESTIONS = 60; // ring-buffer cap so state stays bounded
const MAX_NAME_LEN = 40;
const MAX_POLL_OPTIONS = 6;
const MIN_POLL_OPTIONS = 2;
const MAX_POLL_OPTION_LEN = 80;
const MAX_POLL_QUESTION_LEN = 160;
const MAX_ID_LEN = 80;
const MAX_WORD_LEN = 40;
const MAX_WORDCLOUD_TOKENS = 80; // distinct tokens tallied
const MAX_TOKEN_TALLY = 100000; // hard ceiling on any single token count

/* ---- Per-clientId rate limiting (Wave 4 security brief) --------
   Anonymous phones can flood the room; a misbehaving (or malicious)
   client must not be able to spam reactions/questions/words faster
   than a human plausibly would. A simple token bucket per clientId,
   refilled continuously, caps the sustained rate while still allowing
   a short natural burst (tapping the reaction bar quickly). Presenter-
   authored control verbs are NOT rate-limited here (the presenter is
   trusted; their volume is throttled at the source in collab.js). */
const RATE_BURST = 12; // max tokens a client can bank (a quick flurry)
const RATE_REFILL_PER_SEC = 5; // sustained rate once the burst is spent
const RATE_MAX_CLIENTS = 500; // bound the bucket store so state stays finite

/* Verbs a viewer authors that we meter. `hello`/`bye` are lifecycle and
   exempt so a late joiner always hydrates; presenter-only verbs never
   reach the metered path (they are role-gated before it). */
const RATE_LIMITED = new Set([
  "reaction",
  "hand",
  "question",
  "question-upvote",
  "poll-vote",
  "word",
  "vpointer",
]);

/* takeToken — continuous-refill token bucket keyed by clientId. Returns
   true if the client had a token to spend (message allowed), false if it
   is over its rate (message silently dropped). Mutates state._rate, which
   is bookkeeping only and never leaves the authority (stripped from every
   snapshot, exactly like _votes/_hands). */
function takeToken(state, clientId, now) {
  if (!clientId) return true; // no id → cannot meter; let it through (rare)
  const store = state._rate || (state._rate = Object.create(null));
  let b = store[clientId];
  if (!b) {
    // Bound the store: if we are tracking too many clients, evict the
    // stalest bucket so a churn of one-off ids cannot grow state without end.
    const ids = Object.keys(store);
    if (ids.length >= RATE_MAX_CLIENTS) {
      let oldestId = ids[0];
      let oldestTs = store[oldestId].ts;
      for (const id of ids) {
        if (store[id].ts < oldestTs) {
          oldestTs = store[id].ts;
          oldestId = id;
        }
      }
      delete store[oldestId];
    }
    b = store[clientId] = { tokens: RATE_BURST, ts: now };
  }
  // refill by elapsed time, capped at the burst ceiling
  const elapsed = Math.max(0, (now - b.ts) / 1000);
  b.tokens = Math.min(RATE_BURST, b.tokens + elapsed * RATE_REFILL_PER_SEC);
  b.ts = now;
  if (b.tokens < 1) return false;
  b.tokens -= 1;
  return true;
}

/* C0 + C1 control chars, built from printable-ASCII escapes on
   purpose so no raw control byte ever lives in this file. */
const CONTROL_CHARS = new RegExp("[\\x00-\\x1F\\x7F-\\x9F]+", "g");

/* ---- Small guards (mirror party/deck.ts) ---- */
function isRecord(v) {
  return typeof v === "object" && v !== null;
}
function asInt(v) {
  return typeof v === "number" && Number.isFinite(v) ? Math.trunc(v) : null;
}
function cleanStr(v, max) {
  if (typeof v !== "string") return "";
  return v.replace(CONTROL_CHARS, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

/* A simple incrementing id source that needs no crypto dependency
   (crypto.randomUUID is not guaranteed in every embed). Namespaced
   so ids never collide with poll ids the presenter supplies. */
let _idSeq = 0;
function nextId(prefix) {
  _idSeq += 1;
  return prefix + "-" + Date.now().toString(36) + "-" + _idSeq.toString(36);
}

/* ==================================================================
   Canonical state
   ------------------------------------------------------------------
   Held by the host and handed to reduce() each message. Ephemeral
   fan-out (reaction, pointer, vpointer) is NOT stored as history —
   only aggregate counters live here (reactionsTotal, wordcloud
   tallies). Slide, poll, and questions ARE authoritative so late
   joiners hydrate correctly.
================================================================== */
export function freshState() {
  return {
    slide: { h: 0, v: 0, id: "" },
    presence: { count: 0, hands: 0 }, // recomputed by the host from live peers
    poll: null, // { id, q, options[], votes[], open }
    questions: [], // [{ id, text, ts, upvotes }]
    reactionsTotal: 0, // aggregate counter (ephemeral fan-out is not stored)
    wordcloud: null, // { id, prompt, open, tokens: { <token>: count } }
    // per-clientId vote locks: pollId -> Set<clientId> (kept out of the
    // snapshot; rebuilt naturally as votes arrive after a poll opens).
    _votes: {},
    // per-clientId hand set, so presence hands survive a recompute from
    // messages when the transport cannot enumerate live peers.
    _hands: {},
    // per-clientId token buckets for rate limiting (bookkeeping only; never
    // snapshotted, exactly like _votes/_hands).
    _rate: {},
  };
}

/* Build the authoritative `state` payload a client hydrates from.
   Internal bookkeeping (_votes, _hands) is stripped. */
export function stateSnapshot(state) {
  return {
    t: "state",
    slide: state.slide,
    presence: state.presence,
    poll: pollPayload(state.poll),
    questions: state.questions.map((q) => ({
      id: q.id,
      text: q.text,
      ts: q.ts,
      upvotes: q.upvotes || 0,
    })),
    reactionsTotal: state.reactionsTotal,
    wordcloud: wordcloudPayload(state.wordcloud),
  };
}

function pollPayload(poll) {
  if (!poll) return null;
  return {
    id: poll.id,
    q: poll.q,
    options: poll.options,
    votes: poll.votes,
    open: poll.open,
  };
}

function wordcloudPayload(wc) {
  if (!wc) return null;
  // emit tokens as a flat { token: count } map, ordered by count desc
  // and capped, so the viewer renders a bounded cloud.
  const entries = Object.entries(wc.tokens || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_WORDCLOUD_TOKENS);
  return { id: wc.id, prompt: wc.prompt, open: wc.open, tokens: entries };
}

/* ==================================================================
   reduce(state, msg) -> { state, emit:[ {t,...payload} ] }
   ------------------------------------------------------------------
   msg is a validated-envelope-shaped object; we still treat every
   field as untrusted. `msg.role` is the SENDER's role on the wire —
   presenter-only messages from a viewer are IGNORED here (never trust
   a hidden button). `msg.from` is the sender clientId (vote dedupe).

   The host mutates nothing itself; it takes the returned state as the
   new canonical state and sends each emit. State is treated as owned
   by the reducer (mutated in place for the counters that party/deck.ts
   also mutates), but the returned reference is what the host keeps.
================================================================== */
export function reduce(state, msg) {
  const emit = [];
  if (!isRecord(msg) || typeof msg.t !== "string") return { state, emit };

  const isPresenter = msg.role === "presenter";
  const from = typeof msg.from === "string" ? msg.from : "";

  // Per-clientId rate limiting: meter abusable VIEWER verbs before they touch
  // canonical state. The presenter (trusted) is exempt; lifecycle verbs
  // (hello/bye) are never metered so hydration and clean leave always work.
  // A dropped message returns unchanged state with no emit (silent, no error
  // leak). Uses msg.ts (the transport stamps it) so the meter is deterministic.
  if (!isPresenter && RATE_LIMITED.has(msg.t)) {
    const now = typeof msg.ts === "number" ? msg.ts : Date.now();
    if (!takeToken(state, from, now)) return { state, emit };
  }

  switch (msg.t) {
    /* ---- Presenter-only: drive the deck ---- */
    case "set-slide": {
      if (!isPresenter) return { state, emit }; // authority-enforced
      const h = asInt(msg.h);
      const v = asInt(msg.v);
      if (h === null || v === null || h < 0 || v < 0) return { state, emit };
      state.slide = { h, v, id: cleanStr(msg.id, MAX_ID_LEN) };
      emit.push({ t: "slide", h, v, id: state.slide.id });
      return { state, emit };
    }

    /* ---- Presenter-only: pointer relay (ephemeral, normalized 0..1) ---- */
    case "pointer": {
      if (!isPresenter) return { state, emit };
      const x = typeof msg.x === "number" ? clamp01(msg.x) : null;
      const y = typeof msg.y === "number" ? clamp01(msg.y) : null;
      if (x === null || y === null) return { state, emit };
      emit.push({ t: "pointer", x, y, visible: msg.visible === true });
      return { state, emit };
    }

    /* ---- Anyone: on-brand reaction (aggregate + fan-out) ---- */
    case "reaction": {
      if (!isReactionKind(msg.kind)) return { state, emit }; // whitelist
      state.reactionsTotal += 1;
      emit.push({ t: "reaction", kind: msg.kind }); // relay to ALL
      return { state, emit };
    }

    /* ---- Viewer: raise / lower hand (drives presence hands) ---- */
    case "hand": {
      if (isPresenter) return { state, emit }; // presenter has no hand
      if (!from) return { state, emit };
      const on = msg.on === true;
      const had = !!state._hands[from];
      if (had === on) return { state, emit }; // no change
      if (on) state._hands[from] = true;
      else delete state._hands[from];
      recomputeHands(state);
      emit.push({
        t: "presence",
        count: state.presence.count,
        hands: state.presence.hands,
      });
      return { state, emit };
    }

    /* ---- Viewer: ask a question (ring-buffered) ---- */
    case "question": {
      const text = cleanStr(msg.text, MAX_QUESTION_LEN);
      if (!text) return { state, emit };
      const q = { id: nextId("q"), text, ts: Date.now(), upvotes: 0 };
      state.questions.push(q);
      if (state.questions.length > MAX_QUESTIONS) {
        state.questions = state.questions.slice(-MAX_QUESTIONS);
      }
      emit.push({ t: "question", id: q.id, text: q.text, ts: q.ts, upvotes: 0 });
      return { state, emit };
    }

    /* ---- Anyone: upvote a standing question (one per clientId) ---- */
    case "question-upvote": {
      const id = cleanStr(msg.id, MAX_ID_LEN);
      if (!id || !from) return { state, emit };
      const q = state.questions.find((x) => x.id === id);
      if (!q) return { state, emit };
      if (!q.voters) q.voters = {};
      if (q.voters[from]) return { state, emit }; // already upvoted
      q.voters[from] = true;
      q.upvotes = (q.upvotes || 0) + 1;
      emit.push({ t: "question", id: q.id, text: q.text, ts: q.ts, upvotes: q.upvotes });
      return { state, emit };
    }

    /* ---- Presenter-only: open a poll ---- */
    case "poll-open": {
      if (!isPresenter) return { state, emit };
      const q = cleanStr(msg.q, MAX_POLL_QUESTION_LEN);
      const rawOpts = Array.isArray(msg.options) ? msg.options : [];
      const options = rawOpts
        .map((o) => cleanStr(o, MAX_POLL_OPTION_LEN))
        .filter((o) => o.length > 0)
        .slice(0, MAX_POLL_OPTIONS);
      if (!q || options.length < MIN_POLL_OPTIONS) return { state, emit };
      const id = cleanStr(msg.id, MAX_ID_LEN) || nextId("poll");
      state.poll = {
        id,
        q,
        options,
        votes: new Array(options.length).fill(0),
        open: true,
      };
      state._votes[id] = Object.create(null); // fresh vote-lock set
      emit.push({ t: "poll", ...pollPayload(state.poll) });
      return { state, emit };
    }

    /* ---- Anyone (typically viewer): cast one vote per poll ---- */
    case "poll-vote": {
      const poll = state.poll;
      if (!poll || !poll.open) return { state, emit };
      if (cleanStr(msg.id, MAX_ID_LEN) !== poll.id) return { state, emit }; // stale
      const idx = asInt(msg.option);
      if (idx === null || idx < 0 || idx >= poll.options.length) {
        return { state, emit };
      }
      if (!from) return { state, emit };
      const locks = state._votes[poll.id] || (state._votes[poll.id] = Object.create(null));
      if (locks[from]) return { state, emit }; // one vote per clientId per poll
      locks[from] = true;
      poll.votes[idx] += 1;
      emit.push({ t: "poll", ...pollPayload(poll) });
      return { state, emit };
    }

    /* ---- Presenter-only: close the poll (keeps final tally) ---- */
    case "poll-close": {
      if (!isPresenter) return { state, emit };
      const poll = state.poll;
      if (!poll) return { state, emit };
      if (cleanStr(msg.id, MAX_ID_LEN) !== poll.id) return { state, emit };
      // Closing happens when the presenter LEAVES the poll slide, so clear the
      // poll entirely and signal dismissal. Viewers tear down the sheet and
      // late joiners hydrate to no stale poll. Live results were visible on the
      // deck and on voters' phones the whole time the slide was up.
      const closedId = poll.id;
      state.poll = null;
      emit.push({ t: "poll", id: closedId, open: false, dismissed: true });
      return { state, emit };
    }

    /* ---- Presenter-only: open a word cloud ---- */
    case "word-open": {
      if (!isPresenter) return { state, emit };
      const prompt = cleanStr(msg.prompt, MAX_POLL_QUESTION_LEN);
      if (!prompt) return { state, emit };
      const id = cleanStr(msg.id, MAX_ID_LEN) || nextId("word");
      state.wordcloud = { id, prompt, open: true, tokens: Object.create(null) };
      emit.push({ t: "wordcloud", ...wordcloudPayload(state.wordcloud) });
      return { state, emit };
    }

    /* ---- Viewer: submit a word token (tallied) ---- */
    case "word": {
      const wc = state.wordcloud;
      if (!wc || !wc.open) return { state, emit };
      // normalize to lower-case, strip control chars, cap length so the
      // cloud aggregates "Team" and "team" together.
      const token = cleanStr(msg.token, MAX_WORD_LEN).toLowerCase();
      if (!token) return { state, emit };
      const existing = Object.keys(wc.tokens).length;
      // only admit a NEW token if we are under the distinct-token cap;
      // already-seen tokens always tally up.
      if (!(token in wc.tokens) && existing >= MAX_WORDCLOUD_TOKENS) {
        return { state, emit };
      }
      const next = (wc.tokens[token] || 0) + 1;
      wc.tokens[token] = Math.min(next, MAX_TOKEN_TALLY);
      emit.push({ t: "wordcloud", ...wordcloudPayload(wc) });
      return { state, emit };
    }

    /* ---- Presenter-only: close the word cloud ---- */
    case "word-close": {
      if (!isPresenter) return { state, emit };
      const wc = state.wordcloud;
      if (!wc) return { state, emit };
      if (cleanStr(msg.id, MAX_ID_LEN) !== wc.id) return { state, emit };
      wc.open = false;
      emit.push({ t: "wordcloud", ...wordcloudPayload(wc) });
      return { state, emit };
    }

    /* ---- Viewer pointer (ephemeral fan-out, normalized 0..1) ---- */
    case "vpointer": {
      const x = typeof msg.x === "number" ? clamp01(msg.x) : null;
      const y = typeof msg.y === "number" ? clamp01(msg.y) : null;
      if (x === null || y === null) return { state, emit };
      emit.push({ t: "vpointer", from, x, y, visible: msg.visible === true });
      return { state, emit };
    }

    /* ---- Late joiner asks for the current state ---- */
    case "hello": {
      // Reply with a full authoritative snapshot ONLY to the asker.
      // The host is responsible for addressing (BroadcastChannel fans out
      // to all; a `to` field lets clients ignore snapshots not for them).
      emit.push({ ...stateSnapshot(state), to: from || undefined });
      return { state, emit };
    }

    default:
      return { state, emit }; // unknown type — ignore
  }
}

/* ------------------------------------------------------------------
   Presence — the host owns the live count (it can enumerate peers on
   some transports). setPresence lets the host inject a fresh count,
   after which recomputeHands keeps the hands tally consistent with the
   authoritative _hands set. Both return the presence `emit` for the
   host to broadcast.
------------------------------------------------------------------ */
export function setPresenceCount(state, count) {
  state.presence.count = Math.max(0, asInt(count) || 0);
  recomputeHands(state);
  return {
    t: "presence",
    count: state.presence.count,
    hands: state.presence.hands,
  };
}

function recomputeHands(state) {
  let hands = 0;
  for (const k in state._hands) if (state._hands[k]) hands += 1;
  state.presence.hands = hands;
}

/* Drop a departed client's hand + vote locks so presence self-heals
   when a viewer leaves (the host calls this on a peer-gone signal). */
export function dropClient(state, clientId) {
  if (!clientId) return null;
  // free the rate bucket so a departed client's slot is reclaimed
  if (state._rate && state._rate[clientId]) delete state._rate[clientId];
  let changed = false;
  if (state._hands[clientId]) {
    delete state._hands[clientId];
    changed = true;
  }
  if (!changed) return null;
  recomputeHands(state);
  return {
    t: "presence",
    count: state.presence.count,
    hands: state.presence.hands,
  };
}

function clamp01(n) {
  return Math.min(1, Math.max(0, n));
}
