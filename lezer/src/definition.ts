// A component definition (spec §7.2) and a signature fence (§7.1): a fenced code block whose info string is `compmd`
// with a `component=` attribute. Its info string is read in the param syntax, the component's name as a name; its
// signature is the lines before the first `---` line, and a definition's body, after it, is CompMD again, parsed by
// the same parser. Any other fence stays @lezer/markdown's.

import type { BlockContext, Element, Line } from "@lezer/markdown";
import { paramListElement, spanElements } from "./component-parts.ts";
import { scanParamBody, scanParamList, type Scanned, type Span } from "./params.ts";

/** A fence's opening line: its fence, then `compmd` and the rest of the info string. */
const OPENING = /^(`{3,}|~{3,})([ \t]*)compmd(?=[ \t]|$)/;
const LANGUAGE = "compmd";

/** A part of the info string after its language: attributes, or a param list `{…}` from `from`. */
interface InfoPart {
  readonly list: boolean;
  readonly from: number;
  readonly scanned: Scanned;
}

/** A content line: where its text starts and ends, its text, and whether it is the document's line as it is. */
interface ContentLine {
  readonly from: number;
  readonly to: number;
  readonly text: string;
  readonly whole: boolean;
}

/** The info string's attributes and param lists from `from`, until text that is neither. */
function scanInfo(text: string, from: number): InfoPart[] {
  const parts: InfoPart[] = [];
  let at = from;
  for (;;) {
    while (text[at] === " " || text[at] === "\t") at++;
    const list = text[at] === "{";
    const scanned = list ? scanParamList(text, at) : scanParamBody(text, at, "{");
    if (!scanned || scanned.end === at) return parts;
    parts.push({ list, from: at, scanned });
    at = scanned.end;
  }
}

/** Whether `span` is the value of a `component` attribute, among `spans`. */
function isComponentName(text: string, spans: readonly Span[], index: number): boolean {
  const key = spans[index - 2];
  return spans[index]!.type === "ParamBare" && key?.type === "ParamKey" && text.slice(key.from, key.to) === "component";
}

/** Whether the info string names a component. */
function namesComponent(text: string, parts: readonly InfoPart[]): boolean {
  return parts.some((part) => !part.list && part.scanned.spans.some((_, i) => isComponentName(text, part.scanned.spans, i)));
}

/** The info string's elements, `text` starting at document position `base`; the component's name is a `ComponentName`. */
function infoElements(cx: BlockContext, text: string, parts: readonly InfoPart[], base: number): Element[] {
  return parts.flatMap(({ list, from, scanned }) => {
    if (list) return [paramListElement(cx, scanned, text, from, base)];
    const elements = spanElements(cx, scanned, text, base);
    return elements.map((element, i) =>
      isComponentName(text, scanned.spans, i) ? cx.elt("ComponentName", element.from, element.to) : element,
    );
  });
}

/** Whether `line` closes a fence opened by `fence`: the same character, at least as many, then only white space. */
function closes(line: Line, fence: string): boolean {
  const run = /^(`+|~+)[ \t]*$/.exec(line.text.slice(line.pos));
  return line.indent < line.baseIndent + 4 && !!run && run[1]![0] === fence[0] && run[1]!.length >= fence.length;
}

/** `lines` as one element of `type`; a body's CompMD is parsed again when its lines are the document's as they are. */
function linesElement(cx: BlockContext, type: string, lines: readonly ContentLine[], nested: boolean): Element[] {
  if (lines.length === 0) return [];
  const from = lines[0]!.from;
  const to = lines[lines.length - 1]!.to;
  const parsed = nested && lines.every((line) => line.whole);
  const children = parsed ? [cx.elt(cx.parser.parse(lines.map((line) => line.text).join("\n")), from)] : [];
  return [cx.elt(type, from, to, children)];
}

/** The block parser: a definition or a signature fence, to its closing fence or the end of its container. */
export function parseDefinition(cx: BlockContext, line: Line): boolean {
  if (line.indent >= line.baseIndent + 4) return false;
  const text = line.text.slice(line.pos);
  const opening = OPENING.exec(text);
  if (!opening) return false;
  const fence = opening[1]!;
  const languageFrom = opening[0].length - LANGUAGE.length;
  if (fence[0] === "`" && text.includes("`", fence.length)) return false;
  const parts = scanInfo(text, opening[0].length);
  if (!namesComponent(text, parts)) return false;

  const start = cx.lineStart + line.pos;
  const opened = [
    cx.elt("CodeMark", start, start + fence.length),
    cx.elt("CodeInfo", start + languageFrom, start + opening[0].length),
    cx.elt("DefinitionInfo", start + opening[0].length, start + text.trimEnd().length, infoElements(cx, text, parts, start)),
  ];
  const signature: ContentLine[] = [];
  const body: ContentLine[] = [];
  let separator: Element | undefined;
  let closing: Element | undefined;
  let end = start + text.trimEnd().length;
  while (cx.nextLine()) {
    if (closes(line, fence)) {
      const from = cx.lineStart + line.pos;
      end = from + line.text.slice(line.pos).trimEnd().length;
      closing = cx.elt("CodeMark", from, end);
      cx.nextLine();
      break;
    }
    const content = {
      from: cx.lineStart + line.basePos,
      to: cx.lineStart + line.text.length,
      text: line.text.slice(line.basePos),
      whole: line.basePos === 0,
    };
    if (!separator && content.text.trimEnd() === "---") separator = cx.elt("DefinitionSeparator", content.from, content.from + 3);
    else (separator ? body : signature).push(content);
  }
  if (!closing) {
    const last = separator ? body : signature;
    while (last.length && last[last.length - 1]!.text.trim() === "") last.pop();
    end = last[last.length - 1]?.to ?? separator?.to ?? end;
  }
  const children = [
    ...opened,
    ...linesElement(cx, "DefinitionSignature", signature, false),
    ...(separator ? [separator] : []),
    ...linesElement(cx, "DefinitionBody", body, true),
    ...(closing ? [closing] : []),
  ];
  cx.addElement(cx.elt("ComponentDefinition", start, end, children));
  return true;
}
