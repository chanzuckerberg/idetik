import { RenderableObject } from "../../core/renderable_object";
import { Frustum } from "../../math/frustum";
import { mat4, vec3, vec4 } from "gl-matrix";

export type CameraType = "OrthographicCamera" | "PerspectiveCamera";

export abstract class Camera extends RenderableObject {
  protected projectionMatrix_ = mat4.create();
  protected near_ = 0;
  protected far_ = 0;

  protected abstract updateProjectionMatrix(): void;

  public abstract get type(): CameraType;

  public update() {
    this.updateProjectionMatrix();
  }

  get projectionMatrix() {
    return this.projectionMatrix_;
  }

  get viewMatrix() {
    return this.transform.inverse;
  }

  get right() {
    const m = this.transform.matrix;
    return vec3.fromValues(m[0], m[1], m[2]);
  }

  get up() {
    const m = this.transform.matrix;
    return vec3.fromValues(m[4], m[5], m[6]);
  }

  get frustum() {
    return new Frustum(
      mat4.multiply(mat4.create(), this.projectionMatrix, this.viewMatrix)
    );
  }

  public abstract setAspectRatio(aspectRatio: number): void;
  public abstract zoom(factor: number): void;

  public pan(vec: vec3) {
    this.transform.addTranslation(vec);
  }

  public get position() {
    return this.transform.translation;
  }

  public clipToWorld(position: vec3): vec3 {
    const clipPos = vec4.fromValues(position[0], position[1], position[2], 1);
    const projectionInverse = mat4.invert(
      mat4.create(),
      this.projectionMatrix_
    );
    const viewPos = vec4.transformMat4(
      vec4.create(),
      clipPos,
      projectionInverse
    );
    vec4.scale(viewPos, viewPos, 1 / viewPos[3]);
    // the camera transform is *not* inverted here because we use the inverse when rendering
    const worldPos = vec4.transformMat4(
      vec4.create(),
      viewPos,
      this.transform.matrix
    );
    return vec3.fromValues(worldPos[0], worldPos[1], worldPos[2]);
  }
}
