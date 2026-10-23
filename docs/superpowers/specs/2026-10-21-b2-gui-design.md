# B2 GUI — Design (MVP)

Date: 2026-10-21. Author: Tomer (with Claude). Status: approved 2026-10-23.

## 1. Intent and why

NanoScout ingests yeast SEM images into a Backblaze B2 bucket with the `new-data-pipeline` CLI
(`C:\Users\User\Desktop\new-data-pipeline`). Today only the pipeline operator can reach those
images. Biologists cannot see them at all.

The B2 GUI is a web app that lets a biologist **browse, look at, find by date, and download** the
ingested images, with a UI as easy as Windows File Explorer.

A second goal is learning: the operator (Tomer) wants to learn **SolidJS** (frontend) and
**Node.js** (backend) by having Claude build each part and explain it.

## 2. Goals, non-goals, anti-goals

### Goals (MVP)

- Browse the bucket like Explorer: folder tree, address bar, file area, preview pane, status bar.
- Two file-area views with a toggle: **Large icons** (thumbnails) and **Details** (sortable list).
- Preview an image (converted from TIFF to a browser format) and open a full-screen zoomable viewer.
- Filter batch folders by date range; search file names in the current folder.
- Download one original TIFF at a time.
- MVP runs on localhost on the operator's PC, built so it can move to a company server without a rewrite.

### Non-goals (MVP; planned later)

- Authentication. Later: sign-in only with the company Google Workspace account.
- Security hardening. Later: designed and built together with a senior engineer, because this
  is the company's most valuable data.
- Registry catalog data (`catalog/yeast/images.csv`): magnification, pixel size, Split, gold,
  dimensions. Later: Details columns and filters from the catalog.
- Folder (ZIP) download and multi-select download. Annotations/labels overlay, Dataset views.
- Deploying to the server (which server, HTTPS, domain). Later, together with the security work.

### Anti-goals (a failure even if it works)

- Any write, delete, copy, or move on B2. The app is strictly read-only.
- B2 credentials reaching the browser (no keys in frontend code, no presigned URLs handed out).
- A design that makes later Google sign-in or security work hard to bolt on.
- A UI a biologist needs training to use.
- A design tied to the operator's PC (Windows paths, manual steps) that cannot move to a server.

## 3. Users and usage

- MVP user: only Tomer, on his own PC, on localhost (demo to biologists).
- Later users: company biologists. The app runs on a central company server; biologists open it
  in a browser from their own computers, signed in with company Google accounts. Nothing is
  installed on biologist computers, and they never hold B2 credentials.
- Typical task: open a batch from a given date, look at cells, download one TIFF.

## 4. Data source (B2 only for MVP)

### Bucket layout (from `new-data-pipeline/docs/FILE_FORMATS.md`)

```
<raw_prefix>/                                   raw_prefix = "yeast" (configurable)
  <acquisition_id>/                             batch: YYYY-MM-DD_<experiment>_<source>_bNNN
    raw/<original_filename>                     original TIFF (.tif / .tiff)
    raw/.cache/<stem>.thumbnail.png             optional small thumbnail (ns-lab batches only)
    raw/.cache/<stem>.png                       optional full-size PNG (ns-lab batches only)
    raw/.cache/...                              other non-image files (e.g. scan_results_map.json)
    preprocessing/<variant>/<original_filename> externally processed TIFF
    preprocessing/<variant>/processing.json     description of the processing
    preprocessing/<variant>/manifest.csv        image_id,filename,sha256
```

Real batch names seen: `2026-10-06_miluda_5_ns-lab_b001`, `2026-08-30_miluda_4_termo_b001`.
ns-lab batches carry `.cache` PNGs; termo batches have none. Original filenames can contain spaces
and `^` (e.g. `Mil 5B 10^1_gold_1.tiff`).

### Folder tree shown to the user

```
yeast
  <batch>            (newest date first)
    raw              (TIFF files only)
    preprocessing
      <variant>      (TIFF files only)
```

- `.cache/` is hidden everywhere (like hidden files in Explorer).
- Only image files (`.tif`, `.tiff`, case-insensitive) appear in the file area.
  `processing.json` and `manifest.csv` are hidden in MVP.
