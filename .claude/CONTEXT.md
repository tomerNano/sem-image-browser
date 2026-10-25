# Project context

B2 GUI: a web app, styled like Windows File Explorer, that lets NanoScout biologists browse, preview,
date-filter and download the yeast SEM TIFFs that `new-data-pipeline` ingests into Backblaze B2.
MVP: localhost only, no sign-in yet (later: company Google accounts + security review with a senior).

- Design: `docs/superpowers/specs/2026-10-21-b2-gui-design.md`. Plan: `.claude/plans/b2-gui-mvp.md`.
- npm workspaces: `server/` (Node + Express 5 + TypeScript, the only part that talks to B2, read-only
  S3 commands) and `web/` (Vite + SolidJS + TypeScript).
- Config only from environment variables; `.env` at the repo root (gitignored), template `.env.example`.
  Real bucket root is `B2_RAW_PREFIX=SEM-DATA/yeast`; the web app reads it from `GET /api/root`.
- `npm run dev` (Vite :5173 + API :3000) or `npm run build && npm start` (one process on :3000).
- Server tests: `npm -w server test -- <file>` (Vitest; in-memory fake S3 in `server/test/fakeB2.ts`).
- Images: `.cache` PNGs from the pipeline when present, else sharp with `normalise()` (16-bit SEM);
  disk cache in `CACHE_DIR`, 4 conversions at a time.
- Image properties (Fields, see `GLOSSARY.md`) are one table, `FIELDS` in `web/src/lib/fields.ts`:
  Details columns, sort menu, filter panel and preview pane all read it.
- Web state: `createStore(api)` in `web/src/store.ts` (the page passes `api.ts`; `store.test.ts`
  passes an in-memory listing). Selection is an id; `selected()` and `viewer()` are only the
  visible item, so filters and search can never leave a hidden item selected.
- Learning notes for each built part: `docs/learn/`.
