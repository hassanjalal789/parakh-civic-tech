/**
 * LDS-4: a draft's media are the capture files themselves (DG-63).
 *
 * The camera writes each photo and video to the app's cache; the recorder
 * writes the voice recording to a file. Each file is moved — renamed, not
 * copied — into the app-private drafts folder, so the operating system does
 * not clear it during the draft's 2-day lifetime. Nothing is copied,
 * re-encoded or encrypted by the application. A file is never rewritten.
 */
import * as Crypto from "expo-crypto";
import { Directory, File, Paths } from "expo-file-system";

import { bufferSource, toHex } from "./bytes";

const EXTENSION: Record<string, string> = {
  "image/jpeg": "jpg",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "audio/mp4": "m4a",
  "audio/m4a": "m4a",
};

export function draftMediaDirectory(): Directory {
  return new Directory(Paths.document, "parakh-drafts-media");
}

/** `<evidence id>.<ext>` — the only names this folder holds. */
export function mediaFileName(evidenceId: string, mimeType: string): string {
  if (!/^[0-9a-f-]{36}$/.test(evidenceId)) throw new Error("evidence ids are UUIDs");
  const extension = EXTENSION[mimeType];
  if (!extension) throw new Error("not a capture type");
  return `${evidenceId}.${extension}`;
}

export function draftMediaFile(fileName: string): File {
  if (!/^[0-9a-f-]{36}\.(jpg|mp4|mov|m4a)$/.test(fileName)) throw new Error("not a draft media name");
  return new File(draftMediaDirectory(), fileName);
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  return toHex(new Uint8Array(await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, bufferSource(bytes))));
}

/** Moves the capture file into the drafts folder under its evidence name. The same file; no copy. */
export async function adoptCaptureFile(source: File, fileName: string): Promise<File> {
  const dir = draftMediaDirectory();
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  const target = draftMediaFile(fileName);
  if (target.exists) throw new Error("a draft file is never replaced");
  await source.move(target); // a rename within app storage (Android renameTo, iOS moveItem)
  return target;
}

/** The stored bytes, only if they still match the hash taken at capture. */
export async function readDraftMedia(fileName: string, expectedSha256: string): Promise<Uint8Array> {
  const bytes = await draftMediaFile(fileName).bytes();
  if ((await sha256Hex(bytes)) !== expectedSha256)
    throw new Error("a draft file no longer matches its capture hash");
  return bytes;
}

export function deleteDraftMedia(fileName: string): void {
  const file = draftMediaFile(fileName);
  if (file.exists) file.delete();
}
