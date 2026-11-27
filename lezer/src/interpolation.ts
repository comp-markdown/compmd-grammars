// Interpolation, `{{path}}` (spec §8.1): in text, in a fallback and in a quoted param string. The form is
// `syntax/patterns.js`'s.

import type { Element, InlineContext } from "@lezer/markdown";
import type { ElementContext } from "./context.ts";
import { PATTERNS } from "./syntax.ts";

const BRACE = 123;

/**
 * An interpolation's form: `{{`, a path of CEL identifiers with white space around it allowed, `}}`. Anything else
 * stays text (W106).
 */
const INTERPOLATION = new RegExp(`^${PATTERNS.interpolation}`);

/** The interpolation at the start of `text`: its length, and where its path is. */
function interpolationAt(text: string): { length: number; path: [number, number] } | undefined {
  const match = INTERPOLATION.exec(text);
  if (!match) return undefined;
  const [, open, before, path] = match as unknown as [string, string, string, string];
  const pathStart = open.length + before.length;
  return { length: match[0].length, path: [pathStart, pathStart + path.length] };
}

/** The `Interpolation` element for the interpolation at `from`. */
function interpolationElement(cx: ElementContext, from: number, found: { length: number; path: [number, number] }): Element {
  const to = from + found.length;
  return cx.elt("Interpolation", from, to, [
    cx.elt("InterpolationMark", from, from + 2),
    cx.elt("InterpolationExpression", from + found.path[0], from + found.path[1]),
    cx.elt("InterpolationMark", to - 2, to),
  ]);
}

/** The interpolations in a quoted param string `text`, which starts at document position `base`. `\{{` isn't one. */
export function interpolationsIn(cx: ElementContext, text: string, base: number): Element[] {
  const found: Element[] = [];
  for (const match of text.matchAll(/(?<!\\)\{\{/g)) {
    const interpolation = interpolationAt(text.slice(match.index));
    if (interpolation) found.push(interpolationElement(cx, base + match.index, interpolation));
  }
  return found;
}

/** The inline parser: `{{path}}` in text and fallbacks. An escaped `\{{` is left to Markdown's escapes. */
export function parseInterpolation(cx: InlineContext, next: number, pos: number): number {
  if (next !== BRACE || cx.char(pos + 1) !== BRACE) return -1;
  const interpolation = interpolationAt(cx.slice(pos, cx.end));
  return interpolation ? cx.addElement(interpolationElement(cx, pos, interpolation)) : -1;
}
