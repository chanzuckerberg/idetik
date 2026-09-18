<script setup lang="ts">
import { ref } from "vue";
import ExampleNavigator from "./ExampleNavigator.vue";
import VolumeRenderer from "./viewers/VolumeRenderer.vue";
import { examples } from "./examples";

const selected = ref(examples[0].id);

const isMac =
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPad/.test(navigator.userAgent);
const scrollHint = ref(false);
let scrollHintTimer: ReturnType<typeof setTimeout> | undefined;

function onWheel(e: WheelEvent) {
  if (!(e.target instanceof HTMLCanvasElement)) return;
  clearTimeout(scrollHintTimer);
  scrollHint.value = !(e.ctrlKey || e.metaKey);
  if (scrollHint.value) {
    scrollHintTimer = setTimeout(() => (scrollHint.value = false), 800);
  }
}
</script>

<template>
  <section class="live-examples">
    <div class="container">
      <h2 class="title">Explore Idetik</h2>
      <p class="description">
        Tour a sample of Idetik features in an interactive viewer running in
        your browser.
      </p>
      <a class="link" href="/guide/getting-started">
        Get started with Idetik <span class="arrow">&rarr;</span>
      </a>
      <div class="stage" @wheel.passive="onWheel">
        <VolumeRenderer class="viewer" />
        <ExampleNavigator v-model="selected" class="navigator" />
        <Transition name="fade">
          <div v-if="scrollHint" class="scroll-hint" aria-hidden="true">
            Use {{ isMac ? "⌘" : "Ctrl" }} + scroll to zoom
          </div>
        </Transition>
      </div>
    </div>
  </section>
</template>

<style scoped>
.live-examples {
  padding: 64px 24px 0;
}

@media (min-width: 640px) {
  .live-examples {
    padding: 72px 48px 0;
  }
}

@media (min-width: 960px) {
  .live-examples {
    padding: 80px 64px 0;
  }
}

.container {
  margin: 0 auto;
  padding-top: 64px;
  max-width: 1152px;
  border-top: 1px solid var(--vp-c-gutter);
  text-align: center;
}

.title {
  margin: 0;
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.15;
  color: var(--vp-c-text-1);
}

@media (min-width: 640px) {
  .title {
    font-size: 40px;
  }
}

.description {
  margin: 16px 0 0;
  font-size: 18px;
  font-weight: 400;
  line-height: 1.6;
  color: var(--vp-c-text-2);
}

.link {
  display: inline-block;
  margin-top: 16px;
  font-size: 16px;
  font-weight: 600;
  line-height: 1.5;
  color: var(--vp-c-brand-1);
  transition: color 0.25s;
}

.link:hover {
  color: var(--vp-c-brand-2);
}

.arrow {
  display: inline-block;
  transition: transform 0.25s;
}

.link:hover .arrow {
  transform: translateX(3px);
}

.stage {
  --panel-bg: #232329;
  --panel-border: rgb(255 255 255 / 0.08);
  --panel-text-1: rgb(255 255 245 / 0.86);
  --panel-text-2: rgb(235 235 245 / 0.6);
  --panel-hover: rgb(255 255 255 / 0.06);
  --panel-accent: var(--vp-c-brand-3);
  --panel-accent-hover: #b6a8fc;

  position: relative;
  display: flex;
  gap: 20px;
  margin-top: 48px;
  padding: 20px;
  height: 562px;
  border: 1px solid #2a2a30;
  border-radius: 12px;
  background-color: #1b1b1f;
  overflow: hidden;
}

@media (min-width: 960px) {
  .stage {
    height: 691px;
  }
}

.viewer {
  position: absolute;
  inset: 0;
}

.stage :deep(.viewer-controls) {
  --vp-c-text-2: var(--panel-text-2);
  --vp-c-divider: var(--panel-border);
  --vp-c-brand-1: var(--panel-accent);

  position: absolute;
  left: 50%;
  bottom: 20px;
  width: min(520px, calc(100% - 40px));
  padding: 10px 14px;
  border: 1px solid var(--panel-border);
  border-radius: 8px;
  background: var(--panel-bg);
  font-size: 13px;
  line-height: 1.4;
  transform: translateX(-50%);
}

.navigator {
  position: relative;
}

.scroll-hint {
  position: absolute;
  inset: 0;
  z-index: 1;
  display: grid;
  place-items: center;
  background: rgb(0 0 0 / 0.45);
  color: #fff;
  font-size: 20px;
  font-weight: 600;
  pointer-events: none;
}

.fade-enter-active {
  transition: opacity 0.15s ease;
}

.fade-leave-active {
  transition: opacity 0.4s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
