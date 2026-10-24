import { createHash } from "node:crypto";
import { Readable } from "node:stream";
import { GetObjectCommand, HeadObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { createB2, type B2, type S3Like } from "../src/b2.js";
import { loadConfig } from "../src/config.js";

export const testConfig = loadConfig(
  { AWS_ACCESS_KEY_ID: "i", AWS_SECRET_ACCESS_KEY: "s", B2_ENDPOINT_URL: "http://x", B2_REGION: "r", B2_BUCKET: "b" },
  "/tmp",
);

type Options = { pageSize?: number; fail?: boolean; hang?: boolean };

function notFound(): Error {
  return Object.assign(new Error("NoSuchKey"), { name: "NoSuchKey", $metadata: { httpStatusCode: 404 } });
}

/**
 * In-memory stand-in for the S3 client: answers the three read commands the app uses,
 * with real ListObjectsV2 paging (MaxKeys / ContinuationToken). `fail` simulates B2 being down;
 * `hang` simulates a stalled connection: GetObject never answers until its abortSignal fires.
 */
export function fakeS3(objects: Record<string, Buffer>, opts: Options = {}): S3Like & { calls: string[] } {
  const pageSize = opts.pageSize ?? 1000;
  const keys = Object.keys(objects).sort();
  const calls: string[] = [];
  const lastModified = new Date("2026-10-19T09:00:00Z");
  const etag = (key: string) => `"${createHash("md5").update(objects[key]).digest("hex")}"`;

  return {
    calls,
    async send(command: unknown, options?: { abortSignal?: AbortSignal }): Promise<any> {
      if (opts.hang && command instanceof GetObjectCommand) {
        await new Promise((_resolve, reject) => {
          options?.abortSignal?.addEventListener("abort", () =>
            reject(Object.assign(new Error("Request aborted"), { name: "AbortError" })),
          );
        });
      }
      if (opts.fail) {
        throw Object.assign(new Error("getaddrinfo ENOTFOUND"), { name: "Error" });
      }
      if (command instanceof ListObjectsV2Command) {
        const { Prefix = "", Delimiter, ContinuationToken } = command.input;
        calls.push(`list ${Prefix} ${ContinuationToken ?? ""}`);
        const entries: { prefix?: string; key?: string }[] = [];
        const seen = new Set<string>();
        for (const key of keys.filter((k) => k.startsWith(Prefix))) {
          const rest = key.slice(Prefix.length);
          const slash = Delimiter ? rest.indexOf(Delimiter) : -1;
          if (slash >= 0) {
            const p = Prefix + rest.slice(0, slash + 1);
            if (!seen.has(p)) {
              seen.add(p);
              entries.push({ prefix: p });
            }
          } else {
            entries.push({ key });
          }
        }
        const start = ContinuationToken ? Number(ContinuationToken) : 0;
        const page = entries.slice(start, start + pageSize);
        const more = start + pageSize < entries.length;
        return {
          CommonPrefixes: page.filter((e) => e.prefix).map((e) => ({ Prefix: e.prefix })),
          Contents: page
            .filter((e) => e.key)
            .map((e) => ({ Key: e.key, Size: objects[e.key!].length, LastModified: lastModified })),
          IsTruncated: more,
          NextContinuationToken: more ? String(start + pageSize) : undefined,
        };
      }
      if (command instanceof HeadObjectCommand) {
        const key = command.input.Key!;
        calls.push(`head ${key}`);
        if (!(key in objects)) throw Object.assign(new Error("NotFound"), { name: "NotFound", $metadata: { httpStatusCode: 404 } });
        return { ETag: etag(key), ContentLength: objects[key].length };
      }
      if (command instanceof GetObjectCommand) {
        const key = command.input.Key!;
        calls.push(`get ${key}`);
        if (!(key in objects)) throw notFound();
        const body = Object.assign(Readable.from([objects[key]]), {
          transformToByteArray: async () => new Uint8Array(objects[key]),
        });
        return { Body: body, ContentLength: objects[key].length, ETag: etag(key) };
      }
      throw new Error(`fakeS3: unsupported command ${String(command)}`);
    },
  };
}

/** The real createB2 code running on top of fakeS3. */
export function fakeB2(objects: Record<string, Buffer>, opts: Options & { timeoutMs?: number } = {}): B2 {
  return createB2(testConfig, fakeS3(objects, opts), { timeoutMs: opts.timeoutMs });
}
