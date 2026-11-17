# NanoScout B2 GUI

A web app, styled like Windows File Explorer, for browsing the yeast SEM images that
`new-data-pipeline` ingests into Backblaze B2.

- Folder tree, Large icons and Details views, 200 items per page, name search.
- Preview pane and full-screen viewer with zoom, pan and an SEM-style data bar (scale bar, field
  width, voltage, working distance, pixel size). A "Preparing preview" label with the original's
  size and the seconds waited shows while a large preview is being made.
- Download of the original TIFF, or several images of one folder as one zip.
- Registry metadata per image (field width, pixel size, resolution, instrument, detector, gold, ...),
  with filters. At the top level the filters hide splits that have no matching image and show
  "N of M match".
- Split tags from the Registry as pills; filter splits by one or more tags.

**Not secured yet.** There is no sign-in. The server refuses to start on anything but a loopback
address (`127.0.0.1`, the default). Company Google sign-in and a security review come before it
runs anywhere else.

## Setup

Requires Node.js 22 or newer.

```bash
npm install
cp .env.example .env
```

Fill `.env` with the **read-only** B2 application key (never the pipeline's key), the bucket, and
`B2_RAW_PREFIX` (the folder that holds the batches, for example `SEM-DATA/yeast`). `.env` is gitignored.

Optional: set `REGISTRY_GITHUB_TOKEN` to a fine-grained GitHub token with access to
`Nanoscout/data-registry` only and the permission Contents: Read-only. The server then reads
`catalog/yeast/images.csv` and `split_tags.csv` next to it (branch `main`) from GitHub and checks for
new commits once a minute. No clone and no `git pull` needed. For development, `REGISTRY_CSV_PATH` can
point at `images.csv` in a local clone instead (it wins over the token). Without either variable,
everything else works; metadata shows "—" and the filters and tags are empty.

### Settings (`.env`)

| Variable | Default | Meaning |
|---|---|---|
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | required | Read-only B2 application key |
| `B2_ENDPOINT_URL`, `B2_REGION`, `B2_BUCKET` | required | B2 S3 endpoint, region and bucket |
| `B2_RAW_PREFIX` | `yeast` | Folder that holds the batches (splits) |
| `HOST`, `PORT` | `127.0.0.1`, `3000` | Loopback only until sign-in exists |
| `CACHE_DIR`, `CACHE_MAX_MB` | `.cache-images`, `2048` | Disk cache for thumbnails and previews, and its size limit |
| `REGISTRY_GITHUB_TOKEN` or `REGISTRY_CSV_PATH` | none | Registry source (see above) |
| `LOG_LEVEL` | `info` | `debug`, `info`, `warn` or `error` |
| `LOG_FILE` | `logs/server.log` | Log file; `off` = console only |

## Run

Development (hot reload; open http://localhost:5173):

```bash
npm run dev
```

Production (one process, one port; open http://127.0.0.1:3000):

```bash
npm run build
npm start
```

Tests:

```bash
npm -w server test
npm -w web test
```

## Caching

- **Server disk cache** (`CACHE_DIR`): every thumbnail and preview the server makes, shared by all
  users, kept across restarts. Above `CACHE_MAX_MB` the least used files are removed. File names
  include the B2 ETag, so a changed original is never served stale. The folder can be deleted at
  any time.
- **Server memory**: B2 HEAD answers for 5 minutes; the Registry (checked once a minute).
- **Browser**: thumbnails and previews for 1 day (`private`); folder listings for 30 seconds.
- Original TIFFs and zips are never cached; they stream from B2 through the server.

## Logging

One line per event, to the console and `LOG_FILE`:

```
2026-11-16 16:54:47.495 INFO  [b6a348] GET /api/list?prefix=SEM-DATA%2Fyeast%2F 200 789 ms 2.3 KB
```

The 6-character request id ties together every line of one request (its B2 calls, cache hits,
renders). `LOG_LEVEL=debug` adds every B2 call with time and speed, every cache hit, and each
render split into wait, download and convert. Keys, tokens and signed URLs are never logged.
The log file has no rotation yet. Details: `docs/learn/15-logging.md`.

## Layout

- `server/`: Node + Express 5 + TypeScript. The only part that talks to B2, with read-only S3
  commands. `src/app.ts` (routes), `b2.ts` (B2 client), `keys.ts` (path rules), `listing.ts`,
  `images.ts` + `convert.ts` + `cache.ts` + `limit.ts` (thumbnails and previews), `zip.ts`,
  `config.ts`, `registry.ts` + `csv.ts` (Registry metadata, split tags, filter groups), `log.ts`.
- `web/`: Vite + SolidJS + TypeScript. `src/store.ts` (app state), `src/api.ts`,
  `src/lib/fields.ts` (every image property: columns, sort, filters, preview), `src/components/`.
- `docs/learn/`: short notes explaining each part (Solid and Node ideas compared with React and Python).
- `docs/superpowers/specs/`: the designs. `.claude/plans/`: the build plans.

## API

Every key and prefix must sit under `B2_RAW_PREFIX`.

| Endpoint | Returns |
|---|---|
| `GET /api/root` | `{ prefix, name }` where browsing starts |
| `GET /api/list?prefix=` | folders and TIFF files of one folder; files carry Registry `meta` (or `null`), folders and files carry split `tags` |
| `GET /api/split-groups` | Registry images counted by split and filter values, for the top-level filters (ETag, 304 when unchanged) |
| `GET /api/registry` | `{ configured, loaded, rows, version, error }` of the Registry metadata |
| `GET /api/thumb?key=` | thumbnail (pipeline `.cache` PNG, or JPEG converted from the TIFF) |
| `GET /api/preview?key=` | JPEG, about 1600 px |
| `GET /api/download?key=` | the original TIFF |
| `POST /api/download-zip` | form fields `key` (one folder, at most 1000): a stored zip of the originals; same-site only |
| `POST /api/client-error` | JSON `{ message }`: an error the browser saw, logged as a warning; same-site only, 2 KB, 60 a minute |

## Security notes for review

- Read-only B2 key; the B2 client imports only list, head and get commands.
- Requests with an unknown `Host` header are refused (blocks DNS rebinding); add the server's domain
  to `ALLOWED_HOSTS` in `app.ts` when it is deployed.
- Content-Security-Policy and other hardening headers on every response.
- Sign-in slot (`authSlot` in `app.ts`) is empty: no authentication yet.
