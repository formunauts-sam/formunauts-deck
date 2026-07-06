/* ============================================================
   validate-deck.mjs, the strict gate the authoring skill runs first.
   ------------------------------------------------------------
   Zero dependencies. No ajv, no npm install. A compact hand-rolled
   walker over the subset of JSON Schema (draft 2020-12) that
   template/schema/deck.schema.json actually uses:
     type · required · additionalProperties · properties
     enum · const · pattern · minLength · minItems
     minimum · maximum · allOf · if/then · oneOf · $ref/$defs
   On top of the shape check it enforces the brand invariants from
   PLATFORM-V2-CONCEPT.md 6.7. chrome:"dark" is a hard ERROR (the
   no-dark rail is absolute). Emoji, em-dashes/en-dashes, and more
   than one red accent (tone:"accent") are WARNINGS: they are flagged
   with field-level locations so the authoring skill cleans them out
   of new copy, but they do not fail an otherwise-valid legacy deck.

   Returns { ok, errors:[{slideIndex, field, message}], warnings:[...] }
   so the skill gets field-level feedback instead of a silently empty
   slide. Errors gate ok:false; warnings (e.g. more than one red accent,
   a soft rail) never fail the deck. render.js keeps its permissive
   runtime guards; this is the strict gate.

   CLI:
     node tools/validate-deck.mjs decks/<id>.deck.js   # one deck
     node tools/validate-deck.mjs --all                # every manifest deck
   Exits non-zero on any error (CI-ready).
   ============================================================ */

import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve, isAbsolute } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..");
const SCHEMA_PATH = resolve(REPO, "template/schema/deck.schema.json");

/* --- brand invariants (6.7) -------------------------------- */
// Em-dash and en-dash are both banned (the brand uses commas/periods/parens).
const EM_DASH = /[—–]/;
// Emoji: pictographic + regional-indicator + variation-selector-16 + dingbat ranges.
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{1F1E6}-\u{1F1FF}\u{2600}-\u{27BF}\u{FE0F}\u{1F900}-\u{1F9FF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}]/u;
// The one arrow the deck data legitimately uses is the literal "→" (U+2192),
// e.g. projectVisual pivot marks and "Q2 → Q3" copy. Allow it; ban other emoji.
const ALLOWED_ARROW = "→";

/* --- tiny schema walker ------------------------------------ */

function typeOf(v) {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  if (Number.isInteger(v)) return "integer";
  return typeof v; // "number" | "string" | "boolean" | "object"
}

// draft type check where "integer" satisfies "number", and any int is "integer".
function matchesType(value, t) {
  const actual = typeOf(value);
  if (t === "number") return actual === "number" || actual === "integer";
  if (t === "integer") return actual === "integer";
  return actual === t;
}

function resolveRef(ref, root) {
  // only local pointers of the form "#/$defs/name" are used
  if (!ref.startsWith("#/")) return null;
  return ref
    .slice(2)
    .split("/")
    .reduce((node, key) => (node ? node[key] : undefined), root);
}

/*
 * validateNode, collect errors for `value` against `schema`.
 * @param path  dotted field path for messages (relative to the slide/deck)
 * @param out   array the caller reads afterwards
 */
