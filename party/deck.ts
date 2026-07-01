/* ============================================================
   party/deck.ts - LIVE COLLABORATION server (CHROME)
   ------------------------------------------------------------
   One PartyKit Durable Object per room (per ?room= id). Holds
   the shared session state: current slide, presence, audience
   reactions (aggregate only), raise-hand set, Q&A queue and a
   single live poll. Hibernates when idle -> effectively $0.

   NON-NEGOTIABLE CONTRACTS (mirrors PRO-BUILD-SPEC 1.4 / 4):
   - Purely additive. The static deck never talks to this; it is
     only reached when the client has a PARTY host + ?room=.
   - Server-ENFORCED roles. A viewer cannot drive slides, move
     the pointer, or open/close polls - the server checks the
     authenticated role, it does not trust hidden buttons.
   - Validate every inbound message at the boundary: JSON-guarded,
     reaction-kind whitelisted, poll bounds + option index checked,
     question length capped, one poll-vote per connection.

   Presenter auth: env var PRESENTER_TOKEN. Empty string ("") =
   OPEN MODE (any client may claim presenter) - handy for local /
   offline demos. Set a real token in partykit.json / dashboard
   to lock presenter control down for a public room.

   API surface verified against partykit/server (Party.Server):
     implements Party.Server, constructor(readonly room),
     onStart / onConnect(conn,ctx) / onMessage(msg,sender) /
     onClose(conn), connection.setState()/.state,
     room.getConnections(), room.broadcast(msg,[exclude]),
     room.storage.get/put, room.env.<VAR>.
   ============================================================ */

import type * as Party from "partykit/server";

/* ---- Roles ------------------------------------------------- */
type Role = "presenter" | "viewer";

/* Per-connection state kept on the socket (survives hibernation
   via PartyKit's attachment serialization). */
interface ConnState {
  role: Role;
  name: string;
  hand: boolean;
  votedPollId: string | null; // enforce one vote per open poll
}

/* ---- Reactions: a fixed, ON-BRAND whitelist (NO emoji). -----
   The client renders these as inline-SVG glyphs in FORMUNAUTS
   blue. Red is deliberately excluded (rare stopper). Anything
   off this list is dropped server-side. */
const REACTION_KINDS = ["spark", "up", "clap", "eyes", "plus"] as const;
type ReactionKind = (typeof REACTION_KINDS)[number];
function isReactionKind(v: unknown): v is ReactionKind {
  return typeof v === "string" && (REACTION_KINDS as readonly string[]).includes(v);
}

/* ---- Limits (named - no magic numbers at call sites) ------- */
const MAX_QUESTION_LEN = 240;
const MAX_QUESTIONS = 60; // ring-buffer cap so storage/memory stay bounded
const MAX_NAME_LEN = 40;
const MAX_POLL_OPTIONS = 6;
const MAX_POLL_OPTION_LEN = 80;
const MAX_POLL_QUESTION_LEN = 160;
const MAX_ID_LEN = 80;

/* C0 + C1 control chars. Built via RegExp from printable-ASCII
   escapes on purpose: no raw control bytes ever live in this file. */
const CONTROL_CHARS = new RegExp("[\\x00-\\x1F\\x7F-\\x9F]+", "g");

/* ---- Persisted room state ---------------------------------- */
interface SlideState {
  h: number;
  v: number;
  id: string;
}
interface Question {
  id: string;
  text: string;
  ts: number;
}
interface Poll {
  id: string;
  q: string;
  options: string[];
  votes: number[]; // parallel to options
  open: boolean;
}
interface RoomState {
  slide: SlideState;
  poll: Poll | null;
  questions: Question[];
  reactionsTotal: number;
}

const STORAGE_KEY = "fmnts-room";

function freshState(): RoomState {
  return {
    slide: { h: 0, v: 0, id: "" },
    poll: null,
    questions: [],
    reactionsTotal: 0,
  };
}

