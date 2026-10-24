import { createSignal, onCleanup, onMount, Show, type JSX } from "solid-js";

/**
 * Small icon button that opens a panel under it. A click outside or Esc closes the panel.
 * `badge` shows a count on the button (hidden when 0).
 */
export default function Popover(props: { title: string; icon: JSX.Element; badge?: number; children: JSX.Element }) {
  const [open, setOpen] = createSignal(false);
  let root!: HTMLDivElement;

  const onPointerDown = (e: PointerEvent) => {
    if (!root.contains(e.target as Node)) setOpen(false);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") setOpen(false);
  };
  onMount(() => {
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
  });
  onCleanup(() => {
    document.removeEventListener("pointerdown", onPointerDown);
    document.removeEventListener("keydown", onKey);
  });

  return (
    <div class="popover" ref={root}>
      <button
        class="icon-btn"
        classList={{ active: open() || (props.badge ?? 0) > 0 }}
        title={props.title}
        aria-label={props.title}
        aria-expanded={open()}
        onClick={() => setOpen((o) => !o)}
      >
        {props.icon}
        <Show when={(props.badge ?? 0) > 0}>
          <span class="badge">{props.badge}</span>
        </Show>
      </button>
      <Show when={open()}>
        <div class="popover-panel" role="dialog" aria-label={props.title}>
          {props.children}
        </div>
      </Show>
    </div>
  );
}
