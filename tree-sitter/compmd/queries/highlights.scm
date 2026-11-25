; Markdown's blocks, as nvim-treesitter's queries for tree-sitter-markdown highlight them (Apache-2.0).

(setext_heading
  (paragraph) @markup.heading.1
  (setext_h1_underline) @markup.heading.1)

(setext_heading
  (paragraph) @markup.heading.2
  (setext_h2_underline) @markup.heading.2)

(atx_heading
  (atx_h1_marker)) @markup.heading.1

(atx_heading
  (atx_h2_marker)) @markup.heading.2

(atx_heading
  (atx_h3_marker)) @markup.heading.3

(atx_heading
  (atx_h4_marker)) @markup.heading.4

(atx_heading
  (atx_h5_marker)) @markup.heading.5

(atx_heading
  (atx_h6_marker)) @markup.heading.6

(pipe_table_header
  (pipe_table_cell) @markup.heading)

(pipe_table_header
  "|" @punctuation.special)

(pipe_table_row
  "|" @punctuation.special)

(pipe_table_delimiter_row
  "|" @punctuation.special)

(pipe_table_delimiter_cell) @punctuation.special

(indented_code_block) @markup.raw.block

((fenced_code_block) @markup.raw.block
  (#set! priority 90))

(fenced_code_block
  (fenced_code_block_delimiter) @markup.raw.block)

(info_string
  (language) @label)

(link_destination) @markup.link.url

[
  (link_title)
  (link_label)
] @markup.link.label

[
  (list_marker_plus)
  (list_marker_minus)
  (list_marker_star)
  (list_marker_dot)
  (list_marker_parenthesis)
] @markup.list

(thematic_break) @punctuation.special

(task_list_marker_unchecked) @markup.list.unchecked

(task_list_marker_checked) @markup.list.checked

((block_quote) @markup.quote
  (#set! priority 90))

([
  (plus_metadata)
  (minus_metadata)
] @keyword.directive
  (#set! priority 90))

[
  (block_continuation)
  (block_quote_marker)
] @punctuation.special

(backslash_escape) @string.escape

; CompMD's, with the captures of syntax/tokens.json.

; The frontmatter's `md` key, over the YAML's or TOML's own colour.
((frontmatter_key) @keyword.directive
  (#set! priority 110))

(component_marker) @punctuation.special

(container_closer
  "/" @punctuation.special)

(component_slot
  "#" @punctuation.special)

(param_continuation
  "+" @punctuation.special)

(component_name) @tag

(slot_name) @label

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

; A definition's name, `card` of `component=card`, is a component's name, not a bare value: first and with a higher
; priority, as editors differ in which of two patterns wins.
((info_string
  (param
    key: (param_key
      name: (param_name) @_key)
    value: (bare_value) @tag))
  (#eq? @_key "component")
  (#set! priority 101))

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

(definition_separator) @punctuation.delimiter
