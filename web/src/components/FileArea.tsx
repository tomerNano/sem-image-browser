import { For, Match, onCleanup, onMount, Show, Switch } from "solid-js";
import { moveIndex } from "../lib/keys";
import { store, type Selection } from "../store";
import DetailsView from "./DetailsView";
import IconsView from "./IconsView";
import Pager from "./Pager";

/** Grey frames in the shape of the contact sheet while a folder loads. */
function Skeleton() {
  return (
    <div class="icons" aria-hidden="true">
      <For each={Array.from({ length: 12 })}>
        {() => (
          <div class="tile">
            <div class="frame skeleton" />
            <div class="caption skeleton" />
          </div>
        )}
      </For>
    </div>
  );
}

/**
 * The folder's items as large icons or a table, plus its loading, error, empty and
 * "nothing matches" states. Keyboard: arrows move the selection (Shift+arrows grow it),
 * Ctrl+A selects everything shown, Enter or Space opens a single selected item, Backspace goes
 * up a folder. Ctrl+click adds or removes one item; Shift+click selects a range.
 */
export default function FileArea() {
  let area!: HTMLElement;
  const total = () => (store.listing()?.folders.length ?? 0) + store.folderFiles().length;
  const shown = () => store.visibleFolders().length + store.visibleFiles().length;

  /** Columns of the current layout: the contact sheet's grid tracks, or 1 for the table. */
  const columns = () => {
    if (store.view() === "details") return 1;
    const grid = area.querySelector<HTMLElement>(".icons");
    return grid ? getComputedStyle(grid).gridTemplateColumns.split(" ").length : 1;
  };

  function open(s: Selection) {
    if (s.kind === "folder") store.navigate(s.entry.prefix);
    else store.openViewer(s.entry.key);
  }

  function onKey(e: KeyboardEvent) {
    if (store.viewer() || e.defaultPrevented || e.altKey) return;
    const target = e.target instanceof Element ? e.target : document.body;
    if (target.closest("input, select, textarea, [contenteditable], .popover-panel")) return;

    if (e.ctrlKey || e.metaKey) {
      if (e.key.toLowerCase() === "a" && !e.shiftKey) {
        e.preventDefault();
        store.selectAll();
      }
      return;
    }

    const selected = store.selected();
    if (e.key === "Enter" || e.key === " ") {
      // A focused button or link handles its own Enter and Space.
      if (!selected || target.closest("button, a")) return;
      e.preventDefault();
      open(selected);
      return;
    }
    if (e.key === "Backspace") {
      e.preventDefault();
      store.up();
      return;
    }

    const ids = store.visibleIds();
    const focused = store.focused();
    const index = focused === null ? -1 : ids.indexOf(focused);
    const next = moveIndex(e.key, index, ids.length, columns());
    if (next === null) return;
    e.preventDefault();
    // Shift+arrow grows the selection from the anchor, like Shift+click.
    if (e.shiftKey) store.selectRange(ids[next]);
    else store.select(ids[next]);
    area.querySelector(`[data-id="${CSS.escape(ids[next])}"]`)?.scrollIntoView({ block: "nearest" });
  }
  onMount(() => window.addEventListener("keydown", onKey));
  onCleanup(() => window.removeEventListener("keydown", onKey));

  return (
    <section
      class="file-area"
      ref={area}
      // Shift+click would otherwise also select page text between the two items.
      onMouseDown={(e) => e.shiftKey && e.preventDefault()}
      onClick={(e) => !(e.ctrlKey || e.metaKey || e.shiftKey) && store.select(null)}
    >
      <Switch>
        <Match when={store.listing.error}>
          <p class="error">Could not load this folder: {(store.listing.error as Error).message}</p>
        </Match>
        <Match when={store.listing.loading}>
          <Show when={store.view() === "icons"} fallback={<p class="loading">Loading…</p>}>
            <Skeleton />
          </Show>
        </Match>
        <Match when={total() === 0}>
          <p class="empty">This folder is empty.</p>
        </Match>
        <Match when={shown() === 0}>
          <div class="empty">
            <p>No items match.</p>
            <p class="empty-detail">
              {store.search() ? "The search" : "The filters"} hide all {total()} items in this folder.
            </p>
            <div class="empty-actions" onClick={(e) => e.stopPropagation()}>
              <Show when={store.search()}>
                <button class="action" onClick={() => store.setSearch("")}>
                  Clear search
                </button>
              </Show>
              <Show when={store.activeFilterCount() > 0}>
                <button class="action primary" onClick={() => store.clearAllFilters()}>
                  Clear filters
                </button>
              </Show>
            </div>
          </div>
        </Match>
        <Match when={true}>
          <Show when={store.view() === "icons"} fallback={<DetailsView />}>
            <IconsView />
          </Show>
          <Pager onChange={() => area.scrollTo({ top: 0 })} />
        </Match>
      </Switch>
    </section>
  );
}
