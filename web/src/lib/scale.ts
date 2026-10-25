/**
 * Scale bar for a micrograph `fieldWidthUm` wide, drawn `drawnWidthPx` wide on screen: the
 * round length (1, 2 or 5 × a power of ten) closest to `targetPx`, its width in pixels, and its
 * label in µm (or nm below 1 µm). Null when the size is unknown.
 */
export function scaleBar(
  fieldWidthUm: number | null,
  drawnWidthPx: number,
  targetPx = 150,
): { px: number; label: string } | null {
  if (!fieldWidthUm || fieldWidthUm <= 0 || drawnWidthPx <= 0) return null;
  const umPerPx = fieldWidthUm / drawnWidthPx;
  const target = targetPx * umPerPx;
  const power = 10 ** Math.floor(Math.log10(target));
  const um = [1, 2, 5, 10]
    .map((k) => k * power)
    .reduce((best, v) => (Math.abs(v - target) < Math.abs(best - target) ? v : best));
  const label = um < 1 ? `${Math.round(um * 1000)} nm` : `${Number(um.toPrecision(3))} µm`;
  return { px: um / umPerPx, label };
}
