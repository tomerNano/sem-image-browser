import { createResource, createSignal, For, Match, Show, Switch } from "solid-js";
import { downloadUrl, listFolder, previewUrl } from "../api";
import { FIELDS, type Field } from "../lib/fields";
import { itemCount } from "../lib/rows";
import { store } from "../store";
import type { FileEntry, ListResult } from "../types";
import { FolderIcon } from "./Icons";

function lastPart(prefix: string): string {
  const parts = prefix.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? "";
}

/** Preview rows of one section, in table order. */
const FILE_ROWS = FIELDS.filter((f) => f.preview === "file");
const REGISTRY_ROWS = FIELDS.filter((f) => f.preview === "registry");

/** Label/value list of some Fields of one file. */
function FieldRows(props: { fields: Field[]; file: FileEntry }) {
  return (
    <dl class="preview-meta">
      <For each={props.fields}>
        {(f) => (
          <>
            <dt class="eyebrow">{f.label}</dt>
            <dd class="mono">{f.format(props.file)}</dd>
          </>
        )}
      </For>
    </dl>
  );
}

function FilePreview(props: { file: FileEntry }) {
  const [failed, setFailed] = createSignal(false);
  return (
    <>
      {/* "Loading…" sits behind the image and is covered once the picture arrives. */}
      <div class="preview-image">
        <Show
          when={!failed()}
          fallback={<span class="no-preview">Preview not available. The original can still be downloaded.</span>}
        >
          <span>Loading…</span>
          <img src={previewUrl(props.file.key, props.file.uploaded)} alt={props.file.name} onError={() => setFailed(true)} />
        </Show>
      </div>
      <h4>{props.file.name}</h4>
      <FieldRows fields={FILE_ROWS} file={props.file} />
      <Show when={props.file.meta} fallback={<p class="no-meta">No Registry metadata for this file.</p>}>
        <h5 class="eyebrow">Registry</h5>
        <FieldRows fields={REGISTRY_ROWS} file={props.file} />
      </Show>
      <a class="download-btn" href={downloadUrl(props.file.key)} download={props.file.name}>
        Download
      </a>
    </>
  );
}

export default function PreviewPane() {
  const selectedFolder = () => {
    const s = store.selected();
    return s?.kind === "folder" ? s.entry.prefix : false;
  };
  const selectedFile = () => {
    const s = store.selected();
    return s?.kind === "file" ? s.entry : undefined;
  };
  // The item count of a selected sub-folder needs one extra listing.
  const [folderListing] = createResource(selectedFolder, listFolder);
  const count = (r: ListResult | undefined) => (r ? itemCount(r.folders.length + r.files.length) : "…");

  return (
    <aside class="preview-pane">
      <Switch>
        {/* keyed: a new selected file rebuilds the preview, so the old picture never lingers. */}
        <Match when={selectedFile()} keyed>
          {(file) => <FilePreview file={file} />}
        </Match>
        <Match when={store.selected()?.kind === "folder"}>
          <div class="preview-folder">
            <FolderIcon size={64} />
          </div>
          <h4>{lastPart(selectedFolder() || "")}</h4>
          <p>{folderListing.error ? "Could not load" : count(folderListing())}</p>
        </Match>
        <Match when={store.selected() === null}>
          <div class="preview-folder">
            <FolderIcon size={64} />
          </div>
          <h4>{lastPart(store.currentPrefix())}</h4>
          <p>{itemCount(store.visibleFolders().length + store.visibleFiles().length)}</p>
        </Match>
      </Switch>
    </aside>
  );
}
