import { createEffect, createSignal, For, on, onCleanup, onMount, Show } from "solid-js";
import { downloadUrl, previewUrl, thumbUrl } from "../api";
import { field, type FieldId } from "../lib/fields";
import { scaleBar } from "../lib/scale";
import { store } from "../store";
import { NextIcon, PrevIcon } from "./Icons";

const MIN_SCALE = 1;
const MAX_SCALE = 10;
/** Neighbours whose previews load in the background: two ahead, one behind. */
const PREFETCH = [1, 2, -1];
/** Values in the data bar under the image, as an SEM shows them. */
const DATA_BAR: { id: FieldId; label: string }[] = [
  { id: "fieldWidth", label: "Field width" },
  { id: "voltage", label: "Voltage" },
  { id: "workingDistance", label: "Working distance" },
  { id: "pixelSize", label: "Pixel size" },
  { id: "detector", label: "Detector" },
];

/** Full-window image viewer: wheel zooms around the cursor, drag pans, arrows step, Esc closes. */
export default function Viewer(props: { fileKey: string }) {
  const [scale, setScale] = createSignal(1);
  const [offset, setOffset] = createSignal({ x: 0, y: 0 });
  const [failed, setFailed] = createSignal(false);
  const [loaded, setLoaded] = createSignal(false);
  // A signal, not a plain variable: the stage's "dragging" class (grabbing cursor) reads it.
  const [drag, setDrag] = createSignal<{ x: number; y: number; ox: number; oy: number } | null>(null);
  let stage!: HTMLDivElement;
  // Stage size and the image's width/height ratio: together they give the drawn image width.
  const [box, setBox] = createSignal({ w: 0, h: 0 });
  const [ratio, setRatio] = createSignal(1.6);
  onMount(() => {
    const measure = () => setBox({ w: stage.clientWidth, h: stage.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    onCleanup(() => observer.disconnect());
  });

  // The store owns the position among the visible files; null only while this viewer closes.
  const view = () => store.viewer();
  const file = () => view()?.file;
  const uploaded = () => file()?.uploaded ?? "";

  const reset = () => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  };
  // A new image starts unzoomed, with no error, showing its thumbnail until the preview loads.
  createEffect(
    on(
      () => props.fileKey,
      () => {
        reset();
        setFailed(false);
        setLoaded(false);
      },
    ),
  );

  // Ask for the neighbours' previews now, so stepping finds them in the browser cache.
  createEffect(() => {
    for (const delta of PREFETCH) {
      const neighbour = view()?.at(delta);
      if (neighbour) new Image().src = previewUrl(neighbour.key, neighbour.uploaded);
    }
  });

  /** Scale bar for the image as drawn now (object-fit: contain, then zoomed). */
  const bar = () => {
    const drawn = Math.min(box().w, box().h * ratio()) * scale();
    return scaleBar(file()?.meta?.fieldWidthUm ?? null, drawn);
  };

  const transform = () => ({ transform: `translate(${offset().x}px, ${offset().y}px) scale(${scale()})` });

  function onKey(e: KeyboardEvent) {
    if (e.key === "Escape") store.closeViewer();
    else if (e.key === "ArrowRight") store.stepViewer(1);
    else if (e.key === "ArrowLeft") store.stepViewer(-1);
    else return;
    e.preventDefault();
  }
  onMount(() => window.addEventListener("keydown", onKey));
  onCleanup(() => window.removeEventListener("keydown", onKey));

  /** Zoom so that the image point under the cursor stays under the cursor. */
  function onWheel(e: WheelEvent) {
    e.preventDefault();
    const rect = stage.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const old = scale();
    const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, old * (e.deltaY < 0 ? 1.2 : 1 / 1.2)));
    if (next === MIN_SCALE) return reset();
    const o = offset();
    setOffset({ x: cx - ((cx - o.x) * next) / old, y: cy - ((cy - o.y) * next) / old });
    setScale(next);
  }

  function onPointerDown(e: PointerEvent) {
    if (scale() === 1) return;
    setDrag({ x: e.clientX, y: e.clientY, ox: offset().x, oy: offset().y });
    stage.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: PointerEvent) {
    const d = drag();
    if (!d) return;
    setOffset({ x: d.ox + e.clientX - d.x, y: d.oy + e.clientY - d.y });
  }

  return (
    <div class="viewer" role="dialog" aria-label="Image viewer">
      <div class="viewer-bar">
        <img class="viewer-logo" src="/nanoscout-logo-reversed.png" alt="NanoScout" />
        <span class="viewer-name">{file()?.name}</span>
        <span class="viewer-count mono">
          {(view()?.index ?? 0) + 1} / {view()?.count ?? 0}
        </span>
        <a class="viewer-btn primary" href={downloadUrl(props.fileKey)} download={file()?.name}>
          Download
        </a>
        <button class="viewer-btn" onClick={() => store.closeViewer()}>
          Close (Esc)
        </button>
      </div>
      <div
        ref={stage}
        class="viewer-stage"
        classList={{ zoomed: scale() > 1, dragging: drag() !== null }}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={() => setDrag(null)}
        onPointerCancel={() => setDrag(null)}
        onDblClick={reset}
      >
        <Show when={failed()}>
          <p class="viewer-error">Preview not available. The original can still be downloaded.</p>
        </Show>
        <Show when={!loaded() && !failed()}>
          <img class="placeholder" src={thumbUrl(props.fileKey, uploaded())} alt="" draggable={false} style={transform()} />
        </Show>
        <img
          classList={{ hidden: failed(), loading: !loaded() }}
          onLoad={(e) => {
            const img = e.currentTarget;
            if (img.naturalHeight > 0) setRatio(img.naturalWidth / img.naturalHeight);
            setLoaded(true);
          }}
          onError={() => setFailed(true)}
          src={previewUrl(props.fileKey, uploaded())}
          alt={file()?.name ?? ""}
          draggable={false}
          style={transform()}
        />
      </div>
      <div class="data-bar">
        <Show when={bar()} fallback={<span class="data-bar-empty">No Registry metadata for this image.</span>}>
          {(b) => (
            <div class="scale-bar" aria-label={`Scale bar: ${b().label}`}>
              <div class="scale-bar-line" style={{ width: `${b().px}px` }} />
              <span>{b().label}</span>
            </div>
          )}
        </Show>
        <Show when={file()?.meta && file()}>
          {(f) => (
            <For each={DATA_BAR}>
              {(d) => (
                <div class="data-value">
                  <span>{d.label}</span>
                  <b>{field(d.id).format(f())}</b>
                </div>
              )}
            </For>
          )}
        </Show>
        <div class="data-value">
          <span>Zoom</span>
          <b>{Math.round(scale() * 10) / 10}×</b>
        </div>
        <span class="data-bar-hint">Scroll to zoom, drag to pan, ← → to step</span>
      </div>
      <button
        class="viewer-nav prev"
        disabled={!view()?.at(-1)}
        onClick={() => store.stepViewer(-1)}
        aria-label="Previous"
      >
        <PrevIcon size={22} />
      </button>
      <button class="viewer-nav next" disabled={!view()?.at(1)} onClick={() => store.stepViewer(1)} aria-label="Next">
        <NextIcon size={22} />
      </button>
    </div>
  );
}
