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
            semi:                    "error",
            indent:                  ["error", 4, { "SwitchCase": 1 }],
            curly:                   "error",
            "object-curly-spacing":  ["error", "always"],
            "comma-dangle":          ["error", "always-multiline"],
            "arrow-parens":          ["error", "always"],
            "key-spacing":           ["error", { "align": "value" }],
            "unicorn/filename-case": ["off"],
            "@stylistic/quotes":     ["error", "double"],
        },
    },
);
