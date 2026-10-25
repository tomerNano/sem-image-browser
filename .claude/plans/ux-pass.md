# Plan: UX pass (frontend-design)

Subject: NanoScout biologists find, compare and download yeast SEM micrographs from B2.
Primary job: find the right image fast and judge it by eye. Secondary: read its acquisition
values, download the original.

## Audit (1440 x 900, real bucket, 2026-10-25)

- Grid: each thumbnail sits small inside a grey padded box inside a white card; about 40% of a
  tile is image. For an image browser the pictures are too small, and there is no size control.
- No keyboard use: arrows, Enter, Backspace do nothing in the grid or the table.
- Preview pane: small image; Download at the bottom, no way to open the viewer except a
  double-click; 19 metadata rows in one flat list with all-caps labels.
- Viewer: the micrograph has no scale. Field width, voltage and WD are known but not shown.
- Details: at 1440 px the table scrolls sideways (Gold and Uploaded are off-screen); headers wrap.
- Filter panel: "Batch date" shows inside a batch folder, where it does nothing. Active filters
  are only visible as a number on the filter button.
- Tree: long batch names are cut ("..._background_ns-la...").
- All-caps tracked labels everywhere (eyebrows, table headers, preview labels).

## Design plan

Principles
1. Images first. The grid is a contact sheet: micrographs fill their frames, chrome recedes.
2. Speak microscope. The one bold element: an SEM-style data bar (live scale bar, field width,
   HV, WD, pixel size) under the viewer image, the way every SEM micrograph carries one.
3. Works like a file manager: keyboard first, nothing hidden behind a double-click.
4. Quiet chrome: sentence-case labels, no all-caps, mono only for measured values.

Colour (brand kept: navy rail, NanoScout mint emblem, blue accent)
- Rail navy #161A2E · Workspace #F3F4F6 · Surface #FFFFFF · Text #1F2430 · Muted #6B7280
- Accent #5B7CFA (selection, focus, primary action)
- Matte #000000 behind every micrograph (grid frames, preview, viewer): grey-scale images are
  judged against true black, as on the microscope screen.

Type
- Plus Jakarta Sans for all UI text: 13 px body, 12 px secondary, 15 px pane title, weights 400/600.
- IBM Plex Mono only for measured values (sizes, µm, kV, the data bar).
- Labels in sentence case, muted colour; no letter-spaced capitals.

Layout
```
| rail | toolbar: back up  crumbs ............ search  filter sort  size-slider |
|      | active filter chips (only when set)                                  |
| tree | contact sheet (black-matted frames, name + field width under)  | pane|
|      |                                                                | img |
|      |                                                                |Open |
|      |                                                                |Down.|
|      |                                                                |group|
|      | status bar                                                           |
viewer: full-window image, top bar (name, n / total, Download, Close),
        bottom data bar: [scale bar 20 µm]  HFW 100.0 µm  HV 8 kV  WD 8.26 mm  pixel 52.08 nm
```
Left-aligned everywhere; numbers right-aligned in the table.

Review against generic defaults: the current tiles are the "SaaS card kit" (identical white
rounded cards, soft shadow). Revised: no card around a tile; a black-matted frame and a caption,
selection is an accent ring on the frame. The data bar replaces "stat chips" as the signature.

## Scope, in order of value

1. Contact-sheet grid: frames without cards, image fills the 16:10 frame (contain, never cropped),
   caption = name + field width; thumbnail size slider (S / M / L), remembered.
2. Keyboard: arrows move the selection (grid wraps by row, table by row), Enter opens a folder or
   the viewer, Backspace goes up, Space opens the viewer. Focus ring visible.
3. Preview pane: larger black-matted image, "Open" and "Download" at the top, metadata grouped
   (Image / Microscope / Dataset), sentence case, a copy-name button.
4. Viewer data bar: live scale bar that follows zoom, plus HFW, HV, WD, pixel size. Image always
   fits the stage.
5. Details: no sideways scroll at 1440 px, sticky header, sentence-case headers.
6. Filters: "Batch date" only at the top level; active filters as removable chips under the toolbar.
7. Tree: batch rows show the date in muted mono, then the rest; full name on hover.
8. States: skeleton frames while a folder loads; "No files match the filters" with a "Clear filters"
   button when filters hide everything.

Out of scope (own task): pipeline thumbnails are served without contrast stretch, so they look
darker than the converted previews. That is a server change in images.ts.
