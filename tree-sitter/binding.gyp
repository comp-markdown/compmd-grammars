{
  "targets": [
    {
      "target_name": "tree_sitter_compmd_binding",
      "dependencies": [
        "<!(node -p \"require('node-addon-api').targets\"):node_addon_api_except",
      ],
      "include_dirs": [
        "compmd/src",
      ],
      "sources": [
        "bindings/node/binding.cc",
        "compmd/src/parser.c",
        "compmd/src/scanner.c",
        "compmd-inline/src/parser.c",
        "compmd-inline/src/scanner.c",
        "cel/src/parser.c",
      ],
      "conditions": [
        ["OS!='win'", {
          "cflags_c": [
            "-std=c11",
          ],
        }, { # OS == "win"
          "cflags_c": [
            "/std:c11",
            "/utf-8",
          ],
        }],
      ],
    }
  ]
}
