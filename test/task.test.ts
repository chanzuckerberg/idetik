import { TaskExecutor } from "@/data/task";
import { expect, test } from "vitest";

test("TaskExecutor::ClearCancelsPendingTasks", async () => {
  const executor = new TaskExecutor(1);
  let blocked = true;
  const promise0 = executor.submit(async () => {
    while (blocked) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    return 0;
  });
  const promise1 = executor.submit(async () => {
    return 1;
  });
  expect(executor.numRunning).toEqual(1);

  executor.clear();

  blocked = false;
  await expect(promise0).resolves.toEqual(0);
  await expect(promise1).rejects.toThrow("cancelled");
  expect(executor.numRunning).toEqual(0);
});

test("TaskExecutor::TaskErrors", async () => {
  const executor = new TaskExecutor(1);
  const promise = executor.submit(async () => {
    throw new Error("test");
  });
  await expect(promise).rejects.toThrow(new Error("test"));
  expect(executor.numRunning).toEqual(0);
});
