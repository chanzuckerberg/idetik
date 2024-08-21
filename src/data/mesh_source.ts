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

  get data(): Readonly<Float32Array> {
    return this.data_;
  }
}

type MeshSourceAttributeType = "vertices" | "normals" | "uvs";

export class MeshSource {
  private attributes_: Map<MeshSourceAttributeType, MeshSourceAttribute>;
  private index_: Float32Array | null = null;

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

  public getAttribute(type: MeshSourceAttributeType) {
    if (!this.attributes_.has(type)) {
      throw Error(`Attribute ${type} was not set`);
    }
    return this.attributes_.get(type)!;
  }

  public setIndex(data: number[]) {
    this.index_ = new Float32Array(data);
  }

  public getIndex(): Readonly<Float32Array> | null {
    return this.index_;
  }
}
