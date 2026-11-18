// Test helpers: CommonMark with GFM and the grammar, and the nodes it gives for a text.

import { readFileSync } from "node:fs";
import { GFM, parser as markdownParser } from "@lezer/markdown";
import { compmd } from "../compmd.ts";

/** The parser the tests use: CompMD's base syntax (CommonMark and GFM) with the grammar. */
export const parser = markdownParser.configure([GFM, compmd]);

/** Each node in `text`'s tree but the document, as `Name: text`, in document order. */
export function nodes(text: string): string[] {
  const found: string[] = [];
  parser.parse(text).iterate({
    enter: (node) => {
      if (node.name !== "Document") found.push(`${node.name}: ${text.slice(node.from, node.to)}`);
    },
  });
  return found;
}

/** Whether `text`'s tree has a node named `name`. */
export function hasNode(text: string, name: string): boolean {
  return nodes(text).some((node) => node.startsWith(`${name}:`));
}

/** A fixture from `src/test/fixtures/`. */
export function fixture(name: string): string {
  return readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");
}
