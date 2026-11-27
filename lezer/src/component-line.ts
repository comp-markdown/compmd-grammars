// Component lines (spec §3): a container's opener `::: name {…}`, its closer `::: /name`, a continuation `::: + …`, a
// slot `:: #name`, and a leaf `:: name[fallback] {…}`. Each is a single-line block whose children are its parts; a
// container's content between opener and closer stays ordinary Markdown. The forms are `syntax/patterns.js`'s.

import type { BlockContext, Element, Line } from "@lezer/markdown";
import type { ElementContext } from "./context.ts";
import { fallbackElement, invalidParamsElement, paramListElement, spanElements } from "./component-parts.ts";
import { fallbackEnd } from "./fallback.ts";
import type { ComponentLine } from "./nodes.ts";
import { scanParamBody, scanParamList } from "./params.ts";
import { PATTERNS } from "./syntax.ts";

/** A line form's pattern, at the line's start. */
const form = (source: string): RegExp => new RegExp(`^${source}`);

const CONTINUATION = form(PATTERNS.lines.continuation);
const CLOSER = form(PATTERNS.lines.containerCloser);
const OPENER = form(PATTERNS.lines.containerOpener);
const SLOT = form(PATTERNS.lines.slot);
const LEAF = form(PATTERNS.lines.leaf);

/** A form's marks without what must follow them: a line with them that matches no form is malformed, not text. */
const CONTAINER_MARKS = form(`:::${PATTERNS.space}+`);
const CLOSER_MARKS = form(`:::${PATTERNS.space}+/`);
const SLOT_MARKS = form(`::${PATTERNS.space}+#`);

/** A parsed component line: its node type and its children. */
interface Parsed {
  readonly type: ComponentLine;
  readonly children: readonly Element[];
}

const MALFORMED: Parsed = { type: "ComponentMalformed", children: [] };

/** Where each group of a form's match ends, as offsets into the line. */
function groupEnds(match: RegExpExecArray): number[] {
  let at = 0;
  return match.slice(1).map((group) => (at += group?.length ?? 0));
}

/** Builds the parts of one line, `rest` (the line from its `::`), which starts at document position `start`. */
class LineReader {
  constructor(
    private readonly cx: ElementContext,
    readonly rest: string,
    private readonly start: number,
  ) {}

  part(type: string, from: number, to: number): Element {
    return this.cx.elt(type, this.start + from, this.start + to);
  }

  /** Whether only white space follows `from`. */
  endsAt(from: number): boolean {
    return this.rest.slice(from).trim() === "";
  }

  /** The offset after white space from `from`. */
  skipSpace(from: number): number {
    return from + (/^[ \t]*/.exec(this.rest.slice(from))?.[0].length ?? 0);
  }

  /**
   * The param list at `from` as elements, and the offset after it; a list that isn't closed is invalid to the line's
   * end, so the line keeps its form (spec §5). `undefined` without a `{` there.
   */
  params(from: number): { elements: Element[]; end: number } | undefined {
    if (this.rest[from] !== "{") return undefined;
    const list = scanParamList(this.rest, from);
    if (list) return { elements: [paramListElement(this.cx, list, this.rest, from, this.start)], end: list.end };
    const end = this.rest.trimEnd().length;
    return { elements: [invalidParamsElement(this.cx, from, end, this.start)], end };
  }

  paramBody(from: number): { elements: Element[]; end: number } {
    const body = scanParamBody(this.rest, from);
    return { elements: spanElements(this.cx, body, this.rest, this.start), end: body.end };
  }

  fallback(from: number, to: number): Element {
    return fallbackElement(this.cx, this.rest, from, to, this.start);
  }
}

function continuation(line: LineReader): Parsed | undefined {
  const match = CONTINUATION.exec(line.rest);
  if (!match) return undefined;
  const [marker, , plus] = groupEnds(match) as [number, number, number];
  const body = line.paramBody(plus);
  if (!line.endsAt(body.end)) return undefined;
  return {
    type: "ComponentContinuation",
    children: [line.part("ComponentMark", 0, marker), line.part("ComponentMark", plus - 1, plus), ...body.elements],
  };
}

