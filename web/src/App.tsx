import { Show } from "solid-js";
import FileArea from "./components/FileArea";
import FolderTree from "./components/FolderTree";
import PreviewPane from "./components/PreviewPane";
import Splitter, { treeWidth } from "./components/Splitter";
import StatusBar from "./components/StatusBar";
import TopBar from "./components/TopBar";
import Viewer from "./components/Viewer";
import { store } from "./store";

export default function App() {
  return (
    <div class="app" style={{ "--tree-width": `${treeWidth()}px` }}>
      <FolderTree />
      <Splitter />
      <main class="main">
        <TopBar />
        <div class="workspace">
          <FileArea />
          <PreviewPane />
        </div>
        <StatusBar />
      </main>
      <Show when={store.viewerKey()} keyed>
        {(key) => <Viewer fileKey={key} />}
      </Show>
    </div>
  );
}
