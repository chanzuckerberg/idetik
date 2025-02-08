import { Layer } from "core/layer";
import { Interval, Region } from "data/region";
import { ImageChunk, ImageChunkSource } from "data/image_chunk";
import { Texture2DArray } from "objects/textures/texture_2d_array";
import { AbortError, PromiseScheduler } from "@/data/promise_scheduler";
import { makeImageMesh, makeImageTextureArray } from "layers/image_utils";
import { Mesh } from "objects/renderable/mesh";
import { ShaderMaterial } from "objects/materials/shader_material";
import { shaderCode } from "renderers/shaders";

// Add interface for channel state
interface ChannelState {
  enabled: boolean;
}

// Loads 2D+t image data from an image source into renderable objects.
export class ImageSeriesLayer extends Layer {
  private readonly source_: ImageChunkSource;
  private readonly region_: Region;
  private readonly timeInterval_: Interval;
  private readonly timeDimensionIndex_: number;
  private texture_: Texture2DArray | null = null;
  private dataChunks_: ImageChunk[] = [];
  private scheduler_: PromiseScheduler = new PromiseScheduler(16);
  // Add channel states property with default values
  private channelStates_: ChannelState[] = [
    { enabled: true },
    { enabled: true },
    { enabled: true }
  ];

  constructor(source: ImageChunkSource, region: Region, timeDimension: string) {
    super();
    this.setState("initialized");
    this.source_ = source;
    this.region_ = region;
    this.timeDimensionIndex_ = region.findIndex(
      (x) => x.dimension == timeDimension
    );
    if (this.timeDimensionIndex_ === -1) {
      throw new Error(
        `Could not find dimension ${timeDimension} in ${JSON.stringify(region)}`
      );
    }
    const timeIndex = this.region_[this.timeDimensionIndex_].index;
    if (typeof timeIndex === "number") {
      throw new Error(
        `Time index is a number (${timeIndex}). It should be an interval.`
      );
    }
    this.timeInterval_ = timeIndex;
  }

  public update(): void {
    switch (this.state) {
      case "initialized":
        this.load();
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

  public setTimeIndex(index: number) {
    if (this.state !== "ready") {
      console.warn(`Trying to set time index before ready: ${this.state}`);
      return;
    }
    const { start, stop } = this.timeInterval_;
    const chunkIndex = index - start;
    if (chunkIndex < 0) {
      throw new Error(`Time index ${index} is before the start time: ${start}`);
    } else if (chunkIndex >= this.dataChunks_.length) {
      throw new Error(`Time index ${index} is after the stop time: ${stop}.`);
    }
    const chunk = this.dataChunks_[chunkIndex];
    if (this.texture_ === null) {
      this.texture_ = makeImageTextureArray(chunk);

      // Use shader material only if we need channel control
      let mesh;
      if (this.channelStates_) {  // If we have channel states defined
        console.debug('Creating shader material with:', {
          texture: this.texture_,
          channelStates: this.getChannelStates(),
          vertexShader: shaderCode.mesh.vertex,
          fragmentShader: shaderCode.uintImageArray.fragment
        });

        const material = new ShaderMaterial({
          vertexShader: shaderCode.mesh.vertex,
          fragmentShader: shaderCode.uintImageArray.fragment,
          uniforms: {
            texture0: { value: this.texture_ },
            channelEnabled: { value: this.getChannelStates() }
          }
        });

        console.debug('Created material:', material);
        mesh = makeImageMesh(chunk, material);
        console.debug('Created mesh with material:', mesh);
      } else {
        // Use simple texture rendering if no channel control needed
        mesh = makeImageMesh(chunk, this.texture_);
        console.debug('Created mesh with texture:', mesh);
      }

      this.addObject(mesh);
    } else {
      this.texture_.data = chunk.data;
    }
  }

  public close(): void {
    this.scheduler_.shutdown();
  }

  private async load() {
    if (this.state !== "initialized") {
      throw new Error(`Trying to open chunk loader more than once.`);
    }
    this.setState("loading");
    const loader = await this.source_.open();
    // Wait to load the whole region over all time points.
    this.dataChunks_ = [];
    const loadPromises = [];
    const { start, stop } = this.timeInterval_;
    // TODO: this assumes that time-steps are unitary when they might
    // have a scale associated with them. We could instead load the
    // whole region in and map back the chunks appropriately.
    // https://github.com/chanzuckerberg/imaging-active-learning/issues/75
    for (let t = start; t < stop; ++t) {
      const region = structuredClone(this.region_);
      region[this.timeDimensionIndex_].index = t;
      loadPromises.push(
        loader
          .loadChunk(region, this.scheduler_)
          .then((chunk) => (this.dataChunks_[t - start] = chunk))
      );
    }
    await Promise.all(loadPromises).catch((error) => {
      if (error instanceof AbortError) {
        console.debug("Loading aborted.");
        return;
      }
    });
    this.setState("ready");
  }

  // Add getter/setter for channel states
  public setChannelStates(states: boolean[]) {
    this.channelStates_ = states.map(enabled => ({ enabled }));
    console.debug('Channel states set to:', this.channelStates_);

    // If we have a mesh, update its material uniforms
    if (this.objects.length > 0) {
      const mesh = this.objects[0] as Mesh;
      const material = mesh.material as ShaderMaterial;
      material.uniforms.channelEnabled.value = states;
    }
  }

  public getChannelStates(): boolean[] {
    console.debug('Getting channel states:', this.channelStates_);
    return this.channelStates_.map(state => state.enabled);
  }
}
