# B2 GUI MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A localhost web app, as easy as Windows Explorer, that lets biologists browse, preview, date-filter and download the yeast SEM TIFFs stored in Backblaze B2.

**Architecture:** Node + Express 5 backend is the only thing that talks to B2 (read-only key, S3 API); it lists folders, converts TIFFs to JPEG with `sharp` (disk-cached), and streams original TIFFs. A Vite + SolidJS frontend renders the Explorer layout and calls `/api/*` (Vite proxy in dev; same process in production).

**Tech Stack:** TypeScript (ESM) everywhere, Node 22+ (installed: 24), npm workspaces, Express 5, `@aws-sdk/client-s3` v3, `sharp`, `dotenv`, Vitest + `supertest`, `tsx`, `concurrently`, Vite, `solid-js`, `vite-plugin-solid`.

**Spec:** `docs/superpowers/specs/2026-10-21-b2-gui-design.md`

## Global Constraints

- Read-only on B2: `server/src/b2.ts` imports only `ListObjectsV2Command`, `HeadObjectCommand`, `GetObjectCommand`. No Put/Delete/Copy anywhere.
- B2 credentials never reach the browser: no keys in `web/`, no presigned URLs, no B2 hostnames in API responses.
- Every `key`/`prefix` query value must start with `B2_RAW_PREFIX + "/"`, contain no `..` segment, no `\`, no leading `/`; otherwise `400`.
- Status codes: bad input `400`, missing object `404`, any other B2 failure `502` with a short message; full error only in the server log.
- Config only from environment (`.env` at repo root via `dotenv`, real env on a server). Required: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `B2_ENDPOINT_URL`, `B2_REGION`, `B2_BUCKET`. Defaults: `B2_RAW_PREFIX=yeast`, `HOST=127.0.0.1`, `PORT=3000`, `CACHE_DIR=./.cache-images` (relative to repo root).
- Paths via `path.join` / `fileURLToPath`; no drive letters or backslashes. Must run on Windows and Linux.
- Only `.tif`/`.tiff` (case-insensitive) files are listed; `.cache/` folders are never listed.
- Thumbnail about 256 px long side; preview about 1600 px long side; at most 4 concurrent `sharp` conversions.
- Original TIFF bytes are never modified; download streams them unchanged.
- One no-op auth middleware runs before every `/api` route (future Google sign-in slot).
- Tests: Vitest for backend only. No UI tests. Plan call beyond the spec's "pure logic only": route tests with an in-memory fake B2 (no network), because they pin the 400/404/502 and read-only rules. Run only the test file of the current task (`npm -w server test -- <file>`).
- Learning: each task ends with a short note `docs/learn/NN-<topic>.md` (what was built, the key Solid/Node idea, how it differs from React/Python) and a chat explanation of the same.
- Git: commit locally per task; never `git push`; never `git add -f`.
- English only in code, comments and logs.

## Review Focus

1. Filenames with spaces and `^` (`Mil 5B 10^1_gold_1.tiff`): keys must survive URL encoding both ways, and the download filename must be exact. Tests in Task 2 (key validation) and Task 7 (`Content-Disposition`).
2. 16-bit SEM TIFFs rendering almost black: conversion must auto-stretch contrast. Real-file check in Task 6 on a termo batch (no `.cache`) and an ns-lab batch.
3. A folder with more than 1,000 objects (one `ListObjectsV2` page): listing must follow continuation tokens. Test in Task 3 with a fake B2 that returns two pages.
4. B2 unreachable or bad credentials: API returns `502`, UI shows a readable error in the file area instead of an empty folder. Test in Task 3; UI in Task 4.
5. Batch folder name without a `YYYY-MM-DD_` date: still listed, sorted after dated batches, empty Date, and hidden only while a date range is set. Tests in Task 2; filter in Task 5.

---

## File Structure

```
b2-GUI/
  package.json                 workspaces ["server","web"]; scripts dev, build, start
  .gitignore  .env.example  README.md
  .claude/CONTEXT.md           project overview (user rule)
  docs/learn/NN-*.md           learning notes
  server/
    package.json  tsconfig.json  vitest.config.ts
    src/
      config.ts      loadConfig(env) -> Config
      errors.ts      HttpError
      keys.ts        key/prefix validation, batch date, TIFF check, .cache source keys, name compare
      listing.ts     mapListing(): raw S3 listing -> ListResult (pure)
      b2.ts          B2 interface + createB2(config) (read-only S3 client)
      limit.ts       createLimiter(n)
      cache.ts       createDiskCache(dir), cacheName()
      convert.ts     toJpeg(buffer, maxSide)
      images.ts      renderImage(deps, key, size)
      app.ts         createApp(deps): routes, auth slot, logging, error mapping, static web in prod
      index.ts       entry: dotenv, loadConfig, createB2, createApp, listen
    test/
      config.test.ts keys.test.ts listing.test.ts app.test.ts limit.test.ts cache.test.ts images.test.ts
      fakeB2.ts      in-memory B2 for tests
  web/
    package.json  tsconfig.json  vite.config.ts  index.html
    src/
      index.tsx  App.tsx  styles.css
      types.ts       mirrors server ListResult types
      api.ts         listFolder(), thumbUrl(), previewUrl(), downloadUrl()
      store.ts       navigation, selection, view, search, date range signals
      lib/rows.ts    inDateRange(), matchesSearch(), sortFiles(), compareNames()
      components/
        TopBar.tsx  FolderTree.tsx  DateFilter.tsx  FileArea.tsx  DetailsView.tsx
        IconsView.tsx  PreviewPane.tsx  StatusBar.tsx  Viewer.tsx
