/* ============================================================
   engage/transport.js — the ENGAGE TRANSPORT abstraction.
   CHROME. The load-bearing seam of the whole Engage layer.
   ------------------------------------------------------------
   Every Engage feature imports ONLY this file. Flipping the
   backend is one line (PLATFORM-V2-CONCEPT.md §4.1):

     const transport = makeTransport(mode, { roomId, role, token, name, clientId });
     // mode resolved from ?engage=local|supabase|partykit (default: local)

   No feature code is rewritten when the backend changes. The
   message vocabulary collab.js and party/deck.ts already speak
   IS the Transport envelope, so ~90% of the wire protocol is
   already battle-tested.

   ── The envelope (§4.2) ──────────────────────────────────────
     { proto:1, t:<type>, room, from, role:'presenter'|'viewer',
       seq, ts, ...payload }
   send() stamps proto/room/from/role/seq/ts — callers pass only
   { t, ...payload }.

   ── The interface (§4.3, identical across all three adapters) ─
     makeTransport(mode, opts) -> Transport
     transport.connect(): Promise<void>
     transport.send(msg): void            // adapter stamps envelope
     transport.on(type, handler): unsubscribe
     transport.onStatus(cb)               // connecting|live|reconnecting|closed
     transport.presence(): { count, hands }
     transport.close()
     transport.mode                       // 'local'|'supabase'|'partykit'
     transport.isAuthority                // true in the deck (host) tab for local

   ── The three adapters (§4.4) ────────────────────────────────
     · BroadcastChannelTransport — DEFAULT. Buildable + testable
       NOW. Same-origin, cross-tab: BroadcastChannel('fmnts-engage:'
       +roomId) for live messages + a localStorage snapshot
       ('fmnts-engage-state:'+roomId) so late joiners and the
       Safari-iframe fallback hydrate. This is the exact pattern
       proven in presenter/deck-link.js, on a SEPARATE channel.
     · SupabaseRealtimeTransport — Wave 6. Stubbed here: warns once
       and falls back to local.
     · PartyKitTransport — Wave 6. Stubbed here: warns once and
       falls back to local.

   This file is CDN-free and buildless: no remote import, no
   remote string. The Supabase/PartyKit adapters are vendored
   locally when Wave 6 lands (see §4.4).
   ============================================================ */

import { createClient } from "../../vendor/supabase.mjs";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./supabase-config.js";

export const PROTO = 1; // bump if the envelope shape changes

/* Transport modes — the ?engage= values and the resolved set. */
const MODES = ["local", "supabase", "partykit"];
const DEFAULT_MODE = "local";

/* Connection status vocabulary (onStatus callback values). */
export const STATUS = Object.freeze({
  CONNECTING: "connecting",
  LIVE: "live",
  RECONNECTING: "reconnecting",
  CLOSED: "closed",
});

/* localStorage snapshot + BroadcastChannel name builders. Both are
   namespaced per room and DISTINCT from the presenter console's
   own "fmnts-deck" channel (deck-link.js) — the two never collide. */
const channelName = (roomId) => "fmnts-engage:" + roomId;
const snapshotKey = (roomId) => "fmnts-engage-state:" + roomId;

/* ------------------------------------------------------------------
   Mode discovery — resolve ?engage= into one of MODES. Anything
   unknown (or absent) resolves to the default local transport.
------------------------------------------------------------------ */
export function resolveMode(explicit) {
  const fromOpts =
    typeof explicit === "string" && MODES.includes(explicit) ? explicit : "";
  let fromQuery = "";
  try {
    const q = new URLSearchParams(location.search).get("engage") || "";
    if (MODES.includes(q)) fromQuery = q;
  } catch {
    /* no location (non-browser) — stay on default */
  }
  return fromOpts || fromQuery || DEFAULT_MODE;
}

/* ------------------------------------------------------------------
   A small stable client id. Callers SHOULD pass opts.clientId (the
   viewer surface persists one in sessionStorage to dedupe votes);
   if absent we mint an ephemeral one so `from` is never empty.
------------------------------------------------------------------ */
function ensureClientId(opts) {
  if (opts && typeof opts.clientId === "string" && opts.clientId.trim()) {
    return opts.clientId.trim();
  }
  return "c-" + Math.random().toString(36).slice(2, 10);
}

