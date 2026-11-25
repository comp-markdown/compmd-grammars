// CEL, the Common Expression Language (https://github.com/google/cel-spec/blob/master/doc/langdef.md), as CompMD's
// expressions use it (spec §8.2): the CompMD grammars inject it into a param's `(…)`. It parses all of CEL's syntax;
// which functions and macros CompMD's profile allows is the processor's to check, not a grammar's.

/// <reference types="tree-sitter-cli/dsl" />

const PREC = {
  conditional: 1,
  or: 2,
  and: 3,
  relation: 4,
  additive: 5,
  multiplicative: 6,
  unary: 7,
  member: 8,
};

const commaSeparated = (rule) => optional(seq(rule, repeat(seq(",", rule)), optional(",")));

export default grammar({
  name: "cel",

  extras: ($) => [/\s/, $.comment],

  word: ($) => $.identifier,

  rules: {
    source: ($) => $._expression,

    _expression: ($) =>
      choice(
        $.conditional_expression,
        $.binary_expression,
        $.unary_expression,
        $.member_expression,
        $.call_expression,
        $.index_expression,
        $.parenthesized_expression,
        $.list,
        $.map,
        $.identifier,
        $.number,
        $.string,
        $.bytes,
        $.true,
        $.false,
        $.null,
      ),

    conditional_expression: ($) =>
      prec.right(
        PREC.conditional,
        seq(
          field("condition", $._expression),
          "?",
          field("consequence", $._expression),
          ":",
          field("alternative", $._expression),
        ),
      ),

    binary_expression: ($) =>
      choice(
        ...[
          ["||", PREC.or],
          ["&&", PREC.and],
          ["==", PREC.relation],
          ["!=", PREC.relation],
          ["<", PREC.relation],
          ["<=", PREC.relation],
          [">", PREC.relation],
          [">=", PREC.relation],
          ["in", PREC.relation],
          ["+", PREC.additive],
          ["-", PREC.additive],
          ["*", PREC.multiplicative],
          ["/", PREC.multiplicative],
          ["%", PREC.multiplicative],
        ].map(([operator, precedence]) =>
          prec.left(
            precedence,
            seq(field("left", $._expression), field("operator", operator), field("right", $._expression)),
          ),
        ),
      ),

    unary_expression: ($) =>
      prec(PREC.unary, seq(field("operator", choice("!", "-")), field("operand", $._expression))),

    member_expression: ($) =>
      prec(PREC.member, seq(field("object", $._expression), ".", field("member", $.identifier))),

    // `size(x)`, `md.currency(n, "USD")`, `rows.map(r, r.n)`.
    call_expression: ($) =>
      prec(
        PREC.member,
        seq(field("function", choice($.identifier, $.member_expression)), field("arguments", $.arguments)),
      ),
    arguments: ($) => seq("(", commaSeparated($._expression), ")"),

    index_expression: ($) =>
      prec(PREC.member, seq(field("object", $._expression), "[", field("index", $._expression), "]")),

    parenthesized_expression: ($) => seq("(", $._expression, ")"),

    list: ($) => seq("[", commaSeparated($._expression), "]"),
    map: ($) => seq("{", commaSeparated($.map_entry), "}"),
    map_entry: ($) => seq(field("key", $._expression), ":", field("value", $._expression)),

    identifier: (_) => /[A-Za-z_][A-Za-z0-9_]*/,

    // `3`, `3u`, `0x1F`, `2.5`, `1e-7`.
    number: (_) =>
      token(
        choice(
          /0[xX][0-9a-fA-F]+[uU]?/,
          /[0-9]+[uU]/,
          /[0-9]+\.[0-9]+([eE][+-]?[0-9]+)?/,
          /\.[0-9]+([eE][+-]?[0-9]+)?/,
          /[0-9]+[eE][+-]?[0-9]+/,
          /[0-9]+/,
        ),
      ),

    // Single-, double- and triple-quoted strings, raw (`r"…"`) or not.
    string: (_) =>
      token(
        seq(
          optional(/[rR]/),
          choice(
            /"""([^"\\]|\\(.|\n)|"[^"]|""[^"])*"""/,
            /'''([^'\\]|\\(.|\n)|'[^']|''[^'])*'''/,
            /"([^"\\\r\n]|\\.)*"/,
            /'([^'\\\r\n]|\\.)*'/,
          ),
        ),
      ),
    bytes: (_) =>
      token(seq(/[bB][rR]?|[rR][bB]/, choice(/"([^"\\\r\n]|\\.)*"/, /'([^'\\\r\n]|\\.)*'/))),

    true: (_) => "true",
    false: (_) => "false",
    null: (_) => "null",

    comment: (_) => token(seq("//", /[^\r\n]*/)),
  },
});
