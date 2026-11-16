# Split tags in the B2 GUI: design

Date: 2026-11-16. Size: small change (short design).
Approved mockup: `.superpowers/brainstorm/6970-1794834150/content/tag-final.html` (design C, neutral pill).

## Intent

Split (batch folder) names are too generic: `2026-11-15_KS1_ns-lab_b001` and `..._b002` look alike.
The Registry now gives each split a tag (`catalog/yeast/split_tags.csv`, columns `split,tag`, for
example `10-3`). Biologists should see a split's tag while exploring and be able to filter splits
by tag.

## Goals

- Folder list (root level): a **Tag** column. Each tag is one neutral grey pill. A split with
  several tags shows several pills. A split with no tag shows `—`.
- Filter panel: the top section "Batch date" becomes **Batch** (From, To, Tag). Tag is a dropdown
  ("Any" plus the tags of the shown splits). When set, it shows as a chip ("Tag 10-3 ✕"), counts in
  the filter badge and is cleared by "Clear filters".
- The Tag filter works like the batch date filter: it hides split folders in the root list and in
  the sidebar tree. It never hides files. A split matches when any of its tags equals the chosen
  tag. Untagged splits are hidden while the filter is set.
- Preview pane: a selected split shows `Tag` with its pills. A selected image shows `Tag` first in
  the Dataset group.

## Non-goals and anti-goals

- No tag in the sidebar tree rows (user chose to keep the tree clean).
- No color per tag value: one neutral pill, so a tag never reads as good or bad.
- No editing of tags from the GUI; the Registry stays the only source.
- A missing or broken `split_tags.csv` must never break the listing or the images.csv metadata.

## Constraints

- Server stays read-only toward GitHub and B2.
- Same two Registry sources as images.csv: local clone (`REGISTRY_CSV_PATH`) or GitHub with the
  read-only token (ETag + 304, checked once a minute).
- The tag is display text exactly as in the CSV (`10-3`, not `10⁻³`).

## Approaches

1. **Server reads split_tags.csv next to images.csv and adds tags to `/api/list` (chosen).**
   The server already joins the Registry into listings. Folder entries get `tags: string[]`;
   files get their split's tags too. The tree, the folder list, the filter and the preview all
   read data they already fetch.
2. Separate endpoint `/api/split-tags`, joined in the browser. One more request and one more piece
   of browser state to keep in sync with the listing, for no gain.
3. Pipeline copies the tag into every images.csv row. Changes another repository, and empty folders
   or folders without Registry rows would still have no tag.

## Decided

- Design C with a neutral pill, as in the approved mockup (user).
- Filter in a renamed **Batch** section with the date range (user approved the mockup).
- `split_tags.csv` path = the directory of the images.csv path + `split_tags.csv`, for both
  sources; no new environment variables (my call).
- Split key = folder name directly under the root = `current_split` in images.csv (my call).

## Left to the builder

- Exact shape of the tag data on files (field on `FileEntry` or on `ImageMeta`).
- How the Details view renders a pill in a Field cell, and how the folder-level Tag filter sits in
  the store next to `dateFrom`/`dateTo`.
- Warning log text when `split_tags.csv` is missing or has a bad header (log once, like images.csv).
