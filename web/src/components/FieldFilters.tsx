import { For, Match, Switch } from "solid-js";
import { choices, FIELDS, type Field } from "../lib/fields";
import { store } from "../store";

/** Every Field with a filter, in table order. */
const FILTERED = FIELDS.filter((f) => f.filter);

/** A dropdown: "Any" plus the Field's choices (fixed, or the shown values in the current folder). */
function ChoiceFilter(props: { field: Field }) {
  const chosen = () => {
    const v = store.filters()[props.field.id];
    return typeof v === "string" ? v : "";
  };
  return (
    <select value={chosen()} onChange={(e) => store.setFilter(props.field.id, e.currentTarget.value)}>
      <option value="">Any</option>
      <For each={choices(props.field, store.folderFiles(), chosen())}>{(v) => <option value={v}>{v}</option>}</For>
    </select>
  );
}

/** Min and max number inputs, inclusive, in the Field's unit. */
function RangeFilter(props: { field: Field; unit: string }) {
  const bounds = () => {
    const v = store.filters()[props.field.id];
    return typeof v === "object" ? v : { min: "", max: "" };
  };
  return (
    <span class="range">
      <input
        type="number"
        min="0"
        placeholder={`min ${props.unit}`}
        value={bounds().min}
        onInput={(e) => store.setFilter(props.field.id, { ...bounds(), min: e.currentTarget.value })}
      />
      <input
        type="number"
        min="0"
        placeholder={`max ${props.unit}`}
        value={bounds().max}
        onInput={(e) => store.setFilter(props.field.id, { ...bounds(), max: e.currentTarget.value })}
      />
    </span>
  );
}

/**
 * Field filters in the filter panel, under the date filter. They hide files of the current folder;
 * folders are never hidden.
 */
export default function FieldFilters() {
  return (
    <div class="field-filters">
      <For each={FILTERED}>
        {(field) => (
          <label>
            <span class="eyebrow">{field.label}</span>
            <Switch>
              <Match when={field.filter?.kind === "choice"}>
                <ChoiceFilter field={field} />
              </Match>
              <Match when={field.filter?.kind === "range" && field.filter}>
                {(filter) => <RangeFilter field={field} unit={filter().unit} />}
              </Match>
            </Switch>
          </label>
        )}
      </For>
    </div>
  );
}
