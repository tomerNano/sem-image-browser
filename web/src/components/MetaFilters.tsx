import { For } from "solid-js";
import { distinctValues, resolution, voltage, type MetaFilters as Filters } from "../lib/rows";
import { store } from "../store";
import type { ImageMeta } from "../types";

/** Filters whose choices are the distinct values found in the current folder. */
type ChoiceFilter = "source" | "variant" | "instrument" | "detector" | "resolution" | "voltage";

const CHOICE_FILTERS: { name: ChoiceFilter; label: string; pick: (m: ImageMeta) => string }[] = [
  { name: "source", label: "Source", pick: (m) => m.source },
  { name: "variant", label: "Variant", pick: (m) => m.variant },
  { name: "instrument", label: "Instrument", pick: (m) => m.instrument },
  { name: "detector", label: "Detector", pick: (m) => m.detector },
  { name: "resolution", label: "Resolution", pick: resolution },
  { name: "voltage", label: "Voltage", pick: voltage },
];

/** Choices found in the current folder, plus the chosen value so it never disappears from its list. */
function choices(pick: (m: ImageMeta) => string, chosen: string): string[] {
  const values = distinctValues(store.folderFiles(), pick);
  return chosen && !values.includes(chosen) ? [chosen, ...values] : values;
}

/**
 * Registry filters in the filter panel, under the date filter. They hide files of the current folder;
 * folders are never hidden. Dropdown choices come from the files of the current folder.
 */
export default function MetaFilters() {
  const f = () => store.filters();
  return (
    <div class="meta-filters">
      <label>
        <span class="eyebrow">Gold</span>
        <select value={f().gold} onChange={(e) => store.setFilter("gold", e.currentTarget.value as Filters["gold"])}>
          <option value="">Any</option>
          <option value="true">Yes</option>
          <option value="false">No</option>
          <option value="unknown">Unknown</option>
        </select>
      </label>
      <For each={CHOICE_FILTERS}>
        {(filter) => (
          <label>
            <span class="eyebrow">{filter.label}</span>
            <select value={f()[filter.name]} onChange={(e) => store.setFilter(filter.name, e.currentTarget.value)}>
              <option value="">Any</option>
              <For each={choices(filter.pick, f()[filter.name])}>{(v) => <option value={v}>{v}</option>}</For>
            </select>
          </label>
        )}
      </For>
      <label>
        <span class="eyebrow">Field width</span>
        <span class="range">
          <input
            type="number"
            min="0"
            placeholder="min µm"
            value={f().fieldWidthMin}
            onInput={(e) => store.setFilter("fieldWidthMin", e.currentTarget.value)}
          />
          <input
            type="number"
            min="0"
            placeholder="max µm"
            value={f().fieldWidthMax}
            onInput={(e) => store.setFilter("fieldWidthMax", e.currentTarget.value)}
          />
        </span>
      </label>
    </div>
  );
}
