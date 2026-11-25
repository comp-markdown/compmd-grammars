// Writes each grammar's `queries/injections.scm` from the shared injection table (`syntax/injections.json`).
//
//   node scripts/injections.js           writes them
//   node scripts/injections.js --check   fails if one differs from what it would write

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const table = JSON.parse(fs.readFileSync(path.join(root, "..", "syntax", "injections.json"), "utf8"));

/** The grammars, by name, and the folder each one's queries are in. */
const grammars = { compmd: "compmd", compmd_inline: "compmd-inline" };

/** One injection's query, for the nodes it names in one grammar. */
function query(injection, target) {
  const nodes = target.node.map((node) => `(${node})`);
  const options = target.options ?? [];
  const lines = [`; ${injection.what}`];
  if (injection.language === "info-string") {
    lines.push(
      "(fenced_code_block",
      "  (info_string",
      "    (language) @injection.language)",
      `  ${nodes.join(" ")} @injection.content)`,
    );
  } else {
    const content = nodes.length === 1 ? nodes[0] : `[\n  ${nodes.join("\n  ")}\n]`;
    lines.push(`(${content} @injection.content`);
    lines.push(`  (#set! injection.language "${injection.language}")`);
    if (options.includes("between-delimiter-lines")) {
      lines.push("  (#offset! @injection.content 1 0 -1 0)");
    }
    if (options.includes("include-children")) {
      lines.push("  (#set! injection.include-children)");
    }
    if (options.includes("combined")) {
      lines.push("  (#set! injection.combined)");
    }
    lines[lines.length - 1] += ")";
  }
  return lines.join("\n");
}

/** A grammar's whole injection file. */
function file(grammar) {
  const queries = table.injections.flatMap((injection) =>
    injection["tree-sitter"].filter((target) => target.in === grammar).map((target) => query(injection, target)),
  );
  return `; Generated from syntax/injections.json by tree-sitter/scripts/injections.js: edit those, not this.\n\n${queries.join("\n\n")}\n`;
}

const check = process.argv.includes("--check");
let differs = false;
for (const [grammar, folder] of Object.entries(grammars)) {
  const target = path.join(root, folder, "queries", "injections.scm");
  const text = file(grammar);
  if (check) {
    const current = fs.existsSync(target) ? fs.readFileSync(target, "utf8") : "";
    if (current !== text) {
      console.error(`${path.relative(root, target)} differs from syntax/injections.json: run scripts/injections.js`);
      differs = true;
    }
  } else {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, text);
  }
}
process.exitCode = differs ? 1 : 0;
