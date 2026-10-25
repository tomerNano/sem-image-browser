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

/** Sign-in slot. Does nothing in the MVP; Google Workspace sign-in checks go here later. */
function authSlot(_req: Request, _res: Response, next: NextFunction): void {
  next();
}

export function createApp({ config, b2, images, registry, webDist }: AppDeps): express.Express {
  const app = express();
  app.disable("x-powered-by");
  app.use(requestLog);
  app.use(securityHeaders);
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
    res.json(mapListing(prefix, config.rawPrefix, raw, registry?.lookup));
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

  if (images) {
    const sendImage = (size: ImageSize) => async (req: Request, res: Response) => {
      const key = validateKey(req.query.key, config.rawPrefix);
      const image = await images(key, size);
      res.set("Cache-Control", "private, max-age=86400").type(image.contentType).send(image.body);
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
