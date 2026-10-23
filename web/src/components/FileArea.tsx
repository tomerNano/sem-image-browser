import { Show } from "solid-js";
import { store } from "../store";
import DetailsView from "./DetailsView";
import IconsView from "./IconsView";

export default function FileArea() {
  const isEmpty = () => store.visibleFolders().length === 0 && store.visibleFiles().length === 0;

  return (
    <section class="file-area" onClick={() => store.select(null)}>
      <Show when={store.listing.error}>
        <p class="error">Could not load this folder: {(store.listing.error as Error).message}</p>
      </Show>
      <Show when={store.listing.loading}>
        <p class="loading">Loading…</p>
      </Show>
      <Show when={!store.listing.error && !store.listing.loading && isEmpty()}>
        <p class="empty">This folder is empty.</p>
      </Show>
      <Show when={!store.listing.error && !isEmpty()}>
        <Show when={store.view() === "icons"} fallback={<DetailsView />}>
          <IconsView />
        </Show>
      </Show>
    </section>
  );
}
