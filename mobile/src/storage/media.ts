/**
 * LDS-4: captured media encrypted at rest (DR-23 rules 6 and 7).
 *
 * The media key is derived from the database key with a fixed label, so the
 * database key itself never encrypts two kinds of data. Each file is
 * AES-256-GCM with a fresh 96-bit nonce; the evidence id is the additional
 * data, so a file moved under another record fails to decrypt. A file is
 * written once and never rewritten (BR-003): the ciphertext is the record.
 */
import * as Crypto from "expo-crypto";
import { Directory, File, Paths } from "expo-file-system";

import { bufferSource, concat, toHex, utf8 } from "./bytes";

const MAGIC = utf8("PKM1"); // Parakh media, format 1
const MEDIA_KEY_LABEL = "parakh-media-v1:";

export class MediaIntegrityError extends Error {
  constructor(readonly evidenceId: string) {
    super("A stored item failed its integrity check");
    this.name = "MediaIntegrityError";
  }
}

export async function deriveMediaKey(databaseKey: Uint8Array): Promise<Crypto.AESEncryptionKey> {
  const material = new Uint8Array(
    await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, concat(utf8(MEDIA_KEY_LABEL), databaseKey)),
  );
  try {
    return await Crypto.AESEncryptionKey.import(material);
  } finally {
    material.fill(0);
  }
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  return toHex(new Uint8Array(await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, bufferSource(bytes))));
}

export function mediaDirectory(): Directory {
  return new Directory(Paths.document, "parakh-media");
}

export function mediaFile(evidenceId: string): File {
  if (!/^[0-9a-f-]{36}$/.test(evidenceId)) throw new Error("evidence ids are UUIDs");
  return new File(mediaDirectory(), `${evidenceId}.pkm`);
}

function aad(evidenceId: string): Uint8Array {
  return utf8(`${MEDIA_KEY_LABEL}${evidenceId}`);
}

/** Encrypts and writes one item. Refuses to replace an existing file. */
export async function writeEncrypted(
  key: Crypto.AESEncryptionKey,
  evidenceId: string,
  plaintext: Uint8Array,
): Promise<File> {
  const dir = mediaDirectory();
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  const file = mediaFile(evidenceId);
  if (file.exists) throw new Error("write-once: this item is already stored");
  const sealed = await Crypto.aesEncryptAsync(plaintext, key, { additionalData: aad(evidenceId) });
  const combined = await sealed.combined(); // nonce ‖ ciphertext ‖ tag
  file.create(); // fails if the file appeared meanwhile
  file.write(concat(MAGIC, combined));
  return file;
}

/** Decrypts one item and checks it against the SHA-256 recorded at capture. */
export async function readDecrypted(
  key: Crypto.AESEncryptionKey,
  evidenceId: string,
  expectedSha256: string,
): Promise<Uint8Array> {
  const raw = await mediaFile(evidenceId).bytes();
  if (raw.length < MAGIC.length + 12 + 16 || !MAGIC.every((b, i) => raw[i] === b)) {
    throw new MediaIntegrityError(evidenceId);
  }
  let plaintext: Uint8Array;
  try {
    const sealed = Crypto.AESSealedData.fromCombined(raw.subarray(MAGIC.length));
    plaintext = await Crypto.aesDecryptAsync(sealed, key, { additionalData: aad(evidenceId) });
  } catch {
    throw new MediaIntegrityError(evidenceId);
  }
  if ((await sha256Hex(plaintext)) !== expectedSha256) throw new MediaIntegrityError(evidenceId);
  return plaintext;
}

export function deleteStored(evidenceId: string): void {
  const file = mediaFile(evidenceId);
  if (file.exists) file.delete();
}
