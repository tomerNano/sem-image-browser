/**
 * Where an arrow, Home or End key moves the selection in a list of `count` items laid out in
 * `columns` columns (1 for the Details table). Left/Right step one item, Up/Down one row; moves
 * stop at the first and last item. With nothing selected (index -1), any move selects the first.
 * Returns null for any other key.
 */
export function moveIndex(key: string, index: number, count: number, columns: number): number | null {
  if (count === 0) return null;
  const last = count - 1;
  const clamp = (i: number) => Math.min(last, Math.max(0, i));
  switch (key) {
    case "ArrowRight":
      return index < 0 ? 0 : columns > 1 ? clamp(index + 1) : index;
    case "ArrowLeft":
      return index < 0 ? 0 : columns > 1 ? clamp(index - 1) : index;
    case "ArrowDown":
      return index < 0 ? 0 : index + columns > last ? index : index + columns;
    case "ArrowUp":
      return index < 0 ? 0 : index - columns < 0 ? index : index - columns;
    case "Home":
      return 0;
    case "End":
      return last;
    default:
      return null;
  }
}
