import tseslint from "typescript-eslint";

export default [
  { ignores: ["**/node_modules/**", "**/dist/**", "**/.next/**", ".artifacts/**", "test-results/**", "playwright-report/**"] },
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
      }],
    },
  },
  {
    files: ["**/*.test.{ts,tsx}"],
    rules: { "@typescript-eslint/no-explicit-any": "off" },
  },
];
