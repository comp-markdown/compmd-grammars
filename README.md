# CompMD's grammars

The grammars editors read [CompMD](https://compmd.dev) with, and what they share, so every editor reads the same text
the same way ([the design](https://github.com/comp-markdown/compmd/blob/main/docs/editor-support.md)).

| Folder | What it holds |
|---|---|
| [`syntax/`](syntax) | What the grammars share: the syntax's pieces as regular expressions (`patterns.js`), the token names with each grammar's name for them (`tokens.json`) and where other languages are injected (`injections.json`) |
| [`tree-sitter/`](tree-sitter) | `tree-sitter-compmd`: the tree-sitter grammar, for Neovim, Helix, Zed and Emacs |
| [`tests/`](tests) | The test set the grammars share: documents with each span's token (`cases/`), and every document of the spec and its conformance set, which must parse |

The TextMate grammar, `@compmd/textmate` for VS Code and Shiki, comes here next.

## Tests

```sh
pnpm install
pnpm --dir tree-sitter test             # the grammars' own tests
pnpm --dir tree-sitter run build:wasm
pnpm --dir tests test                   # the shared test set
pnpm --dir tests run parse <compmd>     # the spec's examples and the conformance set of a comp-markdown/compmd checkout
```

CI runs them all, with comp-markdown/compmd at the release [`tests/compmd-version`](tests/compmd-version) names.

## License

MIT
