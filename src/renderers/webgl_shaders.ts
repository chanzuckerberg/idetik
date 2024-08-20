type ShaderMap = {
  [type: number]: {
    shader: WebGLShader;
    source: string;
  };
};

const regex = /^\s*uniform\s+(?:highp|mediump|lowp|)[\w\s]+\s+(\w+)\s*;\s*$/gm;

export class WebGLShaders {
  private readonly gl_: WebGL2RenderingContext;
  private readonly program_: WebGLProgram;
  private uniformLocations_: Map<string, WebGLUniformLocation>;
  private shaders_: ShaderMap = {};
  private linked_ = false;

  constructor(gl: WebGL2RenderingContext) {
    this.gl_ = gl;
    const program = gl.createProgram();
    if (!program) {
      throw new Error(`Failed to create WebGL shader program`);
    }
    this.program_ = program;

    this.uniformLocations_ = new Map<string, WebGLUniformLocation>();
  }

  public addShader(source: string, type: number) {
    if (this.linked_) {
      throw new Error(
        "The program is already linked. Create a new shader program to add shaders."
      );
    }

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

  public link() {
    if (this.linked_) {
      throw new Error("The program is already linked.");
    }

    this.gl_.linkProgram(this.program_);
    if (!this.getParameter(this.gl_.LINK_STATUS)) {
      this.deleteShaders();
      const message = this.gl_.getProgramInfoLog(this.program_);
      throw new Error(`Error linking program: ${message}`);
    }

    this.linked_ = true;

    this.gl_.validateProgram(this.program_);
    if (!this.getParameter(this.gl_.VALIDATE_STATUS)) {
      this.deleteShaders();
      const message = this.gl_.getProgramInfoLog(this.program_);
      throw new Error(`Error validating program: ${message}`);
    }

    for (const idx in this.shaders_) {
      this.preprocessUniformLocations(this.shaders_[idx].source);
    }
    this.deleteShaders();
  }

  public use() {
    this.gl_.useProgram(this.program_);
    const error = this.gl_.getError();
    if (error !== this.gl_.NO_ERROR) {
      throw new Error(`Error using WebGL program: ${error}`);
    }
  }

  public getUniformLoc(name: string) {
    // Preprocessing uniform locations doesn’t work for all use cases, so we
    // can’t assume all uniform locations are cached on initialization.
    if (!this.uniformLocations_.has(name)) {
      const location = this.gl_.getUniformLocation(this.program_, name);
      if (location) {
        this.uniformLocations_.set(name, location);
      } else {
        throw new Error(`Uniform ${name} not found in shader program`);
      }
    }
    return this.uniformLocations_.get(name)!;
  }

  private preprocessUniformLocations(source: string) {
    let match;
    while ((match = regex.exec(source)) !== null) {
      const name = match[1];
      const location = this.gl_.getUniformLocation(this.program_, name);
      if (location) {
        this.uniformLocations_.set(name, location);
      }
    }
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
