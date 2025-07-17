import { Shader, shaderCode } from "./shaders";
import { WebGLShaderProgram } from "./webgl_shader_program";

function replaceSourceDefines(
  source: string,
  defines?: ReadonlyArray<[string, string]>
): string {
  const definesSource = defines
    ? defines.map(([key, value]) => `#define ${key} ${value}`).join("\n")
    : "";
  return source.replace("#pragma inject_defines", definesSource);
}

export class WebGLShaderPrograms {
  private gl_: WebGL2RenderingContext;
  private programs_: Map<Shader, WebGLShaderProgram> = new Map();

  constructor(gl: WebGL2RenderingContext) {
    this.gl_ = gl;
  }

  public get(shader: Shader): WebGLShaderProgram {
    let program = this.programs_.get(shader);
    if (program === undefined) {
      const code = shaderCode[shader];
      const vertexShaderSource = code.vertex;
      const fragmentShaderSource = replaceSourceDefines(
        code.fragment,
        code.fragmentDefines
      );
      program = new WebGLShaderProgram(
        this.gl_,
        vertexShaderSource,
        fragmentShaderSource
      );
      this.programs_.set(shader, program);
    }
    return program;
  }
}
