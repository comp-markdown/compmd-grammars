fn main() {
    let grammars = ["compmd", "compmd-inline", "cel"].map(|folder| std::path::Path::new(folder).join("src"));

    let mut c_config = cc::Build::new();
    c_config.std("c11").include(&grammars[0]);

    #[cfg(target_env = "msvc")]
    c_config.flag("-utf-8");

    if std::env::var("TARGET").unwrap() == "wasm32-unknown-unknown" {
        let Ok(wasm_headers) = std::env::var("DEP_TREE_SITTER_LANGUAGE_WASM_HEADERS") else {
            panic!("Environment variable DEP_TREE_SITTER_LANGUAGE_WASM_HEADERS must be set by the language crate");
        };

        c_config.include(&wasm_headers);
    }

    for src in &grammars {
        for file in ["parser.c", "scanner.c"] {
            let path = src.join(file);
            if path.exists() {
                c_config.file(&path);
                println!("cargo:rerun-if-changed={}", path.to_str().unwrap());
            }
        }
    }
    println!("cargo:rerun-if-changed=common/params.h");

    c_config.compile("tree-sitter-compmd");
}
