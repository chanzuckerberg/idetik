import { describe, expect, test, vi, beforeEach } from "vitest";
import { RenderablePool } from "@/utilities/renderable_pool";
import { RenderableObject } from "@/core/renderable_object";
import { poolKeyForImageRenderable } from "@/layers/chunked_image_layer";

class RenderableStub extends RenderableObject {
  public readonly type = "RenderableStub";
}

describe("RenderablePool", () => {
  let pool: RenderablePool<RenderableStub>;

  beforeEach(() => {
    pool = new RenderablePool<RenderableStub>();
    vi.restoreAllMocks();
  });

  test("acquire returns undefined when empty", () => {
    const item = pool.acquire("k1");
    expect(item).toBeUndefined();
  });

  test("release then acquire returns the same item", () => {
    const a = new RenderableStub();
    const b = new RenderableStub();

    pool.release("k1", a);
    pool.release("k1", b);

    expect(pool.acquire("k1")).toBe(b);
    expect(pool.acquire("k1")).toBe(a);
    expect(pool.acquire("k1")).toBeUndefined();
  });

  test("bins are separated by key", () => {
    const a = new RenderableStub();
    const b = new RenderableStub();

    pool.release("k1", a);
    pool.release("k2", b);

    expect(pool.acquire("k1")).toBe(a);
    expect(pool.acquire("k2")).toBe(b);
    expect(pool.acquire("k1")).toBeUndefined();
    expect(pool.acquire("k2")).toBeUndefined();
  });

  test("clearAll calls disposer for all items and empties the pool", () => {
    const a = new RenderableStub();
    const b = new RenderableStub();
    const c = new RenderableStub();
    const disposer = vi.fn();

    pool.release("k1", a);
    pool.release("k1", b);
    pool.release("k2", c);
    pool.clearAll(disposer);

    const args = disposer.mock.calls.map(([arg]) => arg);

    expect(disposer).toHaveBeenCalledTimes(3);
    expect(args).toEqual(expect.arrayContaining([a, b, c]));
    expect(pool.acquire("k1")).toBeUndefined();
    expect(pool.acquire("k2")).toBeUndefined();
  });
});

describe("poolKeyForImageRenderable", () => {
  test("builds a stable key string from chunk layout fields", () => {
    const chunk = {
      lod: 2,
      shape: { x: 256, y: 128 },
      rowStride: 256,
      rowAlignmentBytes: 4,
    } as unknown as import("../src/data/chunk").Chunk;

    const key = poolKeyForImageRenderable(chunk);
    expect(key).toBe("lod2:shape256x128:stride256:align4");
  });
});
