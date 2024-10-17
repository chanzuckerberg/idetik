import projectedLineVertexShader from "./projected_line_vert.glsl";
import projectedLineFragmentShader from "./projected_line_frag.glsl";
import meshVertexShader from "./mesh_vert.glsl";
import meshFragmentShader from "./mesh_frag.glsl";
import uintImageFragmentShader from "./uint_image_frag.glsl";

export type Shader = "projectedLine" | "mesh" | "uintImage";

export const shaderCode: Record<Shader, { vertex: string; fragment: string }> =
  {
    projectedLine: {
      vertex: projectedLineVertexShader,
      fragment: projectedLineFragmentShader,
    },
    mesh: {
      vertex: meshVertexShader,
      fragment: meshFragmentShader,
    },
    uintImage: {
      vertex: meshVertexShader,
      fragment: uintImageFragmentShader,
    },
  };
