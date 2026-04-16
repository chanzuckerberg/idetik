import { Layer, LayerOptions, RenderContext } from "../core/layer";
import type { IdetikContext } from "../idetik";
import { Chunk, ChunkSource, SliceCoordinates } from "../data/chunk";
import { ChunkStoreView, INTERNAL_POLICY_KEY } from "../core/chunk_store_view";
import { ImageSourcePolicy } from "../core/image_source_policy";
import { LabelImageRenderable } from "../objects/renderable/label_image_renderable";
import {
  LabelColorMap,
  LabelColorMapProps,
} from "../objects/renderable/label_color_map";
import { Texture2D } from "../objects/textures/texture_2d";
import { Logger } from "../utilities/logger";
import { EventContext } from "../core/event_dispatcher";
import { vec2, vec3 } from "gl-matrix";
import { handlePointPickingEvent, PointPickingResult } from "./point_picking";
import { almostEqual } from "../utilities/almost_equal";
import { clamp } from "../utilities/clamp";
import { RenderablePool } from "../utilities/renderable_pool";
import { poolKeyForImageRenderable } from "./image_layer";

export type LabelLayerProps = LayerOptions & {
  source: ChunkSource;
  sliceCoords: SliceCoordinates;
  policy: ImageSourcePolicy;
  colorMap?: LabelColorMapProps;
  onPickValue?: (info: PointPickingResult) => void;
  outlineSelected?: boolean;
};

export class LabelLayer extends Layer {
  public readonly type = "LabelLayer";

  private readonly source_: ChunkSource;
  private readonly sliceCoords_: SliceCoordinates;
  private readonly onPickValue_?: (info: PointPickingResult) => void;
  private readonly outlineSelected_: boolean;
  private readonly visibleChunks_: Map<Chunk, LabelImageRenderable> = new Map();
  private readonly pool_ = new RenderablePool<LabelImageRenderable>();
  private colorMap_: LabelColorMap;
  private selectedValue_: number | null = null;
  private policy_: ImageSourcePolicy;
  private chunkStoreView_?: ChunkStoreView;
  private pointerDownPos_: vec2 | null = null;
  private zPrevPointWorld_?: number;

  private static readonly STALE_PRESENTATION_MS_ = 1000;
  private lastPresentationTimeStamp_?: DOMHighResTimeStamp;
  private lastPresentationTimeCoord_?: number;

  constructor({
    source,
    sliceCoords,
    policy,
    colorMap = {},
    onPickValue,
    outlineSelected = false,
    ...layerOptions
  }: LabelLayerProps) {
    super(layerOptions);
    this.setState("initialized");
    this.source_ = source;
    this.policy_ = policy;
    this.sliceCoords_ = sliceCoords;
    this.colorMap_ = new LabelColorMap(colorMap);
    this.onPickValue_ = onPickValue;
    this.outlineSelected_ = outlineSelected;
  }

  public async onAttached(context: IdetikContext) {
    if (this.chunkStoreView_) {
      throw new Error(
        "LabelLayer cannot be attached to multiple contexts simultaneously."
      );
    }
    this.chunkStoreView_ = await context.chunkManager.addView(
      this.source_,
      this.policy_
    );

    if (this.chunkStoreView_.channelCount > 1) {
      throw new Error(
        `LabelLayer does not support multi-channel sources ` +
          `(found ${this.chunkStoreView_.channelCount} channels). ` +
          `Label data must be single-channel.`
      );
    }
  }

  public onDetached(_context: IdetikContext): void {
    if (!this.chunkStoreView_) return;
    this.releaseAndRemoveChunks(this.visibleChunks_.keys());
    this.clearObjects();
    this.chunkStoreView_.dispose();
    this.chunkStoreView_ = undefined;
  }

  public update(context?: RenderContext) {
    if (!context || !this.chunkStoreView_) return;

    this.chunkStoreView_.updateChunksForImage(
      this.sliceCoords_,
      context.viewport
    );

    this.updateChunks();
    this.resliceIfZChanged();
  }

