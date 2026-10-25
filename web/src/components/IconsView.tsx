import { For, Show } from "solid-js";
import { thumbUrl } from "../api";
import { field, MISSING } from "../lib/fields";
import { store } from "../store";
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

const fieldWidth = field("fieldWidth");

/**
 * Large icons: a contact sheet. Each micrograph shows at its real size in a 16:10 slot, with
 * its name and field width under it. Images load lazily, only when their frame scrolls into view.
 */
export default function IconsView() {
  return (
    <div class="icons">
      <For each={store.visibleFolders()}>
        {(folder) => (
          <div
            class="tile"
            classList={{ selected: store.isSelected(folder.prefix) }}
            data-id={folder.prefix}
            title={folder.name}
            onClick={(e) => {
              e.stopPropagation();
              store.select(folder.prefix);
            }}
            onDblClick={() => store.navigate(folder.prefix)}
          >
            <div class="frame folder">
              <FolderIcon size={48} />
            </div>
            <div class="caption">
              <span class="caption-name">
                <WrappableName name={folder.name} />
              </span>
            </div>
          </div>
        )}
      </For>
      <For each={store.visibleFiles()}>
        {(file) => (
          <div
            class="tile"
            classList={{ selected: store.isSelected(file.key) }}
            data-id={file.key}
            title={file.name}
            onClick={(e) => {
              e.stopPropagation();
              store.select(file.key);
            }}
            onDblClick={() => store.openViewer(file.key)}
          >
            <div class="frame">
              <img
                src={thumbUrl(file.key, file.uploaded)}
                alt=""
                loading="lazy"
                decoding="async"
                onError={(e) => e.currentTarget.parentElement?.classList.add("failed")}
              />
            </div>
            <div class="caption">
              <span class="caption-name">
                <WrappableName name={file.name} />
              </span>
              <Show when={fieldWidth.format(file) !== MISSING}>
                <span class="caption-value mono">{fieldWidth.format(file)}</span>
              </Show>
            </div>
          </div>
        )}
      </For>
    </div>
  );
}