```

Shared types (server `listing.ts` exports, web `types.ts` copies):

```ts
export type FolderEntry = { name: string; prefix: string; date: string | null };
export type FileEntry = { name: string; key: string; size: number; uploaded: string; date: string | null }; // uploaded = ISO 8601
export type ListResult = { folders: FolderEntry[]; files: FileEntry[] };
```

---

### Task 1: Repo scaffold and config loading

**Files:**
- Create: `package.json`, `.gitignore`, `.env.example`, `.claude/CONTEXT.md`, `server/package.json`, `server/tsconfig.json`, `server/vitest.config.ts`, `server/src/config.ts`, `server/src/errors.ts`, `docs/learn/01-node-project-setup.md`
- Test: `server/test/config.test.ts`

**Interfaces:**
- Produces: `type Config = { accessKeyId: string; secretAccessKey: string; endpoint: string; region: string; bucket: string; rawPrefix: string; host: string; port: number; cacheDir: string }`; `loadConfig(env: Record<string, string | undefined>, rootDir: string): Config`; `class HttpError extends Error { constructor(public status: number, message: string) }`.

- [ ] **Step 1: Scaffold.** `git init`. `.gitignore`: `node_modules/`, `.env`, `.cache-images/`, `dist/`, `.superpowers/`. Root `package.json`: `"private": true`, `"type": "module"`, `"workspaces": ["server", "web"]`. `server/package.json`: `"type": "module"`, scripts `test: "vitest run"`, `dev: "tsx watch src/index.ts"`, `build: "tsc"`, `start: "node dist/index.js"`; deps `express@5 @aws-sdk/client-s3 sharp dotenv`; devDeps `typescript tsx vitest supertest @types/express @types/supertest @types/node`. `tsconfig.json`: `module`/`moduleResolution` `NodeNext`, `target ES2022`, `strict`, `outDir dist`, `rootDir src`. `.env.example` = the spec's `.env` block with placeholder values. Run `npm install`.

- [ ] **Step 2: Write the failing test** `server/test/config.test.ts`:

```ts
const full = { AWS_ACCESS_KEY_ID: "id", AWS_SECRET_ACCESS_KEY: "s3cr3t", B2_ENDPOINT_URL: "https://s3.eu-central-003.backblazeb2.com", B2_REGION: "eu-central-003", B2_BUCKET: "bucket" };
test("applies defaults", () => {
  const c = loadConfig(full, "/app");
  expect(c).toMatchObject({ rawPrefix: "yeast", host: "127.0.0.1", port: 3000 });
  expect(c.cacheDir).toBe(path.join("/app", ".cache-images"));
});
test("names every missing variable and never prints values", () => {
  expect(() => loadConfig({ AWS_SECRET_ACCESS_KEY: "s3cr3t" }, "/app"))
    .toThrow(/AWS_ACCESS_KEY_ID.*B2_ENDPOINT_URL.*B2_REGION.*B2_BUCKET/);
  try { loadConfig({ AWS_SECRET_ACCESS_KEY: "s3cr3t" }, "/app"); } catch (e) { expect(String(e)).not.toContain("s3cr3t"); }
});
test("rejects a non-numeric PORT", () => { expect(() => loadConfig({ ...full, PORT: "abc" }, "/app")).toThrow(/PORT/); });
test("strips slashes from B2_RAW_PREFIX", () => { expect(loadConfig({ ...full, B2_RAW_PREFIX: "/yeast/" }, "/app").rawPrefix).toBe("yeast"); });
```

- [ ] **Step 3: Run** `npm -w server test -- test/config.test.ts`. Expected: FAIL, `loadConfig` not found.
- [ ] **Step 4: Implement** `loadConfig` and `HttpError`. Relative `CACHE_DIR` resolves against `rootDir`.
- [ ] **Step 5: Run** the same command. Expected: 4 passed.
- [ ] **Step 6: Write** `.claude/CONTEXT.md` (purpose, layout, commands, link to spec and plan) and `docs/learn/01-node-project-setup.md` (npm workspaces vs uv, ESM, tsconfig, Vitest vs pytest).
- [ ] **Step 7: Commit** `git add -A && git commit -m "chore: scaffold workspace and config loading"`.

### Task 2: Key rules and listing mapping (pure logic)

**Files:**
- Create: `server/src/keys.ts`, `server/src/listing.ts`, `docs/learn/02-typescript-pure-modules.md`
- Test: `server/test/keys.test.ts`, `server/test/listing.test.ts`

**Interfaces:**
- Consumes: `HttpError` (Task 1).
- Produces:
  - `validateKey(value: unknown, rawPrefix: string): string` (object key; must not end with `/`) and `validatePrefix(value: unknown, rawPrefix: string): string` (must end with `/`; `"yeast/"` itself allowed). Both throw `HttpError(400, ...)`.
  - `batchDate(path: string, rawPrefix: string): string | null`: the `YYYY-MM-DD` at the start of the segment right after `rawPrefix/`, only if it is a real calendar date.
  - `isTiff(name: string): boolean`.
  - `cacheSources(key: string): { thumb: string; png: string } | null`: only for keys whose parent folder is `raw`.
  - `compareNames(a: string, b: string): number` = `Intl.Collator("en", { numeric: true, sensitivity: "base" }).compare`.
  - `type RawListing = { prefixes: string[]; objects: { key: string; size: number; lastModified: Date }[] }`.
  - `mapListing(prefix: string, rawPrefix: string, raw: RawListing): ListResult` plus the shared types above.

- [ ] **Step 1: Write the failing tests** `server/test/keys.test.ts`:

```ts
test.each(["yeast/b/raw/cell_1.tiff", "yeast/2026-10-07_miluda_5b_termo_b001/raw/Mil 5B 10^1_gold_1.tiff"])("accepts %s", (k) => expect(validateKey(k, "yeast")).toBe(k));
test.each([undefined, ["a"], "", "other/x.tif", "/yeast/x.tif", "yeast/../secret", "yeast\\x.tif", "yeast/a/", "yeastx/a.tif"])("rejects key %j", (k) =>
  expect(() => validateKey(k, "yeast")).toThrow(expect.objectContaining({ status: 400 })));
