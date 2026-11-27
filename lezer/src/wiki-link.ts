// Wiki links, `[[Target]]` and `[[Target|label]]` (spec §2.3). Parsed always: a grammar can't read the document's
// opt-in (`syntax: [wiki-links]`), as CompMD's other grammars decide.

import type { InlineContext } from "@lezer/markdown";

const BRACKET = 91;

/** The inline parser. A `|` not escaped splits the target from the label; a link never spans lines. */
export function parseWikiLink(cx: InlineContext, next: number, pos: number): number {
  if (next !== BRACKET || cx.char(pos + 1) !== BRACKET) return -1;
  const text = cx.slice(pos, cx.end);
  const close = text.indexOf("]]", 2);
  if (close < 0) return -1;
  const inner = text.slice(2, close);
  if (inner.includes("\n")) return -1;
  const end = pos + close + 2;
  const bar = /(?<!\\)\|/.exec(inner)?.index;
  const parts =
    bar === undefined
      ? [cx.elt("WikiLinkTarget", pos + 2, end - 2)]
      : [
          cx.elt("WikiLinkTarget", pos + 2, pos + 2 + bar),
          cx.elt("WikiLinkMark", pos + 2 + bar, pos + 3 + bar),
          cx.elt("WikiLinkLabel", pos + 3 + bar, end - 2),
        ];
  return cx.addElement(
    cx.elt("WikiLink", pos, end, [cx.elt("WikiLinkMark", pos, pos + 2), ...parts, cx.elt("WikiLinkMark", end - 2, end)]),
  );
}
