// A CompMD param list (spec §3.1, §5.1), scanned into spans. Each value finds its own end from its first character,
// so a broken quote or bracket damages only its own line (spec §5).

/** The kind of a span inside a param list. */
export type ParamPart =
  | "ParamKey"
  | "ParamBreakpoint"
  | "ParamEquals"
  | "ParamString"
  | "ParamExpression"
  | "ParamJson"
  | "ParamBare"
  | "ParamClass"
  | "ParamId";

/** One span of a param list, as offsets into the scanned text. */
export interface Span {
  readonly type: ParamPart;
  readonly from: number;
  readonly to: number;
}

/** Spans found, and the offset where scanning stopped. */
export interface Scanned {
  readonly spans: readonly Span[];
  readonly end: number;
}

/** A component's, slot's or param key's name (spec §3.1). */
export const NAME = /^[A-Za-z][A-Za-z0-9_-]*/;

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

function valueSpan(text: string, from: number): Span {
  switch (text[from]) {
    case '"':
      return { type: "ParamString", from, to: stringEnd(text, from) };
    case "(":
      return { type: "ParamExpression", from, to: bracketedEnd(text, from, "(", ")", "\"'") };
    case "[":
      return { type: "ParamJson", from, to: bracketedEnd(text, from, "[", "]", '"') };
    case "{":
      return { type: "ParamJson", from, to: bracketedEnd(text, from, "{", "}", '"') };
    default: {
      let to = from;
      while (to < text.length && !/[\s"()[\]{}]/.test(text[to]!)) to++;
      return { type: "ParamBare", from, to };
    }
  }
}

/** A class `.name` or an id `#name` at `from`. */
function shorthandAt(text: string, from: number): Scanned | undefined {
  const name = NAME.exec(text.slice(from + 1));
  if (!name) return undefined;
  const to = from + 1 + name[0].length;
  return { spans: [{ type: text[from] === "." ? "ParamClass" : "ParamId", from, to }], end: to };
}

/** A key at `from`, with its breakpoint when written `bp:key`. */
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
  const equals: Span = { type: "ParamEquals", from: key.end, to: key.end + 1 };
  const valueAt = key.end + 1;
  if (valueAt >= text.length || isSpace(text[valueAt]) || text[valueAt] === "}") {
    return { spans: [...key.spans, equals], end: valueAt };
  }
  const value = valueSpan(text, valueAt);
  return { spans: [...key.spans, equals, value], end: value.to };
}

/**
 * The params of a param body (no braces) from `from`, up to `stop` (a `}`) or the text's end.
 *
 * @returns the spans, and where the body ended: at `stop`, the text's end, or the first thing that isn't a param.
 *
 * @example
 * scanParamBody('md:gap=l title="A"', 0); // spans ParamBreakpoint, ParamKey, ParamEquals, ParamBare, ParamKey, …
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
 * scanParamList('{title="A" .wide}', 0); // spans ParamKey, ParamEquals, ParamString, ParamClass; end 17
 */
export function scanParamList(text: string, from: number): Scanned | undefined {
  if (text[from] !== "{") return undefined;
  const body = scanParamBody(text, from + 1, "}");
  return text[body.end] === "}" ? { spans: body.spans, end: body.end + 1 } : undefined;
}
