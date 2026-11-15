// Several B2 objects streamed to the browser as one zip file, without holding them in memory.
import type { Readable } from "node:stream";
import yazl from "yazl";

/** One file of the zip: where it comes from in B2 and how it is stored. */
export type ZipEntry = { key: string; name: string; size: number; mtime: Date };

/**
 * Zip file name for a folder: its last part, or the batch name for a "raw" folder
 * ("yeast/2026-10-06_b001/raw/" -> "2026-10-06_b001.zip").
 */
export function zipName(prefix: string): string {
  const parts = prefix.split("/").filter(Boolean);
  const last = parts[parts.length - 1] ?? "images";
  const name = last === "raw" && parts.length > 1 ? parts[parts.length - 2] : last;
  return `${name}.zip`;
}

/**
 * Builds the zip as a stream. Entries are stored, not compressed (SEM TIFFs barely compress),
 * so the total size is known up front. B2 objects are opened one at a time, only when the zip
 * reaches them. Any error (B2 failure, a size that differs from the listing) destroys `output`.
 */
export function createZip(
  entries: ZipEntry[],
  open: (key: string) => Promise<Readable>,
): { output: Readable; size: Promise<number> } {
  const zip = new yazl.ZipFile();
  const output = zip.outputStream as Readable;
  // The B2 stream being read now; closed with the output (e.g. the browser cancels the download).
  let current: Readable | null = null;
  zip.on("error", (err) => output.destroy(err));
  output.on("close", () => current?.destroy());

  for (const entry of entries) {
    zip.addReadStreamLazy(entry.name, { compress: false, size: entry.size, mtime: entry.mtime }, (cb) => {
      open(entry.key).then(
        (stream) => {
          current = stream;
          // pipe() does not forward source errors, so a broken B2 stream must fail the zip itself.
          stream.on("error", (err) => zip.emit("error", err));
          cb(null, stream);
        },
        (err) => cb(err, undefined as unknown as Readable),
      );
    });
  }

  // The types declare the callback without its argument: the total size in bytes, or -1.
  const size = new Promise<number>((resolve) => {
    const end = zip.end as (options: object, callback: (total: number) => void) => void;
    end.call(zip, {}, resolve);
  });
  return { output, size };
}
