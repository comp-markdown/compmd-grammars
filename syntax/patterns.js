// The pieces of CompMD's syntax, as regular-expression sources every grammar reads, so they read the same text the same
// way. Each names the spec's section. They are sources, not RegExp objects: tree-sitter (`new RegExp`) and TextMate
// (Oniguruma) both take them. The pieces use only what the two share (classes, groups, alternation, repetition); the
// continuation line's form and the frontmatter's keys use look-aheads, for TextMate, which matches a line at a time:
// tree-sitter's scanners read those forms themselves.

"use strict";

/** A component's, a slot's or a param's name (spec §3.1, `name`). */
const name = "[A-Za-z][A-Za-z0-9_-]*";

/** A CEL identifier: an interpolation path's names (spec §8.1). */
const identifier = "[A-Za-z_][A-Za-z0-9_]*";

/** An interpolation's path: names joined by `.` (spec §8.1). */
const interpolationPath = `${identifier}(?:\\.${identifier})*`;

/** White space inside a line (spec §3.1, `WSP`). */
const space = "[ \\t]";

/** A bare param value: up to the next white space, quote, parenthesis, bracket or brace (spec §3.1, `bare`). */
const bareValue = "[^ \\t\\r\\n\"(){}\\[\\]]+";

/** A backslash escape inside a quoted param: a backslash before ASCII punctuation (spec §3.1, `escape`). */
const stringEscape = "\\\\[!-/:-@\\[-`{-~]";

/** A CEL string literal inside an expression, single- or double-quoted (spec §3.1, the expression's end). */
const celString = "\"(?:[^\"\\\\\\r\\n]|\\\\.)*\"|'(?:[^'\\\\\\r\\n]|\\\\.)*'";

/** A JSON string inside a JSON param value (spec §3.1). */
const jsonString = "\"(?:[^\"\\\\\\r\\n]|\\\\.)*\"";

/**
 * The block line forms (spec §3), after a line's indentation (at most 3 spaces, spec §3.2). Each is the start of its
 * line, to its marker and what tells the form: the rest is the params, read by the param pieces above.
 */
const lines = {
  /** `::: name`, a container's opener. */
  containerOpener: `(:::)(${space}+)(${name})`,
  /** `::: /name`, a container's closer. */
  containerCloser: `(:::)(${space}+)(/)(${name})`,
  /** `::: + params`, a param continuation line. */
  continuation: `(:::)(${space}+)(\\+)(?=${space})`,
  /** `:: name`, a leaf. */
  leaf: `(::)(${space}+)(${name})`,
  /** `:: #name`, a slot. */
  slot: `(::)(${space}+)(#)(${name})`,
  /** A line starting with `::` that matches no form: a malformed component line (spec §3.2, rule 7). */
  malformed: "(::+)",
};

/** `:name[`, the start of an inline component (spec §3, §3.2 rule 4: after white space or punctuation). */
const inlineComponentStart = `(:)(${name})(\\[)`;

/** `{{ path }}`, an interpolation (spec §8.1). */
const interpolation = `(\\{\\{)(${space}*)(${interpolationPath})(${space}*)(\\}\\})`;

/** `[[Target]]` and `[[Target|label]]`, a wiki link (spec §2.3, opt-in, parsed always by a grammar). */
const wikiLink = "(\\[\\[)([^\\[\\]|\\r\\n]+)(?:(\\|)([^\\[\\]\\r\\n]+))?(\\]\\])";

/** The frontmatter's `md` key at the start of a line: YAML's `md:`, TOML's `[md]`, `[md.…]`, `[[md.…]]` or `md.…` (spec §2.1). */
const frontmatterKey = {
  yaml: "^(md)(:)",
  toml: "^(?:\\[\\[?(md)(?=[.\\]])|(md)(?=[ \\t]*[.=]))",
};

module.exports = {
  name,
  identifier,
  interpolationPath,
  space,
  bareValue,
  stringEscape,
  celString,
  jsonString,
  lines,
  inlineComponentStart,
  interpolation,
  wikiLink,
  frontmatterKey,
};
