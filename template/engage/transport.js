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
    console.warn(
      "[transport] supabase adapter arrives in Wave 6 (see PLATFORM-V2-CONCEPT.md §4.4); falling back to local BroadcastChannel."
    );
    return new BroadcastChannelTransport(shared);
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
