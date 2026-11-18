// Math (spec §2.3): inline `$…$` by Pandoc's rule, and display math on `$$` lines.

import type { BlockContext, InlineContext, Line } from "@lezer/markdown";

const DOLLAR = 36;
const BACKSLASH = 92;
const OPEN_BRACE = 123;
const CLOSE_BRACE = 125;

const isSpace = (code: number): boolean => code === 32 || code === 9 || code === 10 || code === 13 || code === -1;
const isDigit = (code: number): boolean => code >= 48 && code <= 57;

/**
 * The inline parser, by Pandoc's rule: the opener is followed by a non-space, the closer preceded by one and not
 * followed by a digit, braces group (a `$` inside them doesn't close). So "costs $5 and $10" stays text.
 */
export function parseInlineMath(cx: InlineContext, next: number, pos: number): number {
  if (next !== DOLLAR || cx.char(pos + 1) === DOLLAR || isSpace(cx.char(pos + 1))) return -1;
  let depth = 0;
  for (let at = pos + 1; at < cx.end; at++) {
    const char = cx.char(at);
    if (char === BACKSLASH) at++;
    else if (char === OPEN_BRACE) depth++;
    else if (char === CLOSE_BRACE) depth = Math.max(0, depth - 1);
    else if (char === DOLLAR && depth === 0) {
      if (isSpace(cx.char(at - 1))) return -1;
      if (isDigit(cx.char(at + 1))) continue;
      return cx.addElement(
        cx.elt("InlineMath", pos, at + 1, [cx.elt("InlineMathMark", pos, pos + 1), cx.elt("InlineMathMark", at, at + 1)]),
      );
    }
  }
  return -1;
}

function startsMathBlock(line: Line): boolean {
  return line.indent < line.baseIndent + 4 && line.text.startsWith("$$", line.pos);
}

/** Adds the `MathBlock` from `start` to the end of the current line, and moves past it. */
function closeMathBlock(cx: BlockContext, line: Line, start: number): true {
  const end = cx.lineStart + line.text.trimEnd().length;
  cx.addElement(cx.elt("MathBlock", start, end, [cx.elt("MathBlockMark", start, start + 2), cx.elt("MathBlockMark", end - 2, end)]));
  cx.nextLine();
  return true;
}

/** The block parser: from a line starting with `$$` to the first line ending with `$$`, which may be the same line. */
export function parseMathBlock(cx: BlockContext, line: Line): boolean {
  if (!startsMathBlock(line)) return false;
  const start = cx.lineStart + line.pos;
  const first = line.text.slice(line.pos).trimEnd();
  if (first.length > 4 && first.endsWith("$$")) return closeMathBlock(cx, line, start);
  while (cx.nextLine()) {
    if (line.text.trimEnd().endsWith("$$")) return closeMathBlock(cx, line, start);
  }
  return false;
}

/** Ends a paragraph at a `$$` line. */
export const endLeafAtMathBlock = (_cx: BlockContext, line: Line): boolean => startsMathBlock(line);
