# Plan: selection and viewer position owned by the store

Problem: selection keeps a copy of the clicked entry. A filter or a search can hide that entry,
but the status bar ("1 selected") and the preview pane still show it. The Viewer also works out
its own file list and position, and `openViewer` searches the list again on each step.

## Decided with the user (2026-10-25)

- Q1 A hidden item is not selected. The store remembers its id; `selected()` is the visible item
  with that id, or null. Clearing the filter brings the selection back.
- Q2 The selection is one id string: a folder prefix (ends with "/") or a file key.
  `isSelected` moves into the store object.
- Q3 The store owns the viewer position: `viewer()` = { file, index, count, at(delta) } or null,
  plus `stepViewer(delta)` and `closeViewer()`. The Viewer keeps zoom, pan, keys and prefetch.
- Q4 A hidden viewed file closes the viewer (`viewer()` is null).
- Q5 Stepping stops at the first and last file (unchanged).
- Q6 Test seam: `createStore(api)`; the page passes `api.ts`, tests pass an in-memory listing.
  Vitest resolves Solid's browser build so signals and memos react in tests.
  Stop and ask the user if this needs more than a config change.

## Steps

1. Spike: a Solid signal/memo/resource reacts under Vitest with the config change.
2. `store.ts`: export `createStore(api)`; selection by id; `viewer()`, `stepViewer`; `isSelected`.
3. Components: IconsView, DetailsView, FileArea (select by id), PreviewPane (unchanged reads),
   App and Viewer (read `store.viewer()`).
4. `web/src/store.test.ts`: hide/clear filter, search hides a folder, navigate clears, step at
   the ends, hidden viewed file closes the viewer.
5. `npm -w web test -- src/store.test.ts`, `npm run build`, check the app in the browser, one commit.
