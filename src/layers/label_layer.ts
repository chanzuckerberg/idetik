import { Layer, LayerOptions } from "../core/layer";
import { Viewport } from "../core/viewport";
import { OrthographicCamera } from "../objects/cameras/orthographic_camera";
import type { IdetikContext } from "../idetik";
import {
  Chunk,
  ChunkSource,
  SliceAxes,
  SliceCoordinates,
  worldToTexCoordForChunk,
} from "../data/chunk";
import { ChunkStoreView, INTERNAL_POLICY_KEY } from "../data/chunk_store_view";
import { ImageSourcePolicy } from "../core/image_source_policy";
import { LabelImageRenderable } from "../objects/renderable/label_image_renderable";
import {
  LabelColorMap,
  LabelColorMapProps,
} from "../objects/renderable/label_color_map";
import { Texture } from "../objects/textures/texture";
import { EventContext } from "../core/event_dispatcher";
import { vec2, vec3 } from "gl-matrix";
import { handlePointPickingEvent, PointPickingResult } from "./point_picking";
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

/** @group Layers */
export class LabelLayer extends Layer {
  public readonly type = "LabelLayer";

  private readonly source_: ChunkSource;
  private readonly sliceCoords_: SliceCoordinates;
  private readonly axes_: SliceAxes = { u: "x", v: "y", w: "z" };
  private readonly onPickValue_?: (info: PointPickingResult) => void;
  private readonly outlineSelected_: boolean;
  private readonly visibleChunks_: Map<Chunk, LabelImageRenderable> = new Map();
  private readonly pool_ = new RenderablePool<LabelImageRenderable>();
  private colorMap_: LabelColorMap;
  private selectedValue_: number | null = null;
  private policy_: ImageSourcePolicy;
  private chunkStoreView_?: ChunkStoreView;
  private pointerDownPos_: vec2 | null = null;

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

