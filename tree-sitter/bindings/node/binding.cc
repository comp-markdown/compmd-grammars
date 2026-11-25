#include <napi.h>

typedef struct TSLanguage TSLanguage;

extern "C" TSLanguage *tree_sitter_compmd();
extern "C" TSLanguage *tree_sitter_compmd_inline();
extern "C" TSLanguage *tree_sitter_cel();

// "tree-sitter", "language" hashed with BLAKE2
const napi_type_tag LANGUAGE_TYPE_TAG = {
    0x8AF2E5212AD58ABF, 0xD5006CAD83ABBA16
};

// A grammar's language object, as node-tree-sitter takes it.
static Napi::Object Grammar(Napi::Env env, const char *name, TSLanguage *language) {
    auto grammar = Napi::Object::New(env);
    grammar["name"] = Napi::String::New(env, name);
    auto external = Napi::External<TSLanguage>::New(env, language);
    external.TypeTag(&LANGUAGE_TYPE_TAG);
    grammar["language"] = external;
    return grammar;
}

// The block grammar, with the inline grammar and CEL beside it.
Napi::Object Init(Napi::Env env, Napi::Object exports) {
    exports["name"] = Napi::String::New(env, "compmd");
    auto language = Napi::External<TSLanguage>::New(env, tree_sitter_compmd());
    language.TypeTag(&LANGUAGE_TYPE_TAG);
    exports["language"] = language;
    exports["inline"] = Grammar(env, "compmd_inline", tree_sitter_compmd_inline());
    exports["cel"] = Grammar(env, "cel", tree_sitter_cel());
    return exports;
}

NODE_API_MODULE(tree_sitter_compmd_binding, Init)
