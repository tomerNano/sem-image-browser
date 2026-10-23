# NanoScout B2 GUI

A web app, styled like Windows File Explorer, for browsing the yeast SEM images that
`new-data-pipeline` ingests into Backblaze B2: folder tree, Large icons and Details views, date
filter, name search, preview pane, full-screen viewer, and download of the original TIFF.

**Not secured yet.** There is no sign-in. Run it on `127.0.0.1` only (the default). Company Google
sign-in and a security review come before it runs anywhere else.

## Setup

Requires Node.js 22 or newer.

```bash
npm install
cp .env.example .env
```

Fill `.env` with the **read-only** B2 application key (never the pipeline's key), the bucket, and
`B2_RAW_PREFIX` (the folder that holds the batches, for example `SEM-DATA/yeast`). `.env` is gitignored.

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

Server tests:

```bash
npm -w server test
```

## Layout

- `server/`: Node + Express 5 + TypeScript. The only part that talks to B2, with read-only S3
  commands. `src/app.ts` (routes), `b2.ts` (B2 client), `keys.ts` (path rules), `listing.ts`,
  `images.ts` + `convert.ts` + `cache.ts` + `limit.ts` (thumbnails and previews), `config.ts`.
- `web/`: Vite + SolidJS + TypeScript. `src/store.ts` (app state), `src/api.ts`, `src/components/`.
- `docs/learn/`: short notes explaining each part (Solid and Node ideas compared with React and Python).
- `docs/superpowers/specs/`: the design. `.claude/plans/`: the build plan.

## API

All `GET`, all keys must sit under `B2_RAW_PREFIX`:

| Endpoint | Returns |
|---|---|
| `/api/root` | `{ prefix, name }` where browsing starts |
| `/api/list?prefix=` | folders and TIFF files of one folder |
| `/api/thumb?key=` | thumbnail (pipeline `.cache` PNG, or JPEG converted from the TIFF) |
| `/api/preview?key=` | JPEG, about 1600 px |
| `/api/download?key=` | the original TIFF |

Converted images are cached in `CACHE_DIR` (default `.cache-images/`); the folder can be deleted at
any time.
