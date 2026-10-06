import { afterEach, describe, expect, test, vi } from "vitest";
import { Idetik } from "@/idetik";
import { OrthographicCamera } from "@/objects/cameras/orthographic_camera";
import { WebGLRenderer } from "@/renderers/webgl_renderer";
import { ChunkManager } from "@/data/chunk_manager";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * A started manual-mode runtime that logs layer updates, draws and uploads.
 * Set `pending.uploads` to have chunk updates upload one chunk per frame.
 */
function startManual() {
  const canvas = document.createElement("canvas");
  canvas.style.width = "64px";
  canvas.style.height = "64px";
  document.body.appendChild(canvas);
  const camera = new OrthographicCamera({
    left: 0,
    right: 64,
    top: 0,
    bottom: 64,
  });
  const log: string[] = [];
  const pending = { uploads: 0 };
  vi.spyOn(WebGLRenderer.prototype, "updateLayers").mockImplementation(() =>
    log.push("layers")
  );
  vi.spyOn(WebGLRenderer.prototype, "draw").mockImplementation(() =>
    log.push("draw")
  );
  vi.spyOn(ChunkManager.prototype, "update").mockImplementation(() => {
    if (pending.uploads === 0) return;
    pending.uploads--;
    log.push("upload");
  });
  vi.spyOn(ChunkManager.prototype, "queueStats", "get").mockImplementation(
    () => ({ pending: 0, running: 0, awaitingUpload: pending.uploads })
  );
  const idetik = new Idetik({
    canvas,
    renderMode: "manual",
    viewports: [{ camera }],
  }).start();
  return { idetik, canvas, log, pending };
}

describe("manual render mode", () => {
  let idetik: Idetik | undefined;
  afterEach(() => {
    if (idetik?.running) idetik.stop();
    idetik?.canvas.remove();
    vi.restoreAllMocks();
  });

  test("never draws on its own and goes idle", async () => {
    const runtime = startManual();
    idetik = runtime.idetik;
    runtime.canvas.dispatchEvent(
      new PointerEvent("pointerdown", { clientX: 10, clientY: 10 })
    );
    runtime.canvas.style.width = "48px";
    await sleep(100);
    const frames = runtime.log.length;
    await sleep(100);
    expect(runtime.log).toHaveLength(frames);
    expect(runtime.log).not.toContain("draw");
  });

  test("whenSettled loads without drawing, then requestRender draws once", async () => {
    const runtime = startManual();
    idetik = runtime.idetik;
    runtime.pending.uploads = 2;
    await idetik.whenSettled();
    expect(runtime.log).not.toContain("draw");

    await idetik.requestRender();
    // A draw only shows uploaded chunks if the layers updated after them.
    const afterUpload = runtime.log.slice(
      runtime.log.lastIndexOf("upload") + 1
    );
    expect(afterUpload).toEqual(["layers", "draw"]);
  });

  test("whenSettled rejects when visible chunks are missing", async () => {
    const runtime = startManual();
    idetik = runtime.idetik;
    const current = { requested: 4, resident: 3 };
    vi.spyOn(idetik, "chunkStats", "get").mockImplementation(() => ({
      sources: [],
      viewports: [{ viewportId: "main", requested: 4, resident: 3, current }],
    }));
    await expect(idetik.whenSettled()).rejects.toThrow(/"main"/);
  });
});

test("Runtime initializes with canvas element", () => {
  const canvas = document.createElement("canvas");
  const camera = new OrthographicCamera({
    left: 0,
    right: 128,
    top: 0,
    bottom: 128,
  });

  const idetik = new Idetik({ canvas, viewports: [{ camera }] });

  const viewport = idetik.viewports[0];
  expect(idetik.canvas).toBe(canvas);
  expect(viewport.camera).toBe(camera);
  expect(viewport.layers).toEqual([]);
});

test("Runtime start/stop controls the animation loop", () => {
  const canvas = document.createElement("canvas");
  const camera = new OrthographicCamera({
    left: 0,
    right: 128,
    top: 0,
    bottom: 128,
  });
  const idetik = new Idetik({ canvas, viewports: [{ camera }] });

  const rafSpy = vi.spyOn(window, "requestAnimationFrame");
  idetik.start();
  expect(rafSpy).toHaveBeenCalled();

  const cancelRafSpy = vi.spyOn(window, "cancelAnimationFrame");
  idetik.stop();
  expect(cancelRafSpy).toHaveBeenCalled();
});

test("Width and height properties return (scaled) canvas shape", () => {
  const devicePixelRatio = window.devicePixelRatio;
  const canvas = document.createElement("canvas");
  const camera = new OrthographicCamera({
    left: 0,
    right: 128,
    top: 0,
    bottom: 128,
  });
  const idetik = new Idetik({ canvas, viewports: [{ camera }] });

  expect(idetik.width).toBe(canvas.clientWidth * devicePixelRatio);
  expect(idetik.height).toBe(canvas.clientHeight * devicePixelRatio);
});
