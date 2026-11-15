import path from "node:path";
import { expect, test } from "vitest";
import { loadConfig } from "../src/config.js";

const full = {
  AWS_ACCESS_KEY_ID: "id",
  AWS_SECRET_ACCESS_KEY: "s3cr3t",
  B2_ENDPOINT_URL: "https://s3.eu-central-003.backblazeb2.com",
  B2_REGION: "eu-central-003",
  B2_BUCKET: "bucket",
};

test("applies defaults", () => {
  const c = loadConfig(full, "/app");
  expect(c).toMatchObject({ rawPrefix: "yeast", host: "127.0.0.1", port: 3000 });
  expect(c.cacheDir).toBe(path.join("/app", ".cache-images"));
  expect(c.cacheMaxBytes).toBe(2048 * 1024 * 1024);
});

test("CACHE_MAX_MB sets the cache limit and must be a positive integer", () => {
  expect(loadConfig({ ...full, CACHE_MAX_MB: "500" }, "/app").cacheMaxBytes).toBe(500 * 1024 * 1024);
  expect(() => loadConfig({ ...full, CACHE_MAX_MB: "0" }, "/app")).toThrow(/CACHE_MAX_MB/);
  expect(() => loadConfig({ ...full, CACHE_MAX_MB: "2GB" }, "/app")).toThrow(/CACHE_MAX_MB/);
});

test("names every missing variable and never prints values", () => {
  expect(() => loadConfig({ AWS_SECRET_ACCESS_KEY: "s3cr3t" }, "/app")).toThrow(
    /AWS_ACCESS_KEY_ID.*B2_ENDPOINT_URL.*B2_REGION.*B2_BUCKET/,
  );
  try {
    loadConfig({ AWS_SECRET_ACCESS_KEY: "s3cr3t" }, "/app");
  } catch (e) {
    expect(String(e)).not.toContain("s3cr3t");
  }
});

test("rejects a non-numeric PORT", () => {
  expect(() => loadConfig({ ...full, PORT: "abc" }, "/app")).toThrow(/PORT/);
});

test("refuses a HOST other machines could reach (no sign-in yet)", () => {
  expect(() => loadConfig({ ...full, HOST: "0.0.0.0" }, "/app")).toThrow(/HOST/);
  expect(() => loadConfig({ ...full, HOST: "192.168.1.20" }, "/app")).toThrow(/HOST/);
  expect(loadConfig({ ...full, HOST: "localhost" }, "/app").host).toBe("localhost");
  expect(loadConfig({ ...full, HOST: "::1" }, "/app").host).toBe("::1");
});

test("strips slashes from B2_RAW_PREFIX", () => {
  expect(loadConfig({ ...full, B2_RAW_PREFIX: "/yeast/" }, "/app").rawPrefix).toBe("yeast");
});

test("Registry is optional; REGISTRY_CSV_PATH resolves against the repo root", () => {
  expect(loadConfig(full, "/app").registry).toBeNull();
  expect(loadConfig({ ...full, REGISTRY_CSV_PATH: "reg/images.csv" }, "/app").registry).toEqual({
    kind: "file",
    path: path.resolve("/app", "reg/images.csv"),
  });
});

test("REGISTRY_GITHUB_TOKEN reads the Registry from GitHub, with defaults for repo, branch and path", () => {
  expect(loadConfig({ ...full, REGISTRY_GITHUB_TOKEN: "ghp_x" }, "/app").registry).toEqual({
    kind: "github",
    token: "ghp_x",
    repo: "Nanoscout/data-registry",
    ref: "v1",
    path: "catalog/yeast/images.csv",
  });
  const custom = { REGISTRY_GITHUB_REPO: "acme/reg", REGISTRY_GITHUB_REF: "main", REGISTRY_GITHUB_PATH: "/a/b.csv" };
  expect(loadConfig({ ...full, REGISTRY_GITHUB_TOKEN: "ghp_x", ...custom }, "/app").registry).toMatchObject({
    repo: "acme/reg",
    ref: "main",
    path: "a/b.csv",
  });
});

test("a local REGISTRY_CSV_PATH wins over the GitHub token", () => {
  const env = { ...full, REGISTRY_CSV_PATH: "reg/images.csv", REGISTRY_GITHUB_TOKEN: "ghp_x" };
  expect(loadConfig(env, "/app").registry?.kind).toBe("file");
});

test("rejects a REGISTRY_GITHUB_REPO that is not owner/name, without printing the token", () => {
  const env = { ...full, REGISTRY_GITHUB_TOKEN: "ghp_secret", REGISTRY_GITHUB_REPO: "data-registry" };
  expect(() => loadConfig(env, "/app")).toThrow(/REGISTRY_GITHUB_REPO/);
  expect(() => loadConfig(env, "/app")).not.toThrow(/ghp_secret/);
});
