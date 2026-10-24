# Plan: Registry metadata in the GUI

Goal: show the Registry's per-image metadata (`catalog/yeast/images.csv`, repo `Nanoscout/data-registry`,
branch `v1`) in the GUI, and filter files by it. No GitHub token yet, so the server reads the CSV from a
local clone; a GitHub source can replace it later behind the same interface.

Decided with the user:
- Source now: local file at `REGISTRY_CSV_PATH` (optional env var). No copy of the CSV in this repo.
- Freshness: the server re-reads the file when its modified time changes (after `git pull` in the clone).
- No magnification (empty in all rows). Field width (µm) is the scale number instead.
- Filters: yes.

Claude's calls:
- Rows match files by `b2_key`, and also by `image_key` (preprocessed variant).
- `/api/list` adds `meta` (or `null`) to each file. One request, filters run in the browser.
- `GET /api/registry` reports status (loaded, row count, file time, error) for a small warning.
- Missing or broken file: the GUI keeps working, metadata shows "—", a warning shows in the status bar.
  A broken re-read keeps the last good data.
- Small CSV parser in-house (RFC 4180 quotes), no new dependency.
- Filters apply to files in the current folder: gold, instrument, detector, field width min/max.
- Details view: new columns Field width, Pixel size, Instrument, Detector, Gold (sortable).
- Preview pane: all fields, grouped.
- Annotations (masks) out of scope.

Steps:
1. `server/src/csv.ts` + test: parse CSV text into records.
2. `server/src/registry.ts` + test: `RegistrySource` interface, `createFileSource`, `createRegistry`
   (index by key, reload on change, status).
3. `config.ts`: optional `registryCsvPath`. `app.ts`: `meta` in listing, `/api/registry`. `index.ts` wiring.
4. Web: types, api, rows (filter + sort), store, Filters component, Details columns, Preview fields,
   status bar warning.
5. `.env.example`, README, `docs/learn/10-registry-metadata.md`.
6. Verify: server + web tests, build, run against the real CSV.
