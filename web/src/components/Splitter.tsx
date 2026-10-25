import { createSignal, type Accessor } from "solid-js";

/** A panel width the user drags, kept between `min` and `max` and remembered for the next visit. */
export type DragWidth = {
  width: Accessor<number>;
  set(px: number): void;
  save(): void;
  reset(): void;
};

function createDragWidth(key: string, min: number, max: number, initial: number): DragWidth {
  const clamp = (px: number) => Math.min(max, Math.max(min, Math.round(px)));
  // Storage can be blocked (private window), so the saved width is optional.
  let saved = initial;
  try {
    const n = Number(localStorage.getItem(key));
    if (n) saved = clamp(n);
  } catch {
    // Use the initial width.
  }
  const [width, setWidth] = createSignal(saved);
  const save = () => {
    try {
      localStorage.setItem(key, String(width()));
    } catch {
      // Not saved; the width still applies until the page reloads.
    }
  };
  return {
    width,
    set: (px) => setWidth(clamp(px)),
    save,
    reset: () => {
      setWidth(initial);
      save();
    },
  };
}

/** Folder tree on the left, preview pane on the right. */
export const tree = createDragWidth("treeWidth", 200, 640, 300);
export const pane = createDragWidth("previewWidth", 260, 760, 340);
export const treeWidth = tree.width;

const OPEN_KEY = "sidebarOpen";

/** Whether the sidebar was open on an earlier visit (open unless closed on purpose). */
function savedOpen(): boolean {
  try {
    return localStorage.getItem(OPEN_KEY) !== "false";
  } catch {
    return true;
  }
}

const [sidebarOpen, setSidebarOpen] = createSignal(savedOpen());
export { sidebarOpen };

/** Show or hide the sidebar (folder tree and brand), and remember it for the next visit. */
export function toggleSidebar(): void {
  setSidebarOpen((open) => !open);
  try {
    localStorage.setItem(OPEN_KEY, String(sidebarOpen()));
  } catch {
    // Not saved; the choice still applies until the page reloads.
  }
}

/**
 * Drag handle between two panels, like Explorer's. `side` says where the resized panel is:
 * "left" grows when dragged right (the tree), "right" grows when dragged left (the preview pane).
 * Pointer capture keeps the drag going when the mouse moves faster than the handle.
 * Double-click resets the width.
 */
export default function Splitter(props: { target: DragWidth; side: "left" | "right"; label: string }) {
  let startX = 0;
  let startWidth = 0;

  return (
    <div
      class="splitter"
      role="separator"
      aria-orientation="vertical"
      aria-label={props.label}
      title="Drag to resize, double-click to reset"
      onPointerDown={(e) => {
        startX = e.clientX;
        startWidth = props.target.width();
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
        const dx = e.clientX - startX;
        props.target.set(props.side === "left" ? startWidth + dx : startWidth - dx);
      }}
      onPointerUp={() => props.target.save()}
      onPointerCancel={() => props.target.save()}
      onDblClick={() => props.target.reset()}
    />
  );
}
