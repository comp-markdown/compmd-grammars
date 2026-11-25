; Markdown's, as nvim-treesitter folds them, with a container to its closer and a component definition's fence
; (spec §4.1, §7).

([
  (fenced_code_block)
  (indented_code_block)
  (component_container)
  (list_item
    (list))
  (section)
] @fold
  (#trim! @fold))

(section
  (list) @fold
  (#trim! @fold))
