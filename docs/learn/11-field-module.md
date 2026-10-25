# 11 — The Field module: one table for every image property

What was built: `web/src/lib/fields.ts` holds one table, `FIELDS`, with every property of an image
the browser can show, sort or filter by. The project calls such a property a **Field**
(`GLOSSARY.md`). The Details columns, the sort menu, the filter panel and the preview pane all read
this table instead of each knowing the Fields themselves.

New files: `web/src/lib/fields.ts`, `web/src/lib/fields.test.ts`, `web/src/components/FieldFilters.tsx`
(was `MetaFilters.tsx`). Changed: `lib/rows.ts` (Field logic moved out), `store.ts`, `DetailsView`,
`SortMenu`, `FilterMenu`, `PreviewPane`.

## Why one table

Before, adding one Registry property (say, magnification) meant 13 edits in 5 web files: a type
union, a column list, a switch for sorting, a filter type, its empty value, an `if` for matching,
a formatter, a dropdown list, a table cell (at the right position), an empty folder cell, and a
preview row. Miss one and the app still compiles but a column is shifted or a filter does nothing.
The same value was also formatted in different places, so the preview and the filter dropdown could
disagree (voltage "10.004 kV" vs "10 kV").

Now each Field is one entry, and everything else is derived from it:

```ts
{
  id: "voltage",
  label: "Voltage",
  value: (f) => f.meta?.voltageKv ?? null,   // raw value: sorting, range filters
  format: (f) => "10 kV" or "—",             // the one display text: cell, preview, dropdown
  column: { cell: "num" },                    // Details column + sort menu (omit = not a column)
  preview: "registry",                        // preview section: "file" or "registry"
  filter: { kind: "choice" },                 // or { kind: "range", unit: "µm" }
}
```

The table order is the display order of the columns and of the preview rows.

## How to add a Field

1. Server: map the CSV column in `toImageMeta` (`server/src/registry.ts`) and add it to
   `ImageMeta` there and in `web/src/types.ts`.
2. Web: add one entry to `FIELDS` in `fields.ts`, at the position where it should show.
3. Add its expected text to the table in `fields.test.ts` (the test fails until you do).

## The rules that live inside the module

- A missing value shows as `—` and sorts last in both directions. Ties sort by name.
- With any filter set, a file without a Registry row is hidden.
- A choice filter compares the Field's display text, so what the dropdown shows is exactly
  what it matches. A range filter compares the raw number, bounds inclusive.
- The filter badge counts a range as one filter.

## Deep module (compare: a Python module with a small `__all__`)

Callers use `FIELDS` and four functions (`sortFiles`, `matchesFilters`, `activeFilterCount`,
`choices`). The empty-value rule, rounding and units stay inside. That is a **deep** module: a
small interface over a lot of behaviour. One test file checks every Field through that same
interface, so a test failure points to one place.
