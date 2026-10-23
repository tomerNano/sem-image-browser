import sharp from "sharp";

/**
 * TIFF (or PNG) to a browser-friendly JPEG whose long side is at most `maxSide`.
 * `normalise()` stretches contrast to the full range: SEM images are often 16-bit with values
 * in a narrow band, which would look almost black when simply cut down to 8 bits.
 */
export async function toJpeg(input: Buffer, maxSide: number): Promise<Buffer> {
  return sharp(input, { pages: 1 })
    .normalise()
    .resize(maxSide, maxSide, { fit: "inside", withoutEnlargement: true })
    .toColourspace("srgb")
    .jpeg({ quality: 82 })
    .toBuffer();
}
