// Read-only access to the B2 bucket through its S3 API.
// Only these three read commands are imported: nothing in this app can write, delete, copy or move.
import { GetObjectCommand, HeadObjectCommand, ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import type { Readable } from "node:stream";
import type { Config } from "./config.js";
import { HttpError } from "./errors.js";
import { log, sizeText } from "./log.js";
import type { RawListing } from "./listing.js";

export interface B2 {
  /** One folder level (Delimiter "/"), every page. */
  list(prefix: string): Promise<RawListing>;
  /** Object metadata, or null when the object does not exist. */
  head(key: string): Promise<{ etag: string; size: number } | null>;
  getBytes(key: string): Promise<Buffer>;
  getStream(key: string): Promise<{ body: Readable; size: number }>;
}

/** The part of S3Client this module uses; tests pass an in-memory stand-in. */
export type S3Like = { send(command: any, options?: { abortSignal?: AbortSignal }): Promise<any> };

export type B2Options = {
  /** Upper limit for list, head and whole-object reads. Downloads (getStream) are limited by the socket timeout instead. */
  timeoutMs?: number;
};

function isNotFound(err: unknown): boolean {
  const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
  return e?.$metadata?.httpStatusCode === 404 || e?.name === "NoSuchKey" || e?.name === "NotFound";
}

/** Milliseconds since `start`. */
const since = (start: number) => Date.now() - start;

/** A failed B2 call as a WARN line: which call, how long it waited, and the error type. */
function warnFailure(call: string, start: number, err: unknown): void {
  const e = err as { name?: string; message?: string };
  log.warn(`B2 ${call} failed after ${since(start)} ms: ${e?.name ?? "Error"}: ${e?.message ?? String(err)}`);
}

/** Missing object: 404. Anything else (network, credentials, B2 outage): 502 with a short message. */
function toHttpError(err: unknown): HttpError {
  if (err instanceof HttpError) return err;
  if (isNotFound(err)) return new HttpError(404, "Not found", { cause: err });
  return new HttpError(502, "B2 unavailable", { cause: err });
}

export function createB2(config: Config, client?: S3Like, options: B2Options = {}): B2 {
  const timeoutMs = options.timeoutMs ?? 60_000;
  const s3: S3Like =
    client ??
    new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      forcePathStyle: true,
      credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
      // B2 does not support every newer S3 checksum feature; only use checksums when required.
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
      // Without these, a silently dropped connection waits for the OS TCP timeout (minutes).
      requestHandler: { connectionTimeout: 5_000, socketTimeout: 30_000 },
    });
  /** send() that gives up after timeoutMs, so a stalled B2 call cannot block a request forever. */
  const sendWithTimeout = (command: unknown) => s3.send(command, { abortSignal: AbortSignal.timeout(timeoutMs) });
  const Bucket = config.bucket;

  return {
    async list(prefix) {
      const result: RawListing = { prefixes: [], objects: [] };
      let token: string | undefined;
      const start = Date.now();
      let pages = 0;
      try {
        do {
          const page = await sendWithTimeout(
            new ListObjectsV2Command({ Bucket, Prefix: prefix, Delimiter: "/", ContinuationToken: token }),
          );
          for (const p of page.CommonPrefixes ?? []) if (p.Prefix) result.prefixes.push(p.Prefix);
          for (const o of page.Contents ?? []) {
            if (o.Key) result.objects.push({ key: o.Key, size: o.Size ?? 0, lastModified: o.LastModified ?? new Date(0) });
          }
          token = page.IsTruncated ? page.NextContinuationToken : undefined;
          pages++;
        } while (token);
      } catch (err) {
        warnFailure(`list ${prefix}`, start, err);
        throw toHttpError(err);
      }
      log.debug(
        `B2 list ${prefix}: ${result.prefixes.length} folders, ${result.objects.length} files, ${pages} page(s) in ${since(start)} ms`,
      );
      return result;
    },

    async head(key) {
      const start = Date.now();
      try {
        const res = await sendWithTimeout(new HeadObjectCommand({ Bucket, Key: key }));
        log.debug(`B2 head ${key}: found, ${sizeText(res.ContentLength ?? 0)}, ${since(start)} ms`);
        return { etag: String(res.ETag ?? "").replace(/"/g, ""), size: res.ContentLength ?? 0 };
      } catch (err) {
        if (isNotFound(err)) {
          log.debug(`B2 head ${key}: missing, ${since(start)} ms`);
          return null;
        }
        warnFailure(`head ${key}`, start, err);
        throw toHttpError(err);
      }
    },

    async getBytes(key) {
      const start = Date.now();
      try {
        const res = await sendWithTimeout(new GetObjectCommand({ Bucket, Key: key }));
        const bytes = Buffer.from(await res.Body.transformToByteArray());
        const ms = since(start);
        const speed = ms > 0 ? ` (${sizeText((bytes.length * 1000) / ms)}/s)` : "";
        log.debug(`B2 get ${key}: ${sizeText(bytes.length)} in ${ms} ms${speed}`);
        return bytes;
      } catch (err) {
        warnFailure(`get ${key}`, start, err);
        throw toHttpError(err);
      }
    },

    async getStream(key) {
      const start = Date.now();
      try {
        const res = await s3.send(new GetObjectCommand({ Bucket, Key: key }));
        log.debug(`B2 stream ${key}: ${sizeText(res.ContentLength ?? 0)}, opened in ${since(start)} ms`);
        return { body: res.Body as Readable, size: res.ContentLength ?? 0 };
      } catch (err) {
        warnFailure(`stream ${key}`, start, err);
        throw toHttpError(err);
      }
    },
  };
}
