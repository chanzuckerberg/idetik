import { Layer, LayerOptions, UpdateProps } from "../core/layer";
import { Chunk, ChunkSource, SliceCoordinates } from "../data/chunk";
import { ChannelProps } from "../objects/textures/channel";
import { ImageRenderable } from "../objects/renderable/image_renderable";
import { Texture2DArray } from "../objects/textures/texture_2d_array";
import { PlaneGeometry } from "../objects/geometry/plane_geometry";
import { Logger } from "../utilities/logger";
import { Color } from "../core/color";
import { EventContext } from "../core/event_dispatcher";
import { vec2, vec3 } from "gl-matrix";
import { handlePointPickingEvent, PointPickingResult } from "./point_picking";
import { almostEqual } from "../utilities/almost_equal";
import { clamp } from "../utilities/clamp";
import { ChunkSourceView } from "../data/chunk_source_view";
import { OrthographicCamera } from "@/objects/cameras/orthographic_camera";
import { SourceManager } from "@/core/source_manager";
import { CachedChunkLoader } from "@/data/cached_chunk_loader";

export type ChunkedImageLayerProps = LayerOptions & {
  source: ChunkSource;
  sliceCoords: SliceCoordinates;
  channelProps?: ChannelProps;
  onPickValue?: (info: PointPickingResult) => void;
};

export class ChunkedImageLayer extends Layer {
  public readonly type = "ChunkedImageLayer";

  private readonly source_: ChunkSource;
  private readonly sliceCoords_: SliceCoordinates;
  private readonly onPickValue_?: (info: PointPickingResult) => void;
  private readonly visibleChunks_: Map<Chunk, ImageRenderable> = new Map();
  private channelProps_?: ChannelProps;
  private chunkSourceView_?: ChunkSourceView;
  private pointerDownPos_: vec2 | null = null;
  private zPrevPointWorld_?: number;
  private debugMode_ = false;

  private readonly wireframeColors_ = [
    new Color(0.6, 0.3, 0.3),
    new Color(0.3, 0.6, 0.4),
    new Color(0.4, 0.4, 0.7),
    new Color(0.6, 0.5, 0.3),
  ];

  constructor({
    source,
    sliceCoords,
    channelProps,
    onPickValue,
    ...layerOptions
  }: ChunkedImageLayerProps) {
    super(layerOptions);
    this.setState("initialized");
    this.source_ = source;
    this.sliceCoords_ = sliceCoords;
    this.channelProps_ = channelProps;
    this.onPickValue_ = onPickValue;
  }

  public update(props: UpdateProps) {
    switch (this.state) {
      case "initialized":
        this.open(props.sourceManager);
        break;
      case "loading":
        this.makeView(props.sourceManager.getLoader(this.source_));
        break;
      case "ready":
        this.updateChunks(props);
        this.resliceIfZChanged();
        break;
      default: {
        const exhaustiveCheck: never = this.state;
        throw new Error(`Unhandled LayerState case: ${exhaustiveCheck}`);
      }
    }
  }

  private async open(sourceManager: SourceManager) {
    this.setState("loading");
    const loader = sourceManager.getLoader(this.source_);
    if (loader === null) return;
    if (loader === undefined) {
      const newLoader = await sourceManager.openLoader(this.source_);
      this.makeView(newLoader);
    }
  }

  private makeView(loader: CachedChunkLoader | null | undefined) {
    if (loader === undefined)
      throw new Error("Open loader before making a view.");
    if (loader === null) return;
    this.chunkSourceView_ = new ChunkSourceView(loader);
    this.setState("ready");
  }

  private updateChunks(props?: UpdateProps) {
    if (!this.chunkSourceView_) {
      throw new Error("Updating chunks without a view.");
    }

    if (!props) {
      throw new Error("Updating chunks without update props");
    }

    if (props.camera.type !== "OrthographicCamera") {
      throw new Error("Updating chunks with non-orthographic camera");
    }

    this.chunkSourceView_.update(
      props.camera as OrthographicCamera,
      props.bufferWidth,
      this.sliceCoords_
    );

    // TODO:(shlomnissan) Reuse images instead of deleting and creating new ones.
    //
    // This loop removes image renderables for chunks that are no longer visible
    // or no longer returned by getChunks() (e.g., due to LOD changes).
    // While this approach works for now, it may be more efficient in the future
    // to reuse renderables by updating their underlying data instead of repeatedly
    // creating new texture objects. Note: GPU resources are not currently being
    // released, so this will also need to be addressed soon.
    const currentChunks = new Set(this.chunkSourceView_.getChunks());
    this.visibleChunks_.forEach((_image, chunk) => {
      if (!currentChunks.has(chunk)) {
        this.visibleChunks_.delete(chunk); // safe
      }
    });

    // Add all objects anew so that they respect the chunk order, which may
    // capture details important for rendering, such as LOD, instead of the
    // creation order, which is dependent on when the chunks finished loading.
    this.clearObjects();
    currentChunks.forEach((chunk) => {
      let image = this.visibleChunks_.get(chunk);
      if (!image && chunk.state === "loaded") {
        image = this.createImage(chunk);
        this.visibleChunks_.set(chunk, image);
      }
      if (image) this.addObject(image);
    });
  }