/* ==================================================================
   makeTransport(mode, opts) -> Transport
   ------------------------------------------------------------------
   opts: { roomId, role, token, name, clientId, authority }
     roomId    required — the room to join
     role      'presenter'|'viewer' (default viewer)
     authority true in the deck (host) tab for local — this tab runs
               authority.js and owns the canonical state. Callers who
               do not pass it fall back to (role === 'presenter').
   Unknown / not-yet-built modes warn ONCE and fall back to local, so
   a ?engage=supabase link degrades cleanly before Wave 6.
================================================================== */
export function makeTransport(mode, opts = {}) {
  const resolved = resolveMode(mode);
  const roomId = (opts.roomId || "").trim();

  if (!roomId) {
    // No room → a dead transport that no-ops. Keeps callers guard-free.
    return makeNullTransport();
  }

  const shared = {
    roomId,
    role: opts.role === "presenter" ? "presenter" : "viewer",
    token: opts.token || "",
    name: (opts.name || "").trim(),
    clientId: ensureClientId(opts),
    // authority defaults to "the presenter tab" for local, unless the
    // caller (the deck host) opts in explicitly.
    isAuthority:
      opts.authority === true ||
      (opts.authority == null && opts.role === "presenter"),
  };

  if (resolved === "supabase") {
    try {
      return new SupabaseRealtimeTransport(shared);
    } catch (err) {
      console.warn(
        "[transport] supabase adapter failed to initialise; falling back to local BroadcastChannel.",
        err
      );
      return new BroadcastChannelTransport(shared);
    }
  }
  if (resolved === "partykit") {
    console.warn(
      "[transport] partykit adapter arrives in Wave 6 (see PLATFORM-V2-CONCEPT.md §4.4); falling back to local BroadcastChannel."
    );
    return new BroadcastChannelTransport(shared);
  }
  return new BroadcastChannelTransport(shared);
}

/* ==================================================================
   BroadcastChannelTransport — the DEFAULT local adapter (§4.4).
   ------------------------------------------------------------------
   Same-origin, cross-tab. A BroadcastChannel carries every live
   message; a localStorage snapshot mirrors the last authoritative
   `state` so a late-joining tab (or a Safari iframe that missed the
   channel) can hydrate to the right slide/poll/questions.

   This is the exact shape presenter/deck-link.js uses, on a room-
   namespaced channel. It is a genuine second-screen transport
   (presenter laptop + presenter phone via a same-origin tunnel) and
   a local simulator; it is NOT a remote-audience transport, because
   same-origin cannot reach real phones on their own network. That
   limit is documented, not hidden (§4.4).
================================================================== */
class BroadcastChannelTransport {
  constructor(shared) {
    this.mode = "local";
    this.roomId = shared.roomId;
    this.role = shared.role;
    this.token = shared.token;
    this.name = shared.name;
    this.clientId = shared.clientId;
    this.isAuthority = shared.isAuthority;

    this._bc = null;
    this._seq = 0; // monotonically increasing per-sender sequence
    this._handlers = new Map(); // type -> Set<handler>
    this._statusCbs = new Set();
    this._status = STATUS.CONNECTING;
    this._presence = { count: 0, hands: 0 }; // last presence the authority told us
    this._closed = false;
    this._onBcMessage = this._onBcMessage.bind(this);
  }

  /* ---- connect: open the channel, flip to live, hydrate. -------- */
  connect() {
    if (this._closed) return Promise.resolve();
    this._setStatus(STATUS.CONNECTING);
    try {
      if (typeof BroadcastChannel !== "undefined") {
        this._bc = new BroadcastChannel(channelName(this.roomId));
        this._bc.addEventListener("message", this._onBcMessage);
      }
    } catch {
      this._bc = null; // no BroadcastChannel — snapshot-only hydration
    }
    // Local same-origin channel is "live" the instant it opens.
    this._setStatus(STATUS.LIVE);
    return Promise.resolve();
  }

