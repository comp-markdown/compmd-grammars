# tree-sitter-compmd

[CompMD](https://compmd.dev)'s grammar for [tree-sitter](https://tree-sitter.github.io/), for the editors that
highlight, fold and select by its trees: Neovim, Helix, Zed and Emacs. It parses CompMD's syntax
([spec](https://compmd.dev/spec/) v1) on [tree-sitter-markdown](https://github.com/tree-sitter-grammars/tree-sitter-markdown)'s
CommonMark and GFM.

Three grammars, each in a folder of its own, as editors take a grammar from a folder of a repository:

| Folder | Grammar | What it parses |
|---|---|---|
| [`compmd/`](compmd) | `compmd` | A document's blocks: component lines and containers, component definitions, the frontmatter and its `md` key |
| [`compmd-inline/`](compmd-inline) | `compmd_inline` | Each block's text: inline components, interpolation, wiki links, math by Pandoc's rule |
| [`cel/`](cel) | `cel` | An expression param's CEL |

`compmd` injects `compmd_inline` into each block's text (its `inline` nodes), as tree-sitter-markdown's two grammars
work, and `cel` into each expression; a renderer's code block gets its fence's language.

## Queries

Each grammar's `queries/` folder holds `highlights.scm`, with the captures of
[`syntax/tokens.json`](../syntax/tokens.json) (shared with the TextMate grammar and the language server), and
`injections.scm`, generated from [`syntax/injections.json`](../syntax/injections.json). The block grammar adds
`folds.scm` (a container to its closer, a definition's fence) and both add `textobjects.scm` (a component, its
params), with nvim-treesitter-textobjects' names.

## Packages

- **npm**: `tree-sitter-compmd`, with a Node binding: `import CompMD from "tree-sitter-compmd"` is the block
  grammar, `CompMD.inline` and `CompMD.cel` the others.
- **crates.io**: `tree-sitter-compmd`, with `LANGUAGE`, `INLINE_LANGUAGE`, `CEL_LANGUAGE` and each grammar's queries.

## Limits

- **A closer closes the innermost container**, whatever its name: `::: /outer` inside an open `inner` closes `inner`.
  The processor reports the mismatch (F003, F004).
- **A leaf's fallback** with a `]` inside a code span ends at that `]`; an inline component's doesn't.
- **CEL's triple-quoted strings** inside an expression param are read as ordinary strings in a row, so a `)` after a
  lone `"` in one can end the expression early.
- **`{{` in a quoted param on a component line** that isn't an interpolation (`"{{a b}}"`) is an error on its line, not
  text.

## Development

```sh
pnpm install
pnpm run generate     # each grammar's src/ and the injection queries
pnpm test             # each grammar's corpus (test/corpus/) and the Node binding
cargo test            # the Rust binding
pnpm run build:wasm   # for the shared test set (../tests)
```

The scanners (`compmd/src/scanner.c`, `compmd-inline/src/scanner.c`) are tree-sitter-markdown's, with CompMD's lines
and tokens marked by the spec's sections; [`common/params.h`](common/params.h) checks a param list ahead for both.
The generated parsers are committed, as editors build from them.

## License

MIT
