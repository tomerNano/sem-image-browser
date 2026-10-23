# 09 — Build and production mode

What was built: `npm run build` and `npm start`, and the part of `server/src/app.ts` that serves the
built frontend.

## Two modes

| | Development (`npm run dev`) | Production (`npm run build && npm start`) |
|---|---|---|
| Processes | 2: Vite (:5173) + Express (:3000) | 1: Express (:3000) |
| Frontend | Vite compiles on the fly, hot reload | static files in `web/dist/` |
| Server code | `tsx watch` runs TypeScript directly | `tsc` compiled it to `server/dist/*.js` |

`vite build` bundles the Solid app into a few small files with hashed names (`assets/index-abc123.js`).
`tsc` turns `server/src/*.ts` into plain JavaScript that `node` runs without extra tools. This is what a
company server will run.

## Serving the frontend from Express

```ts
app.use(express.static(webDist));                       // real files: index.html, assets/...
app.get("/{*path}", (_req, res) => res.sendFile(index)); // any other page -> the app
```

This sits **after** the `/api` routes and the `/api` 404 handler, so an unknown `/api/...` still gets a
JSON error, not the HTML page. `/{*path}` is Express 5's syntax for "any path" (Express 4 used `*`).

`npm start` runs `node server/dist/index.js --production`. The flag (instead of `NODE_ENV=production
node ...`) keeps the same command working in Windows PowerShell and on Linux.

## Final walkthrough on real B2 (production build)

- Root lists the 6 real batches, newest first. From = 2026-10-10 keeps only the 3 newer ones.
- `2026-10-06_miluda_5_ns-lab_b001/raw` (209 TIFFs): thumbnails come from the pipeline's `.cache`
  PNGs and load as you scroll; search, Details view and sorting work.
- Download of `miluda4_Inoculum 10^5_1.tiff`: 2,439,662 bytes, the same size as in the B2 listing,
  with the exact file name.
- The browser only contacted `127.0.0.1:3000`; no B2 address and no key ever reach it.
