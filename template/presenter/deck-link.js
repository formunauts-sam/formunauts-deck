/* ============================================================
   deck-link.js — the DECK side of the presenter console sync.
   CHROME. Imported by index.html.
   ------------------------------------------------------------
   Publishes deck state on BroadcastChannel("fmnts-deck") + a
   localStorage snapshot mirror, executes presenter commands,
   and owns the ?present=peek gate. Matches the contract in
   template/presenter/presenter.js exactly (proto:1).

     deck → presenter : {t:'state', h,v,f,index,total,notes,title,eyebrow,timing,paused}
     deck → presenter : {t:'bye'}                (on pagehide)
     presenter → deck : {t:'hello'}              (request snapshot)
     presenter → deck : {t:'cmd', name, h?, v?}  (next|prev|goto|pause|black)
   ============================================================ */
const CHANNEL = "fmnts-deck";
const SNAPSHOT_KEY = "fmnts-deck-state";
const PROTO = 1;
const DEFAULT_TIMING = 45;

const isPeek = () => new URLSearchParams(location.search).get("present") === "peek";
const txt = (el) => (el ? (el.textContent || "").trim() : "");

export function initDeckLink(Reveal) {
  /* Preview iframe: never publish or accept commands (read-only thumbnail). */
  if (isPeek()) return { peek: true };

  let bc = null;
  try { if (typeof BroadcastChannel !== "undefined") bc = new BroadcastChannel(CHANNEL); }
  catch { bc = null; }

  function currentState() {
    const idx = Reveal.getIndices ? Reveal.getIndices() : { h: 0, v: 0, f: -1 };
    const slide = Reveal.getCurrentSlide ? Reveal.getCurrentSlide() : null;
    let notes = "";
    try { notes = Reveal.getSlideNotes ? (Reveal.getSlideNotes() || "") : ""; } catch { notes = ""; }
    if (!notes && slide) { const a = slide.querySelector("aside.notes"); notes = a ? a.innerHTML : ""; }
    return {
      t: "state",
      h: idx.h || 0, v: idx.v || 0, f: idx.f == null ? -1 : idx.f,
      index: Reveal.getSlidePastCount ? Reveal.getSlidePastCount() : (idx.h || 0),
      total: Reveal.getTotalSlides ? Reveal.getTotalSlides() : 0,
      notes,
      title: slide ? txt(slide.querySelector(".headline, .cover__headline, .closing__statement")) : "",
      eyebrow: slide ? txt(slide.querySelector(".kicker, .cover__eyebrow")) : "",
      timing: slide && slide.dataset.timing ? Number(slide.dataset.timing) : DEFAULT_TIMING,
      paused: Reveal.isPaused ? Reveal.isPaused() : false,
    };
  }

  function publish() {
    const wrapped = { proto: PROTO, ...currentState() };
    try { bc && bc.postMessage(wrapped); } catch { /* ignore */ }
    try { localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(wrapped)); } catch { /* ignore */ }
  }

  function exec(name, msg) {
    switch (name) {
      case "next": Reveal.next(); break;
      case "prev": Reveal.prev(); break;
      case "goto": if (Number.isInteger(msg.h)) Reveal.slide(msg.h, Number.isInteger(msg.v) ? msg.v : 0); break;
      case "pause":
      case "black": if (Reveal.togglePause) Reveal.togglePause(); break;
    }
  }

  if (bc) {
    bc.onmessage = (ev) => {
      const d = ev && ev.data;
      if (!d || d.proto !== PROTO) return;
      if (d.t === "hello") publish();
      else if (d.t === "cmd") exec(d.name, d);
    };
  }

  const fire = () => publish();
  if (Reveal.isReady && Reveal.isReady()) fire();
  Reveal.on("ready", fire);
  Reveal.on("slidechanged", fire);
  Reveal.on("paused", fire);
  Reveal.on("resumed", fire);
  Reveal.on("overviewhidden", fire);
  window.addEventListener("pagehide", () => {
    try { bc && bc.postMessage({ proto: PROTO, t: "bye" }); } catch { /* ignore */ }
  });

  return { peek: false };
}

export default initDeckLink;
