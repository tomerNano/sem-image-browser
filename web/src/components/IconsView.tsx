import { For } from "solid-js";
import { thumbUrl } from "../api";
import { isSelected, store } from "../store";

/** Large icons: a grid of thumbnails. Images load lazily, only when their tile scrolls into view. */
export default function IconsView() {
  return (
    <div class="icons">
      <For each={store.visibleFolders()}>
        {(folder) => (
          <div
            class="tile"
            classList={{ selected: isSelected(folder.prefix) }}
            title={folder.name}
            onClick={(e) => {
              e.stopPropagation();
              store.select({ kind: "folder", entry: folder });
            }}
            onDblClick={() => store.navigate(folder.prefix)}
          >
            <div class="tile-image folder">📁</div>
            <div class="tile-name">{folder.name}</div>
          </div>
        )}
      </For>
      <For each={store.visibleFiles()}>
        {(file) => (
          <div
            class="tile"
            classList={{ selected: isSelected(file.key) }}
            title={file.name}
            onClick={(e) => {
              e.stopPropagation();
              store.select({ kind: "file", entry: file });
            }}
            onDblClick={() => store.openViewer(file.key)}
          >
            <div class="tile-image">
              <img
                src={thumbUrl(file.key)}
                alt=""
                loading="lazy"
                decoding="async"
                onError={(e) => e.currentTarget.classList.add("failed")}
              />
            </div>
            <div class="tile-name">{file.name}</div>
          </div>
        )}
      </For>
    </div>
  );
}
