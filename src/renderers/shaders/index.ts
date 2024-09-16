import meshVertexShader from "./mesh_vert.glsl";
import meshFragmentShader from "./mesh_frag.glsl";
import uint16imageFragmentShader from "./uint16image_frag.glsl";

export type Shader = "mesh" | "uint16image";

export const shaderCode = {
  mesh: {
    vertex: meshVertexShader,
    fragment: meshFragmentShader,
  },
  uint16image: {
    vertex: meshVertexShader,
    fragment: uint16imageFragmentShader,
  },
};
