import { describe, expect, it } from "vitest";
import { hasNode, nodes } from "./test/parse.ts";

describe("wiki links", () => {
  it("parses a target alone, and a target with a label", () => {
    expect(nodes("Read [[Upgrade guide|upgrade guide]] and [[Home]].\n")).toEqual(
      expect.arrayContaining([
        "WikiLink: [[Upgrade guide|upgrade guide]]",
        "WikiLinkTarget: Upgrade guide",
        "WikiLinkLabel: upgrade guide",
        "WikiLinkTarget: Home",
      ]),
    );
  });

  it("keeps an escaped bar in the target", () => {
    expect(nodes("[[A \\| B]]\n")).toContain("WikiLinkTarget: A \\| B");
  });

  it("isn't one when not closed on its line", () => {
    expect(hasNode("[[Never\nclosed]]\n", "WikiLink")).toBe(false);
  });
});
