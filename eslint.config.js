import { includeIgnoreFile } from "@eslint/compat";
import { globalIgnores } from "eslint/config";
import { defineConfigWithVueTs, vueTsConfigs } from "@vue/eslint-config-typescript";
import stylistic from "@stylistic/eslint-plugin";
import eslintPluginUnicorn from "eslint-plugin-unicorn";
import pluginVue from "eslint-plugin-vue";
import unocss from "@unocss/eslint-config/flat";
import globals from "globals";
import { fileURLToPath } from "node:url";

// Get a '.gitignore' absolute path
const gitIgnorePath = fileURLToPath(
  new URL(".gitignore", import.meta.url),
);

export default defineConfigWithVueTs(
  // Ignore linting for every file or directory that '.gitignore' contains
  includeIgnoreFile(gitIgnorePath),
  // Also ignore './src-tauri', because it contains Rust code
  globalIgnores(["./src-tauri"]),
  vueTsConfigs.recommended,
  pluginVue.configs["flat/essential"],
  // Unicorn's eslint plugin configuration
  eslintPluginUnicorn.configs.recommended,
  // UnoCSS's eslint plugin configuration
  unocss,

  // Own eslint configuration
  {
    "languageOptions": {
      "sourceType": "module",
      "globals"   : {
        ...globals.browser,
      },
    },
    "plugins": {
      "@stylistic": stylistic,
    },
    "rules": {

      /* Disabled rules */
      "vue/multi-word-component-names"    : ["off"], // why do I need to use multiple words for a 'Layout' component, for example?
      "vue/no-multiple-template-root"     : ["off"], // no need for this rule since Vue 3.x
      "unicorn/no-null"                   : ["off"], // 'JSON.stringify' second argument doesn't accept 'undefined' to save formatting
      "unicorn/prefer-global-this"        : ["off"], // no need for this rule because app is CSR and Web Workers will not be used
      "unicorn/prefer-top-level-await"    : ["off"], // broken
      "@stylistic/no-multi-spaces"        : ["off"], // conflict with eslint@stylistic/key-spacing
      "@stylistic/line-comment-position"  : ["off"],
      "@stylistic/linebreak-style"        : ["off"],
      "@stylistic/eol-last"               : ["off"],
      "@stylistic/object-property-newline": ["off"],

      /* Vue */
      "vue/no-extra-parens": ["warn", "all", { "nestedBinaryExpressions": true }],
      "vue/max-len"        : ["warn", {
        "code"                     : 110,
        "ignoreComments"           : true,
        "ignoreTrailingComments"   : true,
        "ignoreHTMLAttributeValues": true,
        "ignoreHTMLTextContents"   : true,
        "ignoreUrls"               : true,
      }],

      /* Unicorn */
      "unicorn/filename-case"        : ["warn", { "cases": { "kebabCase": true, "pascalCase": true } }],
      "unicorn/prevent-abbreviations": ["warn"],

      /* Stylistic */
      "@stylistic/array-bracket-newline"         : ["error", "consistent"],
      "@stylistic/array-bracket-spacing"         : ["error", "never"],
      "@stylistic/array-element-newline"         : ["error", "consistent"],
      "@stylistic/arrow-parens"                  : ["warn", "as-needed"],
      "@stylistic/arrow-spacing"                 : ["error", { "before": true, "after": true }],
      "@stylistic/block-spacing"                 : ["error", "always"],
      "@stylistic/brace-style"                   : ["error", "1tbs"],
      "@stylistic/comma-dangle"                  : ["warn", "always-multiline"],
      "@stylistic/comma-spacing"                 : ["error", { "before": false, "after": true }],
      "@stylistic/comma-style"                   : ["error", "last"],
      "@stylistic/computed-property-spacing"     : ["error", "never"],
      "@stylistic/curly-newline"                 : ["error", { "consistent": true }],
      "@stylistic/function-call-argument-newline": ["error", "consistent"],
      "@stylistic/function-call-spacing"         : ["error", "never"],
      "@stylistic/generator-star-spacing"        : ["error", "before"],
      "@stylistic/implicit-arrow-linebreak"      : ["error", "beside"],
      "@stylistic/indent"                        : ["error", 2, { "SwitchCase": 1 }],
      "@stylistic/indent-binary-ops"             : ["error", 2],
      "@stylistic/key-spacing"                   : ["error", {
        "beforeColon": false,
        "afterColon" : true,
        "mode"       : "strict",
        "align"      : {
          "beforeColon": false,
          "afterColon" : true,
          "on"         : "colon",
          "mode"       : "strict",
        },
      }],
      "@stylistic/keyword-spacing"     : ["error", { "before": true, "after": true }],
      "@stylistic/lines-around-comment": ["error", {
        "beforeBlockComment": true,
        "allowBlockStart"   : true,
      }],
      "@stylistic/lines-between-class-members": ["error", "always", {
        "exceptAfterOverload"  : true,
        "exceptAfterSingleLine": true,
      }],
      "@stylistic/max-statements-per-line": ["error", { "max": 1 }],
      "@stylistic/member-delimiter-style" : ["error", {
        "multiline": {
          "delimiter"  : "semi",
          "requireLast": true,
        },
        "singleline": {
          "delimiter"  : "semi",
          "requireLast": false,
        },
        "multilineDetection": "brackets",
      }],
      "@stylistic/multiline-comment-style" : ["error", "starred-block"],
      "@stylistic/multiline-ternary"       : ["error", "never"],
      "@stylistic/new-parens"              : ["warn", "never"],
      "@stylistic/newline-per-chained-call": ["warn", { "ignoreChainWithDepth": 2 }],
      "@stylistic/no-confusing-arrow"      : ["error", { "allowParens": true, "onlyOneSimpleParam": false }],
      "@stylistic/no-extra-semi"           : ["error"],
      "@stylistic/no-floating-decimal"     : ["error"],
      "@stylistic/no-mixed-operators"      : ["warn", {
        "groups": [
          ["+", "-", "*", "/", "%", "**"],
          ["&", "|", "^", "~", "<<", ">>", ">>>"],
          ["==", "!=", "===", "!==", ">", ">=", "<", "<="],
          ["&&", "||"],
          ["in", "instanceof"],
        ],
        "allowSamePrecedence": true,
      }],
      "@stylistic/no-mixed-spaces-and-tabs"        : ["error"],
      "@stylistic/no-multiple-empty-lines"         : ["error", { "max": 3, "maxEOF": 1 }],
      "@stylistic/no-tabs"                         : ["error"],
      "@stylistic/no-trailing-spaces"              : ["error"],
      "@stylistic/no-whitespace-before-property"   : ["error"],
      "@stylistic/nonblock-statement-body-position": ["error", "beside"],
      "@stylistic/object-curly-newline"            : ["error", { "consistent": true }],
      "@stylistic/object-curly-spacing"            : ["error", "always"],
      "@stylistic/one-var-declaration-per-line"    : ["error", "always"],
      "@stylistic/padded-blocks"                   : ["error", "never"],
      "@stylistic/padding-line-between-statements" : [
        "error",
        { "blankLine": "always", "prev": "*", "next": "return" },
        { "blankLine": "always", "prev": ["const", "let", "var"], "next": "*" },
        { "blankLine": "any", "prev": ["const", "let", "var"], "next": ["const", "let", "var"] },
        { "blankLine": "always", "prev": "directive", "next": "*" },
        { "blankLine": "any", "prev": "directive", "next": "directive" },
      ],
      "@stylistic/quote-props"                : ["warn", "always"],
      "@stylistic/quotes"                     : ["error", "double"],
      "@stylistic/rest-spread-spacing"        : ["error"],
      "@stylistic/semi"                       : ["error", "always"],
      "@stylistic/semi-spacing"               : ["error", { "before": false, "after": true }],
      "@stylistic/semi-style"                 : ["error", "last"],
      "@stylistic/space-before-blocks"        : ["error", "always"],
      "@stylistic/space-before-function-paren": ["error", {
        "anonymous" : "always",
        "named"     : "never",
        "asyncArrow": "always",
        "catch"     : "always",
      }],
      "@stylistic/space-in-parens"         : ["error", "never"],
      "@stylistic/space-unary-ops"         : ["error", { "words": true, "nonwords": false }],
      "@stylistic/spaced-comment"          : ["error", "always"],
      "@stylistic/switch-colon-spacing"    : ["error", { "after": true, "before": false }],
      "@stylistic/template-curly-spacing"  : ["error", "never"],
      "@stylistic/template-tag-spacing"    : ["error", "never"],
      "@stylistic/type-generic-spacing"    : ["error"],
      "@stylistic/type-named-tuple-spacing": ["error"],
      "@stylistic/wrap-iife"               : ["error", "inside"],
      "@stylistic/wrap-regex"              : ["error"],
      "@stylistic/yield-star-spacing"      : ["error", { "before": false, "after": true }],
    },
  },
);
