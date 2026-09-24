import { vec3 } from "gl-matrix";

import { Box3 } from "../math/box3";
import { readPlyVertices } from "./ply";

/** 32-bit words per splat in {@link GaussianSplats.data}: two RGBA32UI texels. */
export const SPLAT_WORDS = 8;

/**
 * Gaussian splats packed for upload to the GPU.
 */
export type GaussianSplats = {
  /** The number of splats. */
  count: number;
  /**
   * {@link SPLAT_WORDS} words per splat:
   * - the world-space center (3 floats as bits);
   * - a scale `s` (float bits), the largest standard deviation;
   * - the lower-triangular Cholesky factor of the covariance divided by `s`,
   *   as six half floats `[L00, L10, L11, L20, L21, L22]`;
   * - the color as RGBA8, where alpha is the peak opacity.
   */
  data: Uint32Array;
  /** World-space centers, three floats per splat, for sorting. */
  centers: Float32Array;
  /** World-space bounds of the centers. */
  bounds: Box3;
};

/**
 * Splats in the 3D Gaussian Splatting parameterization.
 */
export type GaussianSplatAttributes = {
  /** Centers, three floats per splat. */
  positions: ArrayLike<number>;
  /** Standard deviations along each rotated axis, three floats per splat. */
  scales: ArrayLike<number>;
  /** Rotations as `(w, x, y, z)` quaternions, four floats per splat. */
  rotations: ArrayLike<number>;
  /** RGBA colors in `[0, 1]`, four floats per splat. Alpha is opacity. */
  colors: ArrayLike<number>;
};

const f32Scratch = new Float32Array(1);
const u32Scratch = new Uint32Array(f32Scratch.buffer);

/** Converts a float to IEEE half-precision bits (round to nearest even). */
export function toHalfBits(value: number): number {
  f32Scratch[0] = value;
  const x = u32Scratch[0];
  const sign = (x >>> 16) & 0x8000;
  const exp = (x >>> 23) & 0xff;
  let mant = x & 0x7fffff;

  if (exp === 0xff) return sign | 0x7c00 | (mant ? 0x200 : 0);
  const e = exp - 127 + 15;
  if (e >= 0x1f) return sign | 0x7c00;
  if (e <= 0) {
    if (e < -10) return sign;
    mant |= 0x800000;
    const shift = 14 - e;
    let half = mant >>> shift;
    const rem = mant & ((1 << shift) - 1);
    const midpoint = 1 << (shift - 1);
    if (rem > midpoint || (rem === midpoint && half & 1)) half++;
    return sign | half;
  }
  let half = (e << 10) | (mant >>> 13);
  const rem = mant & 0x1fff;
  // A carry out of the mantissa correctly rounds up into the exponent.
  if (rem > 0x1000 || (rem === 0x1000 && half & 1)) half++;
  return sign | half;
}

function toByte(value: number) {
  return Math.round(Math.min(Math.max(value, 0), 1) * 255);
}

/**
 * Packs splats given as centers, per-axis scales, rotations, and colors.
 *
 * @param attributes - The splat attributes.
 */