function validateNode(value, schema, path, root, out) {
  if (schema == null || schema === true) return;
  if (schema === false) {
    out.push({ field: path, message: "not allowed here" });
    return;
  }

  if (schema.$ref) {
    const target = resolveRef(schema.$ref, root);
    if (!target) {
      out.push({ field: path, message: `unresolved $ref ${schema.$ref}` });
      return;
    }
    validateNode(value, target, path, root, out);
    return;
  }

  // enum / const
  if (schema.enum && !schema.enum.some((e) => e === value)) {
    out.push({ field: path, message: `must be one of ${schema.enum.map((e) => JSON.stringify(e)).join(", ")} (got ${JSON.stringify(value)})` });
    return;
  }
  if ("const" in schema && value !== schema.const) {
    out.push({ field: path, message: `must equal ${JSON.stringify(schema.const)}` });
    return;
  }

  // type (single or array of allowed)
  if (schema.type) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!types.some((t) => matchesType(value, t))) {
      out.push({ field: path, message: `must be ${types.join(" or ")} (got ${typeOf(value)})` });
      return; // wrong primitive type, deeper checks are meaningless
    }
  }

  const t = typeOf(value);

  // string facets
  if (t === "string") {
    if (schema.minLength != null && value.length < schema.minLength) {
      out.push({ field: path, message: `must be at least ${schema.minLength} character(s)` });
    }
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) {
      out.push({ field: path, message: `does not match required pattern ${schema.pattern}` });
    }
  }

  // number facets
  if (t === "number" || t === "integer") {
    if (schema.minimum != null && value < schema.minimum) {
      out.push({ field: path, message: `must be >= ${schema.minimum}` });
    }
    if (schema.maximum != null && value > schema.maximum) {
      out.push({ field: path, message: `must be <= ${schema.maximum}` });
    }
  }

  // array facets
  if (t === "array") {
    if (schema.minItems != null && value.length < schema.minItems) {
      out.push({ field: path, message: `must have at least ${schema.minItems} item(s)` });
    }
    if (schema.items) {
      value.forEach((item, i) => validateNode(item, schema.items, `${path}[${i}]`, root, out));
    }
  }

  // object facets
  if (t === "object") {
    const props = schema.properties || {};
    if (Array.isArray(schema.required)) {
      for (const key of schema.required) {
        if (!(key in value)) {
          out.push({ field: path ? `${path}.${key}` : key, message: "is required" });
        }
      }
    }
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        if (!(key in props)) {
          out.push({ field: path ? `${path}.${key}` : key, message: "is not an allowed field" });
        }
      }
    }
    for (const [key, sub] of Object.entries(props)) {
      if (key in value) {
        validateNode(value[key], sub, path ? `${path}.${key}` : key, root, out);
      }
    }
  }

  // combinators
  if (Array.isArray(schema.allOf)) {
    for (const sub of schema.allOf) validateNode(value, sub, path, root, out);
  }
  if (schema.if) {
    const probe = [];
    validateNode(value, schema.if, path, root, probe);
    const branch = probe.length === 0 ? schema.then : schema.else;
    if (branch) validateNode(value, branch, path, root, out);
  }
  if (Array.isArray(schema.oneOf)) {
    const passes = schema.oneOf.filter((sub) => {
      const probe = [];
      validateNode(value, sub, path, root, probe);
      return probe.length === 0;
    });
    if (passes.length !== 1) {
      out.push({ field: path, message: `must match exactly one allowed shape (matched ${passes.length})` });
    }
  }
}

/* --- brand-invariant scan over every string in the deck ----- */

function scanStrings(value, path, visit) {
  const t = typeOf(value);
  if (t === "string") {
    visit(value, path);
  } else if (t === "array") {
    value.forEach((v, i) => scanStrings(v, `${path}[${i}]`, visit));
  } else if (t === "object") {
    for (const [k, v] of Object.entries(value)) {
      scanStrings(v, path ? `${path}.${k}` : k, visit);
    }
  }
}

// Strip the one allowed arrow before the emoji test so "→" never trips it.
function hasEmoji(s) {
  return EMOJI.test(s.split(ALLOWED_ARROW).join(""));
}

/*
 * validateDeck, the public entry. Returns field-level results.
 * @param deck    the parsed deck object
 * @param schema  the parsed JSON Schema
 * @returns { ok, errors:[{slideIndex, field, message}], warnings:[...] }
 */
