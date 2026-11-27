// Component lines (spec §3): a container's opener `::: name {…}`, its closer `::: /name`, a continuation `::: + …`, a
// slot `:: #name`, and a leaf `:: name[fallback] {…}`. Each is a single-line block whose children are its parts; a
// container's content between opener and closer stays ordinary Markdown.

import type { BlockContext, Element, Line } from "@lezer/markdown";
import type { ElementContext } from "./context.ts";
import { fallbackElement, paramListElement, spanElements } from "./component-parts.ts";
import { fallbackEnd } from "./fallback.ts";
import type { ComponentLine } from "./nodes.ts";
import { NAME, scanParamBody, scanParamList } from "./params.ts";

/** A parsed component line: its node type and its children. */
interface Parsed {
  readonly type: ComponentLine;
  readonly children: readonly Element[];
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

  /** A name at `from`, as `type`, with the offset after it. */
  name(from: number, type = "ComponentName"): { element: Element; end: number } | undefined {
    const match = NAME.exec(this.rest.slice(from));
    return match ? { element: this.part(type, from, from + match[0].length), end: from + match[0].length } : undefined;
  }

  /** Whether only white space follows `from`. */
  endsAt(from: number): boolean {
    return this.rest.slice(from).trim() === "";
  }

  /** The offset after white space from `from`. */
  skipSpace(from: number): number {
    return from + (/^[ \t]*/.exec(this.rest.slice(from))?.[0].length ?? 0);
  }

  /** The param list at `from` as elements, and the offset after it; `undefined` without a closed list there. */
  paramList(from: number): { elements: Element[]; end: number } | undefined {
    const list = scanParamList(this.rest, from);
    if (!list) return undefined;
    return { elements: [paramListElement(this.cx, list, this.rest, from, this.start)], end: list.end };
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
  const marks = /^:::[ \t]+\+(?=[ \t])/.exec(line.rest);
  if (!marks) return undefined;
  const plus = marks[0].length;
  const body = line.paramBody(plus);
  if (!line.endsAt(body.end)) return undefined;
  return {
    type: "ComponentContinuation",
    children: [line.part("ComponentMark", 0, 3), line.part("ComponentMark", plus - 1, plus), ...body.elements],
  };
}

function closer(line: LineReader): Parsed | undefined {
  const marks = /^:::[ \t]+\//.exec(line.rest);
  if (!marks) return undefined;
  const slash = marks[0].length;
  const name = line.name(slash);
  if (!name || !line.endsAt(name.end)) return { type: "ComponentMalformed", children: [] };
  return {
    type: "ComponentClose",
    children: [line.part("ComponentMark", 0, 3), line.part("ComponentMark", slash - 1, slash), name.element],
  };
}

function opener(line: LineReader): Parsed | undefined {
  const marks = /^:::[ \t]+/.exec(line.rest);
  if (!marks) return undefined;
  const name = line.name(marks[0].length);
  if (!name) return { type: "ComponentMalformed", children: [] };
  const params = line.paramList(line.skipSpace(name.end));
  if (!line.endsAt(params?.end ?? name.end)) return { type: "ComponentMalformed", children: [] };
  return { type: "ComponentOpen", children: [line.part("ComponentMark", 0, 3), name.element, ...(params?.elements ?? [])] };
}

function slot(line: LineReader): Parsed | undefined {
  const marks = /^::[ \t]+#/.exec(line.rest);
  if (!marks) return undefined;
  const hash = marks[0].length;
  const name = line.name(hash, "ComponentSlotName");
  if (!name || !line.endsAt(name.end)) return { type: "ComponentMalformed", children: [] };
  return {
    type: "ComponentSlot",
    children: [line.part("ComponentMark", 0, 2), line.part("ComponentMark", hash - 1, hash), name.element],
  };
}

function leaf(line: LineReader): Parsed | undefined {
  const marks = /^::[ \t]+/.exec(line.rest);
  const name = marks ? line.name(marks[0].length) : undefined;
  if (!name) return undefined;
  const children = [line.part("ComponentMark", 0, 2), name.element];
  let end = name.end;
  if (line.rest[end] === "[") {
    const closed = fallbackEnd(line.rest, end);
    if (closed === undefined) return undefined;
    children.push(line.fallback(end, closed));
    end = closed;
  }
  const params = line.paramList(line.skipSpace(end));
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
  for (const form of FORMS) {
    const parsed = form(line);
    if (parsed) return parsed;
  }
  return { type: "ComponentMalformed", children: [] };
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
