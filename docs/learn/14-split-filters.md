# 14 — Field filters at the top level

What was built: at `yeast/` the Field filters (Resolution, Instrument, Detector, Voltage, Gold,
Source, Variant, Field width) now hide splits. A split stays visible when at least one of its
images passes every set filter, and shows how many do: "23 of 172 match". Inside a split the
filters keep hiding files, as before.

New files: `web/src/components/SplitMatchCount.tsx`.
Changed: `registry.ts`, `app.ts` (server); `types.ts`, `api.ts`, `store.ts`, `FieldFilters`,
`FolderTree`, `IconsView`, `DetailsView`, `styles.css` (web).

## No B2 calls: the Registry already knows

```
images.csv  -->  server (split -> [{ key, meta }])  -->  GET /api/split-images  -->  browser
```

Every Registry row has `current_split`. When the server re-reads images.csv it also groups the
rows by split (`imagesBySplit()`). The browser asks for this once per page load. About 3 MB for
5,561 images: it is sent with `Cache-Control: private, no-cache`, so the browser keeps a copy and
asks again only with its ETag; an unchanged answer is a 304 with no body.

## Split images look like files

`matchesFilters` and `choices` (in `lib/fields.ts`) work on `FileEntry`. The store wraps each
split image as a `FileEntry` (name from the key, size 0, the Registry `meta`), so the same
filter code decides both "does this file pass?" and "does this split have a passing image?".
`splitMatch(name)` counts the passing images; `passesBatchFilters(folder)` adds it to the date
and tag checks, and both the folder list and the tree use it.

At the top level the filter dropdowns list the values of every split's images (`filterFiles()`),
so the choices are there before any folder is opened.

## Choices made

- Every variant counts (raw and preprocessed). The Variant filter narrows to one.
- While the split images are loading, or if they fail to load, the Field filters hide no split.
