import { createResource, createSignal, For, Match, Show, Switch } from "solid-js";
import { downloadUrl, listFolder, previewUrl } from "../api";
import { formatGold, formatMicrons, formatPixelSize, formatSize, itemCount } from "../lib/rows";
import { store } from "../store";
import type { FileEntry, ImageMeta, ListResult } from "../types";
import { FolderIcon } from "./Icons";

function lastPart(prefix: string): string {
  const parts = prefix.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? "";
}

/** A number (at most 2 decimals) with its unit, or "—" when the Registry has no value. */
function withUnit(n: number | null, unit: string): string {
  return n === null ? "—" : `${Math.round(n * 100) / 100} ${unit}`;
}

/** Label/value pairs for the preview pane, in the order a biologist reads them. */
function metaRows(m: ImageMeta): [string, string][] {
  const fieldHeight = m.fieldHeightUm === null ? "" : ` × ${formatMicrons(m.fieldHeightUm)}`;
  return [
    ["Acquired", m.acquiredAt?.replace("T", " ") ?? "—"],
    ["Field", formatMicrons(m.fieldWidthUm) + fieldHeight],
    ["Pixel", formatPixelSize(m.pixelSizeUm)],
    ["Image", m.widthPx !== null && m.heightPx !== null ? `${m.widthPx} × ${m.heightPx} px` : "—"],
    ["Instrument", m.instrument || "—"],
    ["Detector", m.detector || "—"],
    ["Voltage", withUnit(m.voltageKv, "kV")],
    ["WD", withUnit(m.workingDistanceMm, "mm")],
    ["Dwell", withUnit(m.dwellTimeNs, "ns")],
    ["Spot", m.spotSize === null ? "—" : String(Math.round(m.spotSize * 100) / 100)],
    ["Integr.", m.integrations === null ? "—" : String(m.integrations)],
    ["Gold", formatGold(m.gold)],
    ["Experiment", m.experiment || "—"],
    ["Source", m.source || "—"],
    ["Variant", m.variant || "—"],
    ["Image ID", m.imageId || "—"],
  ];
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
          <img src={previewUrl(props.file.key)} alt={props.file.name} onError={() => setFailed(true)} />
        </Show>
      </div>
      <h4>{props.file.name}</h4>
      <dl class="preview-meta">
        <dt class="eyebrow">Date</dt>
        <dd class="mono">{props.file.date ?? "unknown"}</dd>
        <dt class="eyebrow">Size</dt>
        <dd class="mono">{formatSize(props.file.size)}</dd>
      </dl>
      <Show when={props.file.meta} fallback={<p class="no-meta">No Registry metadata for this file.</p>}>
        {(meta) => (
          <>
            <h5 class="eyebrow">Registry</h5>
            <dl class="preview-meta">
              <For each={metaRows(meta())}>
                {([label, value]) => (
                  <>
                    <dt class="eyebrow">{label}</dt>
                    <dd class="mono">{value}</dd>
                  </>
                )}
              </For>
            </dl>
          </>
        )}
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
