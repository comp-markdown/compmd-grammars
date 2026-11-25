// CompMD's inline scanner: tree-sitter-markdown's (v0.5.4, MIT,
// https://github.com/tree-sitter-grammars/tree-sitter-markdown), with CompMD's
// inline components, interpolation and math by Pandoc's rule. What CompMD adds
// or changes is marked with its spec's sections; the rest is
// tree-sitter-markdown's, unchanged.

#include "tree_sitter/parser.h"
#include "../../common/params.h"

#ifdef _MSC_VER
#define UNUSED
#else
#define UNUSED __attribute__((unused))
#endif

// For explanation of the tokens see grammar.js
typedef enum {
    ERROR,
    TRIGGER_ERROR,
    CODE_SPAN_START,
    CODE_SPAN_CLOSE,
    EMPHASIS_OPEN_STAR,
    EMPHASIS_OPEN_UNDERSCORE,
    EMPHASIS_CLOSE_STAR,
    EMPHASIS_CLOSE_UNDERSCORE,
    LAST_TOKEN_WHITESPACE,
    LAST_TOKEN_PUNCTUATION,
    STRIKETHROUGH_OPEN,
    STRIKETHROUGH_CLOSE,
    LATEX_SPAN_START,
    LATEX_SPAN_CLOSE,
    UNCLOSED_SPAN,
    // CompMD's: an inline component's `:` (spec §3), a run of colons that is
    // text (spec §3.2, rule 4), an interpolation's `{{` (spec §8.1), and the
    // text of math between its `$`s (spec §2.3).
    INLINE_COMPONENT_MARKER,
    COLON_RUN,
    INTERPOLATION_OPEN,
    LATEX_SPAN_CONTENT,
    // An inline component's param list's `{`, when the list reads (spec §5).
    PARAM_LIST_OPEN,
} TokenType;

// Determines if a character is punctuation as defined by the markdown spec.
static bool is_punctuation(int32_t chr) {
    return (chr >= '!' && chr <= '/') || (chr >= ':' && chr <= '@') ||
           (chr >= '[' && chr <= '`') || (chr >= '{' && chr <= '~');
}

// State bitflags used with `Scanner.state`

// TODO
static UNUSED const uint8_t STATE_EMPHASIS_DELIMITER_MOD_3 = 0x3;
// Current delimiter run is opening
static const uint8_t STATE_EMPHASIS_DELIMITER_IS_OPEN = 0x1 << 2;

// Convenience function to emit the error token. This is done to stop invalid
// parse branches. Specifically:
// 1. When encountering a newline after a line break that ended a paragraph, and
// no new block
//    has been opened.
// 2. When encountering a new block after a soft line break.
// 3. When a `$._trigger_error` token is valid, which is used to stop parse
// branches through
//    normal tree-sitter grammar rules.
//
// See also the `$._soft_line_break` and `$._paragraph_end_newline` tokens in
// grammar.js
static bool error(TSLexer *lexer) {
    lexer->result_symbol = ERROR;
    return true;
}

typedef struct {
    // Parser state flags
    uint8_t state;
    uint8_t code_span_delimiter_length;
    uint8_t latex_span_delimiter_length;
    // The number of characters remaining in the currrent emphasis delimiter
    // run.
    uint8_t num_emphasis_delimiters_left;
    // The number of characters of the open math's text, read as one token
    // after its opening `$` (spec §2.3).
    uint16_t latex_content_length;

} Scanner;

// Write the whole state of a Scanner to a byte buffer
static unsigned serialize(Scanner *s, char *buffer) {
    unsigned size = 0;
    buffer[size++] = (char)s->state;
    buffer[size++] = (char)s->code_span_delimiter_length;
    buffer[size++] = (char)s->latex_span_delimiter_length;
    buffer[size++] = (char)s->num_emphasis_delimiters_left;
    buffer[size++] = (char)(s->latex_content_length & 0xff);
    buffer[size++] = (char)(s->latex_content_length >> 8);
    return size;
}

// Read the whole state of a Scanner from a byte buffer
// `serizalize` and `deserialize` should be fully symmetric.
static void deserialize(Scanner *s, const char *buffer, unsigned length) {
    s->state = 0;
    s->code_span_delimiter_length = 0;
    s->latex_span_delimiter_length = 0;
    s->num_emphasis_delimiters_left = 0;
    s->latex_content_length = 0;
    if (length > 0) {
        size_t size = 0;
        s->state = (uint8_t)buffer[size++];
        s->code_span_delimiter_length = (uint8_t)buffer[size++];
        s->latex_span_delimiter_length = (uint8_t)buffer[size++];
        s->num_emphasis_delimiters_left = (uint8_t)buffer[size++];
        s->latex_content_length = (uint16_t)(uint8_t)buffer[size++];
        s->latex_content_length |=
            (uint16_t)((uint16_t)(uint8_t)buffer[size++] << 8);
    }
}

