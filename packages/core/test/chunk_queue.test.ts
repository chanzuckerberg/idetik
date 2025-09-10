import { describe, expect, test } from "vitest";
import { ChunkQueue } from "@/data/chunk_queue";
import { makeChunk, makeControllableLoader, waitFor } from "./helpers";

describe("ChunkQueue", () => {
  test("successful load sets state to loaded", async () => {
    const queue = new ChunkQueue();
    const ctl = makeControllableLoader();
    const chunk = makeChunk({
      state: "queued",
      priority: 0,
    });

    queue.enqueue(chunk, ctl.loader);

    queue.flush();
    await waitFor(() => chunk.state === "loading");

    ctl.resolve();
    await waitFor(() => chunk.state === "loaded");
  });

  test("starts up to max concurrent tasks and queues the rest", async () => {
    const queue = new ChunkQueue();

    let started = 0;
    const ctls = Array.from({ length: 10 }, () =>
      makeControllableLoader(() => (started += 1))
    );

    Array.from({ length: 10 }, () => makeChunk({ state: "queued" })).forEach(
      (chunk, i) => queue.enqueue(chunk, ctls[i].loader)
    );

    queue.flush();
    await waitFor(() => started === 8);

    // free one slot and ensure exactly one more starts
    ctls[0].resolve();
    await waitFor(() => started === 9);
  });

  test("respects priority ordering when starting", async () => {
    const queue = new ChunkQueue();

    const started: number[] = [];
    const ctl0 = makeControllableLoader(() => started.push(0));
    const ctl1 = makeControllableLoader(() => started.push(1));
    const ctl5 = makeControllableLoader(() => started.push(5));

    queue.enqueue(makeChunk({ state: "queued", priority: 5 }), ctl5.loader);
    queue.enqueue(makeChunk({ state: "queued", priority: 1 }), ctl1.loader);
    queue.enqueue(makeChunk({ state: "queued", priority: 0 }), ctl0.loader);

    queue.flush();
    await waitFor(() => started.length === 3);

    expect(started).toEqual([0, 1, 5]);
  });

  test("does not process the same chunk twice", async () => {
    const queue = new ChunkQueue();
    const chunk = makeChunk({ state: "queued", priority: 0 });

    let started = 0;
    const ctl = makeControllableLoader(() => (started += 1));

    queue.enqueue(chunk, ctl.loader);
    queue.enqueue(chunk, ctl.loader);
    queue.enqueue(chunk, ctl.loader);

    queue.flush();
    await waitFor(() => chunk.state === "loading");
    expect(started).toBe(1);
  });

  test("cancel pending request prevents it from starting", async () => {
    const queue = new ChunkQueue(1);

    const blockerCtl = makeControllableLoader();
    const blockerChunk = makeChunk({ state: "queued", priority: 0 });
    queue.enqueue(blockerChunk, blockerCtl.loader);

    let pendingStarted = false;
    const pendingCtl = makeControllableLoader(() => (pendingStarted = true));
    const pendingChunk = makeChunk({ state: "queued", priority: 0 });
    queue.enqueue(pendingChunk, pendingCtl.loader);

    queue.flush();
    await waitFor(() => blockerChunk.state === "loading");

    queue.cancel(pendingChunk);

    blockerCtl.resolve();
    await waitFor(() => blockerChunk.state === "loaded");
    await Promise.resolve(); // microtask tick

    expect(pendingStarted).toBe(false);
    expect(pendingChunk.state).toBe("queued");
  });

  test("cancel running request aborts and resets", async () => {
    const queue = new ChunkQueue();
    const ctl = makeControllableLoader();
    const chunk = makeChunk({ state: "queued", priority: 0 });

    queue.enqueue(chunk, ctl.loader);
    queue.flush();

    await waitFor(() => chunk.state === "loading");

    queue.cancel(chunk);

    await waitFor(() => chunk.state === "unloaded");

    // verify it can run again after cancel
    chunk.state = "queued";
    queue.enqueue(chunk, ctl.loader);
    queue.flush();
    await waitFor(() => chunk.state === "loading");
  });
});
