import { expect, test } from "vitest";

import { OrbitControls } from "@/objects/cameras/orbit_controls";
import { PerspectiveCamera } from "@/objects/cameras/perspective_camera";

test("Orbit controls expose their current interaction state", () => {
  const controls = new OrbitControls(new PerspectiveCamera(), {
    radius: 12,
    yaw: 0.4,
    pitch: -0.2,
    target: [1, 2, 3],
  });

  expect(controls.radius).toBe(12);
  expect(controls.yaw).toBe(0.4);
  expect(controls.pitch).toBe(-0.2);
  expect(controls.target).toEqual(new Float32Array([1, 2, 3]));

  controls.target[0] = 99;
  expect(controls.target[0]).toBe(1);
});