  /* ---- send: stamp the full envelope, then post. ---------------
     Callers pass only { t, ...payload }. proto/room/from/role/seq/ts
     are stamped HERE so no feature code ever builds an envelope. ---- */
  send(msg) {
    if (this._closed || !msg || typeof msg.t !== "string") return;
    const envelope = {
      ...msg,
      proto: PROTO,
      room: this.roomId,
      from: this.clientId,
      role: this.role,
      seq: ++this._seq,
      ts: Date.now(),
    };
    try {
      if (this._bc) this._bc.postMessage(envelope);
    } catch {
      /* dropped frame — the next authoritative state resyncs us */
    }
    // Deliver to our OWN handlers too: BroadcastChannel never echoes to
    // the posting context, so a same-tab authority (deck host reducing
    // its own presenter messages) must see them locally.
    this._dispatch(envelope);
  }

  /* ---- on(type, handler) -> unsubscribe ------------------------- */
  on(type, handler) {
    if (typeof type !== "string" || typeof handler !== "function") {
      return () => {};
    }
    let set = this._handlers.get(type);
    if (!set) {
      set = new Set();
      this._handlers.set(type, set);
    }
    set.add(handler);
    return () => {
      const s = this._handlers.get(type);
      if (s) s.delete(handler);
    };
  }

  /* ---- onStatus(cb): connecting|live|reconnecting|closed -------- */
  onStatus(cb) {
    if (typeof cb !== "function") return () => {};
    this._statusCbs.add(cb);
    // fire immediately with the current status so callers sync up
    try {
      cb(this._status);
    } catch {
      /* ignore a throwing status callback */
    }
    return () => this._statusCbs.delete(cb);
  }

  /* ---- presence(): last {count, hands} the authority published --- */
  presence() {
    return { count: this._presence.count, hands: this._presence.hands };
  }

  /* ---- close: tear down the channel, mark closed. --------------- */
  close() {
    if (this._closed) return;
    this._closed = true;
    if (this._bc) {
      try {
        this._bc.removeEventListener("message", this._onBcMessage);
        this._bc.close();
      } catch {
        /* ignore */
      }
    }
    this._bc = null;
    this._setStatus(STATUS.CLOSED);
    this._handlers.clear();
  }

  /* ---- hydrate(): read the localStorage snapshot, if any. -------
     Returns the last authoritative `state` envelope (or null). A late
     joiner calls this to jump straight to the right slide before its
     `hello` round-trips. The authority writes the snapshot on every
     state change via snapshot(); a viewer only reads it. ---- */
  hydrate() {
    try {
      const raw = localStorage.getItem(snapshotKey(this.roomId));
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed && parsed.proto === PROTO && parsed.t === "state") {
        if (parsed.presence) this._presence = parsed.presence;
        return parsed;
      }
    } catch {
      /* corrupt / absent snapshot — caller falls back to `hello` */
    }
    return null;
  }

  /* ---- snapshot(stateEnvelope): persist the last `state`. -------
     The AUTHORITY calls this whenever it broadcasts a full `state`, so
     the next late joiner hydrates without waiting on a round-trip and
     a Safari iframe that missed the live channel still lands right.

     The host passes the reducer's un-stamped emit ({ t:'state', ... });
     we stamp proto/room here so the persisted object is a complete,
     version-guarded envelope that hydrate() accepts. A per-client `to`
     is stripped so the snapshot is not accidentally addressed. --- */
  snapshot(stateEnvelope) {
    if (!stateEnvelope || stateEnvelope.t !== "state") return;
    const { to, ...rest } = stateEnvelope;
    const persisted = { ...rest, proto: PROTO, room: this.roomId };
    try {
      localStorage.setItem(snapshotKey(this.roomId), JSON.stringify(persisted));
    } catch {
      /* storage full / disabled — live channel still carries state */
    }
  }

  /* ================= internals ================= */
  _onBcMessage(ev) {
    const d = ev && ev.data;
    if (!d || d.proto !== PROTO || typeof d.t !== "string") return;
    if (d.room && d.room !== this.roomId) return; // stray room — ignore
    this._dispatch(d);
  }

  _dispatch(envelope) {
    // Track presence locally so presence() is always answerable, even
    // for a viewer that only ever receives (never authors) presence.
    if (envelope.t === "presence") {
      this._presence = {
        count: Number(envelope.count) || 0,
        hands: Number(envelope.hands) || 0,
      };
    } else if (envelope.t === "state" && envelope.presence) {
      this._presence = envelope.presence;
    }
    const set = this._handlers.get(envelope.t);
    if (!set || set.size === 0) return;
    // copy so a handler that unsubscribes mid-dispatch is safe
    for (const h of Array.from(set)) {
      try {
        h(envelope);
      } catch (err) {
        console.warn("[transport] handler for", envelope.t, "threw", err);
      }
    }
  }

  _setStatus(next) {
    if (this._status === next) return;
    this._status = next;
    for (const cb of Array.from(this._statusCbs)) {
      try {
        cb(next);
      } catch {
        /* ignore a throwing status callback */
      }
    }
  }
}

