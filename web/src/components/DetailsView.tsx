import { createEffect, For } from "solid-js";
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

const cellClass = (f: Field) => ({ text: "", mono: "mono", num: "num mono", tags: "" })[f.column!.cell];

/**
 * Checkbox in the first column: a click adds or removes the item, like Ctrl+click (Shift adds a
 * range). It never takes keyboard focus, so the arrow keys keep moving through the list.
 */
function SelectBox(props: { id: string; name: string }) {
  return (
    <td class="check-cell">
      <input
        type="checkbox"
        tabIndex={-1}
        aria-label={`Select ${props.name}`}
        checked={store.isSelected(props.id)}
        onMouseDown={(e) => e.preventDefault()}
        onClick={(e) => {
          e.stopPropagation();
          store.clickItem(props.id, { toggle: true, range: e.shiftKey });
          // The browser already flipped the box; a Shift range may keep it checked instead.
          e.currentTarget.checked = store.isSelected(props.id);
        }}
        onDblClick={(e) => e.stopPropagation()}
      />
    </td>
  );
}

/** Header checkbox: checked when every shown item is selected, a dash when only some are. */
function SelectAllBox() {
  const count = () => store.selection().length;
  const all = () => count() > 0 && count() === store.visibleIds().length;
  return (
    <th class="check-cell">
      <input
        type="checkbox"
        tabIndex={-1}
        aria-label="Select all"
        checked={all()}
        ref={(el) => createEffect(() => (el.indeterminate = count() > 0 && !all()))}
        onMouseDown={(e) => e.preventDefault()}
        onClick={(e) => {
          e.stopPropagation();
          if (all()) store.select(null);
          else store.selectAll();
          e.currentTarget.checked = all();
        }}
      />
    </th>
  );
}

export default function DetailsView() {
  return (
    <table class="details">
      <thead>
        <tr>
          <SelectAllBox />
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
        <For each={store.pageFolders()}>
          {(folder) => (
            <tr
              classList={{ selected: store.isSelected(folder.prefix) }}
              data-id={folder.prefix}
              onClick={(e) => {
                e.stopPropagation();
                store.clickItem(folder.prefix, { toggle: e.ctrlKey || e.metaKey, range: e.shiftKey });
              }}
              onDblClick={() => store.navigate(folder.prefix)}
            >
              <SelectBox id={folder.prefix} name={folder.name} />
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
        <For each={store.pageFiles()}>
          {(file) => (
            <tr
              classList={{ selected: store.isSelected(file.key) }}
              data-id={file.key}
              onClick={(e) => {
                e.stopPropagation();
                store.clickItem(file.key, { toggle: e.ctrlKey || e.metaKey, range: e.shiftKey });
              }}
              onDblClick={() => store.openViewer(file.key)}
            >
              <SelectBox id={file.key} name={file.name} />
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
