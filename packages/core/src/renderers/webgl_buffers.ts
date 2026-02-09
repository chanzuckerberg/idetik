import { Geometry, GeometryAttributeIndex } from "../core/geometry";

type BufferHandles = {
  vao: WebGLVertexArrayObject;
  vbo: WebGLBuffer;
  ebo?: WebGLBuffer;
};

export class WebGLBuffers {
  private readonly gl_: WebGL2RenderingContext;
  private readonly buffers_: Map<Geometry, BufferHandles> = new Map();
  private currentGeometry_: Geometry | null = null;

  constructor(gl: WebGL2RenderingContext) {
    this.gl_ = gl;
  }

  public bindGeometry(geometry: Geometry) {
    if (this.alreadyActive(geometry)) return;

    if (!this.buffers_.has(geometry)) {
      this.generateBuffers(geometry);
    }

    const buffers = this.buffers_.get(geometry);
    if (!buffers) {
      throw new Error("Failed to retrieve buffer handles for object");
    }

    this.gl_.bindVertexArray(buffers.vao);
    this.currentGeometry_ = geometry;
  }

  public disposeObject(geometry: Geometry) {
    const buffers = this.buffers_.get(geometry);
    if (!buffers) return;

    this.gl_.deleteVertexArray(buffers.vao);
    this.gl_.deleteBuffer(buffers.vbo);

    if (buffers.ebo) this.gl_.deleteBuffer(buffers.ebo);

    this.buffers_.delete(geometry);
    if (this.currentGeometry_ === geometry) {
      this.currentGeometry_ = null;
    }
  }

  public disposeAll() {
    for (const geometry of this.buffers_.keys()) {
      this.disposeObject(geometry);
    }
  }

  private alreadyActive(geometry: Geometry) {
    return this.currentGeometry_ === geometry;
  }

  private generateBuffers(geometry: Geometry) {
    const vao = this.gl_.createVertexArray();
    if (!vao) {
      throw new Error("Failed to create vertex array object (VAO)");
    }

    this.gl_.bindVertexArray(vao);

    const { vertexData } = geometry;
    const vboType = this.gl_.ARRAY_BUFFER;
    const vbo = this.gl_.createBuffer();
    if (!vbo) throw new Error("Failed to create vertex buffer (VBO)");

    this.gl_.bindBuffer(vboType, vbo);
    this.gl_.bufferData(vboType, vertexData, this.gl_.STATIC_DRAW);

    const { attributes, strideBytes } = geometry;
    attributes.forEach((attr) => {
      const idx = GeometryAttributeIndex[attr.type];
      this.gl_.vertexAttribPointer(
        idx,
        attr.itemSize,
        this.gl_.FLOAT,
        false,
        strideBytes,
        attr.offset
      );
      this.gl_.enableVertexAttribArray(idx);
    });

    const buffers: BufferHandles = { vao, vbo };

    const { indexData } = geometry;
    if (indexData.length) {
      const eboType = this.gl_.ELEMENT_ARRAY_BUFFER;
      const ebo = this.gl_.createBuffer();
      if (!ebo) throw new Error("Failed to create index buffer (EBO)");

      this.gl_.bindBuffer(eboType, ebo);
      this.gl_.bufferData(eboType, indexData, this.gl_.STATIC_DRAW);
      buffers.ebo = ebo;
    }

    this.buffers_.set(geometry, buffers);
    this.gl_.bindVertexArray(null);
  }
}

// TODO in theory reusing Texture class would make the most sense
// but right now the textures are all storage textures
// not image textures
// for e.g. there is a get and set on the data which
// don't make too much sense, and the webgl_renderer is not
// setup to create such a texture
// it also breaks the current idea which is that the Texture class
// is independent of the renderer implementation and the gl context
class ImageTexture2D {
  public texture: WebGLTexture;

  private readonly gl_: WebGL2RenderingContext;
  private width_: number;
  private height_: number;

  constructor(gl: WebGL2RenderingContext, width: number, height: number) {
    this.gl_ = gl;
    this.width_ = width;
    this.height_ = height;
    this.texture = this.gl_.createTexture();
    this.setupTexture();
  }

  private setupTexture() {
    this.bind();
    this.gl_.texParameteri(
      this.gl_.TEXTURE_2D,
      this.gl_.TEXTURE_WRAP_S,
      this.gl_.CLAMP_TO_EDGE
    );
    this.gl_.texParameteri(
      this.gl_.TEXTURE_2D,
      this.gl_.TEXTURE_WRAP_T,
      this.gl_.CLAMP_TO_EDGE
    );
    this.gl_.texParameteri(
      this.gl_.TEXTURE_2D,
      this.gl_.TEXTURE_MIN_FILTER,
      this.gl_.NEAREST
    );
    this.gl_.texParameteri(
      this.gl_.TEXTURE_2D,
      this.gl_.TEXTURE_MAG_FILTER,
      this.gl_.NEAREST
    );
    // TODO allow storage formats for RGBA16F and R16F
    this.gl_.texImage2D(
      this.gl_.TEXTURE_2D,
      0,
      this.gl_.RGBA,
      this.width_,
      this.height_,
      0,
      this.gl_.RGBA,
      this.gl_.UNSIGNED_BYTE,
      null
    );
    this.gl_.bindTexture(this.gl_.TEXTURE_2D, null);
  }

  bind() {
    this.gl_.bindTexture(this.gl_.TEXTURE_2D, this.texture);
  }
}

// TODO determine correct location in code
class DepthTexture2D {
  public texture: WebGLTexture;

  private readonly gl_: WebGL2RenderingContext;
  private width_: number;
  private height_: number;

