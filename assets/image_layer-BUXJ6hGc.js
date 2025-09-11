import { L as Layer, t as transformMat4, d as create } from "./metadata_loaders-CXLkXwNR.js";
import { P as PlaneGeometry, I as ImageRenderable, T as Texture2DArray } from "./image_source-BemCU8_Z.js";
import { h as handlePointPickingEvent } from "./point_picking-DP3wpFCw.js";
class ImageLayer extends Layer {
  type = "ImageLayer";
  source_;
  region_;
  lod_;
  onPickValue_;
  initialChannelProps_;
  channelChangeCallbacks_ = [];
  channelProps_;
  image_;
  chunk_;
  extent_;
  pointerDownPos_ = null;
  constructor({
    source,
    region,
    channelProps,
    onPickValue,
    lod,
    ...layerOptions
  }) {
    super(layerOptions);
    this.setState("initialized");
    this.source_ = source;
    this.region_ = region;
    this.channelProps_ = channelProps;
    this.initialChannelProps_ = channelProps;
    this.onPickValue_ = onPickValue;
    this.lod_ = lod;
  }
  update() {
    switch (this.state) {
      case "initialized":
        this.load(this.region_);
        break;
      case "loading":
      case "ready":
        break;
      default: {
        const exhaustiveCheck = this.state;
        throw new Error(`Unhandled LayerState case: ${exhaustiveCheck}`);
      }
    }
  }
  onEvent(event) {
    this.pointerDownPos_ = handlePointPickingEvent(
      event,
      this.pointerDownPos_,
      (world) => this.getValueAtWorld(world),
      this.onPickValue_
    );
  }
  get channelProps() {
    return this.channelProps_;
  }
  setChannelProps(channelProps) {
    this.channelProps_ = channelProps;
    this.image_?.setChannelProps(channelProps);
    this.channelChangeCallbacks_.forEach((callback) => {
      callback();
    });
  }
  resetChannelProps() {
    if (this.initialChannelProps_ !== void 0) {
      this.setChannelProps(this.initialChannelProps_);
    }
  }
  addChannelChangeCallback(callback) {
    this.channelChangeCallbacks_.push(callback);
  }
  removeChannelChangeCallback(callback) {
    const index = this.channelChangeCallbacks_.indexOf(callback);
    if (index === void 0) {
      throw new Error(`Callback to remove could not be found: ${callback}`);
    }
    this.channelChangeCallbacks_.splice(index, 1);
  }
  async load(region) {
    if (this.state !== "initialized") {
      throw new Error(`Trying to load chunks more than once.`);
    }
    this.setState("loading");
    const loader = await this.source_.open();
    const attributes = loader.getAttributes();
    const lod = this.lod_ ?? attributes.length - 1;
    const chunk = await loader.loadRegion(region, lod);
    this.extent_ = {
      x: chunk.shape.x * chunk.scale.x,
      y: chunk.shape.y * chunk.scale.y
    };
    this.image_ = this.createImage(chunk);
    this.chunk_ = chunk;
    this.addObject(this.image_);
    this.setState("ready");
  }
  // TODO: we probably want something like this, but it should be unified across layers
  // see TracksLayer for another example
  get extent() {
    return this.extent_;
  }
  createImage(chunk) {
    const geometry = new PlaneGeometry(chunk.shape.x, chunk.shape.y, 1, 1);
    const image = new ImageRenderable(
      geometry,
      Texture2DArray.createWithChunk(chunk),
      this.channelProps
    );
    image.transform.setScale([chunk.scale.x, chunk.scale.y, 1]);
    image.transform.setTranslation([chunk.offset.x, chunk.offset.y, 0]);
    return image;
  }
  getValueAtWorld(world) {
    if (!this.image_) return null;
    if (!this.chunk_?.data) return null;
    const localPos = transformMat4(
      create(),
      world,
      this.image_.transform.inverse
    );
    const x = Math.floor(localPos[0]);
    const y = Math.floor(localPos[1]);
    if (x >= 0 && x < this.chunk_.shape.x && y >= 0 && y < this.chunk_.shape.y) {
      const pixelIndex = y * this.chunk_.rowStride + x;
      return this.chunk_.data[pixelIndex];
    }
    return null;
  }
}
export {
  ImageLayer as I
};
//# sourceMappingURL=image_layer-BUXJ6hGc.js.map
