; CEL (spec §8.2).

(identifier) @variable

((identifier) @variable.builtin
  (#eq? @variable.builtin "md"))

(member_expression
  member: (identifier) @variable.member)

(call_expression
  function: (identifier) @function.call)

(call_expression
  function: (member_expression
    member: (identifier) @function.method.call))

((call_expression
  function: (identifier) @function.macro)
  (#any-of? @function.macro "has"))

((call_expression
  function: (member_expression
    member: (identifier) @function.macro))
  (#any-of? @function.macro "all" "exists" "exists_one" "filter" "map"))

(number) @number

(string) @string

(bytes) @string.special

[
  (true)
  (false)
] @boolean

(null) @constant.builtin

(comment) @comment

[
  "||"
  "&&"
  "=="
  "!="
  "<"
  "<="
  ">"
  ">="
  "+"
  "-"
  "*"
  "/"
  "%"
  "!"
] @operator

"in" @keyword.operator

[
  "?"
  ":"
] @keyword.conditional.ternary

[
  "("
  ")"
  "["
  "]"
  "{"
  "}"
] @punctuation.bracket

[
  ","
  "."
] @punctuation.delimiter