  private updateChunks() {
    if (!this.chunkStoreView_) return;
    if (this.state !== "ready") this.setState("ready");

    if (
      this.visibleChunks_.size > 0 &&
      !this.chunkStoreView_.allVisibleFallbackLODLoaded(this.sliceCoords_) &&
      !this.isPresentationStale()
    ) {
      return;
    }
    this.lastPresentationTimeStamp_ = performance.now();
    this.lastPresentationTimeCoord_ = this.sliceCoords_.t;

    const orderedByLOD = this.chunkStoreView_.getChunksToRender(
      this.sliceCoords_
    );
    const current = new Set(orderedByLOD);
    const nonVisibleChunks = Array.from(this.visibleChunks_.keys()).filter(
      (chunk) => !current.has(chunk)
    );
    this.releaseAndRemoveChunks(nonVisibleChunks);

    this.clearObjects();
    for (const chunk of orderedByLOD) {
      if (chunk.state !== "loaded") continue;
      const label = this.getLabelForChunk(chunk);
      this.visibleChunks_.set(chunk, label);
      this.addObject(label);
    }
  }

  private isPresentationStale(): boolean {
    if (this.lastPresentationTimeStamp_ === undefined) return false;
    return (
      performance.now() - this.lastPresentationTimeStamp_ >
      LabelLayer.STALE_PRESENTATION_MS_
    );
  }

  private resliceIfZChanged() {
    const zPointWorld = this.sliceCoords_.z;
    if (zPointWorld === undefined || this.zPrevPointWorld_ === zPointWorld) {
      return;
    }

    for (const [chunk, label] of this.visibleChunks_) {
      if (chunk.state !== "loaded" || !chunk.data) continue;
      const data = this.slicePlane(chunk, zPointWorld);
      if (data) {
        const texture = label.textures[0] as Texture2D;
        texture.updateWithChunk(chunk, data);
      }
    }

    this.zPrevPointWorld_ = zPointWorld;
  }

  public onEvent(event: EventContext) {
    this.pointerDownPos_ = handlePointPickingEvent(
      event,
      this.pointerDownPos_,
      (world) => this.getValueAtWorld(world),
      this.outlineSelected_
        ? (info: PointPickingResult) => {
            this.setSelectedValue(info.value);
            this.onPickValue_?.(info);
          }
        : this.onPickValue_
    );
  }

  public get colorMap(): LabelColorMap {
    return this.colorMap_;
  }

  public setColorMap(colorMap: LabelColorMapProps) {
    this.colorMap_ = new LabelColorMap(colorMap);
    this.visibleChunks_.forEach((label) => {
      label.setColorMap(this.colorMap_);
    });
  }

  public setSelectedValue(value: number | null) {
    this.selectedValue_ = value;
    this.visibleChunks_.forEach((label) => {
      label.setSelectedValue(this.selectedValue_);
    });
  }

  public get sliceCoords(): SliceCoordinates {
    return this.sliceCoords_;
  }

  public get source(): ChunkSource {
    return this.source_;
  }

  public get imageSourcePolicy(): Readonly<ImageSourcePolicy> {
    return this.policy_;
  }

  public set imageSourcePolicy(newPolicy: ImageSourcePolicy) {
    if (this.policy_ !== newPolicy) {
      this.policy_ = newPolicy;
      if (this.chunkStoreView_) {
        this.chunkStoreView_.setImageSourcePolicy(
          newPolicy,
          INTERNAL_POLICY_KEY
        );
      }
    }
  }

  // exposed for use in chunk info overlay
  public get chunkStoreView(): ChunkStoreView | undefined {
    return this.chunkStoreView_;
  }

  public get lastPresentationTimeCoord(): number | undefined {
    return this.lastPresentationTimeCoord_;
  }

