import { describe, expect, it } from "vitest";
import { hasNode, nodes } from "./test/parse.ts";

describe("interpolation", () => {
  it("parses a path, with its marks", () => {
    expect(nodes("# {{md.doc.title}}\n")).toEqual(
      expect.arrayContaining(["Interpolation: {{md.doc.title}}", "InterpolationMark: {{", "InterpolationExpression: md.doc.title"]),
    );
  });

  it("allows spaces around the path", () => {
    expect(hasNode("{{ md.doc.title }}\n", "Interpolation")).toBe(true);
  });

  it("leaves an escaped one as text", () => {
    expect(hasNode("Write \\{{name}} here.\n", "Interpolation")).toBe(false);
  });

  it("leaves {{ that holds no path as text (W106)", () => {
    expect(hasNode("{{ 1 + 2 }} and {{a b}}\n", "Interpolation")).toBe(false);
  });

  it("is parsed inside a fallback", () => {
    expect(nodes(":: chart[Since {{md.input.since}}]\n")).toContain("Interpolation: {{md.input.since}}");
  });
});
