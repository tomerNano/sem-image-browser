# 12 — Pages in the browser

What was built: a big folder shows 200 items per page (folders first, then files), with a pager
under the items. Only the current page is in the DOM, so only its thumbnails are requested.

Changed: `web/src/store.ts`, `IconsView`, `DetailsView`, `FileArea`; new `components/Pager.tsx`.

## Why the browser, not the server

The server still sends the whole folder listing. Sort, search, the Field filters, Ctrl+A, Shift
ranges and the viewer all work on that full list in the browser. Server pages would make each of
them see only one page, or move all that logic to the server. The listing itself is small (about
600 bytes per file); what costs is DOM nodes and thumbnail requests, and a page bounds both.

## The page resets by itself

```ts
const [pageState, setPageState] = createSignal<{ ids: string[] | null; page: number }>(...);
const page = createMemo(() => (pageState().ids === visibleIds() ? pageState().page : 0));
```

`visibleIds()` is a memo, so a new folder, search, filter or sort gives a new array. The stored
page belongs to the old array, so `page()` falls back to the first page. No effect that watches
every signal is needed (compare: a React `key` that resets a component's state).

## The page follows the focus

`select` and `selectRange` call `showPageOf(id)`. An arrow key past the last item of a page, or the
viewer stepping to the next image, opens the page that holds that item.
