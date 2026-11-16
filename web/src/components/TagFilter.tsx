import { For, Show } from "solid-js";
import { tagChoices } from "../lib/rows";
import { store } from "../store";

/**
 * Split tags in the filter panel, under the batch dates: one toggle per tag of the batches in
 * this folder. With several tags chosen, a batch shows when it has any of them. Like the dates,
 * the tags hide batch folders only, in the list and in the tree.
 */
export default function TagFilter() {
  const choices = () => tagChoices(store.listedFolders(), store.tagFilter());
  return (
    <div class="tag-filter">
      <span class="eyebrow">Tag</span>
      <Show when={choices().length > 0} fallback={<span class="tag-none">No tags</span>}>
        <div class="tag-choices" role="group" aria-label="Tag">
          <For each={choices()}>
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
      </Show>
    </div>
  );
}
