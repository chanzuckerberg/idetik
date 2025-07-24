import { vec3, mat4 } from "gl-matrix";
import { RenderableObject } from "../core/renderable_object";

export interface SegmentationPicking {
  getSegmentIdAtWorld(world: vec3): number | null;
  getSegmentIdAtPixel(x: number, y: number): number | null;
  getImageRenderable(): RenderableObject | undefined;
}

export function implementSegmentationPicking(
  instance: SegmentationPicking
): SegmentationPicking {
  // Provide default implementation for getSegmentIdAtWorld
  instance.getSegmentIdAtWorld = function(world: vec3): number | null {
    const renderable = this.getImageRenderable?.();
    if (!renderable) return null;

    const invTransform = mat4.invert(mat4.create(), renderable.transform.matrix);
    const texel = vec3.transformMat4(vec3.create(), world, invTransform);

    const x = texel[0];
    const y = texel[1];

    return this.getSegmentIdAtPixel(x, y);
  };

  return instance;
}