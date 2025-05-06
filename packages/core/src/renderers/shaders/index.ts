import projectedLineVertexShader from "./projected_line_vert.glsl";
import projectedLineFragmentShader from "./projected_line_frag.glsl";
import meshVertexShader from "./mesh_vert.glsl";
import floatImageFragmentShader from "./float_image_frag.glsl";
import floatImageArrayFragmentShader from "./float_image_array_frag.glsl";
import uintImageFragmentShader from "./uint_image_frag.glsl";
import uintImageArrayFragmentShader from "./uint_image_array_frag.glsl";
import pointsVertexShader from "./points_vert.glsl";
import pointsFragmentShader from "./points_frag.glsl";

export type Shader =
  | "projectedLine"
  | "points"
  | "floatImage"
  | "floatImageArray"
  | "uintImage"
  | "uintImageArray";

export type DrawMode = "points" | "triangles";

export const shaderCode: Record<Shader, { vertex: string; fragment: string, mode: DrawMode }> =
  {
    projectedLine: {
      vertex: projectedLineVertexShader,
      fragment: projectedLineFragmentShader,
      mode: "triangles",
    },
    points: {
      vertex: pointsVertexShader,
      fragment: pointsFragmentShader,
      mode: "points",
    },
    // TODO: consolidate image shaders
    floatImage: {
      vertex: meshVertexShader,
      fragment: floatImageFragmentShader,
      mode: "triangles",
    },
    floatImageArray: {
      vertex: meshVertexShader,
      fragment: floatImageArrayFragmentShader,
      mode: "triangles",
    },
    uintImage: {
      vertex: meshVertexShader,
      fragment: uintImageFragmentShader,
      mode: "triangles",
    },
    uintImageArray: {
      vertex: meshVertexShader,
      fragment: uintImageArrayFragmentShader,
      mode: "triangles",
    },
  };
