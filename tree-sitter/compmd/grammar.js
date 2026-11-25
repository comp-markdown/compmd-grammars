// CompMD's block grammar: tree-sitter-markdown's, with CompMD's component lines and component definitions. Each
// block's text is parsed by the inline grammar (`compmd_inline`), as in tree-sitter-markdown.
//
// The component lines (spec §3) are recognized by the external scanner (`src/scanner.c`, tree-sitter-markdown's with
// CompMD's lines), where a fenced code block's are: at the start of a line, at most 3 spaces in, in any container.
// It gives the marker (`:::` or `::`) of each form, and this grammar reads the rest of the line. A container is a
// block on the scanner's stack, like a block quote: its lines are ordinary Markdown, and it ends at its closer or
// where its list item or block quote ends (spec §4.1), never at a closer inside a list item it holds.

/// <reference types="tree-sitter-cli/dsl" />

import markdown from "@tree-sitter-grammars/tree-sitter-markdown/tree-sitter-markdown/grammar.js";
import patterns from "../../syntax/patterns.js";
import { rules as paramRules } from "../common/params.js";

export default grammar(markdown, {
  name: "compmd",

  // The frontmatter's opening lines are tree-sitter-markdown's tokens, renamed: its text follows them, in parts
  // around its `md` keys.
  externals: ($, original) =>
    original
      .map((symbol) =>
        symbol.name === "minus_metadata"
          ? $._minus_metadata_start
          : symbol.name === "plus_metadata"
            ? $._plus_metadata_start
            : symbol,
      )
      .concat([
      $._container_open_marker,
      $._container_close_marker,
      $._stray_close_marker,
      $._continuation_marker,
      $._leaf_marker,
      $._slot_marker,
      $._malformed_marker,
      $._definition_start,
      $._definition_separator,
      $._frontmatter_key,
      $._metadata_rest,
      $._invalid_param_list,
      $._invalid_params,
    ]),

  rules: {
    // Frontmatter (spec §2.1): YAML between `---` lines or TOML between `+++` lines, with the `md` key CompMD reads
    // at the start of a line (`md:`, `[md]`, `md.version = 1`).
    minus_metadata: ($) => seq($._minus_metadata_start, $._frontmatter_text),
    plus_metadata: ($) => seq($._plus_metadata_start, $._frontmatter_text),
    _frontmatter_text: ($) =>
      seq($._metadata_rest, repeat(seq(alias($._frontmatter_key, $.frontmatter_key), $._metadata_rest))),

    _block_not_section: ($, original) =>
      choice(
        original,
        $.component_container,
        $.container_closer,
        $.component_leaf,
        $.component_slot,
        $.param_continuation,
        $.malformed_component_line,
      ),

    // `::: card {title="Setup"}` … `::: /card` (spec §4.1).
    component_container: ($) =>
      seq(
        $.container_opener,
        choice($._newline, $._eof),
        repeat($._block),
        optional(seq(alias($._container_closer, $.container_closer), $._close_block, choice($._newline, $._eof))),
        $._block_close,
        optional($.block_continuation),
      ),
    container_opener: ($) =>
      seq(
        alias($._container_open_marker, $.component_marker),
        $._whitespace,
        field("name", alias($._name, $.component_name)),
        optional(seq($._whitespace, $._params)),
        optional($._whitespace),
      ),
    _container_closer: ($) =>
      seq(alias($._container_close_marker, $.component_marker), $._closer_rest),
    // A closer with no container to close where it is written (spec §4.1, F005 and F032).
    container_closer: ($) =>
      seq(alias($._stray_close_marker, $.component_marker), $._closer_rest, choice($._newline, $._eof)),
    _closer_rest: ($) =>
      seq($._whitespace, "/", field("name", alias($._name, $.component_name)), optional($._whitespace)),

    // `:: chart[Weekly installs] {src=installs.csv}` (spec §4.3).
    component_leaf: ($) =>
      seq(
        alias($._leaf_marker, $.component_marker),
        $._whitespace,
        field("name", alias($._name, $.component_name)),
        optional(field("fallback", $.fallback)),
        optional(seq(optional($._whitespace), $._params)),
        optional($._whitespace),
        choice($._newline, $._eof),
      ),

    // `[…]`: a leaf's fallback, its text parsed as inline Markdown (spec §4.4).
    fallback: ($) => seq("[", optional(alias($._fallback_text, $.inline)), "]"),
    _fallback_text: ($) => repeat1(choice(/[^\[\]\\\r\n]+/, /\\[^\r\n]/, seq("[", optional($._fallback_text), "]"))),

    // `:: #footer` (spec §4.2).
    component_slot: ($) =>
      seq(
        alias($._slot_marker, $.component_marker),
        $._whitespace,
        "#",
        field("name", alias($._name, $.slot_name)),
        optional($._whitespace),
        choice($._newline, $._eof),
      ),

    // `::: + md:gap=l` (spec §5.2).
    param_continuation: ($) =>
      seq(
        alias($._continuation_marker, $.component_marker),
        $._whitespace,
        "+",
        $._whitespace,
        choice($._param_body, alias($._invalid_params, $.invalid_params)),
        choice($._newline, $._eof),
      ),

    // A param list, or what can't be read as one: the rest of its line (spec §5).
    _params: ($) => choice($.param_list, alias($._invalid_param_list, $.invalid_params)),

    // A line starting with `::` that matches no form (spec §3.2, rule 7; F016).
    malformed_component_line: ($) =>
      seq(alias($._malformed_marker, $.component_marker), optional($._line), choice($._newline, $._eof)),

    // A fenced code block, with a component definition's content in two parts (spec §7.2): its signature, a `---`
    // line, its body; a signature fence's is its signature alone (spec §7.1). The scanner tells them by their info
    // string: `compmd` and `component=…`, and `signature` for a signature fence.
    fenced_code_block: ($) =>
      prec.right(
        choice(
          seq(
            alias($._fenced_code_block_start_backtick, $.fenced_code_block_delimiter),
            optional($._whitespace),
            optional(field("info_string", $.info_string)),
            $._newline,
            optional(choice($.code_fence_content, $.component_definition)),
            optional(
              seq(
                alias($._fenced_code_block_end_backtick, $.fenced_code_block_delimiter),
                $._close_block,
                choice($._newline, $._eof),
              ),
            ),
            $._block_close,
          ),
          seq(
            alias($._fenced_code_block_start_tilde, $.fenced_code_block_delimiter),
            optional($._whitespace),
            optional(field("info_string", $.info_string)),
            $._newline,
            optional(choice($.code_fence_content, $.component_definition)),
            optional(
              seq(
                alias($._fenced_code_block_end_tilde, $.fenced_code_block_delimiter),
                $._close_block,
                choice($._newline, $._eof),
              ),
            ),
            $._block_close,
          ),
        ),
      ),
    component_definition: ($) =>
      seq(
        $._definition_start,
        optional(alias($._code_lines, $.definition_signature)),
        optional(
          seq(
            alias($._definition_separator, $.definition_separator),
            choice($._newline, $._eof),
            optional(alias($._code_lines, $.definition_body)),
          ),
        ),
      ),
    _code_lines: ($) => repeat1(choice($._newline, seq($._line, choice($._newline, $._eof)))),

    // `compmd component=card signature {width=12rem}`: a language, then attributes in the param syntax and a param
    // list (spec §3, §7). Text that isn't either stays text.
    info_string: ($) =>
      choice(
        seq($.language, repeat(seq($._whitespace, $._info_part)), optional($._whitespace)),
        seq($._params, repeat(seq($._whitespace, $._info_part)), optional($._whitespace)),
      ),
    _info_part: ($) => choice($.param, $._params, alias(/[^ \t\r\n{}=]+/, $.info_text)),

    ...paramRules,
    _param_space: ($) => $._whitespace,
    _interpolation_open: (_) => "{{",
    _param_list_open: (_) => "{",
    // A name, rather than an info string's text, where both could be read.
    _name: (_) => token(prec(1, new RegExp(patterns.name))),
  },
});
