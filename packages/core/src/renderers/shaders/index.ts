import projectedLineVertexShader from "./projected_line_vert.glsl";
import projectedLineFragmentShader from "./projected_line_frag.glsl";
import meshVertexShader from "./mesh_vert.glsl";
import scalarImageFragmentShader from "./scalar_image_frag.glsl";
import scalarImageArrayFragmentShader from "./scalar_image_array_frag.glsl";
import pointsVertexShader from "./points_vert.glsl";
import pointsFragmentShader from "./points_frag.glsl";
import labelImageFragmentShader from "./label_image_frag.glsl";

export type Shader =
  | "projectedLine"
  | "points"
  | "floatImage"
  | "floatImageArray"
  | "intImage"
  | "intImageArray"
  | "uintImage"
  | "uintImageArray"
  | "labelImage";

export const shaderCode: Record<
  Shader,
  { vertex: string; fragment: string; fragmentDefines?: Map<string, string> }
> = {
  projectedLine: {
    vertex: projectedLineVertexShader,
    fragment: projectedLineFragmentShader,
  },
  points: {
    vertex: pointsVertexShader,
    fragment: pointsFragmentShader,
  },
  // TODO: consolidate image shaders
  floatImage: {
    vertex: meshVertexShader,
    fragment: scalarImageFragmentShader,
    fragmentDefines: new Map<string, string>([["SAMPLER_TYPE", "sampler2D"]]),
  },
  floatImageArray: {
    vertex: meshVertexShader,
    fragment: scalarImageArrayFragmentShader,
    fragmentDefines: new Map<string, string>([
      ["SAMPLER_TYPE", "sampler2DArray"],
    ]),
  },
  intImage: {
    vertex: meshVertexShader,
    fragment: scalarImageFragmentShader,
    fragmentDefines: new Map<string, string>([["SAMPLER_TYPE", "isampler2D"]]),
  },
  intImageArray: {
    vertex: meshVertexShader,
    fragment: scalarImageArrayFragmentShader,
    fragmentDefines: new Map<string, string>([
      ["SAMPLER_TYPE", "isampler2DArray"],
    ]),
  },
  uintImage: {
    vertex: meshVertexShader,
    fragment: scalarImageFragmentShader,
    fragmentDefines: new Map<string, string>([["SAMPLER_TYPE", "usampler2D"]]),
  },
  uintImageArray: {
    vertex: meshVertexShader,
    fragment: scalarImageArrayFragmentShader,
    fragmentDefines: new Map<string, string>([
      ["SAMPLER_TYPE", "usampler2DArray"],
    ]),
  },
  labelImage: {
    vertex: meshVertexShader,
    fragment: labelImageFragmentShader,
  },
};
