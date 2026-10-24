import path from "node:path";

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
  /** Local images.csv from a Registry clone; null when REGISTRY_CSV_PATH is not set. */
  registryCsvPath: string | null;
};

type Env = Record<string, string | undefined>;

const REQUIRED = [
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "B2_ENDPOINT_URL",
  "B2_REGION",
  "B2_BUCKET",
] as const;

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

  const cacheDir = env.CACHE_DIR?.trim() || ".cache-images";
  const registryCsv = env.REGISTRY_CSV_PATH?.trim() || "";

  return {
    accessKeyId: env.AWS_ACCESS_KEY_ID!.trim(),
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY!.trim(),
    endpoint: env.B2_ENDPOINT_URL!.trim(),
    region: env.B2_REGION!.trim(),
    bucket: env.B2_BUCKET!.trim(),
    rawPrefix,
    host: env.HOST?.trim() || "127.0.0.1",
    port,
    cacheDir: path.isAbsolute(cacheDir) ? cacheDir : path.join(rootDir, cacheDir),
    registryCsvPath: registryCsv ? path.resolve(rootDir, registryCsv) : null,
  };
}
