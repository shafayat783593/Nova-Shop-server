import js from "@eslint/js";
import importPlugin from "eslint-plugin-import";
import globals from "globals";

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.node,
      },
    },
    plugins: {
      import: importPlugin,
    },
    settings: {
      // এটি ESLint-কে আপনার Node.js এর মডিউল এবং package.json রিড করতে সাহায্য করবে
      "import/resolver": {
        node: true,
      },
    },
    rules: {
      "import/no-unresolved": ["error", { caseSensitive: true }],
      "no-unused-vars": "warn",
    },
  },
];