test("prefix rules", () => {
  expect(validatePrefix("yeast/", "yeast")).toBe("yeast/");
  expect(() => validatePrefix("yeast/b", "yeast")).toThrow(expect.objectContaining({ status: 400 }));
  expect(() => validatePrefix("yeast/../", "yeast")).toThrow(expect.objectContaining({ status: 400 }));
});
test("batchDate", () => {
  expect(batchDate("yeast/2026-10-06_miluda_5_ns-lab_b001/raw/cell_1.tiff", "yeast")).toBe("2026-10-06");
  expect(batchDate("yeast/2026-10-06_miluda_5_ns-lab_b001/", "yeast")).toBe("2026-10-06");
  expect(batchDate("yeast/old_batch/raw/a.tif", "yeast")).toBeNull();
  expect(batchDate("yeast/2026-13-40_x/", "yeast")).toBeNull();
});
test("isTiff", () => { expect(isTiff("a.TIF")).toBe(true); expect(isTiff("a.tiff")).toBe(true); expect(isTiff("manifest.csv")).toBe(false); });
test("cacheSources", () => {
  expect(cacheSources("yeast/b/raw/cell_10.tiff")).toEqual({ thumb: "yeast/b/raw/.cache/cell_10.thumbnail.png", png: "yeast/b/raw/.cache/cell_10.png" });
  expect(cacheSources("yeast/b/preprocessing/denoise/cell_10.tiff")).toBeNull();
});
```

`server/test/listing.test.ts`:

```ts
const d = new Date("2026-10-19T09:00:00Z");
test("root: dated batches newest first, undated last", () => {
  const r = mapListing("yeast/", "yeast", { prefixes: ["yeast/2026-08-30_a_termo_b001/", "yeast/old/", "yeast/2026-10-06_b_ns-lab_b001/"], objects: [] });
  expect(r.folders.map((f) => f.name)).toEqual(["2026-10-06_b_ns-lab_b001", "2026-08-30_a_termo_b001", "old"]);
  expect(r.folders[2].date).toBeNull();
});
test("raw folder: hides .cache and non-TIFF, natural sort, carries batch date", () => {
  const p = "yeast/2026-10-06_b_ns-lab_b001/raw/";
  const r = mapListing(p, "yeast", { prefixes: [p + ".cache/"], objects: [
    { key: p, size: 0, lastModified: d },
    { key: p + "cell_10.tiff", size: 5, lastModified: d },
    { key: p + "cell_2.TIF", size: 5, lastModified: d },
    { key: p + "notes.txt", size: 5, lastModified: d } ] });
  expect(r.folders).toEqual([]);
  expect(r.files.map((f) => f.name)).toEqual(["cell_2.TIF", "cell_10.tiff"]);
  expect(r.files[0]).toEqual({ name: "cell_2.TIF", key: p + "cell_2.TIF", size: 5, uploaded: d.toISOString(), date: "2026-10-06" });
});
```

- [ ] **Step 2: Run** `npm -w server test -- test/keys.test.ts test/listing.test.ts`. Expected: FAIL, modules not found.
- [ ] **Step 3: Implement** `keys.ts` and `listing.ts` per the Interfaces block. Non-root folders sort with `compareNames`.
- [ ] **Step 4: Run** the same command. Expected: all passed.
- [ ] **Step 5: Write** `docs/learn/02-typescript-pure-modules.md` (types vs Python type hints, `test.each`, why pure logic is kept apart from I/O).
- [ ] **Step 6: Commit** `git commit -m "feat(server): key validation and listing mapping"`.

### Task 3: B2 client, Express app and `/api/list`

**Files:**
- Create: `server/src/b2.ts`, `server/src/app.ts`, `server/src/index.ts`, `server/test/fakeB2.ts`, `docs/learn/03-express-and-s3.md`
- Test: `server/test/app.test.ts`

**Interfaces:**
- Consumes: `Config`, `loadConfig`, `HttpError` (Task 1); `validatePrefix`, `mapListing`, `RawListing` (Task 2).
- Produces:
  - `interface B2 { list(prefix: string): Promise<RawListing>; head(key: string): Promise<{ etag: string; size: number } | null>; getBytes(key: string): Promise<Buffer>; getStream(key: string): Promise<{ body: NodeJS.ReadableStream; size: number }> }`. `head` returns `null` on 404; `getBytes`/`getStream` throw `HttpError(404)` on a missing key and `HttpError(502)` on other S3 errors.
  - `createB2(config: Config): B2`. `list` uses `Delimiter: "/"` and follows `NextContinuationToken` until done.
  - `type AppDeps = { config: Config; b2: B2 }`; `createApp(deps: AppDeps): express.Express`. Task 6 adds `images?: ImageRenderer`, Task 9 adds `webDist?: string`.
  - `fakeB2(objects: Record<string, Buffer>, opts?: { pageSize?: number; fail?: boolean }): B2` for tests.

- [ ] **Step 1: Write** `server/test/fakeB2.ts`: implements `B2` over an in-memory map, computes prefixes/objects one level deep, splits `list` into internal pages of `pageSize` and loops over them like the real client; `fail: true` makes every call throw `HttpError(502, "B2 unavailable")`.
- [ ] **Step 2: Write the failing test** `server/test/app.test.ts`:

```ts
const config = loadConfig({ AWS_ACCESS_KEY_ID: "i", AWS_SECRET_ACCESS_KEY: "s", B2_ENDPOINT_URL: "http://x", B2_REGION: "r", B2_BUCKET: "b" }, "/tmp");
const p = "yeast/2026-10-06_b_ns-lab_b001/raw/";
test("lists one folder", async () => {
  const app = createApp({ config, b2: fakeB2({ [p + "cell_1.tiff"]: Buffer.from("x") }) });
  const res = await request(app).get("/api/list").query({ prefix: p });
  expect(res.status).toBe(200);
  expect(res.body.files[0]).toMatchObject({ name: "cell_1.tiff", key: p + "cell_1.tiff", size: 1, date: "2026-10-06" });
});
test("follows pagination past one page", async () => {
  const objs = Object.fromEntries(Array.from({ length: 1500 }, (_, i) => [`${p}cell_${i}.tiff`, Buffer.from("x")]));
  const res = await request(createApp({ config, b2: fakeB2(objs, { pageSize: 1000 }) })).get("/api/list").query({ prefix: p });
  expect(res.body.files).toHaveLength(1500);
});
test("400 on prefix outside raw prefix", async () => {
  const res = await request(createApp({ config, b2: fakeB2({}) })).get("/api/list").query({ prefix: "other/" });
  expect(res.status).toBe(400);
});
test("502 with short message when B2 fails", async () => {
  const res = await request(createApp({ config, b2: fakeB2({}, { fail: true }) })).get("/api/list").query({ prefix: "yeast/" });
  expect(res.status).toBe(502);
  expect(res.body).toEqual({ error: "B2 unavailable" });
});
```

- [ ] **Step 3: Run** `npm -w server test -- test/app.test.ts`. Expected: FAIL, `createApp` not found.
- [ ] **Step 4: Implement** `createB2` (S3Client with `forcePathStyle: true`, endpoint and region from config; S3 errors with `$metadata.httpStatusCode === 404` or name `NoSuchKey`/`NotFound` become 404), `createApp` (order: request logger `METHOD path status ms` via `console.log`, auth slot `(req, res, next) => next()` mounted on `/api`, routes, error handler mapping `HttpError` to `{ error: message }` and anything else to 500 `{ error: "Internal error" }`, logging the full error), and `index.ts` (`dotenv.config({ path: <repo root>/.env })`, `loadConfig(process.env, repoRoot)`, `listen(port, host)`, log the URL). Root `package.json` script `dev:server` = `npm -w server run dev`.
- [ ] **Step 5: Run** the same command. Expected: 4 passed.
- [ ] **Step 6: Real B2 check.** Copy `.env.example` to `.env` and fill it in with the read-only key (Tomer does this). Run `npm -w server run dev`, then `curl "http://127.0.0.1:3000/api/list?prefix=yeast/"`. Expected: JSON with the real batch folders, newest first. `curl "http://127.0.0.1:3000/api/list?prefix=x/"` gives 400.
- [ ] **Step 7: Write** `docs/learn/03-express-and-s3.md` (middleware chain vs FastAPI dependencies, async errors in Express 5, AWS SDK v3 commands vs boto3, pagination).
- [ ] **Step 8: Commit** `git commit -m "feat(server): B2 client and /api/list"`.

### Task 4: Web scaffold and first folder listing in the browser

**Files:**
- Create: `web/package.json`, `web/tsconfig.json`, `web/vite.config.ts`, `web/index.html`, `web/src/index.tsx`, `web/src/App.tsx`, `web/src/types.ts`, `web/src/api.ts`, `web/src/styles.css`, `docs/learn/04-solid-signals-and-resources.md`
- Modify: `package.json` (scripts)

**Interfaces:**
- Consumes: `GET /api/list` and the shared types (Task 3).
- Produces: `listFolder(prefix: string): Promise<ListResult>` (throws `Error(body.error)` on non-2xx); `thumbUrl(key)`, `previewUrl(key)`, `downloadUrl(key)` returning `/api/<route>?key=<encodeURIComponent(key)>`.

- [ ] **Step 1: Scaffold** `web` with Vite's `solid-ts` template files (no extra libraries). `vite.config.ts`: `server.proxy = { "/api": "http://127.0.0.1:3000" }`. Root scripts: `dev` = `concurrently -n server,web "npm -w server run dev" "npm -w web run dev"` (add `concurrently` to root devDeps).
- [ ] **Step 2: Implement** `api.ts` and a temporary `App.tsx`: a `currentPrefix` signal starting at `"yeast/"`, `createResource(currentPrefix, listFolder)`, folders as clickable rows (click sets the prefix), files as plain rows, a `<Show>` for loading and for `resource.error` (shows the message in red).
- [ ] **Step 3: Verify.** `npm run dev`, open `http://localhost:5173`. Expected: real batch folders; clicking a batch then `raw` shows TIFF names. Restart the server with a wrong `B2_BUCKET` in `.env` and reload: the red error message appears, not an empty list. Restore `.env` and restart.
- [ ] **Step 4: Write** `docs/learn/04-solid-signals-and-resources.md` (component runs once, signals vs `useState`, `createResource` vs `useEffect`+fetch, `<Show>`/`<For>` vs JSX `map`).
- [ ] **Step 5: Commit** `git commit -m "feat(web): Solid scaffold and first folder listing"`.

