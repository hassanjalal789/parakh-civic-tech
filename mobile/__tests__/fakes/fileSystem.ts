/**
 * A test double for expo-file-system's File / Directory / Paths API, backed
 * by a real temporary directory, so tests can read the bytes on disk.
 */
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

export const root = fs.mkdtempSync(path.join(os.tmpdir(), "parakh-fs-"));

function toPath(uri: string): string {
  return uri.startsWith("file://") ? uri.slice("file://".length) : uri;
}

function joinUri(parts: (string | File | Directory)[]): string {
  const [first, ...rest] = parts.map((p) => (typeof p === "string" ? p : p.uri));
  return `file://${path.join(toPath(first ?? ""), ...rest)}`;
}

export class File {
  readonly uri: string;
  constructor(...parts: (string | File | Directory)[]) {
    this.uri = joinUri(parts);
  }
  get name(): string {
    return path.basename(toPath(this.uri));
  }
  get exists(): boolean {
    const p = toPath(this.uri);
    return fs.existsSync(p) && fs.statSync(p).isFile();
  }
  create(): void {
    fs.writeFileSync(toPath(this.uri), new Uint8Array(), { flag: "wx" }); // fails if it exists
  }
  write(content: string | Uint8Array): void {
    fs.writeFileSync(toPath(this.uri), content);
  }
  async bytes(): Promise<Uint8Array> {
    return new Uint8Array(fs.readFileSync(toPath(this.uri)));
  }
  delete(): void {
    fs.unlinkSync(toPath(this.uri));
  }
  open(): { readBytes(length: number): Uint8Array; close(): void } {
    const fd = fs.openSync(toPath(this.uri), "r");
    let offset = 0;
    return {
      readBytes(length: number) {
        const buffer = Buffer.alloc(length);
        const read = fs.readSync(fd, buffer, 0, length, offset);
        offset += read;
        return new Uint8Array(buffer.subarray(0, read));
      },
      close() {
        fs.closeSync(fd);
      },
    };
  }
}

export class Directory {
  readonly uri: string;
  constructor(...parts: (string | File | Directory)[]) {
    this.uri = joinUri(parts);
  }
  get name(): string {
    return path.basename(toPath(this.uri));
  }
  get exists(): boolean {
    const p = toPath(this.uri);
    return fs.existsSync(p) && fs.statSync(p).isDirectory();
  }
  create(options?: { intermediates?: boolean; idempotent?: boolean }): void {
    if (this.exists && options?.idempotent) return;
    fs.mkdirSync(toPath(this.uri), { recursive: options?.intermediates ?? false });
  }
  list(): (File | Directory)[] {
    const p = toPath(this.uri);
    return fs
      .readdirSync(p)
      .map((name) =>
        fs.statSync(path.join(p, name)).isDirectory() ? new Directory(this, name) : new File(this, name),
      );
  }
}

export const Paths = {
  get document(): Directory {
    return new Directory(`file://${path.join(root, "document")}`);
  },
  get cache(): Directory {
    return new Directory(`file://${path.join(root, "cache")}`);
  },
};

/** Empties the fake device storage between tests. */
export function resetFileSystem(): void {
  fs.rmSync(root, { recursive: true, force: true });
  for (const dir of ["document", "cache", "SQLite"]) fs.mkdirSync(path.join(root, dir), { recursive: true });
}

export function pathOf(uri: string): string {
  return toPath(uri);
}
