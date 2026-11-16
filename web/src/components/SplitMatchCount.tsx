import { Show } from "solid-js";
import { store } from "../store";

/**
 * "23 of 172 match" after a split's name at the top level, while a Field filter is set: how many
 * of the split's Registry images pass the filters.
 */
export default function SplitMatchCount(props: { name: string }) {
  const match = () => (store.canUp() ? null : store.splitMatch(props.name));
  return (
    <Show when={match()}>
      {(m) => (
        <span class="match-count mono">
          {m().matched} of {m().total} match
        </span>
      )}
    </Show>
  );
}
