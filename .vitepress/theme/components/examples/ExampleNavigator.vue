<script setup lang="ts">
import { ref } from "vue";
import { examples } from "./examples";
import chevron from "../../icons/chevron.svg?raw";

const selected = defineModel<string>({ required: true });
const expanded = ref(true);
</script>

<template>
  <aside class="example-navigator">
    <header class="header">
      <span class="label">Examples</span>
      <button
        type="button"
        class="toggle"
        :class="{ expanded }"
        :aria-expanded="expanded"
        :aria-label="expanded ? 'Collapse examples' : 'Expand examples'"
        @click="expanded = !expanded"
      >
        <span class="chevron" aria-hidden="true" v-html="chevron"></span>
      </button>
    </header>
    <div class="body" :class="{ collapsed: !expanded }" :inert="!expanded">
      <div class="body-inner">
        <ul class="list">
          <li v-for="example in examples" :key="example.id">
            <button
              type="button"
              class="item"
              :class="{ active: example.id === selected }"
              :aria-pressed="example.id === selected"
              @click="selected = example.id"
            >
              <span
                class="icon"
                aria-hidden="true"
                v-html="example.icon"
              ></span>
              <span class="item-title">{{ example.title }}</span>
            </button>
          </li>
        </ul>
        <footer class="footer">
          <a
            class="source"
            href="https://github.com/chanzuckerberg/idetik"
            target="_blank"
            rel="noopener"
          >
            View source <span class="arrow">&rarr;</span>
          </a>
        </footer>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.example-navigator {
  flex-shrink: 0;
  align-self: flex-start;
  width: 280px;
  border: 1px solid var(--vp-c-gutter);
  border-radius: 8px;
  background: var(--vp-c-bg);
  text-align: left;
  overflow: hidden;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px 10px 18px;
}

.label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--vp-c-text-2);
}

.toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 4px;
  color: var(--vp-c-text-2);
  transition:
    color 0.2s,
    background-color 0.2s;
}

.toggle:hover {
  color: var(--vp-c-text-1);
  background-color: var(--vp-c-bg-soft);
}

.chevron {
  display: inline-flex;
  width: 16px;
  height: 16px;
  transition: transform 0.25s;
}

.toggle.expanded .chevron {
  transform: rotate(180deg);
}

.body {
  display: grid;
  grid-template-rows: 1fr;
  overflow: hidden;
  transition: grid-template-rows 0.25s ease;
}

.body.collapsed {
  grid-template-rows: 0fr;
}

.body-inner {
  min-height: 0;
  border-top: 1px solid var(--vp-c-gutter);
}

.list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 0;
  padding: 10px;
  list-style: none;
}

.item {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 10px 12px;
  border: 1px solid transparent;
  border-radius: 8px;
  text-align: left;
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
  width: 20px;
  height: 20px;
  color: var(--vp-c-brand-1);
}

.icon :deep(svg),
.chevron :deep(svg) {
  width: 100%;
  height: 100%;
}

.item-title {
  font-size: 14px;
  font-weight: 600;
  line-height: 1.4;
  color: var(--vp-c-text-1);
}

.footer {
  padding: 14px 18px;
  border-top: 1px solid var(--vp-c-gutter);
}

.source {
  display: inline-block;
  font-size: 13px;
  font-weight: 500;
  line-height: 1.5;
  color: var(--vp-c-brand-1);
  transition: color 0.25s;
}

.source:hover {
  color: var(--vp-c-brand-2);
}

.arrow {
  display: inline-block;
  transition: transform 0.25s;
}

.source:hover .arrow {
  transform: translateX(3px);
}
</style>
