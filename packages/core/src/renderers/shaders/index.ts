import projectedLineVertexShader from "./projected_line_vert.glsl";
import projectedLineFragmentShader from "./projected_line_frag.glsl";
import meshVertexShader from "./mesh_vert.glsl";
import scalarImageFragmentShader from "./scalar_image_frag.glsl";
import scalarImageArrayFragmentShader from "./scalar_image_array_frag.glsl";
import pointsVertexShader from "./points_vert.glsl";
import pointsFragmentShader from "./points_frag.glsl";

export type Shader =
  | "projectedLine"
  | "points"
  | "floatImage"
  | "floatImageArray"
  | "intImage"
  | "intImageArray"
  | "uintImage"
  | "uintImageArray";

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
  },
  floatImageArray: {
    vertex: meshVertexShader,
    fragment: scalarImageArrayFragmentShader,
  },
  intImage: {
    vertex: meshVertexShader,
    fragment: scalarImageFragmentShader,
    fragmentDefines: new Map<string, string>([["SCALAR_TYPE_INT", "1"]]),
  },
  intImageArray: {
    vertex: meshVertexShader,
    fragment: scalarImageArrayFragmentShader,
    fragmentDefines: new Map<string, string>([["SCALAR_TYPE_INT", "1"]]),
  },
  uintImage: {
    vertex: meshVertexShader,
    fragment: scalarImageFragmentShader,
    fragmentDefines: new Map<string, string>([["SCALAR_TYPE_UINT", "1"]]),
  },
  uintImageArray: {
    vertex: meshVertexShader,
    fragment: scalarImageArrayFragmentShader,
    fragmentDefines: new Map<string, string>([["SCALAR_TYPE_UINT", "1"]]),
  },
};
