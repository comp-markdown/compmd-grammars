// Every document of the spec and its conformance set must parse: the spec's examples (its ```md fences) and each
// conformance case's input, from a checkout of comp-markdown/compmd (at a release's tag in CI), with no node a
// grammar couldn't parse. A document that is wrong on purpose (a malformed line, a missing closer) still parses:
// the grammar marks it, and the processor reports it. The grammars must also agree on which lines those are: the
// lines Lezer marks malformed are the lines tree-sitter does.
//
//   node parse.js <the compmd checkout>    (after building both grammars)

import fs from "node:fs";
import path from "node:path";
import { compmd } from "@compmd/lezer";
import { GFM, parser as markdown } from "@lezer/markdown";
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

/** The line (from 1) each offset of `text` is on. */
const lineOf = (text, offset) => text.slice(0, offset).split("\n").length;

/** The lines tree-sitter marks as malformed component lines, in every tree of the document. */
function treeSitterMalformed(layers) {
  const lines = new Set();
  for (const { tree } of layers) {
    for (const node of tree.rootNode.descendantsOfType("malformed_component_line")) lines.add(node.startPosition.row + 1);
  }
  return lines;
}

const lezer = markdown.configure([GFM, compmd]);

/** The lines Lezer marks as malformed component lines, a definition's body included. */
function lezerMalformed(text) {
  const lines = new Set();
  lezer.parse(text).iterate({
    enter: (node) => {
      if (node.name === "ComponentMalformed") lines.add(lineOf(text, node.from));
    },
  });
  return lines;
}

/** The lines one set has and the other hasn't, each named by the grammar that has it. */
function disagreements(treeSitter, lezerLines) {
  return [
    ...[...treeSitter].filter((line) => !lezerLines.has(line)).map((line) => `line ${line}: only tree-sitter marks it malformed`),
    ...[...lezerLines].filter((line) => !treeSitter.has(line)).map((line) => `line ${line}: only Lezer marks it malformed`),
  ];
}

const documents = [
  ...specExamples(path.join(checkout, "spec", "compmd-spec-v1.md")),
  ...conformanceInputs(path.join(checkout, "conformance")),
];

const grammars = await loadGrammars();
let failed = 0;
for (const document of documents) {
  const layers = parseLayers(grammars, document.text);
  const problems = [
    ...errorsIn(layers).map(({ grammar, node }) => {
      const at = `${node.startPosition.row + 1}:${node.startPosition.column + 1}`;
      return `${at}: ${grammar} can't parse ${JSON.stringify(node.text.slice(0, 60))}`;
    }),
    ...disagreements(treeSitterMalformed(layers), lezerMalformed(document.text)),
  ];
  if (problems.length === 0) continue;
  failed++;
  for (const problem of problems) console.error(`✗ ${document.name}, ${problem}`);
}
console.log(`${documents.length - failed} of ${documents.length} documents parse, both grammars agreeing on their malformed lines`);
process.exitCode = failed ? 1 : 0;
