import { createWriteStream, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { createApp } from "./app.js";
import { createB2 } from "./b2.js";
import { createDiskCache } from "./cache.js";
import { loadConfig, type Config } from "./config.js";
import { createImageRenderer } from "./images.js";
import { createLimiter } from "./limit.js";
import { configureLog, log, sizeText } from "./log.js";
import { createFileSource, createGitHubSource, createRegistry, SPLIT_TAGS_FILE, type RegistrySource } from "./registry.js";

// How often a listing may ask the Registry source for changes. A local file costs one stat call;
// GitHub costs one HTTP request (a free 304 when unchanged), so it is asked less often.
const FILE_CHECK_EVERY_MS = 5_000;
const GITHUB_CHECK_EVERY_MS = 60_000;

// server/src/index.ts (dev) and server/dist/index.js (production) both sit two levels below the repo root.
const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

// Local development reads .env at the repo root; on a server the real environment is used.
dotenv.config({ path: path.join(repoRoot, ".env"), quiet: true });

let config: Config;
try {
  config = loadConfig(process.env, repoRoot);
} catch (err) {
  console.error(`Cannot start: ${(err as Error).message}. See .env.example.`);
  process.exit(1);
}

// Every log line goes to the console and, unless LOG_FILE=off, is appended to the log file.
const logFile = config.logFile;
let fileStream: ReturnType<typeof createWriteStream> | null = null;
if (logFile) {
  mkdirSync(path.dirname(logFile), { recursive: true });
  fileStream = createWriteStream(logFile, { flags: "a" });
  fileStream.on("error", (err) => console.error(`Cannot write the log file ${logFile}:`, err.message));
}
configureLog({
  level: config.logLevel,
  write: (line, level) => {
    if (level === "warn" || level === "error") console.error(line);
    else console.log(line);
    fileStream?.write(line + "\n");
  },
});

const b2 = createB2(config);
// split_tags.csv sits next to images.csv in both sources (GitHub paths always use "/").
let registrySource: RegistrySource | null = null;
let tagsSource: RegistrySource | null = null;
let registryCheckEveryMs = FILE_CHECK_EVERY_MS;
if (config.registry?.kind === "file") {
  registrySource = createFileSource(config.registry.path);
  tagsSource = createFileSource(path.join(path.dirname(config.registry.path), SPLIT_TAGS_FILE));
} else if (config.registry?.kind === "github") {
  registrySource = createGitHubSource(config.registry);
  const tagsPath = path.posix.join(path.posix.dirname(config.registry.path), SPLIT_TAGS_FILE);
  tagsSource = createGitHubSource({ ...config.registry, path: tagsPath });
  registryCheckEveryMs = GITHUB_CHECK_EVERY_MS;
}
const registry = createRegistry(registrySource, registryCheckEveryMs, tagsSource);
const images = createImageRenderer({ b2, cache: createDiskCache(config.cacheDir, config.cacheMaxBytes), limit: createLimiter(4) });
// Production (`npm start` passes --production): this one process also serves web/dist.
const production = process.argv.includes("--production") || process.env.NODE_ENV === "production";
const webDist = production ? path.join(repoRoot, "web", "dist") : undefined;

const app = createApp({ config, b2, images, registry, webDist });
/** Where the Registry comes from, for the startup summary (never the token). */
function registryText(): string {
  if (config.registry?.kind === "file") return `local file ${config.registry.path}`;
  if (config.registry?.kind === "github") return `GitHub ${config.registry.repo}@${config.registry.ref}:${config.registry.path}`;
  return "not configured (no metadata, no filters)";
}

app.listen(config.port, config.host, () => {
  log.info(`B2 GUI server on http://${config.host}:${config.port} (${production ? "production" : "development"})`);
  log.info(`B2: bucket ${config.bucket}, prefix ${config.rawPrefix}/, endpoint ${config.endpoint}`);
  log.info(`Image cache: ${config.cacheDir}, limit ${sizeText(config.cacheMaxBytes)}`);
  log.info(`Registry: ${registryText()}`);
  log.info(`Log: level ${config.logLevel}, file ${logFile ?? "off"}`);
});
