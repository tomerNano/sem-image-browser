/** Minimal uncompressed 16-bit greyscale TIFF (test data only; sharp cannot write 16-bit TIFFs here). */
export function tiff16(px: Uint16Array, w: number, h: number): Buffer {
  const n = 9;
  const dataOff = 8 + 2 + n * 12 + 4;
  const bytes = w * h * 2;
  const buf = Buffer.alloc(dataOff + bytes);
  buf.write("II", 0);
  buf.writeUInt16LE(42, 2);
  buf.writeUInt32LE(8, 4);
  buf.writeUInt16LE(n, 8);
  // [tag, type (3 = SHORT, 4 = LONG), value]: width, height, 16 bits, no compression,
  // black is zero, strip offset, 1 sample per pixel, rows per strip, strip byte count.
  const tags: [number, number, number][] = [
    [256, 4, w], [257, 4, h], [258, 3, 16], [259, 3, 1], [262, 3, 1],
    [273, 4, dataOff], [277, 3, 1], [278, 4, h], [279, 4, bytes],
  ];
  tags.forEach(([tag, type, value], i) => {
    const o = 10 + i * 12;
    buf.writeUInt16LE(tag, o);
    buf.writeUInt16LE(type, o + 2);
    buf.writeUInt32LE(1, o + 4);
    if (type === 3) buf.writeUInt16LE(value, o + 8);
    else buf.writeUInt32LE(value, o + 8);
  });
  for (let i = 0; i < px.length; i++) buf.writeUInt16LE(px[i], dataOff + i * 2);
  return buf;
}
