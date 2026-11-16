import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import request from "supertest";
import { expect, test } from "vitest";
import { createApp } from "../src/app.js";
import { createRegistry } from "../src/registry.js";
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

test("preview returns the rendered JPEG with a no-store cache header", async () => {
  const images = async () => ({ body: Buffer.from("jpeg"), contentType: "image/jpeg" as const });
  const res = await request(createApp({ config, b2: fakeB2({}), images }))
    .get("/api/preview")
    .query({ key: p + "cell_1.tiff" });
  expect(res.status).toBe(200);
  expect(res.headers["content-type"]).toBe("image/jpeg");
  expect(res.headers["cache-control"]).toBe("no-store");
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

test("every response carries the security headers", async () => {
  const webDist = await mkdtemp(path.join(os.tmpdir(), "b2gui-web-"));
  await writeFile(path.join(webDist, "index.html"), "<p>app</p>");
  const app = createApp({ config, b2: fakeB2({}), webDist });
  for (const url of ["/", "/api/root", "/api/nope"]) {
    const res = await request(app).get(url);
    expect(res.headers["content-security-policy"]).toContain("default-src 'self'");
    expect(res.headers["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-frame-options"]).toBe("DENY");
  }
});

test("502 with short message when B2 fails", async () => {
  const res = await request(createApp({ config, b2: fakeB2({}, { fail: true }) }))
    .get("/api/list")
    .query({ prefix: "yeast/" });
  expect(res.status).toBe(502);
  expect(res.body).toEqual({ error: "B2 unavailable" });
});

test("listing adds Registry metadata by key, null for unknown files", async () => {
  const csv = `image_id,b2_key,gold,field_width_um\nimg_1,${p}cell_1.tiff,true,100\n`;
  const registry = createRegistry({ name: "memory", load: async () => ({ version: "1", text: csv }) }, 0);
  const b2 = fakeB2({ [p + "cell_1.tiff"]: Buffer.from("x"), [p + "cell_2.tiff"]: Buffer.from("x") });
  const res = await request(createApp({ config, b2, registry })).get("/api/list").query({ prefix: p });
  expect(res.body.files[0].meta).toMatchObject({ imageId: "img_1", gold: "true", fieldWidthUm: 100 });
  expect(res.body.files[1].meta).toBeNull();
});

test("a broken Registry never breaks the listing, and /api/registry reports it", async () => {
  const registry = createRegistry({ name: "memory", load: async () => Promise.reject(new Error("down")) }, 0);
  const app = createApp({ config, b2: fakeB2({ [p + "cell_1.tiff"]: Buffer.from("x") }), registry });
  const list = await request(app).get("/api/list").query({ prefix: p });
  expect(list.status).toBe(200);
  expect(list.body.files[0].meta).toBeNull();
  const status = await request(app).get("/api/registry");
  expect(status.body).toMatchObject({ configured: true, loaded: false, error: "down" });
});

test("rejects requests for any other host name (DNS rebinding)", async () => {
  const app = createApp({ config, b2: fakeB2({}) });
  const blocked = await request(app).get("/api/root").set("Host", "attacker.example:3000");
  expect(blocked.status).toBe(403);
  expect(blocked.body).toEqual({ error: "Host not allowed" });
  // The Vite dev proxy forwards the browser's host and port unchanged.
  for (const host of ["localhost:5173", "127.0.0.1:3000", "[::1]:3000"]) {
    expect((await request(app).get("/api/root").set("Host", host)).status).toBe(200);
  }
});

/** Supertest parser that keeps a binary body as one Buffer. */
const binary = (r: NodeJS.ReadableStream, cb: (err: Error | null, body: Buffer) => void) => {
  const chunks: Buffer[] = [];
  r.on("data", (d: Buffer) => chunks.push(d));
  r.on("end", () => cb(null, Buffer.concat(chunks)));
};

const zipForm = (keys: string[]) => keys.map((k) => `key=${encodeURIComponent(k)}`).join("&");

test("zip download streams the chosen files of one folder with an exact Content-Length", async () => {
  const batch = "yeast/2026-10-06_b_ns-lab_b001/raw/";
  const one = Buffer.from("first-tiff-bytes");
  const two = Buffer.from("second-tiff-bytes");
  const b2 = fakeB2({ [batch + "cell_1.tiff"]: one, [batch + "cell 2.tiff"]: two, [batch + "cell_3.tiff"]: Buffer.from("no") });
  const res = await request(createApp({ config, b2 }))
    .post("/api/download-zip")
    .type("form")
    .send(zipForm([batch + "cell_1.tiff", batch + "cell 2.tiff", batch + "cell_1.tiff"]))
    .buffer(true)
    .parse(binary);
  expect(res.status).toBe(200);
  expect(res.headers["content-type"]).toBe("application/zip");
  expect(res.headers["content-disposition"]).toContain("filename=2026-10-06_b_ns-lab_b001.zip");
  expect(Number(res.headers["content-length"])).toBe(res.body.length);
  const body: Buffer = res.body;
  expect(body.subarray(0, 4)).toEqual(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
  expect(body.includes(one)).toBe(true);
  expect(body.includes(two)).toBe(true);
  expect(body.includes("cell 2.tiff")).toBe(true);
  expect(body.includes("cell_3.tiff")).toBe(false);
});

test("zip download refuses keys from two folders, too many keys, and no keys", async () => {
  const app = createApp({ config, b2: fakeB2({}) });
  const post = (form: string) => request(app).post("/api/download-zip").type("form").send(form);
  expect((await post(zipForm(["yeast/a/raw/x.tiff", "yeast/b/raw/y.tiff"]))).body).toEqual({
    error: "All files must be in one folder",
  });
  const many = Array.from({ length: 1001 }, (_, i) => `yeast/a/raw/cell_${i}.tiff`);
  expect((await post(zipForm(many))).status).toBe(400);
  expect((await post("")).status).toBe(400);
  expect((await post(zipForm(["other/x.tiff"]))).status).toBe(400);
});

test("zip download of a missing file is 404 before any byte is sent", async () => {
  const b2 = fakeB2({ [p + "cell_1.tiff"]: Buffer.from("x") });
  const res = await request(createApp({ config, b2 }))
    .post("/api/download-zip")
    .type("form")
    .send(zipForm([p + "cell_1.tiff", p + "gone.tiff"]));
  expect(res.status).toBe(404);
});

test("zip download refuses a form posted from another website", async () => {
  const b2 = fakeB2({ [p + "cell_1.tiff"]: Buffer.from("x") });
  const res = await request(createApp({ config, b2 }))
    .post("/api/download-zip")
    .set("Sec-Fetch-Site", "cross-site")
    .type("form")
    .send(zipForm([p + "cell_1.tiff"]));
  expect(res.status).toBe(403);
});

test("listing adds split tags to root folders", async () => {
  const registry = createRegistry(null, 0, { name: "tags", load: async () => ({ version: "1", text: "split,tag\n2026-10-06_b_ns-lab_b001,10-3\n" }) });
  const b2 = fakeB2({ "yeast/2026-10-06_b_ns-lab_b001/raw/cell_1.tiff": Buffer.from("x") });
  const res = await request(createApp({ config, b2, registry })).get("/api/list").query({ prefix: "yeast/" });
  expect(res.body.folders[0].tags).toEqual(["10-3"]);
});
