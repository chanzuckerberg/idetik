<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  label: string;
  min: number;
  max: number;
  step: number;
  unit?: string;
  modelValue: number;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: number];
}>();

const display = computed(() => {
  const digits = Math.max(0, Math.ceil(-Math.log10(props.step)));
  const value = props.modelValue.toFixed(digits);
  return props.unit ? `${value} ${props.unit}` : value;
});

const progress = computed(() => {
  const span = props.max - props.min;
  const ratio = span > 0 ? (props.modelValue - props.min) / span : 0;
  return `${Math.min(100, Math.max(0, ratio * 100))}%`;
});

function onInput(event: Event) {
  emit("update:modelValue", Number((event.target as HTMLInputElement).value));
}
</script>

<template>
  <label class="range-slider">
    <span class="range-slider-label">{{ label }}</span>
    <input
      type="range"
      :min="min"
      :max="max"
      :step="step"
      :value="modelValue"
      :style="{ '--progress': progress }"
      @input="onInput"
    />
    <span class="range-slider-value">{{ display }}</span>
  </label>
</template>

<style scoped>
.range-slider {
  display: grid;
  grid-template-columns: 1.25em 1fr 6.5em;
  align-items: center;
  gap: 12px;
}

.range-slider-label {
  font-family: var(--vp-font-family-mono);
  color: var(--vp-c-text-2);
}

.range-slider input {
  appearance: none;
  -webkit-appearance: none;
  width: 100%;
  height: 14px;
  margin: 0;
  background: transparent;
  cursor: pointer;
}

.range-slider input:focus-visible {
  outline: 2px solid var(--vp-c-brand-1);
  outline-offset: 2px;
  border-radius: 2px;
}

.range-slider input::-webkit-slider-runnable-track {
  height: 2px;
  border-radius: 1px;
  background: linear-gradient(
    to right,
    var(--vp-c-brand-1) var(--progress),
    var(--vp-c-divider) var(--progress)
  );
}

.range-slider input::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 9px;
  height: 9px;
  margin-top: -3.5px;
  border: none;
  border-radius: 50%;
  background: var(--vp-c-brand-1);
}

.range-slider input::-moz-range-track {
  height: 2px;
  border-radius: 1px;
  background: linear-gradient(
    to right,
    var(--vp-c-brand-1) var(--progress),
    var(--vp-c-divider) var(--progress)
  );
}

.range-slider input::-moz-range-thumb {
  width: 9px;
  height: 9px;
  border: none;
  border-radius: 50%;
  background: var(--vp-c-brand-1);
}

.range-slider-value {
  font-size: 12px;
  text-align: right;
  font-variant-numeric: tabular-nums;
  color: var(--vp-c-text-2);
}
</style>
