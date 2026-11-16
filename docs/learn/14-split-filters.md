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
images.csv  -->  server (split -> [{ meta, count }])  -->  GET /api/split-groups  -->  browser
```

Every Registry row has `current_split`. When the server re-reads images.csv it also groups the
rows by split, then by their **filter values** (`splitGroups()` in `registry.ts`). Images that
share resolution, field width, instrument, detector, voltage, gold, source and variant become one
group with a count; values nobody filters by (image id, time) are left out. The browser asks for
this once per page load and gets it with `Cache-Control: private, no-cache`: it keeps a copy and
asks again only with its ETag, and an unchanged answer is a 304 with no body.

Why groups and not one entry per image: the answer grows with how many different value sets
exist, not with the number of images. 5,561 images give 378 groups, 150 KB instead of 3 MB.
At 100,000 images a list of every image would be about 55 MB per page load.

If a new Field gets a `filter` in `web/src/lib/fields.ts`, add its value to `filterMeta` in
`registry.ts`, or the top-level filter cannot see it.

## Groups look like files

`matchesFilters` and `choices` (in `lib/fields.ts`) work on `FileEntry`. The store wraps each
group as a `FileEntry` (empty name and key, the group's `meta`) next to its count, so the same
filter code decides both "does this file pass?" and "does this split have a passing image?".
`splitMatch(name)` adds up the counts of the passing groups; `passesBatchFilters(folder)` adds it
to the date and tag checks, and both the folder list and the tree use it.

At the top level the filter dropdowns list the values of every split's images (`filterFiles()`),
so the choices are there before any folder is opened.

## Choices made

- Every variant counts (raw and preprocessed). The Variant filter narrows to one.
- While the split images are loading, or if they fail to load, the Field filters hide no split.
