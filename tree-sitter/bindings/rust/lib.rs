//! CompMD's grammars for the [tree-sitter] parsing library: [`LANGUAGE`] parses a document's blocks (component lines,
//! containers, component definitions, the frontmatter), [`INLINE_LANGUAGE`] the text of each block (inline
//! components, interpolation, wiki links, math), and [`CEL_LANGUAGE`] an expression param's CEL.
//!
//! An editor parses a document with [`LANGUAGE`], then each `inline` node's text with [`INLINE_LANGUAGE`], as the
//! injection queries say:
//!
//! ```
//! let code = "::: card {title=\"Setup\"}\nRun :badge[beta]{tone=info}.\n::: /card\n";
//! let mut parser = tree_sitter::Parser::new();
//! parser
//!     .set_language(&tree_sitter_compmd::LANGUAGE.into())
//!     .expect("Error loading the CompMD grammar");
//! let tree = parser.parse(code, None).unwrap();
//! assert!(!tree.root_node().has_error());
//! ```
//!
//! [tree-sitter]: https://tree-sitter.github.io/

use tree_sitter_language::LanguageFn;

unsafe extern "C" {
    fn tree_sitter_compmd() -> *const ();
    fn tree_sitter_compmd_inline() -> *const ();
    fn tree_sitter_cel() -> *const ();
}

/// The block grammar's [`LanguageFn`].
pub const LANGUAGE: LanguageFn = unsafe { LanguageFn::from_raw(tree_sitter_compmd) };

/// The inline grammar's [`LanguageFn`].
pub const INLINE_LANGUAGE: LanguageFn = unsafe { LanguageFn::from_raw(tree_sitter_compmd_inline) };

/// CEL's [`LanguageFn`].
pub const CEL_LANGUAGE: LanguageFn = unsafe { LanguageFn::from_raw(tree_sitter_cel) };

/// The block grammar's highlighting query.
pub const HIGHLIGHTS_QUERY: &str = include_str!("../../compmd/queries/highlights.scm");

/// The block grammar's injection query.
pub const INJECTIONS_QUERY: &str = include_str!("../../compmd/queries/injections.scm");

/// The block grammar's folds query.
pub const FOLDS_QUERY: &str = include_str!("../../compmd/queries/folds.scm");

/// The block grammar's text objects query.
pub const TEXTOBJECTS_QUERY: &str = include_str!("../../compmd/queries/textobjects.scm");

/// The inline grammar's highlighting query.
pub const INLINE_HIGHLIGHTS_QUERY: &str = include_str!("../../compmd-inline/queries/highlights.scm");

/// The inline grammar's injection query.
pub const INLINE_INJECTIONS_QUERY: &str = include_str!("../../compmd-inline/queries/injections.scm");

/// The inline grammar's text objects query.
pub const INLINE_TEXTOBJECTS_QUERY: &str = include_str!("../../compmd-inline/queries/textobjects.scm");

/// CEL's highlighting query.
pub const CEL_HIGHLIGHTS_QUERY: &str = include_str!("../../cel/queries/highlights.scm");

/// The block grammar's [`node-types.json`].
///
/// [`node-types.json`]: https://tree-sitter.github.io/tree-sitter/using-parsers/6-static-node-types
pub const NODE_TYPES: &str = include_str!("../../compmd/src/node-types.json");

/// The inline grammar's [`node-types.json`].
///
/// [`node-types.json`]: https://tree-sitter.github.io/tree-sitter/using-parsers/6-static-node-types
pub const INLINE_NODE_TYPES: &str = include_str!("../../compmd-inline/src/node-types.json");

/// CEL's [`node-types.json`].
///
/// [`node-types.json`]: https://tree-sitter.github.io/tree-sitter/using-parsers/6-static-node-types
pub const CEL_NODE_TYPES: &str = include_str!("../../cel/src/node-types.json");

#[cfg(test)]
mod tests {
    use super::*;

    fn parser(language: LanguageFn) -> tree_sitter::Parser {
        let mut parser = tree_sitter::Parser::new();
        parser.set_language(&language.into()).expect("Error loading a CompMD grammar");
        parser
    }

    #[test]
    fn each_grammar_loads_and_its_queries_compile() {
        for (language, queries) in [
            (LANGUAGE, vec![HIGHLIGHTS_QUERY, INJECTIONS_QUERY, FOLDS_QUERY, TEXTOBJECTS_QUERY]),
            (INLINE_LANGUAGE, vec![INLINE_HIGHLIGHTS_QUERY, INLINE_INJECTIONS_QUERY, INLINE_TEXTOBJECTS_QUERY]),
            (CEL_LANGUAGE, vec![CEL_HIGHLIGHTS_QUERY]),
        ] {
            parser(language);
            for query in queries {
                tree_sitter::Query::new(&language.into(), query).expect("a query compiles");
            }
        }
    }

    #[test]
    fn a_container_parses() {
        let tree = parser(LANGUAGE).parse("::: card\nHello.\n::: /card\n", None).unwrap();
        assert!(!tree.root_node().has_error());
        assert_eq!(tree.root_node().child(0).unwrap().child(0).unwrap().kind(), "component_container");
    }
}
