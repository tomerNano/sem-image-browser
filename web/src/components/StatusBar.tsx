import { Show } from "solid-js";
import { itemCount } from "../lib/rows";
import { store } from "../store";

/** Registry problem worth a warning, or null. "Not configured" stays quiet: metadata is optional. */
function registryWarning(): string | null {
  const s = store.registry();
  if (store.registry.error) return "Registry status unavailable";
  if (!s || !s.configured || !s.error) return null;
  return s.loaded ? `Registry: ${s.error} (showing last good data)` : `Registry: ${s.error}, no metadata`;
}

/** Folder listing state for the pill at the right end of the bar. */
function listingState(): "loading" | "error" | "ready" {
  if (store.listing.loading) return "loading";
  return store.listing.error ? "error" : "ready";
}

export default function StatusBar() {
  const items = () => store.visibleFolders().length + store.visibleFiles().length;
  return (
    <footer class="statusbar">
      <span>
        {itemCount(items())} | {store.selected() ? 1 : 0} selected
        <Show when={store.hiddenByFilters() > 0}>
          {" "}| {store.hiddenByFilters()} hidden by filters
        </Show>
      </span>
      <Show when={registryWarning()}>{(w) => <span class="status-warning">{w()}</span>}</Show>
      <span class={`status-pill ${listingState()}`}>{listingState()}</span>
    </footer>
  );
}