- Batch folders whose name does not start with `YYYY-MM-DD_` still appear, sorted after dated ones,
  with an empty Date column.

### Per-file data (Details view columns)

| Column | Source |
|---|---|
| Name | object key, last segment |
| Date | acquisition date parsed from the batch folder name |
| Size | B2 `Size` |
| Uploaded | B2 `LastModified` |

Sorting: click a column header; click again to reverse. Default: Name, natural order
(`cell_2` before `cell_10`).

## 5. UI

Mockup (option C chosen: both views with a toggle): Explorer layout with folder tree left, address
bar top, file area middle, preview pane right, status bar bottom.

- **Top bar:** Back, Up, address bar with clickable path parts, name search box (filters the
  current folder only, case-insensitive substring), view toggle (Large icons / Details).
- **Left:** folder tree, lazy-loaded per folder on expand. Above it: From/To date pickers; batch
  folders outside the range are hidden. Empty From or To = open-ended.
- **Middle:**
  - Large icons: grid of thumbnails with file names. A placeholder shows until a thumbnail loads.
  - Details: table with the columns above.
  - Folders appear before files in both views; double-click a folder to open it.
- **Right:** preview pane for the selected file: preview image, name, date, size, Download button.
  With a folder (or nothing) selected: folder name and item count only (no download).
- **Bottom:** status bar, "N items | M selected".
- **Double-click an image:** full-screen viewer, mouse-wheel zoom, drag to pan, Esc to close,
  left/right arrows for previous/next image in the folder.
- Selection: single click selects one item (no multi-select in MVP).
- Large folders: real batches hold hundreds of images (one ns-lab batch had about 180). The file
  area must stay responsive at 1,000 items; thumbnails load lazily as they scroll into view.

## 6. Architecture

```
Browser (SolidJS, Vite dev server :5173)
   |  /api/* (Vite proxy)
   v
Node + Express 5 (:3000, bound to 127.0.0.1)  ---- S3 API ---->  Backblaze B2 (read-only key)
   |
   v
local disk cache (thumbnails / previews)
```

All B2 access goes through the backend. The browser never sees credentials or B2 URLs.

### Server-ready from day one

The target is a central company server (likely Linux, not yet chosen). The MVP runs on the
operator's PC but follows these rules so moving it is a configuration change, not a rewrite:

- Two modes. **Dev:** `npm run dev` runs the Vite dev server and Express with the `/api` proxy.
  **Production:** `npm run build` then `npm start` runs one Node process on one port; Express
  serves the built frontend (`web/dist`) and `/api`.
- All configuration comes from environment variables (`.env` locally, real environment on the
  server). Nothing is hard-coded to this PC.
- Paths are built with `path.join` and are relative to the app or set by `CACHE_DIR`; no Windows
  drive letters, no backslashes. Works on Windows and Linux.
- `HOST` defaults to `127.0.0.1`. Binding to other addresses happens only on the server, after
  Google sign-in exists.
- The only server state is the disk cache, which can be deleted at any time.

### Repository layout

```
b2-GUI/
  package.json          npm workspaces: server, web; "dev" script runs both
  .env                  gitignored; .env.example committed
  server/               Node + Express + TypeScript
  web/                  Vite + SolidJS + TypeScript
  docs/learn/           short learning notes, one per built part
  docs/superpowers/specs/
```

`b2-GUI` is not a Git repository yet; the first build step runs `git init` and adds a
`.gitignore` (`node_modules/`, `.env`, cache folder, `dist/`, `.superpowers/`).

### Tech stack (Claude's calls, accepted by Tomer)

- TypeScript on both sides.
- Frontend: Vite + SolidJS + plain CSS, no component library. Uses signals, `createResource`,
  `<For>`, `<Show>`.
- Backend: Node 22 LTS or newer, Express 5, `@aws-sdk/client-s3` (v3), `sharp` (TIFF to JPEG),
  `dotenv`.
