import { describe, expect, it } from "vitest";
import { hasNode, nodes } from "./test/parse.ts";

describe("frontmatter", () => {
  it("parses a --- block at the start, not as Markdown", () => {
    const found = nodes("---\ntitle: A\n---\n\n# Body\n");
    expect(found[0]).toBe("Frontmatter: ---\ntitle: A\n---");
    expect(found.some((node) => /^(SetextHeading\d|HorizontalRule):/.test(node))).toBe(false);
  });

  it("isn't frontmatter anywhere but the start", () => {
    expect(hasNode("Text\n\n---\nx: 1\n---\n", "Frontmatter")).toBe(false);
  });

  it("isn't frontmatter without a closing line", () => {
    expect(hasNode("---\ntitle: A\n", "Frontmatter")).toBe(false);
  });
});
