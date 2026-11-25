// The rules both grammars share: a param list and its values (spec §3.1, §5.1) and an interpolation's path (spec
// §8.1). The block grammar reads them on component lines and in a code block's info string, the inline grammar on
// inline components.

/// <reference types="tree-sitter-cli/dsl" />

import patterns from "../../syntax/patterns.js";

const regex = (source) => new RegExp(source);

/**
 * The rules, for a grammar's `rules`. A grammar gives `$._param_space`, its white space inside a line, and
 * `$._param_list_open`, a param list's `{`, and `$._interpolation_open`, an interpolation's `{{`.
 */
export const rules = {
  // `{a=1 .wide #intro}`: a param list (spec §3.1, `param-list`).
  param_list: ($) =>
    seq(alias($._param_list_open, "{"), optional($._param_space), optional($._param_body), "}"),

  // Params separated by white space, as a list and a continuation line hold them, and the white space after them.
  _param_body: ($) => seq($.param, repeat(seq($._param_space, $.param)), optional($._param_space)),

  // `key=value`, `.class`, `#id` or a flag `key` (spec §5.1).
  param: ($) =>
    choice(
      seq(field("key", $.param_key), "=", field("value", $._param_value)),
      seq(".", field("class", alias($._name, $.class_name))),
      seq("#", field("id", alias($._name, $.id_name))),
      field("key", $.param_key),
    ),

  // `gap` or `md:gap`, a breakpoint's override (spec §9.3).
  param_key: ($) =>
    seq(optional(seq(field("breakpoint", alias($._name, $.breakpoint)), ":")), field("name", alias($._name, $.param_name))),

  _param_value: ($) =>
    choice($.string, $.expression, alias($._json_array, $.json), alias($._json_object, $.json), $.bare_value),

  // `"Step {{n}}"`: a string, with escapes and interpolation (spec §3.1, `quoted`).
  string: ($) => seq('"', repeat(choice($.string_content, $.string_escape, $.interpolation, "{")), '"'),
  string_content: (_) => token.immediate(prec(-1, /([^"\\{\r\n]|\\[^!-\/:-@\[-`{-~\r\n])+/)),
  string_escape: (_) => token.immediate(regex(patterns.stringEscape)),

  // `(expr)`: CEL, to the matching `)` outside its string literals (spec §3.1, §8.2).
  expression: ($) => seq("(", optional(alias($._expression_text, $.expression_code)), ")"),
  _expression_text: ($) =>
    repeat1(choice(/[^()"'\r\n]+/, token(regex(patterns.celString)), seq("(", optional($._expression_text), ")"))),

  // `[…]` and `{…}`: JSON, to the matching bracket outside its strings (spec §3.1).
  _json_array: ($) => seq("[", repeat($._json_text), "]"),
  _json_object: ($) => seq("{", repeat($._json_text), "}"),
  _json_text: ($) => choice(/[^\[\]{}"\r\n]+/, token(regex(patterns.jsonString)), $._json_array, $._json_object),

  // `rocket`, `3`, `2.5rem`: up to white space or `}` (spec §3.1, `bare`).
  bare_value: (_) => regex(patterns.bareValue),

  _name: (_) => regex(patterns.name),

  // `{{ md.doc.title }}` (spec §8.1).
  interpolation: ($) =>
    seq(
      alias($._interpolation_open, "{{"),
      optional(/ +/),
      field("path", alias(regex(patterns.interpolationPath), $.interpolation_path)),
      optional(/ +/),
      "}}",
    ),
};
