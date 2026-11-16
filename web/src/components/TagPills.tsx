import { For, Show } from "solid-js";
import { MISSING } from "../lib/fields";

/** A split's tags as neutral pills, one per tag; the missing-value dash when it has none. */
export default function TagPills(props: { tags: string[] }) {
  return (
    <Show when={props.tags.length > 0} fallback={<span class="tag-none">{MISSING}</span>}>
      <span class="tag-pills">
        <For each={props.tags}>{(tag) => <span class="tag-pill">{tag}</span>}</For>
      </span>
    </Show>
  );
}