function closer(line: LineReader): Parsed | undefined {
  const match = CLOSER.exec(line.rest);
  if (!match) return CLOSER_MARKS.test(line.rest) ? MALFORMED : undefined;
  const [marker, , slash, name] = groupEnds(match) as [number, number, number, number];
  if (!line.endsAt(name)) return MALFORMED;
  return {
    type: "ComponentClose",
    children: [line.part("ComponentMark", 0, marker), line.part("ComponentMark", slash - 1, slash), line.part("ComponentName", slash, name)],
  };
}

function opener(line: LineReader): Parsed | undefined {
  if (!CONTAINER_MARKS.test(line.rest)) return undefined;
  const match = OPENER.exec(line.rest);
  if (!match) return MALFORMED;
  const [marker, space, name] = groupEnds(match) as [number, number, number];
  const params = line.params(line.skipSpace(name));
  if (!line.endsAt(params?.end ?? name)) return MALFORMED;
  return {
    type: "ComponentOpen",
    children: [line.part("ComponentMark", 0, marker), line.part("ComponentName", space, name), ...(params?.elements ?? [])],
  };
}

function slot(line: LineReader): Parsed | undefined {
  const match = SLOT.exec(line.rest);
  if (!match) return SLOT_MARKS.test(line.rest) ? MALFORMED : undefined;
  const [marker, , hash, name] = groupEnds(match) as [number, number, number, number];
  if (!line.endsAt(name)) return MALFORMED;
  return {
    type: "ComponentSlot",
    children: [line.part("ComponentMark", 0, marker), line.part("ComponentMark", hash - 1, hash), line.part("ComponentSlotName", hash, name)],
  };
}

function leaf(line: LineReader): Parsed | undefined {
  const match = LEAF.exec(line.rest);
  if (!match) return undefined;
  const [marker, space, name] = groupEnds(match) as [number, number, number];
  const children = [line.part("ComponentMark", 0, marker), line.part("ComponentName", space, name)];
  let end = name;
  if (line.rest[end] === "[") {
    const closed = fallbackEnd(line.rest, end);
    if (closed === undefined) return undefined;
    children.push(line.fallback(end, closed));
    end = closed;
  }
  const params = line.params(line.skipSpace(end));
  if (params) {
    children.push(...params.elements);
    end = params.end;
  }
  return line.endsAt(end) ? { type: "ComponentLeaf", children } : undefined;
}

/** The forms in the order they are tried: the longest marks first. */
const FORMS = [continuation, closer, opener, slot, leaf];

/** Parses one line that starts with `::` (`rest`), at document position `start`; a line matching no form is malformed (F016). */
export function parseComponentLine(cx: ElementContext, rest: string, start: number): Parsed {
  const line = new LineReader(cx, rest, start);
  for (const tryForm of FORMS) {
    const parsed = tryForm(line);
    if (parsed) return parsed;
  }
  return MALFORMED;
}

/** Whether `line` starts a component line: `::` at its start, indented less than code. */
export function startsComponentLine(line: Line): boolean {
  return line.indent < line.baseIndent + 4 && line.text.startsWith("::", line.pos);
}

/** The block parser: one component line, one block. */
export function parseComponentLineBlock(cx: BlockContext, line: Line): boolean {
  if (!startsComponentLine(line)) return false;
  const start = cx.lineStart + line.pos;
  const { type, children } = parseComponentLine(cx, line.text.slice(line.pos), start);
  cx.addElement(cx.elt(type, start, cx.lineStart + line.text.trimEnd().length, children));
  cx.nextLine();
  return true;
}

/** Ends a paragraph at a component line, so it is never a paragraph's lazy continuation. */
export const endLeafAtComponentLine = (_cx: BlockContext, line: Line): boolean => startsComponentLine(line);
