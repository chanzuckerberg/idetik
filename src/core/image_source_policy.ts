const ALL_CATEGORIES = [
  "fallbackVisible",
  "prefetchTime",
  "visibleCurrent",
  "fallbackBackground",
  "prefetchSpace",
] as const;

export type PriorityCategory = (typeof ALL_CATEGORIES)[number];

type TemporalPrefetchTuple = readonly [backward: number, forward: number];
type TemporalPrefetch = number | TemporalPrefetchTuple;

export type ImageSourcePolicyConfig<
  T extends TemporalPrefetch = TemporalPrefetch,
> = {
  profile?: string;
  prefetch: {
    x: number;
    y: number;
    z?: number;
    t?: T;
  };
  priorityOrder: readonly PriorityCategory[];
  lod?: {
    min?: number;
    max?: number;
    bias?: number;
  };
};

export type ImageSourcePolicy<T extends TemporalPrefetch = TemporalPrefetch> =
  Readonly<{
    profile: string;
    prefetch: {
      x: number;
      y: number;
      z: number;
      t: T;
    };
    priorityOrder: readonly PriorityCategory[];
    priorityMap: Readonly<Record<PriorityCategory, number>>;
    lod: {
      min: number;
      max: number;
      bias: number;
    };
  }>;

type TemporalPrefetchFrom<C> = C extends {
  prefetch: { t: TemporalPrefetchTuple };
}
  ? TemporalPrefetchTuple
  : C extends { prefetch?: { t?: infer T } }
    ? number | Extract<T, TemporalPrefetchTuple>
    : number;

type PresetPolicyArgs<O> = undefined extends O
  ? [overrides?: O]
  : [overrides: O];

/** @group Layer Configuration */
export function createImageSourcePolicy<
  const C extends ImageSourcePolicyConfig,
>(config: C): ImageSourcePolicy<TemporalPrefetchFrom<C>> {
  validatePolicyConfig(config);

  const temporalPrefetch = config.prefetch.t ?? 0;
  const resolvedTemporalPrefetch =
    typeof temporalPrefetch === "number"
      ? temporalPrefetch
      : Object.freeze([temporalPrefetch[0], temporalPrefetch[1]] as const);
  const prefetch = {
    x: config.prefetch.x,
    y: config.prefetch.y,
    z: config.prefetch.z ?? 0,
    t: resolvedTemporalPrefetch,
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

  return Object.freeze(resolved) as ImageSourcePolicy<TemporalPrefetchFrom<C>>;
}

/** @group Layer Configuration */
export function createExplorationPolicy<
  const O extends Partial<ImageSourcePolicyConfig> | undefined = undefined,
>(
  ...[overrides]: PresetPolicyArgs<O>
): ImageSourcePolicy<TemporalPrefetchFrom<O>> {
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
  return createImageSourcePolicy(
    mergeConfig(base, overrides)
  ) as ImageSourcePolicy<TemporalPrefetchFrom<O>>;
}

/** @group Layer Configuration */
export function createPlaybackPolicy<
  const O extends Partial<ImageSourcePolicyConfig> | undefined = undefined,
>(
  ...[overrides]: PresetPolicyArgs<O>
): ImageSourcePolicy<TemporalPrefetchFrom<O>> {
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
  return createImageSourcePolicy(
    mergeConfig(base, overrides)
  ) as ImageSourcePolicy<TemporalPrefetchFrom<O>>;
}

/** @group Layer Configuration */
export function createNoPrefetchPolicy<
  const O extends Partial<ImageSourcePolicyConfig> | undefined = undefined,
>(
  ...[overrides]: PresetPolicyArgs<O>
): ImageSourcePolicy<TemporalPrefetchFrom<O>> {
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
  return createImageSourcePolicy(
    mergeConfig(base, overrides)
  ) as ImageSourcePolicy<TemporalPrefetchFrom<O>>;
}

function validatePolicyConfig(config: ImageSourcePolicyConfig): void {
  for (const [dimension, value] of Object.entries(config.prefetch)) {
    if (value === undefined) continue; // z/t may be omitted

    if (typeof value === "number") {
      if (value < 0) {
        throw new Error(`prefetch.${dimension} must be a non-negative number`);
      }
      continue;
    }

    if (dimension !== "t" || value.length !== 2) {
      throw new Error("prefetch.t must be a [backward, forward] tuple");
    }
    for (let i = 0; i < value.length; ++i) {
      if (
        typeof value[i] !== "number" ||
        Number.isNaN(value[i]) ||
        value[i] < 0
      ) {
        throw new Error(`prefetch.t[${i}] must be a non-negative number`);
      }
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
