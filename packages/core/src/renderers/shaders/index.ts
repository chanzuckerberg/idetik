import projectedLineVertexShader from "./projected_line_vert.glsl";
import projectedLineFragmentShader from "./projected_line_frag.glsl";
import meshVertexShader from "./mesh_vert.glsl";
import scalarImageFragmentShader from "./scalar_image_frag.glsl";
import scalarImageArrayFragmentShader from "./scalar_image_array_frag.glsl";
import pointsVertexShader from "./points_vert.glsl";
import pointsFragmentShader from "./points_frag.glsl";
import wireframeVertexShader from "./wireframe_vert.glsl";
import wireframeFragmentShader from "./wireframe_frag.glsl";
import labelImage from "./label_image_frag.glsl";

export type Shader =
  | "projectedLine"
  | "points"
  | "wireframe"
  | "floatScalarImage"
  | "floatScalarImageArray"
  | "intScalarImage"
  | "intScalarImageArray"
  | "uintScalarImage"
  | "uintScalarImageArray"
  | "labelImage";

type ShaderCode = {
  vertex: string;
  vertexDefines?: ReadonlyMap<string, string>;
  fragment: string;
  fragmentDefines?: ReadonlyMap<string, string>;
};

export const shaderCode: Record<Shader, ShaderCode> = {
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
  floatScalarImage: {
    vertex: meshVertexShader,
    fragment: scalarImageFragmentShader,
  },
  floatScalarImageArray: {
    vertex: meshVertexShader,
    fragment: scalarImageArrayFragmentShader,
  },
  intScalarImage: {
    vertex: meshVertexShader,
    fragment: scalarImageFragmentShader,
    fragmentDefines: new Map([["TEXTURE_DATA_TYPE_INT", "1"]]),
  },
  intScalarImageArray: {
    vertex: meshVertexShader,
    fragment: scalarImageArrayFragmentShader,
    fragmentDefines: new Map([["TEXTURE_DATA_TYPE_INT", "1"]]),
  },
  uintScalarImage: {
    vertex: meshVertexShader,
    fragment: scalarImageFragmentShader,
    fragmentDefines: new Map([["TEXTURE_DATA_TYPE_UINT", "1"]]),
  },
  uintScalarImageArray: {
    vertex: meshVertexShader,
    fragment: scalarImageArrayFragmentShader,
    fragmentDefines: new Map([["TEXTURE_DATA_TYPE_UINT", "1"]]),
  },
  labelImage: {
    vertex: meshVertexShader,
    fragment: labelImage,
  },
};
