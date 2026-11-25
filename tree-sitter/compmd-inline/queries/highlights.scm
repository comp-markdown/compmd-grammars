; Markdown's inlines, as nvim-treesitter's queries for tree-sitter-markdown highlight them (Apache-2.0).

(code_span) @markup.raw

(emphasis) @markup.italic

(strong_emphasis) @markup.strong

(strikethrough) @markup.strikethrough

[
  (link_label)
  (link_text)
  (link_title)
  (image_description)
] @markup.link.label

[
  (link_destination)
  (uri_autolink)
  (email_autolink)
] @markup.link.url

[
  (backslash_escape)
  (hard_line_break)
] @string.escape

(entity_reference) @character.special

(numeric_character_reference) @character.special

; CompMD's, with the captures of syntax/tokens.json.

(inline_component
  (component_marker) @punctuation.special)

(component_name) @tag

(fallback
  [
    "["
    "]"
  ] @punctuation.bracket)

(param_list
  [
    "{"
    "}"
  ] @punctuation.bracket)

(param_key
  (param_name) @attribute)

(breakpoint) @attribute.builtin

(param
  [
    "."
    (class_name)
  ] @attribute)

(param
  [
    "#"
    (id_name)
  ] @attribute)

(param
  "=" @operator)

(param_key
  ":" @operator)

(string) @string

(string_escape) @string.escape

(bare_value) @string.special

(expression
  [
    "("
    ")"
  ] @punctuation.special)

(interpolation
  [
    "{{"
    "}}"
  ] @punctuation.special)

(interpolation_path) @variable

(wiki_link
  (link_destination) @markup.link.url)

(wiki_link
  (link_text) @markup.link.label)

(latex_block) @markup.math
