// Frontmatter (spec §2.1): a `---` block at the document's start. Its lines are YAML or TOML, never Markdown, so `---`
// doesn't become a rule or a setext heading.

import type { BlockContext, Line } from "@lezer/markdown";

/** The block parser: from a first line `---` to the next `---` line. Without a closing line, it isn't frontmatter. */
export function parseFrontmatter(cx: BlockContext, line: Line): boolean {
  if (cx.lineStart !== 0 || line.text !== "---") return false;
  while (cx.nextLine()) {
    if (line.text === "---") {
      const end = cx.lineStart + 3;
      cx.addElement(cx.elt("Frontmatter", 0, end, [cx.elt("FrontmatterMark", 0, 3), cx.elt("FrontmatterMark", end - 3, end)]));
      cx.nextLine();
      return true;
    }
  }
  return false;
}