/* ==================================================================
   SupabaseRealtimeTransport — the REMOTE adapter (?engage=supabase).
   ------------------------------------------------------------------
   Satisfies the SAME interface as BroadcastChannelTransport
   (connect/send/on/onStatus/presence/close/.mode/.isAuthority) so NO
   Engage feature code changes when the backend flips.

   Wire model — one Realtime channel per room:
     · Broadcast carries every live message. self:true makes the
       channel echo the sender's own broadcast back, MATCHING the
       local adapter's self-dispatch (send() there self-delivers, and
       the authority reducer relies on that echo to break its own loop
       via the `from === clientId` guard in collab.js).
     · Native Presence tracks live viewers. On every presence sync we
       recompute { count, hands } from presenceState() and hand it to
       local handlers as a `presence` frame, mirroring what the local
       host publishes. count = number of VIEWER presences; hands =
       viewers with hand:true.

   The presenter deck stays the AUTHORITY: it still runs authority.js,
   reduces inbound viewer verbs, and re-broadcasts `state`/`presence`
   fan-out — which Supabase Broadcast delivers to everyone (incl. self
   via self:true). Late joiners hydrate via the authority's
   hello -> to-addressed `state` reply, exactly as on local, so
   hydrate()/snapshot() stay local-only conveniences (kept for the
   optional viewer.js hydrate() call; harmless for supabase).
================================================================== */

/* Module singleton — one client for the whole page (a page is either a
   deck tab or a viewer tab, never both). createClient is cheap but the
   client owns a WebSocket, so we share one across any transports the
   page builds. */
let _sbClient = null;
function supabaseClient() {
  if (_sbClient) return _sbClient;
  _sbClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _sbClient;
}

class SupabaseRealtimeTransport {
  constructor(shared) {
    this.mode = "supabase";
    this.roomId = shared.roomId;
    this.role = shared.role;
    this.token = shared.token;
    this.name = shared.name;
    this.clientId = shared.clientId;
    this.isAuthority = shared.isAuthority;
    // Supabase owns the live count + raised hands via native Presence, so the
    // deck host must NOT run its own by-hand presence bookkeeping (collab.js
    // reads this flag and stands down). The local adapter leaves it unset.
    this.tracksPresenceNatively = true;

    this._client = null;
    this._channel = null;
    this._seq = 0; // monotonically increasing per-sender sequence
    this._handlers = new Map(); // type -> Set<handler>
    this._statusCbs = new Set();
    this._status = STATUS.CONNECTING;
    this._presence = { count: 0, hands: 0 }; // derived from native presence
    this._handOn = false; // this viewer's own raised-hand flag (tracked)
    this._closed = false;
    this._boundBroadcast = null; // wildcard broadcast unsubscribe (via channel.on)
  }

