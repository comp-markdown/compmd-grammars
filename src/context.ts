// What the grammar's parsers need from @lezer/markdown's block and inline contexts: making elements, and parsing a
// fallback's inline Markdown.

import type { Element, MarkdownParser } from "@lezer/markdown";

/** The part of a `BlockContext` or `InlineContext` the grammar's element builders use. */
export interface ElementContext {
  elt(type: string, from: number, to: number, children?: readonly Element[]): Element;
  readonly parser: MarkdownParser;
}
