import { RenderableObject } from "../core/renderable_object";
import { GeometryAttributeIndex } from "../core/geometry";

type BufferHandles = {
  vao: WebGLVertexArrayObject;
  vbo: WebGLBuffer;
  ebo?: WebGLBuffer;
  wireframeVao?: WebGLVertexArrayObject;
  wireframeEbo?: WebGLBuffer;
};

type IndexType = "triangles" | "lines";

export class WebGLBuffers {
  private readonly gl_: WebGL2RenderingContext;
  private readonly buffers_: Map<RenderableObject, BufferHandles> = new Map();
  private currentVao_: WebGLVertexArrayObject | null = null;

  constructor(gl: WebGL2RenderingContext) {
    this.gl_ = gl;
  }

  public bindObject(
    object: RenderableObject,
    indexType: IndexType = "triangles"
  ) {
    let buffers = this.buffers_.get(object);
    if (buffers) {
      const vao = indexType === "lines" ? buffers.wireframeVao : buffers.vao;
      if (this.alreadyActive(vao)) return;
    }

    if (!buffers) {
      this.generateBuffers(object);
      buffers = this.buffers_.get(object);
      if (!buffers) {
        throw new Error("Failed to retrieve buffer handles for object");
      }
    }

    if (indexType !== "lines") {
      this.gl_.bindVertexArray(buffers.vao);
      this.currentVao_ = buffers.vao;
    } else {
      const vao = buffers.wireframeVao || this.generateWireframeBuffers(object);
      this.gl_.bindVertexArray(vao);
      this.currentVao_ = vao;
    }
  }

  public disposeObject(object: RenderableObject) {
    const buffers = this.buffers_.get(object);
    if (!buffers) return;

    this.gl_.deleteVertexArray(buffers.vao);
    this.gl_.deleteBuffer(buffers.vbo);

    if (buffers.wireframeVao) this.gl_.deleteVertexArray(buffers.wireframeVao);
    if (buffers.ebo) this.gl_.deleteBuffer(buffers.ebo);
    if (buffers.wireframeEbo) this.gl_.deleteBuffer(buffers.wireframeEbo);

    this.buffers_.delete(object);

    if (
      this.currentVao_ === buffers.vao ||
      this.currentVao_ === buffers.wireframeVao
    ) {
      this.currentVao_ = null;
    }
  }

  public disposeAll() {
    for (const object of this.buffers_.keys()) {
      this.disposeObject(object);
    }
  }

  private alreadyActive(vao?: WebGLVertexArrayObject) {
    return vao && this.currentVao_ === vao;
  }

  private generateBuffers(object: RenderableObject) {
    const vao = this.createVertexArray();
    this.gl_.bindVertexArray(vao);

    const { vertexData } = object.geometry;

    const vbo = this.gl_.createBuffer();
    if (!vbo) throw new Error("Failed to create vertex buffer object");

    const vboType = this.gl_.ARRAY_BUFFER;
    this.gl_.bindBuffer(vboType, vbo);
    this.gl_.bufferData(vboType, vertexData, this.gl_.STATIC_DRAW);
    this.setupVertexAttributes(object);

    const buffers: BufferHandles = { vao, vbo };

    const { indexData } = object.geometry;
    if (indexData.length) {
      const ebo = this.gl_.createBuffer();
      if (!ebo) throw new Error("Failed to create element buffer object");

      const eboType = this.gl_.ELEMENT_ARRAY_BUFFER;
      this.gl_.bindBuffer(eboType, ebo);
      this.gl_.bufferData(eboType, indexData, this.gl_.STATIC_DRAW);
      buffers.ebo = ebo;
    }

    this.buffers_.set(object, buffers);
    this.gl_.bindVertexArray(null);
  }

  private generateWireframeBuffers(object: RenderableObject) {
    const existingBuffers = this.buffers_.get(object);
    if (!existingBuffers) {
      throw new Error("Failed to generate wireframe buffers");
    }

    const vao = this.createVertexArray();
    this.gl_.bindVertexArray(vao);
    this.gl_.bindBuffer(this.gl_.ARRAY_BUFFER, existingBuffers.vbo);
    this.setupVertexAttributes(object);

    const geometry = object.geometry;
    if (geometry.wireframeIndexData.length === 0) {
      geometry.generateWireframeIndexData();
    }

    const ebo = this.gl_.createBuffer();
    if (!ebo) throw new Error("Failed to create an element buffer object");

    const eboType = this.gl_.ELEMENT_ARRAY_BUFFER;
    const { wireframeIndexData } = geometry;
    this.gl_.bindBuffer(eboType, ebo);
    this.gl_.bufferData(eboType, wireframeIndexData, this.gl_.STATIC_DRAW);

    existingBuffers.wireframeVao = vao;
    existingBuffers.wireframeEbo = ebo;
    this.gl_.bindVertexArray(null);

    return vao;
  }

  private createVertexArray() {
    const vao = this.gl_.createVertexArray();
    if (!vao) throw new Error("Failed to create vertex array object");
    return vao;
  }

  private setupVertexAttributes(object: RenderableObject) {
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
  }
}
