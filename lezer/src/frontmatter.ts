// Frontmatter (spec §2.1): a block at the document's start between `---` lines (YAML) or `+++` lines (TOML). Its
// lines are never Markdown, so `---` doesn't become a rule or a setext heading. The `md` key, everything CompMD
// reads, is found by `syntax/patterns.js`'s `frontmatterKey`.

import type { BlockContext, Element, Line } from "@lezer/markdown";
import { PATTERNS } from "./syntax.ts";

/** Each delimiter line, with the pattern of its format's `md` key at a line's start. */
const FORMATS: Readonly<Record<string, RegExp>> = {
  "---": new RegExp(PATTERNS.frontmatterKey.yaml),
  "+++": new RegExp(PATTERNS.frontmatterKey.toml),
};

const KEY = "md";

/** The `FrontmatterKey` on the line `text`, which starts at document position `start`, if it has one. */
function keyOn(cx: BlockContext, key: RegExp, text: string, start: number): Element | undefined {
  const match = key.exec(text);
  if (!match) return undefined;
  const from = start + match[0].lastIndexOf(KEY);
  return cx.elt("FrontmatterKey", from, from + KEY.length);
}

/** The block parser: from a first line `---` or `+++` to the next such line. Without a closing line, it isn't frontmatter. */
export function parseFrontmatter(cx: BlockContext, line: Line): boolean {
  const key = FORMATS[line.text];
  if (cx.lineStart !== 0 || !key) return false;
  const delimiter = line.text;
  const keys: Element[] = [];
  while (cx.nextLine()) {
    if (line.text === delimiter) {
      const end = cx.lineStart + delimiter.length;
      cx.addElement(
        cx.elt("Frontmatter", 0, end, [cx.elt("FrontmatterMark", 0, 3), ...keys, cx.elt("FrontmatterMark", end - 3, end)]),
      );
      cx.nextLine();
      return true;
    }
    const found = keyOn(cx, key, line.text, cx.lineStart);
    if (found) keys.push(found);
  }
  return false;
}
