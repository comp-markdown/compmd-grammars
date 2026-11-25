// CompMD's inline grammar: tree-sitter-markdown's, with inline components, interpolation and wiki links (spec §3,
// §8.1, §2.3), and inline math by Pandoc's rule (spec §2.3). The block grammar injects it into each block's text.
//
// The external scanner (`src/scanner.c`, tree-sitter-markdown's with CompMD's tokens) decides what needs a look
// ahead or behind: an inline component's `:` (after white space or punctuation, before `name[` and its matching
// `]`), an interpolation's `{{` (before a path and `}}` on its line) and math's `$` (by Pandoc's rule).

/// <reference types="tree-sitter-cli/dsl" />

import patterns from "../../syntax/patterns.js";
import { rules as paramRules } from "../common/params.js";

// Wiki links are parsed always: a grammar can't read the frontmatter's opt-in (spec §2.3). tree-sitter-markdown
// reads its extensions from the environment when its grammar loads, so it loads after this.
process.env.EXTENSION_WIKI_LINK = "1";
const markdown = "@tree-sitter-grammars/tree-sitter-markdown";
const { default: markdownInline } = await import(`${markdown}/tree-sitter-markdown-inline/grammar.js`);
const { default: common } = await import(`${markdown}/common/common.js`);

export default grammar(markdownInline, {
  name: "compmd_inline",

  externals: ($, original) =>
    original.concat([
      $._inline_component_marker,
      $._colon_run,
      $._interpolation_open,
      $._latex_span_content,
      $._param_list_open,
    ]),

  rules: {
    // tree-sitter-markdown's inline elements, with CompMD's.
    _inline_base: ($) =>
      prec.right(
        repeat1(
          choice(
            $.image,
            $._soft_line_break,
            $.backslash_escape,
            $.hard_line_break,
            $.uri_autolink,
            $.email_autolink,
            $.entity_reference,
            $.numeric_character_reference,
            $.latex_block,
            $.code_span,
            alias($._html_tag, $.html_tag),
            $._text_base,
            $._unclosed_span,
            $.inline_component,
            $.interpolation,
          ),
        ),
      ),

    // `::`, as in `std::vec[0]`, is text: no inline component starts at its second colon (spec §3.2, rule 4).
    _text_base: ($) =>
      choice(
        $._word,
        common.punctuation_without($, ["[", "]"]),
        $._whitespace,
        "<!--",
        /<![A-Z]+/,
        "<?",
        "<![CDATA[",
        $._colon_run,
      ),

    // `:badge[beta]{tone=info}` (spec §4.4): its params follow its `]` directly (spec §3.2, rule 5).
    inline_component: ($) =>
      prec.right(
        seq(
          alias($._inline_component_marker, $.component_marker),
          field("name", alias($._name, $.component_name)),
          field("fallback", $.fallback),
          optional($.param_list),
        ),
      ),
    // `[…]`: the fallback, inline Markdown (spec §4.4). After its `[`, a nested component may start.
    fallback: ($) => seq("[", optional($._last_token_punctuation), optional($._inline_no_link), "]"),

    // Math by Pandoc's rule: the scanner finds the closing `$`, and the text between is one token (spec §2.3).
    latex_block: ($) =>
      seq(
        alias($._latex_span_start, $.latex_span_delimiter),
        optional(alias($._latex_span_content, $.latex_content)),
        alias($._latex_span_close, $.latex_span_delimiter),
      ),

    ...paramRules,
    _param_space: (_) => /[ \t]+/,
    _name: (_) => new RegExp(patterns.name),
  },
});
