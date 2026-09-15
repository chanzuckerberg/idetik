<script setup lang="ts">
import { ref } from "vue";
import ExampleNavigator from "./ExampleNavigator.vue";
import VolumeRenderer from "./viewers/VolumeRenderer.vue";
import { examples } from "./examples";

const selected = ref(examples[0].id);
</script>

<template>
  <section class="live-examples">
    <div class="container">
      <h2 class="title">Explore Idetik live</h2>
      <p class="description">
        Tour a sample of Idetik features in an interactive viewer running in
        your browser.
      </p>
      <a class="link" href="/guide/getting-started">
        Get started with Idetik <span class="arrow">&rarr;</span>
      </a>
      <div class="stage">
        <VolumeRenderer class="viewer" />
        <ExampleNavigator v-model="selected" class="navigator" />
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

.navigator {
  position: relative;
}
</style>
