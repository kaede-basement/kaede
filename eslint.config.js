import { includeIgnoreFile } from "@eslint/compat";
import { globalIgnores } from "eslint/config";
import { defineConfigWithVueTs, vueTsConfigs } from "@vue/eslint-config-typescript";
import stylistic from "@stylistic/eslint-plugin";
import vueRequireID from "@vue-require-id/eslint-plugin";
import eslintPluginUnicorn from "eslint-plugin-unicorn";
import pluginVue from "eslint-plugin-vue";
import unocss from "@unocss/eslint-config/flat";
import globals from "globals";
import { fileURLToPath } from "node:url";

// Get the absolute path of a '.gitignore' file
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
      "@stylistic"     : stylistic,
      "@vue-require-id": vueRequireID,
    },
    "rules": {

      /* Important */
      "@stylistic/semi"              : ["error", "always"],
      "@stylistic/no-confusing-arrow": ["error", {
        "allowParens"       : true,
        "onlyOneSimpleParam": false,
      }],
      "@stylistic/no-floating-decimal"         : ["error"],
      "@stylistic/max-statements-per-line"     : ["error", { "max": 1 }],
      "@stylistic/one-var-declaration-per-line": ["error", "always"],

      // Element IDs simplify styling for plugins
      "@vue-require-id/require-id": ["warn", {
        "elements": [

          /* Layout elements */
          "header",
          "footer",
          "aside",
          "main",
          "span",
          "div",
          "nav",

          /* Text */
          "label",
          "br",
          "hr",
          "ul",
          "ol",
          "li",
          "h1",
          "h2",
          "h3",
          "h4",
          "h5",
          "h6",
          "p",

          /* Interactive */
          "button",
          "input",
          "a",

          /* Graphics/Embeds */
          "canvas",
          "iframe",
          "img",
          "svg",
        ],
      }],

      /* Disabled rules */
      "vue/multi-word-component-names"    : ["off"], // why do I need to use multiple words for a 'Layout' component, for example?
      "vue/no-multiple-template-root"     : ["off"], // no need for this rule since Vue 3.x
      "unicorn/no-null"                   : ["off"], // the second argument of a 'JSON.stringify' doesn't accept 'undefined' to save formatting
      "unicorn/prefer-global-this"        : ["off"], // no need for this rule since this app is fully CSR, and Web Workers are not going to be used
      "unicorn/prefer-top-level-await"    : ["off"], // top level await is broken somehow
      "unicorn/prefer-query-selector"     : ["off"], // 'getElementById' is a lot easier to use
      "unicorn/prefer-at"                 : ["off"], // requires a different lib version
      "@stylistic/no-multi-spaces"        : ["off"], // conflicts with 'eslint@stylistic/key-spacing'
      "@stylistic/line-comment-position"  : ["off"],
      "@stylistic/linebreak-style"        : ["off"],
      "@stylistic/eol-last"               : ["off"],
      "@stylistic/object-property-newline": ["off"],

      /* TypeScript */
      "@typescript-eslint/explicit-function-return-type": ["warn"],
      "@typescript-eslint/no-unused-vars"               : ["warn"],

      /* Vue */
      "vue/no-unused-vars" : ["warn"],
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
      "@stylistic/array-bracket-newline"         : ["warn", "consistent"],
      "@stylistic/array-bracket-spacing"         : ["warn", "never"],
      "@stylistic/array-element-newline"         : ["warn", "consistent"],
      "@stylistic/arrow-parens"                  : ["warn", "as-needed"],
      "@stylistic/arrow-spacing"                 : ["warn", { "before": true, "after": true }],
      "@stylistic/block-spacing"                 : ["warn", "always"],
      "@stylistic/brace-style"                   : ["warn", "1tbs"],
      "@stylistic/comma-dangle"                  : ["warn", "always-multiline"],
      "@stylistic/comma-spacing"                 : ["warn", { "before": false, "after": true }],
      "@stylistic/comma-style"                   : ["warn", "last"],
      "@stylistic/computed-property-spacing"     : ["warn", "never"],
      "@stylistic/curly-newline"                 : ["warn", { "consistent": true }],
      "@stylistic/function-call-argument-newline": ["warn", "consistent"],
      "@stylistic/function-call-spacing"         : ["warn", "never"],
      "@stylistic/generator-star-spacing"        : ["warn", "before"],
      "@stylistic/implicit-arrow-linebreak"      : ["warn", "beside"],
      "@stylistic/indent"                        : ["warn", 2, { "SwitchCase": 1 }],
      "@stylistic/indent-binary-ops"             : ["warn", 2],
      "@stylistic/key-spacing"                   : ["warn", {
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
      "@stylistic/keyword-spacing"     : ["warn", { "before": true, "after": true }],
      "@stylistic/lines-around-comment": ["warn", {
        "beforeBlockComment": true,
        "allowBlockStart"   : true,
      }],
      "@stylistic/lines-between-class-members": ["warn", "always", {
        "exceptAfterOverload"  : true,
        "exceptAfterSingleLine": true,
      }],
      "@stylistic/member-delimiter-style" : ["warn", {
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
      "@stylistic/multiline-comment-style" : ["warn", "starred-block"],
      "@stylistic/multiline-ternary"       : ["warn", "never"],
      "@stylistic/new-parens"              : ["warn", "never"],
      "@stylistic/newline-per-chained-call": ["warn", { "ignoreChainWithDepth": 2 }],
      "@stylistic/no-extra-semi"           : ["warn"],
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
      "@stylistic/no-mixed-spaces-and-tabs"        : ["warn"],
      "@stylistic/no-multiple-empty-lines"         : ["warn", { "max": 3, "maxEOF": 1 }],
      "@stylistic/no-tabs"                         : ["warn"],
      "@stylistic/no-trailing-spaces"              : ["warn"],
      "@stylistic/no-whitespace-before-property"   : ["warn"],
      "@stylistic/nonblock-statement-body-position": ["warn", "beside"],
      "@stylistic/object-curly-newline"            : ["warn", { "consistent": true }],
      "@stylistic/object-curly-spacing"            : ["warn", "always"],
      "@stylistic/padded-blocks"                   : ["warn", "never"],
      "@stylistic/padding-line-between-statements" : [
        "warn",
        { "blankLine": "always", "prev": "*", "next": "return" },
        { "blankLine": "always", "prev": ["const", "let", "var"], "next": "*" },
        { "blankLine": "any", "prev": ["const", "let", "var"], "next": ["const", "let", "var"] },
        { "blankLine": "always", "prev": "directive", "next": "*" },
        { "blankLine": "any", "prev": "directive", "next": "directive" },
      ],
      "@stylistic/quote-props"                : ["warn", "always"],
      "@stylistic/quotes"                     : ["warn", "double"],
      "@stylistic/rest-spread-spacing"        : ["warn"],
      "@stylistic/semi-spacing"               : ["warn", { "before": false, "after": true }],
      "@stylistic/semi-style"                 : ["warn", "last"],
      "@stylistic/space-before-blocks"        : ["warn", "always"],
      "@stylistic/space-before-function-paren": ["warn", {
        "anonymous" : "always",
        "named"     : "never",
        "asyncArrow": "always",
        "catch"     : "always",
      }],
      "@stylistic/space-in-parens"         : ["warn", "never"],
      "@stylistic/space-unary-ops"         : ["warn", { "words": true, "nonwords": false }],
      "@stylistic/spaced-comment"          : ["warn", "always"],
      "@stylistic/switch-colon-spacing"    : ["warn", { "after": true, "before": false }],
      "@stylistic/template-curly-spacing"  : ["warn", "never"],
      "@stylistic/template-tag-spacing"    : ["warn", "never"],
      "@stylistic/type-generic-spacing"    : ["warn"],
      "@stylistic/type-named-tuple-spacing": ["warn"],
      "@stylistic/wrap-iife"               : ["warn", "inside"],
      "@stylistic/wrap-regex"              : ["warn"],
      "@stylistic/yield-star-spacing"      : ["warn", { "before": false, "after": true }],
    },
  },
);