  public getValueAtWorld(world: vec3): number | null {
    const currentLOD = this.chunkStoreView_?.currentLOD ?? 0;

    // First, try to find the value in current LOD chunks (highest priority)
    for (const [chunk, label] of this.visibleChunks_) {
      if (chunk.lod !== currentLOD) continue;
      const value = this.getValueFromChunk(chunk, label, world);
      if (value !== null) return value;
    }

    // Fallback to low-res chunks if no current LOD chunk contains the position
    for (const [chunk, label] of this.visibleChunks_) {
      if (chunk.lod === currentLOD) continue;
      const value = this.getValueFromChunk(chunk, label, world);
      if (value !== null) return value;
    }

    return null;
  }

  private getValueFromChunk(
    chunk: Chunk,
    label: LabelImageRenderable,
    world: vec3
  ): number | null {
    if (!chunk.data) return null;

    const localPos = vec3.transformMat4(
      vec3.create(),
      world,
      label.transform.inverse
    );

    const x = Math.floor(localPos[0]);
    const y = Math.floor(localPos[1]);

    if (x >= 0 && x < chunk.shape.x && y >= 0 && y < chunk.shape.y) {
      const data =
        this.sliceCoords_.z !== undefined
          ? this.slicePlane(chunk, this.sliceCoords_.z)!
          : chunk.data;
      const pixelIndex = y * chunk.shape.x + x;
      return data[pixelIndex];
    }

    return null;
  }

  private slicePlane(chunk: Chunk, zValue: number) {
    if (!chunk.data) return;
    const zLocal = (zValue - chunk.offset.z) / chunk.scale.z;
    const zIdx = Math.round(zLocal);
    const zClamped = clamp(zIdx, 0, chunk.shape.z - 1);

    if (!almostEqual(zLocal, zClamped, 1 + 1e-6)) {
      Logger.error("LabelLayer", "slicePlane zValue outside extent");
    }

    const sliceSize = chunk.shape.x * chunk.shape.y;
    const offset = sliceSize * zClamped;
    return chunk.data.slice(offset, offset + sliceSize);
  }

  private getLabelForChunk(chunk: Chunk) {
    const existing = this.visibleChunks_.get(chunk);
    if (existing) return existing;

    const pooled = this.pool_.acquire(poolKeyForImageRenderable(chunk));
    if (pooled) {
      const texture = pooled.textures[0] as Texture2D;
      texture.updateWithChunk(chunk, this.getDataForLabel(chunk));
      this.updateLabelChunk(pooled, chunk);
      pooled.setColorMap(this.colorMap_);
      pooled.setSelectedValue(this.selectedValue_);
      return pooled;
    }

    return this.createLabel(chunk);
  }

  private createLabel(chunk: Chunk) {
    const label = new LabelImageRenderable({
      width: chunk.shape.x,
      height: chunk.shape.y,
      imageData: Texture2D.createWithChunk(chunk, this.getDataForLabel(chunk)),
      colorMap: this.colorMap_,
      outlineSelected: this.outlineSelected_,
      selectedValue: this.selectedValue_,
    });
    this.updateLabelChunk(label, chunk);
    return label;
  }

  private getDataForLabel(chunk: Chunk) {
    const data =
      this.sliceCoords_?.z !== undefined
        ? this.slicePlane(chunk, this.sliceCoords_.z)
        : chunk.data;
    if (!data) {
      Logger.warn("LabelLayer", "No data for label");
      return;
    }
    return data;
  }

  private updateLabelChunk(label: LabelImageRenderable, chunk: Chunk) {
    label.transform.setScale([chunk.scale.x, chunk.scale.y, 1]);
    label.transform.setTranslation([chunk.offset.x, chunk.offset.y, 0]);
  }

  private releaseAndRemoveChunks(chunks: Iterable<Chunk>): void {
    for (const chunk of chunks) {
      const label = this.visibleChunks_.get(chunk);
      if (label) {
        this.pool_.release(poolKeyForImageRenderable(chunk), label);
        this.visibleChunks_.delete(chunk);
      }
    }
  }
}
