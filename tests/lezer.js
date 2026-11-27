// The shared test set, on the Lezer grammar: each case's document is parsed as CodeMirror parses it (CommonMark, GFM
// and `@compmd/lezer`), and each span it names must have its token's tag (syntax/tokens.json).
//
//   node lezer.js    (after `pnpm --dir ../lezer build`)

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compmd, tagNamed } from "@compmd/lezer";
import { getStyleTags } from "@lezer/highlight";
import { GFM, parser as markdown } from "@lezer/markdown";
import { readCases, spansOf } from "./cases.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const { tokens } = JSON.parse(fs.readFileSync(path.join(root, "syntax", "tokens.json"), "utf8"));
const parser = markdown.configure([GFM, compmd]);

/** The tags of the innermost node that spans exactly `[start, end)` and has tags, or null. */
function tagsOf(tree, start, end) {
  let found = null;
  tree.iterate({
    from: start,
    to: end,
    enter: (node) => {
      if (node.from > start || node.to < end) return false;
      if (node.from === start && node.to === end) found = getStyleTags(node)?.tags ?? found;
      return undefined;
    },
  });
  return found;
}

const failures = [];
let checked = 0;
for (const testCase of readCases()) {
  const tree = parser.parse(testCase.document);
  for (const span of spansOf(testCase)) {
    const name = tokens[span.token]?.lezer;
    if (name === undefined) {
      failures.push(`${testCase.name}: no token ${span.token} in syntax/tokens.json`);
      continue;
    }
    checked++;
    const actual = tagsOf(tree, span.start, span.end);
    if (!actual?.includes(tagNamed(name))) {
      failures.push(`${testCase.name}: ${JSON.stringify(span.text)} is ${actual ? "another tag" : "not tagged"}, not ${name} (${span.token})`);
    }
  }
}

for (const failure of failures) console.error(`✗ ${failure}`);
console.log(`${checked - failures.length} of ${checked} spans as their tokens say${failures.length ? `; ${failures.length} failures` : ""}`);
process.exitCode = failures.length ? 1 : 0;
