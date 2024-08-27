import meshVertexShader from "./mesh_vert.glsl";
import meshFragmentShader from "./mesh_frag.glsl";

export type Shader = "mesh";

export const shaderCode = {
  mesh: {
    vertex: meshVertexShader,
    fragment: meshFragmentShader,
  },
};
