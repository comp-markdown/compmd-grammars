// Highlighting tags for the grammar's nodes. A node that is one of CompMD's shared tokens takes the token's tag
// (`syntax/tokens.json`, through `syntax.ts`), so a name has the same colour group as in every other editor; the rest
// are the grammar's own.

import { styleTags, Tag, tags as t } from "@lezer/highlight";
import { TOKEN_TAGS, type Token } from "./syntax.ts";

/** The token each of the grammar's nodes stands for. */
export const NODE_TOKENS: Readonly<Record<string, Token>> = {
  ComponentMark: "component-marker",
  ComponentName: "component-name",
  ComponentSlotName: "slot-name",
  ComponentFallbackMark: "fallback-bracket",
  ParamBrace: "param-brace",
  ParamKey: "param-key",
  ParamBreakpoint: "breakpoint",
  ParamOperator: "param-operator",
  ParamClassMark: "param-class",
  ParamClassName: "param-class",
  ParamIdMark: "param-id",
  ParamIdName: "param-id",
  ParamString: "param-string",
  ParamEscape: "string-escape",
  ParamBare: "param-bare",
  ParamExpressionMark: "expression-paren",
  InterpolationMark: "interpolation-brace",
  InterpolationExpression: "interpolation-path",
  WikiLinkTarget: "wiki-link-target",
  WikiLinkLabel: "wiki-link-label",
  InlineMath: "math",
  MathBlock: "math",
  FrontmatterKey: "frontmatter-key",
  DefinitionSeparator: "definition-separator",
};

/** The nodes that are no token of their own: what is inside them is another language's, or a mark. */
const OWN_TAGS: Readonly<Record<string, Tag>> = {
  "WikiLinkMark InlineMathMark MathBlockMark FrontmatterMark": t.processingInstruction,
  ParamExpression: t.special(t.variableName),
  ParamJson: t.literal,
  "ComponentMalformed ParamInvalid": t.invalid,
  Frontmatter: t.meta,
};

const MODIFIERS: Readonly<Record<string, (tag: Tag) => Tag>> = {
  special: t.special,
  definition: t.definition,
  constant: t.constant,
  function: t.function,
  standard: t.standard,
  local: t.local,
};

/**
 * The tag a token's tag name stands for: a `@lezer/highlight` tag (`tagName`), or one modified (`special(string)`).
 *
 * @throws when the name isn't one: `tokens.json` names a tag `@lezer/highlight` doesn't have.
 */
export function tagNamed(name: string): Tag {
  const modified = /^(\w+)\((\w+)\)$/.exec(name);
  const modifier = modified ? MODIFIERS[modified[1]!] : undefined;
  const base: unknown = (t as Record<string, unknown>)[modified ? modified[2]! : name];
  if (!(base instanceof Tag) || (modified && !modifier)) throw new Error(`no Lezer tag ${name}`);
  return modifier ? modifier(base) : base;
}

/** The `styleTags` prop for the grammar's nodes. */
export const compmdHighlighting = styleTags({
  ...Object.fromEntries(Object.entries(NODE_TOKENS).map(([node, token]) => [node, tagNamed(TOKEN_TAGS[token])])),
  ...OWN_TAGS,
});
