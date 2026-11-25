; Text objects, with nvim-treesitter-textobjects' names: a component is a block, a param a parameter.

; An inline component; inside, its fallback (spec §4.4).
(inline_component) @block.outer

(inline_component
  (fallback) @block.inner)

; A param, `key=value`; inside, its value (spec §5.1).
(param) @parameter.outer

(param
  value: (_) @parameter.inner)

(param_list) @attribute.outer