static bool parse_leaf_delimiter(TSLexer *lexer, uint8_t *delimiter_length,
                                 const bool *valid_symbols,
                                 const char delimiter,
                                 const TokenType open_token,
                                 const TokenType close_token) {
    uint8_t level = 0;
    while (lexer->lookahead == delimiter) {
        lexer->advance(lexer, false);
        level++;
    }
    lexer->mark_end(lexer);
    if (level == *delimiter_length && valid_symbols[close_token]) {
        *delimiter_length = 0;
        lexer->result_symbol = close_token;
        return true;
    }
    if (valid_symbols[open_token]) {
        // Parse ahead to check if there is a closing delimiter
        size_t close_level = 0;
        while (!lexer->eof(lexer)) {
            if (lexer->lookahead == delimiter) {
                close_level++;
            } else {
                if (close_level == level) {
                    // Found a matching delimiter
                    break;
                }
                close_level = 0;
            }
            lexer->advance(lexer, false);
        }
        if (close_level == level) {
            *delimiter_length = level;
            lexer->result_symbol = open_token;
            return true;
        }
        if (valid_symbols[UNCLOSED_SPAN]) {
            lexer->result_symbol = UNCLOSED_SPAN;
            return true;
        }
    }
    return false;
}

static bool parse_backtick(Scanner *s, TSLexer *lexer,
                           const bool *valid_symbols) {
    return parse_leaf_delimiter(lexer, &s->code_span_delimiter_length,
                                valid_symbols, '`', CODE_SPAN_START,
                                CODE_SPAN_CLOSE);
}

static bool is_space(int32_t chr) {
    return chr == ' ' || chr == '\t' || chr == '\n' || chr == '\r';
}

static bool is_digit(int32_t chr) { return chr >= '0' && chr <= '9'; }

// The length of single-dollar math's text, from after its opening `$`, by
// Pandoc's rule (spec §2.3): it opens before a non-space character, and closes
// at an unescaped `$` outside braces, after a non-space character and before
// no digit; a `$` after white space outside braces ends the attempt. Returns -1
// when nothing closes it.
static int32_t pandoc_math_length(TSLexer *lexer) {
    if (lexer->eof(lexer) || is_space(lexer->lookahead)) {
        return -1;
    }
    int32_t length = 0;
    uint32_t depth = 0;
    int32_t previous = 0;
    while (!lexer->eof(lexer)) {
        int32_t chr = lexer->lookahead;
        if (chr == '\\') {
            lexer->advance(lexer, false);
            length++;
            if (lexer->eof(lexer)) {
                break;
            }
            previous = lexer->lookahead;
            lexer->advance(lexer, false);
            length++;
            continue;
        }
        if (chr == '{') {
            depth++;
        } else if (chr == '}' && depth > 0) {
            depth--;
        } else if (chr == '$' && depth == 0) {
            if (is_space(previous)) {
                return -1;
            }
            lexer->advance(lexer, false);
            if (!is_digit(lexer->lookahead)) {
                return length;
            }
            previous = chr;
            length++;
            continue;
        }
        previous = chr;
        lexer->advance(lexer, false);
        length++;
    }
    return -1;
}

// The length of `$$` math's text (or a longer run's): to the next run of as
// many dollars, as tree-sitter-markdown reads it. Returns -1 when none closes.
static int32_t dollar_run_math_length(TSLexer *lexer, uint8_t level) {
    int32_t length = 0;
    uint8_t run = 0;
    while (!lexer->eof(lexer)) {
        if (lexer->lookahead == '$') {
            run++;
        } else {
            if (run == level) {
                return length - run;
            }
            run = 0;
        }
        lexer->advance(lexer, false);
        length++;
    }
    return run == level ? length - run : -1;
}

