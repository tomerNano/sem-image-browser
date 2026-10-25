import { onCleanup, onMount, Show } from "solid-js";
import FileArea from "./components/FileArea";
import FolderTree from "./components/FolderTree";
import PreviewPane from "./components/PreviewPane";
import Splitter, { pane, sidebarOpen, toggleSidebar, tree, treeWidth } from "./components/Splitter";
import StatusBar from "./components/StatusBar";
import TopBar from "./components/TopBar";
import Viewer from "./components/Viewer";
import { store } from "./store";

export default function App() {
  // Ctrl+B (Cmd+B on a Mac) opens or closes the sidebar from anywhere.
  function onKey(e: KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "b") {
      e.preventDefault();
      toggleSidebar();
    }
  }
  onMount(() => window.addEventListener("keydown", onKey));
  onCleanup(() => window.removeEventListener("keydown", onKey));

  return (
    <div
      class="app"
      classList={{ "sidebar-closed": !sidebarOpen() }}
      style={{ "--tree-width": `${treeWidth()}px`, "--pane-width": `${pane.width()}px` }}
    >
      {/* Closed = a narrow rail (emblem + toggle). The tree is hidden with CSS, not removed,
          so it keeps its expanded folders. */}
      <FolderTree />
      <Splitter target={tree} side="left" label="Resize folder tree" />
      <main class="main">
        <TopBar />
        <div class="workspace">
          <FileArea />
          <Splitter target={pane} side="right" label="Resize preview pane" />
          <PreviewPane />
        </div>
        <StatusBar />
      </main>
      <Show when={store.viewer()?.file.key} keyed>
        {(key) => <Viewer fileKey={key} />}
      </Show>
    </div>
  );
}
