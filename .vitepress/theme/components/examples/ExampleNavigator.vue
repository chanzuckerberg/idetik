<script setup lang="ts">
import { examples } from "./examples";

const selected = defineModel<string>({ required: true });
</script>

<template>
  <aside class="example-navigator">
    <header class="header">Features</header>
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
  </aside>
</template>

<style scoped>
.example-navigator {
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  width: 260px;
  background: var(--vp-c-bg);
}

.header {
  padding: 12px 16px;
  border-bottom: 1px solid var(--vp-c-gutter);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--vp-c-text-2);
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
  padding: 8px 10px;
  border: 1px solid transparent;
  border-radius: 6px;
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
  font-weight: 600;
  line-height: 1.4;
  color: var(--vp-c-text-1);
}

.footer {
  margin-top: auto;
  padding: 12px 16px;
  border-top: 1px solid var(--vp-c-gutter);
}

.source {
  display: inline-block;
  font-size: 12px;
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

@media (max-width: 767px) {
  .example-navigator {
    width: 100%;
  }

  .header,
  .footer {
    display: none;
  }

  .list {
    flex-direction: row;
    gap: 8px;
    padding: 12px 16px;
    overflow-x: auto;
    scrollbar-width: none;
  }

  .list::-webkit-scrollbar {
    display: none;
  }

  .list li {
    flex-shrink: 0;
  }

  .item {
    width: auto;
    padding: 6px 12px;
    border-color: var(--vp-c-gutter);
    border-radius: 999px;
    white-space: nowrap;
  }

  .item-title {
    font-size: 12px;
  }
}
</style>
