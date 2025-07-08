import { RenderableObject } from "../core/renderable_object";
import { GeometryAttributeIndex } from "../core/geometry";

type BufferHandles = {
  vao: WebGLVertexArrayObject;
  vbo: WebGLBuffer;
  ebo?: WebGLBuffer;
};

export class WebGLBuffers {
  private readonly gl_: WebGL2RenderingContext;
  private readonly buffers_: Map<RenderableObject, BufferHandles> = new Map();
  private currentObject_: RenderableObject | null = null;

  constructor(gl: WebGL2RenderingContext) {
    this.gl_ = gl;
  }

  public bindObject(object: RenderableObject) {
    if (this.alreadyActive(object)) return;

    if (!this.buffers_.has(object)) {
      this.generateBuffers(object);
    }

    const buffers = this.buffers_.get(object);
    if (!buffers) {
      throw new Error("Failed to retrieve buffer handles for object");
    }

    this.gl_.bindVertexArray(buffers.vao);
    this.currentObject_ = object;
  }

  public disposeObject(object: RenderableObject) {
    const buffers = this.buffers_.get(object);
    if (!buffers) return;

    this.gl_.deleteVertexArray(buffers.vao);
    this.gl_.deleteBuffer(buffers.vbo);

    if (buffers.ebo) this.gl_.deleteBuffer(buffers.ebo);

    this.buffers_.delete(object);
    if (this.currentObject_ === object) {
      this.currentObject_ = null;
    }
  }

  public disposeAll() {
    for (const object of this.buffers_.keys()) {
      this.disposeObject(object);
    }
  }

  private alreadyActive(object: RenderableObject) {
    return this.currentObject_ === object;
  }

  private generateBuffers(object: RenderableObject) {
    const vao = this.gl_.createVertexArray();
    if (!vao) {
      throw new Error("Failed to create vertex array object (VAO)");
    }

    this.gl_.bindVertexArray(vao);

    const { vertexData } = object.geometry;
    const vboType = this.gl_.ARRAY_BUFFER;
    const vbo = this.gl_.createBuffer();
    if (!vbo) throw new Error("Failed to create vertex buffer (VBO)");

    this.gl_.bindBuffer(vboType, vbo);
    this.gl_.bufferData(vboType, vertexData, this.gl_.STATIC_DRAW);

    const { attributes, stride } = object.geometry;
    attributes.forEach((attr) => {
      const idx = GeometryAttributeIndex[attr.type];
      this.gl_.vertexAttribPointer(
        idx,
        attr.itemSize,
        this.gl_.FLOAT,
        false,
        stride,
        attr.offset
      );
      this.gl_.enableVertexAttribArray(idx);
    });

    const buffers: BufferHandles = { vao, vbo };

    const { indexData } = object.geometry;
    if (indexData.length) {
      const eboType = this.gl_.ELEMENT_ARRAY_BUFFER;
      const ebo = this.gl_.createBuffer();
      if (!ebo) throw new Error("Failed to create index buffer (EBO)");

      this.gl_.bindBuffer(eboType, ebo);
      this.gl_.bufferData(eboType, indexData, this.gl_.STATIC_DRAW);
      buffers.ebo = ebo;
    }

    this.buffers_.set(object, buffers);
    this.gl_.bindVertexArray(null);
  }
}
