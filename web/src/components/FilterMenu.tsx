import { Show } from "solid-js";
import { store } from "../store";
import DateFilter from "./DateFilter";
import MetaFilters from "./MetaFilters";

/** Filter panel: batch dates, then Registry fields, then one button to clear them all. */
export default function FilterMenu() {
  return (
    <div class="menu filter-menu">
      <span class="eyebrow menu-title">Batch date</span>
      <DateFilter />
      <span class="eyebrow menu-title">Image</span>
      <MetaFilters />
      <Show when={store.activeFilterCount() > 0}>
        <button class="clear-filters" onClick={() => store.clearAllFilters()}>
          Clear all
        </button>
      </Show>
    </div>
  );
}
