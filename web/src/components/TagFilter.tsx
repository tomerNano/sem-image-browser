import { createSignal, For, Show } from "solid-js";
import { searchTags, tagChoices } from "../lib/rows";
import { store } from "../store";

/** With more tags than this, a search box shows above them. */
const TAG_SEARCH_MIN = 12;

/**
 * Split tags in the filter panel, under the batch dates: one toggle per tag of the batches in
 * this folder. With several tags chosen, a batch shows when it has any of them. Like the dates,
 * the tags hide batch folders only, in the list and in the tree. Many tags get a search box.
 */
export default function TagFilter() {
  const [query, setQuery] = createSignal("");
  const choices = () => tagChoices(store.listedFolders(), store.tagFilter());
  const shown = () => searchTags(choices(), query(), store.tagFilter());
  return (
    <div class="tag-filter">
      <span class="eyebrow">Tag</span>
      <Show when={choices().length > 0} fallback={<span class="tag-none">No tags</span>}>
        <div class="tag-picker">
          <Show when={choices().length > TAG_SEARCH_MIN}>
            <input
              type="search"
              class="tag-search"
              placeholder={`Search ${choices().length} tags`}
              aria-label="Search tags"
              value={query()}
              onInput={(e) => setQuery(e.currentTarget.value)}
            />
          </Show>
          <div class="tag-choices" role="group" aria-label="Tag">
            <For each={shown()} fallback={<span class="tag-none">No tag matches</span>}>
              {(tag) => (
                <button
                  type="button"
                  class="tag-choice"
                  classList={{ chosen: store.tagFilter().includes(tag) }}
                  aria-pressed={store.tagFilter().includes(tag)}
                  onClick={() => store.toggleTag(tag)}
                >
                  {tag}
                </button>
              )}
            </For>
          </div>
        </div>
      </Show>
    </div>
  );
}
