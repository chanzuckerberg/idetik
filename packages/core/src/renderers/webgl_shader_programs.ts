import { Shader, shaderCode } from "./shaders";
import { WebGLShaderProgram } from "./webgl_shader_program";

const PRAGMA_INJECT_DEFINES = "#pragma inject_defines";

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
      const vertexShaderSource = replaceSourceDefines(
        code.vertex,
        code.vertexDefines
      );
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

function replaceSourceDefines(
  source: string,
  defines?: ReadonlyArray<[string, string]>
): string {
  if (defines === undefined) return source;
  const definesSource = defines
    .map(([key, value]) => `#define ${key} ${value}`)
    .join("\n");
  if (!source.includes(PRAGMA_INJECT_DEFINES)) {
    throw new Error(
      `Shader source does not contain "${PRAGMA_INJECT_DEFINES}" directive`
    );
  }
  return source.replace(PRAGMA_INJECT_DEFINES, definesSource);
}
