// Read-only access to the B2 bucket through its S3 API.
// Only these three read commands are imported: nothing in this app can write, delete, copy or move.
import { GetObjectCommand, HeadObjectCommand, ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import type { Readable } from "node:stream";
import type { Config } from "./config.js";
import { HttpError } from "./errors.js";
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
export type S3Like = { send(command: any): Promise<any> };

function isNotFound(err: unknown): boolean {
  const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
  return e?.$metadata?.httpStatusCode === 404 || e?.name === "NoSuchKey" || e?.name === "NotFound";
}

/** Missing object: 404. Anything else (network, credentials, B2 outage): 502 with a short message. */
function toHttpError(err: unknown): HttpError {
  if (err instanceof HttpError) return err;
  if (isNotFound(err)) return new HttpError(404, "Not found", { cause: err });
  return new HttpError(502, "B2 unavailable", { cause: err });
}

export function createB2(config: Config, client?: S3Like): B2 {
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
    });
  const Bucket = config.bucket;

  return {
    async list(prefix) {
      const result: RawListing = { prefixes: [], objects: [] };
      let token: string | undefined;
      try {
        do {
          const page = await s3.send(
            new ListObjectsV2Command({ Bucket, Prefix: prefix, Delimiter: "/", ContinuationToken: token }),
          );
          for (const p of page.CommonPrefixes ?? []) if (p.Prefix) result.prefixes.push(p.Prefix);
          for (const o of page.Contents ?? []) {
            if (o.Key) result.objects.push({ key: o.Key, size: o.Size ?? 0, lastModified: o.LastModified ?? new Date(0) });
          }
          token = page.IsTruncated ? page.NextContinuationToken : undefined;
        } while (token);
      } catch (err) {
        throw toHttpError(err);
      }
      return result;
    },

    async head(key) {
      try {
        const res = await s3.send(new HeadObjectCommand({ Bucket, Key: key }));
        return { etag: String(res.ETag ?? "").replace(/"/g, ""), size: res.ContentLength ?? 0 };
      } catch (err) {
        if (isNotFound(err)) return null;
        throw toHttpError(err);
      }
    },

    async getBytes(key) {
      try {
        const res = await s3.send(new GetObjectCommand({ Bucket, Key: key }));
        return Buffer.from(await res.Body.transformToByteArray());
      } catch (err) {
        throw toHttpError(err);
      }
    },

    async getStream(key) {
      try {
        const res = await s3.send(new GetObjectCommand({ Bucket, Key: key }));
        return { body: res.Body as Readable, size: res.ContentLength ?? 0 };
      } catch (err) {
        throw toHttpError(err);
      }
    },
  };
}
