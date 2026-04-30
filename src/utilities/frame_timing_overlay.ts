import type { FrameTimer } from "./frame_timer";

export function createFrameTimingOverlay(): HTMLElement {
  const el = document.createElement("div");
  el.style.cssText = [
    "position: fixed",
    "bottom: 8px",
    "left: 8px",
    "background: rgba(0, 0, 0, 0.75)",
    "color: #0f0",
    "font: 12px/1.4 monospace",
    "padding: 6px 10px",
    "border-radius: 4px",
    "pointer-events: none",
    "z-index: 10000",
    "white-space: pre",
  ].join(";");

  document.body.appendChild(el);
  return el;
}

function fmt(ms: number): string {
  return ms.toFixed(2).padStart(7);
}

export function updateFrameTimingOverlay(
  el: HTMLElement,
  frameTimer: FrameTimer,
  renderedObjects: number
) {
  const s = frameTimer.stats;
  if (s.frameCount === 0) return;

  const lines = [
    `         avg      last     min      max`,
    `frame ${fmt(s.average.frameDeltaMs)} ${fmt(s.current.frameDeltaMs)} ${fmt(s.min.frameDeltaMs)} ${fmt(s.max.frameDeltaMs)} ms`,
    `cpu   ${fmt(s.average.renderSubmitMs)} ${fmt(s.current.renderSubmitMs)} ${fmt(s.min.renderSubmitMs)} ${fmt(s.max.renderSubmitMs)} ms`,
  ];

  if (s.current.gpuTimeMs > 0) {
    lines.push(
      `gpu   ${fmt(s.average.gpuTimeMs)} ${fmt(s.current.gpuTimeMs)} ${fmt(s.min.gpuTimeMs)} ${fmt(s.max.gpuTimeMs)} ms`
    );
  } else {
    lines.push(`gpu        ---`);
  }

  lines.push(`fps   ${s.fps.toFixed(0).padStart(7)}    objects ${renderedObjects}`);

  el.textContent = lines.join("\n");
}
