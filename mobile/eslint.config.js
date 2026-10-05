// ESLint flat config. console.* is an error: tokens, numbers, codes and
// renderings must never reach a log sink (SRS §5, NFR-59).
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");
const prettier = require("eslint-config-prettier");

const NO_GALLERY =
  "Evidence comes from the live camera and recorder only (BR-002); no gallery or file picker.";
const GALLERY_MODULES = [
  "expo-image-picker",
  "expo-document-picker",
  "expo-media-library",
  "react-native-image-picker",
  "@react-native-camera-roll/camera-roll",
];

module.exports = defineConfig([
  expoConfig,
  prettier,
  {
    ignores: ["node_modules/", ".expo/", "dist/", "coverage/", "android/", "ios/"],
  },
  {
    rules: {
      "no-console": "error",
      "no-restricted-globals": [
        "error",
        { name: "fetch", message: "Use src/api/client.ts — no fetch outside src/api (T-033)." },
      ],
      // Evidence comes from the live camera and recorder only; there is no gallery or file path (BR-002, FR-PUB.4).
      "no-restricted-imports": [
        "error",
        {
          paths: GALLERY_MODULES.map((name) => ({ name, message: NO_GALLERY })),
          patterns: [{ group: ["expo-file-system/legacy"], message: "Use the expo-file-system File API." }],
        },
      ],
      "no-restricted-syntax": [
        "error",
        { selector: "MemberExpression[property.name=/^pick(File|Directory)Async$/]", message: NO_GALLERY },
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
