// Inline components, `:name[fallback]{…}` (spec §3.2).

import type { InlineContext } from "@lezer/markdown";
import { fallbackElement, paramListElement } from "./component-parts.ts";
import { fallbackEnd } from "./fallback.ts";
import { NAME, scanParamList } from "./params.ts";

const COLON = 58;

/** Where an inline component may start (spec §3.2 rule 4): at the start, or after white space or punctuation other than `:` and `\`. */
function mayStartAt(cx: InlineContext, pos: number): boolean {
  if (pos === cx.offset) return true;
  const before = String.fromCharCode(cx.char(pos - 1));
  return /\s/.test(before) || (/[\p{P}\p{S}]/u.test(before) && before !== ":" && before !== "\\");
}

/** The inline parser. A fallback is required; `{{` right after it starts an interpolation, not a param list (spec §3.1). */
export function parseInlineComponent(cx: InlineContext, next: number, pos: number): number {
  if (next !== COLON || !mayStartAt(cx, pos)) return -1;
  const text = cx.slice(pos, cx.end);
  const name = NAME.exec(text.slice(1));
  if (!name) return -1;
  const fallbackAt = 1 + name[0].length;
  if (text[fallbackAt] !== "[") return -1;
  const fallback = fallbackEnd(text, fallbackAt);
  if (fallback === undefined) return -1;
  const list = text.startsWith("{{", fallback) ? undefined : scanParamList(text, fallback);
  const children = [
    cx.elt("ComponentMark", pos, pos + 1),
    cx.elt("ComponentName", pos + 1, pos + fallbackAt),
    fallbackElement(cx, text, fallbackAt, fallback, pos),
    ...(list ? [paramListElement(cx, list, text, fallback, pos)] : []),
  ];
  return cx.addElement(cx.elt("InlineComponent", pos, pos + (list?.end ?? fallback), children));
}
