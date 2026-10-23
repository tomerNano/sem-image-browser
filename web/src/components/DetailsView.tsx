import { For } from "solid-js";
import { formatSize, type SortColumn } from "../lib/rows";
import { isSelected, store } from "../store";

const COLUMNS: { id: SortColumn; label: string }[] = [
  { id: "name", label: "Name" },
  { id: "date", label: "Date" },
  { id: "size", label: "Size" },
  { id: "uploaded", label: "Uploaded" },
];

export default function DetailsView() {
  return (
    <table class="details">
      <thead>
        <tr>
          <For each={COLUMNS}>
            {(col) => (
              <th onClick={() => store.sortBy(col.id)}>
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
                <span class="folder-icon">📁</span> {folder.name}
              </td>
              <td>{folder.date ?? ""}</td>
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
                <span class="file-icon">🖼</span> {file.name}
              </td>
              <td>{file.date ?? ""}</td>
              <td class="num">{formatSize(file.size)}</td>
              <td>{new Date(file.uploaded).toLocaleString()}</td>
            </tr>
          )}
        </For>
      </tbody>
    </table>
  );
}
