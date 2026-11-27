import { describe, expect, it } from "vitest";
import { hasNode, nodes } from "./test/parse.ts";

describe("component lines", () => {
  it("parses a container's opener with its params, its closer, and Markdown between them", () => {
    expect(nodes('::: card {title="Setup" .wide md:gap=l}\nRun *it*.\n::: /card\n')).toEqual(
      expect.arrayContaining([
        'ComponentOpen: ::: card {title="Setup" .wide md:gap=l}',
        "ComponentName: card",
        'ParamString: "Setup"',
        "ParamClass: .wide",
        "ParamBreakpoint: md",
        "Emphasis: *it*",
        "ComponentClose: ::: /card",
      ]),
    );
  });

  it("parses an opener without params", () => {
    expect(nodes("::: box\n::: /box\n")).toContain("ComponentOpen: ::: box");
  });

  it("parses a leaf with a fallback holding inline Markdown, and an expression param", () => {
    expect(nodes(":: chart[Daily *installs*] {rows=(md.data.x.filter(i, i.n > 1)) type=bar}\n")).toEqual(
      expect.arrayContaining([
        "ComponentLeaf: :: chart[Daily *installs*] {rows=(md.data.x.filter(i, i.n > 1)) type=bar}",
        "ComponentFallback: [Daily *installs*]",
        "Emphasis: *installs*",
        "ParamExpression: (md.data.x.filter(i, i.n > 1))",
      ]),
    );
  });

  it("parses a leaf with neither fallback nor params", () => {
    expect(nodes(":: divider\n")).toContain("ComponentLeaf: :: divider");
  });

  it("parses slots and continuation lines", () => {
    expect(nodes('::: grid {gap=m}\n::: + md:grid-template-columns="2fr 1fr"\n:: #footer\nText.\n::: /grid\n')).toEqual(
      expect.arrayContaining([
        'ComponentContinuation: ::: + md:grid-template-columns="2fr 1fr"',
        "ComponentSlot: :: #footer",
        "ComponentSlotName: footer",
      ]),
    );
  });

  it("marks lines that start with :: but match no form as malformed (F016)", () => {
    expect(nodes(":::card\n")).toContain("ComponentMalformed: :::card");
    expect(nodes(":: /card\n")).toContain("ComponentMalformed: :: /card");
    expect(nodes(":: chart[never closed\n")).toContain("ComponentMalformed: :: chart[never closed");
  });

  it("keeps a line's form when its param list isn't closed, the list invalid (spec §5)", () => {
    expect(nodes('::: card {title="Setup}\n')).toEqual(
      expect.arrayContaining(['ComponentOpen: ::: card {title="Setup}', "ComponentName: card", 'ParamInvalid: {title="Setup}']),
    );
    expect(nodes(":: chart[A] {x=1\n")).toEqual(expect.arrayContaining(["ComponentLeaf: :: chart[A] {x=1", "ParamInvalid: {x=1"]));
  });

  it("ends a paragraph, so a component line is never its lazy continuation", () => {
    expect(nodes("Some text\n:: chart[A] {x=1}\n")).toContain("ComponentLeaf: :: chart[A] {x=1}");
  });

  it("is a component line in list items and quotes", () => {
    expect(hasNode("- Install\n\n  ::: card\n  Run.\n  ::: /card\n", "ComponentOpen")).toBe(true);
    expect(hasNode("> ::: callout {kind=tip}\n> A tip.\n> ::: /callout\n", "ComponentClose")).toBe(true);
  });

  it("is not one in fenced or indented code", () => {
    expect(hasNode("```\n::: card\n```\n", "ComponentOpen")).toBe(false);
    expect(hasNode("    ::: card\n", "ComponentOpen")).toBe(false);
  });

  it("parses no Markdown inside params", () => {
    const found = nodes(':: chart[A] {label="*not* `code` [x](y)" note=_x_}\n');
    expect(found.filter((node) => /^(Emphasis|InlineCode|Link):/.test(node))).toEqual([]);
  });

  it("finds interpolation in a quoted param string", () => {
    expect(nodes('::: card {title="Step {{n}}"}\n::: /card\n')).toContain("InterpolationExpression: n");
  });
});
