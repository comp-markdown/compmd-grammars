// The node names the grammar adds to @lezer/markdown's tree, in one place so the parsers, the highlighting and the
// grammar's definition agree.

/** The block nodes a component line becomes (CompMD spec §3), and a line that starts with `::` but matches no form. */
export const COMPONENT_LINES = [
  "ComponentOpen",
  "ComponentClose",
  "ComponentLeaf",
  "ComponentSlot",
  "ComponentContinuation",
  "ComponentMalformed",
] as const;

/** One of {@link COMPONENT_LINES}. */
export type ComponentLine = (typeof COMPONENT_LINES)[number];

/** Block nodes other than component lines. */
export const OTHER_BLOCKS = ["Frontmatter", "MathBlock"] as const;

/** Inline and part nodes: the pieces of a component line, an inline component, an interpolation, a wiki link, math. */
export const PARTS = [
  "InlineComponent",
  "ComponentMark",
  "ComponentName",
  "ComponentSlotName",
  "ComponentFallback",
  "ComponentFallbackMark",
  "ParamList",
  "ParamBrace",
  "ParamKey",
  "ParamBreakpoint",
  "ParamEquals",
  "ParamString",
  "ParamExpression",
  "ParamJson",
  "ParamBare",
  "ParamClass",
  "ParamId",
  "Interpolation",
  "InterpolationMark",
  "InterpolationExpression",
  "WikiLink",
  "WikiLinkMark",
  "WikiLinkTarget",
  "WikiLinkLabel",
  "InlineMath",
  "InlineMathMark",
  "MathBlockMark",
  "FrontmatterMark",
] as const;

/**
 * The nodes that are CompMD's own, not Markdown: an editor that draws Markdown in place shows these as their source.
 * A component's fallback (`ComponentFallback`) is inside them but holds ordinary inline Markdown.
 */
export const COMPMD_NODES: ReadonlySet<string> = new Set<string>([
  ...COMPONENT_LINES,
  "InlineComponent",
  "Interpolation",
  "Frontmatter",
]);
