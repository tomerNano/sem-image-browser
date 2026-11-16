import { createSignal, onCleanup, Show } from "solid-js";
import { preparingLabel } from "../lib/rows";

/** Wait before the badge shows: a preview from the cache arrives sooner and should not flash it. */
const SHOW_AFTER_MS = 400;
/** How often the seconds count updates. */
const TICK_MS = 1000;

/**
 * Spinner with "Preparing preview · 78.0 MB original · 12 s" over an image that is still being
 * made. The server sends nothing until the preview is ready, so this shows time, not a percentage.
 * Mount it only while the preview is loading; it starts counting when it mounts.
 */
export default function PreparingBadge(props: { size: number }) {
  const start = Date.now();
  const [elapsed, setElapsed] = createSignal(0);
  const timers = [
    setTimeout(() => setElapsed(Date.now() - start), SHOW_AFTER_MS),
    setInterval(() => setElapsed(Date.now() - start), TICK_MS),
  ];
  onCleanup(() => {
    clearTimeout(timers[0]);
    clearInterval(timers[1]);
  });
  return (
    <Show when={elapsed() >= SHOW_AFTER_MS}>
      <div class="preparing" role="status">
        <span class="spinner" aria-hidden="true" />
        {preparingLabel(props.size, elapsed())}
      </div>
    </Show>
  );
}
