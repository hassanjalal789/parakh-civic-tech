/**
 * Reads what the 60-second video rule needs from an ISO base-media file (MP4,
 * QuickTime) — the same reading as the backend's parakh/drafts/media.py, so the
 * phone and the server measure a video the same way (DG-54, FR-PUB.4).
 *
 * It parses box headers only, never decodes media, and gives up on anything
 * malformed: a broken or crafted file is refused, not trusted.
 */
const MAX_BOXES = 10_000; // far more than any real recording holds

export type MediaSummary = { brand: string; durationSeconds: number; trackTypes: Set<string> };

export class MalformedMedia extends Error {
  constructor(reason: string) {
    super(`Unreadable media container: ${reason}`);
    this.name = "MalformedMedia";
  }
}

type Box = { kind: string; start: number; end: number };

function fourCc(data: Uint8Array, at: number): string {
  return String.fromCharCode(data[at] ?? 0, data[at + 1] ?? 0, data[at + 2] ?? 0, data[at + 3] ?? 0);
}

function* boxes(data: Uint8Array, view: DataView, start: number, end: number): Generator<Box> {
  let offset = start;
  let count = 0;
  while (offset + 8 <= end) {
    if (++count > MAX_BOXES) throw new MalformedMedia("too many boxes");
    let size = view.getUint32(offset);
    const kind = fourCc(data, offset + 4);
    let header = 8;
    if (size === 1) {
      if (offset + 16 > end) throw new MalformedMedia("truncated large box");
      size = Number(view.getBigUint64(offset + 8));
      header = 16;
    } else if (size === 0) {
      size = end - offset; // the box extends to the end of its container
    }
    if (size < header || offset + size > end) throw new MalformedMedia("box size out of bounds");
    yield { kind, start: offset + header, end: offset + size };
    offset += size;
  }
}

function child(data: Uint8Array, view: DataView, start: number, end: number, kind: string): Box | null {
  for (const box of boxes(data, view, start, end)) if (box.kind === kind) return box;
  return null;
}

/** Parses ftyp, moov/mvhd and every track's handler type. Throws MalformedMedia, never anything else. */
export function summariseMedia(data: Uint8Array): MediaSummary {
  try {
    return summarise(data);
  } catch (error) {
    if (error instanceof MalformedMedia) throw error;
    throw new MalformedMedia("unreadable header"); // a read past a box: refuse, do not crash
  }
}

function summarise(data: Uint8Array): MediaSummary {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let brand = "";
  let moov: Box | null = null;
  for (const box of boxes(data, view, 0, data.length)) {
    if (box.kind === "ftyp" && box.end - box.start >= 4) brand = fourCc(data, box.start);
    else if (box.kind === "moov") moov = box;
  }
  if (!brand || !moov) throw new MalformedMedia("not an ISO base-media file");
  let durationSeconds: number | null = null;
  const trackTypes = new Set<string>();
  for (const box of boxes(data, view, moov.start, moov.end)) {
    if (box.kind === "mvhd") {
      const length = box.end - box.start;
      if (length < 1) throw new MalformedMedia("empty mvhd");
      const version = data[box.start];
      let timescale: number;
      let duration: number;
      if (version === 1 && length >= 32) {
        timescale = view.getUint32(box.start + 20);
        duration = Number(view.getBigUint64(box.start + 24));
      } else if (version === 0 && length >= 20) {
        timescale = view.getUint32(box.start + 12);
        duration = view.getUint32(box.start + 16);
      } else {
        throw new MalformedMedia("bad mvhd");
      }
      if (timescale === 0) throw new MalformedMedia("zero timescale");
      durationSeconds = duration / timescale;
    } else if (box.kind === "trak") {
      const mdia = child(data, view, box.start, box.end, "mdia");
      const hdlr = mdia ? child(data, view, mdia.start, mdia.end, "hdlr") : null;
      if (hdlr && hdlr.end - hdlr.start >= 12) trackTypes.add(fourCc(data, hdlr.start + 8));
    }
  }
  if (durationSeconds === null) throw new MalformedMedia("no movie header");
  return { brand, durationSeconds, trackTypes };
}
