import meshVertexShader from "./mesh_vert.glsl";
import meshFragmentShader from "./mesh_frag.glsl";

import lineVertexShader from "./line_vert.glsl";
import lineFragmentShader from "./line_frag.glsl";

export type Shader = "mesh" | "line";

export const shaderCode = {
  mesh: {
    vertex: meshVertexShader,
    fragment: meshFragmentShader,
  },
  line: {
    vertex: lineVertexShader,
    fragment: lineFragmentShader,
  },
};
