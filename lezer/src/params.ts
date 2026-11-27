// A CompMD param list (spec §3.1, §5.1), scanned into spans. Each value finds its own end from its first character,
// so a broken quote or bracket damages only its own line (spec §5). The pieces every grammar shares (a name, a bare
// value, an escape) are `syntax/patterns.js`'s.

import { PATTERNS } from "./syntax.ts";

/** The kind of a span inside a param list. */
export type ParamPart =
  | "ParamKey"
  | "ParamBreakpoint"
  | "ParamOperator"
  | "ParamString"
  | "ParamEscape"
  | "ParamExpression"
  | "ParamExpressionMark"
  | "ParamJson"
  | "ParamBare"
  | "ParamClass"
  | "ParamClassMark"
  | "ParamClassName"
  | "ParamId"
  | "ParamIdMark"
  | "ParamIdName";

/** One span of a param list, as offsets into the scanned text, with the spans inside it. */
export interface Span {
  readonly type: ParamPart;
  readonly from: number;
  readonly to: number;
  readonly parts?: readonly Span[];
}

/** Spans found, and the offset where scanning stopped. */
export interface Scanned {
  readonly spans: readonly Span[];
  readonly end: number;
}

/** A component's, slot's or param key's name (spec §3.1). */
const NAME = new RegExp(`^${PATTERNS.name}`);

const BARE_VALUE = new RegExp(`^${PATTERNS.bareValue}`);
const ESCAPE = new RegExp(PATTERNS.stringEscape, "g");

const isSpace = (char: string | undefined): boolean => char === " " || char === "\t";

/** After the `"` that closes a string starting at `from`, or the text's end. */
function stringEnd(text: string, from: number): number {
  for (let at = from + 1; at < text.length; at++) {
    if (text[at] === "\\") at++;
    else if (text[at] === '"') return at + 1;
  }
  return text.length;
}

/**
 * After the bracket matching the one at `from`, counting only outside strings, or the text's end. An expression's
 * strings are CEL's (`"…"`, `'…'`), a JSON value's are `"…"`. CEL's triple-quoted, raw and bytes literals are not
 * told apart (see the README's limits).
 */
function bracketedEnd(text: string, from: number, open: string, close: string, quotes: string): number {
  let depth = 0;
  for (let at = from; at < text.length; at++) {
    const char = text[at]!;
    if (quotes.includes(char)) {
      for (at++; at < text.length && text[at] !== char; at++) if (text[at] === "\\") at++;
    } else if (char === open) depth++;
    else if (char === close && --depth === 0) return at + 1;
  }
  return text.length;
}

/** A quoted string from `from`, with its escapes. */
function stringSpan(text: string, from: number): Span {
  const to = stringEnd(text, from);
  const parts = [...text.slice(from, to).matchAll(ESCAPE)].map(
    (match): Span => ({ type: "ParamEscape", from: from + match.index, to: from + match.index + match[0].length }),
  );
  return { type: "ParamString", from, to, parts };
}

/** An expression `(…)` from `from`, with its parentheses when it is closed. */
function expressionSpan(text: string, from: number): Span {
  const to = bracketedEnd(text, from, "(", ")", "\"'");
  const open: Span = { type: "ParamExpressionMark", from, to: from + 1 };
  const closed = to - from > 1 && text[to - 1] === ")";
  const parts = closed ? [open, { type: "ParamExpressionMark", from: to - 1, to } as const] : [open];
  return { type: "ParamExpression", from, to, parts };
}

function valueSpan(text: string, from: number): Span {
  switch (text[from]) {
    case '"':
      return stringSpan(text, from);
    case "(":
      return expressionSpan(text, from);
    case "[":
      return { type: "ParamJson", from, to: bracketedEnd(text, from, "[", "]", '"') };
    case "{":
      return { type: "ParamJson", from, to: bracketedEnd(text, from, "{", "}", '"') };
    default:
      return { type: "ParamBare", from, to: from + (BARE_VALUE.exec(text.slice(from))?.[0].length ?? 0) };
  }
}

/** A class `.name` or an id `#name` at `from`, its mark and its name each a span of their own. */
function shorthandAt(text: string, from: number): Scanned | undefined {
  const name = NAME.exec(text.slice(from + 1));
  if (!name) return undefined;
  const to = from + 1 + name[0].length;
  const [type, mark, named] =
    text[from] === "." ? (["ParamClass", "ParamClassMark", "ParamClassName"] as const) : (["ParamId", "ParamIdMark", "ParamIdName"] as const);
  const parts: Span[] = [
    { type: mark, from, to: from + 1 },
    { type: named, from: from + 1, to },
  ];
  return { spans: [{ type, from, to, parts }], end: to };
}

/** A key at `from`, with its breakpoint and the `:` after it when written `bp:key`. */
function keyAt(text: string, from: number): Scanned | undefined {
  const first = NAME.exec(text.slice(from));
  if (!first) return undefined;
  const afterFirst = from + first[0].length;
  const key = text[afterFirst] === ":" ? NAME.exec(text.slice(afterFirst + 1)) : null;
  if (!key) return { spans: [{ type: "ParamKey", from, to: afterFirst }], end: afterFirst };
  const end = afterFirst + 1 + key[0].length;
  return {
    spans: [
      { type: "ParamBreakpoint", from, to: afterFirst },
      { type: "ParamOperator", from: afterFirst, to: afterFirst + 1 },
      { type: "ParamKey", from: afterFirst + 1, to: end },
    ],
    end,
  };
}

/** One param at `from`: `key=value`, `bp:key=value`, `.class`, `#id` or a lone `key`. */
function paramAt(text: string, from: number): Scanned | undefined {
  if (text[from] === "." || text[from] === "#") return shorthandAt(text, from);
  const key = keyAt(text, from);
  if (!key || text[key.end] !== "=") return key;
  const operator: Span = { type: "ParamOperator", from: key.end, to: key.end + 1 };
  const valueAt = key.end + 1;
  if (valueAt >= text.length || isSpace(text[valueAt]) || text[valueAt] === "}") {
    return { spans: [...key.spans, operator], end: valueAt };
  }
  const value = valueSpan(text, valueAt);
  return { spans: [...key.spans, operator, value], end: value.to };
}

/**
 * The params of a param body (no braces) from `from`, up to `stop` (a `}`) or the text's end.
 *
 * @returns the spans, and where the body ended: at `stop`, the text's end, or the first thing that isn't a param.
 *
 * @example
 * scanParamBody('md:gap=l title="A"', 0); // spans ParamBreakpoint, ParamOperator, ParamKey, ParamOperator, ParamBare, …
 */
export function scanParamBody(text: string, from: number, stop?: string): Scanned {
  const spans: Span[] = [];
  let at = from;
  for (;;) {
    while (isSpace(text[at])) at++;
    if (at >= text.length || text[at] === stop) return { spans, end: at };
    const param = paramAt(text, at);
    if (!param) return { spans, end: at };
    spans.push(...param.spans);
    at = param.end;
  }
}

/**
 * A param list `{…}` whose `{` is at `from`.
 *
 * @returns its spans and the offset after its `}`, or `undefined` when there is no `{` at `from` or the list isn't
 * closed.
 *
 * @example
 * scanParamList('{title="A" .wide}', 0); // spans ParamKey, ParamOperator, ParamString, ParamClass; end 17
 */
export function scanParamList(text: string, from: number): Scanned | undefined {
  if (text[from] !== "{") return undefined;
  const body = scanParamBody(text, from + 1, "}");
  return text[body.end] === "}" ? { spans: body.spans, end: body.end + 1 } : undefined;
}
