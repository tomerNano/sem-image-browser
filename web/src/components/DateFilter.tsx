import { store } from "../store";

/** From/To dates in the filter panel. They hide batch folders outside the range (empty = open-ended). */
export default function DateFilter() {
  return (
    <div class="date-filter">
      <label>
        <span class="eyebrow">From</span>
        <input type="date" value={store.dateFrom()} onInput={(e) => store.setDateFrom(e.currentTarget.value)} />
      </label>
      <label>
        <span class="eyebrow">To</span>
        <input type="date" value={store.dateTo()} onInput={(e) => store.setDateTo(e.currentTarget.value)} />
      </label>
    </div>
  );
}
