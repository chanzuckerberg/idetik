import { RenderableObject } from "core/renderable_object";

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
    }

    this.gl_.bindVertexArray(objectVAO);
    if (!this.VAOs_.has(object.uuid)) {
      this.createBuffers(object);
      this.VAOs_.set(object.uuid, objectVAO);
    }

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
    return vao;
  }

  private createBuffers(object: RenderableObject) {
    const buffer = this.gl_.createBuffer();
    const { vertexData, indexData, attributes, stride } = object.geometry;

    const bufferType = this.gl_.ARRAY_BUFFER;
    this.gl_.bindBuffer(bufferType, buffer);
    this.gl_.bufferData(bufferType, vertexData, this.gl_.STATIC_DRAW);

    attributes.forEach((attr) => {
      let idx = -1;
      if (attr.type === "position") idx = 0;
      if (attr.type === "normal") idx = 1;
      if (attr.type === "uv") idx = 2;

      this.gl_.vertexAttribPointer(
        idx,
        attr.itemSize,
        this.gl_.FLOAT,
        false,
        stride * Float32Array.BYTES_PER_ELEMENT,
        attr.offset * Float32Array.BYTES_PER_ELEMENT
      );
      this.gl_.enableVertexAttribArray(idx);
    });

    if (indexData) {
      const indexBuffer = this.gl_.createBuffer();
      this.gl_.bindBuffer(this.gl_.ELEMENT_ARRAY_BUFFER, indexBuffer);
      this.gl_.bufferData(
        this.gl_.ELEMENT_ARRAY_BUFFER,
        indexData,
        this.gl_.STATIC_DRAW
      );
    }
  }
}