### Task 5: Explorer shell: navigation, tree, date filter, Details view, status bar

**Files:**
- Create: `web/src/store.ts`, `web/src/lib/rows.ts`, `web/src/components/TopBar.tsx`, `FolderTree.tsx`, `DateFilter.tsx`, `FileArea.tsx`, `DetailsView.tsx`, `PreviewPane.tsx` (folder part only), `StatusBar.tsx`, `docs/learn/05-solid-stores-and-components.md`
- Modify: `web/src/App.tsx`, `web/src/styles.css`

**Interfaces:**
- Consumes: `listFolder`, shared types (Task 4).
- Produces (used by Tasks 7–8):
  - `store.ts`: `currentPrefix(): string`, `navigate(prefix: string): void` (pushes history, clears selection and search), `back(): void`, `up(): void` (never above `rawPrefix + "/"`), `canBack(): boolean`, `canUp(): boolean`; `type Selection = { kind: "folder"; entry: FolderEntry } | { kind: "file"; entry: FileEntry }`; `selected()`, `select(s: Selection | null)`; `view(): "icons" | "details"`, `setView()`; `search()`, `setSearch()`; `dateFrom()`, `dateTo()`, `setDateFrom()`, `setDateTo()` (strings `YYYY-MM-DD` or `""`); `listing` = the shared `createResource(currentPrefix, listFolder)`; `visibleFiles(): FileEntry[]` (search applied) and `visibleFolders(): FolderEntry[]` (date range applied at root level only).
  - `lib/rows.ts`: `inDateRange(date: string | null, from: string, to: string): boolean` (no bounds: always true; any bound set and `date === null`: false; bounds inclusive); `matchesSearch(name: string, q: string): boolean` (case-insensitive substring; empty `q` true); `sortFiles(files: FileEntry[], column: "name" | "date" | "size" | "uploaded", dir: "asc" | "desc"): FileEntry[]` (name uses `compareNames`); `compareNames` (same collator as the server).

