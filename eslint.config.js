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
        ...globals.node, // process, console, Buffer ইত্যাদি চিনিয়ে দেবে
      },
    },
    plugins: {
      import: importPlugin,
    },
    settings: {
      // এটি ESLint-কে আপনার node_modules ফোল্ডার স্ক্যান করতে সাহায্য করবে
      "import/resolver": {
        node: true,
      },
    },
    rules: {
      "import/no-unresolved": ["error", { caseSensitive: true }],
      "no-unused-vars": "warn", // অব্যবহৃত ভ্যারিয়েবলকে এরর না দেখিয়ে ওয়ার্নিং দেখাবে
    },
  },
];