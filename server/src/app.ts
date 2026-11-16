import { existsSync } from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import express, { type NextFunction, type Request, type Response } from "express";
import type { B2 } from "./b2.js";
import type { Config } from "./config.js";
import { HttpError } from "./errors.js";
import type { ImageRenderer, ImageSize } from "./images.js";
import { validateKey, validatePrefix } from "./keys.js";
import { mapListing } from "./listing.js";
import type { Registry } from "./registry.js";
import { createZip, zipName } from "./zip.js";

/** Most files one zip download may hold. */
export const MAX_ZIP_FILES = 1000;

/**
 * Browser cache for thumbnails and previews: one day, this user's browser only (no shared proxy).
 * Image URLs carry the file's upload time, so a file replaced in B2 gets a new URL.
 */
const IMAGE_CACHE_CONTROL = "private, max-age=86400";

export type AppDeps = { config: Config; b2: B2; images?: ImageRenderer; registry?: Registry; webDist?: string };

/** Logs one line per request: method, path, status, duration. */
function requestLog(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  res.on("finish", () => {
    console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - start}ms`);
  });
  next();
}

// Everything the page needs comes from this server. Inline data: covers small assets Vite inlines.
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

/** Browser hardening headers on every response (API and built frontend). */
function securityHeaders(_req: Request, res: Response, next: NextFunction): void {
  res.set({
    "Content-Security-Policy": CONTENT_SECURITY_POLICY,
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Cross-Origin-Opener-Policy": "same-origin",
  });
  next();
}

// Host names this server answers to. Any port is accepted: in development the Vite proxy
// forwards "localhost:5173" unchanged. Add the server's domain here when it is deployed.
const ALLOWED_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * Blocks DNS rebinding: a malicious website points its own domain at 127.0.0.1 and then reads
 * this API from the user's browser. Such requests still carry the attacker's host name.
 */
function hostCheck(req: Request, _res: Response, next: NextFunction): void {
  if (!ALLOWED_HOSTS.has(req.hostname ?? "")) {
    next(new HttpError(403, "Host not allowed"));
    return;
  }
  next();
}

/** Sign-in slot. Does nothing in the MVP; Google Workspace sign-in checks go here later. */
function authSlot(_req: Request, _res: Response, next: NextFunction): void {
  next();
}

export function createApp({ config, b2, images, registry, webDist }: AppDeps): express.Express {
  const app = express();
  app.disable("x-powered-by");
  app.use(requestLog);
  app.use(securityHeaders);
  app.use(hostCheck);
  app.use("/api", authSlot);

  // Where browsing starts. The browser asks instead of hard-coding it, so B2_RAW_PREFIX
  // (e.g. "SEM-DATA/yeast") is configured in one place only.
  app.get("/api/root", (_req, res) => {
    const name = config.rawPrefix.slice(config.rawPrefix.lastIndexOf("/") + 1);
    res.json({ prefix: config.rawPrefix + "/", name });
  });

  app.get("/api/list", async (req, res) => {
    const prefix = validatePrefix(req.query.prefix, config.rawPrefix);
    // The B2 listing and the Registry check run side by side; the Registry never fails a listing.
    const [raw] = await Promise.all([b2.list(prefix), registry?.refresh()]);
    res.json(mapListing(prefix, config.rawPrefix, raw, registry?.lookup, registry?.tagsFor));
  });

  // Registry images counted by split and filter values, so the browser can filter splits at the
  // top level without B2 calls. no-cache: the browser keeps a copy but asks each time; Express's
  // ETag turns an unchanged answer into a 304 with no body.
  app.get("/api/split-groups", async (_req, res) => {
    await registry?.refresh();
    res.set("Cache-Control", "private, no-cache").json({ splits: registry?.splitGroups() ?? {} });
  });

  // Whether Registry metadata is available, so the browser can show a warning when it is not.
  app.get("/api/registry", async (_req, res) => {
    await registry?.refresh();
    res.json(registry?.status() ?? { configured: false, loaded: false, rows: 0, version: null, error: null });
  });

  // The original TIFF, streamed unchanged from B2 to the browser (never held fully in memory).
  app.get("/api/download", async (req, res) => {
    const key = validateKey(req.query.key, config.rawPrefix);
    const { body, size } = await b2.getStream(key);
    res.attachment(key.slice(key.lastIndexOf("/") + 1));
    res.type("image/tiff");
    if (size > 0) res.set("Content-Length", String(size));
    try {
      await pipeline(body, res);
    } catch (err) {
      // Headers are already sent, so no error page is possible: log and drop the connection.
      console.error(`Download of ${key} failed:`, err);
      res.destroy();
    }
  });

  // Several originals of one folder as one zip. A form POST (not fetch), so the browser's own
  // download manager saves the stream; the key list is too long for a URL.
  app.post(
    "/api/download-zip",
    express.urlencoded({ extended: false, limit: "512kb", parameterLimit: MAX_ZIP_FILES + 10 }),
    async (req, res) => {
      // Another website could post this form too; browsers mark such requests as cross-site.
      const site = req.get("Sec-Fetch-Site");
      if (site && site !== "same-origin") throw new HttpError(403, "Cross-site request refused");

      const raw: unknown = req.body?.key;
      const values = raw === undefined ? [] : Array.isArray(raw) ? raw : [raw];
      if (values.length === 0) throw new HttpError(400, "Missing key");
      if (values.length > MAX_ZIP_FILES) throw new HttpError(400, `At most ${MAX_ZIP_FILES} files per download`);
      const keys = [...new Set(values.map((v) => validateKey(v, config.rawPrefix)))];
      const parent = (key: string) => key.slice(0, key.lastIndexOf("/") + 1);
      const folder = parent(keys[0]);
      if (keys.some((k) => parent(k) !== folder)) throw new HttpError(400, "All files must be in one folder");

      // One listing gives every size (so Content-Length is exact) and finds missing files before
      // any byte is sent, while an error page is still possible.
      const objects = new Map((await b2.list(folder)).objects.map((o) => [o.key, o]));
      const entries = keys.map((key) => {
        const object = objects.get(key);
        if (!object) throw new HttpError(404, "Not found");
        return { key, name: key.slice(folder.length), size: object.size, mtime: object.lastModified };
      });

      const { output, size } = createZip(entries, async (key) => (await b2.getStream(key)).body);
      res.attachment(zipName(folder));
      const total = await size;
      if (total >= 0) res.set("Content-Length", String(total));
      try {
        await pipeline(output, res);
      } catch (err) {
        console.error(`Zip download of ${keys.length} files from ${folder} failed:`, err);
        res.destroy();
      }
    },
  );

  if (images) {
    const sendImage = (size: ImageSize) => async (req: Request, res: Response) => {
      const key = validateKey(req.query.key, config.rawPrefix);
      const image = await images(key, size);
      res.set("Cache-Control", IMAGE_CACHE_CONTROL).type(image.contentType).send(image.body);
    };
    app.get("/api/thumb", sendImage("thumb"));
    app.get("/api/preview", sendImage("preview"));
  }

  app.use("/api", (_req, _res, next) => next(new HttpError(404, "Not found")));

  // Production: the same process serves the built frontend. Any other GET gets index.html.
  if (webDist && existsSync(path.join(webDist, "index.html"))) {
    app.use(express.static(webDist));
    app.get("/{*path}", (_req, res) => res.sendFile(path.join(webDist, "index.html")));
  }

  // Express 5 sends errors thrown in async handlers here. The client gets a short message;
  // the full error (with its cause) goes to the server log only.
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof HttpError) {
      if (err.status >= 500) console.error(err.cause ?? err);
      res.status(err.status).json({ error: err.message });
      return;
    }
    console.error(err);
    res.status(500).json({ error: "Internal error" });
  });

  return app;
}
