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
  margin-top: 32px;
  padding: 0 24px;
  border-top: 1px solid var(--vp-c-gutter);
  background-color: var(--vp-c-bg);
}

@media (min-width: 640px) {
  .live-examples {
    padding: 0 48px;
  }
}

@media (min-width: 960px) {
  .live-examples {
    padding: 0 64px;
  }
}

.container {
  margin: 0 auto;
  padding-top: 64px;
  max-width: 1152px;
}

.showcase {
  display: flex;
  flex-direction: column;
  height: 680px;
  border: 1px solid var(--vp-c-gutter);
  border-radius: 12px;
  box-shadow:
    0 1px 2px rgb(17 17 20 / 0.04),
    0 12px 32px rgb(17 17 20 / 0.08);
  overflow: hidden;
}

@media (min-width: 960px) {
  .showcase {
    height: 860px;
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
