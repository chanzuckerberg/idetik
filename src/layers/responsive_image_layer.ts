import { vec3 } from "gl-matrix";

import { Layer } from "core/layer";
import { Mesh } from "objects/renderable/mesh";
import { PlaneGeometry } from "objects/geometry/plane_geometry";
import { Region } from "data/region";
import { ImageChunkSource } from "data/image_chunk";
import { DataTexture2D } from "objects/textures/data_texture_2d";
import { OrthographicCamera } from "objects/cameras/orthographic_camera";

// Loads data from an image source into renderable objects.
export class ResponsiveImageLayer extends Layer {
  private readonly source_: ImageChunkSource;
  // TODO: remove this when region is passed through to update.
  // https://github.com/chanzuckerberg/imaging-active-learning/issues/33
  private readonly region_: Region;
  private readonly camera_: OrthographicCamera;

  constructor(source: ImageChunkSource, region: Region, camera: OrthographicCamera) {
    super();
    this.setState("initialized");
    this.source_ = source;
    this.region_ = region;
    this.camera_ = camera;
  }

  public update(): void {
    switch (this.state) {
      case "initialized":
        this.load(this.region_);
        break;
      case "loading":
      case "ready":
        break;
      default: {
        const exhaustiveCheck: never = this.state;
        throw new Error(`Unhandled LayerState case: ${exhaustiveCheck}`);
      }
    }
  }

  private async getXYDimensionNames(): Promise<{ xName: string, yName: string }> {
    const loader = await this.source_.open();
    const shape = await loader.getShape(this.region_);
    // y (height) is the first non-unit axis
    // x (width) is the second non-unit axis
    const yIndex = shape.findIndex((axis) => axis.length > 1);
    const yName = shape[yIndex].axis;
    const xIndex = shape.findIndex((axis, i) => i !== yIndex && axis.length > 1);
    const xName = shape[xIndex].axis;
    return { xName, yName };
  }

  private async getCameraRegion(): Promise<Region> {
    const loader = await this.source_.open();
    const shape = await loader.getShape(this.region_, 0);

    const cameraRegion = [...this.region_];
    const { left, right, bottom, top } = this.camera_.viewportFrame;
    const { xName, yName } = await this.getXYDimensionNames();

    const yShape = shape.find((axis) => axis.axis === yName);
    if (!yShape) {
      throw new Error(`Axis ${yName} not found in shape ${shape}`);
    }
    const yStart = Math.max(top, 0);
    const yStop = Math.min(bottom, yShape.length);

    const yInterval = { start: yStart, stop: yStop };

    const xShape = shape.find((axis) => axis.axis === xName);
    if (!xShape) {
      throw new Error(`Axis ${xName} not found in shape ${shape}`);
    }
    const xStart = Math.max(left, 0);
    const xStop = Math.min(right, xShape.length);
    const xInterval = { start: xStart, stop: xStop };

    const yIndex = this.region_.findIndex((index) => index.dimension === yName);
    if (yIndex != -1) {
      cameraRegion[yIndex].index = yInterval;
    } else {
      cameraRegion.push({ dimension: yName, index: yInterval });
    }

    const xIndex = this.region_.findIndex((index) => index.dimension === xName);
    if (xIndex != -1) {
      cameraRegion[xIndex].index = xInterval;
    } else {
      cameraRegion.push({ dimension: xName, index: xInterval });
    }

    return cameraRegion;
  }

  private async load(region: Region) {
    this.clearObjects();
    if (this.state !== "initialized") {
      throw new Error(`Trying to load chunks more than once.`);
    }
    this.setState("loading");
    const loader = await this.source_.open();
    const shape = await loader.getShape(region);
    const { xName, yName } = await this.getXYDimensionNames();
    const xIndex = shape.findIndex((axis) => axis.axis === xName);
    const yIndex = shape.findIndex((axis) => axis.axis === yName);
    console.debug("got shape", shape);
    const plane = new PlaneGeometry(shape[xIndex].length, shape[yIndex].length, 1, 1);

    const cameraRegion = await this.getCameraRegion();
    console.debug("loading chunk with region", cameraRegion);
    const chunk = await loader.loadChunk(cameraRegion, undefined, 0);
    console.debug("got chunk", chunk);
    const texture = new DataTexture2D(chunk.data, chunk.shape.x, chunk.shape.y);
    texture.scaleRST = vec3.fromValues(1.0, 1.0, 1.0);


    texture.dataFormat = "red_integer";
    if (chunk.data instanceof Uint16Array) {
      texture.dataType = "unsigned_short";
    }

    texture.unpackRowLength = chunk.rowStride;
    texture.unpackAlignment = chunk.rowAlignmentBytes;

    this.addObject(new Mesh(plane, texture));
    this.setState("ready");
  }

  public onCameraFrameChange() {
    this.setState("initialized");
    this.update();
  }
}
