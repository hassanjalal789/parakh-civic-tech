/**
 * The pure rules of the evidence upload (T-055; API-131, API-132;
 * docs/api/CITIZEN_REPORTING_CONTRACT.md §3).
 *
 * An item is cut into `count` chunks of equal size, the last one shorter. The
 * same count always gives the same chunks, so an upload that resumes sends
 * exactly the bytes the server is missing.
 */

export const UPLOAD = {
  /**
   * Bytes per chunk: half the server's 512 KiB limit, so an interrupted upload
   * loses little. A routine technical choice, not a product rule.
   */
  chunkBytes: 256 * 1024,
  /** The server's limit on one chunk (PARAKH_EVIDENCE.CHUNK_MAX_BYTES). */
  serverChunkMaxBytes: 512 * 1024,
  /** Sends of one chunk the server reports as damaged in transit, before the item is set aside for now. */
  chunkTries: 3,
} as const;

/** How many chunks a new item is cut into. */
export function chunkCount(byteSize: number, chunkBytes: number = UPLOAD.chunkBytes): number {
  if (!Number.isInteger(byteSize) || byteSize < 1) throw new Error("an item has at least one byte");
  return Math.ceil(byteSize / chunkBytes);
}

/** The byte range [start, end) of chunk `index` when the item is cut into `count` chunks. */
export function chunkRange(byteSize: number, count: number, index: number): [number, number] {
  if (!Number.isInteger(count) || count < 1 || count > byteSize) throw new Error("bad chunk count");
  if (!Number.isInteger(index) || index < 0 || index >= count) throw new Error("bad chunk index");
  const size = Math.ceil(byteSize / count);
  const start = index * size;
  const end = Math.min(start + size, byteSize);
  if (end <= start) throw new Error("an empty chunk"); // never for a count this app chooses
  return [start, end];
}

export type ManifestEntry = { evidence_id: string; kind: string; sha256: string; byte_size: number };

/**
 * The text whose SHA-256 is `manifest_sha256`: one line `evidence_id:kind:sha256:byte_size\n`
 * per item, sorted by evidence_id — the server's manifest_hash, byte for byte.
 */
export function manifestText(entries: readonly ManifestEntry[]): string {
  return [...entries]
    .sort((a, b) => (a.evidence_id < b.evidence_id ? -1 : a.evidence_id > b.evidence_id ? 1 : 0))
    .map((e) => `${e.evidence_id}:${e.kind}:${e.sha256}:${e.byte_size}\n`)
    .join("");
}

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/** Standard base64 with padding, as the server's strict decoder expects. */
export function toBase64(bytes: Uint8Array): string {
  const c = (n: number) => ALPHABET.charAt(n & 63);
  let out = "";
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const n = ((bytes[i] ?? 0) << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    out += c(n >> 18) + c(n >> 12) + c(n >> 6) + c(n);
  }
  const rest = bytes.length - i;
  if (rest === 1) {
    const n = (bytes[i] ?? 0) << 16;
    out += c(n >> 18) + c(n >> 12) + "==";
  } else if (rest === 2) {
    const n = ((bytes[i] ?? 0) << 16) | ((bytes[i + 1] ?? 0) << 8);
    out += c(n >> 18) + c(n >> 12) + c(n >> 6) + "=";
  }
  return out;
}