  /* ---- connect: open the channel, subscribe, resolve on SUBSCRIBED. */
  connect() {
    if (this._closed) return Promise.resolve();
    this._setStatus(STATUS.CONNECTING);

    let client;
    try {
      client = supabaseClient();
    } catch (err) {
      // No client — a dead-but-safe transport; report closed and resolve
      // so callers never hang.
      console.warn("[transport] supabase client unavailable", err);
      this._setStatus(STATUS.CLOSED);
      return Promise.resolve();
    }
    this._client = client;

    // self:true so we receive our OWN broadcasts (local-adapter parity).
    // presence.key keys this peer's presence by its stable clientId.
    this._channel = client.channel(channelName(this.roomId), {
      config: {
        broadcast: { self: true },
        presence: { key: this.clientId },
      },
    });

    // Fan every broadcast event out to our typed handlers. We register a
    // single wildcard-ish listener per event lazily in on(); but Supabase
    // filters broadcast by event name, so we instead subscribe to each
    // event as handlers are added (see _ensureEvent). Presence is wired
    // here, once.
    this._channel.on("presence", { event: "sync" }, () => this._syncPresence());
    this._channel.on("presence", { event: "join" }, () => this._syncPresence());
    this._channel.on("presence", { event: "leave" }, () =>
      this._syncPresence()
    );

    // Re-register any event handlers that on() recorded before connect().
    for (const type of this._handlers.keys()) this._ensureEvent(type);

    return new Promise((resolve) => {
      let resolved = false;
      try {
        this._channel.subscribe((status) => {
          if (this._closed) return;
          if (status === "SUBSCRIBED") {
            this._setStatus(STATUS.LIVE);
            // Track our presence so the count is native. Viewers count;
            // the presenter (authority) also tracks so a viewer never
            // mistakes the host for a peer only if it filters role — but
            // to keep count = viewers, the presenter marks role:'presenter'
            // and _syncPresence excludes it.
            this._trackSelf();
            if (!resolved) {
              resolved = true;
              resolve();
            }
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            this._setStatus(STATUS.RECONNECTING);
          } else if (status === "CLOSED") {
            this._setStatus(STATUS.CLOSED);
            if (!resolved) {
              resolved = true;
              resolve();
            }
          }
        });
      } catch (err) {
        console.warn("[transport] supabase subscribe failed", err);
        this._setStatus(STATUS.CLOSED);
        if (!resolved) {
          resolved = true;
          resolve();
        }
      }
    });
  }

  /* ---- send: stamp the full envelope, then broadcast. -----------
     Callers pass only { t, ...payload }. The stamping is IDENTICAL to
     the local adapter so the envelope shape is wire-compatible. On
     Supabase self:true echoes it back to us too, so we do NOT locally
     self-dispatch here (that would double-deliver). ----------------- */
  send(msg) {
    if (this._closed || !msg || typeof msg.t !== "string") return;
    const envelope = {
      ...msg,
      proto: PROTO,
      room: this.roomId,
      from: this.clientId,
      role: this.role,
      seq: ++this._seq,
      ts: Date.now(),
    };

    // A viewer raising/lowering a hand ALSO updates its native presence so
    // the count is authoritative from presenceState(). The `hand` message
    // still goes on the wire so authority.js stays consistent.
    if (this.role === "viewer" && msg.t === "hand") {
      this._handOn = msg.on === true;
      this._trackSelf();
    }

    if (!this._channel) return;
    try {
      this._channel.send({
        type: "broadcast",
        event: envelope.t,
        payload: envelope,
      });
    } catch {
      /* dropped frame — the next authoritative state resyncs us */
    }
  }

  /* ---- on(type, handler) -> unsubscribe ------------------------- */
  on(type, handler) {
    if (typeof type !== "string" || typeof handler !== "function") {
      return () => {};
    }
    let set = this._handlers.get(type);
    if (!set) {
      set = new Set();
      this._handlers.set(type, set);
      // Wire the broadcast event for this type (idempotent) so the frame
      // reaches _dispatch. Safe before connect (re-run in connect()).
      this._ensureEvent(type);
    }
    set.add(handler);
    return () => {
      const s = this._handlers.get(type);
      if (s) s.delete(handler);
    };
  }

  /* ---- onStatus(cb): connecting|live|reconnecting|closed -------- */
  onStatus(cb) {
    if (typeof cb !== "function") return () => {};
    this._statusCbs.add(cb);
    try {
      cb(this._status);
    } catch {
      /* ignore a throwing status callback */
    }
    return () => this._statusCbs.delete(cb);
  }

  /* ---- presence(): last { count, hands } from native presence --- */
  presence() {
    return { count: this._presence.count, hands: this._presence.hands };
  }

  /* ---- hydrate()/snapshot(): no-ops for supabase. Late joiners
     hydrate via the authority's hello -> `state` reply. Kept so the
     optional transport.hydrate() call in viewer.js is a safe no-op. */
  hydrate() {
    return null;
  }
  snapshot() {
    /* authority re-broadcasts `state`; no local persistence needed */
  }

  /* ---- close: untrack, unsubscribe, mark closed. ---------------- */
  close() {
    if (this._closed) return;
    this._closed = true;
    if (this._channel) {
      try {
        this._channel.untrack();
      } catch {
        /* ignore */
      }
      try {
        this._channel.unsubscribe();
      } catch {
        /* ignore */
      }
      if (this._client) {
        try {
          this._client.removeChannel(this._channel);
        } catch {
          /* ignore */
        }
      }
    }
    this._channel = null;
    this._setStatus(STATUS.CLOSED);
    this._handlers.clear();
  }