- [ ] **Step 1: Implement** `lib/rows.ts` and `store.ts` per the Interfaces block. The root prefix comes from the first path segment of the initial prefix (`"yeast/"`); no config endpoint.
- [ ] **Step 2: Implement components.** TopBar: Back, Up, address bar with one button per path part (click navigates to that prefix), search input, Large icons / Details toggle. FolderTree: root node expanded; each node fetches its children with `listFolder` only when first expanded; root's children filtered by `inDateRange`; clicking a node navigates. DateFilter: two `<input type="date">` above the tree. FileArea: folders first, then files; single click selects, double click on a folder navigates; renders `DetailsView` (Icons view comes in Task 7, toggle shows Details for now). DetailsView: columns Name, Date, Size (KB/MB, 1 decimal), Uploaded (local date and time); click a header to sort, again to reverse; default Name ascending. PreviewPane: for a folder or nothing selected, folder name and item count. StatusBar: `N items | M selected`.
- [ ] **Step 3: Style** as Explorer: Segoe UI, 12–13 px, light grey bars, blue selection, CSS grid with tree 240 px, preview 280 px.
- [ ] **Step 4: Verify** in the browser: Back/Up/address parts work; search filters the current folder only; a From date hides older batches and the undated test folder (if any) and clearing it shows them again; sorting by every column both ways; a batch with ~180 files scrolls smoothly (target: stays responsive at 1,000); status bar counts match.
- [ ] **Step 5: Write** `docs/learn/05-solid-stores-and-components.md` (module-level signals as a store, derived functions vs `useMemo`, props are getters: never destructure).
- [ ] **Step 6: Commit** `git commit -m "feat(web): Explorer shell with tree, date filter and details view"`.

