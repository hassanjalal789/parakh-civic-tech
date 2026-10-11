/**
 * Synthetic ISO base-media files for tests: just the boxes the duration reader
 * looks at (ftyp, moov/mvhd, trak/mdia/hdlr) and an mdat of random bytes. No
 * real video is involved.
 */
import { randomBytes } from "crypto";

const ascii = (s: string) => new Uint8Array(Buffer.from(s, "latin1"));
const zeros = (n: number) => new Uint8Array(n);

function u32(n: number): Uint8Array {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(n);
  return new Uint8Array(b);
}

function u64(n: number): Uint8Array {
  const b = Buffer.alloc(8);
  b.writeBigUInt64BE(BigInt(n));
  return new Uint8Array(b);
}

function concat(...parts: Uint8Array[]): Uint8Array {
  return new Uint8Array(Buffer.concat(parts));
}

export function box(type: string, ...payload: Uint8Array[]): Uint8Array {
  const body = concat(...payload);
  return concat(u32(8 + body.length), ascii(type), body);
}

export type Mp4Options = {
  seconds?: number;
  timescale?: number;
  /** mvhd version 0 (32-bit duration) or 1 (64-bit). */
  version?: 0 | 1;
  /** Android writes the movie header after the media data. */
  moovFirst?: boolean;
  /** Handler types, one track each; a phone's video has both (DG-71: a video includes sound). */
  tracks?: ("vide" | "soun")[];
  mdatBytes?: number;
};

export function syntheticMp4(options: Mp4Options = {}): Uint8Array {
  const {
    seconds = 10,
    timescale = 1000,
    version = 0,
    moovFirst = false,
    tracks = ["vide", "soun"],
    mdatBytes = 256,
  } = options;
  const duration = Math.round(seconds * timescale);
  const mvhd =
    version === 0
      ? box("mvhd", zeros(4), u32(0), u32(0), u32(timescale), u32(duration), zeros(80))
      : box("mvhd", new Uint8Array([1, 0, 0, 0]), u64(0), u64(0), u32(timescale), u64(duration), zeros(80));
  const traks = tracks.map((track) =>
    box("trak", box("mdia", box("hdlr", zeros(4), u32(0), ascii(track), zeros(12)))),
  );
  const moov = box("moov", mvhd, ...traks);
  const mdat = box("mdat", new Uint8Array(randomBytes(mdatBytes)));
  const ftyp = box("ftyp", ascii("isom"), u32(0x200), ascii("isomiso2avc1mp41"));
  return moovFirst ? concat(ftyp, moov, mdat) : concat(ftyp, mdat, moov);
}
