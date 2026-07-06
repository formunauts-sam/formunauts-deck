/* ============================================================
   manifest.js — the DECK LIST that powers the hub (hub.html).
   ------------------------------------------------------------
   CONTENT ONLY. One id per line, NEWEST FIRST.
   A new demo = add its id at the TOP of this list. The id is
   the filename: decks/<id>.deck.js — nothing else to wire up
   (same philosophy as the deck files: non-devs edit data only).
   The hub imports each deck for title / date / slides; an id
   that fails to load is skipped with a console.warn — the hub
   never renders broken.
   ============================================================ */
export const manifest = [
  "2026-07-02-ai-pitchdecks",
  "2026-07-01",
];

/* The single source of truth for "which demo is active". It is simply
   the newest deck (manifest[0]) — the same one the hub hero shows. Both
   index.html and the presenter derive their default deck from this, so
   the shared deck, the presenter console and the hub hero never disagree.
   Add a new demo at the TOP of `manifest` and everything follows. */
export const ACTIVE_DECK = manifest[0];
