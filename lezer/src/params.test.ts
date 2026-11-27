import { describe, expect, it } from "vitest";
import { scanParamBody, scanParamList, type Span } from "./params.ts";

/** The spans of a scan, as `Type: text`. */
const spans = (text: string, scanned: ReturnType<typeof scanParamBody> | undefined) =>
  scanned?.spans.map((span) => `${span.type}: ${text.slice(span.from, span.to)}`);

/** The parts of the first span of a scan that has them, as `Type: text`. */
const parts = (text: string, scanned: ReturnType<typeof scanParamBody> | undefined) =>
  scanned?.spans.find((span) => span.parts?.length)?.parts?.map((part: Span) => `${part.type}: ${text.slice(part.from, part.to)}`);

describe("scanParamList", () => {
  it("scans each kind of value, key and shorthand", () => {
    const text = '{title="A b" rows=(md.data.x) list=[1,2] map={"a":1} gap=m .wide #intro md:gap=l open}';
    expect(spans(text, scanParamList(text, 0))).toEqual([
      "ParamKey: title",
      "ParamOperator: =",
      'ParamString: "A b"',
      "ParamKey: rows",
      "ParamOperator: =",
      "ParamExpression: (md.data.x)",
      "ParamKey: list",
      "ParamOperator: =",
      "ParamJson: [1,2]",
      "ParamKey: map",
      "ParamOperator: =",
      'ParamJson: {"a":1}',
      "ParamKey: gap",
      "ParamOperator: =",
      "ParamBare: m",
      "ParamClass: .wide",
      "ParamId: #intro",
      "ParamBreakpoint: md",
      "ParamOperator: :",
      "ParamKey: gap",
      "ParamOperator: =",
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

  it("gives a closed expression its parentheses, and one that isn't closed only its opening one", () => {
    expect(parts("{a=(x)}", scanParamList("{a=(x)}", 0))).toEqual(["ParamExpressionMark: (", "ParamExpressionMark: )"]);
    expect(parts("a=(x", scanParamBody("a=(x", 0))).toEqual(["ParamExpressionMark: ("]);
  });

  it("keeps an escaped quote inside a string, and marks each escape", () => {
    const text = '{label="say \\"hi\\""}';
    expect(spans(text, scanParamList(text, 0))).toContain('ParamString: "say \\"hi\\""');
    expect(parts(text, scanParamList(text, 0))).toEqual(['ParamEscape: \\"', 'ParamEscape: \\"']);
  });

  it("splits a shorthand into its mark and its name", () => {
    expect(parts("{.wide}", scanParamList("{.wide}", 0))).toEqual(["ParamClassMark: .", "ParamClassName: wide"]);
    expect(parts("{#intro}", scanParamList("{#intro}", 0))).toEqual(["ParamIdMark: #", "ParamIdName: intro"]);
  });

  it("returns undefined without a brace, or for a list that isn't closed", () => {
    expect(scanParamList("a=1}", 0)).toBeUndefined();
    expect(scanParamList("{a=1", 0)).toBeUndefined();
  });

  it("accepts an empty value", () => {
    const text = "{a= b=1}";
    expect(spans(text, scanParamList(text, 0))).toEqual(["ParamKey: a", "ParamOperator: =", "ParamKey: b", "ParamOperator: =", "ParamBare: 1"]);
  });
});

describe("scanParamBody", () => {
  it("stops at the first thing that isn't a param", () => {
    expect(scanParamBody("a=1 !b", 0).end).toBe(4);
  });
});
