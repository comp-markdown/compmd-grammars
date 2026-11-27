# @compmd/lezer

CompMD's grammar for CodeMirror: an [`@lezer/markdown`](https://github.com/lezer-parser/markdown) extension that adds
[CompMD](https://compmd.dev)'s syntax ([spec](https://compmd.dev/spec/) v1) to CommonMark and GFM, with highlighting tags.

```ts
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { compmd } from "@compmd/lezer";

const language = markdown({ base: markdownLanguage, extensions: [compmd] });
```

## What it parses

| Construct | Nodes | Spec |
|---|---|---|
| Frontmatter at the document's start, YAML between `---` lines or TOML between `+++` lines, never Markdown; its `md` key | `Frontmatter`, `FrontmatterKey` | §2.1 |
| A container's opener, closer and continuation lines | `ComponentOpen`, `ComponentClose`, `ComponentContinuation` | §3 |
| Leaves and slots | `ComponentLeaf`, `ComponentSlot` | §3, §4 |
| A line starting with `::` that matches no form | `ComponentMalformed` | §10 (F016) |
| Inline components, `:name[fallback]{…}` | `InlineComponent` | §3.2 |
| Params: keys, breakpoints, strings with their escapes, expressions with their parentheses, JSON, bare values, `.class`, `#id`; a list that isn't closed, invalid to the line's end | `ParamList`, `ParamKey`, `ParamOperator`, `ParamString`, `ParamEscape`, … `ParamInvalid` | §3.1, §5 |
| Component definitions and signature fences: the info string in the param syntax, the signature, the `---` line, and the body parsed as CompMD again | `ComponentDefinition`, `DefinitionInfo`, `DefinitionSignature`, `DefinitionSeparator`, `DefinitionBody` | §7.1, §7.2 |
| A fallback `[…]`, its inside parsed as inline Markdown | `ComponentFallback` | §4.4 |
| Interpolation, `{{path}}`, in text, fallbacks and quoted params | `Interpolation`, `InterpolationExpression` | §8.1 |
| Wiki links, `[[Target]]` and `[[Target\|label]]`, always | `WikiLink`, `WikiLinkTarget`, `WikiLinkLabel` | §2.3 |
| Math: inline by Pandoc's rule, display on `$$` lines | `InlineMath`, `MathBlock` | §2.3 |

A component line is one block whose children are the line's parts; a container's content between its opener and its
closer stays ordinary Markdown. Nothing inside a component line or an inline component is parsed as Markdown, except
its fallback. `COMPMD_NODES` names the nodes that are CompMD's own, for an editor that draws Markdown in place and
leaves these as their source.

## What it shares with CompMD's other grammars

It lives in [`compmd-grammars`](../README.md), beside the tree-sitter grammar, and reads the same text the same way:

- **The syntax's pieces** (a name, the line forms, a bare value, an escape, an interpolation, the frontmatter's key) are
  `syntax/patterns.js`'s, and **each node's highlighting tag** is its token's in `syntax/tokens.json` (`NODE_TOKENS`
  names each node's token, `TOKEN_TAGS` each token's tag), so a component's name has the same colour group as in every
  other editor. The package is published on its own, so it carries a copy of both, `src/syntax.ts`, which
  `pnpm run generate` writes and `pnpm test` checks.
- **The shared test set** (`tests/`) runs on it as on tree-sitter: each span's tag, and the spec's documents and the
  conformance set, on which both grammars mark the same lines as malformed.

## Limits

- **Interpolation in a link's destination** (`[x]({{s.url}})`) isn't parsed.
- **CEL's triple-quoted, raw and bytes literals** inside an expression param aren't told apart from other strings.
- **`$$` inside a paragraph** isn't display math.
- **A definition's body inside a list item or a block quote** isn't parsed again: its lines aren't the document's as
  they are.
- **A fenced code block's info string** is read in the param syntax only for a definition; other fences' stay
  @lezer/markdown's.

## Development

From the repository's root (`pnpm install` there):

```sh
pnpm --dir lezer run generate    # src/syntax.ts, after a change to syntax/
pnpm --dir lezer test            # Vitest, and src/syntax.ts is current
pnpm --dir lezer lint            # tsc
pnpm --dir lezer build           # dist/
```

## License

MIT
