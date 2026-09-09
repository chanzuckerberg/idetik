/**
 * A category of chunk request ordered by a loading policy.
 */
export type PriorityCategory =
  | "fallbackVisible"
  | "prefetchTime"
  | "visibleCurrent"
  | "fallbackBackground"
  | "prefetchSpace";

const ALL_CATEGORIES = [
  "fallbackVisible",
  "prefetchTime",
  "visibleCurrent",
  "fallbackBackground",
  "prefetchSpace",
] as const satisfies readonly PriorityCategory[];

/**
 * @hidden
 */
export type ImageSourcePolicyProps = {
  profile?: string;
  prefetch: {
    x: number;
    y: number;
    z?: number;
    t?: number;
  };
  priorityOrder: PriorityCategory[];
  lod?: {
    min?: number;
    max?: number;
    bias?: number;
  };
};

/**
 * A resolved and frozen loading policy consumed by layers.
 *
 * Create instances with {@link createExplorationPolicy},
 * {@link createPlaybackPolicy}, {@link createNoPrefetchPolicy}, or
 * {@link createImageSourcePolicy} rather than by hand.
 */
export type ImageSourcePolicy = Readonly<{
  /** Names the policy in logs and stats. */
  profile: string;
  /** How far to prefetch beyond the visible region per axis. */
  prefetch: {
    /** Chunks to prefetch along x. */
    x: number;
    /** Chunks to prefetch along y. */
    y: number;
    /** Chunks to prefetch along z. */
    z: number;
    /** Timepoints to prefetch ahead. */
    t: number;
  };
  /** Request categories from highest to lowest priority. */
  priorityOrder: readonly PriorityCategory[];
  /** Priority index per category derived from `priorityOrder`. */
  priorityMap: Readonly<Record<PriorityCategory, number>>;
  /** Bounds and bias for level of detail selection. */
  lod: {
    /** Finest level allowed to load. */
    min: number;
    /** Coarsest level allowed to load. */
    max: number;
    /** Shifts level selection coarser as it grows. */
    bias: number;
  };
}>;

/**
 * Creates a loading policy tuned for interactively browsing a scene.
 *
 * Prefetches one chunk beyond the view along each spatial axis and
 * fills the visible region before prefetching. This is the default
 * policy for layers constructed without one.
 *
 * @param overrides - Properties merged over.
 */
export function createExplorationPolicy(
  overrides: Partial<ImageSourcePolicyProps> = {}
): ImageSourcePolicy {
  const base: ImageSourcePolicyProps = {
    profile: "exploration",
    prefetch: { x: 1, y: 1, z: 1, t: 0 },
    priorityOrder: [
      "fallbackVisible",
      "visibleCurrent",
      "prefetchSpace",
      "prefetchTime",
      "fallbackBackground",
    ],
  };
  return createImageSourcePolicy(mergeProps(base, overrides));
}

/**
 * Creates a loading policy tuned for playing through timepoints.
 *
 * Prefetches twenty timepoints ahead and prioritizes time prefetch over
 * refining the current view, keeping playback smooth at the cost of
 * sharpness while frames advance.
 *
 * @param overrides - Properties merged over.
 */
export function createPlaybackPolicy(
  overrides: Partial<ImageSourcePolicyProps> = {}
): ImageSourcePolicy {
  const base: ImageSourcePolicyProps = {
    profile: "playback",
    prefetch: { x: 0, y: 0, z: 0, t: 20 },
    priorityOrder: [
      "fallbackVisible",
      "prefetchTime",
      "visibleCurrent",
      "fallbackBackground",
      "prefetchSpace",
    ],
  };
  return createImageSourcePolicy(mergeProps(base, overrides));
}

/**
 * Creates a loading policy that loads only visible chunks.
 *
 * No spatial or temporal prefetching happens, which minimizes memory
 * use and network traffic for static scenes.
 *
 * @param overrides - Properties merged over.
 */
export function createNoPrefetchPolicy(
  overrides: Partial<ImageSourcePolicyProps> = {}
): ImageSourcePolicy {
  const base: ImageSourcePolicyProps = {
    profile: "no-prefetch",
    prefetch: { x: 0, y: 0, z: 0, t: 0 },
    priorityOrder: [
      "fallbackVisible",
      "visibleCurrent",
      "fallbackBackground",
      "prefetchSpace",
      "prefetchTime",
    ],
  };
  return createImageSourcePolicy(mergeProps(base, overrides));
}

/**
 * Creates a loading policy from explicit properties, validating and
 * freezing them. Prefer the profile factories for common cases and use
 * this to build a policy from scratch.
 *
 * @param config - Initialization properties.
 */
export function createImageSourcePolicy(
  config: ImageSourcePolicyProps
): ImageSourcePolicy {
  validatePolicyProps(config);

  const prefetch = {
    x: config.prefetch.x,
    y: config.prefetch.y,
    z: config.prefetch.z ?? 0,
    t: config.prefetch.t ?? 0,
  };

  const priorityMap: Readonly<Record<PriorityCategory, number>> = Object.freeze(
    ALL_CATEGORIES.reduce<Record<PriorityCategory, number>>(
      (acc, cat) => {
        const idx = config.priorityOrder.indexOf(cat);
        acc[cat] = idx;
        return acc;
      },
      {} as Record<PriorityCategory, number>
    )
  );

  const lod = {
    min: config.lod?.min ?? 0,
    max: config.lod?.max ?? Number.MAX_SAFE_INTEGER,
    bias: config.lod?.bias ?? 0.5,
  };

  const resolved: ImageSourcePolicy = {
    profile: config.profile ?? "custom",
    prefetch,
    priorityOrder: Object.freeze([...config.priorityOrder]),
    priorityMap,
    lod,
  };

  return Object.freeze(resolved);
}

function validatePolicyProps(config: ImageSourcePolicyProps) {
  for (const [k, v] of Object.entries(config.prefetch)) {
    if (v === undefined) continue; // z/t may be omitted
    if (v < 0) {
      throw new Error(`prefetch.${k} must be a non-negative number`);
    }
  }

  const lod = config.lod;
  if (lod?.min !== undefined && lod?.max !== undefined && lod.min > lod.max) {
    throw new Error(`lod.min must be <= lod.max`);
  }

  const order = config.priorityOrder;
  if (
    order.length !== ALL_CATEGORIES.length ||
    new Set(order).size !== order.length
  ) {
    throw new Error(`priorityOrder must include all categories exactly once`);
  }
}

function mergeProps(
  base: ImageSourcePolicyProps,
  overrides: Partial<ImageSourcePolicyProps> = {}
): ImageSourcePolicyProps {
  return {
    profile: overrides.profile ?? base.profile,
    prefetch: { ...base.prefetch, ...(overrides.prefetch ?? {}) },
    lod: { ...base.lod, ...(overrides.lod ?? {}) },
    priorityOrder: overrides.priorityOrder ?? base.priorityOrder,
  };
}
