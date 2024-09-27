import projectedLineVertexShader from "./projected_line_vert.glsl";
import projectedLineFragmentShader from "./projected_line_frag.glsl";
import meshVertexShader from "./mesh_vert.glsl";
import meshFragmentShader from "./mesh_frag.glsl";
import uint16ImageFragmentShader from "./uint16_image_frag.glsl";

export type Shader = "projectedLine" | "mesh" | "uint16Image";

export const shaderCode: Record<Shader, { vertex: string; fragment: string }> = {
  projectedLine: {
    vertex: projectedLineVertexShader,
    fragment: projectedLineFragmentShader,
  },
  mesh: {
    vertex: meshVertexShader,
    fragment: meshFragmentShader,
  },
  uint16Image: {
    vertex: meshVertexShader,
    fragment: uint16ImageFragmentShader,
  },
};

