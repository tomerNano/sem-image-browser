import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import request from "supertest";
import { expect, test } from "vitest";
import { createApp } from "../src/app.js";
import { fakeB2, testConfig as config } from "./fakeB2.js";

const p = "yeast/2026-10-06_b_ns-lab_b001/raw/";

test("root tells the browser where browsing starts", async () => {
  const deep = { ...config, rawPrefix: "SEM-DATA/yeast" };
  const res = await request(createApp({ config: deep, b2: fakeB2({}) })).get("/api/root");
  expect(res.status).toBe(200);
  expect(res.body).toEqual({ prefix: "SEM-DATA/yeast/", name: "yeast" });
});

test("lists one folder", async () => {
  const app = createApp({ config, b2: fakeB2({ [p + "cell_1.tiff"]: Buffer.from("x") }) });
  const res = await request(app).get("/api/list").query({ prefix: p });
  expect(res.status).toBe(200);
  expect(res.body.files[0]).toMatchObject({ name: "cell_1.tiff", key: p + "cell_1.tiff", size: 1, date: "2026-10-06" });
});

test("follows pagination past one page", async () => {
  const objs = Object.fromEntries(Array.from({ length: 1500 }, (_, i) => [`${p}cell_${i}.tiff`, Buffer.from("x")]));
  const res = await request(createApp({ config, b2: fakeB2(objs, { pageSize: 1000 }) }))
    .get("/api/list")
    .query({ prefix: p });
  expect(res.body.files).toHaveLength(1500);
});

test("400 on prefix outside raw prefix", async () => {
  const res = await request(createApp({ config, b2: fakeB2({}) })).get("/api/list").query({ prefix: "other/" });
  expect(res.status).toBe(400);
});

test("thumb rejects a key outside the raw prefix", async () => {
  const images = async () => ({ body: Buffer.from("x"), contentType: "image/jpeg" as const });
  const res = await request(createApp({ config, b2: fakeB2({}), images })).get("/api/thumb").query({ key: "other/x.tif" });
  expect(res.status).toBe(400);
});

test("preview returns the rendered JPEG with a private cache header", async () => {
  const images = async () => ({ body: Buffer.from("jpeg"), contentType: "image/jpeg" as const });
  const res = await request(createApp({ config, b2: fakeB2({}), images }))
    .get("/api/preview")
    .query({ key: p + "cell_1.tiff" });
  expect(res.status).toBe(200);
  expect(res.headers["content-type"]).toBe("image/jpeg");
  expect(res.headers["cache-control"]).toBe("private, max-age=86400");
});

test("download streams exact bytes with the original filename", async () => {
  const key = "yeast/2026-10-07_miluda_5b_termo_b001/raw/Mil 5B 10^1_gold_1.tiff";
  const bytes = Buffer.from([0x49, 0x49, 0x2a, 0x00, 1, 2, 3]);
  const res = await request(createApp({ config, b2: fakeB2({ [key]: bytes }) }))
    .get("/api/download")
    .query({ key })
    .buffer(true)
    .parse((r, cb) => {
      const chunks: Buffer[] = [];
      r.on("data", (d: Buffer) => chunks.push(d));
      r.on("end", () => cb(null, Buffer.concat(chunks)));
    });
  expect(res.status).toBe(200);
  expect(res.headers["content-disposition"]).toContain('filename="Mil 5B 10^1_gold_1.tiff"');
  expect(Buffer.compare(res.body, bytes)).toBe(0);
});

test("download of a missing key is 404", async () => {
  const res = await request(createApp({ config, b2: fakeB2({}) }))
    .get("/api/download")
    .query({ key: "yeast/b/raw/none.tif" });
  expect(res.status).toBe(404);
});

test("production mode serves the built web app and keeps /api 404s as JSON", async () => {
  const webDist = await mkdtemp(path.join(os.tmpdir(), "b2gui-web-"));
  await writeFile(path.join(webDist, "index.html"), "<p>app</p>");
  const app = createApp({ config, b2: fakeB2({}), webDist });
  expect((await request(app).get("/")).text).toBe("<p>app</p>");
  expect((await request(app).get("/some/path")).text).toBe("<p>app</p>");
  const api = await request(app).get("/api/nope");
  expect(api.status).toBe(404);
  expect(api.body).toEqual({ error: "Not found" });
});

test("502 with short message when B2 fails", async () => {
  const res = await request(createApp({ config, b2: fakeB2({}, { fail: true }) }))
    .get("/api/list")
    .query({ prefix: "yeast/" });
  expect(res.status).toBe(502);
  expect(res.body).toEqual({ error: "B2 unavailable" });
});
