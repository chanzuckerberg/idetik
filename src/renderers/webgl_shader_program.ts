import { RenderableObject } from "core/renderable_object";
import { Renderer } from "core/renderer";
import { mat4, vec2, vec3 } from "gl-matrix";

type ShaderMap = {
  [type: number]: {
    shader: WebGLShader;
    source: string;
  };
};

export class WebGLShaderProgram {
  private readonly gl_: WebGL2RenderingContext;
  private readonly program_: WebGLProgram;
  private uniformInfo_: Map<string, [WebGLUniformLocation, WebGLActiveInfo]> =
    new Map();
  private shaders_: ShaderMap = {};

  constructor(
    gl: WebGL2RenderingContext,
    vertexShaderSource: string,
    fragmentShaderSource: string
  ) {
    this.gl_ = gl;

    const program = gl.createProgram();
    if (!program) {
      throw new Error(`Failed to create WebGL shader program`);
    }
    this.program_ = program;

    this.addShader(vertexShaderSource, gl.VERTEX_SHADER);
    this.addShader(fragmentShaderSource, gl.FRAGMENT_SHADER);
    this.link();
  }

  public setUniforms(renderer: Renderer, object: RenderableObject) {
    let value: unknown;
    for (const [name, [location, info]] of this.uniformInfo_) {
      if (!SUPPORTED_UNIFORM_TYPES.has(info.type)) {
        throw new Error(`Unsupported uniform type: ${info.type}`);
      }

      let source: string;
      if (name in renderer) {
        value = renderer[name as keyof Renderer];
        source = "renderer";
      } else if (name in object) {
        value = object[name as keyof RenderableObject];
        source = object.type;
      } else {
        throw new Error(`Uniform "${name}" not found in renderer or object`);
      }

      try {
        this.setUniformUnsafe(location, value, info.type);
      } catch (error) {
        throw new Error(
          `Error setting uniform "${name}" to "${value}" from "${source}" ` +
            `expected WebGL2 type "${info.type}" (GLEnum): ` +
            `${error}`
        );
      }
    }
  }

  private setUniformUnsafe(
    location: WebGLUniformLocation,
    value: unknown,
    type: GLenum
  ) {
    switch (type) {
      case this.gl_.FLOAT:
        this.gl_.uniform1f(location, value as number);
        break;
      case this.gl_.FLOAT_VEC2:
        this.gl_.uniform2fv(location, value as vec2);
        break;
      case this.gl_.FLOAT_VEC3:
        this.gl_.uniform3fv(location, value as vec3);
        break;
      case this.gl_.FLOAT_MAT4:
        this.gl_.uniformMatrix4fv(location, false, value as mat4);
        break;
      default:
        throw new Error(`Unsupported uniform type: ${type}`);
    }
  }

  private preprocessUniformLocations() {
    const numUniforms = this.gl_.getProgramParameter(
      this.program_,
      this.gl_.ACTIVE_UNIFORMS
    );
    for (let i = 0; i < numUniforms; i++) {
      const info = this.gl_.getActiveUniform(this.program_, i);
      if (info) {
        if (SAMPLER_TYPES.has(info.type)) {
          // texture samplers are also uniforms, but they are handled separately
          continue;
        }
        const location = this.gl_.getUniformLocation(this.program_, info.name);
        if (location) {
          this.uniformInfo_.set(info.name, [location, info]);
        }
      }
    }
  }

  private addShader(source: string, type: number) {
    const shader = this.gl_.createShader(type);
    if (!shader) {
      throw new Error(`Failed to create a new shader of type ${type}`);
    }

    this.gl_.shaderSource(shader, source);
    this.gl_.compileShader(shader);
    if (!this.gl_.getShaderParameter(shader, this.gl_.COMPILE_STATUS)) {
      const message = this.gl_.getShaderInfoLog(shader);
      this.gl_.deleteShader(shader);
      throw new Error(`Error compiling shader: ${message}`);
    }

    this.gl_.attachShader(this.program_, shader);
    this.shaders_[type] = { shader: shader, source };
  }

  private link() {
    this.gl_.linkProgram(this.program_);
    if (!this.getParameter(this.gl_.LINK_STATUS)) {
      this.deleteShaders();
      const message = this.gl_.getProgramInfoLog(this.program_);
      throw new Error(`Error linking program: ${message}`);
    }

    this.gl_.validateProgram(this.program_);
    if (!this.getParameter(this.gl_.VALIDATE_STATUS)) {
      this.deleteShaders();
      const message = this.gl_.getProgramInfoLog(this.program_);
      throw new Error(`Error validating program: ${message}`);
    }

    this.preprocessUniformLocations();
    this.deleteShaders();
  }

  public use() {
    this.gl_.useProgram(this.program_);
    const error = this.gl_.getError();
    if (error !== this.gl_.NO_ERROR) {
      throw new Error(`Error using WebGL program: ${error}`);
    }
    return this;
  }

  private getParameter(parameter: number) {
    return this.gl_.getProgramParameter(this.program_, parameter);
  }

  private deleteShaders() {
    for (const idx in this.shaders_) {
      this.gl_.deleteShader(this.shaders_[idx].shader);
    }
    this.shaders_ = {};
  }
}

const SUPPORTED_UNIFORM_TYPES: ReadonlySet<GLenum> = new Set<GLenum>([
  WebGL2RenderingContext.FLOAT,
  WebGL2RenderingContext.FLOAT_VEC2,
  WebGL2RenderingContext.FLOAT_VEC3,
  WebGL2RenderingContext.FLOAT_MAT4,
]);

const SAMPLER_TYPES: ReadonlySet<GLenum> = new Set<GLenum>([
  WebGL2RenderingContext.SAMPLER_2D,
  WebGL2RenderingContext.SAMPLER_CUBE,
  WebGL2RenderingContext.SAMPLER_3D,
  WebGL2RenderingContext.SAMPLER_2D_ARRAY,
  WebGL2RenderingContext.SAMPLER_2D_SHADOW,
  WebGL2RenderingContext.SAMPLER_CUBE_SHADOW,
  WebGL2RenderingContext.SAMPLER_2D_ARRAY_SHADOW,
  WebGL2RenderingContext.INT_SAMPLER_2D,
  WebGL2RenderingContext.INT_SAMPLER_3D,
  WebGL2RenderingContext.INT_SAMPLER_CUBE,
  WebGL2RenderingContext.INT_SAMPLER_2D_ARRAY,
  WebGL2RenderingContext.UNSIGNED_INT_SAMPLER_2D,
  WebGL2RenderingContext.UNSIGNED_INT_SAMPLER_3D,
  WebGL2RenderingContext.UNSIGNED_INT_SAMPLER_CUBE,
  WebGL2RenderingContext.UNSIGNED_INT_SAMPLER_2D_ARRAY,
  WebGL2RenderingContext.MAX_SAMPLES,
  WebGL2RenderingContext.SAMPLER_BINDING,
]);
