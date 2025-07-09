// @ts-check
import withNuxt from "./.nuxt/eslint.config.mjs";
import stylistic from "@stylistic/eslint-plugin";
import eslintPluginUnicorn from "eslint-plugin-unicorn";

export default withNuxt(
    eslintPluginUnicorn.configs.recommended,
    {
        plugins: {
            "@stylistic": stylistic,
        },
        rules: {
            semi:                             "error",
            curly:                            "error",
            indent:                           ["error", 4, { "SwitchCase": 1 }],
            "object-curly-spacing":           ["error", "always"],
            "arrow-parens":                   ["error", "always"],
            "@stylistic/quotes":              ["error", "double"],
            "comma-dangle":                   ["error", "always-multiline"],
            "key-spacing":                    ["error", { "align": "value" }],
            /* disabled rules */
            "unicorn/filename-case":          ["off"],
            "vue/multi-word-component-names": ["off"],
            "vue/no-multiple-template-root":  ["off"], // no need for this rule since vue 3.x
        },
    },
);