/* ---- Small guards ------------------------------------------ */
function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}
function asInt(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? Math.trunc(v) : null;
}
function clampNum(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}
function cleanStr(v: unknown, max: number): string {
  if (typeof v !== "string") return "";
  // drop control chars, collapse whitespace, cap length
  return v.replace(CONTROL_CHARS, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

export default class DeckRoom implements Party.Server {
  /* Hibernate when idle -> the DO spins down, wakes on next event. */
  readonly options: Party.ServerOptions = { hibernate: true };

  state: RoomState = freshState();

  constructor(readonly room: Party.Room) {}

  /* Rehydrate persisted state on (re)start. */
  async onStart(): Promise<void> {
    const saved = await this.room.storage.get<RoomState>(STORAGE_KEY);
    if (saved) this.state = { ...freshState(), ...saved };
  }

  private async persist(): Promise<void> {
    await this.room.storage.put(STORAGE_KEY, this.state);
  }

  /* Count live viewers (everyone who isn't the presenter) + hands. */
  private presence(): { count: number; hands: number } {
    let count = 0;
    let hands = 0;
    for (const c of this.room.getConnections<ConnState>()) {
      const st = c.state;
      if (!st) continue;
      if (st.role !== "presenter") count += 1;
      if (st.hand) hands += 1;
    }
    return { count, hands };
  }

  private broadcastPresence(): void {
    const { count, hands } = this.presence();
    this.room.broadcast(JSON.stringify({ type: "presence", count, hands }));
  }

  private send(conn: Party.Connection, msg: unknown): void {
    conn.send(JSON.stringify(msg));
  }

  private pollPayload(): unknown | null {
    const p = this.state.poll;
    if (!p) return null;
    return { type: "poll", id: p.id, q: p.q, options: p.options, votes: p.votes, open: p.open };
  }

  /* ---- Connection open ------------------------------------- */
  async onConnect(conn: Party.Connection<ConnState>, ctx: Party.ConnectionContext): Promise<void> {
    const url = new URL(ctx.request.url);
    const requested: Role = url.searchParams.get("role") === "presenter" ? "presenter" : "viewer";
    const token = url.searchParams.get("t") ?? "";
    const name = cleanStr(url.searchParams.get("name"), MAX_NAME_LEN) || "Guest";

    const role = this.authorize(requested, token);

    conn.setState({ role, name, hand: false, votedPollId: null });

    // Authoritative snapshot to the new joiner (incl. the role the
    // SERVER granted - never what the client asked for).
    const { count, hands } = this.presence();
    this.send(conn, {
      type: "state",
      role,
      slide: this.state.slide,
      poll: this.pollPayload(),
      presence: { count, hands },
      reactionsTotal: this.state.reactionsTotal,
      // presenters get the standing question queue; viewers do not
      questions: role === "presenter" ? this.state.questions : [],
    });

    this.broadcastPresence();
  }

  /* Presenter gate. Empty PRESENTER_TOKEN = open mode. */
  private authorize(requested: Role, token: string): Role {
    if (requested !== "presenter") return "viewer";
    const secret = (this.room.env.PRESENTER_TOKEN as string | undefined) ?? "";
    if (secret === "") return "presenter"; // open mode (local/offline)
    return token === secret ? "presenter" : "viewer"; // wrong token -> demote
  }

  /* ---- Inbound messages ------------------------------------ */
  async onMessage(message: string | ArrayBuffer, sender: Party.Connection<ConnState>): Promise<void> {
    if (typeof message !== "string") return; // binary not used

    let data: unknown;
    try {
      data = JSON.parse(message);
    } catch {
      return; // ignore malformed frames
    }
    if (!isRecord(data) || typeof data.type !== "string") return;

    const st = sender.state;
    if (!st) return;
    const isPresenter = st.role === "presenter";

    switch (data.type) {
      /* ---- Presenter-only: drive the deck ---- */
      case "set-slide": {
        if (!isPresenter) return; // server-enforced
        const h = asInt(data.h);
        const v = asInt(data.v);
        if (h === null || v === null || h < 0 || v < 0) return;
        this.state.slide = { h, v, id: cleanStr(data.id, MAX_ID_LEN) };
        // fan out to everyone EXCEPT the presenter (they already moved)
        this.room.broadcast(
          JSON.stringify({ type: "slide", h, v, id: this.state.slide.id }),
          [sender.id]
        );
        await this.persist();
        return;
      }

      /* ---- Presenter-only: pointer relay (ephemeral, normalized) ---- */
      case "pointer": {
        if (!isPresenter) return;
        const x = typeof data.x === "number" ? clampNum(data.x, 0, 1) : null;
        const y = typeof data.y === "number" ? clampNum(data.y, 0, 1) : null;
        const visible = data.visible === true;
        if (x === null || y === null) return;
        // not persisted (transient) - just relay to viewers
        this.room.broadcast(JSON.stringify({ type: "pointer", x, y, visible }), [sender.id]);
        return;
      }

      /* ---- Anyone: on-brand reaction (aggregate + fan-out) ---- */
      case "reaction": {
        if (!isReactionKind(data.kind)) return; // whitelist
        this.state.reactionsTotal += 1;
        // relay to ALL (incl. presenter HUD + every viewer screen)
        this.room.broadcast(JSON.stringify({ type: "reaction", kind: data.kind }));
        await this.persist();
        return;
      }

      /* ---- Viewer: raise / lower hand ---- */
      case "hand": {
        if (isPresenter) return; // presenter doesn't raise a hand
        const on = data.on === true;
        if (st.hand === on) return;
        sender.setState({ ...st, hand: on });
        this.broadcastPresence();
        return;
      }

      /* ---- Viewer: ask a question (presenter HUD only) ---- */
      case "question": {
        const text = cleanStr(data.text, MAX_QUESTION_LEN);
        if (!text) return;
        const q: Question = { id: crypto.randomUUID(), text, ts: Date.now() };
        this.state.questions.push(q);
        if (this.state.questions.length > MAX_QUESTIONS) {
          this.state.questions = this.state.questions.slice(-MAX_QUESTIONS);
        }
        // deliver ONLY to presenters
        for (const c of this.room.getConnections<ConnState>()) {
          if (c.state?.role === "presenter") {
            this.send(c, { type: "question", id: q.id, text: q.text, ts: q.ts });
          }
        }
        await this.persist();
        return;
      }

      /* ---- Presenter-only: open a poll ---- */
      case "poll-open": {
        if (!isPresenter) return;
        const q = cleanStr(data.q, MAX_POLL_QUESTION_LEN);
        const rawOpts = Array.isArray(data.options) ? data.options : [];
        const options = rawOpts
          .map((o) => cleanStr(o, MAX_POLL_OPTION_LEN))
          .filter((o) => o.length > 0)
          .slice(0, MAX_POLL_OPTIONS);
        if (!q || options.length < 2) return; // need a question + >=2 options
        const id = cleanStr(data.id, MAX_ID_LEN) || crypto.randomUUID();
        this.state.poll = { id, q, options, votes: new Array(options.length).fill(0), open: true };
        // reset every connection's vote lock for the new poll
        for (const c of this.room.getConnections<ConnState>()) {
          const cs = c.state;
          if (cs) c.setState({ ...cs, votedPollId: null });
        }
        this.room.broadcast(JSON.stringify(this.pollPayload()));
        await this.persist();
        return;
      }

      /* ---- Anyone (typically viewer): cast one vote ---- */
      case "poll-vote": {
        const poll = this.state.poll;
        if (!poll || !poll.open) return;
        if (cleanStr(data.id, MAX_ID_LEN) !== poll.id) return; // stale poll id
        const idx = asInt(data.option);
        if (idx === null || idx < 0 || idx >= poll.options.length) return;
        if (st.votedPollId === poll.id) return; // already voted this poll
        poll.votes[idx] += 1;
        sender.setState({ ...st, votedPollId: poll.id });
        this.room.broadcast(JSON.stringify(this.pollPayload()));
        await this.persist();
        return;
      }

      /* ---- Presenter-only: close the poll (keeps final tally) ---- */
      case "poll-close": {
        if (!isPresenter) return;
        const poll = this.state.poll;
        if (!poll) return;
        if (cleanStr(data.id, MAX_ID_LEN) !== poll.id) return;
        poll.open = false;
        this.room.broadcast(JSON.stringify(this.pollPayload()));
        await this.persist();
        return;
      }

      default:
        return; // unknown type -> ignore
    }
  }

  /* ---- Connection close: drop its hand from the tally -------- */
  async onClose(_conn: Party.Connection<ConnState>): Promise<void> {
    // state for this socket is gone; recompute + broadcast presence
    this.broadcastPresence();
  }

  async onError(_conn: Party.Connection, _err: Error): Promise<void> {
    // swallow per-connection socket errors; presence self-heals on next event
  }

  /* Lightweight health/debug endpoint (GET on the room). */
  async onRequest(req: Party.Request): Promise<Response> {
    if (req.method === "GET") {
      const { count, hands } = this.presence();
      return Response.json({
        room: this.room.id,
        viewers: count,
        hands,
        slide: this.state.slide,
        pollOpen: this.state.poll?.open ?? false,
        questions: this.state.questions.length,
        reactionsTotal: this.state.reactionsTotal,
      });
    }
    return new Response("Method not allowed", { status: 405 });
  }
}

DeckRoom satisfies Party.Worker;
