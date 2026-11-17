import { createSignal, For, onCleanup, Show } from "solid-js";
import { Portal } from "solid-js/web";
import { MISSING } from "../lib/fields";
import { shortTagList } from "../lib/rows";

/** Hover time before the tag card opens, so moving the mouse across rows does not flash cards. */
const CARD_DELAY_MS = 150;
/** Gap between the pills and the card, and the room the card needs below before it opens above. */
const CARD_GAP_PX = 6;
const CARD_ROOM_BELOW_PX = 160;

/** Every tag as pills in a small card, placed under (or above) the pills it belongs to. */
function TagCard(props: { tags: string[]; anchor: DOMRect }) {
  const below = () => window.innerHeight - props.anchor.bottom > CARD_ROOM_BELOW_PX;
  return (
    // A portal puts the card at the end of <body>, so the table's scroll area cannot cut it off.
    <Portal>
      <div
        class="tag-card"
        role="tooltip"
        style={{
          left: `${props.anchor.left}px`,
          ...(below()
            ? { top: `${props.anchor.bottom + CARD_GAP_PX}px` }
            : { bottom: `${window.innerHeight - props.anchor.top + CARD_GAP_PX}px` }),
        }}
      >
        <span class="tag-card-title">{props.tags.length} tags</span>
        <span class="tag-pills">
          <For each={props.tags}>{(tag) => <span class="tag-pill">{tag}</span>}</For>
        </span>
      </div>
    </Portal>
  );
}

/**
 * A split's tags as neutral pills, one per tag; the missing-value dash when it has none. With
 * `limit`, only that many pills show, then "+N"; hovering (or focusing) them opens a card with
 * every tag. The Details table uses a limit so a split with many tags keeps a one-line row.
 */
export default function TagPills(props: { tags: string[]; limit?: number }) {
  const list = () => shortTagList(props.tags, props.limit ?? props.tags.length);
  const [anchor, setAnchor] = createSignal<DOMRect | null>(null);
  let timer: ReturnType<typeof setTimeout> | undefined;

  const open = (el: HTMLElement) => {
    clearTimeout(timer);
    timer = setTimeout(() => setAnchor(el.getBoundingClientRect()), CARD_DELAY_MS);
  };
  const close = () => {
    clearTimeout(timer);
    setAnchor(null);
  };
  onCleanup(close);

  return (
    <Show when={props.tags.length > 0} fallback={<span class="tag-none">{MISSING}</span>}>
      <span
        class="tag-pills"
        classList={{ "one-line": props.limit !== undefined, "has-more": list().more > 0 }}
        tabIndex={list().more > 0 ? 0 : undefined}
        aria-label={list().more > 0 ? `Tags: ${props.tags.join(", ")}` : undefined}
        onMouseEnter={(e) => list().more > 0 && open(e.currentTarget)}
        onMouseLeave={close}
        onFocus={(e) => list().more > 0 && open(e.currentTarget)}
        onBlur={close}
      >
        <For each={list().shown}>{(tag) => <span class="tag-pill">{tag}</span>}</For>
        <Show when={list().more > 0}>
          <span class="tag-pill tag-more">+{list().more}</span>
        </Show>
      </span>
      <Show when={anchor()}>{(rect) => <TagCard tags={props.tags} anchor={rect()} />}</Show>
    </Show>
  );
}
