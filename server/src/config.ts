import path from "node:path";
import type { LogLevel } from "./log.js";

export type Config = {
  accessKeyId: string;
  secretAccessKey: string;
  endpoint: string;
  region: string;
  bucket: string;
  rawPrefix: string;
  host: string;
  port: number;
  cacheDir: string;
  /** Disk cache size limit; above it the least recently used images are deleted. */
  cacheMaxBytes: number;
  /** Thumbnails and previews rendered at the same time; each holds a whole image in memory. */
  renderSlots: number;
  /** Host names the server answers to (Host header): the loopback names plus ALLOWED_HOSTS. */
  allowedHosts: string[];
  /** Where images.csv comes from; null when neither REGISTRY_CSV_PATH nor REGISTRY_GITHUB_TOKEN is set. */
  registry: RegistryConfig | null;
  /** Lowest level written to the log. */
  logLevel: LogLevel;
  /** Log file the lines are appended to; null = console only. */
  logFile: string | null;
};

/** A local file (a Registry clone, for development) or the GitHub API with a read-only token. */
export type RegistryConfig =
  | { kind: "file"; path: string }
  | { kind: "github"; token: string; repo: string; ref: string; path: string };

type Env = Record<string, string | undefined>;

const DEFAULT_REGISTRY_REPO = "Nanoscout/data-registry";
const DEFAULT_REGISTRY_REF = "main";
const DEFAULT_REGISTRY_PATH = "catalog/yeast/images.csv";
const GITHUB_REPO_PATTERN = /^[\w.-]+\/[\w.-]+$/;

const REQUIRED = [
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "B2_ENDPOINT_URL",
  "B2_REGION",
  "B2_BUCKET",
] as const;

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "::1", "localhost"]);

/** Render slots when RENDER_SLOTS is not set. Matches libuv's default thread pool (UV_THREADPOOL_SIZE=4), which sharp runs on. */
const DEFAULT_RENDER_SLOTS = 4;

/** Host header names that are always allowed (as Express reports them: IPv6 in brackets). */
const LOOPBACK_HOST_NAMES = ["localhost", "127.0.0.1", "[::1]"];
/** A bare host name: letters, digits, dots and dashes. No scheme, port or path. */
const HOST_NAME_PATTERN = /^[a-z0-9.-]+$/;

const LOG_LEVELS: readonly LogLevel[] = ["debug", "info", "warn", "error"];
const DEFAULT_LOG_FILE = path.join("logs", "server.log");
/** LOG_FILE value that turns the log file off (console only). */
const LOG_FILE_OFF = "off";

/**
 * Build the app configuration from environment variables.
 * Error messages name the variables but never print their values (secrets).
 * A relative CACHE_DIR or REGISTRY_CSV_PATH resolves against rootDir (the repository root).
 */
