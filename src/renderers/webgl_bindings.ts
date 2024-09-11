import { RenderableObject } from "core/renderable_object";
import { Mesh } from "objects/renderable/mesh";

export class WebGLBindings {
  private readonly gl_: WebGL2RenderingContext;
  private VAOs_: Map<string, WebGLVertexArrayObject> = new Map();
  private currentVAO_: WebGLVertexArrayObject = 0;

  constructor(gl: WebGL2RenderingContext) {
    this.gl_ = gl;
  }

  public bind(object: RenderableObject) {
    if (this.alreadyActive(object.uuid)) return;

    let objectVAO = this.VAOs_.get(object.uuid) || null;
    if (!objectVAO) {
      objectVAO = this.createVAO();
      // TODO: all renderable objects should have some similar interface
      // that defines their geometry and associated buffers. For now,
      // do something much worse.
      switch (object.type) {
        case "Mesh":
          this.createBuffers(object as Mesh);
          break;
        default:
          throw new Error(`Unknown renderable object "${object.type}"`);
      }
      this.VAOs_.set(object.uuid, objectVAO);
    }
    this.gl_.bindVertexArray(objectVAO);
    this.currentVAO_ = objectVAO!;
  }

  private alreadyActive(uuid: string) {
    if (this.currentVAO_ !== 0) {
      return this.VAOs_.get(uuid) === this.currentVAO_;
    }
    return false;
  }

  private createVAO() {
    const vao = this.gl_.createVertexArray();
    if (!vao) {
      throw new Error(`Unable to generate a vertex array object name`);
    }
    this.gl_.bindVertexArray(vao);
    return vao;
  }

  private createBuffers(mesh: Mesh) {
    let idx = 0;
    for (const [, value] of mesh.source.attributes) {
      const buffer = this.gl_.createBuffer();
      const bufferType = this.gl_.ARRAY_BUFFER;
      const size = value.itemSize;
      this.gl_.bindBuffer(bufferType, buffer);
      this.gl_.bufferData(bufferType, value.data, this.gl_.STATIC_DRAW);
      this.gl_.vertexAttribPointer(idx, size, this.gl_.FLOAT, false, 0, 0);
      this.gl_.enableVertexAttribArray(idx);
      idx += 1;
    }

    if (mesh.index) {
      const indexBuffer = this.gl_.createBuffer();
      this.gl_.bindBuffer(this.gl_.ELEMENT_ARRAY_BUFFER, indexBuffer);
      this.gl_.bufferData(
        this.gl_.ELEMENT_ARRAY_BUFFER,
        mesh.index,
        this.gl_.STATIC_DRAW
      );
    }
  }
}
