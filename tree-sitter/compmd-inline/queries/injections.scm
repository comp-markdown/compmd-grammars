; Generated from syntax/injections.json by tree-sitter/scripts/injections.js: edit those, not this.

; An expression param's CEL (spec §8.2)
((expression_code) @injection.content
  (#set! injection.language "cel"))

; A JSON param value (spec §3.1)
((json) @injection.content
  (#set! injection.language "json"))

; Inline HTML (spec §2.3)
((html_tag) @injection.content
  (#set! injection.language "html"))

; Math's TeX (spec §2.3)
((latex_content) @injection.content
  (#set! injection.language "latex"))
