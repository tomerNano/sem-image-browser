# 10 — Registry metadata and filters

What was built: the server reads the Registry's `catalog/yeast/images.csv` and attaches one row to
each TIFF in a listing. The GUI shows the fields in new Details columns and in the preview pane, and
filters files by gold, instrument, detector and field width.

New files: `server/src/csv.ts`, `server/src/registry.ts`, `web/src/components/MetaFilters.tsx`.
Changed: `config.ts`, `listing.ts`, `app.ts`, `index.ts` (server); `types.ts`, `api.ts`, `store.ts`,
`lib/rows.ts`, `DetailsView`, `PreviewPane`, `StatusBar`, `FolderTree` (web).

## Where the data comes from

```
data-registry clone (git pull)  -->  images.csv  -->  server (Map by B2 key)  -->  /api/list  -->  browser
```

The Registry is a git repo (`Nanoscout/data-registry`, branch `v1`). Each row of `images.csv` has a
`b2_key` column, the exact B2 key of the raw TIFF, for example
`SEM-DATA/yeast/2026-10-12_miluda_5B_ns-lab_b001/raw/cell_284.tiff`. That is the join: no file name
guessing. A row can also have `image_key` (the preprocessed variant), so both files get the same row.

`magnification` is empty in every row. The scale number is the **field width** (`field_width_um`,
how many µm the image spans horizontally) and the **pixel size** (shown in nm).

## The source is an interface (compare: a Python `Protocol`)

```ts
export type RegistrySource = {
  name: string;
  load(since: string | null): Promise<{ version: string; text: string } | "unchanged">;
};
```

Today `createFileSource(path)` reads a local file. Its `version` is the file's modified time, so
`load` can answer `"unchanged"` after one cheap `stat` call instead of reading 1 MB every time.

`createGitHubSource(file, fetchFn)` fetches the same file from the GitHub API with a read-only
token, and uses the HTTP `ETag` as the version: the next request sends it as `If-None-Match`, and
GitHub answers "304 Not Modified" (no body, no rate-limit cost) until someone commits a new CSV.
`fetchFn` is a parameter so tests pass a fake (compare: injecting a `requests.Session` in Python).
Nothing else changes: `createRegistry` only knows the interface. This is the "seam" to show a reviewer.

## The registry: an in-memory index

`createRegistry(source, checkEveryMs)` returns three functions:

- `lookup(key)`: a `Map.get`, so it costs nothing per file.
- `refresh()`: asks the source at most once every 5 s. Two requests at the same moment share one
  load (`inFlight`), like a Python `asyncio` task that both callers await.
- `status()`: what `/api/registry` returns.

Failure rule: `refresh()` **never throws**. A missing or broken file keeps the last good data and
records the error. The registry is extra information; it must never break browsing or downloads.
The error is logged once, not on every request.

In `/api/list` the B2 listing and the registry check run side by side:

```ts
const [raw] = await Promise.all([b2.list(prefix), registry?.refresh()]);
```

(compare: `asyncio.gather`).

## A CSV parser in 40 lines

`csv.ts` handles the RFC 4180 rules: quoted fields with commas, `""` for a quote, and line breaks
inside quotes. A library (`csv-parse`) would also work; the in-house one avoids a dependency for a file
the pipeline controls, and its tests (`server/test/csv.test.ts`) cover each rule.

## Filters in the browser

The listing already carries `meta`, so filtering needs no new requests. In `store.ts`:

```ts
const [filters, setFilters] = createSignal<MetaFilters>(NO_FILTERS);
const visibleFiles = createMemo(() => folderFiles().filter((f) => matchesSearch(...) && matchesFilters(f.meta, filters())));
```

`createMemo` (compare: React `useMemo`, but without a dependency list) re-runs only when a signal it
read changes: the listing, the search text, the filters or the sort.

Rules (in `lib/rows.ts`, tested in `lib/filters.test.ts`):

- No filter set: every file shows, with or without metadata.
- Any filter set: files without metadata hide (same rule as the date filter and undated folders).
- Field width bounds are inclusive. Folders are never hidden by these filters.
- Filters stay set when you open another folder; the status bar says how many files they hide.
- Instrument and detector choices come from the files of the current folder.

## Turn it on

In `.env`: `REGISTRY_GITHUB_TOKEN=<fine-grained token, data-registry only, Contents: Read-only>`.
The server checks GitHub once a minute, so a new commit on `v1` shows up by itself.

For development without a token: `REGISTRY_CSV_PATH=<clone>/catalog/yeast/images.csv` (wins over the
token). Then `git pull` in the clone updates the data within 5 s. With neither variable the GUI
works as before and shows "—".
