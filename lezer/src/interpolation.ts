// Interpolation, `{{path}}` (spec §8.1): in text, in a fallback and in a quoted param string.

import type { Element, InlineContext } from "@lezer/markdown";
import type { ElementContext } from "./context.ts";

const BRACE = 123;

/** An interpolation's form: a path of CEL identifiers, with spaces around it allowed. Anything else stays text (W106). */
const PATH = /^ *[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)* *$/;

/** Whether `inside` (the text between `{{` and `}}`) is an interpolation's path. */
export function isInterpolationPath(inside: string): boolean {
  return PATH.test(inside);
}

/** The `Interpolation` element for `{{…}}` from `from` to `to`. */
export function interpolationElement(cx: ElementContext, from: number, to: number): Element {
  return cx.elt("Interpolation", from, to, [
    cx.elt("InterpolationMark", from, from + 2),
    cx.elt("InterpolationExpression", from + 2, to - 2),
    cx.elt("InterpolationMark", to - 2, to),
  ]);
}

/** The interpolations in a quoted param string `text`, which starts at document position `base`. `\{{` isn't one. */
export function interpolationsIn(cx: ElementContext, text: string, base: number): Element[] {
  const found: Element[] = [];
  for (const match of text.matchAll(/(?<!\\)\{\{([^}\n]*)\}\}/g)) {
    if (!isInterpolationPath(match[1]!)) continue;
    const from = base + match.index;
    found.push(interpolationElement(cx, from, from + match[0].length));
  }
  return found;
}

/** The inline parser: `{{path}}` in text and fallbacks. An escaped `\{{` is left to Markdown's escapes. */
export function parseInterpolation(cx: InlineContext, next: number, pos: number): number {
  if (next !== BRACE || cx.char(pos + 1) !== BRACE) return -1;
  const close = cx.slice(pos, cx.end).indexOf("}}", 2);
  if (close < 0 || !isInterpolationPath(cx.slice(pos + 2, pos + close))) return -1;
  return cx.addElement(interpolationElement(cx, pos, pos + close + 2));
}
