import { afterEach, expect, test } from "vitest";
import { configureLog, formatLine, log, withRequestId } from "../src/log.js";

let lines: string[] = [];

afterEach(() => configureLog({ level: "info", write: () => {} }));

/** Send log lines to `lines` at the given level. */
function capture(level: "debug" | "info" | "warn" | "error") {
  lines = [];
  configureLog({ level, write: (line) => lines.push(line) });
}

test("a line has the local time, the level, the request id and the message", () => {
  const time = new Date(2026, 10, 16, 9, 5, 3, 7);
  expect(formatLine(time, "info", "a1b2c3", "GET /api/list 200")).toBe(
    "2026-11-16 09:05:03.007 INFO  [a1b2c3] GET /api/list 200",
  );
  expect(formatLine(time, "warn", null, "x")).toBe("2026-11-16 09:05:03.007 WARN  [------] x");
});

test("line breaks and control characters in a message cannot start a fake log line", () => {
  const time = new Date(2026, 10, 16);
  expect(formatLine(time, "info", null, "bad\nINFO forged\r\u0007")).toContain("bad INFO forged");
});

test("lines below the chosen level are dropped", () => {
  capture("info");
  log.debug("detail");
  log.info("event");
  expect(lines).toHaveLength(1);
  expect(lines[0]).toContain("event");
});

test("lines written inside withRequestId carry that id, also after an await", async () => {
  capture("debug");
  await withRequestId("abc123", async () => {
    await new Promise((resolve) => setTimeout(resolve, 1));
    log.debug("inside");
  });
  log.info("outside");
  expect(lines[0]).toContain("[abc123] inside");
  expect(lines[1]).toContain("[------] outside");
});

test("an error line adds the error's name, message and stack", () => {
  capture("info");
  log.error("Render failed", new TypeError("bad input"));
  expect(lines[0]).toContain("Render failed: TypeError: bad input");
  expect(lines[1]).toContain("at ");
});
