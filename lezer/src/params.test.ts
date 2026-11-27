import { describe, expect, it } from "vitest";
import { scanParamBody, scanParamList } from "./params.ts";

/** The spans of a scan, as `Type: text`. */
const spans = (text: string, scanned: ReturnType<typeof scanParamBody> | undefined) =>
  scanned?.spans.map((span) => `${span.type}: ${text.slice(span.from, span.to)}`);

describe("scanParamList", () => {
  it("scans each kind of value, key and shorthand", () => {
    const text = '{title="A b" rows=(md.data.x) list=[1,2] map={"a":1} gap=m .wide #intro md:gap=l open}';
    expect(spans(text, scanParamList(text, 0))).toEqual([
      "ParamKey: title",
      "ParamEquals: =",
      'ParamString: "A b"',
      "ParamKey: rows",
      "ParamEquals: =",
      "ParamExpression: (md.data.x)",
      "ParamKey: list",
      "ParamEquals: =",
      "ParamJson: [1,2]",
      "ParamKey: map",
      "ParamEquals: =",
      'ParamJson: {"a":1}',
      "ParamKey: gap",
      "ParamEquals: =",
      "ParamBare: m",
      "ParamClass: .wide",
      "ParamId: #intro",
      "ParamBreakpoint: md",
      "ParamKey: gap",
      "ParamEquals: =",
      "ParamBare: l",
      "ParamKey: open",
    ]);
  });

  it("ends after the closing brace", () => {
    expect(scanParamList("{a=1} rest", 0)?.end).toBe(5);
  });

  it("keeps brackets and quotes inside an expression from closing it", () => {
    const text = '{when=(x.exists(c, c.t == ")"))}';
    expect(spans(text, scanParamList(text, 0))).toContain('ParamExpression: (x.exists(c, c.t == ")"))');
  });

  it("keeps an escaped quote inside a string", () => {
    const text = '{label="say \\"hi\\""}';
    expect(spans(text, scanParamList(text, 0))).toContain('ParamString: "say \\"hi\\""');
  });

  it("returns undefined without a brace, or for a list that isn't closed", () => {
    expect(scanParamList("a=1}", 0)).toBeUndefined();
    expect(scanParamList("{a=1", 0)).toBeUndefined();
  });

  it("accepts an empty value", () => {
    const text = "{a= b=1}";
    expect(spans(text, scanParamList(text, 0))).toEqual(["ParamKey: a", "ParamEquals: =", "ParamKey: b", "ParamEquals: =", "ParamBare: 1"]);
  });
});

describe("scanParamBody", () => {
  it("stops at the first thing that isn't a param", () => {
    expect(scanParamBody("a=1 !b", 0).end).toBe(4);
  });
});
