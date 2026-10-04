// ESLint flat config. console.* is an error: tokens, numbers, codes and
// renderings must never reach a log sink (SRS §5, NFR-59).
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");
const prettier = require("eslint-config-prettier");

module.exports = defineConfig([
  expoConfig,
  prettier,
  {
    ignores: ["node_modules/", ".expo/", "dist/", "coverage/"],
  },
  {
    rules: {
      "no-console": "error",
      "no-restricted-globals": [
        "error",
        { name: "fetch", message: "Use src/api/client.ts — no fetch outside src/api (T-033)." },
      ],
    },
  },
  {
    files: ["src/api/**"],
    rules: { "no-restricted-globals": "off" },
  },
  {
    files: ["**/__tests__/**", "jest.setup.js"],
    rules: { "no-restricted-globals": "off" },
  },
]);