// Math (spec §2.3): the opening run of dollars, its text as one token, then
// the closing run.
static bool parse_dollar(Scanner *s, TSLexer *lexer,
                         const bool *valid_symbols) {
    uint8_t level = 0;
    while (lexer->lookahead == '$') {
        lexer->advance(lexer, false);
        level++;
    }
    lexer->mark_end(lexer);
    if (level == s->latex_span_delimiter_length &&
        valid_symbols[LATEX_SPAN_CLOSE]) {
        s->latex_span_delimiter_length = 0;
        lexer->result_symbol = LATEX_SPAN_CLOSE;
        return true;
    }
    if (!valid_symbols[LATEX_SPAN_START]) {
        return false;
    }
    int32_t length = level == 1 ? pandoc_math_length(lexer)
                                : dollar_run_math_length(lexer, level);
    if (length >= 0 && length <= UINT16_MAX) {
        s->latex_span_delimiter_length = level;
        s->latex_content_length = (uint16_t)length;
        lexer->result_symbol = LATEX_SPAN_START;
        return true;
    }
    if (valid_symbols[UNCLOSED_SPAN]) {
        lexer->result_symbol = UNCLOSED_SPAN;
        return true;
    }
    return false;
}

// The text of the open math, as many characters as its opening found.
static bool parse_latex_content(Scanner *s, TSLexer *lexer) {
    for (uint16_t i = 0; i < s->latex_content_length; i++) {
        lexer->advance(lexer, false);
    }
    s->latex_content_length = 0;
    lexer->result_symbol = LATEX_SPAN_CONTENT;
    return true;
}

static bool is_name_start(int32_t chr) {
    return (chr >= 'A' && chr <= 'Z') || (chr >= 'a' && chr <= 'z');
}

static bool is_name_char(int32_t chr) {
    return is_name_start(chr) || is_digit(chr) || chr == '-' || chr == '_';
}

// Whether a fallback's matching `]` follows, from after its `[` (spec §3.2,
// rule 9): brackets nest, `\[` and `\]` don't count, and a code span binds
// tighter, so a `]` inside one doesn't end it.
static bool fallback_closes(TSLexer *lexer) {
    uint32_t depth = 1;
    while (!lexer->eof(lexer)) {
        int32_t chr = lexer->lookahead;
        if (chr == '\\') {
            lexer->advance(lexer, false);
            if (!lexer->eof(lexer)) {
                lexer->advance(lexer, false);
            }
            continue;
        }
        if (chr == '`') {
            // A code span closes at the next run of as many backticks; a run
            // that none closes is text, and the scan goes on after it.
            uint8_t run = 0;
            while (lexer->lookahead == '`') {
                lexer->advance(lexer, false);
                run++;
            }
            // Without a look back, a run that never closes ends the scan: its
            // brackets can't be told apart from the span's.
            uint8_t close = 0;
            while (!lexer->eof(lexer)) {
                if (lexer->lookahead == '`') {
                    close++;
                } else if (close == run) {
                    break;
                } else {
                    close = 0;
                }
                lexer->advance(lexer, false);
            }
            if (close != run) {
                return false;
            }
            continue;
        }
        if (chr == '[') {
            depth++;
        } else if (chr == ']' && --depth == 0) {
            return true;
        }
        lexer->advance(lexer, false);
    }
    return false;
}

// `:` of an inline component (spec §3, §3.2 rule 4): after white space, the
// start of the text or punctuation other than `:` and `\`, before a name, a
// `[` and the fallback's matching `]`. A run of two or more colons is text, so
// no component starts at its second colon (`std::vec[0]`).
static bool parse_colon(TSLexer *lexer, const bool *valid_symbols) {
    lexer->advance(lexer, false);
    if (lexer->lookahead == ':') {
        while (lexer->lookahead == ':') {
            lexer->advance(lexer, false);
        }
        lexer->result_symbol = COLON_RUN;
        return valid_symbols[COLON_RUN];
    }
    if (!valid_symbols[INLINE_COMPONENT_MARKER] ||
        !(valid_symbols[LAST_TOKEN_WHITESPACE] ||
          valid_symbols[LAST_TOKEN_PUNCTUATION]) ||
        !is_name_start(lexer->lookahead)) {
        return false;
    }
    lexer->mark_end(lexer);
    while (is_name_char(lexer->lookahead)) {
        lexer->advance(lexer, false);
    }
    if (lexer->lookahead != '[') {
        return false;
    }
    lexer->advance(lexer, false);
    if (!fallback_closes(lexer)) {
        return false;
    }
    lexer->result_symbol = INLINE_COMPONENT_MARKER;
    return true;
}

