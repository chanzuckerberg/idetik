const BUCKETS = 1 << 16;

/**
 * Orders splats back to front along the view direction with a 16-bit
 * counting sort on view-space depth.
 *
 * @param positions - Splat centers as `x, y, z` at the start of every
 *   `stride` floats.
 * @param stride - Floats per splat in `positions`.
 * @param viewZ - The third row of the model-view matrix, which maps a center
 *   to its view-space z. Farther splats have more negative z.
 * @param out - Receives the splat indices in draw order.
 * @param depths - Scratch space with one entry per splat.
 */
export function sortSplatsBackToFront(
  positions: Float32Array,
  stride: number,
  viewZ: ArrayLike<number>,
  out: Uint32Array,
  depths: Float32Array
) {
  const count = positions.length / stride;
  const [a, b, c, d] = [viewZ[0], viewZ[1], viewZ[2], viewZ[3]];
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < count; i++) {
    const p = i * stride;
    const z =
      a * positions[p] + b * positions[p + 1] + c * positions[p + 2] + d;
    depths[i] = z;
    if (z < min) min = z;
    if (z > max) max = z;
  }

  const scale = max > min ? (BUCKETS - 1) / (max - min) : 0;
  const counts = new Uint32Array(BUCKETS);
  for (let i = 0; i < count; i++) {
    const key = ((depths[i] - min) * scale) | 0;
    depths[i] = key;
    counts[key]++;
  }
  let offset = 0;
  for (let k = 0; k < BUCKETS; k++) {
    const n = counts[k];
    counts[k] = offset;
    offset += n;
  }
  for (let i = 0; i < count; i++) {
    out[counts[depths[i]]++] = i;
  }
}
