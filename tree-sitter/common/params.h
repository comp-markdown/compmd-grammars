// CompMD's param syntax (spec §3.1, §5.1), checked ahead by both scanners: whether params can be read from here as
// the grammars read them (`common/params.js`). A broken param damages only its own line (spec §5): a block line
// whose params don't read is one token to the line's end, and a `{` after an inline component that doesn't start a
// param list is text. The checks only look: the lexer moves, and they end no token.

#ifndef TREE_SITTER_COMPMD_PARAMS_H_
#define TREE_SITTER_COMPMD_PARAMS_H_

// Included by a scanner after its `tree_sitter/parser.h`, for `TSLexer`.

static inline bool compmd_at_line_end(TSLexer *lexer) {
    return lexer->lookahead == '\n' || lexer->lookahead == '\r' || lexer->eof(lexer);
}

static inline bool compmd_is_space(int32_t chr) { return chr == ' ' || chr == '\t'; }

static inline bool compmd_is_name_start(int32_t chr) {
    return (chr >= 'A' && chr <= 'Z') || (chr >= 'a' && chr <= 'z');
}

static inline bool compmd_is_name_char(int32_t chr) {
    return compmd_is_name_start(chr) || (chr >= '0' && chr <= '9') || chr == '-' || chr == '_';
}

// A bare value's character: anything but white space, quotes, parentheses, brackets and braces (spec §3.1).
static inline bool compmd_is_bare_char(int32_t chr) {
    return !(compmd_is_space(chr) || chr == '\n' || chr == '\r' || chr == 0 || chr == '"' || chr == '(' ||
             chr == ')' || chr == '[' || chr == ']' || chr == '{' || chr == '}');
}

// A name (spec §3.1, `name`).
static bool compmd_skip_name(TSLexer *lexer) {
    if (!compmd_is_name_start(lexer->lookahead)) {
        return false;
    }
    while (compmd_is_name_char(lexer->lookahead)) {
        lexer->advance(lexer, false);
    }
    return true;
}

// A quoted string, from its quote: to the next one not escaped, on its line.
static bool compmd_skip_string(TSLexer *lexer, int32_t quote) {
    lexer->advance(lexer, false);
    while (!compmd_at_line_end(lexer)) {
        int32_t chr = lexer->lookahead;
        lexer->advance(lexer, false);
        if (chr == '\\') {
            if (compmd_at_line_end(lexer)) {
                return false;
            }
            lexer->advance(lexer, false);
        } else if (chr == quote) {
            return true;
        }
    }
    return false;
}

// An expression, from its `(`: to the matching `)`, outside CEL's string literals, on its line.
static bool compmd_skip_expression(TSLexer *lexer) {
    uint32_t depth = 0;
    while (!compmd_at_line_end(lexer)) {
        int32_t chr = lexer->lookahead;
        if (chr == '"' || chr == '\'') {
            if (!compmd_skip_string(lexer, chr)) {
                return false;
            }
            continue;
        }
        lexer->advance(lexer, false);
        if (chr == '(') {
            depth++;
        } else if (chr == ')' && --depth == 0) {
            return true;
        }
    }
    return false;
}

// JSON, from its `[` or `{`: to the matching bracket, outside JSON's strings, on its line.
static bool compmd_skip_json(TSLexer *lexer) {
    uint32_t depth = 0;
    while (!compmd_at_line_end(lexer)) {
        int32_t chr = lexer->lookahead;
        if (chr == '"') {
            if (!compmd_skip_string(lexer, chr)) {
                return false;
            }
            continue;
        }
        lexer->advance(lexer, false);
        if (chr == '[' || chr == '{') {
            depth++;
        } else if ((chr == ']' || chr == '}') && --depth == 0) {
            return true;
        }
    }
    return false;
}

// One param (spec §5.1): `.class`, `#id`, a flag `key`, or `key=value` with a key's optional breakpoint.
static bool compmd_skip_param(TSLexer *lexer) {
    if (lexer->lookahead == '.' || lexer->lookahead == '#') {
        lexer->advance(lexer, false);
        return compmd_skip_name(lexer);
    }
    if (!compmd_skip_name(lexer)) {
        return false;
    }
    if (lexer->lookahead == ':') {
        lexer->advance(lexer, false);
        if (!compmd_skip_name(lexer)) {
            return false;
        }
    }
    if (lexer->lookahead != '=') {
        return true;
    }
    lexer->advance(lexer, false);
    switch (lexer->lookahead) {
        case '"':
            return compmd_skip_string(lexer, '"');
        case '(':
            return compmd_skip_expression(lexer);
        case '[':
        case '{':
            return compmd_skip_json(lexer);
    }
    // A bare value isn't empty (`title=`), and stops at white space or the list's end (spec §3.1).
    if (!compmd_is_bare_char(lexer->lookahead)) {
        return false;
    }
    while (compmd_is_bare_char(lexer->lookahead)) {
        lexer->advance(lexer, false);
    }
    return true;
}

// Params separated by white space, to the list's `}` or, on a continuation line, to the line's end.
static bool compmd_params_read(TSLexer *lexer, bool in_list) {
    for (;;) {
        while (compmd_is_space(lexer->lookahead)) {
            lexer->advance(lexer, false);
        }
        if (in_list ? lexer->lookahead == '}' : compmd_at_line_end(lexer)) {
            return true;
        }
        if (!compmd_skip_param(lexer)) {
            return false;
        }
        int32_t next = lexer->lookahead;
        bool ends = in_list ? next == '}' : compmd_at_line_end(lexer);
        if (!(compmd_is_space(next) || ends)) {
            return false;
        }
    }
}

// A param list, from its `{` (spec §3.1, `param-list`).
static inline bool compmd_param_list_reads(TSLexer *lexer) {
    lexer->advance(lexer, false);
    return compmd_params_read(lexer, true);
}

#endif // TREE_SITTER_COMPMD_PARAMS_H_
