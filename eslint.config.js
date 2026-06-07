import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import requireOptsParam from "./eslint-rules/require-opts-param.js";

export default tseslint.config(
  { ignores: ["build/", ".react-router/", "node_modules/"] },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    plugins: { "react-hooks": reactHooks },
    rules: { ...reactHooks.configs.recommended.rules },
  },

  {
    plugins: { local: { rules: { "require-opts-param": requireOptsParam } } },
    rules: {
      // CLAUDE.md: use object param when multiple params share the same type
      "local/require-opts-param": "error",
    },
  },

  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // CLAUDE.md: don't use `any`
      "@typescript-eslint/no-explicit-any": "error",

      // Catches unused variables (but allows _-prefixed intentional ones)
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],

      // Prefer `import type` for type-only imports (keeps runtime clean)
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
    },
  },
);
