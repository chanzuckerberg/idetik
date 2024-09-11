/*
  This class is temporary. Data source classes will likely be observable proxy
  objects that hold references to data. A mesh can be loaded from various file
  types. File loaders (such as zarr or obj) are responsible for loading the
  necessary data (possibly using a chunk manager) and returning a data source
  type. This data source is then used to initialize renderable objects (like
  Mesh or Volume). While renderable objects may request more data through the
  data source, a loader or chunk manager will be responsible for providing this
  data. As we're actively exploring this area, I anticipate more clarity in the
  coming weeks.
*/

class MeshSourceAttribute {
  private data_: Float32Array;

  public itemSize: number;

  constructor(data: number[], itemSize: number) {
    this.data_ = new Float32Array(data);
    this.itemSize = itemSize;
  }

  get sizeInBytes() {
    return this.length * this.itemSize * Float32Array.BYTES_PER_ELEMENT;
  }

  get data(): Readonly<Float32Array> {
    return this.data_;
  }

  get length() {
    return this.data_.length;
  }
}

type MeshSourceAttributeType = "vertices" | "normals" | "uvs";

export class MeshSource {
  private attributes_: Map<MeshSourceAttributeType, MeshSourceAttribute>;
  private index_: Uint16Array | null = null;

  constructor() {
    this.attributes_ = new Map<MeshSourceAttributeType, MeshSourceAttribute>();
  }

  public setAttribute(
    type: MeshSourceAttributeType,
    data: number[],
    itemSize: number
  ) {
    this.attributes_.set(type, new MeshSourceAttribute(data, itemSize));
  }

  public setIndex(data: number[]) {
    this.index_ = new Uint16Array(data);
  }

  public getAttribute(type: MeshSourceAttributeType) {
    if (!this.attributes_.has(type)) {
      throw new Error(`Attribute ${type} was not set`);
    }
    return this.attributes_.get(type)!;
  }

  public get itemsSize() {
    if (this.attributes_.size === 0) return 0;
    const attr = this.attributes_.entries().next().value[1];
    return attr.data.length / attr.itemSize;
  }

  public get sizeInBytes() {
    let bytes = 0;
    for (const [, value] of this.attributes_) {
      bytes += value.sizeInBytes;
    }
    return bytes;
  }

  public get attributes() {
    return this.attributes_;
  }

  public get index() {
    return this.index_;
  }
}
