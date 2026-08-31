import { mat4 } from "gl-matrix";
import { expect, test } from "vitest";

import { OrthographicCamera } from "@/objects/cameras/orthographic_camera";
import { OrbitControls } from "@/objects/cameras/orbit_controls";
import { PerspectiveCamera } from "@/objects/cameras/perspective_camera";

const expectMatrixEquals = (a: mat4, b: mat4) => {
  expect(mat4.equals(a, b)).toBe(true);
};

test("cameras round-trip through JSON", () => {
  const perspective = new PerspectiveCamera({ fov: 45, near: 2, far: 500 });
  perspective.transform.setTranslation([1, 2, 3]);

  const orthographic = new OrthographicCamera({
    left: -10,
    right: 30,
    top: -20,
    bottom: 40,
    near: -100,
    far: 100,
    orientation: "XZ",
  });
  orthographic.pan([3, 4, 5]);
  orthographic.zoom(2);

  const perspectiveJSON = JSON.parse(JSON.stringify(perspective.toJSON()));
  const orthographicJSON = JSON.parse(JSON.stringify(orthographic.toJSON()));
  const restoredPerspective = PerspectiveCamera.fromJSON(perspectiveJSON);
  const restoredOrthographic = OrthographicCamera.fromJSON(orthographicJSON);

  expect(perspectiveJSON).toMatchObject({
    type: "PerspectiveCamera",
    fov: 45,
    near: 2,
    far: 500,
  });
  expectMatrixEquals(
    restoredPerspective.transform.matrix,
    perspective.transform.matrix
  );
  expectMatrixEquals(
    restoredPerspective.projectionMatrix,
    perspective.projectionMatrix
  );

  expect(orthographicJSON).toMatchObject({
    type: "OrthographicCamera",
    width: 40,
    height: 60,
    near: -100,
    far: 100,
    orientation: "XZ",
  });
  expectMatrixEquals(
    restoredOrthographic.transform.matrix,
    orthographic.transform.matrix
  );
  expectMatrixEquals(
    restoredOrthographic.projectionMatrix,
    orthographic.projectionMatrix
  );
});

test("camera then orbit controls restore the same final transform", () => {
  const camera = new PerspectiveCamera();
  const controls = new OrbitControls(camera, {
    radius: 12,
    yaw: 0.4,
    pitch: -0.2,
    target: [1, 2, 3],
  });
  const cameraJSON = camera.toJSON();
  const controlsJSON = JSON.parse(JSON.stringify(controls.toJSON()));
  expect(controlsJSON).toEqual({
    radius: 12,
    yaw: 0.4,
    pitch: -0.2,
    target: [1, 2, 3],
  });

  const restoredCamera = PerspectiveCamera.fromJSON(cameraJSON);
  new OrbitControls(restoredCamera, controlsJSON);

  expectMatrixEquals(restoredCamera.transform.matrix, camera.transform.matrix);
});
