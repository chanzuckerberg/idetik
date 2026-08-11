import { expect, test, vi } from "vitest";

import { EventDispatcher } from "@/core/event_dispatcher";

function makeConnectedDispatcher() {
  const element = document.createElement("div");
  const dispatcher = new EventDispatcher(element);
  dispatcher.connect();
  return { element, dispatcher };
}

test("Added listener receives dispatched events", () => {
  const { element, dispatcher } = makeConnectedDispatcher();
  const listener = vi.fn();
  dispatcher.addEventListener(listener);

  element.dispatchEvent(new Event("pointerdown"));

  expect(listener).toHaveBeenCalledTimes(1);
});

test("Removed listener no longer receives events", () => {
  const { element, dispatcher } = makeConnectedDispatcher();
  const listener = vi.fn();
  dispatcher.addEventListener(listener);
  dispatcher.removeEventListener(listener);

  element.dispatchEvent(new Event("pointerdown"));

  expect(listener).toHaveBeenCalledTimes(0);
});

test("Removing an unregistered listener throws and keeps registered ones", () => {
  const { element, dispatcher } = makeConnectedDispatcher();
  const registered = vi.fn();
  dispatcher.addEventListener(registered);

  expect(() => dispatcher.removeEventListener(vi.fn())).toThrow(
    "Listener to remove could not be found"
  );

  element.dispatchEvent(new Event("pointerdown"));
  expect(registered).toHaveBeenCalledTimes(1);
});
