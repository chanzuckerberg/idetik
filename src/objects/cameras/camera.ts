import { RenderableObject } from "core/renderable_object";
import { mat4, quat, vec2, vec3, vec4 } from "gl-matrix";

export abstract class Camera extends RenderableObject {
  protected projectionMatrix_ = mat4.create();
  protected near_ = 0;
  protected far_ = 0;
  protected zoom_ = 1;

  protected abstract updateProjectionMatrix(): void;

  public get type() {
    return "Camera";
  }

  public update() {
    this.updateProjectionMatrix();
  }

  get projectionMatrix() {
    return this.projectionMatrix_;
  }

  public get zoom() {
    return this.zoom_;
  }

  public set zoom(zoom: number) {
    this.zoom_ = zoom;
    this.updateProjectionMatrix();
  }

  // TODO: pan in the camera plane, not just xy
  public pan(vec: vec2) {
    const vec3d = vec3.fromValues(vec[0], vec[1], 0);
    this.transform.translate(vec3d);
  }

  public clipToWorld(position: vec2, depth: number = 0): vec2 {
    const screenPos = vec4.fromValues(position[0], position[1], depth, 1);
    const projectionInverse = mat4.invert(mat4.create(), this.projectionMatrix);
    const worldPos = vec4.transformMat4(
      vec4.create(),
      screenPos,
      projectionInverse
    );
    const rotation = mat4.getRotation(quat.create(), this.transform.matrix);
    vec4.transformQuat(worldPos, worldPos, rotation);
    vec4.scale(worldPos, worldPos, 1 / worldPos[3]);
    // TODO: return vec3?
    return vec2.fromValues(worldPos[0], worldPos[1]);
  }
}