  constructor(gl: WebGL2RenderingContext, width: number, height: number) {
    this.gl_ = gl;
    this.width_ = width;
    this.height_ = height;
    this.texture = this.gl_.createTexture();
    this.setupTexture();
  }

  private setupTexture() {
    this.bind();
    this.gl_.texParameteri(
      this.gl_.TEXTURE_2D,
      this.gl_.TEXTURE_WRAP_S,
      this.gl_.CLAMP_TO_EDGE
    );
    this.gl_.texParameteri(
      this.gl_.TEXTURE_2D,
      this.gl_.TEXTURE_WRAP_T,
      this.gl_.CLAMP_TO_EDGE
    );
    this.gl_.texParameteri(
      this.gl_.TEXTURE_2D,
      this.gl_.TEXTURE_MIN_FILTER,
      this.gl_.NEAREST
    );
    this.gl_.texParameteri(
      this.gl_.TEXTURE_2D,
      this.gl_.TEXTURE_MAG_FILTER,
      this.gl_.NEAREST
    );
    // DEPTH_COMPONENT24 for 24-bit depth precision
    this.gl_.texImage2D(
      this.gl_.TEXTURE_2D,
      0,
      this.gl_.DEPTH_COMPONENT24,
      this.width_,
      this.height_,
      0,
      this.gl_.DEPTH_COMPONENT,
      this.gl_.UNSIGNED_INT,
      null
    );
    this.gl_.bindTexture(this.gl_.TEXTURE_2D, null);
  }

  bind() {
    this.gl_.bindTexture(this.gl_.TEXTURE_2D, this.texture);
  }
}

// TODO determine correct location in code
export class TransparencyBuffer {
  private readonly gl_: WebGL2RenderingContext;
  private framebuffer_: WebGLFramebuffer;
  private buffers_: number[];
  public textures: ImageTexture2D[] = [];
  public depthTexture: DepthTexture2D | null = null;

  constructor(gl: WebGL2RenderingContext, width: number, height: number) {
    this.gl_ = gl;

    this.framebuffer_ = this.gl_.createFramebuffer();
    this.buffers_ = [this.gl_.COLOR_ATTACHMENT0, this.gl_.COLOR_ATTACHMENT1];
    this.resize(width, height);
  }

  resize(width: number, height: number) {
    const accumTexture = new ImageTexture2D(this.gl_, width, height);
    const revealTexture = new ImageTexture2D(this.gl_, width, height);
    const depthTexture = new DepthTexture2D(this.gl_, width, height);

    this.gl_.bindFramebuffer(this.gl_.FRAMEBUFFER, this.framebuffer_);

    this.gl_.activeTexture(this.gl_.TEXTURE0);
    accumTexture.bind();
    this.gl_.framebufferTexture2D(
      this.gl_.FRAMEBUFFER,
      this.gl_.COLOR_ATTACHMENT0,
      this.gl_.TEXTURE_2D,
      accumTexture.texture,
      0
    );

    this.gl_.activeTexture(this.gl_.TEXTURE1);
    revealTexture.bind();
    this.gl_.framebufferTexture2D(
      this.gl_.FRAMEBUFFER,
      this.gl_.COLOR_ATTACHMENT1,
      this.gl_.TEXTURE_2D,
      revealTexture.texture,
      0
    );

    // Attach depth texture to framebuffer
    this.gl_.activeTexture(this.gl_.TEXTURE2);
    depthTexture.bind();
    this.gl_.framebufferTexture2D(
      this.gl_.FRAMEBUFFER,
      this.gl_.DEPTH_ATTACHMENT,
      this.gl_.TEXTURE_2D,
      depthTexture.texture,
      0
    );

    this.textures = [accumTexture, revealTexture];
    this.depthTexture = depthTexture;

    const status = this.gl_.checkFramebufferStatus(this.gl_.FRAMEBUFFER);
    if (status !== this.gl_.FRAMEBUFFER_COMPLETE) {
      throw new Error(
        `Failed to create transparency framebuffer: status ${status}`
      );
    }

    this.gl_.bindFramebuffer(this.gl_.FRAMEBUFFER, null);
  }

  begin() {
    this.gl_.bindFramebuffer(this.gl_.FRAMEBUFFER, this.framebuffer_);
    this.gl_.drawBuffers(this.buffers_);
    this.gl_.blendFuncSeparate(
      WebGL2RenderingContext.ONE,
      WebGL2RenderingContext.ONE,
      WebGL2RenderingContext.ZERO,
      WebGL2RenderingContext.ONE_MINUS_SRC_ALPHA
    );
    this.clear();
    this.gl_.enable(this.gl_.BLEND);

    // Note - two color buffers are textures, depth is frame buffer
    // use framebufferRenderbuffer for depth and regular texture for the others
  }

  end() {
    // In theory this should reset the render state touched in begin
    // TODO implement that by looking into the state class for webgl
    this.gl_.bindFramebuffer(this.gl_.FRAMEBUFFER, null);
  }

  clear() {
    // TODO likely each buffer needs to be cleared separately
    this.gl_.bindFramebuffer(this.gl_.FRAMEBUFFER, this.framebuffer_);
    this.gl_.clearColor(0.0, 0.0, 0.0, 1.0);
    this.gl_.clear(this.gl_.COLOR_BUFFER_BIT);
  }

  dispose() {
    this.gl_.deleteFramebuffer(this.framebuffer_);
    // TODO dispose might later be handled in webgl_textures
    // instead if we reuse the texture class
    for (const texture of this.textures) {
      this.gl_.deleteTexture(texture.texture);
    }
    if (this.depthTexture) {
      this.gl_.deleteTexture(this.depthTexture.texture);
    }
  }
}
