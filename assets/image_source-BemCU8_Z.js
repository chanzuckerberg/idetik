import { j as Camera, w as fromValues, x as multiply, y as create, z as invert, A as transformMat4, B as create$1, D as Box2, h as fromValues$1, E as ortho, N as Node, C as Color, R as RenderableObject, G as Geometry, F as get_context, H as Location, J as FetchStore, K as openGroup, M as parseOmeZarrImage, O as openArray, P as omeZarrToZarrVersion } from "./metadata_loaders-CXLkXwNR.js";
const DEFAULT_ASPECT_RATIO = 1.77;
const DEFAULT_WIDTH = 128;
const DEFAULT_HEIGHT = 128 / DEFAULT_ASPECT_RATIO;
class OrthographicCamera extends Camera {
  // width_ and height_ should always be defined by constructor (see setFrame)
  width_ = DEFAULT_WIDTH;
  height_ = DEFAULT_HEIGHT;
  viewportAspectRatio_ = DEFAULT_ASPECT_RATIO;
  viewportSize_ = [DEFAULT_WIDTH, DEFAULT_HEIGHT];
  constructor(left, right, top, bottom, near = 0, far = 100) {
    super();
    this.near_ = near;
    this.far_ = far;
    this.setFrame(left, right, bottom, top);
    this.updateProjectionMatrix();
  }
  get viewportSize() {
    return this.viewportSize_;
  }
  setAspectRatio(aspectRatio) {
    this.viewportAspectRatio_ = aspectRatio;
    this.updateProjectionMatrix();
  }
  setFrame(left, right, bottom, top) {
    this.width_ = Math.abs(right - left);
    this.height_ = Math.abs(top - bottom);
    this.updateProjectionMatrix();
    const centerX = 0.5 * (left + right);
    const centerY = 0.5 * (bottom + top);
    this.transform.setTranslation([centerX, centerY, 0]);
    this.transform.setScale([1, 1, 1]);
    this.transform.setRotation([0, 0, 0, 1]);
  }
  get type() {
    return "OrthographicCamera";
  }
  zoom(factor) {
    if (factor <= 0) {
      throw new Error(`Invalid zoom factor: ${factor}`);
    }
    const inverseFactor = 1 / factor;
    this.transform.addScale([inverseFactor, inverseFactor, 1]);
  }
  getWorldViewRect() {
    let topLeft = fromValues(-1, -1, 0, 1);
    let bottomRight = fromValues(1, 1, 0, 1);
    const viewProjection = multiply(
      create(),
      this.projectionMatrix,
      this.viewMatrix
    );
    const inv = invert(create(), viewProjection);
    topLeft = transformMat4(create$1(), topLeft, inv);
    bottomRight = transformMat4(create$1(), bottomRight, inv);
    return new Box2(
      fromValues$1(topLeft[0], topLeft[1]),
      fromValues$1(bottomRight[0], bottomRight[1])
    );
  }
  updateProjectionMatrix() {
    const width = this.width_;
    const height = this.height_;
    const frameAspectRatio = width / height;
    let viewportHalfWidth = 0.5 * width;
    let viewportHalfHeight = 0.5 * height;
    if (this.viewportAspectRatio_ > frameAspectRatio) {
      viewportHalfWidth *= this.viewportAspectRatio_ / frameAspectRatio;
    } else {
      viewportHalfHeight *= frameAspectRatio / this.viewportAspectRatio_;
    }
    this.viewportSize_ = [2 * viewportHalfWidth, 2 * viewportHalfHeight];
    ortho(
      this.projectionMatrix_,
      -viewportHalfWidth,
      viewportHalfWidth,
      -viewportHalfHeight,
      viewportHalfHeight,
      this.near_,
      this.far_
    );
  }
}
function isTextureUnpackRowAlignment(value) {
  return value === 1 || value === 2 || value === 4 || value === 8;
}
function bufferToDataType(buffer) {
  if (buffer instanceof Int8Array) {
    return "byte";
  } else if (buffer instanceof Int16Array) {
    return "short";
  } else if (buffer instanceof Int32Array) {
    return "int";
  } else if (buffer instanceof Uint8Array) {
    return "unsigned_byte";
  } else if (buffer instanceof Uint16Array) {
    return "unsigned_short";
  } else if (buffer instanceof Uint32Array) {
    return "unsigned_int";
  } else if (buffer instanceof Float32Array) {
    return "float";
  }
  throw new Error("Unsupported buffer type.");
}
function textureDefaultValueRange(texture) {
  if (texture.dataFormat === "rgb" || texture.dataFormat === "rgba") {
    return [0, 1];
  }
  switch (texture.dataType) {
    case "byte":
      return [-128, 127];
    case "short":
      return [-32768, 32767];
    case "int":
      return [-2147483648, 2147483647];
    case "unsigned_byte":
      return [0, 255];
    case "unsigned_short":
      return [0, 65535];
    case "unsigned_int":
      return [0, 4294967295];
    case "float":
      return [0, 1];
  }
}
class Texture extends Node {
  dataFormat = "rgba";
  dataType = "unsigned_byte";
  maxFilter = "nearest";
  minFilter = "nearest";
  mipmapLevels = 1;
  unpackAlignment = 4;
  unpackRowLength = 0;
  wrapR = "repeat";
  wrapS = "repeat";
  wrapT = "repeat";
  needsUpdate = true;
  get type() {
    return "Texture";
  }
}
const MAX_CHANNELS = 32;
function validateChannel(texture, { visible, color, contrastLimits }) {
  if (visible === void 0) {
    visible = true;
  }
  if (color === void 0) {
    color = Color.WHITE;
  } else {
    color = Color.from(color);
  }
  if (texture !== null) {
    contrastLimits = validateContrastLimits(contrastLimits, texture);
  } else if (contrastLimits === void 0) {
    console.debug(
      "No texture provided, defaulting channel contrast limits to [0, 1]."
    );
    contrastLimits = [0, 1];
  }
  return {
    visible,
    color,
    contrastLimits
  };
}
function validateChannels(texture, channelProps) {
  if (channelProps.length > MAX_CHANNELS) {
    throw new Error(`Maximum number of channels is ${MAX_CHANNELS}`);
  }
  if (texture?.type === "Texture2DArray") {
    const depth = texture.depth;
    if (channelProps.length !== depth) {
      throw new Error(
        `Number of channels (${channelProps.length}) must match depth of texture (${depth}).`
      );
    }
  }
  return channelProps.map((props) => validateChannel(texture, props));
}
function validateContrastLimits(contrastLimits, texture) {
  if (contrastLimits === void 0) {
    return textureDefaultValueRange(texture);
  }
  if (contrastLimits[1] <= contrastLimits[0]) {
    throw new Error(
      `Contrast limits must be strictly increasing: ${contrastLimits}.`
    );
  }
  return contrastLimits;
}
class ImageRenderable extends RenderableObject {
  channels_;
  constructor(geometry, texture, channels = []) {
    super();
    this.geometry = geometry;
    this.setTexture(0, texture);
    this.channels_ = validateChannels(texture, channels);
    this.programName = textureToShader(texture);
  }
  get type() {
    return "ImageRenderable";
  }
  setChannelProps(channels) {
    this.channels_ = validateChannels(this.textures[0], channels);
  }
  setChannelProperty(channelIndex, property, value) {
    const newChannel = validateChannel(this.textures[0], {
      ...this.channels_[channelIndex],
      [property]: value
    });
    this.channels_[channelIndex] = newChannel;
  }
  getUniforms() {
    const texture = this.textures[0];
    if (!texture) {
      throw new Error("No texture set");
    }
    if (texture.type === "Texture2D") {
      const { color, contrastLimits } = this.channels_[0] ?? validateChannel(texture, {});
      return {
        ImageSampler: 0,
        Color: color.rgb,
        ValueOffset: -contrastLimits[0],
        ValueScale: 1 / (contrastLimits[1] - contrastLimits[0])
      };
    } else {
      const visible = [];
      const color = [];
      const valueOffset = [];
      const valueScale = [];
      this.channels_.forEach((channel) => {
        visible.push(channel.visible);
        color.push(...channel.color.rgb);
        valueOffset.push(-channel.contrastLimits[0]);
        valueScale.push(
          1 / (channel.contrastLimits[1] - channel.contrastLimits[0])
        );
      });
      return {
        ImageSampler: 0,
        "Visible[0]": visible,
        "Color[0]": color,
        "ValueOffset[0]": valueOffset,
        "ValueScale[0]": valueScale
      };
    }
  }
}
function textureToShader(texture) {
  if (texture.type === "Texture2D") {
    return dataTypeToScalarImageShader(texture.dataType);
  } else if (texture.type === "Texture2DArray") {
    return dataTypeToArrayImageShader(texture.dataType);
  }
  throw new Error(`Unsupported image texture type: ${texture.type}`);
}
function dataTypeToScalarImageShader(dataType) {
  switch (dataType) {
    case "byte":
    case "int":
    case "short":
      return "intScalarImage";
    case "unsigned_short":
    case "unsigned_byte":
    case "unsigned_int":
      return "uintScalarImage";
    case "float":
      return "floatScalarImage";
  }
}
function dataTypeToArrayImageShader(dataType) {
  switch (dataType) {
    case "byte":
    case "int":
    case "short":
      return "intScalarImageArray";
    case "unsigned_short":
    case "unsigned_byte":
    case "unsigned_int":
      return "uintScalarImageArray";
    case "float":
      return "floatScalarImageArray";
  }
}
class Texture2DArray extends Texture {
  data_;
  width_;
  height_;
  depth_;
  constructor(data, width, height) {
    super();
    this.dataFormat = "scalar";
    this.dataType = bufferToDataType(data);
    this.data_ = data;
    this.width_ = width;
    this.height_ = height;
    this.depth_ = data.length / (width * height);
  }
  get type() {
    return "Texture2DArray";
  }
  set data(data) {
    this.data_ = data;
    this.needsUpdate = true;
  }
  get data() {
    return this.data_;
  }
  get width() {
    return this.width_;
  }
  get height() {
    return this.height_;
  }
  get depth() {
    return this.depth_;
  }
  updateWithChunk(chunk, data) {
    const source = data ?? chunk.data;
    if (!source) {
      throw new Error(
        "Unable to update texture, chunk data is not initialized."
      );
    }
    if (this.data === source) return;
    const width = chunk.shape.x;
    const height = chunk.shape.y;
    const depth = source.length / (width * height);
    if (this.width != width || this.height != height || this.depth_ != depth || this.dataType != bufferToDataType(source)) {
      throw new Error("Unable to update texture, texture buffer mismatch.");
    }
    this.data = source;
  }
  static createWithChunk(chunk, data) {
    const source = data ?? chunk.data;
    if (!source) {
      throw new Error(
        "Unable to create texture, chunk data is not initialized."
      );
    }
    const texture = new Texture2DArray(source, chunk.shape.x, chunk.shape.y);
    texture.unpackRowLength = chunk.rowStride;
    texture.unpackAlignment = chunk.rowAlignmentBytes;
    return texture;
  }
}
class PlaneGeometry extends Geometry {
  constructor(width, height, widthSegments, heightSegments) {
    super();
    const vertex = [];
    const index = [];
    const gridX = widthSegments;
    const gridY = heightSegments;
    const gridX1 = gridX + 1;
    const gridY1 = gridY + 1;
    const segmentW = width / gridX;
    const segmentH = height / gridY;
    for (let iy = 0; iy < gridY1; ++iy) {
      const y = iy * segmentH;
      for (let ix = 0; ix < gridX1; ++ix) {
        const x = ix * segmentW;
        const u = ix / gridX;
        const v = iy / gridY;
        const position = [x, y, 0];
        const normals = [0, 0, 1];
        const uvs = [u, v];
        vertex.push(...position, ...normals, ...uvs);
      }
    }
    for (let iy = 0; iy < gridY; ++iy) {
      for (let ix = 0; ix < gridX; ++ix) {
        const a = ix + gridX1 * iy;
        const b = ix + gridX1 * (iy + 1);
        const c = ix + 1 + gridX1 * (iy + 1);
        const d = ix + 1 + gridX1 * iy;
        index.push(a, b, d);
        index.push(b, c, d);
      }
    }
    this.vertexData_ = new Float32Array(vertex);
    this.indexData_ = new Uint32Array(index);
    this.addAttribute({
      type: "position",
      itemSize: 3,
      offset: 0
    });
    this.addAttribute({
      type: "normal",
      itemSize: 3,
      offset: 3 * Float32Array.BYTES_PER_ELEMENT
    });
    this.addAttribute({
      type: "uv",
      itemSize: 2,
      offset: 6 * Float32Array.BYTES_PER_ELEMENT
    });
  }
}
function* range(start, stop, step = 1) {
  if (stop === void 0) {
    stop = start;
    start = 0;
  }
  for (let i = start; i < stop; i += step) {
    yield i;
  }
}
function* product(...iterables) {
  if (iterables.length === 0) {
    return;
  }
  const iterators = iterables.map((it) => it[Symbol.iterator]());
  const results = iterators.map((it) => it.next());
  if (results.some((r) => r.done)) {
    throw new Error("Input contains an empty iterator.");
  }
  for (let i = 0; ; ) {
    if (results[i].done) {
      iterators[i] = iterables[i][Symbol.iterator]();
      results[i] = iterators[i].next();
      if (++i >= iterators.length) {
        return;
      }
    } else {
      yield results.map(({ value }) => value);
      i = 0;
    }
    results[i] = iterators[i].next();
  }
}
function slice_indices({ start, stop, step }, length) {
  if (step === 0) {
    throw new Error("slice step cannot be zero");
  }
  step = step ?? 1;
  const step_is_negative = step < 0;
  const [lower, upper] = step_is_negative ? [-1, length - 1] : [0, length];
  if (start === null) {
    start = step_is_negative ? upper : lower;
  } else {
    if (start < 0) {
      start += length;
      if (start < lower) {
        start = lower;
      }
    } else if (start > upper) {
      start = upper;
    }
  }
  if (stop === null) {
    stop = step_is_negative ? lower : upper;
  } else {
    if (stop < 0) {
      stop += length;
      if (stop < lower) {
        stop = lower;
      }
    } else if (stop > upper) {
      stop = upper;
    }
  }
  return [start, stop, step];
}
function slice(start, stop, step = null) {
  if (stop === void 0) {
    stop = start;
    start = null;
  }
  return {
    start,
    stop,
    step
  };
}
function create_queue() {
  const promises = [];
  return {
    add: (fn) => promises.push(fn()),
    onIdle: () => Promise.all(promises)
  };
}
class IndexError extends Error {
  constructor(msg) {
    super(msg);
    this.name = "IndexError";
  }
}
function err_too_many_indices(selection, shape) {
  throw new IndexError(`too many indicies for array; expected ${shape.length}, got ${selection.length}`);
}
function err_boundscheck(dim_len) {
  throw new IndexError(`index out of bounds for dimension with length ${dim_len}`);
}
function err_negative_step() {
  throw new IndexError("only slices with step >= 1 are supported");
}
function check_selection_length(selection, shape) {
  if (selection.length > shape.length) {
    err_too_many_indices(selection, shape);
  }
}
function normalize_integer_selection(dim_sel, dim_len) {
  dim_sel = Math.trunc(dim_sel);
  if (dim_sel < 0) {
    dim_sel = dim_len + dim_sel;
  }
  if (dim_sel >= dim_len || dim_sel < 0) {
    err_boundscheck(dim_len);
  }
  return dim_sel;
}
class IntDimIndexer {
  dim_sel;
  dim_len;
  dim_chunk_len;
  nitems;
  constructor({ dim_sel, dim_len, dim_chunk_len }) {
    dim_sel = normalize_integer_selection(dim_sel, dim_len);
    this.dim_sel = dim_sel;
    this.dim_len = dim_len;
    this.dim_chunk_len = dim_chunk_len;
    this.nitems = 1;
  }
  *[Symbol.iterator]() {
    const dim_chunk_ix = Math.floor(this.dim_sel / this.dim_chunk_len);
    const dim_offset = dim_chunk_ix * this.dim_chunk_len;
    const dim_chunk_sel = this.dim_sel - dim_offset;
    yield { dim_chunk_ix, dim_chunk_sel };
  }
}
class SliceDimIndexer {
  start;
  stop;
  step;
  dim_len;
  dim_chunk_len;
  nitems;
  nchunks;
  constructor({ dim_sel, dim_len, dim_chunk_len }) {
    const [start, stop, step] = slice_indices(dim_sel, dim_len);
    this.start = start;
    this.stop = stop;
    this.step = step;
    if (this.step < 1)
      err_negative_step();
    this.dim_len = dim_len;
    this.dim_chunk_len = dim_chunk_len;
    this.nitems = Math.max(0, Math.ceil((this.stop - this.start) / this.step));
    this.nchunks = Math.ceil(this.dim_len / this.dim_chunk_len);
  }
  *[Symbol.iterator]() {
    const dim_chunk_ix_from = Math.floor(this.start / this.dim_chunk_len);
    const dim_chunk_ix_to = Math.ceil(this.stop / this.dim_chunk_len);
    for (const dim_chunk_ix of range(dim_chunk_ix_from, dim_chunk_ix_to)) {
      const dim_offset = dim_chunk_ix * this.dim_chunk_len;
      const dim_limit = Math.min(this.dim_len, (dim_chunk_ix + 1) * this.dim_chunk_len);
      const dim_chunk_len = dim_limit - dim_offset;
      let dim_out_offset = 0;
      let dim_chunk_sel_start = 0;
      if (this.start < dim_offset) {
        const remainder = (dim_offset - this.start) % this.step;
        if (remainder)
          dim_chunk_sel_start += this.step - remainder;
        dim_out_offset = Math.ceil((dim_offset - this.start) / this.step);
      } else {
        dim_chunk_sel_start = this.start - dim_offset;
      }
      const dim_chunk_sel_stop = this.stop > dim_limit ? dim_chunk_len : this.stop - dim_offset;
      const dim_chunk_sel = [
        dim_chunk_sel_start,
        dim_chunk_sel_stop,
        this.step
      ];
      const dim_chunk_nitems = Math.ceil((dim_chunk_sel_stop - dim_chunk_sel_start) / this.step);
      const dim_out_sel = [
        dim_out_offset,
        dim_out_offset + dim_chunk_nitems,
        1
      ];
      yield { dim_chunk_ix, dim_chunk_sel, dim_out_sel };
    }
  }
}
function normalize_selection(selection, shape) {
  let normalized = [];
  if (selection === null) {
    normalized = shape.map((_) => slice(null));
  } else if (Array.isArray(selection)) {
    normalized = selection.map((s) => s ?? slice(null));
  }
  check_selection_length(normalized, shape);
  return normalized;
}
class BasicIndexer {
  dim_indexers;
  shape;
  constructor({ selection, shape, chunk_shape }) {
    this.dim_indexers = normalize_selection(selection, shape).map((dim_sel, i) => {
      return new (typeof dim_sel === "number" ? IntDimIndexer : SliceDimIndexer)({
        // @ts-expect-error ts inference not strong enough to know correct chunk
        dim_sel,
        dim_len: shape[i],
        dim_chunk_len: chunk_shape[i]
      });
    });
    this.shape = this.dim_indexers.filter((ixr) => ixr instanceof SliceDimIndexer).map((sixr) => sixr.nitems);
  }
  *[Symbol.iterator]() {
    for (const dim_projections of product(...this.dim_indexers)) {
      const chunk_coords = dim_projections.map((p) => p.dim_chunk_ix);
      const mapping = dim_projections.map((p) => {
        if ("dim_out_sel" in p) {
          return { from: p.dim_chunk_sel, to: p.dim_out_sel };
        }
        return { from: p.dim_chunk_sel, to: null };
      });
      yield { chunk_coords, mapping };
    }
  }
}
function unwrap(arr, idx) {
  return "get" in arr ? arr.get(idx) : arr[idx];
}
async function get$1(arr, selection, opts, setter2) {
  let context = get_context(arr);
  let indexer = new BasicIndexer({
    selection,
    shape: arr.shape,
    chunk_shape: arr.chunks
  });
  let out = setter2.prepare(new context.TypedArray(indexer.shape.reduce((a, b) => a * b, 1)), indexer.shape, context.get_strides(indexer.shape, opts.order));
  let queue = opts.create_queue?.() ?? create_queue();
  for (const { chunk_coords, mapping } of indexer) {
    queue.add(async () => {
      let { data, shape, stride } = await arr.getChunk(chunk_coords, opts.opts);
      let chunk = setter2.prepare(data, shape, stride);
      setter2.set_from_chunk(out, chunk, mapping);
    });
  }
  await queue.onIdle();
  return indexer.shape.length === 0 ? unwrap(out.data, 0) : out;
}
function object_array_view(arr, offset = 0, size) {
  let length = size ?? arr.length - offset;
  return {
    length,
    subarray(from, to = length) {
      return object_array_view(arr, offset + from, to - from);
    },
    set(data, start = 0) {
      for (let i = 0; i < data.length; i++) {
        arr[offset + start + i] = data.get(i);
      }
    },
    get(index) {
      return arr[offset + index];
    }
  };
}
function compat_chunk(arr) {
  if (globalThis.Array.isArray(arr.data)) {
    return {
      // @ts-expect-error
      data: object_array_view(arr.data),
      stride: arr.stride,
      bytes_per_element: 1
    };
  }
  return {
    data: new Uint8Array(arr.data.buffer, arr.data.byteOffset, arr.data.byteLength),
    stride: arr.stride,
    bytes_per_element: arr.data.BYTES_PER_ELEMENT
  };
}
function get_typed_array_constructor(arr) {
  if ("chars" in arr) {
    return arr.constructor.bind(null, arr.chars);
  }
  return arr.constructor;
}
function compat_scalar(arr, value) {
  if (globalThis.Array.isArray(arr.data)) {
    return object_array_view([value]);
  }
  let TypedArray = get_typed_array_constructor(arr.data);
  let data = new TypedArray([value]);
  return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
}
const setter = {
  prepare(data, shape, stride) {
    return { data, shape, stride };
  },
  set_scalar(dest, sel, value) {
    let view = compat_chunk(dest);
    set_scalar_binary(view, sel, compat_scalar(dest, value), view.bytes_per_element);
  },
  set_from_chunk(dest, src, projections) {
    let view = compat_chunk(dest);
    set_from_chunk_binary(view, compat_chunk(src), view.bytes_per_element, projections);
  }
};
async function get(arr, selection = null, opts = {}) {
  return get$1(arr, selection, opts, setter);
}
function indices_len(start, stop, step) {
  if (step < 0 && stop < start) {
    return Math.floor((start - stop - 1) / -step) + 1;
  }
  if (start < stop)
    return Math.floor((stop - start - 1) / step) + 1;
  return 0;
}
function set_scalar_binary(out, out_selection, value, bytes_per_element) {
  if (out_selection.length === 0) {
    out.data.set(value, 0);
    return;
  }
  const [slice2, ...slices] = out_selection;
  const [curr_stride, ...stride] = out.stride;
  if (typeof slice2 === "number") {
    const data = out.data.subarray(curr_stride * slice2 * bytes_per_element);
    set_scalar_binary({ data, stride }, slices, value, bytes_per_element);
    return;
  }
  const [from, to, step] = slice2;
  const len = indices_len(from, to, step);
  if (slices.length === 0) {
    for (let i = 0; i < len; i++) {
      out.data.set(value, curr_stride * (from + step * i) * bytes_per_element);
    }
    return;
  }
  for (let i = 0; i < len; i++) {
    const data = out.data.subarray(curr_stride * (from + step * i) * bytes_per_element);
    set_scalar_binary({ data, stride }, slices, value, bytes_per_element);
  }
}
function set_from_chunk_binary(dest, src, bytes_per_element, projections) {
  const [proj, ...projs] = projections;
  const [dstride, ...dstrides] = dest.stride;
  const [sstride, ...sstrides] = src.stride;
  if (proj.from === null) {
    if (projs.length === 0) {
      dest.data.set(src.data.subarray(0, bytes_per_element), proj.to * bytes_per_element);
      return;
    }
    set_from_chunk_binary({
      data: dest.data.subarray(dstride * proj.to * bytes_per_element),
      stride: dstrides
    }, src, bytes_per_element, projs);
    return;
  }
  if (proj.to === null) {
    if (projs.length === 0) {
      let offset = proj.from * bytes_per_element;
      dest.data.set(src.data.subarray(offset, offset + bytes_per_element), 0);
      return;
    }
    set_from_chunk_binary(dest, {
      data: src.data.subarray(sstride * proj.from * bytes_per_element),
      stride: sstrides
    }, bytes_per_element, projs);
    return;
  }
  const [from, to, step] = proj.to;
  const [sfrom, _, sstep] = proj.from;
  const len = indices_len(from, to, step);
  if (projs.length === 0) {
    if (step === 1 && sstep === 1 && dstride === 1 && sstride === 1) {
      let offset = sfrom * bytes_per_element;
      let size = len * bytes_per_element;
      dest.data.set(src.data.subarray(offset, offset + size), from * bytes_per_element);
      return;
    }
    for (let i = 0; i < len; i++) {
      let offset = sstride * (sfrom + sstep * i) * bytes_per_element;
      dest.data.set(src.data.subarray(offset, offset + bytes_per_element), dstride * (from + step * i) * bytes_per_element);
    }
    return;
  }
  for (let i = 0; i < len; i++) {
    set_from_chunk_binary({
      data: dest.data.subarray(dstride * (from + i * step) * bytes_per_element),
      stride: dstrides
    }, {
      data: src.data.subarray(sstride * (sfrom + i * sstep) * bytes_per_element),
      stride: sstrides
    }, bytes_per_element, projs);
  }
}
async function resolveFileHandleForPath(root, path) {
  const dirs = path.split("/");
  const fname = dirs.pop();
  if (!fname) {
    throw new Error("Invalid path");
  }
  for (const dir of dirs) {
    root = await root.getDirectoryHandle(dir);
  }
  return root.getFileHandle(fname);
}
class WebFileSystemStore {
  #root;
  constructor(root) {
    this.#root = root;
  }
  async get(key) {
    const fh = await resolveFileHandleForPath(this.#root, key.slice(1)).catch(
      () => {
        return void 0;
      }
    );
    if (!fh) {
      return void 0;
    }
    const file = await fh.getFile();
    const buffer = await file.arrayBuffer();
    return new Uint8Array(buffer);
  }
}
const chunkDataTypes = [
  Int8Array,
  Int16Array,
  Int32Array,
  Uint8Array,
  Uint16Array,
  Uint32Array,
  Float32Array
];
function isChunkData(value) {
  if (chunkDataTypes.some((ChunkData) => value instanceof ChunkData)) {
    return true;
  }
  const supportedDataTypeNames = chunkDataTypes.map((dtype) => dtype.name);
  console.debug(
    `Unsupported chunk data type: ${value}. Supported data types: ${supportedDataTypeNames}`
  );
  return false;
}
class PromiseQueue {
  promises_ = [];
  scheduler_;
  constructor(scheduler) {
    this.scheduler_ = scheduler;
  }
  add(promise) {
    this.promises_.push(promise);
  }
  onIdle() {
    return Promise.all(this.promises_.map((p) => this.scheduler_.submit(p)));
  }
}
class OmeZarrImageLoader {
  metadata_;
  arrays_;
  loaderAttributes_;
  dimensions_;
  constructor(props) {
    this.metadata_ = props.metadata;
    this.arrays_ = props.arrays;
    this.loaderAttributes_ = getLoaderAttributes(this.metadata_, this.arrays_);
    this.dimensions_ = inferSourceDimensionMap(this.loaderAttributes_);
  }
  getSourceDimensionMap() {
    return this.dimensions_;
  }
  async loadChunkData(chunk, sliceCoords) {
    const chunkCoords = [];
    chunkCoords[this.dimensions_.x.index] = chunk.chunkIndex.x;
    chunkCoords[this.dimensions_.y.index] = chunk.chunkIndex.y;
    if (this.dimensions_.z) {
      chunkCoords[this.dimensions_.z.index] = chunk.chunkIndex.z;
    }
    if (this.dimensions_.c) {
      if (sliceCoords.c === void 0) {
        throw new Error(
          "Region is missing c value but c dimension exists in data"
        );
      }
      chunkCoords[this.dimensions_.c.index] = sliceChunkIndex(
        sliceCoords.c,
        this.dimensions_.c.lods[chunk.lod]
      );
    }
    if (this.dimensions_.t) {
      if (sliceCoords.t === void 0) {
        throw new Error(
          "Region is missing t value but t dimension exists in data"
        );
      }
      chunkCoords[this.dimensions_.t.index] = sliceChunkIndex(
        sliceCoords.t,
        this.dimensions_.t.lods[chunk.lod]
      );
    }
    const array = this.arrays_[chunk.lod];
    const subarray = await array.getChunk(chunkCoords);
    const data = subarray.data;
    if (!isChunkData(data)) {
      throw new Error(
        `Subarray has an unsupported data type, data=${data.constructor.name}`
      );
    }
    const rowAlignment = data.BYTES_PER_ELEMENT;
    if (!isTextureUnpackRowAlignment(rowAlignment)) {
      throw new Error(
        "Invalid row alignment value. Possible values are 1, 2, 4, or 8"
      );
    }
    chunk.rowAlignmentBytes = rowAlignment;
    chunk.rowStride = subarray.stride[this.dimensions_.y.index];
    chunk.data = data;
  }
  async loadRegion(region, lod, scheduler) {
    if (lod >= this.arrays_.length) {
      throw new Error(
        `Invalid LOD index: ${lod}. Only ${this.arrays_.length} lod(s) available`
      );
    }
    const attributes = this.loaderAttributes_[lod];
    const indices = this.regionToIndices(region, attributes);
    const { scale, translation } = attributes;
    const array = this.arrays_[lod];
    let options = {};
    if (scheduler !== void 0) {
      options = {
        create_queue: () => new PromiseQueue(scheduler),
        opts: { signal: scheduler.abortSignal }
      };
    }
    const subarray = await get(array, indices, options);
    if (!isChunkData(subarray.data)) {
      throw new Error(
        `Subarray has an unsupported data type, data=${subarray.data.constructor.name}`
      );
    }
    if (subarray.shape.length !== 2 && subarray.shape.length !== 3) {
      throw new Error(
        `Expected to receive a 2D or 3D subarray. Instead chunk has shape ${subarray.shape}`
      );
    }
    const rowAlignment = subarray.data.BYTES_PER_ELEMENT;
    if (!isTextureUnpackRowAlignment(rowAlignment)) {
      throw new Error(
        "Invalid row alignment value. Possible values are 1, 2, 4, or 8"
      );
    }
    const calculateOffset = (i) => {
      const index = indices[i];
      if (typeof index === "number") {
        return index * scale[i] + translation[i];
      } else if (index.start === null) {
        return translation[i];
      }
      return index.start * scale[i] + translation[i];
    };
    const xOffset = calculateOffset(indices.length - 1);
    const yOffset = calculateOffset(indices.length - 2);
    const chunk = {
      state: "loaded",
      lod,
      visible: true,
      prefetch: false,
      data: subarray.data,
      shape: {
        x: subarray.shape[subarray.shape.length - 1],
        y: subarray.shape[subarray.shape.length - 2],
        z: 1,
        c: subarray.shape.length === 3 ? subarray.shape[0] : 1
      },
      chunkIndex: { x: 0, y: 0, z: 0 },
      rowStride: subarray.stride[subarray.stride.length - 2],
      rowAlignmentBytes: rowAlignment,
      scale: {
        x: scale[indices.length - 1],
        y: scale[indices.length - 2],
        z: 1
      },
      offset: { x: xOffset, y: yOffset, z: 0 }
    };
    return chunk;
  }
  getAttributes() {
    return this.loaderAttributes_;
  }
  regionToIndices(region, attributes) {
    const { dimensionNames, scale, translation } = attributes;
    const indices = [];
    for (const [i, dimName] of dimensionNames.entries()) {
      const match = region.find((s) => s.dimension == dimName);
      if (!match) {
        throw new Error(`Region does not contain a slice for ${dimName}`);
      }
      let index;
      const regionIndex = match.index;
      if (regionIndex.type === "full") {
        index = slice(null);
      } else if (regionIndex.type === "point") {
        index = Math.round((regionIndex.value - translation[i]) / scale[i]);
      } else {
        index = slice(
          Math.floor((regionIndex.start - translation[i]) / scale[i]),
          Math.ceil((regionIndex.stop - translation[i]) / scale[i])
        );
      }
      indices.push(index);
    }
    return indices;
  }
}
function getLoaderAttributes(image, arrays) {
  const output = [];
  const numAxes = image.axes.length;
  for (let i = 0; i < image.datasets.length; i++) {
    const dataset = image.datasets[i];
    const array = arrays[i];
    const scale = dataset.coordinateTransformations[0].scale;
    const translation = dataset.coordinateTransformations.length === 2 ? dataset.coordinateTransformations[1].translation : new Array(numAxes).fill(0);
    output.push({
      dimensionNames: image.axes.map((axis) => axis.name),
      dimensionUnits: image.axes.map((axis) => axis.unit),
      chunks: array.chunks,
      shape: array.shape,
      scale,
      translation
    });
  }
  return output;
}
function inferSourceDimensionMap(attrs) {
  const names = attrs[0].dimensionNames;
  const xIndex = findDimensionIndex(names, "x");
  const yIndex = findDimensionIndex(names, "y");
  const dims = {
    x: getSourceDimension(names[xIndex], xIndex, attrs),
    y: getSourceDimension(names[yIndex], yIndex, attrs),
    numLods: attrs.length
  };
  const zIndex = findDimensionIndexSafe(names, "z");
  if (zIndex !== -1) {
    dims.z = getSourceDimension(names[zIndex], zIndex, attrs);
  }
  const cIndex = findDimensionIndexSafe(names, "c");
  if (cIndex !== -1) {
    dims.c = getSourceDimension(names[cIndex], cIndex, attrs);
  }
  const tIndex = findDimensionIndexSafe(names, "t");
  if (tIndex !== -1) {
    dims.t = getSourceDimension(names[tIndex], tIndex, attrs);
  }
  return dims;
}
function getSourceDimension(name, index, attrs) {
  return {
    name,
    index,
    lods: attrs.map((attr) => ({
      size: attr.shape[index],
      chunkSize: attr.chunks[index],
      scale: attr.scale[index],
      translation: attr.translation[index]
    }))
  };
}
function sliceChunkIndex(value, lod) {
  const dataIndex = Math.round((value - lod.translation) / lod.scale);
  return Math.floor(dataIndex / lod.chunkSize);
}
function compareDimensions(a, b) {
  return a.toLowerCase() === b.toLowerCase();
}
function findDimensionIndex(dimensions, target) {
  const index = findDimensionIndexSafe(dimensions, target);
  if (index === -1) {
    throw new Error(
      `Could not find "${target}" dimension in [${dimensions.join(", ")}]`
    );
  }
  return index;
}
function findDimensionIndexSafe(dimensions, target) {
  return dimensions.findIndex((d) => compareDimensions(d, target));
}
class OmeZarrImageSource {
  location;
  constructor(source, path) {
    this.location = typeof source === "string" ? new Location(new FetchStore(source)) : new Location(new WebFileSystemStore(source), path);
  }
  async open() {
    const root = await openGroup(this.location);
    const adaptedOmeImage = parseOmeZarrImage(root.attrs);
    const omeVersion = adaptedOmeImage.originalVersion;
    const images = adaptedOmeImage.multiscales;
    if (images.length !== 1) {
      throw new Error(
        `Exactly one multiscale image is supported. Found ${images.length} images.`
      );
    }
    const metadata = images[0];
    if (metadata.datasets.length === 0) {
      throw new Error(`No datasets found in the multiscale image.`);
    }
    const zarrVersion = omeZarrToZarrVersion(omeVersion);
    const arrays = await Promise.all(
      metadata.datasets.map((d) => openArray(root.resolve(d.path), zarrVersion))
    );
    const shape = arrays[0].shape;
    const axes = metadata.axes;
    if (axes.length !== shape.length) {
      throw new Error(
        `Mismatch between number of axes (${axes.length}) and array shape (${shape.length})`
      );
    }
    return new OmeZarrImageLoader({
      metadata,
      arrays
    });
  }
}
export {
  ImageRenderable as I,
  OmeZarrImageSource as O,
  PlaneGeometry as P,
  Texture2DArray as T,
  OrthographicCamera as a,
  Texture as b,
  bufferToDataType as c
};
//# sourceMappingURL=image_source-BemCU8_Z.js.map
