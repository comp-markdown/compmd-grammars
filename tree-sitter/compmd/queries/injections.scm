; Generated from syntax/injections.json by tree-sitter/scripts/injections.js: edit those, not this.

; Each block's text, inline Markdown with CompMD's inline components
([
  (inline)
  (pipe_table_cell)
] @injection.content
  (#set! injection.language "compmd_inline"))

; YAML frontmatter, between `---` lines (spec §2.1)
((minus_metadata) @injection.content
  (#set! injection.language "yaml")
  (#offset! @injection.content 1 0 -1 0)
  (#set! injection.include-children))

; TOML frontmatter, between `+++` lines (spec §2.1)
((plus_metadata) @injection.content
  (#set! injection.language "toml")
  (#offset! @injection.content 1 0 -1 0)
  (#set! injection.include-children))

; An expression param's CEL (spec §8.2)
((expression_code) @injection.content
  (#set! injection.language "cel"))

; A JSON param value (spec §3.1)
((json) @injection.content
  (#set! injection.language "json"))

; A component definition's or a signature fence's signature (spec §7.1, §7.3)
((definition_signature) @injection.content
  (#set! injection.language "yaml"))

; A component definition's body, CompMD (spec §7.2)
((definition_body) @injection.content
  (#set! injection.language "compmd"))

; A fenced code block's text, by its fence's language: a renderer's block, or a ```compmd example, CompMD again (spec §7.7, §7.8)
(fenced_code_block
  (info_string
    (language) @injection.language)
  (code_fence_content) @injection.content)

; An HTML block (spec §2.3)
((html_block) @injection.content
  (#set! injection.language "html")
  (#set! injection.include-children)
  (#set! injection.combined))
