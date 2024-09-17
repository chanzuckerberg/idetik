import meshVertexShader from "./mesh_vert.glsl";
import meshFragmentShader from "./mesh_frag.glsl";
import uint16ImageFragmentShader from "./uint16_image_frag.glsl";

export type Shader = "mesh" | "uint16Image";

export const shaderCode = {
  mesh: {
    vertex: meshVertexShader,
    fragment: meshFragmentShader,
  },
  uint16Image: {
    vertex: meshVertexShader,
    fragment: uint16ImageFragmentShader,
  },
};
