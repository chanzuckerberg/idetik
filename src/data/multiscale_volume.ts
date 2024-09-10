export class MultiscaleVolume {

  constructor() {
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
