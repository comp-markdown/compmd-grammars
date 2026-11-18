// The parts component lines and inline components share: a param list, and a fallback `[…]`.

import type { Element } from "@lezer/markdown";
import type { ElementContext } from "./context.ts";
import { interpolationsIn } from "./interpolation.ts";
import type { Scanned, Span } from "./params.ts";

function spanElement(cx: ElementContext, span: Span, text: string, base: number): Element {
  const children = span.type === "ParamString" ? interpolationsIn(cx, text.slice(span.from, span.to), base + span.from) : [];
  return cx.elt(span.type, base + span.from, base + span.to, children);
}

/** The spans of `scanned` (offsets into `text`) as elements, `text` starting at document position `base`. */
export function spanElements(cx: ElementContext, scanned: Scanned, text: string, base: number): Element[] {
  return scanned.spans.map((span) => spanElement(cx, span, text, base));
}

/** A `ParamList` element for the list `{…}` from `from` (offsets into `text`, which starts at `base`). */
export function paramListElement(cx: ElementContext, list: Scanned, text: string, from: number, base: number): Element {
  return cx.elt("ParamList", base + from, base + list.end, [
    cx.elt("ParamBrace", base + from, base + from + 1),
    ...spanElements(cx, list, text, base),
    cx.elt("ParamBrace", base + list.end - 1, base + list.end),
  ]);
}

/** A `ComponentFallback` element for `[…]` from `from` to `to` (offsets into `text`), its inside parsed as inline Markdown. */
export function fallbackElement(cx: ElementContext, text: string, from: number, to: number, base: number): Element {
  return cx.elt("ComponentFallback", base + from, base + to, [
    cx.elt("ComponentFallbackMark", base + from, base + from + 1),
    ...cx.parser.parseInline(text.slice(from + 1, to - 1), base + from + 1),
    cx.elt("ComponentFallbackMark", base + to - 1, base + to),
  ]);
}