### Task 6: Image pipeline: `/api/thumb` and `/api/preview`

**Files:**
- Create: `server/src/limit.ts`, `server/src/cache.ts`, `server/src/convert.ts`, `server/src/images.ts`, `docs/learn/06-sharp-cache-and-concurrency.md`
- Modify: `server/src/app.ts`, `server/src/index.ts`
- Test: `server/test/limit.test.ts`, `server/test/cache.test.ts`, `server/test/images.test.ts`

**Interfaces:**
- Consumes: `B2`, `fakeB2` (Task 3); `validateKey`, `cacheSources` (Task 2).
- Produces:
  - `createLimiter(n: number): <T>(task: () => Promise<T>) => Promise<T>`.
  - `cacheName(key: string, size: "thumb" | "preview", etag: string, ext: "jpg" | "png"): string` = sha256 hex of `key|size|etag` plus `.ext`; `createDiskCache(dir: string): { get(name: string): Promise<Buffer | null>; put(name: string, data: Buffer): Promise<void> }` (creates `dir`; writes to a temp file then renames).
  - `toJpeg(input: Buffer, maxSide: number): Promise<Buffer>`: `sharp(input, { pages: 1 }).normalise().resize(maxSide, maxSide, { fit: "inside", withoutEnlargement: true }).toColourspace("srgb").jpeg({ quality: 82 })`.
  - `type ImageRenderer = (key: string, size: "thumb" | "preview") => Promise<{ body: Buffer; contentType: "image/jpeg" | "image/png" }>`; `createImageRenderer(deps: { b2: B2; cache: DiskCache; limit: Limiter; convert?: typeof toJpeg }): ImageRenderer`.
  - Source choice: thumb uses `cacheSources(key).thumb` if `head` finds it (served as PNG, unchanged); preview uses `cacheSources(key).png` if found (converted with `toJpeg` at 1600); otherwise the TIFF itself (`toJpeg` at 256 or 1600). The disk cache name uses the chosen source key and its ETag. A missing TIFF gives `HttpError(404)`.

- [ ] **Step 1: Write the failing tests.**

`limit.test.ts`: run 10 tasks through `createLimiter(4)`, each awaiting a 10 ms timer and tracking the active count; `expect(maxActive).toBe(4)`; all 10 results returned in order; a rejecting task rejects only its own promise.

`cache.test.ts`: `cacheName("yeast/a.tif","thumb","e1","jpg")` differs from the same with `"e2"` and with `"preview"`, ends with `.jpg`, has 64 hex chars before it; `put` then `get` round-trips in a temp dir; `get` of an unknown name returns `null`.

`images.test.ts` (fake B2, `convert` stub that returns `Buffer.from("jpeg:" + maxSide)`, counting calls):

