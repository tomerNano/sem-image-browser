import sharp from "sharp";
import { expect, test } from "vitest";
import { toJpeg } from "../src/convert.js";
import { tiff16 } from "./tiff16.js";

/** A dark 16-bit SEM-like frame: background ~800-1100, one bright cell up to 5000 (of 65535). */
function darkSem(w: number, h: number): Buffer {
  const px = new Uint16Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const d = Math.hypot(x - w / 2, y - h / 2);
      px[y * w + x] = d < h / 4 ? 2500 + Math.round((1 - d / (h / 4)) * 2500) : 800 + ((x + y) % 300);
    }
  }
  return tiff16(px, w, h);
}

test("16-bit dark TIFF becomes a full-contrast JPEG, not black", async () => {
  const jpeg = await toJpeg(darkSem(400, 300), 256);
  const meta = await sharp(jpeg).metadata();
  expect(meta.format).toBe("jpeg");
  expect(Math.max(meta.width!, meta.height!)).toBe(256);
  const stats = await sharp(jpeg).stats();
  expect(stats.channels[0].max).toBeGreaterThan(200);
  expect(stats.channels[0].mean).toBeGreaterThan(20);
});

test("never enlarges a small image", async () => {
  const jpeg = await toJpeg(darkSem(100, 80), 1600);
  expect((await sharp(jpeg).metadata()).width).toBe(100);
});
