<script setup lang="ts">
import {
  onBeforeUnmount,
  onMounted,
  ref,
  shallowReactive,
  shallowRef,
} from "vue";
import type { Idetik, SourceDimension } from "@idetik/core";
import RangeSlider from "../../../RangeSlider.vue";

type Range = { min: number; max: number; step: number };

const canvas = ref<HTMLCanvasElement | null>(null);
const timeRange = shallowRef<Range | null>(null);
const sliceCoords = shallowReactive({ t: 130 });

let idetik: Idetik | null = null;
let unmounted = false;

function rangeOf(dim: SourceDimension): Range {
  const { translation, size, scale } = dim.lods[0];
  return {
    min: translation,
    max: translation + (size - 1) * scale,
    step: scale,
  };
}

function extentOf(dim: SourceDimension): number {
  const { size, scale } = dim.lods[0];
  return size * scale;
}

function centerOf(dim: SourceDimension): number {
  const { translation } = dim.lods[0];
  return translation + extentOf(dim) / 2;
}

onMounted(async () => {
  const target = canvas.value;
  if (!target) return;
  try {
    const {
      Idetik,
      OmeZarrImageSource,
      OrbitControls,
      PerspectiveCamera,
      Color,
      VolumeLayer,
      createExplorationPolicy,
    } = await import("@idetik/core");

    const baseUrl = "https://public.czbiohub.org/royerlab/zebrahub/imaging";
    const source = await OmeZarrImageSource.fromHttp({
      url: `${baseUrl}/multi-view/ZMNS001.ome.zarr/`,
    });

    if (unmounted) return;

    const dims = source.getDimensions();
    const x = dims.x;
    const y = dims.y;
    const z = dims.z!;
    timeRange.value = rangeOf(dims.t!);

    const camera = new PerspectiveCamera();
    const radius = 0.85 * Math.hypot(extentOf(x), extentOf(y), extentOf(z));

    const layer = new VolumeLayer({
      source,
      sliceCoords,
      policy: createExplorationPolicy({ lod: { min: 2, max: 2 } }),
      channelProps: [
        { color: Color.CYAN, contrastLimits: [0, 1200] },
        { color: Color.MAGENTA, contrastLimits: [0, 400] },
      ],
    });

    layer.opacityMultiplier = 0.015;
    layer.relativeStepSize = 0.3;

    idetik = new Idetik({
      canvas: target,
      viewports: [
        {
          camera,
          cameraControls: new OrbitControls(camera, {
            radius,
            target: [centerOf(x), centerOf(y), centerOf(z)],
            scrollZoom: "modifier",
            dampingFactor: 0.25,
          }),
          layers: [layer],
        },
      ],
    }).start();
  } catch (e) {
    console.error(e);
  }
});

onBeforeUnmount(() => {
  unmounted = true;
  idetik?.stop();
  canvas.value
    ?.getContext("webgl2")
    ?.getExtension("WEBGL_lose_context")
    ?.loseContext();
});
</script>

<template>
  <div class="volume-renderer">
    <canvas ref="canvas" class="canvas"></canvas>
    <div v-if="timeRange" class="viewer-controls">
      <RangeSlider v-model="sliceCoords.t" label="t" v-bind="timeRange" />
    </div>
  </div>
</template>

<style scoped>
.volume-renderer {
  position: relative;
  width: 100%;
  height: 100%;
}

.canvas {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
