import { RenderableObject } from "core/renderable_object";
import { Mesh } from "objects/renderable/mesh";
import { Line } from "objects/renderable/line";

export class WebGLBindings {
  private readonly gl_: WebGL2RenderingContext;
  private VAOs_: Map<string, WebGLVertexArrayObject> = new Map();
  private currentVAO_: WebGLVertexArrayObject = 0;

  constructor(gl: WebGL2RenderingContext) {
    this.gl_ = gl;
  }

  public bind(object: RenderableObject) {
    let objectVAO = this.VAOs_.get(object.uuid) || null;

    if (objectVAO && objectVAO === this.currentVAO_) {
      // this object's VAO is already active
      return;
    }

    if (!objectVAO) {
      objectVAO = this.createVAO();
    }

    this.gl_.bindVertexArray(objectVAO);
    if (!this.VAOs_.has(object.uuid)) {
      switch (object.type) {
        case "Mesh":
          this.createMeshBuffers(object as Mesh);
          break;
        case "Line":
          this.createLineBuffers(object as Line);
          break;
        default:
          throw new Error(`Unsupported object type: ${object.type}`);
      }
      this.VAOs_.set(object.uuid, objectVAO);
    }

    this.currentVAO_ = objectVAO!;
  }

  private createVAO() {
    const vao = this.gl_.createVertexArray();
    if (!vao) {
      throw new Error(`Unable to generate a vertex array object name`);
    }
    return vao;
  }

  private createMeshBuffers(mesh: Mesh) {
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

  private createLineBuffers(line: Line) {
    const buffer = this.gl_.createBuffer();
    this.gl_.bindBuffer(this.gl_.ARRAY_BUFFER, buffer);
    this.gl_.bufferData(
      this.gl_.ARRAY_BUFFER,
      line.geometry.vertices,
      this.gl_.STATIC_DRAW
    );

    const size = 3;
    const stride = 4 * Float32Array.BYTES_PER_ELEMENT;

    // current
    this.gl_.vertexAttribPointer(
      0,
      size,
      this.gl_.FLOAT,
      false,
      stride,
      2 * stride
    );

    // previous
    this.gl_.vertexAttribPointer(1, size, this.gl_.FLOAT, false, stride, 0);

    // next
    this.gl_.vertexAttribPointer(
      2,
      size,
      this.gl_.FLOAT,
      false,
      stride,
      4 * stride
    );

    // direction
    this.gl_.vertexAttribPointer(
      3,
      1,
      this.gl_.FLOAT,
      false,
      stride,
      2 * stride + 3 * Float32Array.BYTES_PER_ELEMENT
    );

    this.gl_.enableVertexAttribArray(0);
    this.gl_.enableVertexAttribArray(1);
    this.gl_.enableVertexAttribArray(2);
    this.gl_.enableVertexAttribArray(3);

    const indexBuffer = this.gl_.createBuffer();
    this.gl_.bindBuffer(this.gl_.ELEMENT_ARRAY_BUFFER, indexBuffer);
    this.gl_.bufferData(
      this.gl_.ELEMENT_ARRAY_BUFFER,
      line.geometry.index,
      this.gl_.STATIC_DRAW
    );
  }
}