export function loadConfig(env: Env, rootDir: string): Config {
  const missing = REQUIRED.filter((name) => !env[name]?.trim());
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }

  const portText = env.PORT?.trim() || "3000";
  const port = Number(portText);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be an integer between 1 and 65535");
  }

  const rawPrefix = (env.B2_RAW_PREFIX?.trim() || "yeast").replace(/^\/+|\/+$/g, "");
  if (!rawPrefix) {
    throw new Error("B2_RAW_PREFIX must not be empty");
  }

  // There is no sign-in yet, so only this machine may connect. Remove this check together
  // with adding Google sign-in (see authSlot in app.ts).
  const host = env.HOST?.trim() || "127.0.0.1";
  if (!LOOPBACK_HOSTS.has(host)) {
    throw new Error("HOST must be a loopback address (127.0.0.1, ::1 or localhost) until sign-in exists");
  }

  const cacheDir = env.CACHE_DIR?.trim() || ".cache-images";
  const cacheMaxMbText = env.CACHE_MAX_MB?.trim() || "2048";
  const cacheMaxMb = Number(cacheMaxMbText);
  if (!Number.isInteger(cacheMaxMb) || cacheMaxMb < 1) {
    throw new Error("CACHE_MAX_MB must be a positive integer (megabytes)");
  }

  const renderSlotsText = env.RENDER_SLOTS?.trim() || String(DEFAULT_RENDER_SLOTS);
  const renderSlots = Number(renderSlotsText);
  if (!Number.isInteger(renderSlots) || renderSlots < 1) {
    throw new Error("RENDER_SLOTS must be a positive integer");
  }

  return {
    accessKeyId: env.AWS_ACCESS_KEY_ID!.trim(),
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY!.trim(),
    endpoint: env.B2_ENDPOINT_URL!.trim(),
    region: env.B2_REGION!.trim(),
    bucket: env.B2_BUCKET!.trim(),
    rawPrefix,
    host,
    port,
    cacheDir: path.isAbsolute(cacheDir) ? cacheDir : path.join(rootDir, cacheDir),
    cacheMaxBytes: cacheMaxMb * 1024 * 1024,
    renderSlots,
    allowedHosts: loadAllowedHosts(env),
    registry: loadRegistryConfig(env, rootDir),
    logLevel: loadLogLevel(env),
    logFile: loadLogFile(env, rootDir),
  };
}

/**
 * Loopback names plus the comma-separated ALLOWED_HOSTS (e.g. the deployed domain), lower-cased.
 *
 * Args:
 *   env: Environment variables.
 *
 * Returns:
 *   Host names the Host check accepts.
 */
function loadAllowedHosts(env: Env): string[] {
  const extra = (env.ALLOWED_HOSTS ?? "")
    .split(",")
    .map((name) => name.trim().toLowerCase())
    .filter((name) => name !== "");
  const invalid = extra.filter((name) => !HOST_NAME_PATTERN.test(name));
  if (invalid.length > 0) {
    throw new Error(`ALLOWED_HOSTS must list bare host names (no https://, port or path): ${invalid.join(", ")}`);
  }
  return [...LOOPBACK_HOST_NAMES, ...extra];
}

/** LOG_LEVEL in any case; default info. */
function loadLogLevel(env: Env): LogLevel {
  const text = (env.LOG_LEVEL?.trim() || "info").toLowerCase();
  const level = LOG_LEVELS.find((l) => l === text);
  if (!level) throw new Error(`LOG_LEVEL must be one of ${LOG_LEVELS.join(", ")}`);
  return level;
}

/** LOG_FILE resolved against rootDir; default logs/server.log, "off" = no file. */
function loadLogFile(env: Env, rootDir: string): string | null {
  const text = env.LOG_FILE?.trim() || DEFAULT_LOG_FILE;
  if (text.toLowerCase() === LOG_FILE_OFF) return null;
  return path.isAbsolute(text) ? text : path.join(rootDir, text);
}

/** REGISTRY_CSV_PATH (local override) wins; else REGISTRY_GITHUB_TOKEN turns on the GitHub source. */
function loadRegistryConfig(env: Env, rootDir: string): RegistryConfig | null {
  const csvPath = env.REGISTRY_CSV_PATH?.trim();
  if (csvPath) return { kind: "file", path: path.resolve(rootDir, csvPath) };

  const token = env.REGISTRY_GITHUB_TOKEN?.trim();
  if (!token) return null;
  const repo = env.REGISTRY_GITHUB_REPO?.trim() || DEFAULT_REGISTRY_REPO;
  if (!GITHUB_REPO_PATTERN.test(repo)) {
    throw new Error("REGISTRY_GITHUB_REPO must look like owner/name");
  }
  return {
    kind: "github",
    token,
    repo,
    ref: env.REGISTRY_GITHUB_REF?.trim() || DEFAULT_REGISTRY_REF,
    path: (env.REGISTRY_GITHUB_PATH?.trim() || DEFAULT_REGISTRY_PATH).replace(/^\/+/, ""),
  };
}
