import { Show } from "solid-js";
import { store } from "../store";

/**
 * Page buttons under the items of a big folder, with the range shown ("201–400 of 4700").
 * Hidden when everything fits on one page. `onChange` runs after a button changes the page.
 */
export default function Pager(props: { onChange: () => void }) {
  const total = () => store.visibleIds().length;
  const first = () => store.page() * store.pageSize + 1;
  const last = () => Math.min(total(), (store.page() + 1) * store.pageSize);
  const atStart = () => store.page() === 0;
  const atEnd = () => store.page() === store.pageCount() - 1;

  function go(page: number) {
    store.setPage(page);
    props.onChange();
  }

  return (
    <Show when={store.pageCount() > 1}>
      <nav class="pager" aria-label="Pages" onClick={(e) => e.stopPropagation()}>
        <button class="pager-button" disabled={atStart()} onClick={() => go(0)} title="First page">
          «
        </button>
        <button class="pager-button" disabled={atStart()} onClick={() => go(store.page() - 1)} title="Previous page">
          ‹
        </button>
        <span class="pager-text">
          Page {store.page() + 1} of {store.pageCount()}
          <span class="pager-range">
            {first()}–{last()} of {total()}
          </span>
        </span>
        <button class="pager-button" disabled={atEnd()} onClick={() => go(store.page() + 1)} title="Next page">
          ›
        </button>
        <button class="pager-button" disabled={atEnd()} onClick={() => go(store.pageCount() - 1)} title="Last page">
          »
        </button>
      </nav>
    </Show>
  );
}
