import { describe, expect, it } from "vitest";
import { hasNode, nodes } from "./test/parse.ts";

describe("interpolation", () => {
  it("parses a path, with its marks", () => {
    expect(nodes("# {{md.doc.title}}\n")).toEqual(
      expect.arrayContaining(["Interpolation: {{md.doc.title}}", "InterpolationMark: {{", "InterpolationExpression: md.doc.title"]),
    );
  });

  it("allows spaces and tabs around the path, which stay out of it", () => {
    expect(nodes("{{ md.doc.title }}\n")).toContain("InterpolationExpression: md.doc.title");
    expect(nodes("{{\tmd.doc.title\t}}\n")).toContain("InterpolationExpression: md.doc.title");
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
