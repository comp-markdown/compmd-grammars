type BaseNode = {
  type: string;
  named: boolean;
};

type ChildNode = {
  multiple: boolean;
  required: boolean;
  types: BaseNode[];
};

type NodeInfo =
  | (BaseNode & {
      subtypes: BaseNode[];
    })
  | (BaseNode & {
      fields: { [name: string]: ChildNode };
      children: ChildNode[];
    });

/** A grammar: its language object, for `Parser.setLanguage`, its node types and its queries. */
type Grammar = {
  /** The grammar's name. */
  name: string;

  /**
   * The inner language object.
   * @private
   */
  language: unknown;

  /**
   * The content of the grammar's `node-types.json` file.
   *
   * @see {@linkplain https://tree-sitter.github.io/tree-sitter/using-parsers/6-static-node-types Static Node Types}
   */
  nodeTypeInfo: NodeInfo[];

  /** The syntax highlighting query. */
  HIGHLIGHTS_QUERY?: string;

  /** The language injection query. */
  INJECTIONS_QUERY?: string;

  /** The text objects query: a component is a block, a param a parameter. */
  TEXTOBJECTS_QUERY?: string;
};

/**
 * CompMD's block grammar, with the inline grammar it injects into each block's text, and CEL, which it injects into
 * expressions.
 *
 * @example
 * import Parser from "tree-sitter";
 * import CompMD from "tree-sitter-compmd";
 *
 * const parser = new Parser();
 * parser.setLanguage(CompMD);
 * const tree = parser.parse("::: card\nHello.\n::: /card\n");
 */
declare const binding: Grammar & {
  /** The folds query: sections, lists, code blocks and containers. */
  FOLDS_QUERY?: string;

  /** The inline grammar: inline components, interpolation, wiki links and math in a block's text. */
  inline: Grammar;

  /** CEL, the language of expressions. */
  cel: Grammar;
};

export default binding;
