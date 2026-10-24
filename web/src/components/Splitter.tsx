import { createSignal } from "solid-js";

const MIN = 200;
const MAX = 640;
const DEFAULT = 360;
const STORAGE_KEY = "treeWidth";

function clamp(px: number): number {
  return Math.min(MAX, Math.max(MIN, Math.round(px)));
}

/** Saved width from an earlier visit. Storage can be blocked (private window), so it is optional. */
function savedWidth(): number {
  try {
    const n = Number(localStorage.getItem(STORAGE_KEY));
    return n ? clamp(n) : DEFAULT;
  } catch {
    return DEFAULT;
  }
}

const [treeWidth, setTreeWidth] = createSignal(savedWidth());
export { treeWidth };

/**
 * Drag handle between the folder tree and the file area, like Explorer's. Pointer capture keeps
 * the drag going when the mouse moves faster than the handle. Double-click resets the width.
 */
export default function Splitter() {
  let startX = 0;
  let startWidth = 0;

  const save = () => {
    try {
      localStorage.setItem(STORAGE_KEY, String(treeWidth()));
    } catch {
      // Not saved; the width still applies until the page reloads.
    }
  };

  return (
    <div
      class="splitter"
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize folder tree"
      title="Drag to resize, double-click to reset"
      onPointerDown={(e) => {
        startX = e.clientX;
        startWidth = treeWidth();
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) setTreeWidth(clamp(startWidth + e.clientX - startX));
      }}
      onPointerUp={save}
      onPointerCancel={save}
      onDblClick={() => {
        setTreeWidth(DEFAULT);
        save();
      }}
    />
  );
}
