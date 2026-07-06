/* ============================================================
   engage/hud.js — the DECK-SIDE POLL + REACTION integration (CHROME).
   Wave 4 (PLATFORM-V2-CONCEPT.md §7.2 / Wave 4). Boots ON THE DECK
   alongside the Engage host (collab.js initCollab), reusing the SAME
   authority transport it already created. It owns the two Wave 4 deck
   behaviours the audience-HUD panel in collab.js does not:

     · Poll archetype integration — when the deck reaches a slide whose
       archetype is "poll", auto-open that poll to viewers (poll-open)
       and paint the slide's own result bars live as votes arrive; when
       the deck leaves the slide, close the poll (poll-close). The
       presenter can also reveal/close from here without a prompt.
     · A live reaction ticker — a small, unobtrusive count that pulses as
       reactions fan out, so the presenter sees the room's energy without
       reading the audience panel. Counts stay in sync with the flying
       reactions collab.js already renders (both read the SAME fan-out).

   It imports ONLY the Transport handle it is given (from initCollab) and
   the shared reducer helpers it needs to author presenter control verbs.
   It never opens a second transport, never touches the presenter console's
   'fmnts-deck' channel, and renders nothing in print/peek (the deck CSS
   gates .hud-* the same way it gates .fc-*).

   Poll-slide data hooks the poll archetype (archetypes/poll.js) exposes:
     [data-poll-id]         on the board root
     [data-poll-option=id]  on each option row (value = the vote token)
     .poll-opt__fill        scaleX(0..1) result track
     .poll-opt__pct         live percentage
     .poll-opt__count       live vote count
     [data-poll-total]      running total
     [data-poll-status]     open/closed/leading status line
   ============================================================ */
import { REACTION_ORDER } from "./glyphs.js";

/* The presenter authors poll-open with the slide's option ids as the tokens.
   The reducer stores votes by OPTION INDEX (its votes[] array), and the
   authority poll payload carries the resolved options[] in the same order, so
   we map index -> our slide row by matching the option id we sent. */

/* Tiny DOM helper, mirrors collab.js/viewer.js idioms. */
function q(root, sel) {
  return root ? root.querySelector(sel) : null;
}

/* Read the poll archetype's declarative options straight off the live slide
   DOM, so the HUD never needs the deck data object. Returns
   { id, options:[{id,label}] } or null when the slide is not a poll board. */
function readPollSlide(section) {
  if (!section) return null;
  const board = section.querySelector('[data-poll-id]');
  if (!board) return null;
  const id = board.getAttribute("data-poll-id") || section.id || "poll";
  const rows = Array.from(board.querySelectorAll("[data-poll-option]"));
  const options = rows.map((row) => ({
    id: row.getAttribute("data-poll-option") || "",
    label: (q(row, ".poll-opt__label") || {}).textContent || "",
    el: row,
  }));
  return { id, options, board };
}