export function validateDeck(deck, schema) {
  const errors = [];
  const warnings = [];

  // 1. structural: whole deck against the schema. Tag errors with the slide
  //    index when the path points into slides[N] so the skill can locate them.
  const structural = [];
  validateNode(deck, schema, "", schema, structural);
  for (const e of structural) {
    const m = /^slides\[(\d+)\]\.?(.*)$/.exec(e.field);
    if (m) {
      errors.push({ slideIndex: Number(m[1]), field: m[2] || "(slide)", message: e.message });
    } else {
      errors.push({ slideIndex: null, field: e.field || "(deck)", message: e.message });
    }
  }

  // 2. brand invariants over slides (6.7). chrome:"dark" is caught by the enum
  //    above too, but we add an explicit, friendlier message.
  const slides = Array.isArray(deck && deck.slides) ? deck.slides : [];
  let accentCount = 0;

  slides.forEach((slide, i) => {
    if (slide && slide.chrome === "dark") {
      errors.push({ slideIndex: i, field: "chrome", message: 'chrome:"dark" is banned (no-dark brand invariant); use "blue" for full-bleed drama or "muted" for content' });
    }
    if (slide && slide.backdrop === "dark") {
      errors.push({ slideIndex: i, field: "backdrop", message: 'backdrop:"dark" is banned (no-dark brand invariant)' });
    }
    scanStrings(slide, "", (str, field) => {
      if (hasEmoji(str)) {
        warnings.push({ slideIndex: i, field: field || "(string)", message: "contains an emoji (banned; remove it)" });
      }
      if (EM_DASH.test(str)) {
        warnings.push({ slideIndex: i, field: field || "(string)", message: "contains an em-dash or en-dash (banned; use commas, periods or parentheses)" });
      }
    });

    // count red accents: tone:"accent" on pills / metrics / bullets, badge tone accent.
    accentCount += countAccents(slide);
  });

  // one red stopper per deck at most (6.7). A soft rail: warn, do not fail.
  if (accentCount > 1) {
    warnings.push({ slideIndex: null, field: "(deck)", message: `${accentCount} red accents used. Prefer at most one tone:"accent"/red stopper per deck (E03B50 is the rare stopper)` });
  }

  return { ok: errors.length === 0, errors, warnings };
}

// Count declarative red-accent usages anywhere in a slide.
function countAccents(slide) {
  let n = 0;
  const walk = (v) => {
    const t = typeOf(v);
    if (t === "object") {
      if (v.tone === "accent") n += 1;
      if (v.badge && v.badge.tone === "accent") n += 1;
      for (const val of Object.values(v)) walk(val);
    } else if (t === "array") {
      for (const item of v) walk(item);
    }
  };
  walk(slide);
  return n;
}

/* --- CLI --------------------------------------------------- */

function loadSchema() {
  return JSON.parse(readFileSync(SCHEMA_PATH, "utf8"));
}

async function loadDeck(deckPath) {
  const abs = isAbsolute(deckPath) ? deckPath : resolve(process.cwd(), deckPath);
  const mod = await import(pathToFileURL(abs).href);
  if (!mod.deck) throw new Error(`${deckPath} does not export { deck }`);
  return mod.deck;
}

async function manifestPaths() {
  const mod = await import(pathToFileURL(resolve(REPO, "decks/manifest.js")).href);
  const ids = Array.isArray(mod.manifest) ? mod.manifest : [];
  return ids.map((id) => resolve(REPO, `decks/${id}.deck.js`));
}

function printLines(items, tag) {
  for (const e of items) {
    const where = e.slideIndex == null ? "deck" : `slide ${e.slideIndex}`;
    console.log(`        ${tag} [${where}] ${e.field}: ${e.message}`);
  }
}

function report(label, result) {
  const warns = result.warnings || [];
  if (result.ok) {
    const suffix = warns.length ? `, ${warns.length} warning${warns.length === 1 ? "" : "s"}` : "";
    console.log(`ok    ${label}  (0 errors${suffix})`);
    printLines(warns, "warn");
    return;
  }
  console.log(`FAIL  ${label}  (${result.errors.length} error${result.errors.length === 1 ? "" : "s"})`);
  printLines(result.errors, "err ");
  printLines(warns, "warn");
}

async function main() {
  const args = process.argv.slice(2);
  const schema = loadSchema();
  let paths;

  if (args.includes("--all") || args.length === 0) {
    paths = await manifestPaths();
  } else {
    paths = args.filter((a) => !a.startsWith("--"));
  }

  let anyFail = false;
  for (const p of paths) {
    let result;
    try {
      const deck = await loadDeck(p);
      result = validateDeck(deck, schema);
    } catch (err) {
      result = { ok: false, errors: [{ slideIndex: null, field: "(load)", message: err.message }] };
    }
    report(p.replace(REPO + "/", ""), result);
    if (!result.ok) anyFail = true;
  }

  process.exit(anyFail ? 1 : 0);
}

// Run as CLI only when invoked directly (not when imported by the skill/tests).
if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  main().catch((err) => {
    console.error(err);
    process.exit(2);
  });
}
