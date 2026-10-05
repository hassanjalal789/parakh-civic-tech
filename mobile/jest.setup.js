/* global jest */
// In-memory stand-ins for native modules that have no Jest implementation.
jest.mock("expo-secure-store", () => {
  const store = new Map();
  return {
    __store: store,
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: "WHEN_UNLOCKED_THIS_DEVICE_ONLY",
    setItemAsync: jest.fn(async (key, value) => void store.set(key, value)),
    getItemAsync: jest.fn(async (key) => (store.has(key) ? store.get(key) : null)),
    deleteItemAsync: jest.fn(async (key) => void store.delete(key)),
  };
});

// expo-crypto over Node's crypto: the same AES-256-GCM layout as the native
// module (12-byte nonce ‖ ciphertext ‖ 16-byte tag), SHA-256 and random bytes.
jest.mock("expo-crypto", () => {
  const nodeCrypto = require("crypto");
  const { Buffer } = require("buffer");
  let n = 0;
  const HASHES = { "SHA-1": "sha1", "SHA-256": "sha256", "SHA-384": "sha384", "SHA-512": "sha512" };

  class AESEncryptionKey {
    constructor(bytes) {
      this.material = Buffer.from(bytes);
      this.released = false;
    }
    static async import(input) {
      if (!(input instanceof Uint8Array) || input.length !== 32) throw new Error("mock: a 32-byte key");
      return new AESEncryptionKey(input);
    }
    release() {
      this.material.fill(0);
      this.released = true;
    }
  }

  class AESSealedData {
    constructor(combined) {
      this.bytes = Buffer.from(combined);
    }
    static fromCombined(combined) {
      return new AESSealedData(combined);
    }
    async combined() {
      return new Uint8Array(this.bytes);
    }
  }

  return {
    randomUUID: jest.fn(() => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`),
    getRandomBytes: jest.fn((count) => {
      // The native module accepts 0...1024 bytes per call (observed on the Android emulator).
      if (!Number.isInteger(count) || count < 0 || count > 1024) {
        throw new TypeError(
          `expo-crypto: getRandomBytes(${count}) expected a valid number from range 0...1024`,
        );
      }
      return new Uint8Array(nodeCrypto.randomBytes(count));
    }),
    CryptoDigestAlgorithm: { SHA1: "SHA-1", SHA256: "SHA-256", SHA384: "SHA-384", SHA512: "SHA-512" },
    digest: jest.fn(async (algorithm, data) => {
      const view =
        data instanceof ArrayBuffer
          ? new Uint8Array(data)
          : new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
      return new Uint8Array(nodeCrypto.createHash(HASHES[algorithm]).update(view).digest()).buffer;
    }),
    AESEncryptionKey,
    AESSealedData,
    aesEncryptAsync: jest.fn(async (plaintext, key, options = {}) => {
      if (key.released) throw new Error("mock: the key was released");
      const iv = nodeCrypto.randomBytes(12);
      const cipher = nodeCrypto.createCipheriv("aes-256-gcm", key.material, iv);
      if (options.additionalData) cipher.setAAD(Buffer.from(options.additionalData));
      const body = Buffer.concat([cipher.update(Buffer.from(plaintext)), cipher.final()]);
      return new AESSealedData(Buffer.concat([iv, body, cipher.getAuthTag()]));
    }),
    aesDecryptAsync: jest.fn(async (sealed, key, options = {}) => {
      if (key.released) throw new Error("mock: the key was released");
      const all = sealed.bytes;
      const decipher = nodeCrypto.createDecipheriv("aes-256-gcm", key.material, all.subarray(0, 12));
      if (options.additionalData) decipher.setAAD(Buffer.from(options.additionalData));
      decipher.setAuthTag(all.subarray(all.length - 16));
      return new Uint8Array(
        Buffer.concat([decipher.update(all.subarray(12, all.length - 16)), decipher.final()]),
      );
    }),
  };
});

jest.mock("expo-localization", () => ({ getLocales: () => [{ languageCode: "ur" }] }));
