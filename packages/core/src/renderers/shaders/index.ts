import projectedLineVertexShader from "./projected_line_vert.glsl";
import projectedLineFragmentShader from "./projected_line_frag.glsl";
import meshVertexShader from "./mesh_vert.glsl";
import scalarImageFragmentShader from "./scalar_image_frag.glsl";
import scalarImageArrayFragmentShader from "./scalar_image_array_frag.glsl";
import pointsVertexShader from "./points_vert.glsl";
import pointsFragmentShader from "./points_frag.glsl";
import wireframeVertexShader from "./wireframe_vert.glsl";
import wireframeFragmentShader from "./wireframe_frag.glsl";
import volumeVertexShader from "./volume_vert.glsl";
import volumeFragmentShader from "./volume_frag.glsl";
import volumeArrayFragmentShader from "./volume_array_frag.glsl";
import labelImage from "./label_image_frag.glsl";

export type Shader =
  | "floatScalarImage"
  | "floatScalarImageArray"
  | "floatVolume"
  | "floatVolumeArray"
  | "intScalarImage"
  | "intScalarImageArray"
  | "intVolume"
  | "intVolumeArray"
  | "labelImage"
  | "points"
  | "projectedLine"
  | "uintScalarImage"
  | "uintScalarImageArray"
  | "uintVolume"
  | "uintVolumeArray"
  | "wireframe";

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
  floatVolume: {
    vertex: volumeVertexShader,
    fragment: volumeFragmentShader,
  },
  floatVolumeArray: {
    vertex: volumeVertexShader,
    fragment: volumeArrayFragmentShader,
  },
  intVolume: {
    vertex: volumeVertexShader,
    fragment: volumeFragmentShader,
    fragmentDefines: new Map([["TEXTURE_DATA_TYPE_INT", "1"]]),
  },
  uintVolume: {
    vertex: volumeVertexShader,
    fragment: volumeFragmentShader,
    fragmentDefines: new Map([["TEXTURE_DATA_TYPE_UINT", "1"]]),
  },
  intVolumeArray: {
    vertex: volumeVertexShader,
    fragment: volumeArrayFragmentShader,
    fragmentDefines: new Map([["TEXTURE_DATA_TYPE_INT", "1"]]),
  },
  uintVolumeArray: {
    vertex: volumeVertexShader,
    fragment: volumeArrayFragmentShader,
    fragmentDefines: new Map([["TEXTURE_DATA_TYPE_UINT", "1"]]),
  },
};
