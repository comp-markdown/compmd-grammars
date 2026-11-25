// CompMD highlighted as an editor does it, with the tree-sitter grammar: the block grammar's tree, the inline
// grammar's trees in the ranges the shared injection table names (syntax/injections.json), and each tree's
// highlights. Other languages' text (YAML, CEL, …) is left alone: its spans aren't CompMD's tokens.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Language, Parser, Query } from "web-tree-sitter";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const injectionTable = JSON.parse(fs.readFileSync(path.join(root, "syntax", "injections.json"), "utf8"));

/** The grammars a document's text is parsed with, by name, with their folders. */
const grammarFolders = { compmd: "compmd", compmd_inline: "compmd-inline" };

/** A parser and a highlight query for each grammar. */
export async function loadGrammars() {
  await Parser.init();
  const grammars = {};
  for (const [name, folder] of Object.entries(grammarFolders)) {
    const directory = path.join(root, "tree-sitter", folder);
    const language = await Language.load(path.join(directory, `tree-sitter-${name}.wasm`));
    const highlights = new Query(language, fs.readFileSync(path.join(directory, "queries", "highlights.scm"), "utf8"));
    const parser = new Parser();
    parser.setLanguage(language);
    grammars[name] = { parser, highlights };
  }
  return grammars;
}

/** The injections the table gives one grammar, for nodes of CompMD's own grammars. */
function injectionsIn(grammar) {
  return injectionTable.injections.flatMap((injection) =>
    injection["tree-sitter"]
      .filter((target) => target.in === grammar && injection.language in grammarFolders)
      .map((target) => ({ ...target, language: injection.language })),
  );
}

/** A node's range, without its named children's unless the injection includes them, as Neovim injects. */
function rangesOf(node, includeChildren) {
  if (includeChildren || node.namedChildCount === 0) {
    return [range(node.startIndex, node.endIndex, node.startPosition, node.endPosition)];
  }
  const ranges = [];
  let start = { index: node.startIndex, position: node.startPosition };
  for (const child of node.namedChildren) {
    if (child.startIndex > start.index) {
      ranges.push(range(start.index, child.startIndex, start.position, child.startPosition));
    }
    start = { index: child.endIndex, position: child.endPosition };
  }
  if (node.endIndex > start.index) {
    ranges.push(range(start.index, node.endIndex, start.position, node.endPosition));
  }
  return ranges;
}

function range(startIndex, endIndex, startPosition, endPosition) {
  return { startIndex, endIndex, startPosition, endPosition };
}

/**
 * Every tree of a document, the block grammar's first, each with its depth: an injected tree is one deeper than the
 * tree it is injected into.
 */
export function parseLayers(grammars, text) {
  const layers = [];
  const visit = (grammar, tree, depth) => {
    layers.push({ grammar, tree, depth });
    for (const injection of injectionsIn(grammar)) {
      const nodes = tree.rootNode.descendantsOfType(injection.node);
      for (const node of nodes) {
        const includedRanges = rangesOf(node, injection.options?.includes("include-children"));
        if (includedRanges.length === 0) continue;
        const injected = grammars[injection.language].parser.parse(text, null, { includedRanges });
        visit(injection.language, injected, depth + 1);
      }
    }
  };
  visit("compmd", grammars.compmd.parser.parse(text), 0);
  return layers;
}

/**
 * The capture that colours exactly the span `[start, end)`, as an editor would choose among the captures of that
 * span: a deeper tree's first, then the higher priority, then the earlier pattern. Null when none does.
 */
export function captureOf(grammars, layers, start, end) {
  let best = null;
  for (const layer of layers) {
    for (const capture of grammars[layer.grammar].highlights.captures(layer.tree.rootNode)) {
      if (capture.name.startsWith("_")) continue;
      if (capture.node.startIndex !== start || capture.node.endIndex !== end) continue;
      const candidate = {
        name: `@${capture.name}`,
        depth: layer.depth,
        priority: Number(capture.setProperties?.priority ?? 100),
        pattern: capture.patternIndex,
      };
      if (best === null || ranksAbove(candidate, best)) best = candidate;
    }
  }
  return best?.name ?? null;
}

function ranksAbove(a, b) {
  if (a.depth !== b.depth) return a.depth > b.depth;
  if (a.priority !== b.priority) return a.priority > b.priority;
  return a.pattern < b.pattern;
}

/** The nodes no grammar could parse, in every tree of a document. */
export function errorsIn(layers) {
  const errors = [];
  for (const layer of layers) {
    const cursor = layer.tree.walk();
    const walk = () => {
      const node = cursor.currentNode;
      if (node.isError || node.isMissing) {
        errors.push({ grammar: layer.grammar, node });
        return;
      }
      if (cursor.gotoFirstChild()) {
        do walk();
        while (cursor.gotoNextSibling());
        cursor.gotoParent();
      }
    };
    walk();
  }
  return errors;
}
