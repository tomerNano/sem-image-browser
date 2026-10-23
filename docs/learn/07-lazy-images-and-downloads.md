# 07 — Lazy images and downloads

What was built: the Large icons view (`web/src/components/IconsView.tsx`, now the default view), the
file part of the preview pane, and `GET /api/download`.

## Lazy thumbnails without a library

```tsx
<img src={thumbUrl(file.key)} loading="lazy" decoding="async" />
```

`loading="lazy"` is built into the browser: an image is requested only when it scrolls near the
screen. Opening a 1,000-file folder does not fire 1,000 requests. The CSS `content-visibility: auto`
on each tile also lets the browser skip layout and paint for tiles far off-screen.

## `<Match keyed>`

`<Match when={selectedFile()} keyed>` rebuilds the preview whenever a different file is selected, so
the old picture never stays on screen while the new one loads.

## Streaming a download in Node

```ts
const { body, size } = await b2.getStream(key);
res.attachment(filename);          // Content-Disposition: attachment; filename="..."
await pipeline(body, res);         // B2 bytes flow straight to the browser
```

The file is never fully held in server memory. `pipeline` (from `node:stream/promises`) connects the
two streams and handles errors. If B2 fails mid-download, the headers are already sent, so the server
logs it and drops the connection. The test checks that the bytes are identical and that the filename
`Mil 5B 10^1_gold_1.tiff` (spaces and `^`) arrives exactly.
