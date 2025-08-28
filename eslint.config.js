import { includeIgnoreFile } from "@eslint/compat";
import { globalIgnores } from "eslint/config";
import ts from "typescript-eslint";
import stylistic from "@stylistic/eslint-plugin";
import eslintPluginUnicorn from "eslint-plugin-unicorn";
import pluginVue from "eslint-plugin-vue";
import globals from "globals";
import { fileURLToPath } from "node:url";

// Get a '.gitignore' absolute path
const gitIgnorePath = fileURLToPath(
  new URL(".gitignore", import.meta.url),
);

export default [
  // Ignore linting for every file or directory that '.gitignore' contains
  includeIgnoreFile(gitIgnorePath),
  // Also ignore './src-tauri', because it contains Rust code
  globalIgnores(["./src-tauri"]),
  ...ts.configs.recommended,
  ...pluginVue.configs["flat/recommended"],
  // Unicorn's eslint plugin configuration
  eslintPluginUnicorn.configs.recommended,

  // Own eslint configuration
  {
    "languageOptions": {
      "sourceType" : "module",
      "globals"    : {
        ...globals.browser,
      },
    },
    "plugins": {
      "@stylistic": stylistic,
    },
    "rules": {

      /* Disabled rules */
      "unicorn/no-null"                : ["off"],
      "unicorn/filename-case"          : ["off"],
      "vue/multi-word-component-names" : ["off"],
      "vue/no-multiple-template-root"  : ["off"], // no need for this rule since vue 3.x

      /* Unicorn */
      "unicorn/prevent-abbreviations": ["warn"],

      /* Stylistic */
      "@stylistic/array-bracket-newline"          : ["error", "consistent"],
      "@stylistic/array-bracket-spacing"          : ["error", "never"],
      "@stylistic/array-element-newline"          : ["error", "consistent"],
      "@stylistic/arrow-parens"                   : ["warn", "as-needed"],
      "@stylistic/arrow-spacing"                  : ["error", { "before": true, "after": true }],
      "@stylistic/block-spacing"                  : ["error", "always"],
      "@stylistic/brace-style"                    : ["error", "1tbs"],
      "@stylistic/comma-dangle"                   : ["warn", "always-multiline"],
      "@stylistic/comma-spacing"                  : ["error", { "before": false, "after": true }],
      "@stylistic/comma-style"                    : ["error", "last"],
      "@stylistic/computed-property-spacing"      : ["error", "never"],
      "@stylistic/curly-newline"                  : ["error", { "consistent": true }],
      "@stylistic/eol-last"                       : ["off"],
      "@stylistic/function-call-argument-newline" : ["error", "consistent"],
      "@stylistic/function-call-spacing"          : ["error", "never"],
      "@stylistic/generator-star-spacing"         : ["error", "before"],
      "@stylistic/implicit-arrow-linebreak"       : ["error", "beside"],
      "@stylistic/indent"                         : ["error", 2, { "SwitchCase": 1 }],
      "@stylistic/indent-binary-ops"              : ["error", 2],
      "@stylistic/key-spacing"                    : ["error", {
        "beforeColon" : false,
        "afterColon"  : true,
        "mode"        : "strict",
        "align"       : {
          "beforeColon" : true,
          "afterColon"  : true,
          "on"          : "colon",
          "mode"        : "strict",
        },
      }],
      "@stylistic/keyword-spacing"       : ["error", { "before": true, "after": true }],
      "@stylistic/line-comment-position" : ["off"],
      "@stylistic/linebreak-style"       : ["off"],
      "@stylistic/lines-around-comment"  : ["error", {
        "beforeBlockComment" : true,
        "allowBlockStart"    : true,
      }],
      "@stylistic/lines-between-class-members": ["error", "always", {
        "exceptAfterOverload"   : true,
        "exceptAfterSingleLine" : true,
      }],
      "@stylistic/max-len": ["warn", {
        "code"                   : 110,
        "ignoreComments"         : true,
        "ignoreTrailingComments" : true,
        "ignoreUrls"             : true,
      }],
      "@stylistic/max-statements-per-line" : ["error", { "max": 1 }],
      "@stylistic/member-delimiter-style"  : ["error", {
        "multiline": {
          "delimiter"   : "semi",
          "requireLast" : true,
        },
        "singleline": {
          "delimiter"   : "semi",
          "requireLast" : false,
        },
        "multilineDetection": "brackets",
      }],
      "@stylistic/multiline-comment-style"  : ["error", "starred-block"],
      "@stylistic/multiline-ternary"        : ["error", "never"],
      "@stylistic/new-parens"               : ["warn", "never"],
      "@stylistic/newline-per-chained-call" : ["warn", { "ignoreChainWithDepth": 2 }],
      "@stylistic/no-confusing-arrow"       : ["error", { "allowParens": true, "onlyOneSimpleParam": false }],
      "@stylistic/no-extra-parens"          : ["warn", "all", { "nestedBinaryExpressions": true }],
      "@stylistic/no-extra-semi"            : ["error"],
      "@stylistic/no-floating-decimal"      : ["error"],
      "@stylistic/no-mixed-operators"       : ["warn", {
        "groups": [
          ["+", "-", "*", "/", "%", "**"],
          ["&", "|", "^", "~", "<<", ">>", ">>>"],
          ["==", "!=", "===", "!==", ">", ">=", "<", "<="],
          ["&&", "||"],
          ["in", "instanceof"],
        ],
        "allowSamePrecedence": true,
      }],
      "@stylistic/no-mixed-spaces-and-tabs"         : ["error"],
      "@stylistic/no-multi-spaces"                  : ["off"], // conflict with eslint@stylistic/key-spacing
      "@stylistic/no-multiple-empty-lines"          : ["error", { "max": 3, "maxEOF": 1 }],
      "@stylistic/no-tabs"                          : ["error"],
      "@stylistic/no-trailing-spaces"               : ["error"],
      "@stylistic/no-whitespace-before-property"    : ["error"],
      "@stylistic/nonblock-statement-body-position" : ["error", "beside"],
      "@stylistic/object-curly-newline"             : ["error", { "consistent": true }],
      "@stylistic/object-curly-spacing"             : ["error", "always"],
      "@stylistic/object-property-newline"          : ["off"],
      "@stylistic/one-var-declaration-per-line"     : ["error", "always"],
      "@stylistic/operator-linebreak"               : ["error", "none"],
      "@stylistic/padded-blocks"                    : ["error", "never"],
      "@stylistic/padding-line-between-statements"  : [
        "error",
        { "blankLine": "always", "prev": "*", "next": "return" },
        { "blankLine": "always", "prev": ["const", "let", "var"], "next": "*" },
        { "blankLine": "any", "prev": ["const", "let", "var"], "next": ["const", "let", "var"] },
        { "blankLine": "always", "prev": "directive", "next": "*" },
        { "blankLine": "any", "prev": "directive", "next": "directive" },
      ],
      "@stylistic/quote-props"                 : ["warn", "always"],
      "@stylistic/quotes"                      : ["error", "double"],
      "@stylistic/rest-spread-spacing"         : ["error"],
      "@stylistic/semi"                        : ["error", "always"],
      "@stylistic/semi-spacing"                : ["error", { "before": false, "after": true }],
      "@stylistic/semi-style"                  : ["error", "last"],
      "@stylistic/space-before-blocks"         : ["error", "always"],
      "@stylistic/space-before-function-paren" : ["error", {
        "anonymous"  : "always",
        "named"      : "never",
        "asyncArrow" : "always",
        "catch"      : "always",
      }],
      "@stylistic/space-in-parens"          : ["error", "never"],
      "@stylistic/space-unary-ops"          : ["error", { "words": true, "nonwords": false }],
      "@stylistic/spaced-comment"           : ["error", "always"],
      "@stylistic/switch-colon-spacing"     : ["error", { "after": true, "before": false }],
      "@stylistic/template-curly-spacing"   : ["error", "never"],
      "@stylistic/template-tag-spacing"     : ["error", "never"],
      "@stylistic/type-annotation-spacing"  : ["off"], // conflict with eslint@stylistic/key-spacing
      "@stylistic/type-generic-spacing"     : ["error"],
      "@stylistic/type-named-tuple-spacing" : ["error"],
      "@stylistic/wrap-iife"                : ["error", "inside"],
      "@stylistic/wrap-regex"               : ["error"],
      "@stylistic/yield-star-spacing"       : ["error", { "before": false, "after": true }],
    },
  },
];
