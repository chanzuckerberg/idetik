import meshVertexShader from "./mesh_vert.glsl";
import meshFragmentShader from "./mesh_frag.glsl";
import uintImageFragmentShader from "./uint_image_frag.glsl";

export type Shader = "mesh" | "uintImage";

export const shaderCode = {
  mesh: {
    vertex: meshVertexShader,
    fragment: meshFragmentShader,
  },
  uintImage: {
    vertex: meshVertexShader,
    fragment: uintImageFragmentShader,
  },
};