// `{{` of an interpolation (spec §8.1), from its second `{`: before optional
// spaces, a path, optional spaces and `}}`, on its line. Anything else is text
// (W106).
static bool parse_interpolation_open(TSLexer *lexer) {
    lexer->advance(lexer, false);
    lexer->mark_end(lexer);
    while (lexer->lookahead == ' ') {
        lexer->advance(lexer, false);
    }
    for (;;) {
        if (!(is_name_start(lexer->lookahead) || lexer->lookahead == '_')) {
            return false;
        }
        while (is_name_start(lexer->lookahead) || is_digit(lexer->lookahead) ||
               lexer->lookahead == '_') {
            lexer->advance(lexer, false);
        }
        if (lexer->lookahead != '.') {
            break;
        }
        lexer->advance(lexer, false);
    }
    while (lexer->lookahead == ' ') {
        lexer->advance(lexer, false);
    }
    if (lexer->lookahead != '}') {
        return false;
    }
    lexer->advance(lexer, false);
    if (lexer->lookahead != '}') {
        return false;
    }
    lexer->result_symbol = INTERPOLATION_OPEN;
    return true;
}

// `{`: an interpolation's `{{`, or the `{` of a param list that reads, after
// an inline component's `]` (spec §3.1: after a `]`, `{{` is an
// interpolation). Any other `{` is text.
static bool parse_brace(TSLexer *lexer, const bool *valid_symbols) {
    lexer->advance(lexer, false);
    if (lexer->lookahead == '{') {
        return valid_symbols[INTERPOLATION_OPEN] &&
               parse_interpolation_open(lexer);
    }
    if (!valid_symbols[PARAM_LIST_OPEN]) {
        return false;
    }
    lexer->mark_end(lexer);
    if (!compmd_params_read(lexer, true)) {
        return false;
    }
    lexer->result_symbol = PARAM_LIST_OPEN;
    return true;
}

static bool parse_star(Scanner *s, TSLexer *lexer, const bool *valid_symbols) {
    lexer->advance(lexer, false);
    // If `num_emphasis_delimiters_left` is not zero then we already decided
    // that this should be part of an emphasis delimiter run, so interpret it as
    // such.
    if (s->num_emphasis_delimiters_left > 0) {
        // The `STATE_EMPHASIS_DELIMITER_IS_OPEN` state flag tells us wether it
        // should be open or close.
        if ((s->state & STATE_EMPHASIS_DELIMITER_IS_OPEN) &&
            valid_symbols[EMPHASIS_OPEN_STAR]) {
            s->state &= (~STATE_EMPHASIS_DELIMITER_IS_OPEN);
            lexer->result_symbol = EMPHASIS_OPEN_STAR;
            s->num_emphasis_delimiters_left--;
            return true;
        }
        if (valid_symbols[EMPHASIS_CLOSE_STAR]) {
            lexer->result_symbol = EMPHASIS_CLOSE_STAR;
            s->num_emphasis_delimiters_left--;
            return true;
        }
    }
    lexer->mark_end(lexer);
    // Otherwise count the number of stars
    uint8_t star_count = 1;
    while (lexer->lookahead == '*') {
        star_count++;
        lexer->advance(lexer, false);
    }
    bool line_end = lexer->lookahead == '\n' || lexer->lookahead == '\r' ||
                    lexer->eof(lexer);
    if (valid_symbols[EMPHASIS_OPEN_STAR] ||
        valid_symbols[EMPHASIS_CLOSE_STAR]) {
        // The desicion made for the first star also counts for all the
        // following stars in the delimiter run. Rembemer how many there are.
        s->num_emphasis_delimiters_left = star_count - 1;
        // Look ahead to the next symbol (after the last star) to find out if it
        // is whitespace punctuation or other.
        bool next_symbol_whitespace =
            line_end || lexer->lookahead == ' ' || lexer->lookahead == '\t';
        bool next_symbol_punctuation = is_punctuation(lexer->lookahead);
        // Information about the last token is in valid_symbols. See grammar.js
        // for these tokens for how this is done.
        if (valid_symbols[EMPHASIS_CLOSE_STAR] &&
            !valid_symbols[LAST_TOKEN_WHITESPACE] &&
            (!valid_symbols[LAST_TOKEN_PUNCTUATION] ||
             next_symbol_punctuation || next_symbol_whitespace)) {
            // Closing delimiters take precedence
            s->state &= ~STATE_EMPHASIS_DELIMITER_IS_OPEN;
            lexer->result_symbol = EMPHASIS_CLOSE_STAR;
            return true;
        }
        if (!next_symbol_whitespace && (!next_symbol_punctuation ||
                                        valid_symbols[LAST_TOKEN_PUNCTUATION] ||
                                        valid_symbols[LAST_TOKEN_WHITESPACE])) {
            s->state |= STATE_EMPHASIS_DELIMITER_IS_OPEN;
            lexer->result_symbol = EMPHASIS_OPEN_STAR;
            return true;
        }
    }
    return false;
}

