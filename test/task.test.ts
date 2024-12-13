import { TaskExecutor } from "@/data/task";
import { expect, test } from "vitest";

test("TaskExecutor::TasksExecuteInOrder", async () => {
  // TODO: the executor does not guarantee anything about
  // execution order, and this does not test that either.
  const executor = new TaskExecutor(2);
  let blocked = true;
  const promises = [];
  for (let i = 0; i < 8; ++i) {
    promises.push(
      executor.submit(async () => {
        const value = i;
        while (blocked) {
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
        return value;
      })
    );
  }

  blocked = false;
  const results = await Promise.all(promises);

  expect(results).toEqual([...Array(8).keys()]);
});

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

  executor.clear();

  blocked = false;
  const result0 = await promise0;
  const result1 = await promise1;
  expect(result0).toEqual(0);
  expect(result1).toBeUndefined();
});
