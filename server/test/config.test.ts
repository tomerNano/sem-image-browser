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

test("strips slashes from B2_RAW_PREFIX", () => {
  expect(loadConfig({ ...full, B2_RAW_PREFIX: "/yeast/" }, "/app").rawPrefix).toBe("yeast");
});
