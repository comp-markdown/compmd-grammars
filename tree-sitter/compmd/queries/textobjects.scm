; Text objects, with nvim-treesitter-textobjects' names: a component is a block, a param a parameter.

; A container, from its opener to its closer (spec §4.1), and a leaf (spec §4.3).
(component_container) @block.outer

(component_leaf) @block.outer

(fenced_code_block
  (component_definition) @block.inner) @block.outer

; A param, `key=value`; inside, its value (spec §5.1).
(param) @parameter.outer

(param
  value: (_) @parameter.inner)

(param_list) @attribute.outer
