import type { Shader } from "../../renderers/shaders";
import { RenderableObject } from "../../core/renderable_object";
import { BoxGeometry } from "../geometry/box_geometry";
import type { TextureDataType } from "../textures/texture";
import type { Texture3D } from "../textures/texture_3d";
import { vec3 } from "gl-matrix";

export class VolumeRenderable extends RenderableObject {
  /**
   * The world-space size of this chunk.
   * Used to scale the sampling density so that SamplesPerUnit is consistent
   * across chunks of different sizes and LODs.
   */
  public chunkWorldSize: vec3 = vec3.fromValues(1, 1, 1);

  constructor(texture: Texture3D) {
    super();
    this.geometry = new BoxGeometry(1, 1, 1, 1, 1, 1);
    this.setTexture(0, texture);
    this.programName = dataTypeToVolumeShader(texture.dataType);
    this.cullFaceMode = "front";
    this.depthTest = false;
  }

  public get type() {
    return "VolumeRenderable";
  }

  public override getUniforms(): Record<string, unknown> {
    return {
      ChunkWorldSize: this.chunkWorldSize,
    };
  }
}

function dataTypeToVolumeShader(dataType: TextureDataType): Shader {
  switch (dataType) {
    case "byte":
    case "int":
    case "short":
      return "intVolume";
    case "unsigned_short":
    case "unsigned_byte":
    case "unsigned_int":
      return "uintVolume";
    case "float":
      return "floatVolume";
  }
}
