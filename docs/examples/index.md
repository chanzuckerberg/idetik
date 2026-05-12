---
title: Examples
---

# Examples

<script setup>
import { data as examples } from './examples.data.js'
</script>

Each example is a standalone, self-contained, vanilla JS/HTML page.
[Source code](https://github.com/chanzuckerberg/idetik/tree/main/examples) is available on GitHub.

<ul>
  <li v-for="ex in examples" :key="ex.link">
    <a :href="ex.link" target="_blank" rel="noopener noreferrer">{{ ex.title }}</a>
  </li>
</ul>
