import { Layer } from "core/layer";
import { Mesh } from "objects/renderable/mesh";
import { PlaneGeometry } from "objects/geometry/plane_geometry";
import { Region } from "data/region";
import { ImageChunkSource } from "data/image_chunk";
import { DataTexture2D } from "objects/textures/data_texture_2d";

// Loads chunks from an image source into a single textured plane.
export class SubTiledImageLayer extends Layer {
  private readonly source_: ImageChunkSource;
  // TODO: remove this when region is passed through to update.
  // https://github.com/chanzuckerberg/imaging-active-learning/issues/33
  private readonly region_: Region;

  constructor(source: ImageChunkSource, region: Region) {
    super();
    this.setState("initialized");
    this.source_ = source;
    this.region_ = region;
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

  private async load(region: Region) {
    if (this.state !== "initialized") {
      throw new Error(`Trying to load chunks more than once.`);
    }
    this.setState("loading");
    const loader = await this.source_.open();

    // Get a chunk covering the entire region of interest.
    const emptyChunk = await loader.emptyData(region);
    console.debug("emptyChunk", emptyChunk);

    // This ignores the order of the dimensions specified in the input region.
    // Instead it relies on the order defined by the source, and that the bytes
    // are expected to be iterated in a C-like order (i.e. row-wise).
    const indices = Array.from(emptyChunk.region.values());
    const origin = indices.map((index) => index.start);
    const size = indices.map((index) => index.stop - index.start);

    // Instead of using the origin and size of the chunk, we should probably
    // return a chunk with a region in some integer valued data space along
    // with a transform that can be used to transform the geometry. That way
    // updating sub-regions of a texture (in other implementations) should be
    // much easier.
    const plane = new PlaneGeometry(
      size[1],
      size[0],
      1,
      1,
      origin[1],
      origin[0]
    );

    const texture = new DataTexture2D(
      emptyChunk.data,
      emptyChunk.shape[1],
      emptyChunk.shape[0]
    );
    texture.dataFormat = "red_integer";
    if (emptyChunk.data instanceof Uint16Array) {
      texture.dataType = "unsigned_short";
    }
    texture.unpackRowLength = emptyChunk.stride[0];
    texture.unpackAlignment = emptyChunk.rowAlignmentBytes;

    this.addObject(new Mesh(plane, texture));

    for await (const chunk of loader.loadChunks(region)) {
      const shape = chunk.shape;
      if (shape.length !== 2) {
        throw new Error(
          `Expected region size of 2. Instead found ${shape.length}`
        );
      }

      // Instead of copying the chunk's data into the full data, we
      // should push it straight into the texture buffer.
      const chunkIndices = Array.from(chunk.indices.values());
      const xIndices = chunkIndices[1];
      const yIndices = chunkIndices[0];
      for (let i = 0, y = yIndices.start; y < yIndices.stop; ++i, ++y) {
        const yOffset = y * emptyChunk.stride[0];
        const chunkRowOffset = i * chunk.stride[0];
        const chunkRowData = chunk.data.subarray(
          chunkRowOffset,
          chunkRowOffset + chunk.shape[1]
        );
        const offset = yOffset + xIndices.start;
        emptyChunk.data.set(chunkRowData, offset);
      }
      // texture.data = emptyChunk.data;
      texture.needsUpdate = true;
    }
    this.setState("ready");
  }
}
