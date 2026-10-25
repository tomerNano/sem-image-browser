# Plan: Field module (one table for every image Field)

Goal: knowledge of a Field (label, value, format, sort, filter, where it shows) lives in one
module, `web/src/lib/fields.ts`. Adding a Field becomes one table entry on the web side (plus the
server's CSV mapping and type, left for the shared-contract work). Term defined in `GLOSSARY.md`.
Values come only from the `/api/list` response (B2 listing + Registry); nothing reads the TIFF.

## Decided with the user (2026-10-25)

- Q1 Every Details column is a Field (name, date, size, uploaded too), not only Registry fields.
- Q2 Web only. Server `toImageMeta`, server `ImageMeta` and `web/src/types.ts` stay as they are.
- Q3 One `format` per Field, used by the table, the preview and the choice filters.
- Q4 Each Field declares where it shows: column (Details + sort menu), filter, preview.
- Q5 Two filter kinds: `choice` (fixed options, or the values in the current folder) and `range`.
- Q6 Resolution "1920 × 1200" everywhere (no "px"; preview label "Resolution"). Voltage rounded
  to 2 decimals everywhere.
- Q7 Choice filters compare the formatted value.
- Q8 Filter state comes from the table: choice = map id -> value, range = map id -> { min, max }.
  The filter badge counts a range as 1.
- Q9 Table order = column order = preview order.
- Q10 Field width and field height are two Fields; only width is a column and a range filter.
- Q11 Name "Field", file `web/src/lib/fields.ts`. `rows.ts` keeps folder sort, search, date range,
  `formatSize`, `itemCount`.
- Q12 Everything else unchanged: missing values sort last both ways, no Registry row = hidden when
  any filter is set, ties by natural name order, folder rows show name and date only, folders keep
  the server order until a header click.
- Q13 Interface: `FIELDS`, `sortFiles`, `matchesFilters`, `activeFilterCount`, `choices`.
- Q14 Missing value text is "—" everywhere (date too).
- Q15 Component `MetaFilters.tsx` renamed `FieldFilters.tsx`.
- Q16 `web/src/lib/fields.test.ts`, table-driven, through the interface; tests from
  `filters.test.ts` move there and that file is deleted; `rows.test.ts` keeps folder sort tests.
- Q17 Hardening committed first (11abe36). The Field module is one commit after this plan is confirmed.
- Q18 Short learning note `docs/learn/11-field-module.md`.
- Q19 The preview keeps its two sections: each Field declares `preview?: "file" | "registry"`.
  The Registry section shows only when the file has a Registry row, else "No Registry metadata".

## Field table (in order)

| id | label | column | preview | filter |
|---|---|---|---|---|
| name | Name | yes | (title) | |
| date | Date | yes | yes | |
| size | Size | yes | yes | |
| acquired | Acquired | | yes | |
| fieldWidth | Field width | yes | yes | range (µm) |
| fieldHeight | Field height | | yes | |
| pixelSize | Pixel | yes | yes | |
| resolution | Resolution | yes | yes | choice (folder) |
| instrument | Instrument | yes | yes | choice (folder) |
| detector | Detector | yes | yes | choice (folder) |
| voltage | Voltage | | yes | choice (folder) |
| workingDistance | WD | | yes | |
| dwellTime | Dwell | | yes | |
| spotSize | Spot | | yes | |
| integrations | Integr. | | yes | |
| gold | Gold | yes | yes | choice (Yes / No / Unknown) |
| experiment | Experiment | | yes | |
| source | Source | | yes | choice (folder) |
| variant | Variant | | yes | choice (folder) |
| imageId | Image ID | | yes | |
| uploaded | Uploaded | yes | | |

## Steps

1. `web/src/lib/fields.ts`: `Field` type, `FIELDS`, `sortFiles`, `matchesFilters`,
   `activeFilterCount`, `choices`, filter state type and its empty value.
2. `web/src/lib/fields.test.ts`: per-Field format (sample + missing), sorting, filtering.
   Move tests from `filters.test.ts`, delete it.
3. `rows.ts`: remove what moved (MetaColumn, SORT_COLUMNS, metaValue, MetaFilters, matchesFilters,
   Registry formatters).
4. `store.ts`: `sortColumn` typed by Field id; filters state and `activeFilterCount` from fields.ts.
5. Views read `FIELDS`: DetailsView (headers, file cells, folder row empty cells), SortMenu,
   FieldFilters (renamed), PreviewPane.
6. `docs/learn/11-field-module.md`, `.claude/CONTEXT.md` line.
7. Verify: `npm -w web test -- src/lib/fields.test.ts src/lib/rows.test.ts`, `npm run build`,
   then the app in the browser (Details, sort menu, filters, preview).
