import { Shader, shaderCode } from "./shaders";
import { WebGLShaderProgram } from "./webgl_shader_program";

const pragmaInjectDefines = "#pragma inject_defines";

export class WebGLShaderPrograms {
  private gl_: WebGL2RenderingContext;
  private programs_: Map<Shader, WebGLShaderProgram> = new Map();

  constructor(gl: WebGL2RenderingContext) {
    this.gl_ = gl;
  }

  public use(shader: Shader): WebGLShaderProgram {
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
      program.use();
      const error = this.gl_.getError();
      if (error !== this.gl_.NO_ERROR) {
        throw new Error(`Error using WebGL program: ${error}`);
      }
      this.programs_.set(shader, program);
    } else {
      program.use();
    }
    return program;
  }
}

function replaceSourceDefines(
  source: string,
  defines?: ReadonlyMap<string, string>
): string {
  if (defines === undefined || defines.size === 0) return source;
  if (!source.includes(pragmaInjectDefines)) {
    throw new Error(
      `Shader source does not contain "${pragmaInjectDefines}" directive`
    );
  }
  const definesSource = Array(defines.entries())
    .map(([key, value]) => `#define ${key} ${value}`)
    .join("\n");
  // Offset the line number so that the original source file line
  // numbers are interpretable. The +1 accounts for the #pragma directive
  // to be replaced.
  const lineNumberOffset = 1 - defines.size;
  const nextLineNumber = `#line __LINE__ + ${lineNumberOffset}`;
  const sourceToInject = `${definesSource}\n${nextLineNumber}`;
  return source.replace(pragmaInjectDefines, sourceToInject);
}
