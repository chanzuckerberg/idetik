<script setup lang="ts">
import { computed, ref, type Component } from "vue";
import ExampleNavigator from "./ExampleNavigator.vue";
import VolumeRenderer from "./viewers/VolumeRenderer.vue";
import { examples } from "./examples";

const viewers: Record<string, Component> = {
  "volume-rendering": VolumeRenderer,
};

const selected = ref(examples[0].id);
const current = computed(() => examples.find((e) => e.id === selected.value)!);

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
      <div class="showcase">
        <ExampleNavigator v-model="selected" />
        <div class="stage" @wheel.passive="onWheel">
          <component
            v-if="viewers[selected]"
            :is="viewers[selected]"
            class="viewer"
          />
          <div v-else class="viewer placeholder">
            <span
              class="placeholder-icon"
              aria-hidden="true"
              v-html="current.icon"
            ></span>
            <span class="placeholder-title">{{ current.title }}</span>
            <span class="placeholder-note">Live viewer coming soon</span>
          </div>
          <Transition name="fade">
            <div v-if="scrollHint" class="scroll-hint" aria-hidden="true">
              Use {{ isMac ? "⌘" : "Ctrl" }} + scroll to zoom
            </div>
          </Transition>
        </div>
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
  font-size: 32px;
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

.showcase {
  display: flex;
  margin-top: 48px;
  height: 562px;
  border: 1px solid var(--vp-c-gutter);
  border-radius: 12px;
  box-shadow:
    0 1px 2px rgb(17 17 20 / 0.04),
    0 12px 32px rgb(17 17 20 / 0.08);
  text-align: left;
  overflow: hidden;
}

@media (min-width: 960px) {
  .showcase {
    height: 691px;
  }
}

.stage {
  --panel-bg: #232329;
  --panel-border: rgb(255 255 255 / 0.08);
  --panel-text-1: rgb(255 255 245 / 0.86);
  --panel-text-2: rgb(235 235 245 / 0.6);
  --panel-accent: var(--vp-c-brand-3);

  position: relative;
  flex: 1;
  min-width: 0;
  min-height: 0;
  background-color: #1b1b1f;
}

@media (max-width: 767px) {
  .showcase {
    flex-direction: column;
  }
}

.viewer {
  position: absolute;
  inset: 0;
}

.placeholder {
  display: grid;
  place-content: center;
  justify-items: center;
  gap: 6px;
  color: var(--panel-text-2);
}

.placeholder-icon {
  display: inline-flex;
  width: 44px;
  height: 44px;
  margin-bottom: 8px;
  padding: 11px;
  border: 1px solid rgb(var(--brand-rgb) / 0.4);
  border-radius: 10px;
  background: rgb(var(--brand-rgb) / 0.2);
  color: var(--panel-accent);
}

.placeholder-icon :deep(svg) {
  width: 100%;
  height: 100%;
}

.placeholder-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--panel-text-1);
}

.placeholder-note {
  font-size: 13px;
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
