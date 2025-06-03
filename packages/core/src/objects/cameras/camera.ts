import { RenderableObject } from "../../core/renderable_object";
import { mat4, vec3, vec4 } from "gl-matrix";

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