static bool parse_tilde(Scanner *s, TSLexer *lexer, const bool *valid_symbols) {
    lexer->advance(lexer, false);
    // If `num_emphasis_delimiters_left` is not zero then we already decided
    // that this should be part of an emphasis delimiter run, so interpret it as
    // such.
    if (s->num_emphasis_delimiters_left > 0) {
        // The `STATE_EMPHASIS_DELIMITER_IS_OPEN` state flag tells us wether it
        // should be open or close.
        if ((s->state & STATE_EMPHASIS_DELIMITER_IS_OPEN) &&
            valid_symbols[STRIKETHROUGH_OPEN]) {
            s->state &= (~STATE_EMPHASIS_DELIMITER_IS_OPEN);
            lexer->result_symbol = STRIKETHROUGH_OPEN;
            s->num_emphasis_delimiters_left--;
            return true;
        }
        if (valid_symbols[STRIKETHROUGH_CLOSE]) {
            lexer->result_symbol = STRIKETHROUGH_CLOSE;
            s->num_emphasis_delimiters_left--;
            return true;
        }
    }
    lexer->mark_end(lexer);
    // Otherwise count the number of tildes
    uint8_t star_count = 1;
    while (lexer->lookahead == '~') {
        star_count++;
        lexer->advance(lexer, false);
    }
    bool line_end = lexer->lookahead == '\n' || lexer->lookahead == '\r' ||
                    lexer->eof(lexer);
    if (valid_symbols[STRIKETHROUGH_OPEN] ||
        valid_symbols[STRIKETHROUGH_CLOSE]) {
        // The desicion made for the first star also counts for all the
        // following stars in the delimiter run. Rembemer how many there are.
        s->num_emphasis_delimiters_left = star_count - 1;
        // Look ahead to the next symbol (after the last star) to find out if it
        // is whitespace punctuation or other.
        bool next_symbol_whitespace =
            line_end || lexer->lookahead == ' ' || lexer->lookahead == '\t';
        bool next_symbol_punctuation = is_punctuation(lexer->lookahead);
        // Information about the last token is in valid_symbols. See grammar.js
        // for these tokens for how this is done.
        if (valid_symbols[STRIKETHROUGH_CLOSE] &&
            !valid_symbols[LAST_TOKEN_WHITESPACE] &&
            (!valid_symbols[LAST_TOKEN_PUNCTUATION] ||
             next_symbol_punctuation || next_symbol_whitespace)) {
            // Closing delimiters take precedence
            s->state &= ~STATE_EMPHASIS_DELIMITER_IS_OPEN;
            lexer->result_symbol = STRIKETHROUGH_CLOSE;
            return true;
        }
        if (!next_symbol_whitespace && (!next_symbol_punctuation ||
                                        valid_symbols[LAST_TOKEN_PUNCTUATION] ||
                                        valid_symbols[LAST_TOKEN_WHITESPACE])) {
            s->state |= STATE_EMPHASIS_DELIMITER_IS_OPEN;
            lexer->result_symbol = STRIKETHROUGH_OPEN;
            return true;
        }
    }
    return false;
}

