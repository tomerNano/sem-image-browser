import { For } from "solid-js";
import { store } from "../store";

/** Path parts from the root down, each with the prefix it opens: root, batch, raw. */
function crumbs(prefix: string): { name: string; prefix: string }[] {
  const root = store.root();
  const parts = prefix.slice(root.prefix.length).split("/").filter(Boolean);
  return [
    { name: root.name, prefix: root.prefix },
    ...parts.map((name, i) => ({ name, prefix: root.prefix + parts.slice(0, i + 1).join("/") + "/" })),
  ];
}

export default function TopBar() {
  return (
    <header class="topbar">
      <button class="icon-btn" title="Back" disabled={!store.canBack()} onClick={() => store.back()}>
        ←
      </button>
      <button class="icon-btn" title="Up" disabled={!store.canUp()} onClick={() => store.up()}>
        ↑
      </button>
      <nav class="address" aria-label="Current folder">
        <For each={crumbs(store.currentPrefix())}>
          {(crumb, i) => (
            <>
              {i() > 0 && <span class="sep">›</span>}
              <button class="crumb" onClick={() => store.navigate(crumb.prefix)}>
                {crumb.name}
              </button>
            </>
          )}
        </For>
      </nav>
      <input
        class="search"
        type="search"
        placeholder="Search this folder"
        value={store.search()}
        onInput={(e) => store.setSearch(e.currentTarget.value)}
      />
      <div class="view-toggle" role="group" aria-label="View">
        <button classList={{ active: store.view() === "icons" }} onClick={() => store.setView("icons")}>
          Large icons
        </button>
        <button classList={{ active: store.view() === "details" }} onClick={() => store.setView("details")}>
          Details
        </button>
      </div>
    </header>
  );
}
