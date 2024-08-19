export class WebGLShaders {
  private readonly gl_: WebGL2RenderingContext;
  private readonly program_: WebGLProgram | null;
  private readonly uniformRegex_ =
    /^\s*uniform\s+(?:highp|mediump|lowp|)[\w\s]+\s+(\w+)\s*;\s*$/gm;

  private uniformLocations_: Map<string, WebGLUniformLocation>;
  private shaderSources: string[] = [];
  private shaderObjects: WebGLShader[] = [];

  constructor(gl: WebGL2RenderingContext) {
    this.gl_ = gl;
    this.program_ = gl.createProgram();
    if (!this.program_) {
      throw new Error(`Failed to create WebGL shader program`);
    }
    this.uniformLocations_ = new Map<string, WebGLUniformLocation>();
  }

  public addShader(source: string, type: number) {
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

    this.gl_.attachShader(this.program, shader);
    this.shaderSources.push(source);
    this.shaderObjects.push(shader);
  }

  public link() {
    this.gl_.linkProgram(this.program);
    if (!this.gl_.getProgramParameter(this.program, this.gl_.LINK_STATUS)) {
      this.deleteShaderObjects();
      this.deleteProgram();
      const message = this.gl_.getProgramInfoLog(this.program);
      throw new Error(`Error linking program: ${message}`);
    }

    this.gl_.validateProgram(this.program);
    if (!this.gl_.getProgramParameter(this.program, this.gl_.VALIDATE_STATUS)) {
      this.deleteShaderObjects();
      this.deleteProgram();
      const message = this.gl_.getProgramInfoLog(this.program);
      throw new Error(`Error validating program: ${message}`);
    }

    this.deleteShaderObjects();
    this.shaderSources.forEach(s => this.preprocessUniformLocations(s));
  }

  public use() {
    this.gl_.useProgram(this.program);
    const error = this.gl_.getError();
    if (error !== this.gl_.NO_ERROR) {
      throw new Error(`Error using WebGL program: ${error}`);
    }
  }

  public getUniformLoc(name: string) {
    // Preprocessing uniform locations doesn’t work for all use cases, so we
    // can’t assume all uniform locations are cached on initialization.
    if (!this.uniformLocations_.has(name)) {
      const location = this.gl_.getUniformLocation(this.program, name);
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
    while ((match = this.uniformRegex_.exec(source)) !== null) {
      const name = match[1];
      const location = this.gl_.getUniformLocation(this.program, name);
      if (location) {
        this.uniformLocations_.set(name, location);
      }
    }
  }

  private deleteShaderObjects() {
    if (this.shaderObjects.length) {
      this.shaderObjects.forEach((s) => this.gl_.deleteShader(s));
    }
  }

  private deleteProgram() {
    this.gl_.deleteProgram(this.program);
  }

  private get program() {
    if (!this.program_) {
      throw new Error(`WebGL program is not initialized or has been deleted`);
    }
    return this.program_;
  }
}