  /* ================= internals ================= */

  /* Register the Supabase broadcast listener for one event type. The
     channel filters by event name, so we add one listener per type the
     first time a handler for it appears. Guarded so it only wires once
     the channel exists (connect() replays the set). */
  _ensureEvent(type) {
    if (!this._channel) return;
    const wired = this._wiredEvents || (this._wiredEvents = new Set());
    if (wired.has(type)) return;
    wired.add(type);
    try {
      this._channel.on("broadcast", { event: type }, ({ payload }) =>
        this._dispatch(payload)
      );
    } catch {
      wired.delete(type);
    }
  }

  /* Track this peer's presence. Viewers count toward `count`; the
     presenter marks role:'presenter' so _syncPresence can exclude the
     host from the viewer count. hand only applies to viewers. */
  _trackSelf() {
    if (!this._channel) return;
    try {
      this._channel.track({
        clientId: this.clientId,
        role: this.role,
        hand: this.role === "viewer" ? this._handOn === true : false,
      });
    } catch {
      /* presence unavailable — count degrades to 0, still functional */
    }
  }

  /* Derive { count, hands } from native presenceState() and publish a
     `presence` frame to LOCAL handlers, mirroring the local host. We
     stamp role:'presenter' because both viewer.js and collab.js accept
     a presence frame only when role === 'presenter'; this frame never
     goes on the wire (it is a local dispatch only), so stamping it as
     the authoritative presence is correct and keeps feature code
     untouched. */
  _syncPresence() {
    if (!this._channel) return;
    let count = 0;
    let hands = 0;
    try {
      const stateMap = this._channel.presenceState() || {};
      for (const key in stateMap) {
        const metas = stateMap[key];
        if (!Array.isArray(metas) || metas.length === 0) continue;
        // one entry per key; take the first meta as the live presence
        const meta = metas[0];
        if (meta && meta.role === "presenter") continue; // host is not a viewer
        count += 1;
        if (meta && meta.hand === true) hands += 1;
      }
    } catch {
      /* presenceState unavailable — leave prior values */
      return;
    }
    this._presence = { count, hands };
    // Deliver to local handlers as an authority-shaped presence frame.
    this._dispatch({
      proto: PROTO,
      t: "presence",
      room: this.roomId,
      from: this.clientId,
      role: "presenter",
      count,
      hands,
      ts: Date.now(),
    });
  }

  _dispatch(envelope) {
    if (!envelope || envelope.proto !== PROTO || typeof envelope.t !== "string")
      return;
    if (envelope.room && envelope.room !== this.roomId) return;
    // Keep presence() answerable even when the frame is authority-authored.
    if (envelope.t === "presence") {
      this._presence = {
        count: Number(envelope.count) || 0,
        hands: Number(envelope.hands) || 0,
      };
    } else if (envelope.t === "state" && envelope.presence) {
      this._presence = envelope.presence;
    }
    const set = this._handlers.get(envelope.t);
    if (!set || set.size === 0) return;
    for (const h of Array.from(set)) {
      try {
        h(envelope);
      } catch (err) {
        console.warn("[transport] handler for", envelope.t, "threw", err);
      }
    }
  }

  _setStatus(next) {
    if (this._status === next) return;
    this._status = next;
    for (const cb of Array.from(this._statusCbs)) {
      try {
        cb(next);
      } catch {
        /* ignore a throwing status callback */
      }
    }
  }
}

/* ------------------------------------------------------------------
   Null transport — returned when there is no room. Every method is a
   safe no-op so callers never have to guard `if (transport)`.
------------------------------------------------------------------ */
function makeNullTransport() {
  return {
    mode: "local",
    isAuthority: false,
    connect: () => Promise.resolve(),
    send: () => {},
    on: () => () => {},
    onStatus: (cb) => {
      if (typeof cb === "function") {
        try {
          cb(STATUS.CLOSED);
        } catch {
          /* ignore */
        }
      }
      return () => {};
    },
    presence: () => ({ count: 0, hands: 0 }),
    hydrate: () => null,
    snapshot: () => {},
    close: () => {},
  };
}

export default makeTransport;
