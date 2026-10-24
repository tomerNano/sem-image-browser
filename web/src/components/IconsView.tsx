import { For } from "solid-js";
import { thumbUrl } from "../api";
import { isSelected, store } from "../store";
import { FolderIcon } from "./Icons";

/**
 * A long name like "2026-10-19_miluda_5b_background_ns-lab_b001" has no spaces, so the browser
 * cannot wrap it. <wbr> after each "_" and "-" allows a line break there without changing the
 * text (copy and paste still give the exact name).
 */
function WrappableName(props: { name: string }) {
  return (
    <For each={props.name.split(/(?<=[_-])/)}>
      {(part, i) => (
        <>
          {i() > 0 && <wbr />}
          {part}
        </>
      )}
    </For>
  );
}

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
            <div class="tile-image folder">
              <FolderIcon size={64} />
            </div>
            <div class="tile-name">
              <WrappableName name={folder.name} />
            </div>
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
                onError={(e) => e.currentTarget.parentElement?.classList.add("failed")}
              />
            </div>
            <div class="tile-name">
              <WrappableName name={file.name} />
            </div>
          </div>
        )}
      </For>
    </div>
  );
}
