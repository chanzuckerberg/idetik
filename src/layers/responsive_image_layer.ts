import { vec3 } from "gl-matrix";

import { Layer } from "core/layer";
import { Mesh } from "objects/renderable/mesh";
import { PlaneGeometry } from "objects/geometry/plane_geometry";
import { Interval, Region } from "data/region";
import { ImageChunkSource } from "data/image_chunk";
import { DataTexture2D } from "objects/textures/data_texture_2d";
import { OrthographicCamera } from "objects/cameras/orthographic_camera";
import { Renderer } from "core/renderer";

// Loads data from an image source into renderable objects.
export class ResponsiveImageLayer extends Layer {
  private readonly source_: ImageChunkSource;
  // TODO: remove this when region is passed through to update.
  // https://github.com/chanzuckerberg/imaging-active-learning/issues/33
  private readonly region_: Region;
  private readonly camera_: OrthographicCamera;
  private readonly renderer_: Renderer;

  private mesh_: Mesh | null = null;

  constructor(
    source: ImageChunkSource,
    region: Region,
    camera: OrthographicCamera,
    renderer: Renderer
  ) {
    super();
    this.setState("initialized");
    this.source_ = source;
    this.region_ = region;
    this.camera_ = camera;
    this.renderer_ = renderer;
  }

  public update(force: boolean = false): void {
    if (force) {
      this.load(this.region_);
      return;
    }
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

  private async getCameraRegion(): Promise<Region> {
    const loader = await this.source_.open();
    const { shape, name } = await loader.getChunkAttributes(this.region_, 0);
    console.debug("got shape", shape, name);

    const cameraRegion = [...this.region_];
    const { left, right, bottom, top } = this.camera_.viewportFrame;
    const yStart = Math.max(top, 0);
    const yStop = Math.min(bottom, shape.y);

    const yInterval = { start: yStart, stop: yStop };

    const xStart = Math.max(left, 0);
    const xStop = Math.min(right, shape.x);
    const xInterval = { start: xStart, stop: xStop };

    const yIndex = this.region_.findIndex(
      (index) => index.dimension === name.y
    );
    if (yIndex != -1) {
      cameraRegion[yIndex].index = yInterval;
    } else {
      cameraRegion.push({ dimension: name.y, index: yInterval });
    }

    const xIndex = this.region_.findIndex(
      (index) => index.dimension === name.x
    );
    if (xIndex != -1) {
      cameraRegion[xIndex].index = xInterval;
    } else {
      cameraRegion.push({ dimension: name.x, index: xInterval });
    }

    return cameraRegion;
  }

  private async load(region: Region) {
    // if (this.state !== "initialized") {
    //   throw new Error(`Trying to load chunks more than once.`);
    // }
    if (!this.mesh_) {
      this.setState("loading");
    }
    const loader = await this.source_.open();
    const { shape } = await loader.getChunkAttributes(region, 0);
    const plane = new PlaneGeometry(shape.x, shape.y, 1, 1);

    const cameraRegion = await this.getCameraRegion();
    const cameraYInterval = cameraRegion[cameraRegion.length - 2]
      .index as Interval;
    const cameraYLength = cameraYInterval.stop - cameraYInterval.start;
    const cameraXInterval = cameraRegion[cameraRegion.length - 1]
      .index as Interval;
    const cameraXLength = cameraXInterval.stop - cameraXInterval.start;

    const { left, right, bottom, top } = this.camera_.viewportFrame;
    const screenWidth = (this.renderer_.width * cameraXLength) / (right - left);
    const screenHeight =
      (this.renderer_.height * cameraYLength) / (bottom - top);

    let scaleToFetch = loader.numScales - 1;
    for (let i = scaleToFetch; i >= 0; i--) {
      const { shape } = await loader.getChunkAttributes(cameraRegion, i);
      scaleToFetch = i;
      if (shape.x > screenWidth && shape.y > screenHeight) {
        break;
      }
    }
    console.log("SCALE TO FETCH", scaleToFetch);
    const chunk = await loader.loadChunk(cameraRegion, undefined, scaleToFetch);
    console.log("LOADED CHUNK", chunk);

    const texture = new DataTexture2D(chunk.data, chunk.shape.x, chunk.shape.y);

    texture.scaleRST = vec3.fromValues(
      shape.x / chunk.shape.x / chunk.scale.x,
      shape.y / chunk.shape.y / chunk.scale.y,
      1.0
    );
    texture.offsetRST = vec3.fromValues(
      chunk.offset.x / shape.x,
      chunk.offset.y / shape.y,
      0.0
    );
    // easier to see unloaded regions for debugging
    texture.wrapS = "clamp_to_edge";
    texture.wrapT = "clamp_to_edge";

    texture.dataFormat = "red_integer";
    if (chunk.data instanceof Uint16Array) {
      texture.dataType = "unsigned_short";
    }

    texture.unpackRowLength = chunk.rowStride;
    texture.unpackAlignment = chunk.rowAlignmentBytes;

    if (!this.mesh_) {
      this.mesh_ = new Mesh(plane, texture);
      this.addObject(this.mesh_);
    } else {
      console.log("UPDATING TEXTURE");
      this.mesh_.textures.pop();
      this.mesh_.textures.push(texture);
    }

    this.setState("ready");
  }

  public onCameraFrameChange() {
    this.update(true);
  }
}
