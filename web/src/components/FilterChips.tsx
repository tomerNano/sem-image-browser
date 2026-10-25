import { For, Show } from "solid-js";
import { FIELDS, filterSummary } from "../lib/fields";
import { store } from "../store";

type Chip = { label: string; value: string; remove: () => void };

/** One chip per set filter (batch dates and Fields), each with its own remove button. */
function chips(): Chip[] {
  const out: Chip[] = [];
  if (store.dateFrom()) out.push({ label: "From", value: store.dateFrom(), remove: () => store.setDateFrom("") });
  if (store.dateTo()) out.push({ label: "To", value: store.dateTo(), remove: () => store.setDateTo("") });
  const filters = store.filters();
  for (const f of FIELDS) {
    const value = filterSummary(f, filters[f.id]);
    if (value === null) continue;
    const empty = f.filter?.kind === "range" ? { min: "", max: "" } : "";
    out.push({ label: f.label, value, remove: () => store.setFilter(f.id, empty) });
  }
  return out;
}

/** Active filters, visible without opening the filter panel. Nothing shows when none are set. */
export default function FilterChips() {
  return (
    <Show when={chips().length > 0}>
      <div class="chips" aria-label="Active filters">
        <For each={chips()}>
          {(chip) => (
            <span class="chip">
              <span class="chip-label">{chip.label}</span>
              <span class="chip-value">{chip.value}</span>
              <button class="chip-remove" aria-label={`Remove filter: ${chip.label}`} onClick={chip.remove}>
                ×
              </button>
            </span>
          )}
        </For>
        <button class="chips-clear" onClick={() => store.clearAllFilters()}>
          Clear filters
        </button>
      </div>
    </Show>
  );
}
