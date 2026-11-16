# 13 — Split tags

What was built: the Registry gives each split (batch folder) one or more tags in
`catalog/yeast/split_tags.csv`, for example `10-3`. Split names alone look alike
(`2026-11-15_KS1_ns-lab_b001` vs `..._b002`), so the GUI now shows the tags and filters splits by them.

New files: `web/src/components/TagPills.tsx`, `web/src/components/TagFilter.tsx`.
Changed: `registry.ts`, `index.ts`, `keys.ts`, `listing.ts`, `app.ts` (server); `types.ts`,
`lib/fields.ts`, `lib/rows.ts`, `store.ts`, `DetailsView`, `FilterMenu`, `FilterChips`, `PreviewPane`,
`FolderTree`, `styles.css` (web).

## A second Registry file, same machinery

```
split_tags.csv (next to images.csv)  -->  server (Map split -> tags)  -->  /api/list  -->  browser
```

`split_tags.csv` has one row per tag: `split,tag`. The server reads it with a second `RegistrySource`
(see note 10): a local file when `REGISTRY_CSV_PATH` is set, else GitHub. Its path is not configured
separately; it is the directory of the images.csv path plus `split_tags.csv`. Both files are checked
in the same `refresh()`, but each load catches its own errors: a missing tags file logs one warning
and the image metadata keeps working.

## Join by folder name

The split name is the folder name directly under the root, the same text as `current_split` in
images.csv. `mapListing` adds `tags` to every folder at the root and, through `batchName(key)`, to
every file inside a split. Sub-folders such as `raw/` get `[]`.

## A folder filter, not a Field filter

Field filters (gold, instrument, ...) hide **files**. The Tag filter hides **split folders**, like the
batch dates, so it lives next to them: `tagFilter` in `store.ts`, applied in `visibleFolders` at the
root and in the tree (`hasTag`). That is why it sits in the panel's "Batch" section and only shows at
the top level, but stays set while you browse inside a split.

Several tags can be chosen (one toggle per tag, `toggleTag` in the store). A split shows when it has
**any** chosen tag: a split usually has one tag, so "all chosen tags" would match nothing. Each
chosen tag is its own chip and counts once in the filter badge.

## One neutral pill

Every tag value looks the same (`.tag-pill`, colors from `--pill-bg` and `--pill-border`). A color
per value would suggest that `10-3` is "worse" than `10-5`, which the tags do not mean, and new tags
would need new colors.
