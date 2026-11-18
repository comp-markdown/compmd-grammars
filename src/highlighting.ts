// Highlighting tags for the grammar's nodes. Provisional: CompMD's shared token names (`syntax/tokens.json` in
// `compmd-grammars`) don't exist yet; when they do, these follow them so a name has the same colour in every editor.

import { styleTags, tags as t } from "@lezer/highlight";

/** The `styleTags` prop for the grammar's nodes. */
export const compmdHighlighting = styleTags({
  "ComponentMark ComponentFallbackMark ParamBrace ParamEquals InterpolationMark WikiLinkMark InlineMathMark MathBlockMark FrontmatterMark":
    t.processingInstruction,
  ComponentName: t.tagName,
  ComponentSlotName: t.labelName,
  ParamKey: t.attributeName,
  ParamBreakpoint: t.modifier,
  ParamString: t.string,
  ParamExpression: t.special(t.variableName),
  ParamJson: t.literal,
  ParamBare: t.attributeValue,
  "ParamClass ParamId": t.className,
  InterpolationExpression: t.special(t.variableName),
  "WikiLinkTarget WikiLinkLabel": t.link,
  "InlineMath MathBlock": t.monospace,
  ComponentMalformed: t.invalid,
  Frontmatter: t.meta,
});
