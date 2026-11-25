// Every document of the spec and its conformance set must parse: the spec's examples (its ```md fences) and each
// conformance case's input, from a checkout of comp-markdown/compmd (at a release's tag in CI), with no node a
// grammar couldn't parse. A document that is wrong on purpose (a malformed line, a missing closer) still parses:
// the grammar marks it, and the processor reports it.
//
//   node parse.js <the compmd checkout>

import fs from "node:fs";
import path from "node:path";
import { errorsIn, loadGrammars, parseLayers } from "./tree-sitter/highlighter.js";

const checkout = process.argv[2];
if (!checkout) {
  console.error("usage: node parse.js <a checkout of comp-markdown/compmd>");
  process.exit(2);
}

/** The spec's examples: the text of each fence whose language is `md`, with the line it starts on. */
function specExamples(file) {
  const lines = fs.readFileSync(file, "utf8").split("\n");
  const examples = [];
  for (let i = 0; i < lines.length; i++) {
    const opener = /^(`{3,}|~{3,})md\s*$/.exec(lines[i]);
    if (!opener) continue;
    const fence = opener[1];
    const body = [];
    let j = i + 1;
    while (j < lines.length && !(lines[j].startsWith(fence[0].repeat(fence.length)) && lines[j].trim() === lines[j].trim().replace(/[^`~]/g, ""))) {
      body.push(lines[j]);
      j++;
    }
    examples.push({ name: `${path.basename(file)}:${i + 2}`, text: `${body.join("\n")}\n` });
    i = j;
  }
  return examples;
}

/** Each conformance case's input. */
function conformanceInputs(folder) {
  const inputs = [];
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(file);
      else if (entry.name === "input.comp.md") {
        inputs.push({ name: path.relative(checkout, file), text: fs.readFileSync(file, "utf8") });
      }
    }
  };
  visit(folder);
  return inputs.sort((a, b) => a.name.localeCompare(b.name));
}

const documents = [
  ...specExamples(path.join(checkout, "spec", "compmd-spec-v1.md")),
  ...conformanceInputs(path.join(checkout, "conformance")),
];

const grammars = await loadGrammars();
let failed = 0;
for (const document of documents) {
  const errors = errorsIn(parseLayers(grammars, document.text));
  if (errors.length === 0) continue;
  failed++;
  for (const { grammar, node } of errors) {
    const at = `${node.startPosition.row + 1}:${node.startPosition.column + 1}`;
    console.error(`✗ ${document.name}, ${at}: ${grammar} can't parse ${JSON.stringify(node.text.slice(0, 60))}`);
  }
}
console.log(`${documents.length - failed} of ${documents.length} documents parse`);
process.exitCode = failed ? 1 : 0;