- Tests: Vitest, only for backend pure logic (key validation, batch-date parsing, tree mapping,
  natural sort). No UI tests in MVP.

### Configuration (`.env`)

```
AWS_ACCESS_KEY_ID=...            same names as new-data-pipeline
AWS_SECRET_ACCESS_KEY=...
B2_ENDPOINT_URL=https://s3.eu-central-003.backblazeb2.com
B2_REGION=eu-central-003
B2_BUCKET=...
B2_RAW_PREFIX=yeast
HOST=127.0.0.1                   server later sets its own value
PORT=3000
CACHE_DIR=./.cache-images
```

Use the dedicated **read-only** B2 application key (Tomer already has one). Never use the pipeline key.
The server refuses to start if a required variable is missing.

### API

All endpoints are `GET`. `key` / `prefix` are full object keys/prefixes inside the bucket.

| Endpoint | Returns |
|---|---|
| `/api/list?prefix=<p>` | `{ folders: [{name, prefix, date}], files: [{name, key, size, uploaded, date}] }` for one level (S3 `ListObjectsV2` with `Delimiter="/"`, all pages). `.cache/` and non-TIFF files filtered out. |
| `/api/thumb?key=<k>` | JPEG, about 256 px on the long side |
| `/api/preview?key=<k>` | JPEG, about 1600 px on the long side (preview pane and viewer) |
| `/api/download?key=<k>` | original TIFF bytes, streamed, `Content-Disposition: attachment` |

Rules for every endpoint:

- `key`/`prefix` must start with `B2_RAW_PREFIX + "/"`, contain no `..`, no backslash, and no
  leading `/`. Otherwise `400`.
- Missing object: `404`. B2 error: `502` with a short message; full error in the server log.
- Each request logs method, path, status, duration.
- One Express middleware slot runs before all `/api` routes. In MVP it does nothing; later it holds
  Google sign-in checks.

### Thumbnail and preview pipeline

For `raw/<stem>.<ext>`:

1. Thumbnail: if `raw/.cache/<stem>.thumbnail.png` exists in B2, serve it (as-is PNG). Preview:
   if `raw/.cache/<stem>.png` exists, resize it to preview size and serve JPEG.
2. Otherwise download the TIFF, convert with `sharp`: first page only, convert to 8-bit with an
   auto-contrast stretch (needed for 16-bit SEM images that would look black), resize, JPEG.
3. Store the result in `CACHE_DIR`, keyed by object key + size class + B2 ETag. Later requests
   serve from disk. No cache eviction in MVP.

Variant files (`preprocessing/<variant>/...`) have no `.cache`, so they always use step 2.
Concurrent conversions are limited (about 4) so opening a large folder does not exhaust memory.

The original TIFF is never changed; download always serves the original bytes.

## 7. Learning approach

- Claude builds each part, then explains it in chat: what it does, why, and how the Solid or Node
  idea differs from React or Python.
- Each part gets a short note in `docs/learn/` (for example `01-express-server.md`,
  `02-solid-signals.md`).
- Build order should give an early visible result (list one folder in the browser) before polish.

## 8. Verification

- Early check on a real B2 file from a termo batch (no `.cache`) and an ns-lab batch: thumbnail and
  preview look right, not black.
- Manual walkthrough: browse to a batch, toggle views, sort, search, date filter, open viewer,
  download one TIFF (bytes equal to the B2 object).
- Vitest for backend pure logic only.

## 9. Later (not MVP, kept in mind)

- Google Workspace sign-in (company domain only), session handling, audit log of downloads.
- Security review and hardening with a senior engineer.
- Catalog columns and filters from the Registry `images.csv`.
- Folder download as a streamed ZIP (needs a rule for batch level, where TIFFs sit in sub-folders,
  and a block at the `yeast` root).
- Deployment on the company server (server choice, HTTPS, domain, process manager).

## 10. Left to the builder

- Exact component split, CSS, icons, and colors (Explorer-like, Segoe UI).
- Cache folder structure and file naming.
- Thumbnail and preview exact sizes and JPEG quality.
- Library versions (current stable at build time).
- Frontend routing (whether the current folder appears in the browser URL).
