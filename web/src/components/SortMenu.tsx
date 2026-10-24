import { For } from "solid-js";
import { SORT_COLUMNS, type SortDir } from "../lib/rows";
import { store } from "../store";
import { CheckIcon } from "./Icons";

const DIRECTIONS: { id: SortDir; label: string }[] = [
  { id: "asc", label: "Ascending" },
  { id: "desc", label: "Descending" },
];

/** Sort panel: same columns as the Details headers, so it also works in Large icons view. */
export default function SortMenu() {
  return (
    <div class="menu">
      <span class="eyebrow menu-title">Sort by</span>
      <For each={SORT_COLUMNS}>
        {(col) => (
          <button class="menu-item" onClick={() => store.setSort(col.id, store.sortDir())}>
            <span class="menu-check">{store.sortColumn() === col.id && <CheckIcon />}</span>
            {col.label}
          </button>
        )}
      </For>
      <span class="eyebrow menu-title">Order</span>
      <For each={DIRECTIONS}>
        {(dir) => (
          <button class="menu-item" onClick={() => store.setSort(store.sortColumn(), dir.id)}>
            <span class="menu-check">{store.sortDir() === dir.id && <CheckIcon />}</span>
            {dir.label}
          </button>
        )}
      </For>
    </div>
  );
}
