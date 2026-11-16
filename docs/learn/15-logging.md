# 15 — Server logging

What was built: one log line per meaningful event, so you can see what the server did and why
something was slow. Lines go to the console and to `logs/server.log` (gitignored).

New files: `server/src/log.ts`, `server/test/log.test.ts`.
Changed: `config.ts`, `index.ts`, `app.ts`, `b2.ts`, `images.ts`, `cache.ts`, `registry.ts`
(server); `api.ts`, `index.tsx`, `IconsView`, `PreviewPane`, `Viewer` (web).

## Reading a line

```
2026-11-16 16:54:47.495 INFO  [b6a348] GET /api/list?prefix=SEM-DATA%2Fyeast%2F 200 789 ms 2.3 KB
   time (local)          level  request  what happened
```

The request id ties lines together. Every B2 call, cache hit and render done for one request
carries that request's id, so `grep b6a348 logs/server.log` shows the whole story of one request.
Lines outside a request (startup, Registry reloads in the background) show `[------]`.

How the id travels: `requestLog` in `app.ts` runs the rest of the request inside
`withRequestId(id, ...)`. That uses Node's `AsyncLocalStorage`, which keeps a value attached to
everything the request starts, also after `await`. No function has to pass the id along.

## Levels

Set `LOG_LEVEL` in `.env` (default `info`). Set `LOG_FILE=off` for console only.

| Level | What you see |
|---|---|
| `debug` | Everything below, plus every B2 call (list, head, get, stream: ms, size, MB/s), every disk-cache hit, every reused HEAD answer, every render with its time split, the website's own files, Registry "unchanged" checks |
| `info` | Startup summary, one line per API request (status, ms, size), downloads and zips (size, seconds, cancelled), renders slower than 5 s, cache trimming, Registry loads (rows, filter groups) |
| `warn` | B2 failures, refused requests (unknown host, cross-site zip), images too large to preview, errors reported by the browser |
| `error` | Server errors (500, 502) with the full error and its cause, failed downloads, failed cache writes |

To investigate something slow, set `LOG_LEVEL=debug`, restart the server, repeat the action, and
read the lines with that request's id. A slow render line looks like:

```
INFO  [4f0a1c] Slow preview SEM-DATA/.../cell_3.tiff: rendered 74.9 MB source in 31200 ms (wait 0, download 30950, convert 250)
```

`wait` is time spent waiting for one of the 4 render slots, `download` the B2 download, `convert`
sharp.

## Browser errors

An image that fails to load, or a script error the page did not catch, is sent to
`POST /api/client-error` and logged as `WARN ... Browser: ...`. Each message is sent once per page.
The server accepts only same-site requests, at most 2 KB, cuts the message to 300 characters and
takes at most 60 reports a minute, so a broken page cannot flood the log.

## Safety

- Never logged: the B2 keys, the GitHub token, signed URLs. The startup summary names the Registry
  repository, not the token.
- Line breaks and control characters in a message become spaces, so text from a request (a key,
  a browser message) cannot write a fake log line.
- The log file has no size limit yet. On the company server, rotate it (or set `LOG_FILE=off` and
  let the service manager keep the console output).
