/* ============================================================
   engage/glyphs.js — the ON-BRAND Engage icon set (CHROME).
   ------------------------------------------------------------
   Hand-authored 24x24 inline SVG, `fill="currentColor"` so the
   brand blue is applied via CSS. NEVER emoji. Red is excluded on
   purpose (the rare stopper never rides a reaction). Shared by the
   deck host (collab.js), the presenter HUD (hud.js), and the viewer
   thumb zone (viewer.js) so the reaction vocabulary is defined once.

   The reaction whitelist here MUST match REACTION_KINDS in
   engage/authority.js exactly; anything off the list is dropped by
   the reducer before it fans out.
   ============================================================ */

/* Reaction glyphs, keyed by the wire `kind`. */
export const GLYPHS = {
  // spark / rocket-trail: a four-point sparkle
  spark:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2c.5 3.6 1.8 4.9 5.4 5.4-3.6.5-4.9 1.8-5.4 5.4-.5-3.6-1.8-4.9-5.4-5.4C10.2 6.9 11.5 5.6 12 2Z" fill="currentColor"/><path d="M18.5 13c.3 1.9 1 2.6 2.9 2.9-1.9.3-2.6 1-2.9 2.9-.3-1.9-1-2.6-2.9-2.9 1.9-.3 2.6-1 2.9-2.9Z" fill="currentColor" opacity=".7"/></svg>',
  // thumbs-up
  up: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10v9H4a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1h3Zm3 0 3.2-6.4A1.6 1.6 0 0 1 15.6 3c1 0 1.7.9 1.5 1.9L16.4 9H20a2 2 0 0 1 2 2.3l-1 6A2 2 0 0 1 19 19h-8a1 1 0 0 1-1-1v-8Z" fill="currentColor"/></svg>',
  // applause / clapping hands
  clap:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11.5 12.7 6.9 8.1a1.4 1.4 0 0 1 2-2l3.4 3.4-.8 3.2ZM9 5.2l3.2 3.2 1.5-1.5-3.2-3.2a1.4 1.4 0 0 0-2 2l.5-.5Zm5.6-.2 2.7 2.7a1.4 1.4 0 0 1-2 2l-2.7-2.7 2-2Zm-9 8.3 3.9 3.9a5 5 0 0 0 7.3-.3l3.6-4.2-1.8-1.1-2.3 2 4.1-6.9a1.4 1.4 0 0 0-2.4-1.4l-2.9 5 .5-.9a1.4 1.4 0 0 0-2.3-1.6l-2 3a5 5 0 0 1-5.5 3.1l-.2-.3Z" fill="currentColor"/></svg>',
  // eyes / watching
  eyes:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 7c-3.3 0-6 2.5-6 5s2.7 5 6 5 6-2.5 6-5-2.7-5-6-5Zm0 8a3 3 0 1 1 0-6 3 3 0 0 1 0 6Z" fill="currentColor"/><path d="M16.5 8c-1 0-1.9.2-2.7.6.8.9 1.4 2 1.6 3.2a2.5 2.5 0 1 0 3.4 2.9c1.3-.8 2.2-2 2.2-2.7 0-2-2-4-4.5-4Z" fill="currentColor" opacity=".8"/></svg>',
  // plus-one
  plus:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 4a1 1 0 1 0-2 0v7H4a1 1 0 1 0 0 2h7v7a1 1 0 1 0 2 0v-7h7a1 1 0 1 0 0-2h-7V4Z" fill="currentColor"/></svg>',
};

/* Human labels for the reaction buttons (aria + tooltip). */
export const REACTION_TITLE = {
  spark: "Spark",
  up: "Agree",
  clap: "Applause",
  eyes: "Watching",
  plus: "+1",
};

/* The reaction order in the bar. Matches authority REACTION_KINDS. */
export const REACTION_ORDER = ["spark", "up", "clap", "eyes", "plus"];

/* Raise-hand glyph (viewer toggle + HUD hands stat). */
export const HAND_SVG =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5a1.4 1.4 0 0 0-1.4 1.4v6.3h-.8V2.9a1.4 1.4 0 1 0-2.8 0v9.8l-1.2-1.5a1.5 1.5 0 0 0-2.4 1.8l3.2 4.6A5.6 5.6 0 0 0 11 21h2.3a5.6 5.6 0 0 0 5.6-5.6V6.1a1.4 1.4 0 1 0-2.8 0v4.1h-.8V4.4a1.4 1.4 0 0 0-2.7 0v5.8h-.8V3.9A1.4 1.4 0 0 0 12 2.5Z" fill="currentColor"/></svg>';

/* Upward chevron for the Q&A upvote button. */
export const UPVOTE_SVG =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5.5 20 15H15v3.5H9V15H4L12 5.5Z" fill="currentColor"/></svg>';

/* Speech / ask glyph for the composer toggle. */
export const ASK_SVG =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h16a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H9l-4 4v-4H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z" fill="currentColor"/></svg>';
