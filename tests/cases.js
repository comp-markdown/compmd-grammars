// The shared test set's cases (`cases/*.json`), for every grammar's runner.
//
// A file holds a list of cases. Each has a `name`, the spec's `section` it comes from, a `document`, and `tokens`:
// pairs of a span's text and its token's name (syntax/tokens.json), in the order the spans start. Each span is the
// next occurrence of its text after the previous span's start, so a case names only the spans it checks, and a span
// inside another (an interpolation in a string) comes after it.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const folder = path.join(path.dirname(fileURLToPath(import.meta.url)), "cases");

/** Every case, with its file's name before its own. */
export function readCases() {
  return fs
    .readdirSync(folder)
    .filter((file) => file.endsWith(".json"))
    .sort()
    .flatMap((file) => {
      const cases = JSON.parse(fs.readFileSync(path.join(folder, file), "utf8"));
      return cases.map((testCase) => ({ ...testCase, name: `${path.basename(file, ".json")}/${testCase.name}` }));
    });
}

/** A case's spans: where each one's text is in the document (UTF-16 indexes), and its token. */
export function spansOf(testCase) {
  const spans = [];
  let from = 0;
  for (const [text, token] of testCase.tokens) {
    const start = testCase.document.indexOf(text, from);
    if (start === -1) {
      throw new Error(`${testCase.name}: no ${JSON.stringify(text)} after index ${from}`);
    }
    spans.push({ text, token, start, end: start + text.length });
    from = start + 1;
  }
  return spans;
}
