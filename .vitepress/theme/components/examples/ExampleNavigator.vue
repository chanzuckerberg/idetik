<script setup lang="ts">
import { examples } from "./examples";

const selected = defineModel<string>({ required: true });
</script>

<template>
  <nav class="example-navigator" aria-label="Features">
    <ul class="list">
      <li v-for="example in examples" :key="example.id">
        <button
          type="button"
          class="item"
          :class="{ active: example.id === selected }"
          :aria-pressed="example.id === selected"
          @click="selected = example.id"
        >
          <span class="icon" aria-hidden="true" v-html="example.icon"></span>
          <span class="item-title">{{ example.title }}</span>
        </button>
      </li>
    </ul>
  </nav>
</template>

<style scoped>
.example-navigator {
  flex-shrink: 0;
  border-bottom: 1px solid var(--vp-c-gutter);
  background: var(--vp-c-bg);
}

.list {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
  margin: 0;
  padding: 12px 16px;
  list-style: none;
}

.item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border: 1px solid var(--vp-c-gutter);
  border-radius: var(--radius-pill);
  white-space: nowrap;
  transition:
    background-color 0.2s,
    border-color 0.2s;
}

.item:hover {
  background-color: var(--vp-c-bg-soft);
}

.item.active {
  border-color: rgb(var(--brand-rgb) / 0.22);
  background-color: rgb(var(--brand-rgb) / 0.07);
}

.icon {
  display: inline-flex;
  flex-shrink: 0;
  width: 16px;
  height: 16px;
  color: var(--vp-c-brand-1);
}

.icon :deep(svg) {
  width: 100%;
  height: 100%;
}

.item-title {
  font-size: 13px;
  font-weight: 500;
  line-height: 1.4;
  color: var(--vp-c-text-1);
}

@media (max-width: 767px) {
  .list {
    flex-wrap: nowrap;
    justify-content: flex-start;
    overflow-x: auto;
    scrollbar-width: none;
  }

  .list::-webkit-scrollbar {
    display: none;
  }

  .list li {
    flex-shrink: 0;
  }

  .item-title {
    font-size: 12px;
  }
}
</style>