```ts
const raw = "yeast/b/raw/cell_1.tiff";
test("thumb uses .cache thumbnail as PNG, no conversion", async () => {
  const r = await render({ [raw]: tiff, "yeast/b/raw/.cache/cell_1.thumbnail.png": png })(raw, "thumb");
  expect(r).toEqual({ body: png, contentType: "image/png" }); expect(convertCalls).toBe(0);
});
test("preview converts .cache png at 1600", async () => { expect((await render({ [raw]: tiff, "yeast/b/raw/.cache/cell_1.png": png })(raw, "preview")).body.toString()).toBe("jpeg:1600"); });
test("no .cache: converts TIFF at 256, second call served from disk", async () => {
  const r = render({ [raw]: tiff });
  expect((await r(raw, "thumb")).body.toString()).toBe("jpeg:256");
  await r(raw, "thumb"); expect(convertCalls).toBe(1);
});
test("variant files never look for .cache", async () => { /* key under preprocessing/denoise/ with a decoy .cache file: converted from the TIFF */ });
test("missing TIFF is 404", async () => { await expect(render({})(raw, "thumb")).rejects.toMatchObject({ status: 404 }); });
```

Add to `app.test.ts`: `GET /api/thumb?key=other/x.tif` returns 400; with a stub renderer, `GET /api/preview?key=<raw>` returns 200, `Content-Type: image/jpeg`, `Cache-Control: private, max-age=86400`.

- [ ] **Step 2: Run** `npm -w server test -- test/limit.test.ts test/cache.test.ts test/images.test.ts test/app.test.ts`. Expected: FAIL, modules not found.
- [ ] **Step 3: Implement** the four modules, add `images?: ImageRenderer` to `AppDeps`, register the two routes only when `images` is set (`validateKey`, then `images(key, size)`), and wire `createImageRenderer` with `createLimiter(4)` and `createDiskCache(config.cacheDir)` in `index.ts`.
- [ ] **Step 4: Run** the same command. Expected: all passed.
- [ ] **Step 5: Real-file check (Review Focus 2).** With the dev server running, open in the browser `/api/preview?key=<one TIFF of 2026-08-30_miluda_4_termo_b001/raw/>` and `/api/thumb?key=<cell_1.tiff of 2026-10-06_miluda_5_ns-lab_b001/raw/>`. Expected: cells clearly visible, not black or washed out; second load is instant (cache hit). If the termo preview is too dark or too flat, adjust only `toJpeg` and note the change in the learn note.
- [ ] **Step 6: Write** `docs/learn/06-sharp-cache-and-concurrency.md` (Buffers, why a limiter, promises vs asyncio, ETag-keyed cache).
- [ ] **Step 7: Commit** `git commit -m "feat(server): thumbnails and previews with disk cache"`.

### Task 7: Icons view, file preview pane and single-file download

**Files:**
- Create: `web/src/components/IconsView.tsx`, `docs/learn/07-lazy-images-and-downloads.md`
- Modify: `server/src/app.ts`, `web/src/components/FileArea.tsx`, `web/src/components/PreviewPane.tsx`, `web/src/styles.css`
- Test: `server/test/app.test.ts`

**Interfaces:**
- Consumes: `B2.getStream`, `validateKey` (server); `store`, `thumbUrl`, `previewUrl`, `downloadUrl` (web).
- Produces: `GET /api/download?key=<k>`: streams the original bytes with `Content-Type: image/tiff`, `Content-Length`, and `Content-Disposition` from `res.attachment(<last key segment>)`.

- [ ] **Step 1: Write the failing test** in `app.test.ts`:

```ts
test("download streams exact bytes with the original filename", async () => {
  const key = "yeast/2026-10-07_miluda_5b_termo_b001/raw/Mil 5B 10^1_gold_1.tiff";
  const bytes = Buffer.from([0x49, 0x49, 0x2a, 0x00, 1, 2, 3]);
  const res = await request(createApp({ config, b2: fakeB2({ [key]: bytes }) })).get("/api/download").query({ key }).buffer(true).parse((r, cb) => { const c: Buffer[] = []; r.on("data", (d) => c.push(d)); r.on("end", () => cb(null, Buffer.concat(c))); });
  expect(res.status).toBe(200);
  expect(res.headers["content-disposition"]).toContain('filename="Mil 5B 10^1_gold_1.tiff"');
  expect(Buffer.compare(res.body, bytes)).toBe(0);
});
test("download of a missing key is 404", async () => {
  expect((await request(createApp({ config, b2: fakeB2({}) })).get("/api/download").query({ key: "yeast/b/raw/none.tif" })).status).toBe(404);
});
```

