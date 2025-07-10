// @ts-check
import withNuxt from "./.nuxt/eslint.config.mjs";
import stylistic from "@stylistic/eslint-plugin";
import eslintPluginUnicorn from "eslint-plugin-unicorn";

export default withNuxt(
  // unicorn's eslint plugin configuration
  eslintPluginUnicorn.configs.recommended,
  // user defined eslint configuration
  {
    plugins: {
      "@stylistic": stylistic,
    },
    rules: {
      semi:                             "error",
      curly:                            "error",
      indent:                           ["error", 2, { "SwitchCase": 1 }],
      "object-curly-spacing":           ["error", "always"],
      "arrow-parens":                   ["error", "always"],
      "@stylistic/quotes":              ["error", "double"],
      "comma-dangle":                   ["error", "always-multiline"],
      "key-spacing":                    ["error", { "align": "value" }],
      /* disabled rules */
      "unicorn/no-null":                ["off"],
      "unicorn/filename-case":          ["off"],
      "vue/multi-word-component-names": ["off"],
      "vue/no-multiple-template-root":  ["off"], // no need for this rule since vue 3.x
    },
  },
);
