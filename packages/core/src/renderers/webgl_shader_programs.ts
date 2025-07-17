import { ProgramProps, shaderCode } from "./shaders";
import { WebGLShaderProgram } from "./webgl_shader_program";

function programKey(props: ProgramProps): string {
  const vertexDefines = props.vertexDefines
    ? props.vertexDefines.join(",")
    : "";
  const fragmentDefines = props.fragmentDefines
    ? props.fragmentDefines.join(",")
    : "";
  return `${props.name}:${vertexDefines}:${fragmentDefines}`;
}

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
  private programs_: Map<string, WebGLShaderProgram> = new Map();

  constructor(gl: WebGL2RenderingContext) {
    this.gl_ = gl;
  }

  public get(props: ProgramProps): WebGLShaderProgram {
    const key = programKey(props);
    if (!this.programs_.has(key)) {
      const code = shaderCode[props.name];
      const vertexShaderSource = replaceSourceDefines(
        code.vertex,
        props.vertexDefines
      );
      const fragmentShaderSource = replaceSourceDefines(
        code.fragment,
        props.fragmentDefines
      );
      const program = new WebGLShaderProgram(
        this.gl_,
        vertexShaderSource,
        fragmentShaderSource
      );
      this.programs_.set(key, program);
    }
    return this.programs_.get(key)!;
  }
}
