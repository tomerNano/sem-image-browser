import { createResource, Match, Switch } from "solid-js";
import { downloadUrl, listFolder, previewUrl } from "../api";
import { formatSize, itemCount } from "../lib/rows";
import { store } from "../store";
import type { FileEntry, ListResult } from "../types";

function lastPart(prefix: string): string {
  const parts = prefix.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? "";
}

function FilePreview(props: { file: FileEntry }) {
  return (
    <>
      {/* "Loading…" sits behind the image and is covered once the picture arrives. */}
      <div class="preview-image">
        <span>Loading…</span>
        <img src={previewUrl(props.file.key)} alt={props.file.name} onError={(e) => e.currentTarget.remove()} />
      </div>
      <h4>{props.file.name}</h4>
      <p>Date: {props.file.date ?? "unknown"}</p>
      <p>Size: {formatSize(props.file.size)}</p>
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
          <div class="preview-folder">📁</div>
          <h4>{lastPart(selectedFolder() || "")}</h4>
          <p>{folderListing.error ? "Could not load" : count(folderListing())}</p>
        </Match>
        <Match when={store.selected() === null}>
          <div class="preview-folder">📁</div>
          <h4>{lastPart(store.currentPrefix())}</h4>
          <p>{itemCount(store.visibleFolders().length + store.visibleFiles().length)}</p>
        </Match>
      </Switch>
    </aside>
  );
}
