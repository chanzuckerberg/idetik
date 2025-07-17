import { Program, ProgramDefine, shaderCode } from "./shaders";
import { WebGLShaderProgram } from "./webgl_shader_program";

function replaceSourceDefines(
  source: string,
  defines?: ReadonlyArray<[ProgramDefine, string]>
): string {
  const definesSource = defines
    ? defines.map(([key, value]) => `#define ${key} ${value}`).join("\n")
    : "";
  return source.replace("#pragma inject_defines", definesSource);
}

export class WebGLShaderPrograms {
  private gl_: WebGL2RenderingContext;
  private programs_: Map<string, WebGLShaderProgram> = new Map();

  constructor(gl: WebGL2RenderingContext) {
    this.gl_ = gl;
  }

  public get(p: Program): WebGLShaderProgram {
    const key = p.key();
    let program = this.programs_.get(key);
    if (program === undefined) {
      const code = shaderCode[p.name];
      const vertexShaderSource = replaceSourceDefines(code.vertex, p.defines);
      const fragmentShaderSource = replaceSourceDefines(
        code.fragment,
        p.defines
      );
      program = new WebGLShaderProgram(
        this.gl_,
        vertexShaderSource,
        fragmentShaderSource
      );
      this.programs_.set(key, program);
    }
    return program;
  }
}
