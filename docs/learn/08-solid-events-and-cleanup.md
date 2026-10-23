# 08 — Viewer: events, cleanup, and asking the server for the root

What was built: `web/src/components/Viewer.tsx` (full-screen viewer) and `GET /api/root`.

## Window listeners: `onMount` / `onCleanup` (compare: `useEffect` return)

```ts
onMount(() => window.addEventListener("keydown", onKey));
onCleanup(() => window.removeEventListener("keydown", onKey));
```

Esc and the arrow keys must work wherever focus is, so the viewer listens on `window`. In React you
would add the listener in `useEffect` and remove it in the function `useEffect` returns. In Solid the
two halves are separate calls. `onCleanup` runs when the viewer is removed (`<Show>` turns false after
Esc), so no listener is left behind.

## `on(...)`: react to one thing only

```ts
createEffect(on(() => props.fileKey, reset));
```

A plain `createEffect` re-runs for every signal it reads. `on(source, fn)` says: run `fn` only when
`source` changes. Here a new image resets the zoom, and nothing else does.

## Zoom around the cursor

The image is drawn with `transform: translate(x, y) scale(s)` and `transform-origin: 0 0`. To keep the
point under the mouse fixed while the scale goes from `s` to `s'`:

```
x' = cx - (cx - x) * s' / s        (same for y)
```

where `cx` is the mouse position inside the stage. Dragging adds the mouse movement to `x, y`.
`setPointerCapture` keeps the drag working even when the mouse leaves the image.

## A plan mistake caught on real data: the root

The plan assumed the bucket root is `yeast/`. On the real bucket it is `SEM-DATA/yeast/`
(`B2_RAW_PREFIX=SEM-DATA/yeast`), and every listing returned 400. Instead of copying the value into
the frontend, the browser now asks `GET /api/root` once at startup (`web/src/index.tsx`) and the store
is initialised with the answer. The setting lives in one place, the server's environment.

## Checked on real B2

Opened `2026-08-30_miluda_4_termo_b001/raw` (268 TIFFs, no `.cache`): thumbnails convert on demand and
SEM frames show cells with good contrast. In the viewer: arrows move through the folder and stop at
the first file, the wheel zooms around the cursor, Esc closes with the last viewed file selected.
