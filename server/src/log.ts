// Server log: one line per event, to the console and (when set) a log file.
// Each line carries the local time, the level and the id of the request it belongs to, so every
// B2 call, cache hit and render of one request can be found by that id.
import { AsyncLocalStorage } from "node:async_hooks";

export type LogLevel = "debug" | "info" | "warn" | "error";

/** Lower numbers are more detailed; a line is written when its level is at least the chosen one. */
const LEVEL_ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

/** Shown instead of a request id for lines outside any request (startup, background reloads). */
const NO_REQUEST = "------";

/** Every line goes through `write`; startup passes one that prints and appends to the log file. */
export type LogOptions = { level: LogLevel; write: (line: string, level: LogLevel) => void };

let options: LogOptions = { level: "info", write: (line) => console.log(line) };
const requestContext = new AsyncLocalStorage<string>();

/**
 * Sets the level and where lines go. Called once at startup; tests pass their own `write`.
 *
 * Args:
 *   next: Minimum level and the function that writes one line.
 *
 * Returns:
 *   Nothing.
 */
export function configureLog(next: LogOptions): void {
  options = next;
}

/**
 * Runs `fn` so that every line it logs, also after an await, carries `id`.
 *
 * Args:
 *   id: Short request id.
 *   fn: The work done for that request.
 *
 * Returns:
 *   What `fn` returns.
 */
export function withRequestId<T>(id: string, fn: () => T): T {
  return requestContext.run(id, fn);
}

const pad = (n: number, width = 2) => String(n).padStart(width, "0");

/**
 * One log line: "2026-11-16 09:05:03.007 INFO  [a1b2c3] message". Line breaks and other control
 * characters become spaces, so text from a request (a key, a browser message) cannot forge a line.
 *
 * Args:
 *   time: When the event happened (local time is printed).
 *   level: The line's level.
 *   requestId: Id of the request, or null outside a request.
 *   message: The event.
 *
 * Returns:
 *   The formatted line, without a trailing newline.
 */
export function formatLine(time: Date, level: LogLevel, requestId: string | null, message: string): string {
  const date = `${time.getFullYear()}-${pad(time.getMonth() + 1)}-${pad(time.getDate())}`;
  const clock = `${pad(time.getHours())}:${pad(time.getMinutes())}:${pad(time.getSeconds())}.${pad(time.getMilliseconds(), 3)}`;
  const clean = message.replace(/[\u0000-\u001f\u007f]+/g, " ").trim();
  return `${date} ${clock} ${level.toUpperCase().padEnd(5)} [${requestId ?? NO_REQUEST}] ${clean}`;
}

function write(level: LogLevel, message: string): void {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[options.level]) return;
  options.write(formatLine(new Date(), level, requestContext.getStore() ?? null, message), level);
}

/** "TypeError: bad input", then the stack lines, then the same for each `cause`. */
function errorLines(err: unknown): string[] {
  const lines: string[] = [];
  let current: unknown = err;
  while (current) {
    const e = current as { name?: string; message?: string; stack?: string; cause?: unknown };
    const stack = (e.stack ?? "").split("\n").slice(1).map((l) => l.trim());
    lines.push(`${lines.length > 0 ? "caused by " : ""}${e.name ?? "Error"}: ${e.message ?? String(current)}`, ...stack);
    current = e.cause;
  }
  return lines;
}

export const log = {
  debug: (message: string) => write("debug", message),
  info: (message: string) => write("info", message),
  warn: (message: string) => write("warn", message),
  /** With an error: its name and message on the first line, then one line per stack frame. */
  error: (message: string, err?: unknown) => {
    if (err === undefined) {
      write("error", message);
      return;
    }
    const [first, ...rest] = errorLines(err);
    write("error", `${message}: ${first}`);
    for (const line of rest) write("error", `    ${line}`);
  },
};

/**
 * Bytes as short text for log lines: "512 B", "12.3 KB", "2.3 MB".
 *
 * Args:
 *   bytes: A size in bytes.
 *
 * Returns:
 *   The size with a unit.
 */
export function sizeText(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
