import projectedLineVertexShader from "./projected_line_vert.glsl";
import projectedLineFragmentShader from "./projected_line_frag.glsl";
import meshVertexShader from "./mesh_vert.glsl";
import scalarImageFragmentShader from "./scalar_image_frag.glsl";
import scalarImageArrayFragmentShader from "./scalar_image_array_frag.glsl";
import pointsVertexShader from "./points_vert.glsl";
import pointsFragmentShader from "./points_frag.glsl";
import wireframeVertexShader from "./wireframe_vert.glsl";
import wireframeFragmentShader from "./wireframe_frag.glsl";
import { TextureDataType } from "../../objects/textures/texture";

export type Shader =
  | "projectedLine"
  | "points"
  | "wireframe"
  | "scalarImage"
  | "scalarImageArray";

export type ProgramDefine = "TEXTURE_DATA_TYPE_INT" | "TEXTURE_DATA_TYPE_UINT";

type ProgramProps = {
  name: Shader;
  textureDataType?: TextureDataType;
};

export class Program {
  public readonly name: Shader;
  public readonly textureDataType?: TextureDataType;
  public readonly defines: ReadonlyArray<[ProgramDefine, string]>;

  constructor(props: ProgramProps) {
    this.name = props.name;
    this.textureDataType = props.textureDataType;
    this.defines = this.getDefines();
  }

  private getDefines(): ReadonlyArray<[ProgramDefine, string]> {
    const defines: Array<[ProgramDefine, string]> = [];

    switch (this.textureDataType) {
      case "byte":
      case "int":
      case "short":
        defines.push(["TEXTURE_DATA_TYPE_INT", "1"]);
        break;
      case "unsigned_byte":
      case "unsigned_int":
      case "unsigned_short":
        defines.push(["TEXTURE_DATA_TYPE_UINT", "1"]);
        break;
      case "float":
    }

    return defines;
  }

  public key() {
    return `${this.name}${this.textureDataType}`;
  }
}

export const shaderCode: Record<Shader, { vertex: string; fragment: string }> =
  {
    projectedLine: {
      vertex: projectedLineVertexShader,
      fragment: projectedLineFragmentShader,
    },
    points: {
      vertex: pointsVertexShader,
      fragment: pointsFragmentShader,
    },
    wireframe: {
      vertex: wireframeVertexShader,
      fragment: wireframeFragmentShader,
    },
    scalarImage: {
      vertex: meshVertexShader,
      fragment: scalarImageFragmentShader,
    },
    scalarImageArray: {
      vertex: meshVertexShader,
      fragment: scalarImageArrayFragmentShader,
    },
  };
