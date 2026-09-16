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
  width: 240px;
  border: 1px solid var(--panel-border);
  border-radius: 8px;
  background: var(--panel-bg);
  text-align: left;
  overflow: hidden;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px 8px 14px;
}

.label {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--panel-text-2);
}

.toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 4px;
  color: var(--panel-text-2);
  transition:
    color 0.2s,
    background-color 0.2s;
}

.toggle:hover {
  color: var(--panel-text-1);
  background-color: var(--panel-hover);
}

.chevron {
  display: inline-flex;
  width: 14px;
  height: 14px;
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
  border-top: 1px solid var(--panel-border);
}

.list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: 0;
  padding: 8px;
  list-style: none;
}

.item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 7px 10px;
  border: 1px solid transparent;
  border-radius: 6px;
  text-align: left;
  transition:
    background-color 0.2s,
    border-color 0.2s;
}

.item:hover {
  background-color: var(--panel-hover);
}

.item.active {
  border-color: rgb(var(--brand-rgb) / 0.4);
  background-color: rgb(var(--brand-rgb) / 0.2);
}

.icon {
  display: inline-flex;
  flex-shrink: 0;
  width: 16px;
  height: 16px;
  color: var(--panel-accent);
}

.icon :deep(svg),
.chevron :deep(svg) {
  width: 100%;
  height: 100%;
}

.item-title {
  font-size: 13px;
  font-weight: 600;
  line-height: 1.4;
  color: var(--panel-text-1);
}

.footer {
  padding: 10px 14px;
  border-top: 1px solid var(--panel-border);
}

.source {
  display: inline-block;
  font-size: 12px;
  font-weight: 500;
  line-height: 1.5;
  color: var(--panel-accent);
  transition: color 0.25s;
}

.source:hover {
  color: var(--panel-accent-hover);
}

.arrow {
  display: inline-block;
  transition: transform 0.25s;
}

.source:hover .arrow {
  transform: translateX(3px);
}
</style>
