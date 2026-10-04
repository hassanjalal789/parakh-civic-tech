/* global jest */
// In-memory stand-ins for native modules that have no Jest implementation.
jest.mock("expo-secure-store", () => {
  const store = new Map();
  return {
    __store: store,
    setItemAsync: jest.fn(async (key, value) => void store.set(key, value)),
    getItemAsync: jest.fn(async (key) => (store.has(key) ? store.get(key) : null)),
    deleteItemAsync: jest.fn(async (key) => void store.delete(key)),
  };
});

jest.mock("expo-crypto", () => {
  let n = 0;
  return { randomUUID: jest.fn(() => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`) };
});

jest.mock("expo-localization", () => ({ getLocales: () => [{ languageCode: "ur" }] }));
