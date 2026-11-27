import { describe, expect, it } from "vitest";
import { nodes } from "./test/parse.ts";

const inlineMath = (text: string) => nodes(text).filter((node) => node.startsWith("InlineMath:"));

describe("inline math, by Pandoc's rule", () => {
  it("leaves prices as text", () => {
    expect(inlineMath("costs $5 and $10\n")).toEqual([]);
  });

  it("parses math next to prices", () => {
    expect(inlineMath("It costs $5 and $6. Math $x^2$\n")).toEqual(["InlineMath: $x^2$"]);
  });

  it("groups braces, so a $ inside them doesn't close", () => {
    expect(inlineMath("$x{y$ z}$ and\n")).toEqual(["InlineMath: $x{y$ z}$"]);
  });

  it("keeps escapes inside", () => {
    expect(inlineMath("Frame time $p_{95} < 16\\,\\text{ms}$.\n")).toEqual(["InlineMath: $p_{95} < 16\\,\\text{ms}$"]);
  });

  it("isn't opened by a $ before a space", () => {
    expect(inlineMath("a $ b$ c\n")).toEqual([]);
  });
});

describe("display math", () => {
  it("parses $$ lines", () => {
    expect(nodes("$$\nx^2\n$$\n")).toContain("MathBlock: $$\nx^2\n$$");
  });

  it("parses it on one line", () => {
    expect(nodes("$$x^2$$\n")).toContain("MathBlock: $$x^2$$");
  });

  it("ends a paragraph", () => {
    expect(nodes("Text\n$$\nx\n$$\n")).toContain("MathBlock: $$\nx\n$$");
  });
});