- [ ] **Step 2: Run** `npm -w server test -- test/app.test.ts`. Expected: the two new tests FAIL with 404 route.
- [ ] **Step 3: Implement** the route (stream piped to `res`; a stream error after headers ends the response and logs).
- [ ] **Step 4: Run** the same command. Expected: all passed.
- [ ] **Step 5: Implement web.** IconsView: CSS grid of 120 px tiles, `<img loading="lazy" decoding="async" src={thumbUrl(key)}>` over a grey placeholder that stays on `onError`, name under it (ellipsis), folders as folder tiles first; tiles use `content-visibility: auto`. FileArea renders Icons or Details from `view()`. PreviewPane for a file: `<img src={previewUrl(key)}>` with a "Loading…" placeholder, name, date, size, and a Download link `<a href={downloadUrl(key)} download>`.
- [ ] **Step 6: Verify** in the browser: toggle views keeps the selection; an ns-lab batch shows thumbnails fast, a termo batch fills in progressively while scrolling; Download of `Mil 5B 10^1_gold_1.tiff` saves a file with that exact name and the same size as in B2.
- [ ] **Step 7: Write** `docs/learn/07-lazy-images-and-downloads.md` (native lazy loading, streaming a response in Node, `Content-Disposition`).
- [ ] **Step 8: Commit** `git commit -m "feat: icons view, preview pane and single-file download"`.

### Task 8: Full-screen viewer

**Files:**
- Create: `web/src/components/Viewer.tsx`, `docs/learn/08-solid-events-and-cleanup.md`
- Modify: `web/src/store.ts`, `web/src/components/IconsView.tsx`, `web/src/components/DetailsView.tsx`, `web/src/App.tsx`, `web/src/styles.css`

**Interfaces:**
- Consumes: `visibleFiles()`, `select()`, `previewUrl()`, `downloadUrl()`.
- Produces: `viewerKey(): string | null`, `openViewer(key: string): void`, `closeViewer(): void` in `store.ts`.

- [ ] **Step 1: Implement.** Double-click on a file (both views) calls `openViewer`. Viewer: fixed full-window dark overlay, image from `previewUrl`, mouse wheel zooms around the cursor (scale 1–10), drag pans, double-click resets, `Esc` closes, `ArrowLeft`/`ArrowRight` move through `visibleFiles()` (also updating the selection), file name and Download link in a top bar. Key listeners added in `onMount` and removed in `onCleanup`.
- [ ] **Step 2: Verify** in the browser: zoom keeps the point under the cursor fixed; arrows stop at the first and last file; `Esc` returns to the same folder with the last viewed file selected.
- [ ] **Step 3: Write** `docs/learn/08-solid-events-and-cleanup.md` (`onMount`/`onCleanup` vs `useEffect` return, pointer events).
- [ ] **Step 4: Commit** `git commit -m "feat(web): full-screen viewer with zoom and pan"`.

### Task 9: Production mode, README and final walkthrough

**Files:**
- Create: `README.md`, `docs/learn/09-build-and-production.md`
- Modify: `server/src/app.ts`, `package.json`, `.claude/CONTEXT.md`
- Test: `server/test/app.test.ts`

**Interfaces:**
- Consumes: `createApp` (Task 3).
- Produces: `AppDeps.webDist?: string`. When set and the folder exists, `createApp` serves it with `express.static` and answers non-`/api` GETs with `index.html`; `/api/*` unknown routes stay `404` JSON.

- [ ] **Step 1: Write the failing test** in `app.test.ts`: with `webDist` pointing to a temp folder holding `index.html` (`<p>app</p>`), `GET /` and `GET /some/path` return that HTML; `GET /api/nope` returns 404 with JSON `{ error: ... }`.
- [ ] **Step 2: Run** `npm -w server test -- test/app.test.ts`. Expected: new test FAILs.
- [ ] **Step 3: Implement.** `index.ts` sets `webDist` to `<repo root>/web/dist` in production mode. Root scripts: `build` = `npm -w web run build && npm -w server run build`; `start` = `node server/dist/index.js --production`. `index.ts` treats the `--production` flag like `NODE_ENV=production`, so the script is the same on Windows and Linux.
- [ ] **Step 4: Run** the same command. Expected: all passed.
- [ ] **Step 5: Verify production mode.** `npm run build && npm start`, open `http://127.0.0.1:3000`. Expected: the full app works from one process.
- [ ] **Step 6: Final walkthrough (spec section 8).** Browse to a batch, toggle views, sort, search, date filter, open the viewer, download one TIFF and compare its size with the B2 listing. Confirm the browser's network tab shows only `/api/*` and no B2 hostnames.
- [ ] **Step 7: Write** `README.md` (what it is, setup with the read-only key, `npm run dev`, `npm run build && npm start`, layout, not secured yet: localhost only), update `.claude/CONTEXT.md`, write `docs/learn/09-build-and-production.md`.
- [ ] **Step 8: Commit** `git commit -m "feat: production mode and README"`.
