import { createResource, createSignal, For, Match, Show, Switch } from "solid-js";
import { downloadUrl, listFolder, previewUrl } from "../api";
import { FIELDS, PREVIEW_GROUPS, type Field, type PreviewGroup } from "../lib/fields";
import { itemCount } from "../lib/rows";
import { store } from "../store";
import type { FileEntry, ListResult } from "../types";
import { CheckIcon, CopyIcon, FolderIcon } from "./Icons";

function lastPart(prefix: string): string {
  const parts = prefix.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? "";
}

const GROUP_TITLE: Record<PreviewGroup, string> = {
  file: "File",
  image: "Image",
  microscope: "Microscope",
  dataset: "Dataset",
};

/** Preview rows of each group, in table order. */
const ROWS: Record<PreviewGroup, Field[]> = Object.fromEntries(
  PREVIEW_GROUPS.map((g) => [g, FIELDS.filter((f) => f.preview === g)]),
) as Record<PreviewGroup, Field[]>;

/** One titled group of label/value rows. */
function FieldGroup(props: { group: PreviewGroup; file: FileEntry }) {
  return (
    <section class="preview-group">
      <h5>{GROUP_TITLE[props.group]}</h5>
      <dl class="preview-meta">
        <For each={ROWS[props.group]}>
          {(f) => (
            <>
              <dt>{f.label}</dt>
              {/* Measured values (numbers with units) in mono, text in the UI face. */}
              <dd classList={{ mono: typeof f.value(props.file) === "number" }}>{f.format(props.file)}</dd>
            </>
          )}
        </For>
      </dl>
    </section>
  );
}

/** Copies a file name to the clipboard and shows a check mark for a moment. */
function CopyName(props: { name: string }) {
  const [copied, setCopied] = createSignal(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(props.name);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked (insecure origin or denied): the name can still be selected by hand.
    }
  };
  return (
    <button class="icon-btn copy-name" title={copied() ? "Copied" : "Copy file name"} aria-label="Copy file name" onClick={copy}>
      <Show when={copied()} fallback={<CopyIcon size={15} />}>
        <CheckIcon size={15} />
      </Show>
    </button>
  );
}

function FilePreview(props: { file: FileEntry }) {
  const [failed, setFailed] = createSignal(false);
  return (
    <>
      <div class="preview-frame">
        <Show when={!failed()} fallback={<span class="no-preview">No preview. The original can still be downloaded.</span>}>
          <img src={previewUrl(props.file.key, props.file.uploaded)} alt={props.file.name} onError={() => setFailed(true)} />
        </Show>
      </div>
      <div class="preview-title">
        <h4>{props.file.name}</h4>
        <CopyName name={props.file.name} />
      </div>
      <div class="preview-actions">
        <button class="action primary" onClick={() => store.openViewer(props.file.key)}>
          Open <kbd>Space</kbd>
        </button>
        <a class="action" href={downloadUrl(props.file.key)} download={props.file.name}>
          Download
        </a>
      </div>
      <FieldGroup group="file" file={props.file} />
      <Show when={props.file.meta} fallback={<p class="no-meta">No Registry metadata for this file.</p>}>
        <For each={PREVIEW_GROUPS.filter((g) => g !== "file")}>{(g) => <FieldGroup group={g} file={props.file} />}</For>
      </Show>
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
        <Match when={selectedFolder()} keyed>
          {(prefix) => (
            <>
              <div class="preview-frame folder">
                <FolderIcon size={56} />
              </div>
              <div class="preview-title">
                <h4>{lastPart(prefix)}</h4>
              </div>
              <p>{folderListing.error ? "Could not load" : count(folderListing())}</p>
              <div class="preview-actions">
                <button class="action primary" onClick={() => store.navigate(prefix)}>
                  Open <kbd>Enter</kbd>
                </button>
              </div>
            </>
          )}
        </Match>
        <Match when={store.selected() === null}>
          <div class="preview-frame folder">
            <FolderIcon size={56} />
          </div>
          <div class="preview-title">
            <h4>{lastPart(store.currentPrefix())}</h4>
          </div>
          <p>{itemCount(store.visibleFolders().length + store.visibleFiles().length)}</p>
        </Match>
      </Switch>
    </aside>
  );
}
