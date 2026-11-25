import assert from "node:assert";
import { test } from "node:test";
import Parser from "tree-sitter";

test("loads each grammar", async () => {
  const { default: compmd } = await import("./index.js");
  for (const grammar of [compmd, compmd.inline, compmd.cel]) {
    const parser = new Parser();
    assert.doesNotThrow(() => parser.setLanguage(grammar), grammar.name);
  }
});

test("parses a container", async () => {
  const { default: compmd } = await import("./index.js");
  const parser = new Parser();
  parser.setLanguage(compmd);
  const tree = parser.parse("::: card\nHello.\n::: /card\n");
  assert.equal(tree.rootNode.hasError, false);
  assert.equal(tree.rootNode.descendantsOfType("component_container").length, 1);
});