/* ==================================================================
   initHud(Reveal, engage, opts) -> { enabled, destroy }
   ------------------------------------------------------------------
   Reveal   the initialized Reveal instance (deck tab)
   engage   the handle initCollab returned: { transport, control, ... }.
            `transport` is the authority transport (we subscribe to its
            fan-out); `control` is the authority-safe presenter control
            entry (poll-open/close), so hud's polls reduce at the SAME
            choke point collab.js uses, with no self-loop. If the transport
            is missing or not the authority, initHud no-ops safely (a viewer
            surface that imports this file does nothing).
   opts     { autoPoll?: boolean }  autoPoll defaults true.
================================================================== */
export function initHud(Reveal, engage, opts = {}) {
  const disabled = { enabled: false, destroy() {} };
  if (!Reveal || typeof Reveal.on !== "function") return disabled;
  const transport = engage && engage.transport;
  if (!transport || transport.isAuthority !== true) return disabled;
  // control routes poll-open/close through the authority reducer; fall back to
  // a stamped wire send only if the host did not expose it (defensive).
  const control =
    engage && typeof engage.control === "function"
      ? engage.control
      : (msg) => transport.send({ ...msg, role: "presenter" });

  const autoPoll = opts.autoPoll !== false;
  const unsubs = [];
  const on = (type, fn) => {
    const off = transport.on(type, fn);
    if (typeof off === "function") unsubs.push(off);
  };

  // The poll currently open FROM a slide, so we know to close it on leave and
  // to map the authority payload's option order back onto the slide rows.
  let activeSlidePoll = null; // { id, options:[{id,label,el}], board }

  /* Author a presenter control verb through the authority-safe entry the host
     exposed (collab.js `control`), so it is reduced once at the choke point and
     fanned out as `poll` without any self-loop. */
  const sendControl = control;

  /* ================= poll archetype integration ================= */
  function openSlidePoll(info) {
    if (!info || !info.options.length) return;
    activeSlidePoll = info;
    sendControl({
      t: "poll-open",
      id: info.id,
      q: pollQuestion(info),
      options: info.options.map((o) => o.label),
    });
  }
  function pollQuestion(info) {
    const board = info.board;
    const qEl = board ? board.querySelector(".poll-board__q") : null;
    if (qEl && qEl.textContent.trim()) return qEl.textContent.trim();
    // fall back to the slide headline
    const section = board ? board.closest("section") : null;
    const h = section ? section.querySelector(".headline") : null;
    return (h && h.textContent.trim()) || "Poll";
  }
  function closeSlidePoll() {
    if (!activeSlidePoll) return;
    sendControl({ t: "poll-close", id: activeSlidePoll.id });
    activeSlidePoll = null;
  }

  // On every slide change: if we land on a poll slide, auto-open it; if we
  // just left one, close it. Guarded by autoPoll.
  function onSlideChanged() {
    if (!autoPoll) return;
    const section = Reveal.getCurrentSlide();
    const info = readPollSlide(section);
    if (info) {
      // leaving a different poll first keeps the room tidy
      if (activeSlidePoll && activeSlidePoll.id !== info.id) closeSlidePoll();
      if (!activeSlidePoll) openSlidePoll(info);
    } else if (activeSlidePoll) {
      closeSlidePoll();
    }
  }

  /* Paint the live poll payload onto the active poll slide's result bars.
     The authority `poll` payload gives options[] + votes[] in the order we
     sent (our labels), so index i maps to activeSlidePoll.options[i].el. */
  function paintPoll(poll) {
    if (!activeSlidePoll || !poll || poll.id !== activeSlidePoll.id) return;
    const total = (poll.votes || []).reduce((a, b) => a + b, 0);
    let leadIdx = -1;
    let leadVotes = -1;
    (poll.votes || []).forEach((v, i) => {
      if (v > leadVotes) {
        leadVotes = v;
        leadIdx = i;
      }
    });
    activeSlidePoll.options.forEach((opt, i) => {
      const votes = (poll.votes && poll.votes[i]) || 0;
      const pct = total > 0 ? Math.round((votes / total) * 100) : 0;
      const fill = q(opt.el, ".poll-opt__fill");
      const pctEl = q(opt.el, ".poll-opt__pct");
      const countEl = q(opt.el, ".poll-opt__count");
      if (fill) fill.style.transform = `scaleX(${pct / 100})`;
      if (pctEl) pctEl.textContent = `${pct}%`;
      if (countEl) countEl.textContent = String(votes);
      // one accent max: mark only the single leader when there are votes
      opt.el.classList.toggle("is-lead", total > 0 && i === leadIdx && leadVotes > 0);
    });
    const board = activeSlidePoll.board;
    const totalEl = board ? board.querySelector("[data-poll-total]") : null;
    if (totalEl) totalEl.textContent = String(total);
    const statusEl = board ? board.querySelector("[data-poll-status]") : null;
    if (statusEl) {
      statusEl.textContent = poll.open
        ? total > 0
          ? "Live votes"
          : "Voting open"
        : "Poll closed";
    }
  }

  on("poll", (msg) => {
    if (msg.role !== "presenter") return;
    paintPoll(msg);
  });
  // hydrate the painted bars if a `state` snapshot carries the active poll
  on("state", (msg) => {
    if (msg.to || !msg.poll) return; // only broadcast snapshots
    paintPoll(msg.poll);
  });

  /* ================= reaction ticker ================= */
  // A tiny fixed chip that pulses on each reaction and shows a rolling total.
  // Injected only when reactions actually happen so a poll-only talk stays clean.
  let tickerEl = null;
  let reactionTotal = 0;
  function ensureTicker() {
    if (tickerEl) return tickerEl;
    tickerEl = document.createElement("div");
    tickerEl.className = "hud-ticker";
    tickerEl.setAttribute("aria-hidden", "true");
    tickerEl.innerHTML = '<span class="hud-ticker__n">0</span><span class="hud-ticker__lbl">reactions</span>';
    document.body.appendChild(tickerEl);
    return tickerEl;
  }
  on("reaction", (msg) => {
    // count ONLY the authority fan-out so a peer's raw send is not double-counted
    if (msg.role !== "presenter") return;
    if (!REACTION_ORDER.includes(msg.kind)) return;
    reactionTotal += 1;
    const t = ensureTicker();
    const n = q(t, ".hud-ticker__n");
    if (n) n.textContent = String(reactionTotal);
    t.classList.remove("is-pulse");
    void t.offsetWidth; // restart the pulse on rapid reactions
    t.classList.add("is-pulse");
  });

  /* ---- lifecycle ---- */
  if (Reveal.isReady && Reveal.isReady()) onSlideChanged();
  Reveal.on("ready", onSlideChanged);
  Reveal.on("slidechanged", onSlideChanged);

  return {
    enabled: true,
    destroy() {
      for (const off of unsubs) {
        try {
          off();
        } catch {
          /* ignore */
        }
      }
      Reveal.off && Reveal.off("slidechanged", onSlideChanged);
      Reveal.off && Reveal.off("ready", onSlideChanged);
      if (tickerEl) tickerEl.remove();
      closeSlidePoll();
    },
  };
}

export default initHud;