  protected attach(context: IdetikContext) {
    this.chunkStoreView_ = context.chunkManager.addView(
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

  protected detach(_context: IdetikContext) {
    this.releaseAndRemoveChunks(this.visibleChunks_.keys());
    this.clearObjects();
    this.chunkStoreView_?.dispose();
    this.chunkStoreView_ = undefined;
  }

  public update(viewport?: Viewport) {
    if (!viewport || !this.chunkStoreView_) return;

    const camera = viewport.camera;
    if (camera.type !== "OrthographicCamera") {
      throw new Error(
        "Label rendering currently supports only orthographic cameras. " +
          "Update the implementation before using a perspective camera."
      );
    }

    this.chunkStoreView_.updateChunksForImage(this.sliceCoords_, {
      worldViewRect: (camera as OrthographicCamera).getWorldViewRect(),
      bufferWidthPx: viewport.getBufferRect().width,
    });

    this.updateChunks();

    for (const [chunk, labelRenderable] of this.visibleChunks_) {
      this.updateSlicePosition(labelRenderable, chunk);
    }
  }

  private updateChunks() {
    if (!this.chunkStoreView_) return;
    if (this.state !== "ready") this.setState("ready");

    const visibleChunksResident = Array.from(this.visibleChunks_.keys()).every(
      (chunk) => chunk.texture !== undefined
    );

    if (
      this.visibleChunks_.size > 0 &&
      visibleChunksResident &&
      !this.chunkStoreView_.allVisibleFallbackLODLoaded() &&
      !this.isPresentationStale()
    ) {
      return;
    }
    this.lastPresentationTimeStamp_ = performance.now();
    this.lastPresentationTimeCoord_ = this.sliceCoords_.t;

    const orderedByLOD = this.chunkStoreView_.getChunksToRender();
    const current = new Set(orderedByLOD);
    const nonVisibleChunks = Array.from(this.visibleChunks_.keys()).filter(
      (chunk) => !current.has(chunk)
    );
    this.releaseAndRemoveChunks(nonVisibleChunks);

    this.clearObjects();
    for (const chunk of orderedByLOD) {
      const label = this.getLabelForChunk(chunk, chunk.texture!);
      this.visibleChunks_.set(chunk, label);
      this.addObject(label);
    }
  }

  public hasMultipleLODs(): boolean {
    if (!this.chunkStoreView_) return false;
    return this.chunkStoreView_.lodCount > 1;
  }

  private isPresentationStale(): boolean {
    if (this.lastPresentationTimeStamp_ === undefined) return false;
    return (
      performance.now() - this.lastPresentationTimeStamp_ >
      LabelLayer.STALE_PRESENTATION_MS_
    );
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

  public async getValueAtWorld(world: vec3): Promise<number | null> {
    const currentLOD = this.chunkStoreView_?.currentLOD ?? 0;

    for (const preferCurrentLOD of [true, false]) {
      for (const [chunk, label] of this.visibleChunks_) {
        if ((chunk.lod === currentLOD) !== preferCurrentLOD) continue;
        const value = await this.readValueFromChunk(chunk, label, world);
        if (value !== null) return value;
      }
    }
    return null;
  }

  private async readValueFromChunk(
    chunk: Chunk,
    label: LabelImageRenderable,
    world: vec3
  ): Promise<number | null> {
    const localPos = vec3.transformMat4(
      vec3.create(),
      world,
      label.transform.inverse
    );

    const { u, v, w } = this.axes_;
    const uIdx = Math.floor(localPos[0]);
    const vIdx = Math.floor(localPos[1]);

    if (
      uIdx < 0 ||
      uIdx >= chunk.shape[u] ||
      vIdx < 0 ||
      vIdx >= chunk.shape[v]
    ) {
      return null;
    }

    const texel = { x: 0, y: 0, z: 0 };
    texel[u] = uIdx;
    texel[v] = vIdx;
    texel[w] = this.sliceIndexForChunk(chunk);
    return (
      (await label.textures[0].readTexel?.(texel.x, texel.y, texel.z)) ?? null
    );
  }

  private getLabelForChunk(chunk: Chunk, texture: Texture) {
    const existing = this.visibleChunks_.get(chunk);
    if (existing) return existing;

    const pooled = this.pool_.acquire(poolKeyForImageRenderable(chunk));
    if (pooled) {
      pooled.setTexture(0, texture);
      pooled.setColorMap(this.colorMap_);
      pooled.setSelectedValue(this.selectedValue_);
      this.updateLabelChunk(pooled, chunk);

      return pooled;
    }

    return this.createLabel(chunk, texture);
  }

  private createLabel(chunk: Chunk, texture: Texture) {
    const label = new LabelImageRenderable({
      width: chunk.shape[this.axes_.u],
      height: chunk.shape[this.axes_.v],
      imageData: texture,
      colorMap: this.colorMap_,
      outlineSelected: this.outlineSelected_,
      selectedValue: this.selectedValue_,
    });
    this.updateLabelChunk(label, chunk);
    return label;
  }

  private updateSlicePosition(label: LabelImageRenderable, chunk: Chunk) {
    const { u, v, w } = this.axes_;
    label.transform.setTranslation([
      chunk.offset[u],
      chunk.offset[v],
      this.sliceCoords_[w] ?? chunk.offset[w],
    ]);
  }

  private sliceIndexForChunk(chunk: Chunk): number {
    const w = this.axes_.w;
    const sliceValue = this.sliceCoords_[w];
    if (sliceValue === undefined) {
      return 0;
    }

    const local = (sliceValue - chunk.offset[w]) / chunk.scale[w];
    return clamp(Math.round(local), 0, chunk.shape[w] - 1);
  }

  private updateLabelChunk(label: LabelImageRenderable, chunk: Chunk) {
    const { u, v } = this.axes_;
    label.transform.setScale([chunk.scale[u], chunk.scale[v], 1]);
    this.updateSlicePosition(label, chunk);
    label.worldToTexCoord = worldToTexCoordForChunk(chunk, this.axes_);
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
