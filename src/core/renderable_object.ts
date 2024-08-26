export abstract class RenderableObject {
  // The renderable object base class will have a local transform object.
  // We will use this object to transform the object in world space and to
  // calculate the local transformation matrix.
  public abstract get type(): string;
}
