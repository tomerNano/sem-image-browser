import { For } from "solid-js";
import { tagChoices } from "../lib/rows";
import { store } from "../store";

/**
 * Split tag in the filter panel, under the batch dates: "Any" plus the tags of the batches in
 * this folder. Like the dates, it hides batch folders only, in the list and in the tree.
 */
export default function TagFilter() {
  return (
    <div class="date-filter tag-filter">
      <label>
        <span class="eyebrow">Tag</span>
        <select value={store.tagFilter()} onChange={(e) => store.setTagFilter(e.currentTarget.value)}>
          <option value="">Any</option>
          <For each={tagChoices(store.listedFolders(), store.tagFilter())}>{(tag) => <option value={tag}>{tag}</option>}</For>
        </select>
      </label>
    </div>
  );
}
