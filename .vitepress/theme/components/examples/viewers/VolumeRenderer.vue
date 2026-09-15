<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import type { Idetik, SourceDimension } from "@idetik/core";

const canvas = ref<HTMLCanvasElement | null>(null);

let idetik: Idetik | null = null;
let unmounted = false;

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

    const camera = new PerspectiveCamera();
    const radius = 0.75 * Math.hypot(extentOf(x), extentOf(y), extentOf(z));

    const layer = new VolumeLayer({
      source,
      sliceCoords: { t: 220 },
      policy: createExplorationPolicy({ lod: { min: 2, max: 2 } }),
      channelProps: [
        { color: Color.CYAN, contrastLimits: [0, 1200] },
        { color: Color.MAGENTA, contrastLimits: [0, 400] },
      ],
    });

    layer.opacityMultiplier = 0.02;

    idetik = new Idetik({
      canvas: target,
      viewports: [
        {
          camera,
          cameraControls: new OrbitControls(camera, {
            radius,
            target: [centerOf(x), centerOf(y), centerOf(z)],
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
  <canvas ref="canvas" class="canvas"></canvas>
</template>

<style scoped>
.canvas {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
