// The grammar: CompMD's syntax as one @lezer/markdown extension.

import type { MarkdownConfig } from "@lezer/markdown";
import { endLeafAtComponentLine, parseComponentLineBlock } from "./component-line.ts";
import { parseFrontmatter } from "./frontmatter.ts";
import { compmdHighlighting } from "./highlighting.ts";
import { parseInlineComponent } from "./inline-component.ts";
import { parseInterpolation } from "./interpolation.ts";
import { endLeafAtMathBlock, parseInlineMath, parseMathBlock } from "./math.ts";
import { COMPONENT_LINES, OTHER_BLOCKS, PARTS } from "./nodes.ts";
import { parseWikiLink } from "./wiki-link.ts";

/**
 * CompMD's syntax (spec v1 §2.1, §2.3, §3, §8.1) for `@lezer/markdown`: frontmatter, component lines, inline
 * components with their params and fallbacks, interpolation, wiki links, and math by Pandoc's rule. Use it with GFM,
 * which CompMD's base syntax includes.
 *
 * @example
 * import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
 * import { compmd } from "@compmd/lezer";
 *
 * const language = markdown({ base: markdownLanguage, extensions: [compmd] });
 */
export const compmd: MarkdownConfig = {
  defineNodes: [
    ...[...COMPONENT_LINES, ...OTHER_BLOCKS].map((name) => ({ name, block: true })),
    ...PARTS,
  ],
  props: [compmdHighlighting],
  parseBlock: [
    { name: "Frontmatter", parse: parseFrontmatter, before: "HorizontalRule" },
    { name: "ComponentLine", parse: parseComponentLineBlock, before: "FencedCode", endLeaf: endLeafAtComponentLine },
    { name: "MathBlock", parse: parseMathBlock, before: "FencedCode", endLeaf: endLeafAtMathBlock },
  ],
  parseInline: [
    { name: "Interpolation", parse: parseInterpolation, before: "Emphasis" },
    { name: "InlineComponent", parse: parseInlineComponent, before: "Emphasis" },
    { name: "WikiLink", parse: parseWikiLink, before: "Link" },
    { name: "InlineMath", parse: parseInlineMath, before: "Emphasis" },
  ],
};
