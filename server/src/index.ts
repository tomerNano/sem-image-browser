import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { createApp } from "./app.js";
import { createB2 } from "./b2.js";
import { createDiskCache } from "./cache.js";
import { loadConfig } from "./config.js";
import { createImageRenderer } from "./images.js";
import { createLimiter } from "./limit.js";
import { createFileSource, createGitHubSource, createRegistry, type RegistrySource } from "./registry.js";

// How often a listing may ask the Registry source for changes. A local file costs one stat call;
// GitHub costs one HTTP request (a free 304 when unchanged), so it is asked less often.
const FILE_CHECK_EVERY_MS = 5_000;
const GITHUB_CHECK_EVERY_MS = 60_000;

// server/src/index.ts (dev) and server/dist/index.js (production) both sit two levels below the repo root.
const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

// Local development reads .env at the repo root; on a server the real environment is used.
dotenv.config({ path: path.join(repoRoot, ".env"), quiet: true });

let config;
try {
  config = loadConfig(process.env, repoRoot);
} catch (err) {
  console.error(`Cannot start: ${(err as Error).message}. See .env.example.`);
  process.exit(1);
}

const b2 = createB2(config);
let registrySource: RegistrySource | null = null;
let registryCheckEveryMs = FILE_CHECK_EVERY_MS;
if (config.registry?.kind === "file") {
  registrySource = createFileSource(config.registry.path);
} else if (config.registry?.kind === "github") {
  registrySource = createGitHubSource(config.registry);
  registryCheckEveryMs = GITHUB_CHECK_EVERY_MS;
}
const registry = createRegistry(registrySource, registryCheckEveryMs);
const images = createImageRenderer({ b2, cache: createDiskCache(config.cacheDir, config.cacheMaxBytes), limit: createLimiter(4) });
// Production (`npm start` passes --production): this one process also serves web/dist.
const production = process.argv.includes("--production") || process.env.NODE_ENV === "production";
const webDist = production ? path.join(repoRoot, "web", "dist") : undefined;

const app = createApp({ config, b2, images, registry, webDist });
app.listen(config.port, config.host, () => {
  console.log(`B2 GUI server on http://${config.host}:${config.port} (bucket ${config.bucket}, prefix ${config.rawPrefix}/)`);
});
