import { describe, expect, it } from "vitest";
import { hasNode, nodes } from "./test/parse.ts";

describe("frontmatter", () => {
  it("parses a --- block at the start, not as Markdown", () => {
    const found = nodes("---\ntitle: A\n---\n\n# Body\n");
    expect(found[0]).toBe("Frontmatter: ---\ntitle: A\n---");
    expect(found.some((node) => /^(SetextHeading\d|HorizontalRule):/.test(node))).toBe(false);
  });

  it("parses a +++ block, TOML, the same way", () => {
    expect(nodes('+++\ntitle = "A"\n+++\n')[0]).toBe('Frontmatter: +++\ntitle = "A"\n+++');
  });

  it("marks the md key, in YAML and in each of TOML's forms", () => {
    expect(nodes("---\nmd:\n  version: 1\ntitle: A\n---\n")).toContain("FrontmatterKey: md");
    const toml = nodes('+++\nmd.version = 1\n[md]\nlang = "en"\n[[md.data]]\nfrom = "a.csv"\n+++\n');
    expect(toml.filter((node) => node === "FrontmatterKey: md")).toHaveLength(3);
  });

  it("doesn't mark a key that only starts with md", () => {
    expect(hasNode("---\nmdx: 1\n---\n", "FrontmatterKey")).toBe(false);
  });

  it("isn't frontmatter anywhere but the start", () => {
    expect(hasNode("Text\n\n---\nx: 1\n---\n", "Frontmatter")).toBe(false);
  });

  it("isn't frontmatter without a closing line", () => {
    expect(hasNode("---\ntitle: A\n", "Frontmatter")).toBe(false);
  });
});
