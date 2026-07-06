/* ============================================================
   notes-store.js — presenter speaker-notes overrides (CHROME).
   ------------------------------------------------------------
   A tiny read/write/export interface over per-slide notes edits
   the presenter makes while PREPARING a deck. Edits are stored
   as a localStorage override keyed by (deckId, slideId); the
   deck files themselves are never touched.

   Why a module: this is the ONLY place that knows HOW notes are
   persisted. Swapping localStorage for Supabase later is a
   one-file change — implement the same four functions against
   the network and every caller (presenter.js) keeps working.

   ────────────────────────────────────────────────────────────
   STORAGE CONTRACT (stable — the future Supabase swap honours it)
   ────────────────────────────────────────────────────────────
   Identity
     · deckId   the resolved deck id: ?deck= value or ACTIVE_DECK
                (same rule presenter.js / index.html use). One deck
                file → one deckId.
     · slideId  the slide object's `id` from decks/<deckId>.deck.js
                (e.g. "cover"). Stable across reorders; that is why
                we key on it and NOT on the volatile slide index.

   Value
     · text     RAW plain-text notes (NOT escaped). Callers escape
                on DISPLAY. Empty string is a legitimate override:
                it means "this slide intentionally has no notes",
                distinct from "no override" (deck-file notes win).

   localStorage layout
     · one key per edited slide:
         "fmnts-notes:<deckId>:<slideId>"  ->  raw notes text
       Per-slide keys (not one blob) keep writes cheap, make manual
       inspection easy, and never lose sibling edits on a bad write.

   API (all synchronous today; Promise-friendly signatures so a
   network backend can return Promises without changing callers
   that already `await`):
     · getNote(deckId, slideId)        -> string | null
         The override text, or null when none is stored.
     · setNote(deckId, slideId, text)  -> boolean
         Persist a raw override. Returns false if storage is
         unavailable (private mode / quota) so the UI can warn.
     · clearNote(deckId, slideId)      -> boolean
         Remove one slide's override (revert to the deck file).
     · listOverrides(deckId)           -> { [slideId]: text }
         Every override for a deck, as a plain object — the exact
         shape the Export action copies for Claude Code to fold
         back into decks/<deckId>.deck.js.
     · clearDeck(deckId)               -> number
         Remove ALL overrides for a deck. Returns the count wiped.
   ============================================================ */

/* Key namespace. Bump only on an incompatible layout change. */
const KEY_PREFIX = "fmnts-notes:";

/** Build the stable localStorage key for one (deckId, slideId) pair. */
function keyFor(deckId, slideId) {
  return `${KEY_PREFIX}${deckId}:${slideId}`;
}

/** True only for usable, non-empty id strings — guards every entrypoint. */
function isId(v) {
  return typeof v === "string" && v.length > 0;
}

/* Feature-detect once. Safari private mode throws on setItem, so a plain
   `'localStorage' in window` check is not enough — probe a write/remove. */
let storageOk = null;
function hasStorage() {
  if (storageOk != null) return storageOk;
  try {
    const probe = "__fmnts_notes_probe__";
    localStorage.setItem(probe, "1");
    localStorage.removeItem(probe);
    storageOk = true;
  } catch {
    storageOk = false;
  }
  return storageOk;
}

/**
 * Read one slide's override.
 * @returns {string|null} raw text, or null when no override is stored.
 */
export function getNote(deckId, slideId) {
  if (!isId(deckId) || !isId(slideId) || !hasStorage()) return null;
  try {
    const raw = localStorage.getItem(keyFor(deckId, slideId));
    return raw == null ? null : String(raw);
  } catch (err) {
    console.warn("[notes-store] getNote failed", err);
    return null;
  }
}

/**
 * Persist one slide's RAW override text (empty string is a valid override).
 * @returns {boolean} true when written, false when storage is unavailable.
 */
export function setNote(deckId, slideId, text) {
  if (!isId(deckId) || !isId(slideId) || !hasStorage()) return false;
  try {
    localStorage.setItem(keyFor(deckId, slideId), String(text == null ? "" : text));
    return true;
  } catch (err) {
    /* Quota or a mid-session private-mode flip — never throw at the UI. */
    console.warn("[notes-store] setNote failed", err);
    return false;
  }
}

/**
 * Remove one slide's override, reverting the panel to the deck-file notes.
 * @returns {boolean} true when the store is usable (idempotent otherwise).
 */
export function clearNote(deckId, slideId) {
  if (!isId(deckId) || !isId(slideId) || !hasStorage()) return false;
  try {
    localStorage.removeItem(keyFor(deckId, slideId));
    return true;
  } catch (err) {
    console.warn("[notes-store] clearNote failed", err);
    return false;
  }
}

/**
 * Every override for a deck, as { slideId: rawText }. Empty object when
 * none — the same shape the Export action serialises to JSON.
 * @returns {Object<string,string>}
 */
export function listOverrides(deckId) {
  const out = {};
  if (!isId(deckId) || !hasStorage()) return out;
  const prefix = `${KEY_PREFIX}${deckId}:`;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || k.indexOf(prefix) !== 0) continue;
      const slideId = k.slice(prefix.length);
      if (!slideId) continue;
      const val = localStorage.getItem(k);
      out[slideId] = val == null ? "" : String(val);
    }
  } catch (err) {
    console.warn("[notes-store] listOverrides failed", err);
  }
  return out;
}

/**
 * Remove ALL overrides for a deck (the "Clear overrides" escape hatch).
 * @returns {number} how many slide overrides were removed.
 */
export function clearDeck(deckId) {
  if (!isId(deckId) || !hasStorage()) return 0;
  const prefix = `${KEY_PREFIX}${deckId}:`;
  let removed = 0;
  try {
    /* Collect first, then delete — mutating during the index walk skips keys. */
    const doomed = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.indexOf(prefix) === 0) doomed.push(k);
    }
    for (const k of doomed) {
      localStorage.removeItem(k);
      removed++;
    }
  } catch (err) {
    console.warn("[notes-store] clearDeck failed", err);
  }
  return removed;
}

/** Whether persistence is available at all (UI can hide edit affordances). */
export function isStorageAvailable() {
  return hasStorage();
}
