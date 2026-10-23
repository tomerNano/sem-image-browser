import { createEffect, createSignal, on, onCleanup, onMount } from "solid-js";
import { downloadUrl, previewUrl } from "../api";
import { store } from "../store";

const MIN_SCALE = 1;
const MAX_SCALE = 10;

/** Full-window image viewer: wheel zooms around the cursor, drag pans, arrows step, Esc closes. */
export default function Viewer(props: { fileKey: string }) {
  const [scale, setScale] = createSignal(1);
  const [offset, setOffset] = createSignal({ x: 0, y: 0 });
  let stage!: HTMLDivElement;
  let drag: { x: number; y: number; ox: number; oy: number } | null = null;

  const files = () => store.visibleFiles();
  const index = () => files().findIndex((f) => f.key === props.fileKey);
  const file = () => files()[index()];

  const reset = () => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  };
  // A new image starts unzoomed.
  createEffect(on(() => props.fileKey, reset));

  function step(delta: number) {
    const next = files()[index() + delta];
    if (next) store.openViewer(next.key);
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === "Escape") store.closeViewer();
    else if (e.key === "ArrowRight") step(1);
    else if (e.key === "ArrowLeft") step(-1);
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
    drag = { x: e.clientX, y: e.clientY, ox: offset().x, oy: offset().y };
    stage.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: PointerEvent) {
    if (!drag) return;
    setOffset({ x: drag.ox + e.clientX - drag.x, y: drag.oy + e.clientY - drag.y });
  }

  return (
    <div class="viewer" role="dialog" aria-label="Image viewer">
      <div class="viewer-bar">
        <span class="viewer-name">{file()?.name}</span>
        <span class="viewer-count">
          {index() + 1} / {files().length}
        </span>
        <a class="viewer-btn" href={downloadUrl(props.fileKey)} download={file()?.name}>
          Download
        </a>
        <button class="viewer-btn" onClick={() => store.closeViewer()}>
          Close (Esc)
        </button>
      </div>
      <div
        ref={stage}
        class="viewer-stage"
        classList={{ zoomed: scale() > 1, dragging: drag !== null }}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={() => (drag = null)}
        onDblClick={reset}
      >
        <img
          src={previewUrl(props.fileKey)}
          alt={file()?.name ?? ""}
          draggable={false}
          style={{ transform: `translate(${offset().x}px, ${offset().y}px) scale(${scale()})` }}
        />
      </div>
      <button class="viewer-nav prev" disabled={index() <= 0} onClick={() => step(-1)} aria-label="Previous">
        ‹
      </button>
      <button
        class="viewer-nav next"
        disabled={index() >= files().length - 1}
        onClick={() => step(1)}
        aria-label="Next"
      >
        ›
      </button>
    </div>
  );
}
