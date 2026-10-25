// Folder navigation in the browser's own history: every folder opened in the app is one history
// entry, with the folder in the address ("/?path=2026-10-12_.../raw/"). The browser's back and
// forward (buttons, mouse side buttons, Alt+Left) then move between folders instead of leaving
// the site, a reload stays in the same folder, and an address can be shared.
import { createEffect, createRoot, createSignal } from "solid-js";
import { store } from "./store";

/** What each history entry remembers: the folder, and how many entries lie behind it. */
type Entry = { prefix: string; depth: number };

const current = () => history.state as Entry | null;

/** Address for a folder: "?path=<folder below the root>", or the bare page for the root. */
function urlFor(prefix: string): string {
  const below = prefix.slice(store.root().prefix.length);
  if (!below) return location.pathname;
  return "?path=" + below.split("/").map(encodeURIComponent).join("/");
}

/** The folder in the page address when the page loads (the store falls back to the root if it is invalid). */
export function startPrefix(rootPrefix: string): string {
  return rootPrefix + (new URLSearchParams(location.search).get("path") ?? "");
}

const [depth, setDepth] = createSignal(0);

/** True when the browser has an earlier folder of this app to go back to. */
export const canGoBack = () => depth() > 0;

/** The toolbar's back button does what the browser's back button does. */
export function goBack(): void {
  history.back();
}

/** Called once after the store is initialised. */
export function syncHistory(): void {
  // A reload keeps history.state, so the depth of earlier entries survives it.
  const start: Entry = { prefix: store.currentPrefix(), depth: current()?.depth ?? 0 };
  history.replaceState(start, "", urlFor(start.prefix));
  setDepth(start.depth);

  // Browser back or forward: open that entry's folder (the effect below then sees no change).
  window.addEventListener("popstate", () => {
    const entry = current();
    if (!entry) return;
    setDepth(entry.depth);
    store.navigate(entry.prefix);
  });

  // A folder opened in the app: add an entry for it.
  createRoot(() =>
    createEffect(() => {
      const prefix = store.currentPrefix();
      const here = current();
      if (here?.prefix === prefix) return;
      const next: Entry = { prefix, depth: (here?.depth ?? 0) + 1 };
      history.pushState(next, "", urlFor(prefix));
      setDepth(next.depth);
    }),
  );
}
