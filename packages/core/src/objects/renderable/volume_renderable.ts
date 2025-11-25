import { Shader } from "../../renderers/shaders";
import { RenderableObject } from "../../core/renderable_object";
import { BoxGeometry } from "../geometry/box_geometry";
import { TextureDataType } from "../textures/texture";
import { Texture3D } from "../textures/texture_3d";

export type VolumeRenderableProps = {
  width: number;
  height: number;
  depth: number;
  texture: Texture3D;
};

export class VolumeRenderable extends RenderableObject {
  constructor({ width, height, depth, texture }: VolumeRenderableProps) {
    super();
    this.geometry = new BoxGeometry({
      width,
      height,
      depth,
      widthSegments: 1,
      heightSegments: 1,
      depthSegments: 1,
    });
    this.cullFaceMode = "back";
    this.setTexture(0, texture);
    this.programName = dataTypeToVolumeShader(texture.dataType);
  }

  public get type() {
    return "VolumeRenderable";
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
