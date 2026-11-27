import { describe, expect, it } from "vitest";
import { hasNode, nodes } from "./test/parse.ts";

describe("component definitions", () => {
  const definition = "```compmd component=card {display=flex gap=s}\nparams:\n  title: string\n---\n# {{title}}\n\n:: badge[x]\n```\n";

  it("reads the info string in the param syntax, the component's name as a name", () => {
    expect(nodes(definition)).toEqual(
      expect.arrayContaining([
        "CodeInfo: compmd",
        "ParamKey: component",
        "ComponentName: card",
        "ParamList: {display=flex gap=s}",
        "ParamKey: display",
      ]),
    );
  });

  it("splits the signature from the body at the first --- line", () => {
    expect(nodes(definition)).toEqual(
      expect.arrayContaining(["DefinitionSignature: params:\n  title: string", "DefinitionSeparator: ---"]),
    );
  });

  it("parses the body as CompMD", () => {
    expect(nodes(definition)).toEqual(
      expect.arrayContaining(["InterpolationExpression: title", "ComponentLeaf: :: badge[x]", "ComponentName: badge"]),
    );
  });

  it("reads a signature fence: its signature, with no separator", () => {
    const found = nodes("```compmd component=card signature\nparams:\n  title: string\n```\n");
    expect(found).toEqual(expect.arrayContaining(["ComponentName: card", "ParamKey: signature", "DefinitionSignature: params:\n  title: string"]));
    expect(found.some((node) => node.startsWith("DefinitionSeparator"))).toBe(false);
  });

  it("runs to the end of the document without a closing fence", () => {
    expect(nodes("```compmd component=card\n---\nBody.\n")).toContain("ComponentDefinition: ```compmd component=card\n---\nBody.");
  });

  it("leaves other fences to Markdown: a compmd example, another language", () => {
    expect(hasNode("```compmd\n:: badge[x]\n```\n", "ComponentDefinition")).toBe(false);
    expect(hasNode("```jsx component=card\nexport default 1;\n```\n", "ComponentDefinition")).toBe(false);
    expect(hasNode("```compmd component=card\n---\n```\n", "FencedCode")).toBe(false);
  });
});
