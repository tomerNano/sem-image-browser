import { For } from "solid-js";
import { formatGold, formatMicrons, formatPixelSize, formatSize, resolution, SORT_COLUMNS } from "../lib/rows";
import { isSelected, store } from "../store";
import { FolderIcon, ImageIcon } from "./Icons";

export default function DetailsView() {
  return (
    <table class="details">
      <thead>
        <tr>
          <For each={SORT_COLUMNS}>
            {(col) => (
              <th class="eyebrow" onClick={() => store.sortBy(col.id)}>
                {col.label}
                {store.sortColumn() === col.id ? (store.sortDir() === "asc" ? " ▲" : " ▼") : ""}
              </th>
            )}
          </For>
        </tr>
      </thead>
      <tbody>
        <For each={store.visibleFolders()}>
          {(folder) => (
            <tr
              classList={{ selected: isSelected(folder.prefix) }}
              onClick={(e) => {
                e.stopPropagation();
                store.select({ kind: "folder", entry: folder });
              }}
              onDblClick={() => store.navigate(folder.prefix)}
            >
              <td>
                <span class="row-name">
                  <span class="folder-glyph">
                    <FolderIcon />
                  </span>
                  {folder.name}
                </span>
              </td>
              <td class="mono">{folder.date ?? ""}</td>
              <td />
              <td />
              <td />
              <td />
              <td />
              <td />
              <td />
              <td />
            </tr>
          )}
        </For>
        <For each={store.visibleFiles()}>
          {(file) => (
            <tr
              classList={{ selected: isSelected(file.key) }}
              onClick={(e) => {
                e.stopPropagation();
                store.select({ kind: "file", entry: file });
              }}
              onDblClick={() => store.openViewer(file.key)}
            >
              <td>
                <span class="row-name">
                  <ImageIcon />
                  {file.name}
                </span>
              </td>
              <td class="mono">{file.date ?? ""}</td>
              <td class="num mono">{formatSize(file.size)}</td>
              <td class="num mono">{formatMicrons(file.meta?.fieldWidthUm ?? null)}</td>
              <td class="num mono">{formatPixelSize(file.meta?.pixelSizeUm ?? null)}</td>
              <td class="num mono">{(file.meta && resolution(file.meta)) || "—"}</td>
              <td>{file.meta?.instrument || "—"}</td>
              <td>{file.meta?.detector || "—"}</td>
              <td>{formatGold(file.meta?.gold)}</td>
              <td class="mono">{new Date(file.uploaded).toLocaleString()}</td>
            </tr>
          )}
        </For>
      </tbody>
    </table>
  );
}
