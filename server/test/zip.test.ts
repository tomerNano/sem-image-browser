import { expect, test } from "vitest";
import { zipName } from "../src/zip.js";

test("zip name is the batch for a raw folder, else the folder itself", () => {
  expect(zipName("yeast/2026-10-06_b001/raw/")).toBe("2026-10-06_b001.zip");
  expect(zipName("yeast/2026-10-06_b001/")).toBe("2026-10-06_b001.zip");
  expect(zipName("raw/")).toBe("raw.zip");
});
