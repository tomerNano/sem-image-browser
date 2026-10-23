import { Show } from "solid-js";
import FileArea from "./components/FileArea";
import FolderTree from "./components/FolderTree";
import PreviewPane from "./components/PreviewPane";
import StatusBar from "./components/StatusBar";
import TopBar from "./components/TopBar";
import Viewer from "./components/Viewer";
import { store } from "./store";

export default function App() {
  return (
    <div class="app">
      <TopBar />
      <div class="panes">
        <FolderTree />
        <FileArea />
        <PreviewPane />
      </div>
      <StatusBar />
      <Show when={store.viewerKey()} keyed>
        {(key) => <Viewer fileKey={key} />}
      </Show>
    </div>
  );
}
