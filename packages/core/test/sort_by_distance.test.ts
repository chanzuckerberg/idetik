import { expect, test } from "vitest";
import { vec3 } from "gl-matrix";
import { sortFrontToBack } from "@/math/sort_by_distance";
import { PerspectiveCamera } from "@/index";
import { RenderableObject } from "@/core/renderable_object";
import { BoxGeometry } from "@/objects/geometry/box_geometry";

class MockRenderableObject extends RenderableObject {
  constructor(centre: number[], size: number = 1) {
    super();
    const centreVec = vec3.fromValues(centre[0], centre[1], centre[2]);
    this.geometry = new BoxGeometry(1, 1, 1, 1, 1, 1);
    this.transform.setTranslation(
      vec3.add(
        vec3.create(),
        centreVec,
        vec3.fromValues(-size / 2, -size / 2, -size / 2)
      )
    );
  }
  get type() {
    return "MockRenderableObject";
  }
}

test("sorts objects from closest to farthest", () => {
  const camera = new PerspectiveCamera();

  const near = new MockRenderableObject([1, 0, 0]);
  const mid = new MockRenderableObject([5, 0, 0]);
  const far = new MockRenderableObject([10, 0, 0]);

  const objects = [far, mid, near];
  sortFrontToBack(objects, camera);

  expect(objects[0]).toBe(near);
  expect(objects[1]).toBe(mid);
  expect(objects[2]).toBe(far);
});

test("handles equidistant objects maintaining stable order", () => {
  const camera = new PerspectiveCamera();

  const obj1 = new MockRenderableObject([5, 0, 0]);
  const obj2 = new MockRenderableObject([0, 5, 0]);
  const obj3 = new MockRenderableObject([0, 0, 5]);

  const objects = [obj1, obj2, obj3];
  sortFrontToBack(objects, camera);

  // All should be at the same distance, so order should be unchanged
  expect(objects[0]).toBe(obj1);
  expect(objects[1]).toBe(obj2);
  expect(objects[2]).toBe(obj3);
});

test("handles objects with very small distance differences", () => {
  const camera = new PerspectiveCamera();

  const obj1 = new MockRenderableObject([1.0, 0, 0]);
  const obj2 = new MockRenderableObject([1.0001, 0, 0]);
  const obj3 = new MockRenderableObject([1.0002, 0, 0]);

  const objects = [obj3, obj1, obj2];
  sortFrontToBack(objects, camera);

  expect(objects[0]).toBe(obj1);
  expect(objects[1]).toBe(obj2);
  expect(objects[2]).toBe(obj3);
});

test("handles large coordinate values", () => {
  const camera = new PerspectiveCamera({
    position: vec3.fromValues(1000, 1000, 1000),
  });

  const near = new MockRenderableObject([1001, 1000, 1000]);
  const mid = new MockRenderableObject([1100, 1000, 1000]);
  const far = new MockRenderableObject([2000, 1000, 1000]);

  const objects = [mid, far, near];
  sortFrontToBack(objects, camera);

  expect(objects[0]).toBe(near);
  expect(objects[1]).toBe(mid);
  expect(objects[2]).toBe(far);
});

test("handles objects in 3D space with camera not at origin", () => {
  const camera = new PerspectiveCamera({
    position: vec3.fromValues(10, 10, 10),
  });

  const near = new MockRenderableObject([11, 11, 11]); // distance ≈ 1.73
  const mid = new MockRenderableObject([15, 10, 10]); // distance = 5
  const far = new MockRenderableObject([20, 20, 20]); // distance ≈ 17.32

  const objects = [far, near, mid];
  const distances = objects.map((obj) => {
    const objPos = obj.transform.translation;
    return vec3.distance(camera.position, objPos);
  });
  console.log("Distances from camera:", distances);
  sortFrontToBack(objects, camera);

  expect(objects[0]).toBe(near);
  expect(objects[1]).toBe(mid);
  expect(objects[2]).toBe(far);
});

test("handles objects with negative coordinates", () => {
  const camera = new PerspectiveCamera();

  const obj1 = new MockRenderableObject([-1, 0, 0]);
  const obj2 = new MockRenderableObject([-5, 0, 0]);
  const obj3 = new MockRenderableObject([-10, 0, 0]);

  const objects = [obj3, obj1, obj2];
  sortFrontToBack(objects, camera);

  expect(objects[0]).toBe(obj1);
  expect(objects[1]).toBe(obj2);
  expect(objects[2]).toBe(obj3);
});
