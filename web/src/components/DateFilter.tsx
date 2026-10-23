import { store } from "../store";

/** From/To dates above the tree. They hide batch folders outside the range (empty = open-ended). */
export default function DateFilter() {
  return (
    <div class="date-filter">
      <label>
        From
        <input type="date" value={store.dateFrom()} onInput={(e) => store.setDateFrom(e.currentTarget.value)} />
      </label>
      <label>
        To
        <input type="date" value={store.dateTo()} onInput={(e) => store.setDateTo(e.currentTarget.value)} />
      </label>
    </div>
  );
}
