import { describe, expect, it } from "vitest";
import { hasNode, nodes } from "./test/parse.ts";

describe("inline components", () => {
  it("parses one with params, and one after punctuation", () => {
    expect(nodes("Total: :value[12,480]{of=(md.sum(x))} (:badge[beta]{tone=info}).\n")).toEqual(
      expect.arrayContaining(["InlineComponent: :value[12,480]{of=(md.sum(x))}", "InlineComponent: :badge[beta]{tone=info}"]),
    );
  });

  it("parses one without params", () => {
    expect(nodes("A :kbd[Esc] key.\n")).toContain("InlineComponent: :kbd[Esc]");
  });

  it("parses its fallback's text as inline Markdown", () => {
    expect(nodes("See :badge[*beta*]{tone=info}.\n")).toContain("Emphasis: *beta*");
  });

  it("isn't one after a letter, a digit or a colon (spec §3.2 rule 4)", () => {
    expect(hasNode("At 10:30[x] and std::vec[0] and a:b[c].\n", "InlineComponent")).toBe(false);
  });

  it("needs a fallback", () => {
    expect(hasNode("A :name{x=1} here.\n", "InlineComponent")).toBe(false);
  });

  it("reads {{ after its fallback as an interpolation, not params", () => {
    expect(nodes(":a[b]{{md.doc.x}}\n")).toEqual(expect.arrayContaining(["InlineComponent: :a[b]", "Interpolation: {{md.doc.x}}"]));
  });
});
