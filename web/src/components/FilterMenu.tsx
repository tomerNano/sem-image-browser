import { Show } from "solid-js";
import { store } from "../store";
import DateFilter from "./DateFilter";
import FieldFilters from "./FieldFilters";
import TagFilter from "./TagFilter";

/**
 * Filter panel: batch dates and tag (only at the top level, where the batches are), then Fields,
 * then one button to clear them all. Batch filters set at the top level still apply in the tree.
 */
export default function FilterMenu() {
  return (
    <div class="menu filter-menu">
      <Show when={!store.canUp()}>
        <span class="eyebrow menu-title">Batch</span>
        <DateFilter />
        <TagFilter />
      </Show>
      <span class="eyebrow menu-title">Image</span>
      <FieldFilters />
      <Show when={store.activeFilterCount() > 0}>
        <button class="clear-filters" onClick={() => store.clearAllFilters()}>
          Clear filters
        </button>
      </Show>
    </div>
  );
}
