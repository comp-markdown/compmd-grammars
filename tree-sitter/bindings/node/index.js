import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));

const binding = (await import("node-gyp-build")).default(root);

/** Gives a grammar its node types and its queries, from its folder, read when first asked for. */
function describe(grammar, folder, queryFiles) {
  try {
    grammar.nodeTypeInfo = JSON.parse(readFileSync(`${root}/${folder}/src/node-types.json`, "utf8"));
  } catch { }
  for (const [property, file] of queryFiles) {
    Object.defineProperty(grammar, property, {
      configurable: true,
      enumerable: true,
      get() {
        delete grammar[property];
        try {
          grammar[property] = readFileSync(`${root}/${folder}/queries/${file}`, "utf8");
        } catch { }
        return grammar[property];
      },
    });
  }
}

const compmdQueries = [
  ["HIGHLIGHTS_QUERY", "highlights.scm"],
  ["INJECTIONS_QUERY", "injections.scm"],
  ["TEXTOBJECTS_QUERY", "textobjects.scm"],
];
describe(binding, "compmd", [...compmdQueries, ["FOLDS_QUERY", "folds.scm"]]);
describe(binding.inline, "compmd-inline", compmdQueries);
describe(binding.cel, "cel", [["HIGHLIGHTS_QUERY", "highlights.scm"]]);

export default binding;
