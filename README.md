# @compmd/lezer

CompMD's grammar for CodeMirror: an [`@lezer/markdown`](https://github.com/lezer-parser/markdown) extension that adds
[CompMD](https://github.com/comp-markdown/compmd)'s syntax (spec v1) to CommonMark and GFM, with highlighting tags.

```ts
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { compmd } from "@compmd/lezer";

const language = markdown({ base: markdownLanguage, extensions: [compmd] });
```

## What it parses

| Construct | Nodes | Spec |
|---|---|---|
| Frontmatter at the document's start, never Markdown | `Frontmatter` | §2.1 |
| A container's opener, closer and continuation lines | `ComponentOpen`, `ComponentClose`, `ComponentContinuation` | §3 |
| Leaves and slots | `ComponentLeaf`, `ComponentSlot` | §3, §4 |
| A line starting with `::` that matches no form | `ComponentMalformed` | §10 (F016) |
| Inline components, `:name[fallback]{…}` | `InlineComponent` | §3.2 |
| Params: keys, breakpoints, strings, expressions, JSON, bare values, `.class`, `#id` | `ParamList`, `ParamKey`, `ParamString`, … | §3.1, §5.1 |
| A fallback `[…]`, its inside parsed as inline Markdown | `ComponentFallback` | §4.4 |
| Interpolation, `{{path}}`, in text, fallbacks and quoted params | `Interpolation`, `InterpolationExpression` | §8.1 |
| Wiki links, `[[Target]]` and `[[Target\|label]]`, always | `WikiLink`, `WikiLinkTarget`, `WikiLinkLabel` | §2.3 |
| Math: inline by Pandoc's rule, display on `$$` lines | `InlineMath`, `MathBlock` | §2.3 |

A component line is one block whose children are the line's parts; a container's content between its opener and its
closer stays ordinary Markdown. Nothing inside a component line or an inline component is parsed as Markdown, except
its fallback. `COMPMD_NODES` names the nodes that are CompMD's own, for an editor that draws Markdown in place and
leaves these as their source.

## Limits

- **Interpolation in a link's destination** (`[x]({{s.url}})`) isn't parsed.
- **CEL's triple-quoted, raw and bytes literals** inside an expression param aren't told apart from other strings.
- **`$$` inside a paragraph** isn't display math.
- **Highlighting tags are provisional:** they follow CompMD's shared token names once those exist.

## Development

```sh
pnpm install
pnpm test     # Vitest
pnpm lint     # tsc
pnpm build    # dist/
```

## License

MIT
