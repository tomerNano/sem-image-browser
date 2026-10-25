import { For } from "solid-js";
import { FIELDS, type Field } from "../lib/fields";
import { store } from "../store";
import { FolderIcon, ImageIcon } from "./Icons";

/**
 * Details columns: every Field marked as a column, in table order. Date shows only at the top
 * level: inside a batch every file has the batch date, which the folder path already shows.
 * With no files shown (folders only), only the columns a folder fills in (name, date) remain.
 */
const columns = () =>
  FIELDS.filter(
    (f) =>
      f.column &&
      (f.id !== "date" || !store.canUp()) &&
      (store.visibleFiles().length > 0 || f.folder !== undefined),
  );

const cellClass = (f: Field) => ({ text: "", mono: "mono", num: "num mono" })[f.column!.cell];

export default function DetailsView() {
  return (
    <table class="details">
      <thead>
        <tr>
          <For each={columns()}>
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
              classList={{ selected: store.isSelected(folder.prefix) }}
              data-id={folder.prefix}
              onClick={(e) => {
                e.stopPropagation();
                store.select(folder.prefix);
              }}
              onDblClick={() => store.navigate(folder.prefix)}
            >
              <For each={columns()}>
                {(col) =>
                  col.id === "name" ? (
                    <td>
                      <span class="row-name">
                        <span class="folder-glyph">
                          <FolderIcon />
                        </span>
                        {folder.name}
                      </span>
                    </td>
                  ) : (
                    <td class={cellClass(col)}>{col.folder?.(folder) ?? ""}</td>
                  )
                }
              </For>
            </tr>
          )}
        </For>
        <For each={store.visibleFiles()}>
          {(file) => (
            <tr
              classList={{ selected: store.isSelected(file.key) }}
              data-id={file.key}
              onClick={(e) => {
                e.stopPropagation();
                store.select(file.key);
              }}
              onDblClick={() => store.openViewer(file.key)}
            >
              <For each={columns()}>
                {(col) =>
                  col.id === "name" ? (
                    <td>
                      <span class="row-name">
                        <ImageIcon />
                        {file.name}
                      </span>
                    </td>
                  ) : (
                    <td class={cellClass(col)}>{col.format(file)}</td>
                  )
                }
              </For>
            </tr>
          )}
        </For>
      </tbody>
    </table>
  );
}