export function packGaussianSplats(
  attributes: GaussianSplatAttributes
): GaussianSplats {
  const { positions, scales, rotations, colors } = attributes;
  const count = positions.length / 3;
  const data = new Uint32Array(count * SPLAT_WORDS);
  const floats = new Float32Array(data.buffer);
  const centers = new Float32Array(count * 3);
  const bounds = new Box3();
  const point = vec3.create();

  for (let i = 0; i < count; i++) {
    let qw = rotations[4 * i];
    let qx = rotations[4 * i + 1];
    let qy = rotations[4 * i + 2];
    let qz = rotations[4 * i + 3];
    const norm = Math.hypot(qw, qx, qy, qz) || 1;
    qw /= norm;
    qx /= norm;
    qy /= norm;
    qz /= norm;

    const sx = scales[3 * i];
    const sy = scales[3 * i + 1];
    const sz = scales[3 * i + 2];
    const s = Math.max(sx, sy, sz, 1e-30);

    // Columns of M = R · diag(scale) / s, so that Σ / s² = M · Mᵀ.
    const ax = sx / s;
    const ay = sy / s;
    const az = sz / s;
    const m00 = (1 - 2 * (qy * qy + qz * qz)) * ax;
    const m10 = 2 * (qx * qy + qw * qz) * ax;
    const m20 = 2 * (qx * qz - qw * qy) * ax;
    const m01 = 2 * (qx * qy - qw * qz) * ay;
    const m11 = (1 - 2 * (qx * qx + qz * qz)) * ay;
    const m21 = 2 * (qy * qz + qw * qx) * ay;
    const m02 = 2 * (qx * qz + qw * qy) * az;
    const m12 = 2 * (qy * qz - qw * qx) * az;
    const m22 = (1 - 2 * (qx * qx + qy * qy)) * az;

    const c00 = m00 * m00 + m01 * m01 + m02 * m02;
    const c10 = m10 * m00 + m11 * m01 + m12 * m02;
    const c11 = m10 * m10 + m11 * m11 + m12 * m12;
    const c20 = m20 * m00 + m21 * m01 + m22 * m02;
    const c21 = m20 * m10 + m21 * m11 + m22 * m12;
    const c22 = m20 * m20 + m21 * m21 + m22 * m22;

    // Σ / s² has entries at most 1, so a fixed floor only guards degenerate
    // (flat) splats.
    const l00 = Math.sqrt(Math.max(c00, 1e-12));
    const l10 = c10 / l00;
    const l20 = c20 / l00;
    const l11 = Math.sqrt(Math.max(c11 - l10 * l10, 1e-12));
    const l21 = (c21 - l20 * l10) / l11;
    const l22 = Math.sqrt(Math.max(c22 - l20 * l20 - l21 * l21, 1e-12));

    const x = positions[3 * i];
    const y = positions[3 * i + 1];
    const z = positions[3 * i + 2];
    const o = i * SPLAT_WORDS;
    floats[o] = x;
    floats[o + 1] = y;
    floats[o + 2] = z;
    floats[o + 3] = s;
    data[o + 4] = toHalfBits(l00) | (toHalfBits(l10) << 16);
    data[o + 5] = toHalfBits(l11) | (toHalfBits(l20) << 16);
    data[o + 6] = toHalfBits(l21) | (toHalfBits(l22) << 16);
    data[o + 7] =
      (toByte(colors[4 * i]) |
        (toByte(colors[4 * i + 1]) << 8) |
        (toByte(colors[4 * i + 2]) << 16) |
        (toByte(colors[4 * i + 3]) << 24)) >>>
      0;

    centers[3 * i] = x;
    centers[3 * i + 1] = y;
    centers[3 * i + 2] = z;
    bounds.expandWithPoint(vec3.set(point, x, y, z));
  }

  return { count, data, centers, bounds };
}

const PLY_PROPERTIES = [
  "x",
  "y",
  "z",
  "scale_0",
  "scale_1",
  "scale_2",
  "rot_0",
  "rot_1",
  "rot_2",
  "rot_3",
  "f_dc_0",
  "f_dc_1",
  "f_dc_2",
  "opacity",
] as const;

// The degree-0 spherical harmonic basis constant.
const SH_C0 = 0.28209479177387814;

/**
 * Parses splats from a PLY file in the layout written by the reference 3D
 * Gaussian Splatting implementation and compatible tools.
 *
 * Scales are stored as logs and opacity as a logit. Color comes from the
 * degree-0 spherical harmonic only, so it does not vary with view direction.
 *
 * @param buffer - The PLY file contents.
 */
export function parseGaussianSplatsPly(buffer: ArrayBuffer): GaussianSplats {
  const { count, properties: p } = readPlyVertices(buffer, PLY_PROPERTIES);
  const positions = new Float32Array(count * 3);
  const scales = new Float32Array(count * 3);
  const rotations = new Float32Array(count * 4);
  const colors = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    positions.set([p.x[i], p.y[i], p.z[i]], 3 * i);
    scales.set(
      [Math.exp(p.scale_0[i]), Math.exp(p.scale_1[i]), Math.exp(p.scale_2[i])],
      3 * i
    );
    rotations.set([p.rot_0[i], p.rot_1[i], p.rot_2[i], p.rot_3[i]], 4 * i);
    colors.set(
      [
        0.5 + SH_C0 * p.f_dc_0[i],
        0.5 + SH_C0 * p.f_dc_1[i],
        0.5 + SH_C0 * p.f_dc_2[i],
        1 / (1 + Math.exp(-p.opacity[i])),
      ],
      4 * i
    );
  }
  return packGaussianSplats({ positions, scales, rotations, colors });
}

/**
 * Fetches and parses a 3D Gaussian Splatting PLY file.
 *
 * @param url - The URL of the PLY file.
 * @see {@link parseGaussianSplatsPly} for the supported layout.
 */
export async function loadGaussianSplatsPly(url: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch ${url}: ${response.status} ${response.statusText}`
    );
  }
  return parseGaussianSplatsPly(await response.arrayBuffer());
}