static bool parse_underscore(Scanner *s, TSLexer *lexer,
                             const bool *valid_symbols) {
    lexer->advance(lexer, false);
    // If `num_emphasis_delimiters_left` is not zero then we already decided
    // that this should be part of an emphasis delimiter run, so interpret it as
    // such.
    if (s->num_emphasis_delimiters_left > 0) {
        // The `STATE_EMPHASIS_DELIMITER_IS_OPEN` state flag tells us wether it
        // should be open or close.
        if ((s->state & STATE_EMPHASIS_DELIMITER_IS_OPEN) &&
            valid_symbols[EMPHASIS_OPEN_UNDERSCORE]) {
            s->state &= (~STATE_EMPHASIS_DELIMITER_IS_OPEN);
            lexer->result_symbol = EMPHASIS_OPEN_UNDERSCORE;
            s->num_emphasis_delimiters_left--;
            return true;
        }
        if (valid_symbols[EMPHASIS_CLOSE_UNDERSCORE]) {
            lexer->result_symbol = EMPHASIS_CLOSE_UNDERSCORE;
            s->num_emphasis_delimiters_left--;
            return true;
        }
    }
    lexer->mark_end(lexer);
    // Otherwise count the number of stars
    uint8_t underscore_count = 1;
    while (lexer->lookahead == '_') {
        underscore_count++;
        lexer->advance(lexer, false);
    }
    bool line_end = lexer->lookahead == '\n' || lexer->lookahead == '\r' ||
                    lexer->eof(lexer);
    if (valid_symbols[EMPHASIS_OPEN_UNDERSCORE] ||
        valid_symbols[EMPHASIS_CLOSE_UNDERSCORE]) {
        // The desicion made for the first underscore also counts for all the
        // following underscores in the delimiter run. Rembemer how many there are.
        s->num_emphasis_delimiters_left = underscore_count - 1;
        // Look ahead to the next symbol (after the last underscore) to find out if it
        // is whitespace punctuation or other.
        bool next_symbol_whitespace =
            line_end || lexer->lookahead == ' ' || lexer->lookahead == '\t';
        bool next_symbol_punctuation = is_punctuation(lexer->lookahead);
        // Information about the last token is in valid_symbols. See grammar.js
        // for these tokens for how this is done.
        if (valid_symbols[EMPHASIS_CLOSE_UNDERSCORE] &&
            !valid_symbols[LAST_TOKEN_WHITESPACE] &&
            (!valid_symbols[LAST_TOKEN_PUNCTUATION] ||
             next_symbol_punctuation || next_symbol_whitespace)) {
            // Closing delimiters take precedence
            s->state &= ~STATE_EMPHASIS_DELIMITER_IS_OPEN;
            lexer->result_symbol = EMPHASIS_CLOSE_UNDERSCORE;
            return true;
        }
        if (!next_symbol_whitespace && (!next_symbol_punctuation ||
                                        valid_symbols[LAST_TOKEN_PUNCTUATION] ||
                                        valid_symbols[LAST_TOKEN_WHITESPACE])) {
            s->state |= STATE_EMPHASIS_DELIMITER_IS_OPEN;
            lexer->result_symbol = EMPHASIS_OPEN_UNDERSCORE;
            return true;
        }
    }
    return false;
}

static bool scan(Scanner *s, TSLexer *lexer, const bool *valid_symbols) {
    // A normal tree-sitter rule decided that the current branch is invalid and
    // now "requests" an error to stop the branch
    if (valid_symbols[TRIGGER_ERROR]) {
        return error(lexer);
    }

    if (valid_symbols[LATEX_SPAN_CONTENT] && s->latex_content_length > 0) {
        return parse_latex_content(s, lexer);
    }

    // Decide which tokens to consider based on the first non-whitespace
    // character
    switch (lexer->lookahead) {
        case ':':
            return parse_colon(lexer, valid_symbols);
        case '{':
            return parse_brace(lexer, valid_symbols);
        case '`':
            // A backtick could mark the beginning or ending of a code span or a
            // fenced code block.
            return parse_backtick(s, lexer, valid_symbols);
        case '$':
            return parse_dollar(s, lexer, valid_symbols);
        case '*':
            // A star could either mark the beginning or ending of emphasis, a
            // list item or thematic break. This code is similar to the code for
            // '_' and '+'.
            return parse_star(s, lexer, valid_symbols);
        case '_':
            return parse_underscore(s, lexer, valid_symbols);
        case '~':
            return parse_tilde(s, lexer, valid_symbols);
    }
    return false;
}

void *tree_sitter_compmd_inline_external_scanner_create() {
    Scanner *s = (Scanner *)malloc(sizeof(Scanner));
    deserialize(s, NULL, 0);
    return s;
}

bool tree_sitter_compmd_inline_external_scanner_scan(
    void *payload, TSLexer *lexer, const bool *valid_symbols) {
    Scanner *scanner = (Scanner *)payload;
    return scan(scanner, lexer, valid_symbols);
}

unsigned tree_sitter_compmd_inline_external_scanner_serialize(void *payload,
                                                                char *buffer) {
    Scanner *scanner = (Scanner *)payload;
    return serialize(scanner, buffer);
}

void tree_sitter_compmd_inline_external_scanner_deserialize(void *payload,
                                                              const char *buffer,
                                                              unsigned length) {
    Scanner *scanner = (Scanner *)payload;
    deserialize(scanner, buffer, length);
}

void tree_sitter_compmd_inline_external_scanner_destroy(void *payload) {
    Scanner *scanner = (Scanner *)payload;
    free(scanner);
}
