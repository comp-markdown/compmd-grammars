import { classHighlighter, highlightTree } from "@lezer/highlight";
import { describe, expect, it } from "vitest";
import { COMPMD_NODES } from "./nodes.ts";
import { fixture, nodes, parser } from "./test/parse.ts";

/** Markdown nodes inside CompMD's own nodes, outside their fallbacks: there should be none. */
function markdownInsideCompmd(text: string): string[] {
  const found: string[] = [];
  parser.parse(text).iterate({
    enter: (node) => {
      if (!COMPMD_NODES.has(node.name)) return;
      node.node.cursor().iterate((inner) => {
        if (inner.name === "ComponentFallback") return false;
        if (/^(Emphasis|StrongEmphasis|Link|InlineCode|URL|Strikethrough|Autolink|HTMLTag)$/.test(inner.name)) {
          found.push(`${inner.name} in ${node.name}`);
        }
        return undefined;
      });
      return false;
    },
  });
  return found;
}

describe("the spec's complete example", () => {
  const text = fixture("complete.comp.md");
  const found = nodes(text);
  const count = (name: string) => found.filter((node) => node.startsWith(`${name}:`)).length;

  it("parses its frontmatter as frontmatter", () => {
    expect(found[0]).toMatch(/^Frontmatter: ---\ntitle: RayPlay 1.4/);
  });

  it("finds every construct, and no malformed line", () => {
    expect({
      ComponentOpen: count("ComponentOpen"),
      ComponentClose: count("ComponentClose"),
      ComponentLeaf: count("ComponentLeaf"),
      ComponentSlot: count("ComponentSlot"),
      ComponentContinuation: count("ComponentContinuation"),
      ComponentMalformed: count("ComponentMalformed"),
      InlineComponent: count("InlineComponent"),
      WikiLink: count("WikiLink"),
      InlineMath: count("InlineMath"),
      // 12 in text and fallbacks, 1 in a quoted param, 3 in the `card` definition's body; the 2 in link destinations
      // are a known gap (README).
      Interpolation: count("Interpolation"),
    }).toEqual({
      ComponentOpen: 13,
      ComponentClose: 13,
      ComponentLeaf: 3,
      ComponentSlot: 3,
      ComponentContinuation: 1,
      ComponentMalformed: 0,
      InlineComponent: 4,
      WikiLink: 1,
      InlineMath: 1,
      Interpolation: 16,
    });
  });

  it("parses no Markdown inside its CompMD nodes outside fallbacks", () => {
    expect(markdownInsideCompmd(text)).toEqual([]);
  });

  it("gives every CompMD construct a highlighting class", () => {
    const tree = parser.parse(text);
    const styled = new Set<number>();
    highlightTree(tree, classHighlighter, (from) => styled.add(from));
    const unstyled: string[] = [];
    tree.iterate({
      enter: (node) => {
        const highlighted =
          /^(ComponentMark|ComponentName|ComponentSlotName|ParamKey|ParamOperator|ParamString|ParamEscape|ParamExpression|ParamExpressionMark|ParamJson|ParamBare|ParamClassMark|ParamClassName|ParamIdMark|ParamIdName|ParamBreakpoint|InterpolationExpression|WikiLinkTarget|WikiLinkLabel|InlineMath|Frontmatter|FrontmatterKey|DefinitionSeparator)$/;
        if (highlighted.test(node.name) && !styled.has(node.from)) unstyled.push(`${node.name}: ${text.slice(node.from, node.to)}`);
      },
    });
    expect(unstyled).toEqual([]);
  });
});
