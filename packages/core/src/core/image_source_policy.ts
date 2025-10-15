const ALL_CATEGORIES = [
  "fallbackVisible",
  "prefetchTime",
  "visibleCurrent",
  "fallbackBackground",
  "prefetchSpace",
] as const;

export type PriorityCategory = (typeof ALL_CATEGORIES)[number];

export type ImageSourcePolicyConfig = {
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

export type ImageSourcePolicy = Readonly<{
  profile: string;
  prefetch: {
    x: number;
    y: number;
    z: number;
    t: number;
  };
  priorityOrder: readonly PriorityCategory[];
  priorityMap: Readonly<Record<PriorityCategory, number>>;
  lod: {
    min: number;
    max: number;
    bias: number;
  };
}>;

export function createImageSourcePolicy(
  config: ImageSourcePolicyConfig
): ImageSourcePolicy {
  validatePolicyConfig(config);

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

export function createExplorationPolicy(
  overrides: Partial<ImageSourcePolicyConfig> = {}
): ImageSourcePolicy {
  const base: ImageSourcePolicyConfig = {
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
  return createImageSourcePolicy(mergeConfig(base, overrides));
}

export function createPlaybackPolicy(
  overrides: Partial<ImageSourcePolicyConfig> = {}
): ImageSourcePolicy {
  const base: ImageSourcePolicyConfig = {
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
  return createImageSourcePolicy(mergeConfig(base, overrides));
}

export function createNoPrefetchPolicy(
  overrides: Partial<ImageSourcePolicyConfig> = {}
): ImageSourcePolicy {
  const base: ImageSourcePolicyConfig = {
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
  return createImageSourcePolicy(mergeConfig(base, overrides));
}

function validatePolicyConfig(config: ImageSourcePolicyConfig) {
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

function mergeConfig(
  base: ImageSourcePolicyConfig,
  overrides: Partial<ImageSourcePolicyConfig> = {}
): ImageSourcePolicyConfig {
  return {
    profile: overrides.profile ?? base.profile,
    prefetch: { ...base.prefetch, ...(overrides.prefetch ?? {}) },
    lod: { ...base.lod, ...(overrides.lod ?? {}) },
    priorityOrder: overrides.priorityOrder ?? base.priorityOrder,
  };
}
