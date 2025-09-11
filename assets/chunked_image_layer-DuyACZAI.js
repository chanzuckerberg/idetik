import { e as Logger, L as Layer, C as Color, f as clamp, g as almostEqual, t as transformMat4, d as create } from "./metadata_loaders-CXLkXwNR.js";
import { P as PlaneGeometry, I as ImageRenderable, T as Texture2DArray } from "./image_source-BemCU8_Z.js";
import { h as handlePointPickingEvent } from "./point_picking-DP3wpFCw.js";
class RenderablePool {
  bins_ = /* @__PURE__ */ new Map();
  acquire(key) {
    const bin = this.bins_.get(key);
    const item = bin?.pop();
    if (item) {
      Logger.debug("RenderablePool", "Renderable object acquired");
    }
    return item;
  }
  release(key, item) {
    let bin = this.bins_.get(key);
    if (!bin) {
      bin = [];
      this.bins_.set(key, bin);
    }
    bin.push(item);
    Logger.debug("RenderablePool", "Renderable object released");
  }
  clearAll(disposer) {
    if (disposer) for (const bin of this.bins_.values()) bin.forEach(disposer);
    this.bins_.clear();
  }
}
class ChunkedImageLayer extends Layer {
  type = "ChunkedImageLayer";
  source_;
  sliceCoords_;
  onPickValue_;
  visibleChunks_ = /* @__PURE__ */ new Map();
  channelProps_;
  pool_ = new RenderablePool();
  chunkManagerSource_;
  pointerDownPos_ = null;
  zPrevPointWorld_;
  debugMode_ = false;
  wireframeColors_ = [
    new Color(0.6, 0.3, 0.3),
    new Color(0.3, 0.6, 0.4),
    new Color(0.4, 0.4, 0.7),
    new Color(0.6, 0.5, 0.3)
  ];
  constructor({
    source,
    sliceCoords,
    channelProps,
    onPickValue,
    ...layerOptions
  }) {
    super(layerOptions);
    this.setState("initialized");
    this.source_ = source;
    this.sliceCoords_ = sliceCoords;
    this.channelProps_ = channelProps;
    this.onPickValue_ = onPickValue;
  }
  async onAttached(context) {
    this.chunkManagerSource_ = await context.chunkManager.addSource(
      this.source_,
      this.sliceCoords_
    );
  }
  update() {
    this.updateChunks();
    this.resliceIfZChanged();
  }
  updateChunks() {
    if (!this.chunkManagerSource_) return;
    if (this.state !== "ready") this.setState("ready");
    const orderedByLOD = this.chunkManagerSource_.getChunks();
    const current = new Set(orderedByLOD);
    this.visibleChunks_.forEach((image, chunk) => {
      if (!current.has(chunk)) {
        this.visibleChunks_.delete(chunk);
        this.pool_.release(poolKeyForImageRenderable(chunk), image);
      }
    });
    this.clearObjects();
    for (const chunk of orderedByLOD) {
      if (chunk.state !== "loaded") continue;
      const image = this.getImageForChunk(chunk);
      this.visibleChunks_.set(chunk, image);
      this.addObject(image);
    }
  }
  resliceIfZChanged() {
    const zPointWorld = this.sliceCoords_.z;
    if (zPointWorld === void 0 || this.zPrevPointWorld_ === zPointWorld) {
      return;
    }
    for (const [chunk, image] of this.visibleChunks_) {
      if (chunk.state !== "loaded" || !chunk.data) continue;
      const data = this.slicePlane(chunk, zPointWorld);
      if (data) {
        const texture = image.textures[0];
        texture.updateWithChunk(chunk, data);
      }
    }
    this.zPrevPointWorld_ = zPointWorld;
  }
  onEvent(event) {
    this.pointerDownPos_ = handlePointPickingEvent(
      event,
      this.pointerDownPos_,
      (world) => this.getValueAtWorld(world),
      this.onPickValue_
    );
  }
  get chunkManagerSource() {
    return this.chunkManagerSource_;
  }
  slicePlane(chunk, zValue) {
    if (!chunk.data) return;
    const zLocal = (zValue - chunk.offset.z) / chunk.scale.z;
    const zIdx = Math.round(zLocal);
    const zClamped = clamp(zIdx, 0, chunk.shape.z - 1);
    if (!almostEqual(zLocal, zClamped, 1 + 1e-6)) {
      Logger.error("ImageLayer", "slicePlane zValue outside extent");
    }
    const sliceSize = chunk.shape.x * chunk.shape.y;
    const offset = sliceSize * zClamped;
    return chunk.data.slice(offset, offset + sliceSize);
  }
  getImageForChunk(chunk) {
    const existing = this.visibleChunks_.get(chunk);
    if (existing) return existing;
    const pooled = this.pool_.acquire(poolKeyForImageRenderable(chunk));
    if (pooled) {
      const texture = pooled.textures[0];
      texture.updateWithChunk(chunk, this.getDataForImage(chunk));
      this.updateImageChunk(pooled, chunk);
      return pooled;
    }
    return this.createImage(chunk);
  }
  createImage(chunk) {
    const geometry = new PlaneGeometry(chunk.shape.x, chunk.shape.y, 1, 1);
    const image = new ImageRenderable(
      geometry,
      Texture2DArray.createWithChunk(chunk, this.getDataForImage(chunk)),
      this.channelProps_ ? [this.channelProps_] : [{}]
    );
    this.updateImageChunk(image, chunk);
    return image;
  }
  getDataForImage(chunk) {
    const data = this.sliceCoords_?.z !== void 0 ? this.slicePlane(chunk, this.sliceCoords_.z) : chunk.data;
    if (!data) {
      Logger.warn("ChunkedImageLayer", "No data for image");
      return;
    }
    return data;
  }
  updateImageChunk(image, chunk) {
    if (this.debugMode_) {
      image.wireframeEnabled = true;
      image.wireframeColor = this.wireframeColors_[chunk.lod % this.wireframeColors_.length];
    } else {
      image.wireframeEnabled = false;
    }
    image.transform.setScale([chunk.scale.x, chunk.scale.y, 1]);
    image.transform.setTranslation([chunk.offset.x, chunk.offset.y, 0]);
  }
  getValueAtWorld(world) {
    const currentLOD = this.chunkManagerSource_?.currentLOD ?? 0;
    for (const [chunk, image] of this.visibleChunks_) {
      if (chunk.lod !== currentLOD) continue;
      const value = this.getValueFromChunk(chunk, image, world);
      if (value !== null) return value;
    }
    for (const [chunk, image] of this.visibleChunks_) {
      if (chunk.lod === currentLOD) continue;
      const value = this.getValueFromChunk(chunk, image, world);
      if (value !== null) return value;
    }
    return null;
  }
  getValueFromChunk(chunk, image, world) {
    if (!chunk.data) return null;
    const localPos = transformMat4(
      create(),
      world,
      image.transform.inverse
    );
    const x = Math.floor(localPos[0]);
    const y = Math.floor(localPos[1]);
    if (x >= 0 && x < chunk.shape.x && y >= 0 && y < chunk.shape.y) {
      const data = this.sliceCoords_.z !== void 0 ? this.slicePlane(chunk, this.sliceCoords_.z) : chunk.data;
      const pixelIndex = y * chunk.rowStride + x;
      return data[pixelIndex];
    }
    return null;
  }
  set debugMode(debug) {
    this.debugMode_ = debug;
    this.visibleChunks_.forEach((image, chunk) => {
      image.wireframeEnabled = this.debugMode_;
      if (this.debugMode_) {
        image.wireframeColor = this.wireframeColors_[chunk.lod % this.wireframeColors_.length];
      }
    });
  }
}
function poolKeyForImageRenderable(chunk) {
  return [
    `lod${chunk.lod}`,
    `shape${chunk.shape.x}x${chunk.shape.y}`,
    `stride${chunk.rowStride}`,
    `align${chunk.rowAlignmentBytes}`
  ].join(":");
}
export {
  ChunkedImageLayer as C
};
//# sourceMappingURL=chunked_image_layer-DuyACZAI.js.map
