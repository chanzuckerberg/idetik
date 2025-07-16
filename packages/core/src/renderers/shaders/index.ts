import projectedLineVertexShader from "./projected_line_vert.glsl";
import projectedLineFragmentShader from "./projected_line_frag.glsl";
import meshVertexShader from "./mesh_vert.glsl";
import scalarImageFragmentShader from "./scalar_image_frag.glsl";
import scalarImageArrayFragmentShader from "./scalar_image_array_frag.glsl";
import pointsVertexShader from "./points_vert.glsl";
import pointsFragmentShader from "./points_frag.glsl";
import wireframeVertexShader from "./wireframe_vert.glsl";
import wireframeFragmentShader from "./wireframe_frag.glsl";

export type Shader =
  | "projectedLine"
  | "points"
  | "wireframe"
  | "scalarImage"
  | "scalarImageArray";

export const shaderCode: Record<Shader, { vertex: string; fragment: string; }> = {
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