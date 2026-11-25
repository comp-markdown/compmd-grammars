// The shared test set, on the tree-sitter grammar: each case's document is highlighted as an editor would, and
// each span it names must have its token's capture (syntax/tokens.json), with no node the grammar couldn't parse.
//
//   node tree-sitter.js    (after `tree-sitter build --wasm` in each grammar's folder)

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { captureOf, errorsIn, loadGrammars, parseLayers } from "./tree-sitter/highlighter.js";
import { readCases, spansOf } from "./cases.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const { tokens } = JSON.parse(fs.readFileSync(path.join(root, "syntax", "tokens.json"), "utf8"));

const grammars = await loadGrammars();
const failures = [];
let checked = 0;
for (const testCase of readCases()) {
  const layers = parseLayers(grammars, testCase.document);
  for (const { grammar, node } of errorsIn(layers)) {
    failures.push(`${testCase.name}: ${grammar} can't parse ${JSON.stringify(node.text)} at ${position(node)}`);
  }
  for (const span of spansOf(testCase)) {
    const expected = tokens[span.token]?.capture;
    if (expected === undefined) {
      failures.push(`${testCase.name}: no token ${span.token} in syntax/tokens.json`);
      continue;
    }
    const actual = captureOf(grammars, layers, span.start, span.end);
    checked++;
    if (actual !== expected) {
      failures.push(`${testCase.name}: ${JSON.stringify(span.text)} is ${actual ?? "not captured"}, not ${expected} (${span.token})`);
    }
  }
}

function position(node) {
  return `${node.startPosition.row + 1}:${node.startPosition.column + 1}`;
}

for (const failure of failures) console.error(`✗ ${failure}`);
console.log(`${checked - failures.length} of ${checked} spans as their tokens say${failures.length ? `; ${failures.length} failures` : ""}`);
process.exitCode = failures.length ? 1 : 0;