  private resliceIfZChanged() {
    const zPointWorld = this.sliceCoords_.z;
    if (zPointWorld === undefined || this.zPrevPointWorld_ === zPointWorld) {
      return;
    }

    for (const [chunk, image] of this.visibleChunks_) {
      if (chunk.state !== "loaded" || !chunk.data) continue;
      const data = this.slicePlane(chunk, zPointWorld);
      if (data) {
        image.textures[0].data = data;
      }
    }

    this.zPrevPointWorld_ = zPointWorld;
  }

  public onEvent(event: EventContext) {
    this.pointerDownPos_ = handlePointPickingEvent(
      event,
      this.pointerDownPos_,
      (world) => this.getValueAtWorld(world),
      this.onPickValue_
    );
  }

  public get chunkSourceView(): ChunkSourceView | undefined {
    return this.chunkSourceView_;
  }

  private slicePlane(chunk: Chunk, zValue: number) {
    if (!chunk.data) return;
    const zLocal = (zValue - chunk.offset.z) / chunk.scale.z;
    const zIdx = Math.round(zLocal);
    const zClamped = clamp(zIdx, 0, chunk.shape.z - 1);

    // Treat values within ~1 voxel (plus tiny floating-point error) as OK.
    // Anything further away means the requested zValue is outside.
    if (!almostEqual(zLocal, zClamped, 1 + 1e-6)) {
      Logger.error("ImageLayer", "slicePlane zValue outside extent");
    }

    const sliceSize = chunk.shape.x * chunk.shape.y;
    const offset = sliceSize * zClamped;
    return chunk.data.slice(offset, offset + sliceSize);
  }

  private createImage(chunk: Chunk) {
    const geometry = new PlaneGeometry(chunk.shape.x, chunk.shape.y, 1, 1);

    let data = chunk.data;
    if (this.sliceCoords_.z !== undefined) {
      data = this.slicePlane(chunk, this.sliceCoords_.z);
    }

    const image = new ImageRenderable(
      geometry,
      Texture2DArray.createWithChunk(chunk, data),
      this.channelProps_ ? [this.channelProps_] : [{}]
    );

    if (this.debugMode_) {
      image.wireframeEnabled = true;
      image.wireframeColor =
        this.wireframeColors_[chunk.lod % this.wireframeColors_.length];
    }

    image.transform.setScale([chunk.scale.x, chunk.scale.y, 1]);
    image.transform.setTranslation([chunk.offset.x, chunk.offset.y, 0]);
    return image;
  }

  public getValueAtWorld(world: vec3): number | null {
    const currentLOD = this.chunkSourceView_?.currentLOD ?? 0;

    // First, try to find the value in current LOD chunks (highest priority)
    for (const [chunk, image] of this.visibleChunks_) {
      if (chunk.lod !== currentLOD) continue;
      const value = this.getValueFromChunk(chunk, image, world);
      if (value !== null) return value;
    }

    // Fallback to low-res chunks if no current LOD chunk contains the position
    for (const [chunk, image] of this.visibleChunks_) {
      if (chunk.lod === currentLOD) continue;
      const value = this.getValueFromChunk(chunk, image, world);
      if (value !== null) return value;
    }

    return null;
  }

  private getValueFromChunk(
    chunk: Chunk,
    image: ImageRenderable,
    world: vec3
  ): number | null {
    if (!chunk.data) return null;

    const localPos = vec3.transformMat4(
      vec3.create(),
      world,
      image.transform.inverse
    );

    const x = Math.floor(localPos[0]);
    const y = Math.floor(localPos[1]);

    // Check if this chunk contains the requested position
    if (x >= 0 && x < chunk.shape.x && y >= 0 && y < chunk.shape.y) {
      const data =
        this.sliceCoords_.z !== undefined
          ? this.slicePlane(chunk, this.sliceCoords_.z)!
          : chunk.data;
      const pixelIndex = y * chunk.rowStride + x;

      // For multi-channel images, take the first channel value
      return data[pixelIndex];
    }

    return null;
  }

  public set debugMode(debug: boolean) {
    this.debugMode_ = debug;
    this.visibleChunks_.forEach((image, chunk) => {
      image.wireframeEnabled = this.debugMode_;
      if (this.debugMode_) {
        image.wireframeColor =
          this.wireframeColors_[chunk.lod % this.wireframeColors_.length];
      }
    });
  }
}
