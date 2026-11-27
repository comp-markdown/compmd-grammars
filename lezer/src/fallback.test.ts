import { describe, expect, it } from "vitest";
import { fallbackEnd } from "./fallback.ts";

describe("fallbackEnd", () => {
  it("matches nested brackets", () => {
    expect(fallbackEnd("[a [b] c] rest", 0)).toBe(9);
  });

  it("skips escaped brackets", () => {
    expect(fallbackEnd("[a \\] b] rest", 0)).toBe(8);
  });

  it("lets code spans bind tighter", () => {
    expect(fallbackEnd("[b `c]` d] rest", 0)).toBe(10);
  });

  it("returns undefined for a fallback that isn't closed", () => {
    expect(fallbackEnd("[never", 0)).toBeUndefined();
  });
});
