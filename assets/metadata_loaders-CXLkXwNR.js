const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/blosc-DvQQ1ST0.js","assets/chunk-INHXZS53-DHVJiuU3.js","assets/gzip-AbJRpPtV.js","assets/browser-CwsEWr7C.js","assets/lz4-BIbM36RN.js","assets/zlib-Dk1NUtlh.js","assets/zstd-CO575QiM.js"])))=>i.map(i=>d[i]);
class LayerManager {
  layers_ = [];
  callbacks_ = [];
  // TODO: Make this non-optional when react components use the Idetik Runtime
  context_;
  constructor(context) {
    this.context_ = context;
  }
  partitionLayers() {
    const opaque = [];
    const transparent = [];
    for (const layer of this.layers) {
      if (layer.transparent) {
        transparent.push(layer);
      } else {
        opaque.push(layer);
      }
    }
    return { opaque, transparent };
  }
  add(layer) {
    this.layers_ = [...this.layers_, layer];
    if (this.context_) {
      layer.onAttached(this.context_);
    }
    this.notifyLayersChanged();
  }
  remove(layer) {
    const index = this.layers_.indexOf(layer);
    if (index === -1) {
      throw new Error(`Layer to remove not found: ${layer}`);
    }
    this.removeByIndex(index);
  }
  removeByIndex(index) {
    this.layers_ = this.layers_.filter((_, i) => i !== index);
    this.notifyLayersChanged();
  }
  removeAll() {
    this.layers_ = [];
    this.notifyLayersChanged();
  }
  get layers() {
    return this.layers_;
  }
  notifyLayersChanged() {
    for (const callback of this.callbacks_) {
      callback();
    }
  }
  addLayersChangeCallback(callback) {
    this.callbacks_.push(callback);
    return () => {
      this.removeLayersChangeCallback(callback);
    };
  }
  removeLayersChangeCallback(callback) {
    const index = this.callbacks_.indexOf(callback);
    if (index === void 0) {
      throw new Error(`Callback to remove not found: ${callback}`);
    }
    this.callbacks_.splice(index, 1);
  }
}
const Levels = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
};
const Colors = {
  debug: "\x1B[90m",
  // gray
  info: "\x1B[36m",
  // cyan
  warn: "\x1B[33m",
  // yellow
  error: "\x1B[31m"
  // red
};
class Logger {
  static logLevel_ = "debug";
  static setLogLevel(level) {
    Logger.logLevel_ = level;
  }
  static debug(moduleName, message, ...params) {
    Logger.log("debug", moduleName, message, ...params);
  }
  static info(moduleName, message, ...params) {
    Logger.log("info", moduleName, message, ...params);
  }
  static warn(moduleName, message, ...params) {
    Logger.log("warn", moduleName, message, ...params);
  }
  static error(moduleName, message, ...params) {
    Logger.log("error", moduleName, message, ...params);
  }
  static log(level, moduleName, message, ...args) {
    if (Levels[level] < Levels[Logger.logLevel_]) return;
    const timestamp = (/* @__PURE__ */ new Date()).toISOString();
    const color = Colors[level];
    const tag = `[${timestamp}][${level.toUpperCase()}][${moduleName}]`;
    const output = [`${color}${tag}`, message, ...args];
    switch (level) {
      case "debug":
        console.debug(...output);
        break;
      case "info":
        console.info(...output);
        break;
      case "warn":
        console.warn(...output);
        break;
      case "error":
        console.error(...output);
        break;
    }
  }
}
const eventTypes = [
  "pointerdown",
  "pointermove",
  "pointerup",
  "pointercancel",
  "wheel"
];
function isEventType(type) {
  return eventTypes.includes(type);
}
class EventContext {
  propagationStopped_ = false;
  type;
  event;
  worldPos;
  clipPos;
  constructor(type, event) {
    this.type = type;
    this.event = event;
  }
  get propagationStopped() {
    return this.propagationStopped_;
  }
  stopPropagation() {
    this.propagationStopped_ = true;
  }
}
class EventDispatcher {
  listeners_ = [];
  constructor(canvas) {
    eventTypes.forEach((type) => {
      canvas.addEventListener(type, this.handleEvent, { passive: false });
    });
  }
  addEventListener(listener) {
    this.listeners_.push(listener);
  }
  handleEvent = (e) => {
    if (!isEventType(e.type)) {
      Logger.error("EventDispatcher", `Unsupported event type ${e.type}`);
      return;
    }
    const event = new EventContext(e.type, e);
    for (const listener of this.listeners_) {
      listener(event);
      if (event.propagationStopped) break;
    }
  };
}
class Color {
  static RED = new Color(1, 0, 0);
  static GREEN = new Color(0, 1, 0);
  static BLUE = new Color(0, 0, 1);
  static YELLOW = new Color(1, 1, 0);
  static MAGENTA = new Color(1, 0, 1);
  static CYAN = new Color(0, 1, 1);
  static BLACK = new Color(0, 0, 0);
  static WHITE = new Color(1, 1, 1);
  static TRANSPARENT = new Color(0, 0, 0, 0);
  // RGBA color values in the range [0, 1]
  rgba_;
  constructor(r, g, b, a) {
    if (r < 0 || r > 1 || g < 0 || g > 1 || b < 0 || b > 1) {
      throw new Error("RGB values must be in the range [0, 1]");
    }
    if (a !== void 0 && (a < 0 || a > 1)) {
      throw new Error("Alpha value must be in the range [0, 1]");
    }
    this.rgba_ = [r, g, b, a ?? 1];
  }
  get rgb() {
    return [this.rgba_[0], this.rgba_[1], this.rgba_[2]];
  }
  get rgba() {
    return this.rgba_;
  }
  get r() {
    return this.rgba_[0];
  }
  get g() {
    return this.rgba_[1];
  }
  get b() {
    return this.rgba_[2];
  }
  get a() {
    return this.rgba_[3];
  }
  get rgbHex() {
    return `#${this.toHexComponent(this.r)}${this.toHexComponent(this.g)}${this.toHexComponent(this.b)}`;
  }
  get packed() {
    return Math.round(this.r * 255) << 24 | Math.round(this.g * 255) << 16 | Math.round(this.b * 255) << 8 | Math.round(this.a * 255);
  }
  static from(colorLike) {
    if (colorLike instanceof Color) {
      return colorLike;
    }
    if (Array.isArray(colorLike)) {
      return new Color(colorLike[0], colorLike[1], colorLike[2], colorLike[3]);
    }
    throw new Error("Unsupported color format");
  }
  static fromRgbHex(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) {
      throw new Error("Invalid RGB hex, use form '#RRGGBB'");
    }
    return new Color(
      parseInt(result[1], 16) / 255,
      parseInt(result[2], 16) / 255,
      parseInt(result[3], 16) / 255,
      1
    );
  }
  toHexComponent(value) {
    const hex = Math.round(value * 255).toString(16).padStart(2, "0");
    return hex.length === 1 ? "0" + hex : hex;
  }
}
class Renderer {
  canvas_;
  width_ = 0;
  height_ = 0;
  backgroundColor_ = new Color(0, 0, 0, 0);
  activeCamera_ = null;
  constructor(canvas) {
    this.canvas_ = canvas;
    this.updateRendererSize();
  }
  set activeCamera(camera) {
    if (this.activeCamera_ !== camera) {
      this.activeCamera_ = camera;
      this.updateActiveCamera();
    }
  }
  updateSize() {
    this.updateRendererSize();
    this.resize(this.width_, this.height_);
  }
  updateRendererSize() {
    this.width_ = this.canvas.clientWidth * window.devicePixelRatio;
    this.height_ = this.canvas.clientHeight * window.devicePixelRatio;
    if (this.canvas.width !== this.width_) this.canvas.width = this.width_;
    if (this.canvas.height !== this.height_) this.canvas.height = this.height_;
    this.updateActiveCamera();
  }
  updateActiveCamera() {
    const canvasAspectRatio = this.width_ / this.height_;
    if (this.activeCamera_) {
      this.activeCamera_.setAspectRatio(canvasAspectRatio);
    }
  }
  get canvas() {
    return this.canvas_;
  }
  get width() {
    return this.width_;
  }
  get height() {
    return this.height_;
  }
  get backgroundColor() {
    return this.backgroundColor_;
  }
  set backgroundColor(color) {
    this.backgroundColor_ = Color.from(color);
  }
  get activeCamera() {
    if (this.activeCamera_ === null) {
      throw new Error(
        "Attempted to access the active camera before it was set."
      );
    }
    return this.activeCamera_;
  }
}
var projected_line_vert_default = "#version 300 es\n\nconst float PI = 3.14159265;\n\nlayout (location = 0) in vec3 inPosition;\nlayout (location = 3) in vec3 inPrevPosition;\nlayout (location = 4) in vec3 inNextPosition;\nlayout (location = 5) in float direction;\nlayout (location = 6) in float path_proportion;\n\nuniform mat4 Projection;\nuniform mat4 ModelView;\nuniform vec2 Resolution;\nuniform float LineWidth;\nuniform float TaperOffset;\nuniform float TaperPower;\n\nvoid main() {\n    mat4 projModelView = Projection * ModelView;\n\n    vec4 prevPos = projModelView * vec4(inPrevPosition, 1.0);\n    vec4 currPos = projModelView * vec4(inPosition, 1.0);\n    vec4 nextPos = projModelView * vec4(inNextPosition, 1.0);\n\n    vec2 aspectVec = vec2(Resolution.x / Resolution.y, 1.0);\n    vec2 prevScreen = (prevPos.xy / prevPos.w) * aspectVec;\n    vec2 currScreen = (currPos.xy / currPos.w) * aspectVec;\n    vec2 nextScreen = (nextPos.xy / nextPos.w) * aspectVec;\n\n    vec2 diff;\n    if (prevPos == currPos) {\n        \n        diff = nextScreen - currScreen;\n    } else if (nextPos == currPos) {\n        \n        diff = currScreen - prevScreen;\n    } else {\n        \n        \n        \n        vec2 prevDiff = currScreen - prevScreen;\n        vec2 nextDiff = nextScreen - currScreen;\n        diff = normalize(prevDiff) + normalize(nextDiff);\n    }\n\n    \n    \n    float d = sign(direction);\n    float taper = 1.0;\n    if (TaperPower > 0.0) {\n      \n      float t = clamp(path_proportion - TaperOffset, -0.5, 0.5);\n      float angle = PI * t;\n      taper = pow(cos(angle), TaperPower);\n    }\n    vec2 normal = normalize(vec2(-diff.y, diff.x));\n\n    vec4 offset = vec4(\n        normal * d * taper * LineWidth / 2.0 / aspectVec,\n        0.0,\n        0.0\n    );\n    gl_Position = currPos + offset * currPos.w;\n\n    \n    gl_PointSize = 5.0;\n}";
var projected_line_frag_default = "#version 300 es\n\nprecision mediump float;\n\nlayout (location = 0) out vec4 fragColor;\n\nuniform vec3 LineColor;\n\nvoid main() {\n    fragColor = vec4(LineColor, 1.0);\n}";
var mesh_vert_default = "#version 300 es\n\nlayout (location = 0) in vec3 inPosition;\nlayout (location = 1) in vec3 inNormal;\nlayout (location = 2) in vec2 inUV;\n\nuniform mat4 Projection;\nuniform mat4 ModelView;\n\nout vec2 TexCoords;\n\nvoid main() {\n    TexCoords = inUV;\n    gl_Position = Projection * ModelView * vec4(inPosition, 1.0);\n}";
var scalar_image_frag_default = "#version 300 es\n#pragma inject_defines\n\nprecision mediump float;\n\nlayout (location = 0) out vec4 fragColor;\n\n#if defined TEXTURE_DATA_TYPE_INT\nuniform mediump isampler2D ImageSampler;\n#elif defined TEXTURE_DATA_TYPE_UINT\nuniform mediump usampler2D ImageSampler;\n#else\nuniform mediump sampler2D ImageSampler;\n#endif\n\nuniform vec3 Color;\nuniform float ValueOffset;\nuniform float ValueScale;\nuniform float u_opacity;\n\nin vec2 TexCoords;\n\nvoid main() {\n    float texel = float(texture(ImageSampler, TexCoords).r);\n    float value = (texel + ValueOffset) * ValueScale;\n    fragColor = vec4(value * Color, u_opacity);\n}";
var scalar_image_array_frag_default = "#version 300 es\n#pragma inject_defines\n\nprecision mediump float;\n\nlayout (location = 0) out vec4 fragColor;\n\n#if defined TEXTURE_DATA_TYPE_INT\nuniform mediump isampler2DArray ImageSampler;\n#elif defined TEXTURE_DATA_TYPE_UINT\nuniform mediump usampler2DArray ImageSampler;\n#else\nuniform mediump sampler2DArray ImageSampler;\n#endif\n\n#define MAX_CHANNELS 32\nuniform bool Visible[MAX_CHANNELS];\nuniform vec3 Color[MAX_CHANNELS];\nuniform float ValueOffset[MAX_CHANNELS];\nuniform float ValueScale[MAX_CHANNELS];\nuniform float u_opacity;\n\nin vec2 TexCoords;\n\nvoid main() {\n    vec3 rgbColor = vec3(0, 0, 0);\n    for (int i = 0; i < MAX_CHANNELS; i++) {\n        if (!Visible[i]) continue;\n        float texel = float(texture(ImageSampler, vec3(TexCoords, i)).r);\n        float value = (texel + ValueOffset[i]) * ValueScale[i];\n        \n        \n        value = clamp(value, 0.0, 1.0);\n        rgbColor += value * Color[i];\n    }\n    fragColor = vec4(rgbColor, u_opacity);\n}";
var points_vert_default = "#version 300 es\n\nprecision mediump float;\n\nlayout (location = 0) in vec3 inPosition;\nlayout (location = 7) in vec4 inColor;\nlayout (location = 8) in float inSize;\nlayout (location = 9) in float inMarker;\n\nuniform mat4 Projection;\nuniform mat4 ModelView;\n\nout vec4 color;\nflat out uint marker;\n\nvoid main() {\n    gl_Position = Projection * ModelView * vec4(inPosition, 1.0);\n    gl_PointSize = inSize;\n    color = inColor;\n    marker = uint(inMarker);\n}";
var points_frag_default = "#version 300 es\n\nprecision mediump float;\n\nlayout (location = 0) out vec4 fragColor;\n\nuniform mediump sampler2DArray markerAtlas;\n\nin vec4 color;\nflat in uint marker;\n\nuniform float u_opacity;\n\nvoid main() {\n    float alpha = texture(markerAtlas, vec3(gl_PointCoord, marker)).r;\n    float alpha_threshold = 1e-2;\n    if (alpha < alpha_threshold) {\n        discard;\n    }\n    fragColor = vec4(color.rgb, u_opacity * alpha * color.a);\n}";
var wireframe_vert_default = "#version 300 es\n\nlayout (location = 0) in vec3 inPosition;\nlayout (location = 1) in vec3 inNormal;\n\nuniform mat4 Projection;\nuniform mat4 ModelView;\n\nvoid main() {\n    gl_Position = Projection * ModelView * vec4(inPosition, 1.0);\n}";
var wireframe_frag_default = "#version 300 es\n\nprecision mediump float;\n\nlayout (location = 0) out vec4 fragColor;\n\nuniform float u_opacity;\nuniform vec3 u_color;\n\nvoid main() {\n    fragColor = vec4(u_color, u_opacity);\n}";
var label_image_frag_default = "#version 300 es\n\nprecision mediump float;\nprecision highp int;\n\nlayout (location = 0) out vec4 fragColor;\n\nuniform highp usampler2D ImageSampler;\nuniform mediump sampler2D ColorCycleSampler;\nuniform highp usampler2D ColorLookupTableSampler;\n\nuniform float u_opacity;\nuniform float u_outlineSelected; \nuniform float u_selectedValue;\n\nin vec2 TexCoords;\n\nvec4 unpackRgba(uint packed) {\n    uint r = (packed >> 24u) & 0xFFu;\n    uint g = (packed >> 16u) & 0xFFu;\n    uint b = (packed >> 8u) & 0xFFu;\n    uint a = packed & 0xFFu;\n    return vec4(float(r), float(g), float(b), float(a)) / 255.0;\n}\n\nbool isEdgePixel(uint centerValue) {\n    vec2 texSize = vec2(textureSize(ImageSampler, 0));\n    vec2 texelSize = 1.0 / texSize;\n    \n    \n    for (int dx = -1; dx <= 1; dx++) {\n        for (int dy = -1; dy <= 1; dy++) {\n            if (dx == 0 && dy == 0) continue; \n            \n            vec2 neighborCoords = TexCoords + vec2(float(dx), float(dy)) * texelSize;\n            \n            \n            if (neighborCoords.x < 0.0 || neighborCoords.x > 1.0 || \n                neighborCoords.y < 0.0 || neighborCoords.y > 1.0) {\n                continue;\n            }\n            \n            uint neighborValue = texture(ImageSampler, neighborCoords).r;\n            if (neighborValue != centerValue) {\n                return true;\n            }\n        }\n    }\n    return false;\n}\n\nvoid main() {\n    uint texel = texture(ImageSampler, TexCoords).r;\n    \n    \n    bool isSelectedValue = u_outlineSelected > 0.5 && u_selectedValue >= 0.0 && float(texel) == u_selectedValue;\n    \n    \n    if (isSelectedValue) {\n        if (isEdgePixel(texel)) {\n            \n            fragColor = vec4(1.0, 1.0, 1.0, u_opacity);\n            return;\n        }\n    }\n\n    uint mapLength = uint(textureSize(ColorLookupTableSampler, 0).x);\n    for (uint i = 0u; i < mapLength; ++i) {\n        uint key = texelFetch(ColorLookupTableSampler, ivec2(i, 0), 0).r;\n        if (texel == key) {\n            uint value = texelFetch(ColorLookupTableSampler, ivec2(i, 1), 0).r;\n            vec4 color = unpackRgba(value);\n            \n            \n            float alpha = isSelectedValue ? u_opacity * color.a * 0.9 : u_opacity * color.a;\n            \n            fragColor = vec4(color.rgb, alpha);\n            return;\n        }\n    }\n\n    uint cycleLength = uint(textureSize(ColorCycleSampler, 0).x);\n    uint index = uint(texel - 1u) % cycleLength;\n    vec4 color = texelFetch(ColorCycleSampler, ivec2(index, 0), 0);\n    \n    \n    float alpha = isSelectedValue ? u_opacity * color.a * 0.9 : u_opacity * color.a;\n    \n    fragColor = vec4(color.rgb, alpha);\n}";
const shaderCode = {
  projectedLine: {
    vertex: projected_line_vert_default,
    fragment: projected_line_frag_default
  },
  points: {
    vertex: points_vert_default,
    fragment: points_frag_default
  },
  wireframe: {
    vertex: wireframe_vert_default,
    fragment: wireframe_frag_default
  },
  floatScalarImage: {
    vertex: mesh_vert_default,
    fragment: scalar_image_frag_default
  },
  floatScalarImageArray: {
    vertex: mesh_vert_default,
    fragment: scalar_image_array_frag_default
  },
  intScalarImage: {
    vertex: mesh_vert_default,
    fragment: scalar_image_frag_default,
    fragmentDefines: /* @__PURE__ */ new Map([["TEXTURE_DATA_TYPE_INT", "1"]])
  },
  intScalarImageArray: {
    vertex: mesh_vert_default,
    fragment: scalar_image_array_frag_default,
    fragmentDefines: /* @__PURE__ */ new Map([["TEXTURE_DATA_TYPE_INT", "1"]])
  },
  uintScalarImage: {
    vertex: mesh_vert_default,
    fragment: scalar_image_frag_default,
    fragmentDefines: /* @__PURE__ */ new Map([["TEXTURE_DATA_TYPE_UINT", "1"]])
  },
  uintScalarImageArray: {
    vertex: mesh_vert_default,
    fragment: scalar_image_array_frag_default,
    fragmentDefines: /* @__PURE__ */ new Map([["TEXTURE_DATA_TYPE_UINT", "1"]])
  },
  labelImage: {
    vertex: mesh_vert_default,
    fragment: label_image_frag_default
  }
};
class WebGLShaderProgram {
  gl_;
  program_;
  uniformInfo_ = /* @__PURE__ */ new Map();
  constructor(gl, vertexShaderSource, fragmentShaderSource) {
    this.gl_ = gl;
    const program = gl.createProgram();
    if (!program) {
      throw new Error(`Failed to create WebGL shader program`);
    }
    this.program_ = program;
    const shaders = [];
    try {
      shaders.push(this.addShader(vertexShaderSource, gl.VERTEX_SHADER));
      shaders.push(this.addShader(fragmentShaderSource, gl.FRAGMENT_SHADER));
      this.link();
      this.preprocessUniformLocations();
    } catch (error) {
      gl.deleteProgram(program);
      throw error;
    } finally {
      shaders.forEach((shader) => this.gl_.deleteShader(shader));
    }
  }
  setUniform(name, value) {
    const [location, info] = this.uniformInfo_.get(name) ?? [];
    if (!location || !info) {
      throw new Error(`Uniform "${name}" not found in shader program`);
    }
    const type = info.type;
    switch (type) {
      // There is no dedicated uniform1b in WebGL, but passing through
      // as a float or signed integer works, so fallthrough to float
      // for simplicity.
      case this.gl_.BOOL:
      case this.gl_.FLOAT:
        if (typeof value === "number") {
          this.gl_.uniform1f(location, value);
        } else {
          this.gl_.uniform1fv(location, value);
        }
        break;
      case this.gl_.FLOAT_VEC2:
        this.gl_.uniform2fv(location, value);
        break;
      case this.gl_.FLOAT_VEC3:
        this.gl_.uniform3fv(location, value);
        break;
      case this.gl_.FLOAT_MAT4:
        this.gl_.uniformMatrix4fv(location, false, value);
        break;
      // For samplers, the value is the texture index.
      case this.gl_.SAMPLER_2D:
      case this.gl_.SAMPLER_CUBE:
      case this.gl_.SAMPLER_3D:
      case this.gl_.SAMPLER_2D_ARRAY:
      case this.gl_.SAMPLER_2D_SHADOW:
      case this.gl_.SAMPLER_CUBE_SHADOW:
      case this.gl_.SAMPLER_2D_ARRAY_SHADOW:
      case this.gl_.INT_SAMPLER_2D:
      case this.gl_.INT_SAMPLER_3D:
      case this.gl_.INT_SAMPLER_CUBE:
      case this.gl_.INT_SAMPLER_2D_ARRAY:
      case this.gl_.UNSIGNED_INT_SAMPLER_2D:
      case this.gl_.UNSIGNED_INT_SAMPLER_3D:
      case this.gl_.UNSIGNED_INT_SAMPLER_CUBE:
      case this.gl_.UNSIGNED_INT_SAMPLER_2D_ARRAY:
        this.gl_.uniform1i(location, value);
        break;
      default: {
        const exhaustiveCheck = type;
        throw new Error(`Unhandled uniform type: ${exhaustiveCheck}`);
      }
    }
  }
  preprocessUniformLocations() {
    const numUniforms = this.gl_.getProgramParameter(
      this.program_,
      this.gl_.ACTIVE_UNIFORMS
    );
    for (let i = 0; i < numUniforms; i++) {
      const info = this.gl_.getActiveUniform(this.program_, i);
      if (info) {
        if (!SUPPORTED_UNIFORM_TYPES.has(info.type)) {
          throw new Error(
            `Unsupported uniform type "${info.type}" (GLenum) found in shader program for uniform "${info.name}"`
          );
        }
        const location = this.gl_.getUniformLocation(this.program_, info.name);
        if (location) {
          this.uniformInfo_.set(info.name, [location, info]);
          console.debug("Uniform found:", info.name, info.type, info.size);
        }
      }
    }
  }
  addShader(source, type) {
    const shader = this.gl_.createShader(type);
    if (!shader) {
      throw new Error(`Failed to create a new shader of type ${type}`);
    }
    this.gl_.shaderSource(shader, source);
    this.gl_.compileShader(shader);
    if (!this.gl_.getShaderParameter(shader, this.gl_.COMPILE_STATUS)) {
      const message = this.gl_.getShaderInfoLog(shader);
      this.gl_.deleteShader(shader);
      throw new Error(`Error compiling shader: ${message}`);
    }
    this.gl_.attachShader(this.program_, shader);
    return shader;
  }
  link() {
    this.gl_.linkProgram(this.program_);
    if (!this.getParameter(this.gl_.LINK_STATUS)) {
      const message = this.gl_.getProgramInfoLog(this.program_);
      throw new Error(`Error linking program: ${message}`);
    }
  }
  use() {
    this.gl_.useProgram(this.program_);
  }
  getParameter(parameter) {
    return this.gl_.getProgramParameter(this.program_, parameter);
  }
  get uniformNames() {
    return Array.from(this.uniformInfo_.keys());
  }
}
const SUPPORTED_UNIFORM_TYPES_ = typeof window !== "undefined" ? [
  WebGL2RenderingContext.BOOL,
  WebGL2RenderingContext.FLOAT,
  WebGL2RenderingContext.FLOAT_VEC2,
  WebGL2RenderingContext.FLOAT_VEC3,
  WebGL2RenderingContext.FLOAT_MAT4,
  WebGL2RenderingContext.SAMPLER_2D,
  WebGL2RenderingContext.SAMPLER_CUBE,
  WebGL2RenderingContext.SAMPLER_3D,
  WebGL2RenderingContext.SAMPLER_2D_ARRAY,
  WebGL2RenderingContext.SAMPLER_2D_SHADOW,
  WebGL2RenderingContext.SAMPLER_CUBE_SHADOW,
  WebGL2RenderingContext.SAMPLER_2D_ARRAY_SHADOW,
  WebGL2RenderingContext.INT_SAMPLER_2D,
  WebGL2RenderingContext.INT_SAMPLER_3D,
  WebGL2RenderingContext.INT_SAMPLER_CUBE,
  WebGL2RenderingContext.INT_SAMPLER_2D_ARRAY,
  WebGL2RenderingContext.UNSIGNED_INT_SAMPLER_2D,
  WebGL2RenderingContext.UNSIGNED_INT_SAMPLER_3D,
  WebGL2RenderingContext.UNSIGNED_INT_SAMPLER_CUBE,
  WebGL2RenderingContext.UNSIGNED_INT_SAMPLER_2D_ARRAY
] : [];
const SUPPORTED_UNIFORM_TYPES = new Set(
  SUPPORTED_UNIFORM_TYPES_
);
const pragmaInjectDefines = "#pragma inject_defines";
class WebGLShaderPrograms {
  gl_;
  programs_ = /* @__PURE__ */ new Map();
  constructor(gl) {
    this.gl_ = gl;
  }
  use(shader) {
    let program = this.programs_.get(shader);
    if (program === void 0) {
      const code = shaderCode[shader];
      const vertexShaderSource = replaceSourceDefines(
        code.vertex,
        code.vertexDefines
      );
      const fragmentShaderSource = replaceSourceDefines(
        code.fragment,
        code.fragmentDefines
      );
      program = new WebGLShaderProgram(
        this.gl_,
        vertexShaderSource,
        fragmentShaderSource
      );
      program.use();
      const error = this.gl_.getError();
      if (error !== this.gl_.NO_ERROR) {
        throw new Error(`Error using WebGL program: ${error}`);
      }
      this.programs_.set(shader, program);
    } else {
      program.use();
    }
    return program;
  }
}
function replaceSourceDefines(source, defines) {
  if (defines === void 0 || defines.size == 0) return source;
  if (!source.includes(pragmaInjectDefines)) {
    throw new Error(
      `Shader source does not contain "${pragmaInjectDefines}" directive`
    );
  }
  const definesSource = Array(defines.entries()).map(([key, value]) => `#define ${key} ${value}`).join("\n");
  const lineNumberOffset = 1 - defines.size;
  const nextLineNumber = `#line __LINE__ + ${lineNumberOffset}`;
  const sourceToInject = `${definesSource}
${nextLineNumber}`;
  return source.replace(pragmaInjectDefines, sourceToInject);
}
const lut = [
  "00",
  "01",
  "02",
  "03",
  "04",
  "05",
  "06",
  "07",
  "08",
  "09",
  "0a",
  "0b",
  "0c",
  "0d",
  "0e",
  "0f",
  "10",
  "11",
  "12",
  "13",
  "14",
  "15",
  "16",
  "17",
  "18",
  "19",
  "1a",
  "1b",
  "1c",
  "1d",
  "1e",
  "1f",
  "20",
  "21",
  "22",
  "23",
  "24",
  "25",
  "26",
  "27",
  "28",
  "29",
  "2a",
  "2b",
  "2c",
  "2d",
  "2e",
  "2f",
  "30",
  "31",
  "32",
  "33",
  "34",
  "35",
  "36",
  "37",
  "38",
  "39",
  "3a",
  "3b",
  "3c",
  "3d",
  "3e",
  "3f",
  "40",
  "41",
  "42",
  "43",
  "44",
  "45",
  "46",
  "47",
  "48",
  "49",
  "4a",
  "4b",
  "4c",
  "4d",
  "4e",
  "4f",
  "50",
  "51",
  "52",
  "53",
  "54",
  "55",
  "56",
  "57",
  "58",
  "59",
  "5a",
  "5b",
  "5c",
  "5d",
  "5e",
  "5f",
  "60",
  "61",
  "62",
  "63",
  "64",
  "65",
  "66",
  "67",
  "68",
  "69",
  "6a",
  "6b",
  "6c",
  "6d",
  "6e",
  "6f",
  "70",
  "71",
  "72",
  "73",
  "74",
  "75",
  "76",
  "77",
  "78",
  "79",
  "7a",
  "7b",
  "7c",
  "7d",
  "7e",
  "7f",
  "80",
  "81",
  "82",
  "83",
  "84",
  "85",
  "86",
  "87",
  "88",
  "89",
  "8a",
  "8b",
  "8c",
  "8d",
  "8e",
  "8f",
  "90",
  "91",
  "92",
  "93",
  "94",
  "95",
  "96",
  "97",
  "98",
  "99",
  "9a",
  "9b",
  "9c",
  "9d",
  "9e",
  "9f",
  "a0",
  "a1",
  "a2",
  "a3",
  "a4",
  "a5",
  "a6",
  "a7",
  "a8",
  "a9",
  "aa",
  "ab",
  "ac",
  "ad",
  "ae",
  "af",
  "b0",
  "b1",
  "b2",
  "b3",
  "b4",
  "b5",
  "b6",
  "b7",
  "b8",
  "b9",
  "ba",
  "bb",
  "bc",
  "bd",
  "be",
  "bf",
  "c0",
  "c1",
  "c2",
  "c3",
  "c4",
  "c5",
  "c6",
  "c7",
  "c8",
  "c9",
  "ca",
  "cb",
  "cc",
  "cd",
  "ce",
  "cf",
  "d0",
  "d1",
  "d2",
  "d3",
  "d4",
  "d5",
  "d6",
  "d7",
  "d8",
  "d9",
  "da",
  "db",
  "dc",
  "dd",
  "de",
  "df",
  "e0",
  "e1",
  "e2",
  "e3",
  "e4",
  "e5",
  "e6",
  "e7",
  "e8",
  "e9",
  "ea",
  "eb",
  "ec",
  "ed",
  "ee",
  "ef",
  "f0",
  "f1",
  "f2",
  "f3",
  "f4",
  "f5",
  "f6",
  "f7",
  "f8",
  "f9",
  "fa",
  "fb",
  "fc",
  "fd",
  "fe",
  "ff"
];
function generateUUID() {
  const d0 = Math.random() * 4294967295 | 0;
  const d1 = Math.random() * 4294967295 | 0;
  const d2 = Math.random() * 4294967295 | 0;
  const d3 = Math.random() * 4294967295 | 0;
  const uuid = lut[d0 & 255] + lut[d0 >> 8 & 255] + lut[d0 >> 16 & 255] + lut[d0 >> 24 & 255] + "-" + lut[d1 & 255] + lut[d1 >> 8 & 255] + "-" + lut[d1 >> 16 & 15 | 64] + lut[d1 >> 24 & 255] + "-" + lut[d2 & 63 | 128] + lut[d2 >> 8 & 255] + "-" + lut[d2 >> 16 & 255] + lut[d2 >> 24 & 255] + lut[d3 & 255] + lut[d3 >> 8 & 255] + lut[d3 >> 16 & 255] + lut[d3 >> 24 & 255];
  return uuid.toLowerCase();
}
class Node {
  uuid = generateUUID();
}
const GeometryAttributeIndex = {
  position: 0,
  normal: 1,
  uv: 2,
  next_position: 3,
  previous_position: 4,
  direction: 5,
  path_proportion: 6,
  color: 7,
  size: 8,
  marker: 9
};
class Geometry extends Node {
  primitive_;
  attributes_;
  vertexData_;
  indexData_;
  constructor(vertexData = [], indexData = [], primitive = "triangles") {
    super();
    this.vertexData_ = new Float32Array(vertexData);
    this.indexData_ = new Uint32Array(indexData);
    this.primitive_ = primitive;
    this.attributes_ = [];
  }
  addAttribute(attr) {
    this.attributes_.push(attr);
  }
  get vertexCount() {
    return this.vertexData_.byteLength / this.stride;
  }
  get stride() {
    return this.attributes_.reduce((acc, curr) => {
      return acc + curr.itemSize;
    }, 0) * Float32Array.BYTES_PER_ELEMENT;
  }
  get primitive() {
    return this.primitive_;
  }
  get vertexData() {
    return this.vertexData_;
  }
  get indexData() {
    return this.indexData_;
  }
  get attributes() {
    return this.attributes_;
  }
  get type() {
    return "Geometry";
  }
}
class WebGLBuffers {
  gl_;
  buffers_ = /* @__PURE__ */ new Map();
  currentGeometry_ = null;
  constructor(gl) {
    this.gl_ = gl;
  }
  bindGeometry(geometry) {
    if (this.alreadyActive(geometry)) return;
    if (!this.buffers_.has(geometry)) {
      this.generateBuffers(geometry);
    }
    const buffers = this.buffers_.get(geometry);
    if (!buffers) {
      throw new Error("Failed to retrieve buffer handles for object");
    }
    this.gl_.bindVertexArray(buffers.vao);
    this.currentGeometry_ = geometry;
  }
  disposeObject(geometry) {
    const buffers = this.buffers_.get(geometry);
    if (!buffers) return;
    this.gl_.deleteVertexArray(buffers.vao);
    this.gl_.deleteBuffer(buffers.vbo);
    if (buffers.ebo) this.gl_.deleteBuffer(buffers.ebo);
    this.buffers_.delete(geometry);
    if (this.currentGeometry_ === geometry) {
      this.currentGeometry_ = null;
    }
  }
  disposeAll() {
    for (const geometry of this.buffers_.keys()) {
      this.disposeObject(geometry);
    }
  }
  alreadyActive(geometry) {
    return this.currentGeometry_ === geometry;
  }
  generateBuffers(geometry) {
    const vao = this.gl_.createVertexArray();
    if (!vao) {
      throw new Error("Failed to create vertex array object (VAO)");
    }
    this.gl_.bindVertexArray(vao);
    const { vertexData } = geometry;
    const vboType = this.gl_.ARRAY_BUFFER;
    const vbo = this.gl_.createBuffer();
    if (!vbo) throw new Error("Failed to create vertex buffer (VBO)");
    this.gl_.bindBuffer(vboType, vbo);
    this.gl_.bufferData(vboType, vertexData, this.gl_.STATIC_DRAW);
    const { attributes, stride } = geometry;
    attributes.forEach((attr) => {
      const idx = GeometryAttributeIndex[attr.type];
      this.gl_.vertexAttribPointer(
        idx,
        attr.itemSize,
        this.gl_.FLOAT,
        false,
        stride,
        attr.offset
      );
      this.gl_.enableVertexAttribArray(idx);
    });
    const buffers = { vao, vbo };
    const { indexData } = geometry;
    if (indexData.length) {
      const eboType = this.gl_.ELEMENT_ARRAY_BUFFER;
      const ebo = this.gl_.createBuffer();
      if (!ebo) throw new Error("Failed to create index buffer (EBO)");
      this.gl_.bindBuffer(eboType, ebo);
      this.gl_.bufferData(eboType, indexData, this.gl_.STATIC_DRAW);
      buffers.ebo = ebo;
    }
    this.buffers_.set(geometry, buffers);
    this.gl_.bindVertexArray(null);
  }
}
class WebGLTextures {
  gl_;
  textures_ = /* @__PURE__ */ new Map();
  currentTexture_ = null;
  maxTextureUnits_;
  gpuTextureBytes_ = 0;
  textureCount_ = 0;
  constructor(gl) {
    this.gl_ = gl;
    this.maxTextureUnits_ = gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS);
  }
  bindTexture(texture, index) {
    if (this.alreadyActive(texture)) return;
    if (index < 0 || index >= this.maxTextureUnits_) {
      throw new Error(
        `Texture index ${index} must be in [0, ${this.maxTextureUnits_ - 1}]`
      );
    }
    this.gl_.activeTexture(this.gl_.TEXTURE0 + index);
    const textureType = this.getTextureType(texture);
    const info = this.getDataFormatInfo(texture.dataFormat, texture.dataType);
    if (!this.textures_.has(texture)) {
      this.generateTexture(texture, info, textureType);
    }
    const textureId = this.textures_.get(texture);
    if (!textureId) {
      throw new Error("Failed to retrieve texture ID");
    }
    this.gl_.bindTexture(textureType, textureId);
    if (texture.needsUpdate && texture.data !== null) {
      this.configureTextureParameters(texture, textureType);
      this.uploadTextureData(texture, info, textureType);
      texture.needsUpdate = false;
    }
    this.currentTexture_ = texture;
  }
  disposeTexture(texture) {
    const id = this.textures_.get(texture);
    if (id) {
      this.gl_.deleteTexture(id);
      this.textures_.delete(texture);
      if (this.currentTexture_ === texture) {
        this.currentTexture_ = null;
      }
      const info = this.getDataFormatInfo(texture.dataFormat, texture.dataType);
      const bytes = this.computeStorageBytes(texture, info);
      this.gpuTextureBytes_ = Math.max(0, this.gpuTextureBytes_ - bytes);
      this.textureCount_ = Math.max(0, this.textureCount_ - 1);
    }
  }
  disposeAll() {
    for (const texture of Array.from(this.textures_.keys())) {
      this.disposeTexture(texture);
    }
    this.gpuTextureBytes_ = 0;
    this.textureCount_ = 0;
  }
  get textureInfo() {
    return {
      textures: this.textureCount_,
      totalBytes: this.gpuTextureBytes_
    };
  }
  alreadyActive(texture) {
    return this.currentTexture_ === texture && !texture.needsUpdate;
  }
  generateTexture(texture, info, type) {
    const textureId = this.gl_.createTexture();
    if (!textureId) throw new Error("Failed to create texture");
    this.gl_.bindTexture(type, textureId);
    if (this.isTexture2D(texture)) {
      this.gl_.texStorage2D(
        type,
        texture.mipmapLevels,
        info.internalFormat,
        texture.width,
        texture.height
      );
    } else if (this.isTexture2DArray(texture)) {
      this.gl_.texStorage3D(
        type,
        texture.mipmapLevels,
        info.internalFormat,
        texture.width,
        texture.height,
        texture.depth
      );
    } else {
      throw new Error(`Unknown texture type ${texture.type}`);
    }
    this.gpuTextureBytes_ += this.computeStorageBytes(texture, info);
    this.textureCount_ += 1;
    this.textures_.set(texture, textureId);
    this.gl_.bindTexture(type, null);
  }
  configureTextureParameters(texture, type) {
    const gl = this.gl_;
    const minFilter = this.getFilter(texture.minFilter, texture);
    const maxFilter = this.getFilter(texture.maxFilter, texture);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, texture.unpackAlignment);
    gl.pixelStorei(gl.UNPACK_ROW_LENGTH, texture.unpackRowLength);
    gl.texParameteri(type, gl.TEXTURE_MIN_FILTER, minFilter);
    gl.texParameteri(type, gl.TEXTURE_MAG_FILTER, maxFilter);
    gl.texParameteri(type, gl.TEXTURE_WRAP_S, this.getWrapMode(texture.wrapS));
    gl.texParameteri(type, gl.TEXTURE_WRAP_T, this.getWrapMode(texture.wrapT));
    gl.texParameteri(type, gl.TEXTURE_WRAP_R, this.getWrapMode(texture.wrapR));
  }
  uploadTextureData(texture, info, type) {
    const mipmapLevel = 0;
    const offset = { x: 0, y: 0, z: 0 };
    if (this.isTexture2D(texture)) {
      this.gl_.texSubImage2D(
        type,
        mipmapLevel,
        offset.x,
        offset.y,
        texture.width,
        texture.height,
        info.format,
        info.type,
        // This function has multiple overloads. We are temporarily casting it to
        // ArrayBufferView to ensure the correct overload is called. Once we
        // consolidate Texture2D and DataTexture2D, we can remove this cast.
        // https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext/texSubImage2D#syntax
        texture.data
      );
    } else if (this.isTexture2DArray(texture)) {
      this.gl_.texSubImage3D(
        type,
        mipmapLevel,
        offset.x,
        offset.y,
        offset.z,
        texture.width,
        texture.height,
        texture.depth,
        info.format,
        info.type,
        texture.data
      );
    } else {
      throw new Error(
        "Attempting to upload data for an unsupported texture type"
      );
    }
  }
  getFilter(filter, texture) {
    const { dataFormat, dataType } = texture;
    if (dataFormat === "scalar" && dataType !== "float" && filter !== "nearest") {
      Logger.warn(
        "WebGLTexture",
        "Integer values are not filterable. Using gl.NEAREST instead."
      );
      return this.gl_.NEAREST;
    }
    switch (filter) {
      case "nearest":
        return this.gl_.NEAREST;
      case "linear":
        return this.gl_.LINEAR;
      default:
        throw new Error(`Unsupported texture filter: ${filter}`);
    }
  }
  getTextureType(texture) {
    if (this.isTexture2D(texture)) return this.gl_.TEXTURE_2D;
    if (this.isTexture2DArray(texture)) return this.gl_.TEXTURE_2D_ARRAY;
    throw new Error(`Unknown texture type ${texture.type}`);
  }
  getWrapMode(mode) {
    switch (mode) {
      case "repeat":
        return this.gl_.REPEAT;
      case "clamp_to_edge":
        return this.gl_.CLAMP_TO_EDGE;
      default:
        throw new Error(`Unsupported wrap mode: ${mode}`);
    }
  }
  getDataFormatInfo(format, type) {
    if (format === "rgba" && type === "unsigned_byte") {
      return {
        internalFormat: this.gl_.RGBA8,
        format: this.gl_.RGBA,
        type: this.gl_.UNSIGNED_BYTE
      };
    }
    if (format === "rgb" && type === "unsigned_byte") {
      return {
        internalFormat: this.gl_.RGB8,
        format: this.gl_.RGB,
        type: this.gl_.UNSIGNED_BYTE
      };
    }
    if (format === "scalar") {
      switch (type) {
        case "byte":
          return {
            internalFormat: this.gl_.R8I,
            format: this.gl_.RED_INTEGER,
            type: this.gl_.BYTE
          };
        case "short":
          return {
            internalFormat: this.gl_.R16I,
            format: this.gl_.RED_INTEGER,
            type: this.gl_.SHORT
          };
        case "int":
          return {
            internalFormat: this.gl_.R32I,
            format: this.gl_.RED_INTEGER,
            type: this.gl_.INT
          };
        case "unsigned_byte":
          return {
            internalFormat: this.gl_.R8UI,
            format: this.gl_.RED_INTEGER,
            type: this.gl_.UNSIGNED_BYTE
          };
        case "unsigned_short":
          return {
            internalFormat: this.gl_.R16UI,
            format: this.gl_.RED_INTEGER,
            type: this.gl_.UNSIGNED_SHORT
          };
        case "unsigned_int":
          return {
            internalFormat: this.gl_.R32UI,
            format: this.gl_.RED_INTEGER,
            type: this.gl_.UNSIGNED_INT
          };
        case "float":
          return {
            internalFormat: this.gl_.R32F,
            format: this.gl_.RED,
            type: this.gl_.FLOAT
          };
        default:
          throw new Error(`Unsupported scalar type: ${type}`);
      }
    }
    throw new Error(`Unsupported format/type: ${format}/${type}`);
  }
  computeStorageBytes(texture, info) {
    const bytes = this.bytesPerTexel(info);
    const levels = Math.max(1, texture.mipmapLevels);
    const depth = this.isTexture2DArray(texture) ? Math.max(1, texture.depth) : 1;
    let width = Math.max(1, texture.width);
    let height = Math.max(1, texture.height);
    let total = 0;
    for (let level = 0; level < levels; level++) {
      total += width * height * depth * bytes;
      width = Math.max(1, width >> 1);
      height = Math.max(1, height >> 1);
    }
    return total;
  }
  bytesPerTexel(info) {
    const gl = this.gl_;
    if (info.format === gl.RGB && info.type === gl.UNSIGNED_BYTE) return 3;
    if (info.format === gl.RGBA && info.type === gl.UNSIGNED_BYTE) return 4;
    if (info.format === gl.RED_INTEGER) {
      switch (info.type) {
        case gl.BYTE:
        case gl.UNSIGNED_BYTE:
          return 1;
        case gl.SHORT:
        case gl.UNSIGNED_SHORT:
          return 2;
        case gl.INT:
        case gl.UNSIGNED_INT:
          return 4;
      }
    }
    if (info.format === gl.RED && info.type === gl.FLOAT) return 4;
    throw new Error("bytesPerTexel: unsupported format/type");
  }
  isTexture2D(texture) {
    return texture.type === "Texture2D";
  }
  isTexture2DArray(texture) {
    return texture.type === "Texture2DArray";
  }
}
var EPSILON = 1e-6;
var ARRAY_TYPE = typeof Float32Array !== "undefined" ? Float32Array : Array;
var degree = Math.PI / 180;
function toRadian(a) {
  return a * degree;
}
if (!Math.hypot) Math.hypot = function() {
  var y = 0, i = arguments.length;
  while (i--) {
    y += arguments[i] * arguments[i];
  }
  return Math.sqrt(y);
};
function create$5() {
  var out = new ARRAY_TYPE(9);
  if (ARRAY_TYPE != Float32Array) {
    out[1] = 0;
    out[2] = 0;
    out[3] = 0;
    out[5] = 0;
    out[6] = 0;
    out[7] = 0;
  }
  out[0] = 1;
  out[4] = 1;
  out[8] = 1;
  return out;
}
function create$4() {
  var out = new ARRAY_TYPE(16);
  if (ARRAY_TYPE != Float32Array) {
    out[1] = 0;
    out[2] = 0;
    out[3] = 0;
    out[4] = 0;
    out[6] = 0;
    out[7] = 0;
    out[8] = 0;
    out[9] = 0;
    out[11] = 0;
    out[12] = 0;
    out[13] = 0;
    out[14] = 0;
  }
  out[0] = 1;
  out[5] = 1;
  out[10] = 1;
  out[15] = 1;
  return out;
}
function invert(out, a) {
  var a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
  var a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
  var a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
  var a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
  var b00 = a00 * a11 - a01 * a10;
  var b01 = a00 * a12 - a02 * a10;
  var b02 = a00 * a13 - a03 * a10;
  var b03 = a01 * a12 - a02 * a11;
  var b04 = a01 * a13 - a03 * a11;
  var b05 = a02 * a13 - a03 * a12;
  var b06 = a20 * a31 - a21 * a30;
  var b07 = a20 * a32 - a22 * a30;
  var b08 = a20 * a33 - a23 * a30;
  var b09 = a21 * a32 - a22 * a31;
  var b10 = a21 * a33 - a23 * a31;
  var b11 = a22 * a33 - a23 * a32;
  var det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
  if (!det) {
    return null;
  }
  det = 1 / det;
  out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
  out[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
  out[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
  out[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
  out[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
  out[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
  out[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
  out[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
  out[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
  out[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
  out[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
  out[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
  out[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det;
  out[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
  out[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det;
  out[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;
  return out;
}
function multiply$2(out, a, b) {
  var a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
  var a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
  var a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
  var a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
  var b0 = b[0], b1 = b[1], b2 = b[2], b3 = b[3];
  out[0] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
  out[1] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
  out[2] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
  out[3] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
  b0 = b[4];
  b1 = b[5];
  b2 = b[6];
  b3 = b[7];
  out[4] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
  out[5] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
  out[6] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
  out[7] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
  b0 = b[8];
  b1 = b[9];
  b2 = b[10];
  b3 = b[11];
  out[8] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
  out[9] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
  out[10] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
  out[11] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
  b0 = b[12];
  b1 = b[13];
  b2 = b[14];
  b3 = b[15];
  out[12] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
  out[13] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
  out[14] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
  out[15] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
  return out;
}
function fromScaling(out, v) {
  out[0] = v[0];
  out[1] = 0;
  out[2] = 0;
  out[3] = 0;
  out[4] = 0;
  out[5] = v[1];
  out[6] = 0;
  out[7] = 0;
  out[8] = 0;
  out[9] = 0;
  out[10] = v[2];
  out[11] = 0;
  out[12] = 0;
  out[13] = 0;
  out[14] = 0;
  out[15] = 1;
  return out;
}
function fromRotationTranslationScale(out, q, v, s) {
  var x = q[0], y = q[1], z2 = q[2], w = q[3];
  var x2 = x + x;
  var y2 = y + y;
  var z22 = z2 + z2;
  var xx = x * x2;
  var xy = x * y2;
  var xz = x * z22;
  var yy = y * y2;
  var yz = y * z22;
  var zz = z2 * z22;
  var wx = w * x2;
  var wy = w * y2;
  var wz = w * z22;
  var sx = s[0];
  var sy = s[1];
  var sz = s[2];
  out[0] = (1 - (yy + zz)) * sx;
  out[1] = (xy + wz) * sx;
  out[2] = (xz - wy) * sx;
  out[3] = 0;
  out[4] = (xy - wz) * sy;
  out[5] = (1 - (xx + zz)) * sy;
  out[6] = (yz + wx) * sy;
  out[7] = 0;
  out[8] = (xz + wy) * sz;
  out[9] = (yz - wx) * sz;
  out[10] = (1 - (xx + yy)) * sz;
  out[11] = 0;
  out[12] = v[0];
  out[13] = v[1];
  out[14] = v[2];
  out[15] = 1;
  return out;
}
function perspectiveNO(out, fovy, aspect, near, far) {
  var f = 1 / Math.tan(fovy / 2), nf;
  out[0] = f / aspect;
  out[1] = 0;
  out[2] = 0;
  out[3] = 0;
  out[4] = 0;
  out[5] = f;
  out[6] = 0;
  out[7] = 0;
  out[8] = 0;
  out[9] = 0;
  out[11] = -1;
  out[12] = 0;
  out[13] = 0;
  out[15] = 0;
  if (far != null && far !== Infinity) {
    nf = 1 / (near - far);
    out[10] = (far + near) * nf;
    out[14] = 2 * far * near * nf;
  } else {
    out[10] = -1;
    out[14] = -2 * near;
  }
  return out;
}
var perspective = perspectiveNO;
function orthoNO(out, left, right, bottom, top, near, far) {
  var lr = 1 / (left - right);
  var bt = 1 / (bottom - top);
  var nf = 1 / (near - far);
  out[0] = -2 * lr;
  out[1] = 0;
  out[2] = 0;
  out[3] = 0;
  out[4] = 0;
  out[5] = -2 * bt;
  out[6] = 0;
  out[7] = 0;
  out[8] = 0;
  out[9] = 0;
  out[10] = 2 * nf;
  out[11] = 0;
  out[12] = (left + right) * lr;
  out[13] = (top + bottom) * bt;
  out[14] = (far + near) * nf;
  out[15] = 1;
  return out;
}
var ortho = orthoNO;
function create$3() {
  var out = new ARRAY_TYPE(3);
  if (ARRAY_TYPE != Float32Array) {
    out[0] = 0;
    out[1] = 0;
    out[2] = 0;
  }
  return out;
}
function clone$3(a) {
  var out = new ARRAY_TYPE(3);
  out[0] = a[0];
  out[1] = a[1];
  out[2] = a[2];
  return out;
}
function length(a) {
  var x = a[0];
  var y = a[1];
  var z2 = a[2];
  return Math.hypot(x, y, z2);
}
function fromValues$2(x, y, z2) {
  var out = new ARRAY_TYPE(3);
  out[0] = x;
  out[1] = y;
  out[2] = z2;
  return out;
}
function copy$2(out, a) {
  out[0] = a[0];
  out[1] = a[1];
  out[2] = a[2];
  return out;
}
function add(out, a, b) {
  out[0] = a[0] + b[0];
  out[1] = a[1] + b[1];
  out[2] = a[2] + b[2];
  return out;
}
function subtract(out, a, b) {
  out[0] = a[0] - b[0];
  out[1] = a[1] - b[1];
  out[2] = a[2] - b[2];
  return out;
}
function multiply$1(out, a, b) {
  out[0] = a[0] * b[0];
  out[1] = a[1] * b[1];
  out[2] = a[2] * b[2];
  return out;
}
function scale$1(out, a, b) {
  out[0] = a[0] * b;
  out[1] = a[1] * b;
  out[2] = a[2] * b;
  return out;
}
function scaleAndAdd(out, a, b, scale2) {
  out[0] = a[0] + b[0] * scale2;
  out[1] = a[1] + b[1] * scale2;
  out[2] = a[2] + b[2] * scale2;
  return out;
}
function distance$1(a, b) {
  var x = b[0] - a[0];
  var y = b[1] - a[1];
  var z2 = b[2] - a[2];
  return Math.hypot(x, y, z2);
}
function normalize$2(out, a) {
  var x = a[0];
  var y = a[1];
  var z2 = a[2];
  var len2 = x * x + y * y + z2 * z2;
  if (len2 > 0) {
    len2 = 1 / Math.sqrt(len2);
  }
  out[0] = a[0] * len2;
  out[1] = a[1] * len2;
  out[2] = a[2] * len2;
  return out;
}
function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
function cross(out, a, b) {
  var ax = a[0], ay = a[1], az = a[2];
  var bx = b[0], by = b[1], bz = b[2];
  out[0] = ay * bz - az * by;
  out[1] = az * bx - ax * bz;
  out[2] = ax * by - ay * bx;
  return out;
}
function bezier(out, a, b, c, d, t) {
  var inverseFactor = 1 - t;
  var inverseFactorTimesTwo = inverseFactor * inverseFactor;
  var factorTimes2 = t * t;
  var factor1 = inverseFactorTimesTwo * inverseFactor;
  var factor2 = 3 * t * inverseFactorTimesTwo;
  var factor3 = 3 * factorTimes2 * inverseFactor;
  var factor4 = factorTimes2 * t;
  out[0] = a[0] * factor1 + b[0] * factor2 + c[0] * factor3 + d[0] * factor4;
  out[1] = a[1] * factor1 + b[1] * factor2 + c[1] * factor3 + d[1] * factor4;
  out[2] = a[2] * factor1 + b[2] * factor2 + c[2] * factor3 + d[2] * factor4;
  return out;
}
function transformMat4$1(out, a, m) {
  var x = a[0], y = a[1], z2 = a[2];
  var w = m[3] * x + m[7] * y + m[11] * z2 + m[15];
  w = w || 1;
  out[0] = (m[0] * x + m[4] * y + m[8] * z2 + m[12]) / w;
  out[1] = (m[1] * x + m[5] * y + m[9] * z2 + m[13]) / w;
  out[2] = (m[2] * x + m[6] * y + m[10] * z2 + m[14]) / w;
  return out;
}
var sub = subtract;
var len = length;
(function() {
  var vec = create$3();
  return function(a, stride, offset, count, fn, arg) {
    var i, l;
    if (!stride) {
      stride = 3;
    }
    if (!offset) {
      offset = 0;
    }
    if (count) {
      l = Math.min(count * stride + offset, a.length);
    } else {
      l = a.length;
    }
    for (i = offset; i < l; i += stride) {
      vec[0] = a[i];
      vec[1] = a[i + 1];
      vec[2] = a[i + 2];
      fn(vec, vec, arg);
      a[i] = vec[0];
      a[i + 1] = vec[1];
      a[i + 2] = vec[2];
    }
    return a;
  };
})();
function create$2() {
  var out = new ARRAY_TYPE(4);
  if (ARRAY_TYPE != Float32Array) {
    out[0] = 0;
    out[1] = 0;
    out[2] = 0;
    out[3] = 0;
  }
  return out;
}
function clone$2(a) {
  var out = new ARRAY_TYPE(4);
  out[0] = a[0];
  out[1] = a[1];
  out[2] = a[2];
  out[3] = a[3];
  return out;
}
function fromValues$1(x, y, z2, w) {
  var out = new ARRAY_TYPE(4);
  out[0] = x;
  out[1] = y;
  out[2] = z2;
  out[3] = w;
  return out;
}
function copy$1(out, a) {
  out[0] = a[0];
  out[1] = a[1];
  out[2] = a[2];
  out[3] = a[3];
  return out;
}
function scale(out, a, b) {
  out[0] = a[0] * b;
  out[1] = a[1] * b;
  out[2] = a[2] * b;
  out[3] = a[3] * b;
  return out;
}
function normalize$1(out, a) {
  var x = a[0];
  var y = a[1];
  var z2 = a[2];
  var w = a[3];
  var len2 = x * x + y * y + z2 * z2 + w * w;
  if (len2 > 0) {
    len2 = 1 / Math.sqrt(len2);
  }
  out[0] = x * len2;
  out[1] = y * len2;
  out[2] = z2 * len2;
  out[3] = w * len2;
  return out;
}
function transformMat4(out, a, m) {
  var x = a[0], y = a[1], z2 = a[2], w = a[3];
  out[0] = m[0] * x + m[4] * y + m[8] * z2 + m[12] * w;
  out[1] = m[1] * x + m[5] * y + m[9] * z2 + m[13] * w;
  out[2] = m[2] * x + m[6] * y + m[10] * z2 + m[14] * w;
  out[3] = m[3] * x + m[7] * y + m[11] * z2 + m[15] * w;
  return out;
}
(function() {
  var vec = create$2();
  return function(a, stride, offset, count, fn, arg) {
    var i, l;
    if (!stride) {
      stride = 4;
    }
    if (!offset) {
      offset = 0;
    }
    if (count) {
      l = Math.min(count * stride + offset, a.length);
    } else {
      l = a.length;
    }
    for (i = offset; i < l; i += stride) {
      vec[0] = a[i];
      vec[1] = a[i + 1];
      vec[2] = a[i + 2];
      vec[3] = a[i + 3];
      fn(vec, vec, arg);
      a[i] = vec[0];
      a[i + 1] = vec[1];
      a[i + 2] = vec[2];
      a[i + 3] = vec[3];
    }
    return a;
  };
})();
function create$1() {
  var out = new ARRAY_TYPE(4);
  if (ARRAY_TYPE != Float32Array) {
    out[0] = 0;
    out[1] = 0;
    out[2] = 0;
  }
  out[3] = 1;
  return out;
}
function setAxisAngle(out, axis, rad) {
  rad = rad * 0.5;
  var s = Math.sin(rad);
  out[0] = s * axis[0];
  out[1] = s * axis[1];
  out[2] = s * axis[2];
  out[3] = Math.cos(rad);
  return out;
}
function multiply(out, a, b) {
  var ax = a[0], ay = a[1], az = a[2], aw = a[3];
  var bx = b[0], by = b[1], bz = b[2], bw = b[3];
  out[0] = ax * bw + aw * bx + ay * bz - az * by;
  out[1] = ay * bw + aw * by + az * bx - ax * bz;
  out[2] = az * bw + aw * bz + ax * by - ay * bx;
  out[3] = aw * bw - ax * bx - ay * by - az * bz;
  return out;
}
function slerp(out, a, b, t) {
  var ax = a[0], ay = a[1], az = a[2], aw = a[3];
  var bx = b[0], by = b[1], bz = b[2], bw = b[3];
  var omega, cosom, sinom, scale0, scale1;
  cosom = ax * bx + ay * by + az * bz + aw * bw;
  if (cosom < 0) {
    cosom = -cosom;
    bx = -bx;
    by = -by;
    bz = -bz;
    bw = -bw;
  }
  if (1 - cosom > EPSILON) {
    omega = Math.acos(cosom);
    sinom = Math.sin(omega);
    scale0 = Math.sin((1 - t) * omega) / sinom;
    scale1 = Math.sin(t * omega) / sinom;
  } else {
    scale0 = 1 - t;
    scale1 = t;
  }
  out[0] = scale0 * ax + scale1 * bx;
  out[1] = scale0 * ay + scale1 * by;
  out[2] = scale0 * az + scale1 * bz;
  out[3] = scale0 * aw + scale1 * bw;
  return out;
}
function fromMat3(out, m) {
  var fTrace = m[0] + m[4] + m[8];
  var fRoot;
  if (fTrace > 0) {
    fRoot = Math.sqrt(fTrace + 1);
    out[3] = 0.5 * fRoot;
    fRoot = 0.5 / fRoot;
    out[0] = (m[5] - m[7]) * fRoot;
    out[1] = (m[6] - m[2]) * fRoot;
    out[2] = (m[1] - m[3]) * fRoot;
  } else {
    var i = 0;
    if (m[4] > m[0]) i = 1;
    if (m[8] > m[i * 3 + i]) i = 2;
    var j = (i + 1) % 3;
    var k = (i + 2) % 3;
    fRoot = Math.sqrt(m[i * 3 + i] - m[j * 3 + j] - m[k * 3 + k] + 1);
    out[i] = 0.5 * fRoot;
    fRoot = 0.5 / fRoot;
    out[3] = (m[j * 3 + k] - m[k * 3 + j]) * fRoot;
    out[j] = (m[j * 3 + i] + m[i * 3 + j]) * fRoot;
    out[k] = (m[k * 3 + i] + m[i * 3 + k]) * fRoot;
  }
  return out;
}
var clone$1 = clone$2;
var copy = copy$1;
var normalize = normalize$1;
(function() {
  var tmpvec3 = create$3();
  var xUnitVec3 = fromValues$2(1, 0, 0);
  var yUnitVec3 = fromValues$2(0, 1, 0);
  return function(out, a, b) {
    var dot$1 = dot(a, b);
    if (dot$1 < -0.999999) {
      cross(tmpvec3, xUnitVec3, a);
      if (len(tmpvec3) < 1e-6) cross(tmpvec3, yUnitVec3, a);
      normalize$2(tmpvec3, tmpvec3);
      setAxisAngle(out, tmpvec3, Math.PI);
      return out;
    } else if (dot$1 > 0.999999) {
      out[0] = 0;
      out[1] = 0;
      out[2] = 0;
      out[3] = 1;
      return out;
    } else {
      cross(tmpvec3, a, b);
      out[0] = tmpvec3[0];
      out[1] = tmpvec3[1];
      out[2] = tmpvec3[2];
      out[3] = 1 + dot$1;
      return normalize(out, out);
    }
  };
})();
(function() {
  var temp1 = create$1();
  var temp2 = create$1();
  return function(out, a, b, c, d, t) {
    slerp(temp1, a, d, t);
    slerp(temp2, b, c, t);
    slerp(out, temp1, temp2, 2 * t * (1 - t));
    return out;
  };
})();
(function() {
  var matr = create$5();
  return function(out, view, right, up) {
    matr[0] = right[0];
    matr[3] = right[1];
    matr[6] = right[2];
    matr[1] = up[0];
    matr[4] = up[1];
    matr[7] = up[2];
    matr[2] = -view[0];
    matr[5] = -view[1];
    matr[8] = -view[2];
    return normalize(out, fromMat3(out, matr));
  };
})();
function create() {
  var out = new ARRAY_TYPE(2);
  if (ARRAY_TYPE != Float32Array) {
    out[0] = 0;
    out[1] = 0;
  }
  return out;
}
function clone(a) {
  var out = new ARRAY_TYPE(2);
  out[0] = a[0];
  out[1] = a[1];
  return out;
}
function fromValues(x, y) {
  var out = new ARRAY_TYPE(2);
  out[0] = x;
  out[1] = y;
  return out;
}
function distance(a, b) {
  var x = b[0] - a[0], y = b[1] - a[1];
  return Math.hypot(x, y);
}
function exactEquals(a, b) {
  return a[0] === b[0] && a[1] === b[1];
}
function equals(a, b) {
  var a0 = a[0], a1 = a[1];
  var b0 = b[0], b1 = b[1];
  return Math.abs(a0 - b0) <= EPSILON * Math.max(1, Math.abs(a0), Math.abs(b0)) && Math.abs(a1 - b1) <= EPSILON * Math.max(1, Math.abs(a1), Math.abs(b1));
}
(function() {
  var vec = create();
  return function(a, stride, offset, count, fn, arg) {
    var i, l;
    if (!stride) {
      stride = 2;
    }
    if (!offset) {
      offset = 0;
    }
    if (count) {
      l = Math.min(count * stride + offset, a.length);
    } else {
      l = a.length;
    }
    for (i = offset; i < l; i += stride) {
      vec[0] = a[i];
      vec[1] = a[i + 1];
      fn(vec, vec, arg);
      a[i] = vec[0];
      a[i + 1] = vec[1];
    }
    return a;
  };
})();
class Box2 {
  min;
  max;
  /**
   * Initializes as an empty box if no values are provided using the
   * "empty-by-sentinel" pattern: min = +Infinity, max = -Infinity.
   * This allows expansion functions to work without special-casing
   * the first element, and avoids biasing toward (0,0).
   */
  constructor(min, max) {
    this.min = min ? clone(min) : fromValues(Infinity, Infinity);
    this.max = max ? clone(max) : fromValues(-Infinity, -Infinity);
  }
  clone() {
    return new Box2(this.min, this.max);
  }
  isEmpty() {
    return this.max[0] <= this.min[0] || this.max[1] <= this.min[1];
  }
  // Half-open interval intersection: returns true only if boxes overlap.
  static intersects(a, b) {
    if (a.max[0] <= b.min[0] || a.min[0] >= b.max[0]) return false;
    if (a.max[1] <= b.min[1] || a.min[1] >= b.max[1]) return false;
    return true;
  }
  static equals(a, b) {
    return exactEquals(a.min, b.min) && exactEquals(a.max, b.max);
  }
  floor() {
    return new Box2(
      fromValues(Math.floor(this.min[0]), Math.floor(this.min[1])),
      fromValues(Math.floor(this.max[0]), Math.floor(this.max[1]))
    );
  }
  toRect() {
    const x = this.min[0];
    const y = this.min[1];
    const width = this.max[0] - this.min[0];
    const height = this.max[1] - this.min[1];
    return { x, y, width, height };
  }
}
class WebGLState {
  gl_;
  enabledCapabilities_ = /* @__PURE__ */ new Map();
  depthMaskEnabled_ = null;
  blendSrcFactor_ = null;
  blendDstFactor_ = null;
  currentBlendingMode_ = null;
  currentViewport_ = null;
  currentScissor_ = null;
  constructor(gl) {
    this.gl_ = gl;
  }
  enable(cap) {
    if (!this.enabledCapabilities_.get(cap)) {
      this.gl_.enable(cap);
      this.enabledCapabilities_.set(cap, true);
    }
  }
  disable(cap) {
    if (this.enabledCapabilities_.get(cap)) {
      this.gl_.disable(cap);
      this.enabledCapabilities_.set(cap, false);
    }
  }
  setBlendFunc(src, dst) {
    if (this.blendSrcFactor_ !== src || this.blendDstFactor_ !== dst) {
      this.gl_.blendFunc(src, dst);
      this.blendSrcFactor_ = src;
      this.blendDstFactor_ = dst;
    }
  }
  setDepthTesting(enabled) {
    if (enabled) {
      this.enable(this.gl_.DEPTH_TEST);
    } else {
      this.disable(this.gl_.DEPTH_TEST);
    }
  }
  setBlending(enabled) {
    if (enabled) {
      this.enable(this.gl_.BLEND);
    } else {
      this.disable(this.gl_.BLEND);
    }
  }
  setDepthMask(flag) {
    if (this.depthMaskEnabled_ !== flag) {
      this.gl_.depthMask(flag);
      this.depthMaskEnabled_ = flag;
    }
  }
  setBlendingMode(mode) {
    if (this.currentBlendingMode_ === mode) return;
    if (mode === "none") {
      this.setBlending(false);
    } else {
      this.setBlending(true);
      switch (mode) {
        case "additive":
          this.setBlendFunc(this.gl_.SRC_ALPHA, this.gl_.ONE);
          break;
        case "multiply":
          this.setBlendFunc(this.gl_.DST_COLOR, this.gl_.ZERO);
          break;
        case "subtractive":
          this.setBlendFunc(this.gl_.ZERO, this.gl_.ONE_MINUS_SRC_COLOR);
          break;
        case "normal":
        default:
          this.setBlendFunc(this.gl_.SRC_ALPHA, this.gl_.ONE_MINUS_SRC_ALPHA);
          break;
      }
    }
    this.currentBlendingMode_ = mode;
  }
  setViewport(box) {
    const clampedBox = box.floor();
    if (this.currentViewport_ && Box2.equals(clampedBox, this.currentViewport_)) {
      return;
    }
    const { x, y, width, height } = clampedBox.toRect();
    this.gl_.viewport(x, y, width, height);
    this.currentViewport_ = clampedBox;
  }
  setScissorTest(enabled) {
    if (enabled) {
      this.enable(this.gl_.SCISSOR_TEST);
    } else {
      this.disable(this.gl_.SCISSOR_TEST);
      this.currentScissor_ = null;
    }
  }
  setScissor(box) {
    const clampedBox = box.floor();
    if (this.currentScissor_ && Box2.equals(clampedBox, this.currentScissor_)) {
      return;
    }
    const { x, y, width, height } = clampedBox.toRect();
    this.gl_.scissor(x, y, width, height);
    this.currentScissor_ = clampedBox;
  }
}
const axisDirection = fromScaling(create$4(), [1, -1, 1]);
class WebGLRenderer extends Renderer {
  gl_ = null;
  programs_;
  bindings_;
  textures_;
  state_;
  constructor(canvas) {
    super(canvas);
    this.gl_ = this.canvas.getContext("webgl2", {
      depth: true,
      antialias: false
    });
    if (!this.gl_) {
      throw new Error(`Failed to initialize WebGL2 context`);
    }
    Logger.info(
      "WebGLRenderer",
      `WebGL version ${this.gl.getParameter(this.gl.VERSION)}`
    );
    this.programs_ = new WebGLShaderPrograms(this.gl);
    this.bindings_ = new WebGLBuffers(this.gl);
    this.textures_ = new WebGLTextures(this.gl);
    this.state_ = new WebGLState(this.gl);
    this.resize(this.canvas.width, this.canvas.height);
  }
  render(layerManager, camera, viewportBox) {
    const rendererBox = new Box2(
      fromValues(0, 0),
      fromValues(this.width, this.height)
    );
    if (Box2.equals(viewportBox.floor(), rendererBox.floor())) {
      this.state_.setScissorTest(false);
    } else {
      this.state_.setScissor(viewportBox);
      this.state_.setScissorTest(true);
    }
    this.state_.setViewport(viewportBox);
    this.clear();
    this.activeCamera = camera;
    const { opaque, transparent } = layerManager.partitionLayers();
    this.state_.setDepthMask(true);
    for (const layer of opaque) {
      layer.update();
      if (layer.state === "ready") {
        this.renderLayer(layer);
      }
    }
    this.state_.setDepthMask(false);
    for (const layer of transparent) {
      layer.update();
      if (layer.state !== "ready") continue;
      this.renderLayer(layer);
    }
    this.state_.setDepthMask(true);
  }
  get textureInfo() {
    return this.textures_.textureInfo;
  }
  renderLayer(layer) {
    this.state_.setBlendingMode(layer.transparent ? layer.blendMode : "none");
    layer.objects.forEach((_, i) => this.renderObject(layer, i));
  }
  renderObject(layer, objectIndex) {
    const object = layer.objects[objectIndex];
    this.bindings_.bindGeometry(object.geometry);
    object.popStaleTextures().forEach((texture) => {
      this.textures_.disposeTexture(texture);
    });
    object.textures.forEach((texture, index) => {
      this.textures_.bindTexture(texture, index);
    });
    const program = this.programs_.use(object.programName);
    this.drawGeometry(object.geometry, object, layer, program);
    if (object.wireframeEnabled) {
      this.bindings_.bindGeometry(object.wireframeGeometry);
      const wireframeProgram = this.programs_.use("wireframe");
      wireframeProgram.setUniform("u_color", object.wireframeColor.rgb);
      this.drawGeometry(
        object.wireframeGeometry,
        object,
        layer,
        wireframeProgram
      );
    }
  }
  drawGeometry(geometry, object, layer, program) {
    const modelView = multiply$2(
      create$4(),
      this.activeCamera.viewMatrix,
      object.transform.matrix
    );
    const projection = multiply$2(
      create$4(),
      axisDirection,
      this.activeCamera.projectionMatrix
    );
    const resolution = [this.canvas.width, this.canvas.height];
    const objectUniforms = object.getUniforms();
    for (const uniformName of program.uniformNames) {
      switch (uniformName) {
        case "ModelView":
          program.setUniform(uniformName, modelView);
          break;
        case "Projection":
          program.setUniform(uniformName, projection);
          break;
        case "Resolution":
          program.setUniform(uniformName, resolution);
          break;
        case "u_opacity":
          program.setUniform(uniformName, layer.opacity);
          break;
        default:
          if (uniformName in objectUniforms) {
            program.setUniform(uniformName, objectUniforms[uniformName]);
          }
      }
    }
    const primitive = this.glGetPrimitive(geometry.primitive);
    const index = geometry.indexData;
    if (index.length) {
      this.gl.drawElements(primitive, index.length, this.gl.UNSIGNED_INT, 0);
    } else {
      this.gl.drawArrays(primitive, 0, geometry.vertexCount);
    }
  }
  glGetPrimitive(type) {
    switch (type) {
      case "points":
        return this.gl.POINTS;
      case "triangles":
        return this.gl.TRIANGLES;
      case "lines":
        return this.gl.LINES;
      default: {
        const exhaustiveCheck = type;
        throw new Error(`Unknown Primitive type: ${exhaustiveCheck}`);
      }
    }
  }
  resize(width, height) {
    const newViewport = new Box2(
      fromValues(0, 0),
      fromValues(width, height)
    );
    this.state_.setViewport(newViewport);
  }
  clear() {
    this.gl.clearColor(...this.backgroundColor.rgba);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
    this.state_.setDepthTesting(true);
    this.gl.depthFunc(this.gl.LEQUAL);
  }
  get gl() {
    return this.gl_;
  }
}
class Box3 {
  min;
  max;
  /**
   * Initializes as an empty box if no values are provided using the
   * "empty-by-sentinel" pattern: min = +Infinity, max = -Infinity.
   * This allows expansion functions to work without special-casing
   * the first element, and avoids biasing toward (0,0,0).
   */
  constructor(min, max) {
    this.min = min ? clone$3(min) : fromValues$2(Infinity, Infinity, Infinity);
    this.max = max ? clone$3(max) : fromValues$2(-Infinity, -Infinity, -Infinity);
  }
  clone() {
    return new Box3(this.min, this.max);
  }
  isEmpty() {
    return this.max[0] <= this.min[0] || this.max[1] <= this.min[1] || this.max[2] <= this.min[2];
  }
  // Half-open interval intersection: returns true only if boxes overlap.
  static intersects(a, b) {
    if (a.max[0] <= b.min[0] || a.min[0] >= b.max[0]) return false;
    if (a.max[1] <= b.min[1] || a.min[1] >= b.max[1]) return false;
    if (a.max[2] <= b.min[2] || a.min[2] >= b.max[2]) return false;
    return true;
  }
}
function almostEqual(a, b, epsilon = 1e-6) {
  return Math.abs(a - b) <= epsilon;
}
const PREFETCH_PADDING_CHUNKS = 1;
class ChunkManagerSource {
  chunks_;
  loader_;
  lowestResLOD_;
  sliceCoords_;
  dimensions_;
  currentLOD_ = 0;
  lastViewBounds2D_ = null;
  lastZBounds_;
  constructor(loader, sliceCoords) {
    this.loader_ = loader;
    this.dimensions_ = this.loader_.getSourceDimensionMap();
    this.lowestResLOD_ = this.dimensions_.numLods - 1;
    this.currentLOD_ = 0;
    this.sliceCoords_ = sliceCoords;
    this.validateXYScaleRatios();
    this.chunks_ = [];
    for (let lod = 0; lod < this.dimensions_.numLods; ++lod) {
      const xLod = this.dimensions_.x.lods[lod];
      const yLod = this.dimensions_.y.lods[lod];
      const zLod = this.dimensions_.z?.lods[lod];
      const cLod = this.dimensions_.c?.lods[lod];
      const chunkWidth = xLod.chunkSize;
      const chunkHeight = yLod.chunkSize;
      const chunkDepth = zLod?.chunkSize ?? 1;
      const chunksX = Math.ceil(xLod.size / chunkWidth);
      const chunksY = Math.ceil(yLod.size / chunkHeight);
      const chunksZ = Math.ceil((zLod?.size ?? 1) / chunkDepth);
      const channels = cLod?.size ?? 1;
      for (let x = 0; x < chunksX; ++x) {
        const xOffset = xLod.translation + x * xLod.chunkSize * xLod.scale;
        for (let y = 0; y < chunksY; ++y) {
          const yOffset = yLod.translation + y * yLod.chunkSize * yLod.scale;
          for (let z2 = 0; z2 < chunksZ; ++z2) {
            const zOffset = zLod !== void 0 ? zLod.translation + z2 * chunkDepth * zLod.scale : 0;
            this.chunks_.push({
              state: "unloaded",
              lod,
              visible: false,
              prefetch: false,
              shape: {
                x: chunkWidth,
                y: chunkHeight,
                z: chunkDepth,
                c: channels
              },
              rowStride: chunkWidth,
              rowAlignmentBytes: 1,
              chunkIndex: { x, y, z: z2 },
              scale: {
                x: xLod.scale,
                y: yLod.scale,
                z: zLod?.scale ?? 1
              },
              offset: {
                x: xOffset,
                y: yOffset,
                z: zOffset
              }
            });
          }
        }
      }
    }
  }
  getChunks() {
    const currentLODChunks = this.chunks_.filter(
      (chunk) => chunk.lod === this.currentLOD_ && chunk.visible && chunk.state === "loaded"
    );
    if (this.currentLOD_ === this.lowestResLOD_) {
      return currentLODChunks;
    }
    const lowResChunks = this.chunks_.filter(
      (chunk) => chunk.lod === this.lowestResLOD_ && chunk.visible && chunk.state === "loaded"
    );
    return [...lowResChunks, ...currentLODChunks];
  }
  update(lodFactor, viewBounds2D) {
    this.setLOD(lodFactor);
    const zBounds = this.getZBounds();
    if (this.viewBounds2DChanged(viewBounds2D) || this.zBoundsChanged(zBounds)) {
      this.updateChunkVisibility(viewBounds2D);
    }
    this.loadPendingChunks();
  }
  get lodCount() {
    return this.lowestResLOD_ + 1;
  }
  get dimensions() {
    return this.dimensions_;
  }
  get chunks() {
    return this.chunks_;
  }
  get currentLOD() {
    return this.currentLOD_;
  }
  loadPendingChunks() {
    this.loadLowResChunks();
    for (const chunk of this.chunks_) {
      if (chunk.lod === this.currentLOD_ && chunk.state === "unloaded" && (chunk.visible || chunk.prefetch)) {
        this.loadChunkData(chunk);
      }
    }
  }
  loadLowResChunks() {
    for (const chunk of this.chunks_) {
      if (chunk.lod !== this.lowestResLOD_ || chunk.state !== "unloaded")
        continue;
      this.loadChunkData(chunk);
    }
  }
  loadChunkData(chunk) {
    chunk.state = "loading";
    this.loader_.loadChunkData(chunk, this.sliceCoords_).then(() => {
      chunk.state = "loaded";
    }).catch((error) => {
      Logger.error(
        "ChunkManager",
        `Error loading chunk (${chunk.chunkIndex.x},${chunk.chunkIndex.y},${chunk.chunkIndex.z}): ${error}`
      );
      chunk.state = "unloaded";
    });
  }
  setLOD(lodFactor) {
    const maxLOD = this.lowestResLOD_;
    const targetLOD = Math.max(
      0,
      Math.min(maxLOD, Math.floor(maxLOD - lodFactor))
    );
    if (targetLOD !== this.currentLOD_) {
      Logger.debug(
        "ChunkManager",
        `LOD changed from ${this.currentLOD_} to ${targetLOD}`
      );
      this.currentLOD_ = targetLOD;
    }
  }
  updateChunkVisibility(viewBounds2D) {
    if (this.chunks_.length === 0) {
      Logger.warn(
        "ChunkManager",
        "updateChunkVisibility called with no chunks initialized"
      );
      return;
    }
    const [zMin, zMax] = this.getZBounds();
    const viewBounds3D = new Box3(
      fromValues$2(viewBounds2D.min[0], viewBounds2D.min[1], zMin),
      fromValues$2(viewBounds2D.max[0], viewBounds2D.max[1], zMax)
    );
    const paddedBounds = this.getPaddedBounds(viewBounds3D);
    for (const chunk of this.chunks_) {
      const isVisible = this.isChunkWithinBounds(chunk, viewBounds3D);
      const eligibleForPrefetch = !isVisible && this.isChunkWithinBounds(chunk, paddedBounds);
      const isCurrentLOD = chunk.lod === this.currentLOD_;
      const isFallbackLOD = chunk.lod === this.lowestResLOD_;
      const isLoaded = chunk.state === "loaded";
      chunk.visible = isVisible;
      chunk.prefetch = eligibleForPrefetch && isCurrentLOD && !isLoaded;
      if (isLoaded && !isFallbackLOD) {
        const shouldDispose = !isCurrentLOD || isCurrentLOD && !isVisible && !eligibleForPrefetch;
        if (shouldDispose) {
          chunk.data = void 0;
          chunk.state = "unloaded";
          Logger.debug("ChunkManager", `Disposing chunk in LOD ${chunk.lod}`);
        }
      }
    }
  }
  validateXYScaleRatios() {
    const xDim = this.dimensions_.x;
    const yDim = this.dimensions_.y;
    for (let i = 1; i < this.dimensions_.numLods; i++) {
      const rx = xDim.lods[i].scale / xDim.lods[i - 1].scale;
      const ry = yDim.lods[i].scale / yDim.lods[i - 1].scale;
      if (!almostEqual(rx, 2) || !almostEqual(ry, 2)) {
        throw new Error(
          `Invalid downsampling factor between levels ${i - 1} → ${i}: expected (2× in X and Y), but got (${rx.toFixed(2)}×, ${ry.toFixed(2)}×) from scale [${xDim.lods[i - 1].scale}, ${yDim.lods[i - 1].scale}] → [${xDim.lods[i].scale}, ${yDim.lods[i].scale}]`
        );
      }
    }
  }
  isChunkWithinBounds(chunk, bounds) {
    const chunkBounds = new Box3(
      fromValues$2(chunk.offset.x, chunk.offset.y, chunk.offset.z),
      fromValues$2(
        chunk.offset.x + chunk.shape.x * chunk.scale.x,
        chunk.offset.y + chunk.shape.y * chunk.scale.y,
        chunk.offset.z + chunk.shape.z * chunk.scale.z
      )
    );
    return Box3.intersects(chunkBounds, bounds);
  }
  getZBounds() {
    const zDim = this.dimensions_.z;
    if (zDim === void 0 || this.sliceCoords_.z === void 0) return [0, 1];
    const zLod = zDim.lods[this.currentLOD_];
    const zShape = zLod.size;
    const zScale = zLod.scale;
    const zTran = zLod.translation;
    const zPoint = Math.floor((this.sliceCoords_.z - zTran) / zScale);
    const chunkDepth = zLod.chunkSize;
    const zChunk = Math.max(
      0,
      Math.min(
        Math.floor(zPoint / chunkDepth),
        Math.ceil(zShape / chunkDepth) - 1
      )
    );
    return [
      zTran + zChunk * chunkDepth * zScale,
      zTran + (zChunk + 1) * chunkDepth * zScale
    ];
  }
  viewBounds2DChanged(newBounds) {
    const prev = this.lastViewBounds2D_;
    const changed = prev === null || !equals(prev.min, newBounds.min) || !equals(prev.max, newBounds.max);
    if (changed) {
      this.lastViewBounds2D_ = new Box2(
        clone(newBounds.min),
        clone(newBounds.max)
      );
    }
    return changed;
  }
  zBoundsChanged(newBounds) {
    const prev = this.lastZBounds_;
    const changed = !prev || !equals(prev, newBounds);
    if (changed) {
      this.lastZBounds_ = newBounds;
    }
    return changed;
  }
  getPaddedBounds(bounds) {
    const xLod = this.dimensions_.x.lods[this.currentLOD_];
    const yLod = this.dimensions_.y.lods[this.currentLOD_];
    const padX = xLod.chunkSize * xLod.scale * PREFETCH_PADDING_CHUNKS;
    const padY = yLod.chunkSize * yLod.scale * PREFETCH_PADDING_CHUNKS;
    const padZ = 0;
    return new Box3(
      fromValues$2(
        bounds.min[0] - padX,
        bounds.min[1] - padY,
        bounds.min[2] - padZ
      ),
      fromValues$2(
        bounds.max[0] + padX,
        bounds.max[1] + padY,
        bounds.max[2] + padZ
      )
    );
  }
}
class ChunkManager {
  sources_ = /* @__PURE__ */ new Map();
  async addSource(source, sliceCoords) {
    let existing = this.sources_.get(source);
    if (!existing) {
      const loader = await source.open();
      existing = new ChunkManagerSource(loader, sliceCoords);
      this.sources_.set(source, existing);
    }
    return existing;
  }
  update(camera, bufferWidth) {
    if (camera.type !== "OrthographicCamera") {
      throw new Error(
        "ChunkManager currently supports only orthographic cameras. Update the implementation before using a perspective camera."
      );
    }
    const viewBounds2D = camera.getWorldViewRect();
    const virtualWidth = Math.abs(viewBounds2D.max[0] - viewBounds2D.min[0]);
    const virtualUnitsPerScreenPixel = virtualWidth / bufferWidth;
    const lodFactor = Math.log2(1 / virtualUnitsPerScreenPixel);
    for (const [_, chunkManagerSource] of this.sources_) {
      chunkManagerSource.update(lodFactor, viewBounds2D);
    }
  }
}
var Stats = function(scale2 = 1) {
  var mode = 0;
  var container = document.createElement("div");
  container.style.cssText = "position:fixed;top:0;left:0;cursor:pointer;opacity:0.9;z-index:10000";
  container.addEventListener("click", function(event) {
    event.preventDefault();
    showPanel(++mode % container.children.length);
  }, false);
  function addPanel(panel) {
    container.appendChild(panel.dom);
    return panel;
  }
  function showPanel(id) {
    for (var i = 0; i < container.children.length; i++) {
      container.children[i].style.display = i === id ? "block" : "none";
    }
    mode = id;
  }
  var beginTime = (performance || Date).now(), prevTime = beginTime, frames = 0;
  var fpsPanel = addPanel(new Stats.Panel("FPS", "#0ff", "#002", scale2));
  var msPanel = addPanel(new Stats.Panel("MS", "#0f0", "#020", scale2));
  if (self.performance && self.performance.memory) {
    var memPanel = addPanel(new Stats.Panel("MB", "#f08", "#201", scale2));
  }
  showPanel(0);
  return {
    REVISION: 16,
    dom: container,
    addPanel,
    showPanel,
    begin: function() {
      beginTime = (performance || Date).now();
    },
    end: function() {
      frames++;
      var time = (performance || Date).now();
      msPanel.update(time - beginTime, 200);
      if (time >= prevTime + 1e3) {
        fpsPanel.update(frames * 1e3 / (time - prevTime), 100);
        prevTime = time;
        frames = 0;
        if (memPanel) {
          var memory = performance.memory;
          memPanel.update(memory.usedJSHeapSize / 1048576, memory.jsHeapSizeLimit / 1048576);
        }
      }
      return time;
    },
    update: function() {
      beginTime = this.end();
    },
    // Backwards Compatibility
    domElement: container,
    setMode: showPanel
  };
};
Stats.Panel = function(name, fg, bg, scale2) {
  var min = Infinity, max = 0, round = Math.round;
  var PR = round(window.devicePixelRatio || 1);
  var WIDTH = round(80 * PR * scale2);
  var HEIGHT = round(48 * PR * scale2);
  var TEXT_X = round(3 * PR * scale2);
  var TEXT_Y = round(2 * PR * scale2);
  var GRAPH_X = round(3 * PR * scale2);
  var GRAPH_Y = round(15 * PR * scale2);
  var GRAPH_WIDTH = round(74 * PR * scale2);
  var GRAPH_HEIGHT = round(30 * PR * scale2);
  var canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  canvas.style.cssText = `width:${round(scale2 * 80)}px;height:${round(scale2 * 48)}px`;
  var context = canvas.getContext("2d");
  context.font = "bold " + round(9 * PR * scale2) + "px Helvetica,Arial,sans-serif";
  context.textBaseline = "top";
  context.fillStyle = bg;
  context.fillRect(0, 0, WIDTH, HEIGHT);
  context.fillStyle = fg;
  context.fillText(name, TEXT_X, TEXT_Y);
  context.fillRect(GRAPH_X, GRAPH_Y, GRAPH_WIDTH, GRAPH_HEIGHT);
  context.fillStyle = bg;
  context.globalAlpha = 0.9;
  context.fillRect(GRAPH_X, GRAPH_Y, GRAPH_WIDTH, GRAPH_HEIGHT);
  return {
    dom: canvas,
    update: function(value, maxValue) {
      min = Math.min(min, value);
      max = Math.max(max, value);
      context.fillStyle = bg;
      context.globalAlpha = 1;
      context.fillRect(0, 0, WIDTH, GRAPH_Y);
      context.fillStyle = fg;
      context.fillText(round(value) + " " + name + " (" + round(min) + "-" + round(max) + ")", TEXT_X, TEXT_Y);
      context.drawImage(canvas, GRAPH_X + PR, GRAPH_Y, GRAPH_WIDTH - PR, GRAPH_HEIGHT, GRAPH_X, GRAPH_Y, GRAPH_WIDTH - PR, GRAPH_HEIGHT);
      context.fillRect(GRAPH_X + GRAPH_WIDTH - PR, GRAPH_Y, PR, GRAPH_HEIGHT);
      context.fillStyle = bg;
      context.globalAlpha = 0.9;
      context.fillRect(GRAPH_X + GRAPH_WIDTH - PR, GRAPH_Y, PR, round((1 - value / maxValue) * GRAPH_HEIGHT));
    }
  };
};
function createStats({ scale: scale2 } = { scale: 1.5 }) {
  const stats = new Stats(scale2);
  stats.showPanel(
    0
    /* 0 = fps, 1 = ms, 2 = mb */
  );
  document.body.appendChild(stats.dom);
  return stats;
}
class Idetik {
  cameraControls_;
  lastAnimationId_;
  needsResize_ = false;
  chunkManager_;
  context_;
  renderer_;
  camera;
  layerManager;
  canvas;
  events;
  overlays;
  stats_;
  constructor(params) {
    if (!params.canvas && !params.canvasSelector) {
      throw new Error("Either canvas or canvasSelector must be provided");
    }
    if (params.canvas && params.canvasSelector) {
      throw new Error("Cannot provide both canvas and canvasSelector");
    }
    this.camera = params.camera;
    this.cameraControls_ = params.cameraControls;
    const canvas = params.canvas ?? document.querySelector(params.canvasSelector);
    if (!canvas) {
      throw new Error(`Canvas not found: ${params.canvasSelector}`);
    }
    this.canvas = canvas;
    this.renderer_ = new WebGLRenderer(canvas);
    this.chunkManager_ = new ChunkManager();
    this.context_ = {
      chunkManager: this.chunkManager_
    };
    this.layerManager = new LayerManager(this.context_);
    if (params.layers) {
      for (const layer of params.layers) {
        this.layerManager.add(layer);
      }
    }
    this.overlays = params.overlays ?? [];
    if (params.showStats) this.stats_ = createStats();
    this.events = new EventDispatcher(canvas);
    this.events.addEventListener((event) => {
      if (event.event instanceof PointerEvent || event.event instanceof WheelEvent) {
        const { clientX, clientY } = event.event;
        const client = fromValues(clientX, clientY);
        event.clipPos = this.clientToClip(client, 0);
        event.worldPos = this.camera.clipToWorld(event.clipPos);
      }
      for (const layer of this.layerManager.layers) {
        layer.onEvent(event);
        if (event.propagationStopped) return;
      }
      this.cameraControls_?.onEvent(event);
    });
  }
  get width() {
    return this.renderer_.width;
  }
  get height() {
    return this.renderer_.height;
  }
  get textureInfo() {
    return this.renderer_.textureInfo;
  }
  set cameraControls(controls) {
    this.cameraControls_ = controls;
  }
  clientToClip(position, depth = 0) {
    const [x, y] = position;
    const rect = this.canvas.getBoundingClientRect();
    return fromValues$2(
      2 * (x - rect.x) / this.canvas.clientWidth - 1,
      2 * (y - rect.y) / this.canvas.clientHeight - 1,
      depth
    );
  }
  start() {
    Logger.info("Idetik", "Idetik runtime started");
    new ResizeObserver(() => {
      this.needsResize_ = true;
    }).observe(this.canvas);
    const render = (timestamp) => {
      if (this.stats_) this.stats_.begin();
      if (!this.camera) {
        Logger.warn(
          "Idetik",
          "A camera must be set before starting the Idetik runtime"
        );
        return;
      }
      if (this.camera.type === "OrthographicCamera") {
        this.chunkManager_.update(
          this.camera,
          this.renderer_.width
        );
      }
      if (this.needsResize_) {
        this.renderer_.updateSize();
        this.needsResize_ = false;
      }
      const viewportBox = new Box2(
        fromValues(0, 0),
        fromValues(this.renderer_.width, this.renderer_.height)
      );
      this.renderer_.render(this.layerManager, this.camera, viewportBox);
      for (const overlay of this.overlays) {
        overlay.update(this, timestamp);
      }
      if (this.stats_) this.stats_.end();
      this.lastAnimationId_ = requestAnimationFrame(render);
    };
    render();
    return this;
  }
  stop() {
    if (this.lastAnimationId_ !== void 0) {
      cancelAnimationFrame(this.lastAnimationId_);
    }
  }
}
class WireframeGeometry extends Geometry {
  constructor(geometry) {
    super();
    if (geometry.primitive != "triangles") {
      Logger.warn("WireframeGeometry", "Only indexed geometries are supported");
      return;
    }
    if (geometry.indexData.length == 0) {
      Logger.warn(
        "WireframeGeometry",
        "Only triangulated geometries are supported"
      );
      return;
    }
    this.primitive_ = "lines";
    this.vertexData_ = geometry.vertexData;
    this.attributes_ = geometry.attributes;
    const edgeSet = /* @__PURE__ */ new Set();
    const wireframeIndices = [];
    const addEdge = (a, b) => {
      const i0 = Math.min(a, b);
      const i1 = Math.max(a, b);
      if (!edgeSet.has({ i0, i1 })) {
        edgeSet.add({ i0, i1 });
        wireframeIndices.push(i0, i1);
      }
    };
    const index = geometry.indexData;
    for (let i = 0; i < index.length; i += 3) {
      const i0 = index[i];
      const i1 = index[i + 1];
      const i2 = index[i + 2];
      addEdge(i0, i1);
      addEdge(i1, i2);
      addEdge(i2, i0);
    }
    this.indexData_ = new Uint32Array(wireframeIndices);
  }
}
class TrsTransform {
  dirty_ = true;
  matrix_ = create$4();
  rotation_ = create$1();
  translation_ = create$3();
  scale_ = fromValues$2(1, 1, 1);
  addRotation(q) {
    multiply(this.rotation_, this.rotation_, q);
    this.dirty_ = true;
  }
  setRotation(q) {
    copy(this.rotation_, q);
    this.dirty_ = true;
  }
  get rotation() {
    return clone$1(this.rotation_);
  }
  addTranslation(vec) {
    add(this.translation_, this.translation_, vec);
    this.dirty_ = true;
  }
  setTranslation(vec) {
    copy$2(this.translation_, vec);
    this.dirty_ = true;
  }
  get translation() {
    return clone$3(this.translation_);
  }
  addScale(vec) {
    multiply$1(this.scale_, this.scale_, vec);
    this.dirty_ = true;
  }
  setScale(vec) {
    copy$2(this.scale_, vec);
    this.dirty_ = true;
  }
  get scale() {
    return clone$3(this.scale_);
  }
  get matrix() {
    if (this.dirty_) {
      this.computeMatrix();
      this.dirty_ = false;
    }
    return this.matrix_;
  }
  get inverse() {
    return invert(create$4(), this.matrix);
  }
  computeMatrix() {
    fromRotationTranslationScale(
      this.matrix_,
      this.rotation_,
      this.translation_,
      this.scale_
    );
  }
}
class RenderableObject extends Node {
  wireframeEnabled = false;
  wireframeColor = Color.WHITE;
  textures_ = [];
  staleTextures_ = [];
  transform_ = new TrsTransform();
  geometry_ = new Geometry();
  wireframeGeometry_ = null;
  programName_ = null;
  setTexture(index, texture) {
    const oldTexture = this.textures_[index];
    if (oldTexture !== void 0) {
      this.staleTextures_.push(oldTexture);
    }
    this.textures_[index] = texture;
  }
  popStaleTextures() {
    const stale = this.staleTextures_;
    this.staleTextures_ = [];
    return stale;
  }
  get geometry() {
    return this.geometry_;
  }
  get wireframeGeometry() {
    this.wireframeGeometry_ ??= new WireframeGeometry(this.geometry);
    return this.wireframeGeometry_;
  }
  get textures() {
    return this.textures_;
  }
  get transform() {
    return this.transform_;
  }
  set geometry(geometry) {
    this.geometry_ = geometry;
    this.wireframeGeometry_ = null;
  }
  get programName() {
    if (this.programName_ === null) {
      throw new Error("Program name not set");
    }
    return this.programName_;
  }
  set programName(programName) {
    this.programName_ = programName;
  }
  /**
   * Get uniforms for shader program. Override in derived classes that need custom uniforms.
   * @returns Object containing uniform name-value pairs
   */
  getUniforms() {
    return {};
  }
}
class Camera extends RenderableObject {
  projectionMatrix_ = create$4();
  near_ = 0;
  far_ = 0;
  update() {
    this.updateProjectionMatrix();
  }
  get projectionMatrix() {
    return this.projectionMatrix_;
  }
  get viewMatrix() {
    return this.transform.inverse;
  }
  pan(vec) {
    this.transform.addTranslation(vec);
  }
  get position() {
    return this.transform.translation;
  }
  clipToWorld(position) {
    const clipPos = fromValues$1(position[0], position[1], position[2], 1);
    const projectionInverse = invert(
      create$4(),
      this.projectionMatrix_
    );
    const viewPos = transformMat4(
      create$2(),
      clipPos,
      projectionInverse
    );
    scale(viewPos, viewPos, 1 / viewPos[3]);
    const worldPos = transformMat4(
      create$2(),
      viewPos,
      this.transform.matrix
    );
    return fromValues$2(worldPos[0], worldPos[1], worldPos[2]);
  }
}
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
class Layer {
  objects_ = [];
  state_ = "initialized";
  callbacks_ = [];
  transparent;
  opacity_;
  blendMode;
  constructor({
    transparent = false,
    opacity = 1,
    blendMode = "normal"
  } = {}) {
    if (opacity < 0 || opacity > 1) {
      console.warn(
        `Layer opacity out of bounds: ${opacity} — clamping to [0.0, 1.0]`
      );
    }
    this.transparent = transparent;
    this.opacity_ = clamp(opacity, 0, 1);
    this.blendMode = blendMode;
  }
  get opacity() {
    return this.opacity_;
  }
  set opacity(value) {
    if (value < 0 || value > 1) {
      console.warn(`Opacity out of bounds: ${value} — clamping to [0.0, 1.0]`);
    }
    this.opacity_ = clamp(value, 0, 1);
  }
  onEvent(_) {
  }
  // TODO: Consider making this an abstract method once chunk manager
  // integration is finalized. Most layers will likely need access to the chunk
  // manager, but for now, we allow optional overrides to avoid requiring
  // placeholder implementations.
  async onAttached(_context) {
  }
  get objects() {
    return this.objects_;
  }
  get state() {
    return this.state_;
  }
  addStateChangeCallback(callback) {
    this.callbacks_.push(callback);
  }
  removeStateChangeCallback(callback) {
    const index = this.callbacks_.indexOf(callback);
    if (index === void 0) {
      throw new Error(`Callback to remove could not be found: ${callback}`);
    }
    this.callbacks_.splice(index, 1);
  }
  setState(newState) {
    const prevState = this.state_;
    this.state_ = newState;
    this.callbacks_.forEach((callback) => callback(newState, prevState));
  }
  addObject(object) {
    this.objects_.push(object);
  }
  removeObject(object) {
    const index = this.objects_.indexOf(object);
    if (index !== -1) {
      this.objects_.splice(index, 1);
    }
  }
  clearObjects() {
    this.objects_ = [];
  }
}
class NodeNotFoundError extends Error {
  constructor(context, options = {}) {
    super(`Node not found: ${context}`, options);
    this.name = "NodeNotFoundError";
  }
}
class KeyError extends Error {
  constructor(path) {
    super(`Missing key: ${path}`);
    this.name = "KeyError";
  }
}
const scriptRel = "modulepreload";
const assetsURL = function(dep) {
  return "/" + dep;
};
const seen = {};
const __vitePreload = function preload(baseModule, deps, importerUrl) {
  let promise = Promise.resolve();
  if (deps && deps.length > 0) {
    let allSettled2 = function(promises) {
      return Promise.all(
        promises.map(
          (p) => Promise.resolve(p).then(
            (value) => ({ status: "fulfilled", value }),
            (reason) => ({ status: "rejected", reason })
          )
        )
      );
    };
    document.getElementsByTagName("link");
    const cspNonceMeta = document.querySelector(
      "meta[property=csp-nonce]"
    );
    const cspNonce = cspNonceMeta?.nonce || cspNonceMeta?.getAttribute("nonce");
    promise = allSettled2(
      deps.map((dep) => {
        dep = assetsURL(dep);
        if (dep in seen) return;
        seen[dep] = true;
        const isCss = dep.endsWith(".css");
        const cssSelector = isCss ? '[rel="stylesheet"]' : "";
        if (document.querySelector(`link[href="${dep}"]${cssSelector}`)) {
          return;
        }
        const link = document.createElement("link");
        link.rel = isCss ? "stylesheet" : scriptRel;
        if (!isCss) {
          link.as = "script";
        }
        link.crossOrigin = "";
        link.href = dep;
        if (cspNonce) {
          link.setAttribute("nonce", cspNonce);
        }
        document.head.appendChild(link);
        if (isCss) {
          return new Promise((res, rej) => {
            link.addEventListener("load", res);
            link.addEventListener(
              "error",
              () => rej(new Error(`Unable to preload CSS for ${dep}`))
            );
          });
        }
      })
    );
  }
  function handlePreloadError(err) {
    const e = new Event("vite:preloadError", {
      cancelable: true
    });
    e.payload = err;
    window.dispatchEvent(e);
    if (!e.defaultPrevented) {
      throw err;
    }
  }
  return promise.then((res) => {
    for (const item of res || []) {
      if (item.status !== "rejected") continue;
      handlePreloadError(item.reason);
    }
    return baseModule().catch(handlePreloadError);
  });
};
class BitroundCodec {
  kind = "array_to_array";
  constructor(configuration, _meta) {
    if (configuration.keepbits < 0) {
      throw new Error("keepbits must be zero or positive");
    }
  }
  static fromConfig(configuration, meta) {
    return new BitroundCodec(configuration, meta);
  }
  /**
   * Encode a chunk of data with bit-rounding.
   * @param _arr - The chunk to encode
   */
  encode(_arr) {
    throw new Error("`BitroundCodec.encode` is not implemented. Please open an issue at https://github.com/manzt/zarrita.js/issues.");
  }
  /**
   * Decode a chunk of data (no-op).
   * @param arr - The chunk to decode
   * @returns The decoded chunk
   */
  decode(arr) {
    return arr;
  }
}
class BoolArray {
  #bytes;
  constructor(x, byteOffset, length2) {
    if (typeof x === "number") {
      this.#bytes = new Uint8Array(x);
    } else if (x instanceof ArrayBuffer) {
      this.#bytes = new Uint8Array(x, byteOffset, length2);
    } else {
      this.#bytes = new Uint8Array(Array.from(x, (v) => v ? 1 : 0));
    }
  }
  get BYTES_PER_ELEMENT() {
    return 1;
  }
  get byteOffset() {
    return this.#bytes.byteOffset;
  }
  get byteLength() {
    return this.#bytes.byteLength;
  }
  get buffer() {
    return this.#bytes.buffer;
  }
  get length() {
    return this.#bytes.length;
  }
  get(idx) {
    let value = this.#bytes[idx];
    return typeof value === "number" ? value !== 0 : value;
  }
  set(idx, value) {
    this.#bytes[idx] = value ? 1 : 0;
  }
  fill(value) {
    this.#bytes.fill(value ? 1 : 0);
  }
  *[Symbol.iterator]() {
    for (let i = 0; i < this.length; i++) {
      yield this.get(i);
    }
  }
}
class ByteStringArray {
  _data;
  chars;
  #encoder;
  constructor(chars, x, byteOffset, length2) {
    this.chars = chars;
    this.#encoder = new TextEncoder();
    if (typeof x === "number") {
      this._data = new Uint8Array(x * chars);
    } else if (x instanceof ArrayBuffer) {
      if (length2)
        length2 = length2 * chars;
      this._data = new Uint8Array(x, byteOffset, length2);
    } else {
      let values = Array.from(x);
      this._data = new Uint8Array(values.length * chars);
      for (let i = 0; i < values.length; i++) {
        this.set(i, values[i]);
      }
    }
  }
  get BYTES_PER_ELEMENT() {
    return this.chars;
  }
  get byteOffset() {
    return this._data.byteOffset;
  }
  get byteLength() {
    return this._data.byteLength;
  }
  get buffer() {
    return this._data.buffer;
  }
  get length() {
    return this.byteLength / this.BYTES_PER_ELEMENT;
  }
  get(idx) {
    const view = new Uint8Array(this.buffer, this.byteOffset + this.chars * idx, this.chars);
    return new TextDecoder().decode(view).replace(/\x00/g, "");
  }
  set(idx, value) {
    const view = new Uint8Array(this.buffer, this.byteOffset + this.chars * idx, this.chars);
    view.fill(0);
    view.set(this.#encoder.encode(value));
  }
  fill(value) {
    const encoded = this.#encoder.encode(value);
    for (let i = 0; i < this.length; i++) {
      this._data.set(encoded, i * this.chars);
    }
  }
  *[Symbol.iterator]() {
    for (let i = 0; i < this.length; i++) {
      yield this.get(i);
    }
  }
}
class UnicodeStringArray {
  #data;
  chars;
  constructor(chars, x, byteOffset, length2) {
    this.chars = chars;
    if (typeof x === "number") {
      this.#data = new Int32Array(x * chars);
    } else if (x instanceof ArrayBuffer) {
      if (length2)
        length2 *= chars;
      this.#data = new Int32Array(x, byteOffset, length2);
    } else {
      const values = x;
      const d = new UnicodeStringArray(chars, 1);
      this.#data = new Int32Array(function* () {
        for (let str of values) {
          d.set(0, str);
          yield* d.#data;
        }
      }());
    }
  }
  get BYTES_PER_ELEMENT() {
    return this.#data.BYTES_PER_ELEMENT * this.chars;
  }
  get byteLength() {
    return this.#data.byteLength;
  }
  get byteOffset() {
    return this.#data.byteOffset;
  }
  get buffer() {
    return this.#data.buffer;
  }
  get length() {
    return this.#data.length / this.chars;
  }
  get(idx) {
    const offset = this.chars * idx;
    let result = "";
    for (let i = 0; i < this.chars; i++) {
      result += String.fromCodePoint(this.#data[offset + i]);
    }
    return result.replace(/\u0000/g, "");
  }
  set(idx, value) {
    const offset = this.chars * idx;
    const view = this.#data.subarray(offset, offset + this.chars);
    view.fill(0);
    for (let i = 0; i < this.chars; i++) {
      view[i] = value.codePointAt(i) ?? 0;
    }
  }
  fill(value) {
    this.set(0, value);
    let encoded = this.#data.subarray(0, this.chars);
    for (let i = 1; i < this.length; i++) {
      this.#data.set(encoded, i * this.chars);
    }
  }
  *[Symbol.iterator]() {
    for (let i = 0; i < this.length; i++) {
      yield this.get(i);
    }
  }
}
function json_decode_object(bytes) {
  const str = new TextDecoder().decode(bytes);
  return JSON.parse(str);
}
function byteswap_inplace(view, bytes_per_element2) {
  const numFlips = bytes_per_element2 / 2;
  const endByteIndex = bytes_per_element2 - 1;
  let t = 0;
  for (let i = 0; i < view.length; i += bytes_per_element2) {
    for (let j = 0; j < numFlips; j += 1) {
      t = view[i + j];
      view[i + j] = view[i + endByteIndex - j];
      view[i + endByteIndex - j] = t;
    }
  }
}
const CONSTRUCTORS = {
  int8: Int8Array,
  int16: Int16Array,
  int32: Int32Array,
  int64: globalThis.BigInt64Array,
  uint8: Uint8Array,
  uint16: Uint16Array,
  uint32: Uint32Array,
  uint64: globalThis.BigUint64Array,
  float32: Float32Array,
  float64: Float64Array,
  bool: BoolArray
};
const V2_STRING_REGEX = /v2:([US])(\d+)/;
function get_ctr(data_type) {
  if (data_type === "v2:object") {
    return globalThis.Array;
  }
  let match = data_type.match(V2_STRING_REGEX);
  if (match) {
    let [, kind, chars] = match;
    return (kind === "U" ? UnicodeStringArray : ByteStringArray).bind(null, Number(chars));
  }
  let ctr = CONSTRUCTORS[data_type];
  if (!ctr) {
    throw new Error(`Unknown or unsupported data_type: ${data_type}`);
  }
  return ctr;
}
function get_strides(shape, order) {
  return (order === "C" ? row_major_stride : col_major_stride)(shape);
}
function row_major_stride(shape) {
  const ndim = shape.length;
  const stride = globalThis.Array(ndim);
  for (let i = ndim - 1, step = 1; i >= 0; i--) {
    stride[i] = step;
    step *= shape[i];
  }
  return stride;
}
function col_major_stride(shape) {
  const ndim = shape.length;
  const stride = globalThis.Array(ndim);
  for (let i = 0, step = 1; i < ndim; i++) {
    stride[i] = step;
    step *= shape[i];
  }
  return stride;
}
function create_chunk_key_encoder({ name, configuration }) {
  if (name === "default") {
    const separator = configuration?.separator ?? "/";
    return (chunk_coords) => ["c", ...chunk_coords].join(separator);
  }
  if (name === "v2") {
    const separator = configuration?.separator ?? ".";
    return (chunk_coords) => chunk_coords.join(separator) || "0";
  }
  throw new Error(`Unknown chunk key encoding: ${name}`);
}
function get_array_order(codecs) {
  const maybe_transpose_codec = codecs.find((c) => c.name === "transpose");
  return maybe_transpose_codec?.configuration?.order === "F" ? "F" : "C";
}
const endian_regex = /^([<|>])(.*)$/;
function coerce_dtype(dtype) {
  if (dtype === "|O") {
    return { data_type: "v2:object" };
  }
  let match = dtype.match(endian_regex);
  if (!match) {
    throw new Error(`Invalid dtype: ${dtype}`);
  }
  let [, endian, rest] = match;
  let data_type = {
    b1: "bool",
    i1: "int8",
    u1: "uint8",
    i2: "int16",
    u2: "uint16",
    i4: "int32",
    u4: "uint32",
    i8: "int64",
    u8: "uint64",
    f4: "float32",
    f8: "float64"
  }[rest] ?? (rest.startsWith("S") || rest.startsWith("U") ? `v2:${rest}` : void 0);
  if (!data_type) {
    throw new Error(`Unsupported or unknown dtype: ${dtype}`);
  }
  if (endian === "|") {
    return { data_type };
  }
  return { data_type, endian: endian === "<" ? "little" : "big" };
}
function v2_to_v3_array_metadata(meta, attributes = {}) {
  let codecs = [];
  let dtype = coerce_dtype(meta.dtype);
  if (meta.order === "F") {
    codecs.push({ name: "transpose", configuration: { order: "F" } });
  }
  if ("endian" in dtype && dtype.endian === "big") {
    codecs.push({ name: "bytes", configuration: { endian: "big" } });
  }
  for (let { id, ...configuration } of meta.filters ?? []) {
    codecs.push({ name: id, configuration });
  }
  if (meta.compressor) {
    let { id, ...configuration } = meta.compressor;
    codecs.push({ name: id, configuration });
  }
  return {
    zarr_format: 3,
    node_type: "array",
    shape: meta.shape,
    data_type: dtype.data_type,
    chunk_grid: {
      name: "regular",
      configuration: {
        chunk_shape: meta.chunks
      }
    },
    chunk_key_encoding: {
      name: "v2",
      configuration: {
        separator: meta.dimension_separator ?? "."
      }
    },
    codecs,
    fill_value: meta.fill_value,
    attributes
  };
}
function v2_to_v3_group_metadata(_meta, attributes = {}) {
  return {
    zarr_format: 3,
    node_type: "group",
    attributes
  };
}
function is_dtype(dtype, query) {
  if (query !== "number" && query !== "bigint" && query !== "boolean" && query !== "object" && query !== "string") {
    return dtype === query;
  }
  let is_boolean = dtype === "bool";
  if (query === "boolean")
    return is_boolean;
  let is_string = dtype.startsWith("v2:U") || dtype.startsWith("v2:S");
  if (query === "string")
    return is_string;
  let is_bigint = dtype === "int64" || dtype === "uint64";
  if (query === "bigint")
    return is_bigint;
  let is_object = dtype === "v2:object";
  if (query === "object")
    return is_object;
  return !is_string && !is_bigint && !is_boolean && !is_object;
}
function is_sharding_codec(codec) {
  return codec?.name === "sharding_indexed";
}
function ensure_correct_scalar(metadata) {
  if ((metadata.data_type === "uint64" || metadata.data_type === "int64") && metadata.fill_value != null) {
    return BigInt(metadata.fill_value);
  }
  return metadata.fill_value;
}
const LITTLE_ENDIAN_OS = system_is_little_endian();
function system_is_little_endian() {
  const a = new Uint32Array([305419896]);
  const b = new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
  return !(b[0] === 18);
}
function bytes_per_element(TypedArray) {
  if ("BYTES_PER_ELEMENT" in TypedArray) {
    return TypedArray.BYTES_PER_ELEMENT;
  }
  return 4;
}
class BytesCodec {
  kind = "array_to_bytes";
  #strides;
  #TypedArray;
  #BYTES_PER_ELEMENT;
  #shape;
  #endian;
  constructor(configuration, meta) {
    this.#endian = configuration?.endian;
    this.#TypedArray = get_ctr(meta.data_type);
    this.#shape = meta.shape;
    this.#strides = get_strides(meta.shape, get_array_order(meta.codecs));
    const sample = new this.#TypedArray(0);
    this.#BYTES_PER_ELEMENT = sample.BYTES_PER_ELEMENT;
  }
  static fromConfig(configuration, meta) {
    return new BytesCodec(configuration, meta);
  }
  encode(arr) {
    let bytes = new Uint8Array(arr.data.buffer);
    if (LITTLE_ENDIAN_OS && this.#endian === "big") {
      byteswap_inplace(bytes, bytes_per_element(this.#TypedArray));
    }
    return bytes;
  }
  decode(bytes) {
    if (LITTLE_ENDIAN_OS && this.#endian === "big") {
      byteswap_inplace(bytes, bytes_per_element(this.#TypedArray));
    }
    return {
      data: new this.#TypedArray(bytes.buffer, bytes.byteOffset, bytes.byteLength / this.#BYTES_PER_ELEMENT),
      shape: this.#shape,
      stride: this.#strides
    };
  }
}
class Crc32cCodec {
  kind = "bytes_to_bytes";
  static fromConfig() {
    return new Crc32cCodec();
  }
  encode(_) {
    throw new Error("Not implemented");
  }
  decode(arr) {
    return new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength - 4);
  }
}
function throw_on_nan_replacer(_key, value) {
  if (Number.isNaN(value)) {
    throw new Error("JsonCodec allow_nan is false but NaN was encountered during encoding.");
  }
  if (value === Number.POSITIVE_INFINITY) {
    throw new Error("JsonCodec allow_nan is false but Infinity was encountered during encoding.");
  }
  if (value === Number.NEGATIVE_INFINITY) {
    throw new Error("JsonCodec allow_nan is false but -Infinity was encountered during encoding.");
  }
  return value;
}
function sort_keys_replacer(_key, value) {
  return value instanceof Object && !Array.isArray(value) ? Object.keys(value).sort().reduce((sorted, key) => {
    sorted[key] = value[key];
    return sorted;
  }, {}) : value;
}
class JsonCodec {
  configuration;
  kind = "array_to_bytes";
  #encoder_config;
  #decoder_config;
  constructor(configuration = {}) {
    this.configuration = configuration;
    const { encoding = "utf-8", skipkeys = false, ensure_ascii = true, check_circular = true, allow_nan = true, sort_keys = true, indent, strict = true } = configuration;
    let separators = configuration.separators;
    if (!separators) {
      if (!indent) {
        separators = [",", ":"];
      } else {
        separators = [", ", ": "];
      }
    }
    this.#encoder_config = {
      encoding,
      skipkeys,
      ensure_ascii,
      check_circular,
      allow_nan,
      indent,
      separators,
      sort_keys
    };
    this.#decoder_config = { strict };
  }
  static fromConfig(configuration) {
    return new JsonCodec(configuration);
  }
  encode(buf) {
    const { indent, encoding, ensure_ascii, check_circular, allow_nan, sort_keys } = this.#encoder_config;
    if (encoding !== "utf-8") {
      throw new Error("JsonCodec does not yet support non-utf-8 encoding.");
    }
    const replacer_functions = [];
    if (!check_circular) {
      throw new Error("JsonCodec does not yet support skipping the check for circular references during encoding.");
    }
    if (!allow_nan) {
      replacer_functions.push(throw_on_nan_replacer);
    }
    if (sort_keys) {
      replacer_functions.push(sort_keys_replacer);
    }
    const items = Array.from(buf.data);
    items.push("|O");
    items.push(buf.shape);
    let replacer = void 0;
    if (replacer_functions.length) {
      replacer = (key, value) => {
        let new_value = value;
        for (let sub_replacer of replacer_functions) {
          new_value = sub_replacer(key, new_value);
        }
        return new_value;
      };
    }
    let json_str = JSON.stringify(items, replacer, indent);
    if (ensure_ascii) {
      json_str = json_str.replace(/[\u007F-\uFFFF]/g, (chr) => {
        const full_str = `0000${chr.charCodeAt(0).toString(16)}`;
        const sub_str = full_str.substring(full_str.length - 4);
        return `\\u${sub_str}`;
      });
    }
    return new TextEncoder().encode(json_str);
  }
  decode(bytes) {
    const { strict } = this.#decoder_config;
    if (!strict) {
      throw new Error("JsonCodec does not yet support non-strict decoding.");
    }
    const items = json_decode_object(bytes);
    const shape = items.pop();
    items.pop();
    if (!shape) {
      throw new Error("0D not implemented for JsonCodec.");
    }
    const stride = get_strides(shape, "C");
    const data = items;
    return { data, shape, stride };
  }
}
function proxy(arr) {
  if (arr instanceof BoolArray || arr instanceof ByteStringArray || arr instanceof UnicodeStringArray) {
    const arrp = new Proxy(arr, {
      get(target, prop) {
        return target.get(Number(prop));
      },
      set(target, prop, value) {
        target.set(Number(prop), value);
        return true;
      }
    });
    return arrp;
  }
  return arr;
}
function empty_like(chunk, order) {
  let data;
  if (chunk.data instanceof ByteStringArray || chunk.data instanceof UnicodeStringArray) {
    data = new chunk.constructor(
      // @ts-expect-error
      chunk.data.length,
      chunk.data.chars
    );
  } else {
    data = new chunk.constructor(chunk.data.length);
  }
  return {
    data,
    shape: chunk.shape,
    stride: get_strides(chunk.shape, order)
  };
}
function convert_array_order(src, target) {
  let out = empty_like(src, target);
  let n_dims = src.shape.length;
  let size = src.data.length;
  let index = Array(n_dims).fill(0);
  let src_data = proxy(src.data);
  let out_data = proxy(out.data);
  for (let src_idx = 0; src_idx < size; src_idx++) {
    let out_idx = 0;
    for (let dim = 0; dim < n_dims; dim++) {
      out_idx += index[dim] * out.stride[dim];
    }
    out_data[out_idx] = src_data[src_idx];
    index[0] += 1;
    for (let dim = 0; dim < n_dims; dim++) {
      if (index[dim] === src.shape[dim]) {
        if (dim + 1 === n_dims) {
          break;
        }
        index[dim] = 0;
        index[dim + 1] += 1;
      }
    }
  }
  return out;
}
function get_order(arr) {
  if (!arr.stride)
    return "C";
  let row_major_strides = get_strides(arr.shape, "C");
  return arr.stride.every((s, i) => s === row_major_strides[i]) ? "C" : "F";
}
class TransposeCodec {
  configuration;
  kind = "array_to_array";
  constructor(configuration) {
    this.configuration = configuration;
  }
  static fromConfig(configuration) {
    return new TransposeCodec(configuration);
  }
  encode(arr) {
    if (get_order(arr) === this.configuration?.order) {
      return arr;
    }
    return convert_array_order(arr, this.configuration?.order ?? "C");
  }
  decode(arr) {
    return arr;
  }
}
class VLenUTF8 {
  kind = "array_to_bytes";
  #shape;
  #strides;
  constructor(shape) {
    this.#shape = shape;
    this.#strides = get_strides(shape, "C");
  }
  static fromConfig(_, meta) {
    return new VLenUTF8(meta.shape);
  }
  encode(_chunk) {
    throw new Error("Method not implemented.");
  }
  decode(bytes) {
    let decoder = new TextDecoder();
    let view = new DataView(bytes.buffer);
    let data = Array(view.getUint32(0, true));
    let pos = 4;
    for (let i = 0; i < data.length; i++) {
      let item_length = view.getUint32(pos, true);
      pos += 4;
      data[i] = decoder.decode(bytes.buffer.slice(pos, pos + item_length));
      pos += item_length;
    }
    return { data, shape: this.#shape, stride: this.#strides };
  }
}
function create_default_registry() {
  return (/* @__PURE__ */ new Map()).set("blosc", () => __vitePreload(() => import("./blosc-DvQQ1ST0.js"), true ? __vite__mapDeps([0,1]) : void 0).then((m) => m.default)).set("gzip", () => __vitePreload(() => import("./gzip-AbJRpPtV.js"), true ? __vite__mapDeps([2,3]) : void 0).then((m) => m.default)).set("lz4", () => __vitePreload(() => import("./lz4-BIbM36RN.js"), true ? __vite__mapDeps([4,1]) : void 0).then((m) => m.default)).set("zlib", () => __vitePreload(() => import("./zlib-Dk1NUtlh.js"), true ? __vite__mapDeps([5,3]) : void 0).then((m) => m.default)).set("zstd", () => __vitePreload(() => import("./zstd-CO575QiM.js"), true ? __vite__mapDeps([6,1]) : void 0).then((m) => m.default)).set("transpose", () => TransposeCodec).set("bytes", () => BytesCodec).set("crc32c", () => Crc32cCodec).set("vlen-utf8", () => VLenUTF8).set("json2", () => JsonCodec).set("bitround", () => BitroundCodec);
}
const registry = create_default_registry();
function create_codec_pipeline(chunk_metadata) {
  let codecs;
  return {
    async encode(chunk) {
      if (!codecs)
        codecs = await load_codecs(chunk_metadata);
      for (const codec of codecs.array_to_array) {
        chunk = await codec.encode(chunk);
      }
      let bytes = await codecs.array_to_bytes.encode(chunk);
      for (const codec of codecs.bytes_to_bytes) {
        bytes = await codec.encode(bytes);
      }
      return bytes;
    },
    async decode(bytes) {
      if (!codecs)
        codecs = await load_codecs(chunk_metadata);
      for (let i = codecs.bytes_to_bytes.length - 1; i >= 0; i--) {
        bytes = await codecs.bytes_to_bytes[i].decode(bytes);
      }
      let chunk = await codecs.array_to_bytes.decode(bytes);
      for (let i = codecs.array_to_array.length - 1; i >= 0; i--) {
        chunk = await codecs.array_to_array[i].decode(chunk);
      }
      return chunk;
    }
  };
}
async function load_codecs(chunk_meta) {
  let promises = chunk_meta.codecs.map(async (meta) => {
    let Codec = await registry.get(meta.name)?.();
    if (!Codec) {
      throw new Error(`Unknown codec: ${meta.name}`);
    }
    return { Codec, meta };
  });
  let array_to_array = [];
  let array_to_bytes;
  let bytes_to_bytes = [];
  for await (let { Codec, meta } of promises) {
    let codec = Codec.fromConfig(meta.configuration, chunk_meta);
    switch (codec.kind) {
      case "array_to_array":
        array_to_array.push(codec);
        break;
      case "array_to_bytes":
        array_to_bytes = codec;
        break;
      default:
        bytes_to_bytes.push(codec);
    }
  }
  if (!array_to_bytes) {
    if (!is_typed_array_like_meta(chunk_meta)) {
      throw new Error(`Cannot encode ${chunk_meta.data_type} to bytes without a codec`);
    }
    array_to_bytes = BytesCodec.fromConfig({ endian: "little" }, chunk_meta);
  }
  return { array_to_array, array_to_bytes, bytes_to_bytes };
}
function is_typed_array_like_meta(meta) {
  return meta.data_type !== "v2:object";
}
const MAX_BIG_UINT = 18446744073709551615n;
function create_sharded_chunk_getter(location, shard_shape, encode_shard_key, sharding_config) {
  if (location.store.getRange === void 0) {
    throw new Error("Store does not support range requests");
  }
  let get_range = location.store.getRange.bind(location.store);
  let index_shape = shard_shape.map((d, i) => d / sharding_config.chunk_shape[i]);
  let index_codec = create_codec_pipeline({
    data_type: "uint64",
    shape: [...index_shape, 2],
    codecs: sharding_config.index_codecs
  });
  let cache = {};
  return async (chunk_coord) => {
    let shard_coord = chunk_coord.map((d, i) => Math.floor(d / index_shape[i]));
    let shard_path = location.resolve(encode_shard_key(shard_coord)).path;
    let index;
    if (shard_path in cache) {
      index = cache[shard_path];
    } else {
      let checksum_size = 4;
      let index_size = 16 * index_shape.reduce((a, b) => a * b, 1);
      let bytes = await get_range(shard_path, {
        suffixLength: index_size + checksum_size
      });
      index = cache[shard_path] = bytes ? await index_codec.decode(bytes) : null;
    }
    if (index === null) {
      return void 0;
    }
    let { data, shape, stride } = index;
    let linear_offset = chunk_coord.map((d, i) => d % shape[i]).reduce((acc, sel, idx) => acc + sel * stride[idx], 0);
    let offset = data[linear_offset];
    let length2 = data[linear_offset + 1];
    if (offset === MAX_BIG_UINT && length2 === MAX_BIG_UINT) {
      return void 0;
    }
    return get_range(shard_path, {
      offset: Number(offset),
      length: Number(length2)
    });
  };
}
class Location {
  store;
  path;
  constructor(store, path = "/") {
    this.store = store;
    this.path = path;
  }
  resolve(path) {
    let root = new URL(`file://${this.path.endsWith("/") ? this.path : `${this.path}/`}`);
    return new Location(this.store, new URL(path, root).pathname);
  }
}
class Group extends Location {
  kind = "group";
  #metadata;
  constructor(store, path, metadata) {
    super(store, path);
    this.#metadata = metadata;
  }
  get attrs() {
    return this.#metadata.attributes;
  }
}
const CONTEXT_MARKER = Symbol("zarrita.context");
function get_context(obj) {
  return obj[CONTEXT_MARKER];
}
function create_context(location, metadata) {
  let { configuration } = metadata.codecs.find(is_sharding_codec) ?? {};
  let shared_context = {
    encode_chunk_key: create_chunk_key_encoder(metadata.chunk_key_encoding),
    TypedArray: get_ctr(metadata.data_type),
    fill_value: metadata.fill_value
  };
  if (configuration) {
    let native_order2 = get_array_order(configuration.codecs);
    return {
      ...shared_context,
      kind: "sharded",
      chunk_shape: configuration.chunk_shape,
      codec: create_codec_pipeline({
        data_type: metadata.data_type,
        shape: configuration.chunk_shape,
        codecs: configuration.codecs
      }),
      get_strides(shape, order) {
        return get_strides(shape, order ?? native_order2);
      },
      get_chunk_bytes: create_sharded_chunk_getter(location, metadata.chunk_grid.configuration.chunk_shape, shared_context.encode_chunk_key, configuration)
    };
  }
  let native_order = get_array_order(metadata.codecs);
  return {
    ...shared_context,
    kind: "regular",
    chunk_shape: metadata.chunk_grid.configuration.chunk_shape,
    codec: create_codec_pipeline({
      data_type: metadata.data_type,
      shape: metadata.chunk_grid.configuration.chunk_shape,
      codecs: metadata.codecs
    }),
    get_strides(shape, order) {
      return get_strides(shape, order ?? native_order);
    },
    async get_chunk_bytes(chunk_coords, options) {
      let chunk_key = shared_context.encode_chunk_key(chunk_coords);
      let chunk_path = location.resolve(chunk_key).path;
      return location.store.get(chunk_path, options);
    }
  };
}
let Array$1 = class Array2 extends Location {
  kind = "array";
  #metadata;
  [CONTEXT_MARKER];
  constructor(store, path, metadata) {
    super(store, path);
    this.#metadata = {
      ...metadata,
      fill_value: ensure_correct_scalar(metadata)
    };
    this[CONTEXT_MARKER] = create_context(this, metadata);
  }
  get attrs() {
    return this.#metadata.attributes;
  }
  get shape() {
    return this.#metadata.shape;
  }
  get chunks() {
    return this[CONTEXT_MARKER].chunk_shape;
  }
  get dtype() {
    return this.#metadata.data_type;
  }
  async getChunk(chunk_coords, options) {
    let context = this[CONTEXT_MARKER];
    let maybe_bytes = await context.get_chunk_bytes(chunk_coords, options);
    if (!maybe_bytes) {
      let size = context.chunk_shape.reduce((a, b) => a * b, 1);
      let data = new context.TypedArray(size);
      data.fill(context.fill_value);
      return {
        data,
        shape: context.chunk_shape,
        stride: context.get_strides(context.chunk_shape)
      };
    }
    return context.codec.decode(maybe_bytes);
  }
  /**
   * A helper method to narrow `zarr.Array` Dtype.
   *
   * ```typescript
   * let arr: zarr.Array<DataType, FetchStore> = zarr.open(store, { kind: "array" });
   *
   * // Option 1: narrow by scalar type (e.g. "bool", "raw", "bigint", "number")
   * if (arr.is("bigint")) {
   *   // zarr.Array<"int64" | "uint64", FetchStore>
   * }
   *
   * // Option 3: exact match
   * if (arr.is("float32")) {
   *   // zarr.Array<"float32", FetchStore, "/">
   * }
   * ```
   */
  is(query) {
    return is_dtype(this.dtype, query);
  }
};
let VERSION_COUNTER = create_version_counter();
function create_version_counter() {
  let version_counts = /* @__PURE__ */ new WeakMap();
  function get_counts(store) {
    let counts = version_counts.get(store) ?? { v2: 0, v3: 0 };
    version_counts.set(store, counts);
    return counts;
  }
  return {
    increment(store, version) {
      get_counts(store)[version] += 1;
    },
    version_max(store) {
      let counts = get_counts(store);
      return counts.v3 > counts.v2 ? "v3" : "v2";
    }
  };
}
async function load_attrs(location) {
  let meta_bytes = await location.store.get(location.resolve(".zattrs").path);
  if (!meta_bytes)
    return {};
  return json_decode_object(meta_bytes);
}
async function open_v2(location, options = {}) {
  let loc = "store" in location ? location : new Location(location);
  let attrs = {};
  if (options.attrs ?? true)
    attrs = await load_attrs(loc);
  if (options.kind === "array")
    return open_array_v2(loc, attrs);
  if (options.kind === "group")
    return open_group_v2(loc, attrs);
  return open_array_v2(loc, attrs).catch((err) => {
    if (err instanceof NodeNotFoundError)
      return open_group_v2(loc, attrs);
    throw err;
  });
}
async function open_array_v2(location, attrs) {
  let { path } = location.resolve(".zarray");
  let meta = await location.store.get(path);
  if (!meta) {
    throw new NodeNotFoundError("v2 array", {
      cause: new KeyError(path)
    });
  }
  VERSION_COUNTER.increment(location.store, "v2");
  return new Array$1(location.store, location.path, v2_to_v3_array_metadata(json_decode_object(meta), attrs));
}
async function open_group_v2(location, attrs) {
  let { path } = location.resolve(".zgroup");
  let meta = await location.store.get(path);
  if (!meta) {
    throw new NodeNotFoundError("v2 group", {
      cause: new KeyError(path)
    });
  }
  VERSION_COUNTER.increment(location.store, "v2");
  return new Group(location.store, location.path, v2_to_v3_group_metadata(json_decode_object(meta), attrs));
}
async function _open_v3(location) {
  let { store, path } = location.resolve("zarr.json");
  let meta = await location.store.get(path);
  if (!meta) {
    throw new NodeNotFoundError("v3 array or group", {
      cause: new KeyError(path)
    });
  }
  let meta_doc = json_decode_object(meta);
  if (meta_doc.node_type === "array") {
    meta_doc.fill_value = ensure_correct_scalar(meta_doc);
  }
  return meta_doc.node_type === "array" ? new Array$1(store, location.path, meta_doc) : new Group(store, location.path, meta_doc);
}
async function open_v3(location, options = {}) {
  let loc = "store" in location ? location : new Location(location);
  let node = await _open_v3(loc);
  VERSION_COUNTER.increment(loc.store, "v3");
  if (options.kind === void 0)
    return node;
  if (options.kind === "array" && node instanceof Array$1)
    return node;
  if (options.kind === "group" && node instanceof Group)
    return node;
  let kind = node instanceof Array$1 ? "array" : "group";
  throw new Error(`Expected node of kind ${options.kind}, found ${kind}.`);
}
async function open(location, options = {}) {
  let store = "store" in location ? location.store : location;
  let version_max = VERSION_COUNTER.version_max(store);
  let open_primary = version_max === "v2" ? open.v2 : open.v3;
  let open_secondary = version_max === "v2" ? open.v3 : open.v2;
  return open_primary(location, options).catch((err) => {
    if (err instanceof NodeNotFoundError) {
      return open_secondary(location, options);
    }
    throw err;
  });
}
open.v2 = open_v2;
open.v3 = open_v3;
function fetch_range(url, offset, length2, opts = {}) {
  if (offset !== void 0 && length2 !== void 0) {
    opts = {
      ...opts,
      headers: {
        ...opts.headers,
        Range: `bytes=${offset}-${offset + length2 - 1}`
      }
    };
  }
  return fetch(url, opts);
}
function merge_init(storeOverrides, requestOverrides) {
  return {
    ...storeOverrides,
    ...requestOverrides,
    headers: {
      ...storeOverrides.headers,
      ...requestOverrides.headers
    }
  };
}
function resolve(root, path) {
  const base = typeof root === "string" ? new URL(root) : root;
  if (!base.pathname.endsWith("/")) {
    base.pathname += "/";
  }
  const resolved = new URL(path.slice(1), base);
  resolved.search = base.search;
  return resolved;
}
async function handle_response(response) {
  if (response.status === 404) {
    return void 0;
  }
  if (response.status === 200 || response.status === 206) {
    return new Uint8Array(await response.arrayBuffer());
  }
  throw new Error(`Unexpected response status ${response.status} ${response.statusText}`);
}
async function fetch_suffix(url, suffix_length, init, use_suffix_request) {
  if (use_suffix_request) {
    return fetch(url, {
      ...init,
      headers: { ...init.headers, Range: `bytes=-${suffix_length}` }
    });
  }
  let response = await fetch(url, { ...init, method: "HEAD" });
  if (!response.ok) {
    return response;
  }
  let content_length = response.headers.get("Content-Length");
  let length2 = Number(content_length);
  return fetch_range(url, length2 - suffix_length, length2, init);
}
class FetchStore {
  url;
  #overrides;
  #use_suffix_request;
  constructor(url, options = {}) {
    this.url = url;
    this.#overrides = options.overrides ?? {};
    this.#use_suffix_request = options.useSuffixRequest ?? false;
  }
  #merge_init(overrides) {
    return merge_init(this.#overrides, overrides);
  }
  async get(key, options = {}) {
    let href = resolve(this.url, key).href;
    let response = await fetch(href, this.#merge_init(options));
    return handle_response(response);
  }
  async getRange(key, range, options = {}) {
    let url = resolve(this.url, key);
    let init = this.#merge_init(options);
    let response;
    if ("suffixLength" in range) {
      response = await fetch_suffix(url, range.suffixLength, init, this.#use_suffix_request);
    } else {
      response = await fetch_range(url, range.offset, range.length, init);
    }
    return handle_response(response);
  }
}
async function openGroup(location, version) {
  try {
    return open(location, { kind: "group" });
  } catch {
    throw new Error(`Failed to open Zarr group at ${location}`);
  }
}
async function openArray(location, version) {
  if (version === "v2") {
    try {
      return open.v2(location, { kind: "array", attrs: false });
    } catch {
      throw new Error(`Failed to open Zarr v2 array at ${location}`);
    }
  }
  if (version === "v3") {
    try {
      return open.v3(location, { kind: "array" });
    } catch {
      throw new Error(`Failed to open Zarr v3 array at ${location}`);
    }
  }
  try {
    return open(location, { kind: "array" });
  } catch {
    throw new Error(`Failed to open Zarr array at ${location}`);
  }
}
var util;
(function(util2) {
  util2.assertEqual = (val) => val;
  function assertIs(_arg) {
  }
  util2.assertIs = assertIs;
  function assertNever(_x) {
    throw new Error();
  }
  util2.assertNever = assertNever;
  util2.arrayToEnum = (items) => {
    const obj = {};
    for (const item of items) {
      obj[item] = item;
    }
    return obj;
  };
  util2.getValidEnumValues = (obj) => {
    const validKeys = util2.objectKeys(obj).filter((k) => typeof obj[obj[k]] !== "number");
    const filtered = {};
    for (const k of validKeys) {
      filtered[k] = obj[k];
    }
    return util2.objectValues(filtered);
  };
  util2.objectValues = (obj) => {
    return util2.objectKeys(obj).map(function(e) {
      return obj[e];
    });
  };
  util2.objectKeys = typeof Object.keys === "function" ? (obj) => Object.keys(obj) : (object) => {
    const keys = [];
    for (const key in object) {
      if (Object.prototype.hasOwnProperty.call(object, key)) {
        keys.push(key);
      }
    }
    return keys;
  };
  util2.find = (arr, checker) => {
    for (const item of arr) {
      if (checker(item))
        return item;
    }
    return void 0;
  };
  util2.isInteger = typeof Number.isInteger === "function" ? (val) => Number.isInteger(val) : (val) => typeof val === "number" && isFinite(val) && Math.floor(val) === val;
  function joinValues(array, separator = " | ") {
    return array.map((val) => typeof val === "string" ? `'${val}'` : val).join(separator);
  }
  util2.joinValues = joinValues;
  util2.jsonStringifyReplacer = (_, value) => {
    if (typeof value === "bigint") {
      return value.toString();
    }
    return value;
  };
})(util || (util = {}));
var objectUtil;
(function(objectUtil2) {
  objectUtil2.mergeShapes = (first, second) => {
    return {
      ...first,
      ...second
      // second overwrites first
    };
  };
})(objectUtil || (objectUtil = {}));
const ZodParsedType = util.arrayToEnum([
  "string",
  "nan",
  "number",
  "integer",
  "float",
  "boolean",
  "date",
  "bigint",
  "symbol",
  "function",
  "undefined",
  "null",
  "array",
  "object",
  "unknown",
  "promise",
  "void",
  "never",
  "map",
  "set"
]);
const getParsedType = (data) => {
  const t = typeof data;
  switch (t) {
    case "undefined":
      return ZodParsedType.undefined;
    case "string":
      return ZodParsedType.string;
    case "number":
      return isNaN(data) ? ZodParsedType.nan : ZodParsedType.number;
    case "boolean":
      return ZodParsedType.boolean;
    case "function":
      return ZodParsedType.function;
    case "bigint":
      return ZodParsedType.bigint;
    case "symbol":
      return ZodParsedType.symbol;
    case "object":
      if (Array.isArray(data)) {
        return ZodParsedType.array;
      }
      if (data === null) {
        return ZodParsedType.null;
      }
      if (data.then && typeof data.then === "function" && data.catch && typeof data.catch === "function") {
        return ZodParsedType.promise;
      }
      if (typeof Map !== "undefined" && data instanceof Map) {
        return ZodParsedType.map;
      }
      if (typeof Set !== "undefined" && data instanceof Set) {
        return ZodParsedType.set;
      }
      if (typeof Date !== "undefined" && data instanceof Date) {
        return ZodParsedType.date;
      }
      return ZodParsedType.object;
    default:
      return ZodParsedType.unknown;
  }
};
const ZodIssueCode = util.arrayToEnum([
  "invalid_type",
  "invalid_literal",
  "custom",
  "invalid_union",
  "invalid_union_discriminator",
  "invalid_enum_value",
  "unrecognized_keys",
  "invalid_arguments",
  "invalid_return_type",
  "invalid_date",
  "invalid_string",
  "too_small",
  "too_big",
  "invalid_intersection_types",
  "not_multiple_of",
  "not_finite"
]);
const quotelessJson = (obj) => {
  const json = JSON.stringify(obj, null, 2);
  return json.replace(/"([^"]+)":/g, "$1:");
};
class ZodError extends Error {
  get errors() {
    return this.issues;
  }
  constructor(issues) {
    super();
    this.issues = [];
    this.addIssue = (sub2) => {
      this.issues = [...this.issues, sub2];
    };
    this.addIssues = (subs = []) => {
      this.issues = [...this.issues, ...subs];
    };
    const actualProto = new.target.prototype;
    if (Object.setPrototypeOf) {
      Object.setPrototypeOf(this, actualProto);
    } else {
      this.__proto__ = actualProto;
    }
    this.name = "ZodError";
    this.issues = issues;
  }
  format(_mapper) {
    const mapper = _mapper || function(issue) {
      return issue.message;
    };
    const fieldErrors = { _errors: [] };
    const processError = (error) => {
      for (const issue of error.issues) {
        if (issue.code === "invalid_union") {
          issue.unionErrors.map(processError);
        } else if (issue.code === "invalid_return_type") {
          processError(issue.returnTypeError);
        } else if (issue.code === "invalid_arguments") {
          processError(issue.argumentsError);
        } else if (issue.path.length === 0) {
          fieldErrors._errors.push(mapper(issue));
        } else {
          let curr = fieldErrors;
          let i = 0;
          while (i < issue.path.length) {
            const el = issue.path[i];
            const terminal = i === issue.path.length - 1;
            if (!terminal) {
              curr[el] = curr[el] || { _errors: [] };
            } else {
              curr[el] = curr[el] || { _errors: [] };
              curr[el]._errors.push(mapper(issue));
            }
            curr = curr[el];
            i++;
          }
        }
      }
    };
    processError(this);
    return fieldErrors;
  }
  static assert(value) {
    if (!(value instanceof ZodError)) {
      throw new Error(`Not a ZodError: ${value}`);
    }
  }
  toString() {
    return this.message;
  }
  get message() {
    return JSON.stringify(this.issues, util.jsonStringifyReplacer, 2);
  }
  get isEmpty() {
    return this.issues.length === 0;
  }
  flatten(mapper = (issue) => issue.message) {
    const fieldErrors = {};
    const formErrors = [];
    for (const sub2 of this.issues) {
      if (sub2.path.length > 0) {
        fieldErrors[sub2.path[0]] = fieldErrors[sub2.path[0]] || [];
        fieldErrors[sub2.path[0]].push(mapper(sub2));
      } else {
        formErrors.push(mapper(sub2));
      }
    }
    return { formErrors, fieldErrors };
  }
  get formErrors() {
    return this.flatten();
  }
}
ZodError.create = (issues) => {
  const error = new ZodError(issues);
  return error;
};
const errorMap = (issue, _ctx) => {
  let message;
  switch (issue.code) {
    case ZodIssueCode.invalid_type:
      if (issue.received === ZodParsedType.undefined) {
        message = "Required";
      } else {
        message = `Expected ${issue.expected}, received ${issue.received}`;
      }
      break;
    case ZodIssueCode.invalid_literal:
      message = `Invalid literal value, expected ${JSON.stringify(issue.expected, util.jsonStringifyReplacer)}`;
      break;
    case ZodIssueCode.unrecognized_keys:
      message = `Unrecognized key(s) in object: ${util.joinValues(issue.keys, ", ")}`;
      break;
    case ZodIssueCode.invalid_union:
      message = `Invalid input`;
      break;
    case ZodIssueCode.invalid_union_discriminator:
      message = `Invalid discriminator value. Expected ${util.joinValues(issue.options)}`;
      break;
    case ZodIssueCode.invalid_enum_value:
      message = `Invalid enum value. Expected ${util.joinValues(issue.options)}, received '${issue.received}'`;
      break;
    case ZodIssueCode.invalid_arguments:
      message = `Invalid function arguments`;
      break;
    case ZodIssueCode.invalid_return_type:
      message = `Invalid function return type`;
      break;
    case ZodIssueCode.invalid_date:
      message = `Invalid date`;
      break;
    case ZodIssueCode.invalid_string:
      if (typeof issue.validation === "object") {
        if ("includes" in issue.validation) {
          message = `Invalid input: must include "${issue.validation.includes}"`;
          if (typeof issue.validation.position === "number") {
            message = `${message} at one or more positions greater than or equal to ${issue.validation.position}`;
          }
        } else if ("startsWith" in issue.validation) {
          message = `Invalid input: must start with "${issue.validation.startsWith}"`;
        } else if ("endsWith" in issue.validation) {
          message = `Invalid input: must end with "${issue.validation.endsWith}"`;
        } else {
          util.assertNever(issue.validation);
        }
      } else if (issue.validation !== "regex") {
        message = `Invalid ${issue.validation}`;
      } else {
        message = "Invalid";
      }
      break;
    case ZodIssueCode.too_small:
      if (issue.type === "array")
        message = `Array must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `more than`} ${issue.minimum} element(s)`;
      else if (issue.type === "string")
        message = `String must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `over`} ${issue.minimum} character(s)`;
      else if (issue.type === "number")
        message = `Number must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${issue.minimum}`;
      else if (issue.type === "date")
        message = `Date must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${new Date(Number(issue.minimum))}`;
      else
        message = "Invalid input";
      break;
    case ZodIssueCode.too_big:
      if (issue.type === "array")
        message = `Array must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `less than`} ${issue.maximum} element(s)`;
      else if (issue.type === "string")
        message = `String must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `under`} ${issue.maximum} character(s)`;
      else if (issue.type === "number")
        message = `Number must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`;
      else if (issue.type === "bigint")
        message = `BigInt must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`;
      else if (issue.type === "date")
        message = `Date must be ${issue.exact ? `exactly` : issue.inclusive ? `smaller than or equal to` : `smaller than`} ${new Date(Number(issue.maximum))}`;
      else
        message = "Invalid input";
      break;
    case ZodIssueCode.custom:
      message = `Invalid input`;
      break;
    case ZodIssueCode.invalid_intersection_types:
      message = `Intersection results could not be merged`;
      break;
    case ZodIssueCode.not_multiple_of:
      message = `Number must be a multiple of ${issue.multipleOf}`;
      break;
    case ZodIssueCode.not_finite:
      message = "Number must be finite";
      break;
    default:
      message = _ctx.defaultError;
      util.assertNever(issue);
  }
  return { message };
};
let overrideErrorMap = errorMap;
function setErrorMap(map) {
  overrideErrorMap = map;
}
function getErrorMap() {
  return overrideErrorMap;
}
const makeIssue = (params) => {
  const { data, path, errorMaps, issueData } = params;
  const fullPath = [...path, ...issueData.path || []];
  const fullIssue = {
    ...issueData,
    path: fullPath
  };
  if (issueData.message !== void 0) {
    return {
      ...issueData,
      path: fullPath,
      message: issueData.message
    };
  }
  let errorMessage = "";
  const maps = errorMaps.filter((m) => !!m).slice().reverse();
  for (const map of maps) {
    errorMessage = map(fullIssue, { data, defaultError: errorMessage }).message;
  }
  return {
    ...issueData,
    path: fullPath,
    message: errorMessage
  };
};
const EMPTY_PATH = [];
function addIssueToContext(ctx, issueData) {
  const overrideMap = getErrorMap();
  const issue = makeIssue({
    issueData,
    data: ctx.data,
    path: ctx.path,
    errorMaps: [
      ctx.common.contextualErrorMap,
      // contextual error map is first priority
      ctx.schemaErrorMap,
      // then schema-bound map if available
      overrideMap,
      // then global override map
      overrideMap === errorMap ? void 0 : errorMap
      // then global default map
    ].filter((x) => !!x)
  });
  ctx.common.issues.push(issue);
}
class ParseStatus {
  constructor() {
    this.value = "valid";
  }
  dirty() {
    if (this.value === "valid")
      this.value = "dirty";
  }
  abort() {
    if (this.value !== "aborted")
      this.value = "aborted";
  }
  static mergeArray(status, results) {
    const arrayValue = [];
    for (const s of results) {
      if (s.status === "aborted")
        return INVALID;
      if (s.status === "dirty")
        status.dirty();
      arrayValue.push(s.value);
    }
    return { status: status.value, value: arrayValue };
  }
  static async mergeObjectAsync(status, pairs) {
    const syncPairs = [];
    for (const pair of pairs) {
      const key = await pair.key;
      const value = await pair.value;
      syncPairs.push({
        key,
        value
      });
    }
    return ParseStatus.mergeObjectSync(status, syncPairs);
  }
  static mergeObjectSync(status, pairs) {
    const finalObject = {};
    for (const pair of pairs) {
      const { key, value } = pair;
      if (key.status === "aborted")
        return INVALID;
      if (value.status === "aborted")
        return INVALID;
      if (key.status === "dirty")
        status.dirty();
      if (value.status === "dirty")
        status.dirty();
      if (key.value !== "__proto__" && (typeof value.value !== "undefined" || pair.alwaysSet)) {
        finalObject[key.value] = value.value;
      }
    }
    return { status: status.value, value: finalObject };
  }
}
const INVALID = Object.freeze({
  status: "aborted"
});
const DIRTY = (value) => ({ status: "dirty", value });
const OK = (value) => ({ status: "valid", value });
const isAborted = (x) => x.status === "aborted";
const isDirty = (x) => x.status === "dirty";
const isValid = (x) => x.status === "valid";
const isAsync = (x) => typeof Promise !== "undefined" && x instanceof Promise;
function __classPrivateFieldGet(receiver, state, kind, f) {
  if (typeof state === "function" ? receiver !== state || true : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
  return state.get(receiver);
}
function __classPrivateFieldSet(receiver, state, value, kind, f) {
  if (typeof state === "function" ? receiver !== state || true : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
  return state.set(receiver, value), value;
}
typeof SuppressedError === "function" ? SuppressedError : function(error, suppressed, message) {
  var e = new Error(message);
  return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
};
var errorUtil;
(function(errorUtil2) {
  errorUtil2.errToObj = (message) => typeof message === "string" ? { message } : message || {};
  errorUtil2.toString = (message) => typeof message === "string" ? message : message === null || message === void 0 ? void 0 : message.message;
})(errorUtil || (errorUtil = {}));
var _ZodEnum_cache, _ZodNativeEnum_cache;
class ParseInputLazyPath {
  constructor(parent, value, path, key) {
    this._cachedPath = [];
    this.parent = parent;
    this.data = value;
    this._path = path;
    this._key = key;
  }
  get path() {
    if (!this._cachedPath.length) {
      if (this._key instanceof Array) {
        this._cachedPath.push(...this._path, ...this._key);
      } else {
        this._cachedPath.push(...this._path, this._key);
      }
    }
    return this._cachedPath;
  }
}
const handleResult = (ctx, result) => {
  if (isValid(result)) {
    return { success: true, data: result.value };
  } else {
    if (!ctx.common.issues.length) {
      throw new Error("Validation failed but no issues detected.");
    }
    return {
      success: false,
      get error() {
        if (this._error)
          return this._error;
        const error = new ZodError(ctx.common.issues);
        this._error = error;
        return this._error;
      }
    };
  }
};
function processCreateParams(params) {
  if (!params)
    return {};
  const { errorMap: errorMap2, invalid_type_error, required_error, description } = params;
  if (errorMap2 && (invalid_type_error || required_error)) {
    throw new Error(`Can't use "invalid_type_error" or "required_error" in conjunction with custom error map.`);
  }
  if (errorMap2)
    return { errorMap: errorMap2, description };
  const customMap = (iss, ctx) => {
    var _a, _b;
    const { message } = params;
    if (iss.code === "invalid_enum_value") {
      return { message: message !== null && message !== void 0 ? message : ctx.defaultError };
    }
    if (typeof ctx.data === "undefined") {
      return { message: (_a = message !== null && message !== void 0 ? message : required_error) !== null && _a !== void 0 ? _a : ctx.defaultError };
    }
    if (iss.code !== "invalid_type")
      return { message: ctx.defaultError };
    return { message: (_b = message !== null && message !== void 0 ? message : invalid_type_error) !== null && _b !== void 0 ? _b : ctx.defaultError };
  };
  return { errorMap: customMap, description };
}
class ZodType {
  get description() {
    return this._def.description;
  }
  _getType(input) {
    return getParsedType(input.data);
  }
  _getOrReturnCtx(input, ctx) {
    return ctx || {
      common: input.parent.common,
      data: input.data,
      parsedType: getParsedType(input.data),
      schemaErrorMap: this._def.errorMap,
      path: input.path,
      parent: input.parent
    };
  }
  _processInputParams(input) {
    return {
      status: new ParseStatus(),
      ctx: {
        common: input.parent.common,
        data: input.data,
        parsedType: getParsedType(input.data),
        schemaErrorMap: this._def.errorMap,
        path: input.path,
        parent: input.parent
      }
    };
  }
  _parseSync(input) {
    const result = this._parse(input);
    if (isAsync(result)) {
      throw new Error("Synchronous parse encountered promise.");
    }
    return result;
  }
  _parseAsync(input) {
    const result = this._parse(input);
    return Promise.resolve(result);
  }
  parse(data, params) {
    const result = this.safeParse(data, params);
    if (result.success)
      return result.data;
    throw result.error;
  }
  safeParse(data, params) {
    var _a;
    const ctx = {
      common: {
        issues: [],
        async: (_a = params === null || params === void 0 ? void 0 : params.async) !== null && _a !== void 0 ? _a : false,
        contextualErrorMap: params === null || params === void 0 ? void 0 : params.errorMap
      },
      path: (params === null || params === void 0 ? void 0 : params.path) || [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data)
    };
    const result = this._parseSync({ data, path: ctx.path, parent: ctx });
    return handleResult(ctx, result);
  }
  "~validate"(data) {
    var _a, _b;
    const ctx = {
      common: {
        issues: [],
        async: !!this["~standard"].async
      },
      path: [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data)
    };
    if (!this["~standard"].async) {
      try {
        const result = this._parseSync({ data, path: [], parent: ctx });
        return isValid(result) ? {
          value: result.value
        } : {
          issues: ctx.common.issues
        };
      } catch (err) {
        if ((_b = (_a = err === null || err === void 0 ? void 0 : err.message) === null || _a === void 0 ? void 0 : _a.toLowerCase()) === null || _b === void 0 ? void 0 : _b.includes("encountered")) {
          this["~standard"].async = true;
        }
        ctx.common = {
          issues: [],
          async: true
        };
      }
    }
    return this._parseAsync({ data, path: [], parent: ctx }).then((result) => isValid(result) ? {
      value: result.value
    } : {
      issues: ctx.common.issues
    });
  }
  async parseAsync(data, params) {
    const result = await this.safeParseAsync(data, params);
    if (result.success)
      return result.data;
    throw result.error;
  }
  async safeParseAsync(data, params) {
    const ctx = {
      common: {
        issues: [],
        contextualErrorMap: params === null || params === void 0 ? void 0 : params.errorMap,
        async: true
      },
      path: (params === null || params === void 0 ? void 0 : params.path) || [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data)
    };
    const maybeAsyncResult = this._parse({ data, path: ctx.path, parent: ctx });
    const result = await (isAsync(maybeAsyncResult) ? maybeAsyncResult : Promise.resolve(maybeAsyncResult));
    return handleResult(ctx, result);
  }
  refine(check, message) {
    const getIssueProperties = (val) => {
      if (typeof message === "string" || typeof message === "undefined") {
        return { message };
      } else if (typeof message === "function") {
        return message(val);
      } else {
        return message;
      }
    };
    return this._refinement((val, ctx) => {
      const result = check(val);
      const setError = () => ctx.addIssue({
        code: ZodIssueCode.custom,
        ...getIssueProperties(val)
      });
      if (typeof Promise !== "undefined" && result instanceof Promise) {
        return result.then((data) => {
          if (!data) {
            setError();
            return false;
          } else {
            return true;
          }
        });
      }
      if (!result) {
        setError();
        return false;
      } else {
        return true;
      }
    });
  }
  refinement(check, refinementData) {
    return this._refinement((val, ctx) => {
      if (!check(val)) {
        ctx.addIssue(typeof refinementData === "function" ? refinementData(val, ctx) : refinementData);
        return false;
      } else {
        return true;
      }
    });
  }
  _refinement(refinement) {
    return new ZodEffects({
      schema: this,
      typeName: ZodFirstPartyTypeKind.ZodEffects,
      effect: { type: "refinement", refinement }
    });
  }
  superRefine(refinement) {
    return this._refinement(refinement);
  }
  constructor(def) {
    this.spa = this.safeParseAsync;
    this._def = def;
    this.parse = this.parse.bind(this);
    this.safeParse = this.safeParse.bind(this);
    this.parseAsync = this.parseAsync.bind(this);
    this.safeParseAsync = this.safeParseAsync.bind(this);
    this.spa = this.spa.bind(this);
    this.refine = this.refine.bind(this);
    this.refinement = this.refinement.bind(this);
    this.superRefine = this.superRefine.bind(this);
    this.optional = this.optional.bind(this);
    this.nullable = this.nullable.bind(this);
    this.nullish = this.nullish.bind(this);
    this.array = this.array.bind(this);
    this.promise = this.promise.bind(this);
    this.or = this.or.bind(this);
    this.and = this.and.bind(this);
    this.transform = this.transform.bind(this);
    this.brand = this.brand.bind(this);
    this.default = this.default.bind(this);
    this.catch = this.catch.bind(this);
    this.describe = this.describe.bind(this);
    this.pipe = this.pipe.bind(this);
    this.readonly = this.readonly.bind(this);
    this.isNullable = this.isNullable.bind(this);
    this.isOptional = this.isOptional.bind(this);
    this["~standard"] = {
      version: 1,
      vendor: "zod",
      validate: (data) => this["~validate"](data)
    };
  }
  optional() {
    return ZodOptional.create(this, this._def);
  }
  nullable() {
    return ZodNullable.create(this, this._def);
  }
  nullish() {
    return this.nullable().optional();
  }
  array() {
    return ZodArray.create(this);
  }
  promise() {
    return ZodPromise.create(this, this._def);
  }
  or(option) {
    return ZodUnion.create([this, option], this._def);
  }
  and(incoming) {
    return ZodIntersection.create(this, incoming, this._def);
  }
  transform(transform) {
    return new ZodEffects({
      ...processCreateParams(this._def),
      schema: this,
      typeName: ZodFirstPartyTypeKind.ZodEffects,
      effect: { type: "transform", transform }
    });
  }
  default(def) {
    const defaultValueFunc = typeof def === "function" ? def : () => def;
    return new ZodDefault({
      ...processCreateParams(this._def),
      innerType: this,
      defaultValue: defaultValueFunc,
      typeName: ZodFirstPartyTypeKind.ZodDefault
    });
  }
  brand() {
    return new ZodBranded({
      typeName: ZodFirstPartyTypeKind.ZodBranded,
      type: this,
      ...processCreateParams(this._def)
    });
  }
  catch(def) {
    const catchValueFunc = typeof def === "function" ? def : () => def;
    return new ZodCatch({
      ...processCreateParams(this._def),
      innerType: this,
      catchValue: catchValueFunc,
      typeName: ZodFirstPartyTypeKind.ZodCatch
    });
  }
  describe(description) {
    const This = this.constructor;
    return new This({
      ...this._def,
      description
    });
  }
  pipe(target) {
    return ZodPipeline.create(this, target);
  }
  readonly() {
    return ZodReadonly.create(this);
  }
  isOptional() {
    return this.safeParse(void 0).success;
  }
  isNullable() {
    return this.safeParse(null).success;
  }
}
const cuidRegex = /^c[^\s-]{8,}$/i;
const cuid2Regex = /^[0-9a-z]+$/;
const ulidRegex = /^[0-9A-HJKMNP-TV-Z]{26}$/i;
const uuidRegex = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/i;
const nanoidRegex = /^[a-z0-9_-]{21}$/i;
const jwtRegex = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/;
const durationRegex = /^[-+]?P(?!$)(?:(?:[-+]?\d+Y)|(?:[-+]?\d+[.,]\d+Y$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:(?:[-+]?\d+W)|(?:[-+]?\d+[.,]\d+W$))?(?:(?:[-+]?\d+D)|(?:[-+]?\d+[.,]\d+D$))?(?:T(?=[\d+-])(?:(?:[-+]?\d+H)|(?:[-+]?\d+[.,]\d+H$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:[-+]?\d+(?:[.,]\d+)?S)?)??$/;
const emailRegex = /^(?!\.)(?!.*\.\.)([A-Z0-9_'+\-\.]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9\-]*\.)+[A-Z]{2,}$/i;
const _emojiRegex = `^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$`;
let emojiRegex;
const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/;
const ipv4CidrRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/(3[0-2]|[12]?[0-9])$/;
const ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;
const ipv6CidrRegex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/;
const base64Regex = /^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/;
const base64urlRegex = /^([0-9a-zA-Z-_]{4})*(([0-9a-zA-Z-_]{2}(==)?)|([0-9a-zA-Z-_]{3}(=)?))?$/;
const dateRegexSource = `((\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-((0[13578]|1[02])-(0[1-9]|[12]\\d|3[01])|(0[469]|11)-(0[1-9]|[12]\\d|30)|(02)-(0[1-9]|1\\d|2[0-8])))`;
const dateRegex = new RegExp(`^${dateRegexSource}$`);
function timeRegexSource(args) {
  let regex = `([01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d`;
  if (args.precision) {
    regex = `${regex}\\.\\d{${args.precision}}`;
  } else if (args.precision == null) {
    regex = `${regex}(\\.\\d+)?`;
  }
  return regex;
}
function timeRegex(args) {
  return new RegExp(`^${timeRegexSource(args)}$`);
}
function datetimeRegex(args) {
  let regex = `${dateRegexSource}T${timeRegexSource(args)}`;
  const opts = [];
  opts.push(args.local ? `Z?` : `Z`);
  if (args.offset)
    opts.push(`([+-]\\d{2}:?\\d{2})`);
  regex = `${regex}(${opts.join("|")})`;
  return new RegExp(`^${regex}$`);
}
function isValidIP(ip, version) {
  if ((version === "v4" || !version) && ipv4Regex.test(ip)) {
    return true;
  }
  if ((version === "v6" || !version) && ipv6Regex.test(ip)) {
    return true;
  }
  return false;
}
function isValidJWT(jwt, alg) {
  if (!jwtRegex.test(jwt))
    return false;
  try {
    const [header] = jwt.split(".");
    const base64 = header.replace(/-/g, "+").replace(/_/g, "/").padEnd(header.length + (4 - header.length % 4) % 4, "=");
    const decoded = JSON.parse(atob(base64));
    if (typeof decoded !== "object" || decoded === null)
      return false;
    if (!decoded.typ || !decoded.alg)
      return false;
    if (alg && decoded.alg !== alg)
      return false;
    return true;
  } catch (_a) {
    return false;
  }
}
function isValidCidr(ip, version) {
  if ((version === "v4" || !version) && ipv4CidrRegex.test(ip)) {
    return true;
  }
  if ((version === "v6" || !version) && ipv6CidrRegex.test(ip)) {
    return true;
  }
  return false;
}
class ZodString extends ZodType {
  _parse(input) {
    if (this._def.coerce) {
      input.data = String(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.string) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.string,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    const status = new ParseStatus();
    let ctx = void 0;
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        if (input.data.length < check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            minimum: check.value,
            type: "string",
            inclusive: true,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        if (input.data.length > check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            maximum: check.value,
            type: "string",
            inclusive: true,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "length") {
        const tooBig = input.data.length > check.value;
        const tooSmall = input.data.length < check.value;
        if (tooBig || tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          if (tooBig) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_big,
              maximum: check.value,
              type: "string",
              inclusive: true,
              exact: true,
              message: check.message
            });
          } else if (tooSmall) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_small,
              minimum: check.value,
              type: "string",
              inclusive: true,
              exact: true,
              message: check.message
            });
          }
          status.dirty();
        }
      } else if (check.kind === "email") {
        if (!emailRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "email",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "emoji") {
        if (!emojiRegex) {
          emojiRegex = new RegExp(_emojiRegex, "u");
        }
        if (!emojiRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "emoji",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "uuid") {
        if (!uuidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "uuid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "nanoid") {
        if (!nanoidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "nanoid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "cuid") {
        if (!cuidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "cuid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "cuid2") {
        if (!cuid2Regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "cuid2",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "ulid") {
        if (!ulidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "ulid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "url") {
        try {
          new URL(input.data);
        } catch (_a) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "url",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "regex") {
        check.regex.lastIndex = 0;
        const testResult = check.regex.test(input.data);
        if (!testResult) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "regex",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "trim") {
        input.data = input.data.trim();
      } else if (check.kind === "includes") {
        if (!input.data.includes(check.value, check.position)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { includes: check.value, position: check.position },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "toLowerCase") {
        input.data = input.data.toLowerCase();
      } else if (check.kind === "toUpperCase") {
        input.data = input.data.toUpperCase();
      } else if (check.kind === "startsWith") {
        if (!input.data.startsWith(check.value)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { startsWith: check.value },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "endsWith") {
        if (!input.data.endsWith(check.value)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { endsWith: check.value },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "datetime") {
        const regex = datetimeRegex(check);
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "datetime",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "date") {
        const regex = dateRegex;
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "date",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "time") {
        const regex = timeRegex(check);
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "time",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "duration") {
        if (!durationRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "duration",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "ip") {
        if (!isValidIP(input.data, check.version)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "ip",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "jwt") {
        if (!isValidJWT(input.data, check.alg)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "jwt",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "cidr") {
        if (!isValidCidr(input.data, check.version)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "cidr",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "base64") {
        if (!base64Regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "base64",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "base64url") {
        if (!base64urlRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "base64url",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  _regex(regex, validation, message) {
    return this.refinement((data) => regex.test(data), {
      validation,
      code: ZodIssueCode.invalid_string,
      ...errorUtil.errToObj(message)
    });
  }
  _addCheck(check) {
    return new ZodString({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  email(message) {
    return this._addCheck({ kind: "email", ...errorUtil.errToObj(message) });
  }
  url(message) {
    return this._addCheck({ kind: "url", ...errorUtil.errToObj(message) });
  }
  emoji(message) {
    return this._addCheck({ kind: "emoji", ...errorUtil.errToObj(message) });
  }
  uuid(message) {
    return this._addCheck({ kind: "uuid", ...errorUtil.errToObj(message) });
  }
  nanoid(message) {
    return this._addCheck({ kind: "nanoid", ...errorUtil.errToObj(message) });
  }
  cuid(message) {
    return this._addCheck({ kind: "cuid", ...errorUtil.errToObj(message) });
  }
  cuid2(message) {
    return this._addCheck({ kind: "cuid2", ...errorUtil.errToObj(message) });
  }
  ulid(message) {
    return this._addCheck({ kind: "ulid", ...errorUtil.errToObj(message) });
  }
  base64(message) {
    return this._addCheck({ kind: "base64", ...errorUtil.errToObj(message) });
  }
  base64url(message) {
    return this._addCheck({
      kind: "base64url",
      ...errorUtil.errToObj(message)
    });
  }
  jwt(options) {
    return this._addCheck({ kind: "jwt", ...errorUtil.errToObj(options) });
  }
  ip(options) {
    return this._addCheck({ kind: "ip", ...errorUtil.errToObj(options) });
  }
  cidr(options) {
    return this._addCheck({ kind: "cidr", ...errorUtil.errToObj(options) });
  }
  datetime(options) {
    var _a, _b;
    if (typeof options === "string") {
      return this._addCheck({
        kind: "datetime",
        precision: null,
        offset: false,
        local: false,
        message: options
      });
    }
    return this._addCheck({
      kind: "datetime",
      precision: typeof (options === null || options === void 0 ? void 0 : options.precision) === "undefined" ? null : options === null || options === void 0 ? void 0 : options.precision,
      offset: (_a = options === null || options === void 0 ? void 0 : options.offset) !== null && _a !== void 0 ? _a : false,
      local: (_b = options === null || options === void 0 ? void 0 : options.local) !== null && _b !== void 0 ? _b : false,
      ...errorUtil.errToObj(options === null || options === void 0 ? void 0 : options.message)
    });
  }
  date(message) {
    return this._addCheck({ kind: "date", message });
  }
  time(options) {
    if (typeof options === "string") {
      return this._addCheck({
        kind: "time",
        precision: null,
        message: options
      });
    }
    return this._addCheck({
      kind: "time",
      precision: typeof (options === null || options === void 0 ? void 0 : options.precision) === "undefined" ? null : options === null || options === void 0 ? void 0 : options.precision,
      ...errorUtil.errToObj(options === null || options === void 0 ? void 0 : options.message)
    });
  }
  duration(message) {
    return this._addCheck({ kind: "duration", ...errorUtil.errToObj(message) });
  }
  regex(regex, message) {
    return this._addCheck({
      kind: "regex",
      regex,
      ...errorUtil.errToObj(message)
    });
  }
  includes(value, options) {
    return this._addCheck({
      kind: "includes",
      value,
      position: options === null || options === void 0 ? void 0 : options.position,
      ...errorUtil.errToObj(options === null || options === void 0 ? void 0 : options.message)
    });
  }
  startsWith(value, message) {
    return this._addCheck({
      kind: "startsWith",
      value,
      ...errorUtil.errToObj(message)
    });
  }
  endsWith(value, message) {
    return this._addCheck({
      kind: "endsWith",
      value,
      ...errorUtil.errToObj(message)
    });
  }
  min(minLength, message) {
    return this._addCheck({
      kind: "min",
      value: minLength,
      ...errorUtil.errToObj(message)
    });
  }
  max(maxLength, message) {
    return this._addCheck({
      kind: "max",
      value: maxLength,
      ...errorUtil.errToObj(message)
    });
  }
  length(len2, message) {
    return this._addCheck({
      kind: "length",
      value: len2,
      ...errorUtil.errToObj(message)
    });
  }
  /**
   * Equivalent to `.min(1)`
   */
  nonempty(message) {
    return this.min(1, errorUtil.errToObj(message));
  }
  trim() {
    return new ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "trim" }]
    });
  }
  toLowerCase() {
    return new ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "toLowerCase" }]
    });
  }
  toUpperCase() {
    return new ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "toUpperCase" }]
    });
  }
  get isDatetime() {
    return !!this._def.checks.find((ch) => ch.kind === "datetime");
  }
  get isDate() {
    return !!this._def.checks.find((ch) => ch.kind === "date");
  }
  get isTime() {
    return !!this._def.checks.find((ch) => ch.kind === "time");
  }
  get isDuration() {
    return !!this._def.checks.find((ch) => ch.kind === "duration");
  }
  get isEmail() {
    return !!this._def.checks.find((ch) => ch.kind === "email");
  }
  get isURL() {
    return !!this._def.checks.find((ch) => ch.kind === "url");
  }
  get isEmoji() {
    return !!this._def.checks.find((ch) => ch.kind === "emoji");
  }
  get isUUID() {
    return !!this._def.checks.find((ch) => ch.kind === "uuid");
  }
  get isNANOID() {
    return !!this._def.checks.find((ch) => ch.kind === "nanoid");
  }
  get isCUID() {
    return !!this._def.checks.find((ch) => ch.kind === "cuid");
  }
  get isCUID2() {
    return !!this._def.checks.find((ch) => ch.kind === "cuid2");
  }
  get isULID() {
    return !!this._def.checks.find((ch) => ch.kind === "ulid");
  }
  get isIP() {
    return !!this._def.checks.find((ch) => ch.kind === "ip");
  }
  get isCIDR() {
    return !!this._def.checks.find((ch) => ch.kind === "cidr");
  }
  get isBase64() {
    return !!this._def.checks.find((ch) => ch.kind === "base64");
  }
  get isBase64url() {
    return !!this._def.checks.find((ch) => ch.kind === "base64url");
  }
  get minLength() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxLength() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
}
ZodString.create = (params) => {
  var _a;
  return new ZodString({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodString,
    coerce: (_a = params === null || params === void 0 ? void 0 : params.coerce) !== null && _a !== void 0 ? _a : false,
    ...processCreateParams(params)
  });
};
function floatSafeRemainder(val, step) {
  const valDecCount = (val.toString().split(".")[1] || "").length;
  const stepDecCount = (step.toString().split(".")[1] || "").length;
  const decCount = valDecCount > stepDecCount ? valDecCount : stepDecCount;
  const valInt = parseInt(val.toFixed(decCount).replace(".", ""));
  const stepInt = parseInt(step.toFixed(decCount).replace(".", ""));
  return valInt % stepInt / Math.pow(10, decCount);
}
class ZodNumber extends ZodType {
  constructor() {
    super(...arguments);
    this.min = this.gte;
    this.max = this.lte;
    this.step = this.multipleOf;
  }
  _parse(input) {
    if (this._def.coerce) {
      input.data = Number(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.number) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.number,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    let ctx = void 0;
    const status = new ParseStatus();
    for (const check of this._def.checks) {
      if (check.kind === "int") {
        if (!util.isInteger(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: "integer",
            received: "float",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "min") {
        const tooSmall = check.inclusive ? input.data < check.value : input.data <= check.value;
        if (tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            minimum: check.value,
            type: "number",
            inclusive: check.inclusive,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        const tooBig = check.inclusive ? input.data > check.value : input.data >= check.value;
        if (tooBig) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            maximum: check.value,
            type: "number",
            inclusive: check.inclusive,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "multipleOf") {
        if (floatSafeRemainder(input.data, check.value) !== 0) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_multiple_of,
            multipleOf: check.value,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "finite") {
        if (!Number.isFinite(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_finite,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  gte(value, message) {
    return this.setLimit("min", value, true, errorUtil.toString(message));
  }
  gt(value, message) {
    return this.setLimit("min", value, false, errorUtil.toString(message));
  }
  lte(value, message) {
    return this.setLimit("max", value, true, errorUtil.toString(message));
  }
  lt(value, message) {
    return this.setLimit("max", value, false, errorUtil.toString(message));
  }
  setLimit(kind, value, inclusive, message) {
    return new ZodNumber({
      ...this._def,
      checks: [
        ...this._def.checks,
        {
          kind,
          value,
          inclusive,
          message: errorUtil.toString(message)
        }
      ]
    });
  }
  _addCheck(check) {
    return new ZodNumber({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  int(message) {
    return this._addCheck({
      kind: "int",
      message: errorUtil.toString(message)
    });
  }
  positive(message) {
    return this._addCheck({
      kind: "min",
      value: 0,
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  negative(message) {
    return this._addCheck({
      kind: "max",
      value: 0,
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  nonpositive(message) {
    return this._addCheck({
      kind: "max",
      value: 0,
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  nonnegative(message) {
    return this._addCheck({
      kind: "min",
      value: 0,
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  multipleOf(value, message) {
    return this._addCheck({
      kind: "multipleOf",
      value,
      message: errorUtil.toString(message)
    });
  }
  finite(message) {
    return this._addCheck({
      kind: "finite",
      message: errorUtil.toString(message)
    });
  }
  safe(message) {
    return this._addCheck({
      kind: "min",
      inclusive: true,
      value: Number.MIN_SAFE_INTEGER,
      message: errorUtil.toString(message)
    })._addCheck({
      kind: "max",
      inclusive: true,
      value: Number.MAX_SAFE_INTEGER,
      message: errorUtil.toString(message)
    });
  }
  get minValue() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxValue() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
  get isInt() {
    return !!this._def.checks.find((ch) => ch.kind === "int" || ch.kind === "multipleOf" && util.isInteger(ch.value));
  }
  get isFinite() {
    let max = null, min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "finite" || ch.kind === "int" || ch.kind === "multipleOf") {
        return true;
      } else if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      } else if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return Number.isFinite(min) && Number.isFinite(max);
  }
}
ZodNumber.create = (params) => {
  return new ZodNumber({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodNumber,
    coerce: (params === null || params === void 0 ? void 0 : params.coerce) || false,
    ...processCreateParams(params)
  });
};
class ZodBigInt extends ZodType {
  constructor() {
    super(...arguments);
    this.min = this.gte;
    this.max = this.lte;
  }
  _parse(input) {
    if (this._def.coerce) {
      try {
        input.data = BigInt(input.data);
      } catch (_a) {
        return this._getInvalidInput(input);
      }
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.bigint) {
      return this._getInvalidInput(input);
    }
    let ctx = void 0;
    const status = new ParseStatus();
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        const tooSmall = check.inclusive ? input.data < check.value : input.data <= check.value;
        if (tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            type: "bigint",
            minimum: check.value,
            inclusive: check.inclusive,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        const tooBig = check.inclusive ? input.data > check.value : input.data >= check.value;
        if (tooBig) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            type: "bigint",
            maximum: check.value,
            inclusive: check.inclusive,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "multipleOf") {
        if (input.data % check.value !== BigInt(0)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_multiple_of,
            multipleOf: check.value,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  _getInvalidInput(input) {
    const ctx = this._getOrReturnCtx(input);
    addIssueToContext(ctx, {
      code: ZodIssueCode.invalid_type,
      expected: ZodParsedType.bigint,
      received: ctx.parsedType
    });
    return INVALID;
  }
  gte(value, message) {
    return this.setLimit("min", value, true, errorUtil.toString(message));
  }
  gt(value, message) {
    return this.setLimit("min", value, false, errorUtil.toString(message));
  }
  lte(value, message) {
    return this.setLimit("max", value, true, errorUtil.toString(message));
  }
  lt(value, message) {
    return this.setLimit("max", value, false, errorUtil.toString(message));
  }
  setLimit(kind, value, inclusive, message) {
    return new ZodBigInt({
      ...this._def,
      checks: [
        ...this._def.checks,
        {
          kind,
          value,
          inclusive,
          message: errorUtil.toString(message)
        }
      ]
    });
  }
  _addCheck(check) {
    return new ZodBigInt({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  positive(message) {
    return this._addCheck({
      kind: "min",
      value: BigInt(0),
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  negative(message) {
    return this._addCheck({
      kind: "max",
      value: BigInt(0),
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  nonpositive(message) {
    return this._addCheck({
      kind: "max",
      value: BigInt(0),
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  nonnegative(message) {
    return this._addCheck({
      kind: "min",
      value: BigInt(0),
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  multipleOf(value, message) {
    return this._addCheck({
      kind: "multipleOf",
      value,
      message: errorUtil.toString(message)
    });
  }
  get minValue() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxValue() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
}
ZodBigInt.create = (params) => {
  var _a;
  return new ZodBigInt({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodBigInt,
    coerce: (_a = params === null || params === void 0 ? void 0 : params.coerce) !== null && _a !== void 0 ? _a : false,
    ...processCreateParams(params)
  });
};
class ZodBoolean extends ZodType {
  _parse(input) {
    if (this._def.coerce) {
      input.data = Boolean(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.boolean) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.boolean,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
}
ZodBoolean.create = (params) => {
  return new ZodBoolean({
    typeName: ZodFirstPartyTypeKind.ZodBoolean,
    coerce: (params === null || params === void 0 ? void 0 : params.coerce) || false,
    ...processCreateParams(params)
  });
};
class ZodDate extends ZodType {
  _parse(input) {
    if (this._def.coerce) {
      input.data = new Date(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.date) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.date,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    if (isNaN(input.data.getTime())) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_date
      });
      return INVALID;
    }
    const status = new ParseStatus();
    let ctx = void 0;
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        if (input.data.getTime() < check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            message: check.message,
            inclusive: true,
            exact: false,
            minimum: check.value,
            type: "date"
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        if (input.data.getTime() > check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            message: check.message,
            inclusive: true,
            exact: false,
            maximum: check.value,
            type: "date"
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return {
      status: status.value,
      value: new Date(input.data.getTime())
    };
  }
  _addCheck(check) {
    return new ZodDate({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  min(minDate, message) {
    return this._addCheck({
      kind: "min",
      value: minDate.getTime(),
      message: errorUtil.toString(message)
    });
  }
  max(maxDate, message) {
    return this._addCheck({
      kind: "max",
      value: maxDate.getTime(),
      message: errorUtil.toString(message)
    });
  }
  get minDate() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min != null ? new Date(min) : null;
  }
  get maxDate() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max != null ? new Date(max) : null;
  }
}
ZodDate.create = (params) => {
  return new ZodDate({
    checks: [],
    coerce: (params === null || params === void 0 ? void 0 : params.coerce) || false,
    typeName: ZodFirstPartyTypeKind.ZodDate,
    ...processCreateParams(params)
  });
};
class ZodSymbol extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.symbol) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.symbol,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
}
ZodSymbol.create = (params) => {
  return new ZodSymbol({
    typeName: ZodFirstPartyTypeKind.ZodSymbol,
    ...processCreateParams(params)
  });
};
class ZodUndefined extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.undefined) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.undefined,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
}
ZodUndefined.create = (params) => {
  return new ZodUndefined({
    typeName: ZodFirstPartyTypeKind.ZodUndefined,
    ...processCreateParams(params)
  });
};
class ZodNull extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.null) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.null,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
}
ZodNull.create = (params) => {
  return new ZodNull({
    typeName: ZodFirstPartyTypeKind.ZodNull,
    ...processCreateParams(params)
  });
};
class ZodAny extends ZodType {
  constructor() {
    super(...arguments);
    this._any = true;
  }
  _parse(input) {
    return OK(input.data);
  }
}
ZodAny.create = (params) => {
  return new ZodAny({
    typeName: ZodFirstPartyTypeKind.ZodAny,
    ...processCreateParams(params)
  });
};
class ZodUnknown extends ZodType {
  constructor() {
    super(...arguments);
    this._unknown = true;
  }
  _parse(input) {
    return OK(input.data);
  }
}
ZodUnknown.create = (params) => {
  return new ZodUnknown({
    typeName: ZodFirstPartyTypeKind.ZodUnknown,
    ...processCreateParams(params)
  });
};
class ZodNever extends ZodType {
  _parse(input) {
    const ctx = this._getOrReturnCtx(input);
    addIssueToContext(ctx, {
      code: ZodIssueCode.invalid_type,
      expected: ZodParsedType.never,
      received: ctx.parsedType
    });
    return INVALID;
  }
}
ZodNever.create = (params) => {
  return new ZodNever({
    typeName: ZodFirstPartyTypeKind.ZodNever,
    ...processCreateParams(params)
  });
};
class ZodVoid extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.undefined) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.void,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
}
ZodVoid.create = (params) => {
  return new ZodVoid({
    typeName: ZodFirstPartyTypeKind.ZodVoid,
    ...processCreateParams(params)
  });
};
class ZodArray extends ZodType {
  _parse(input) {
    const { ctx, status } = this._processInputParams(input);
    const def = this._def;
    if (ctx.parsedType !== ZodParsedType.array) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.array,
        received: ctx.parsedType
      });
      return INVALID;
    }
    if (def.exactLength !== null) {
      const tooBig = ctx.data.length > def.exactLength.value;
      const tooSmall = ctx.data.length < def.exactLength.value;
      if (tooBig || tooSmall) {
        addIssueToContext(ctx, {
          code: tooBig ? ZodIssueCode.too_big : ZodIssueCode.too_small,
          minimum: tooSmall ? def.exactLength.value : void 0,
          maximum: tooBig ? def.exactLength.value : void 0,
          type: "array",
          inclusive: true,
          exact: true,
          message: def.exactLength.message
        });
        status.dirty();
      }
    }
    if (def.minLength !== null) {
      if (ctx.data.length < def.minLength.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_small,
          minimum: def.minLength.value,
          type: "array",
          inclusive: true,
          exact: false,
          message: def.minLength.message
        });
        status.dirty();
      }
    }
    if (def.maxLength !== null) {
      if (ctx.data.length > def.maxLength.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_big,
          maximum: def.maxLength.value,
          type: "array",
          inclusive: true,
          exact: false,
          message: def.maxLength.message
        });
        status.dirty();
      }
    }
    if (ctx.common.async) {
      return Promise.all([...ctx.data].map((item, i) => {
        return def.type._parseAsync(new ParseInputLazyPath(ctx, item, ctx.path, i));
      })).then((result2) => {
        return ParseStatus.mergeArray(status, result2);
      });
    }
    const result = [...ctx.data].map((item, i) => {
      return def.type._parseSync(new ParseInputLazyPath(ctx, item, ctx.path, i));
    });
    return ParseStatus.mergeArray(status, result);
  }
  get element() {
    return this._def.type;
  }
  min(minLength, message) {
    return new ZodArray({
      ...this._def,
      minLength: { value: minLength, message: errorUtil.toString(message) }
    });
  }
  max(maxLength, message) {
    return new ZodArray({
      ...this._def,
      maxLength: { value: maxLength, message: errorUtil.toString(message) }
    });
  }
  length(len2, message) {
    return new ZodArray({
      ...this._def,
      exactLength: { value: len2, message: errorUtil.toString(message) }
    });
  }
  nonempty(message) {
    return this.min(1, message);
  }
}
ZodArray.create = (schema, params) => {
  return new ZodArray({
    type: schema,
    minLength: null,
    maxLength: null,
    exactLength: null,
    typeName: ZodFirstPartyTypeKind.ZodArray,
    ...processCreateParams(params)
  });
};
function deepPartialify(schema) {
  if (schema instanceof ZodObject) {
    const newShape = {};
    for (const key in schema.shape) {
      const fieldSchema = schema.shape[key];
      newShape[key] = ZodOptional.create(deepPartialify(fieldSchema));
    }
    return new ZodObject({
      ...schema._def,
      shape: () => newShape
    });
  } else if (schema instanceof ZodArray) {
    return new ZodArray({
      ...schema._def,
      type: deepPartialify(schema.element)
    });
  } else if (schema instanceof ZodOptional) {
    return ZodOptional.create(deepPartialify(schema.unwrap()));
  } else if (schema instanceof ZodNullable) {
    return ZodNullable.create(deepPartialify(schema.unwrap()));
  } else if (schema instanceof ZodTuple) {
    return ZodTuple.create(schema.items.map((item) => deepPartialify(item)));
  } else {
    return schema;
  }
}
class ZodObject extends ZodType {
  constructor() {
    super(...arguments);
    this._cached = null;
    this.nonstrict = this.passthrough;
    this.augment = this.extend;
  }
  _getCached() {
    if (this._cached !== null)
      return this._cached;
    const shape = this._def.shape();
    const keys = util.objectKeys(shape);
    return this._cached = { shape, keys };
  }
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.object) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    const { status, ctx } = this._processInputParams(input);
    const { shape, keys: shapeKeys } = this._getCached();
    const extraKeys = [];
    if (!(this._def.catchall instanceof ZodNever && this._def.unknownKeys === "strip")) {
      for (const key in ctx.data) {
        if (!shapeKeys.includes(key)) {
          extraKeys.push(key);
        }
      }
    }
    const pairs = [];
    for (const key of shapeKeys) {
      const keyValidator = shape[key];
      const value = ctx.data[key];
      pairs.push({
        key: { status: "valid", value: key },
        value: keyValidator._parse(new ParseInputLazyPath(ctx, value, ctx.path, key)),
        alwaysSet: key in ctx.data
      });
    }
    if (this._def.catchall instanceof ZodNever) {
      const unknownKeys = this._def.unknownKeys;
      if (unknownKeys === "passthrough") {
        for (const key of extraKeys) {
          pairs.push({
            key: { status: "valid", value: key },
            value: { status: "valid", value: ctx.data[key] }
          });
        }
      } else if (unknownKeys === "strict") {
        if (extraKeys.length > 0) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.unrecognized_keys,
            keys: extraKeys
          });
          status.dirty();
        }
      } else if (unknownKeys === "strip") ;
      else {
        throw new Error(`Internal ZodObject error: invalid unknownKeys value.`);
      }
    } else {
      const catchall = this._def.catchall;
      for (const key of extraKeys) {
        const value = ctx.data[key];
        pairs.push({
          key: { status: "valid", value: key },
          value: catchall._parse(
            new ParseInputLazyPath(ctx, value, ctx.path, key)
            //, ctx.child(key), value, getParsedType(value)
          ),
          alwaysSet: key in ctx.data
        });
      }
    }
    if (ctx.common.async) {
      return Promise.resolve().then(async () => {
        const syncPairs = [];
        for (const pair of pairs) {
          const key = await pair.key;
          const value = await pair.value;
          syncPairs.push({
            key,
            value,
            alwaysSet: pair.alwaysSet
          });
        }
        return syncPairs;
      }).then((syncPairs) => {
        return ParseStatus.mergeObjectSync(status, syncPairs);
      });
    } else {
      return ParseStatus.mergeObjectSync(status, pairs);
    }
  }
  get shape() {
    return this._def.shape();
  }
  strict(message) {
    errorUtil.errToObj;
    return new ZodObject({
      ...this._def,
      unknownKeys: "strict",
      ...message !== void 0 ? {
        errorMap: (issue, ctx) => {
          var _a, _b, _c, _d;
          const defaultError = (_c = (_b = (_a = this._def).errorMap) === null || _b === void 0 ? void 0 : _b.call(_a, issue, ctx).message) !== null && _c !== void 0 ? _c : ctx.defaultError;
          if (issue.code === "unrecognized_keys")
            return {
              message: (_d = errorUtil.errToObj(message).message) !== null && _d !== void 0 ? _d : defaultError
            };
          return {
            message: defaultError
          };
        }
      } : {}
    });
  }
  strip() {
    return new ZodObject({
      ...this._def,
      unknownKeys: "strip"
    });
  }
  passthrough() {
    return new ZodObject({
      ...this._def,
      unknownKeys: "passthrough"
    });
  }
  // const AugmentFactory =
  //   <Def extends ZodObjectDef>(def: Def) =>
  //   <Augmentation extends ZodRawShape>(
  //     augmentation: Augmentation
  //   ): ZodObject<
  //     extendShape<ReturnType<Def["shape"]>, Augmentation>,
  //     Def["unknownKeys"],
  //     Def["catchall"]
  //   > => {
  //     return new ZodObject({
  //       ...def,
  //       shape: () => ({
  //         ...def.shape(),
  //         ...augmentation,
  //       }),
  //     }) as any;
  //   };
  extend(augmentation) {
    return new ZodObject({
      ...this._def,
      shape: () => ({
        ...this._def.shape(),
        ...augmentation
      })
    });
  }
  /**
   * Prior to zod@1.0.12 there was a bug in the
   * inferred type of merged objects. Please
   * upgrade if you are experiencing issues.
   */
  merge(merging) {
    const merged = new ZodObject({
      unknownKeys: merging._def.unknownKeys,
      catchall: merging._def.catchall,
      shape: () => ({
        ...this._def.shape(),
        ...merging._def.shape()
      }),
      typeName: ZodFirstPartyTypeKind.ZodObject
    });
    return merged;
  }
  // merge<
  //   Incoming extends AnyZodObject,
  //   Augmentation extends Incoming["shape"],
  //   NewOutput extends {
  //     [k in keyof Augmentation | keyof Output]: k extends keyof Augmentation
  //       ? Augmentation[k]["_output"]
  //       : k extends keyof Output
  //       ? Output[k]
  //       : never;
  //   },
  //   NewInput extends {
  //     [k in keyof Augmentation | keyof Input]: k extends keyof Augmentation
  //       ? Augmentation[k]["_input"]
  //       : k extends keyof Input
  //       ? Input[k]
  //       : never;
  //   }
  // >(
  //   merging: Incoming
  // ): ZodObject<
  //   extendShape<T, ReturnType<Incoming["_def"]["shape"]>>,
  //   Incoming["_def"]["unknownKeys"],
  //   Incoming["_def"]["catchall"],
  //   NewOutput,
  //   NewInput
  // > {
  //   const merged: any = new ZodObject({
  //     unknownKeys: merging._def.unknownKeys,
  //     catchall: merging._def.catchall,
  //     shape: () =>
  //       objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
  //     typeName: ZodFirstPartyTypeKind.ZodObject,
  //   }) as any;
  //   return merged;
  // }
  setKey(key, schema) {
    return this.augment({ [key]: schema });
  }
  // merge<Incoming extends AnyZodObject>(
  //   merging: Incoming
  // ): //ZodObject<T & Incoming["_shape"], UnknownKeys, Catchall> = (merging) => {
  // ZodObject<
  //   extendShape<T, ReturnType<Incoming["_def"]["shape"]>>,
  //   Incoming["_def"]["unknownKeys"],
  //   Incoming["_def"]["catchall"]
  // > {
  //   // const mergedShape = objectUtil.mergeShapes(
  //   //   this._def.shape(),
  //   //   merging._def.shape()
  //   // );
  //   const merged: any = new ZodObject({
  //     unknownKeys: merging._def.unknownKeys,
  //     catchall: merging._def.catchall,
  //     shape: () =>
  //       objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
  //     typeName: ZodFirstPartyTypeKind.ZodObject,
  //   }) as any;
  //   return merged;
  // }
  catchall(index) {
    return new ZodObject({
      ...this._def,
      catchall: index
    });
  }
  pick(mask) {
    const shape = {};
    util.objectKeys(mask).forEach((key) => {
      if (mask[key] && this.shape[key]) {
        shape[key] = this.shape[key];
      }
    });
    return new ZodObject({
      ...this._def,
      shape: () => shape
    });
  }
  omit(mask) {
    const shape = {};
    util.objectKeys(this.shape).forEach((key) => {
      if (!mask[key]) {
        shape[key] = this.shape[key];
      }
    });
    return new ZodObject({
      ...this._def,
      shape: () => shape
    });
  }
  /**
   * @deprecated
   */
  deepPartial() {
    return deepPartialify(this);
  }
  partial(mask) {
    const newShape = {};
    util.objectKeys(this.shape).forEach((key) => {
      const fieldSchema = this.shape[key];
      if (mask && !mask[key]) {
        newShape[key] = fieldSchema;
      } else {
        newShape[key] = fieldSchema.optional();
      }
    });
    return new ZodObject({
      ...this._def,
      shape: () => newShape
    });
  }
  required(mask) {
    const newShape = {};
    util.objectKeys(this.shape).forEach((key) => {
      if (mask && !mask[key]) {
        newShape[key] = this.shape[key];
      } else {
        const fieldSchema = this.shape[key];
        let newField = fieldSchema;
        while (newField instanceof ZodOptional) {
          newField = newField._def.innerType;
        }
        newShape[key] = newField;
      }
    });
    return new ZodObject({
      ...this._def,
      shape: () => newShape
    });
  }
  keyof() {
    return createZodEnum(util.objectKeys(this.shape));
  }
}
ZodObject.create = (shape, params) => {
  return new ZodObject({
    shape: () => shape,
    unknownKeys: "strip",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params)
  });
};
ZodObject.strictCreate = (shape, params) => {
  return new ZodObject({
    shape: () => shape,
    unknownKeys: "strict",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params)
  });
};
ZodObject.lazycreate = (shape, params) => {
  return new ZodObject({
    shape,
    unknownKeys: "strip",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params)
  });
};
class ZodUnion extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const options = this._def.options;
    function handleResults(results) {
      for (const result of results) {
        if (result.result.status === "valid") {
          return result.result;
        }
      }
      for (const result of results) {
        if (result.result.status === "dirty") {
          ctx.common.issues.push(...result.ctx.common.issues);
          return result.result;
        }
      }
      const unionErrors = results.map((result) => new ZodError(result.ctx.common.issues));
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union,
        unionErrors
      });
      return INVALID;
    }
    if (ctx.common.async) {
      return Promise.all(options.map(async (option) => {
        const childCtx = {
          ...ctx,
          common: {
            ...ctx.common,
            issues: []
          },
          parent: null
        };
        return {
          result: await option._parseAsync({
            data: ctx.data,
            path: ctx.path,
            parent: childCtx
          }),
          ctx: childCtx
        };
      })).then(handleResults);
    } else {
      let dirty = void 0;
      const issues = [];
      for (const option of options) {
        const childCtx = {
          ...ctx,
          common: {
            ...ctx.common,
            issues: []
          },
          parent: null
        };
        const result = option._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: childCtx
        });
        if (result.status === "valid") {
          return result;
        } else if (result.status === "dirty" && !dirty) {
          dirty = { result, ctx: childCtx };
        }
        if (childCtx.common.issues.length) {
          issues.push(childCtx.common.issues);
        }
      }
      if (dirty) {
        ctx.common.issues.push(...dirty.ctx.common.issues);
        return dirty.result;
      }
      const unionErrors = issues.map((issues2) => new ZodError(issues2));
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union,
        unionErrors
      });
      return INVALID;
    }
  }
  get options() {
    return this._def.options;
  }
}
ZodUnion.create = (types, params) => {
  return new ZodUnion({
    options: types,
    typeName: ZodFirstPartyTypeKind.ZodUnion,
    ...processCreateParams(params)
  });
};
const getDiscriminator = (type) => {
  if (type instanceof ZodLazy) {
    return getDiscriminator(type.schema);
  } else if (type instanceof ZodEffects) {
    return getDiscriminator(type.innerType());
  } else if (type instanceof ZodLiteral) {
    return [type.value];
  } else if (type instanceof ZodEnum) {
    return type.options;
  } else if (type instanceof ZodNativeEnum) {
    return util.objectValues(type.enum);
  } else if (type instanceof ZodDefault) {
    return getDiscriminator(type._def.innerType);
  } else if (type instanceof ZodUndefined) {
    return [void 0];
  } else if (type instanceof ZodNull) {
    return [null];
  } else if (type instanceof ZodOptional) {
    return [void 0, ...getDiscriminator(type.unwrap())];
  } else if (type instanceof ZodNullable) {
    return [null, ...getDiscriminator(type.unwrap())];
  } else if (type instanceof ZodBranded) {
    return getDiscriminator(type.unwrap());
  } else if (type instanceof ZodReadonly) {
    return getDiscriminator(type.unwrap());
  } else if (type instanceof ZodCatch) {
    return getDiscriminator(type._def.innerType);
  } else {
    return [];
  }
};
class ZodDiscriminatedUnion extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.object) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const discriminator = this.discriminator;
    const discriminatorValue = ctx.data[discriminator];
    const option = this.optionsMap.get(discriminatorValue);
    if (!option) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union_discriminator,
        options: Array.from(this.optionsMap.keys()),
        path: [discriminator]
      });
      return INVALID;
    }
    if (ctx.common.async) {
      return option._parseAsync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      });
    } else {
      return option._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      });
    }
  }
  get discriminator() {
    return this._def.discriminator;
  }
  get options() {
    return this._def.options;
  }
  get optionsMap() {
    return this._def.optionsMap;
  }
  /**
   * The constructor of the discriminated union schema. Its behaviour is very similar to that of the normal z.union() constructor.
   * However, it only allows a union of objects, all of which need to share a discriminator property. This property must
   * have a different value for each object in the union.
   * @param discriminator the name of the discriminator property
   * @param types an array of object schemas
   * @param params
   */
  static create(discriminator, options, params) {
    const optionsMap = /* @__PURE__ */ new Map();
    for (const type of options) {
      const discriminatorValues = getDiscriminator(type.shape[discriminator]);
      if (!discriminatorValues.length) {
        throw new Error(`A discriminator value for key \`${discriminator}\` could not be extracted from all schema options`);
      }
      for (const value of discriminatorValues) {
        if (optionsMap.has(value)) {
          throw new Error(`Discriminator property ${String(discriminator)} has duplicate value ${String(value)}`);
        }
        optionsMap.set(value, type);
      }
    }
    return new ZodDiscriminatedUnion({
      typeName: ZodFirstPartyTypeKind.ZodDiscriminatedUnion,
      discriminator,
      options,
      optionsMap,
      ...processCreateParams(params)
    });
  }
}
function mergeValues(a, b) {
  const aType = getParsedType(a);
  const bType = getParsedType(b);
  if (a === b) {
    return { valid: true, data: a };
  } else if (aType === ZodParsedType.object && bType === ZodParsedType.object) {
    const bKeys = util.objectKeys(b);
    const sharedKeys = util.objectKeys(a).filter((key) => bKeys.indexOf(key) !== -1);
    const newObj = { ...a, ...b };
    for (const key of sharedKeys) {
      const sharedValue = mergeValues(a[key], b[key]);
      if (!sharedValue.valid) {
        return { valid: false };
      }
      newObj[key] = sharedValue.data;
    }
    return { valid: true, data: newObj };
  } else if (aType === ZodParsedType.array && bType === ZodParsedType.array) {
    if (a.length !== b.length) {
      return { valid: false };
    }
    const newArray = [];
    for (let index = 0; index < a.length; index++) {
      const itemA = a[index];
      const itemB = b[index];
      const sharedValue = mergeValues(itemA, itemB);
      if (!sharedValue.valid) {
        return { valid: false };
      }
      newArray.push(sharedValue.data);
    }
    return { valid: true, data: newArray };
  } else if (aType === ZodParsedType.date && bType === ZodParsedType.date && +a === +b) {
    return { valid: true, data: a };
  } else {
    return { valid: false };
  }
}
class ZodIntersection extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    const handleParsed = (parsedLeft, parsedRight) => {
      if (isAborted(parsedLeft) || isAborted(parsedRight)) {
        return INVALID;
      }
      const merged = mergeValues(parsedLeft.value, parsedRight.value);
      if (!merged.valid) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_intersection_types
        });
        return INVALID;
      }
      if (isDirty(parsedLeft) || isDirty(parsedRight)) {
        status.dirty();
      }
      return { status: status.value, value: merged.data };
    };
    if (ctx.common.async) {
      return Promise.all([
        this._def.left._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        }),
        this._def.right._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        })
      ]).then(([left, right]) => handleParsed(left, right));
    } else {
      return handleParsed(this._def.left._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      }), this._def.right._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      }));
    }
  }
}
ZodIntersection.create = (left, right, params) => {
  return new ZodIntersection({
    left,
    right,
    typeName: ZodFirstPartyTypeKind.ZodIntersection,
    ...processCreateParams(params)
  });
};
class ZodTuple extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.array) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.array,
        received: ctx.parsedType
      });
      return INVALID;
    }
    if (ctx.data.length < this._def.items.length) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.too_small,
        minimum: this._def.items.length,
        inclusive: true,
        exact: false,
        type: "array"
      });
      return INVALID;
    }
    const rest = this._def.rest;
    if (!rest && ctx.data.length > this._def.items.length) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.too_big,
        maximum: this._def.items.length,
        inclusive: true,
        exact: false,
        type: "array"
      });
      status.dirty();
    }
    const items = [...ctx.data].map((item, itemIndex) => {
      const schema = this._def.items[itemIndex] || this._def.rest;
      if (!schema)
        return null;
      return schema._parse(new ParseInputLazyPath(ctx, item, ctx.path, itemIndex));
    }).filter((x) => !!x);
    if (ctx.common.async) {
      return Promise.all(items).then((results) => {
        return ParseStatus.mergeArray(status, results);
      });
    } else {
      return ParseStatus.mergeArray(status, items);
    }
  }
  get items() {
    return this._def.items;
  }
  rest(rest) {
    return new ZodTuple({
      ...this._def,
      rest
    });
  }
}
ZodTuple.create = (schemas, params) => {
  if (!Array.isArray(schemas)) {
    throw new Error("You must pass an array of schemas to z.tuple([ ... ])");
  }
  return new ZodTuple({
    items: schemas,
    typeName: ZodFirstPartyTypeKind.ZodTuple,
    rest: null,
    ...processCreateParams(params)
  });
};
class ZodRecord extends ZodType {
  get keySchema() {
    return this._def.keyType;
  }
  get valueSchema() {
    return this._def.valueType;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.object) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const pairs = [];
    const keyType = this._def.keyType;
    const valueType = this._def.valueType;
    for (const key in ctx.data) {
      pairs.push({
        key: keyType._parse(new ParseInputLazyPath(ctx, key, ctx.path, key)),
        value: valueType._parse(new ParseInputLazyPath(ctx, ctx.data[key], ctx.path, key)),
        alwaysSet: key in ctx.data
      });
    }
    if (ctx.common.async) {
      return ParseStatus.mergeObjectAsync(status, pairs);
    } else {
      return ParseStatus.mergeObjectSync(status, pairs);
    }
  }
  get element() {
    return this._def.valueType;
  }
  static create(first, second, third) {
    if (second instanceof ZodType) {
      return new ZodRecord({
        keyType: first,
        valueType: second,
        typeName: ZodFirstPartyTypeKind.ZodRecord,
        ...processCreateParams(third)
      });
    }
    return new ZodRecord({
      keyType: ZodString.create(),
      valueType: first,
      typeName: ZodFirstPartyTypeKind.ZodRecord,
      ...processCreateParams(second)
    });
  }
}
class ZodMap extends ZodType {
  get keySchema() {
    return this._def.keyType;
  }
  get valueSchema() {
    return this._def.valueType;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.map) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.map,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const keyType = this._def.keyType;
    const valueType = this._def.valueType;
    const pairs = [...ctx.data.entries()].map(([key, value], index) => {
      return {
        key: keyType._parse(new ParseInputLazyPath(ctx, key, ctx.path, [index, "key"])),
        value: valueType._parse(new ParseInputLazyPath(ctx, value, ctx.path, [index, "value"]))
      };
    });
    if (ctx.common.async) {
      const finalMap = /* @__PURE__ */ new Map();
      return Promise.resolve().then(async () => {
        for (const pair of pairs) {
          const key = await pair.key;
          const value = await pair.value;
          if (key.status === "aborted" || value.status === "aborted") {
            return INVALID;
          }
          if (key.status === "dirty" || value.status === "dirty") {
            status.dirty();
          }
          finalMap.set(key.value, value.value);
        }
        return { status: status.value, value: finalMap };
      });
    } else {
      const finalMap = /* @__PURE__ */ new Map();
      for (const pair of pairs) {
        const key = pair.key;
        const value = pair.value;
        if (key.status === "aborted" || value.status === "aborted") {
          return INVALID;
        }
        if (key.status === "dirty" || value.status === "dirty") {
          status.dirty();
        }
        finalMap.set(key.value, value.value);
      }
      return { status: status.value, value: finalMap };
    }
  }
}
ZodMap.create = (keyType, valueType, params) => {
  return new ZodMap({
    valueType,
    keyType,
    typeName: ZodFirstPartyTypeKind.ZodMap,
    ...processCreateParams(params)
  });
};
class ZodSet extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.set) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.set,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const def = this._def;
    if (def.minSize !== null) {
      if (ctx.data.size < def.minSize.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_small,
          minimum: def.minSize.value,
          type: "set",
          inclusive: true,
          exact: false,
          message: def.minSize.message
        });
        status.dirty();
      }
    }
    if (def.maxSize !== null) {
      if (ctx.data.size > def.maxSize.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_big,
          maximum: def.maxSize.value,
          type: "set",
          inclusive: true,
          exact: false,
          message: def.maxSize.message
        });
        status.dirty();
      }
    }
    const valueType = this._def.valueType;
    function finalizeSet(elements2) {
      const parsedSet = /* @__PURE__ */ new Set();
      for (const element of elements2) {
        if (element.status === "aborted")
          return INVALID;
        if (element.status === "dirty")
          status.dirty();
        parsedSet.add(element.value);
      }
      return { status: status.value, value: parsedSet };
    }
    const elements = [...ctx.data.values()].map((item, i) => valueType._parse(new ParseInputLazyPath(ctx, item, ctx.path, i)));
    if (ctx.common.async) {
      return Promise.all(elements).then((elements2) => finalizeSet(elements2));
    } else {
      return finalizeSet(elements);
    }
  }
  min(minSize, message) {
    return new ZodSet({
      ...this._def,
      minSize: { value: minSize, message: errorUtil.toString(message) }
    });
  }
  max(maxSize, message) {
    return new ZodSet({
      ...this._def,
      maxSize: { value: maxSize, message: errorUtil.toString(message) }
    });
  }
  size(size, message) {
    return this.min(size, message).max(size, message);
  }
  nonempty(message) {
    return this.min(1, message);
  }
}
ZodSet.create = (valueType, params) => {
  return new ZodSet({
    valueType,
    minSize: null,
    maxSize: null,
    typeName: ZodFirstPartyTypeKind.ZodSet,
    ...processCreateParams(params)
  });
};
class ZodFunction extends ZodType {
  constructor() {
    super(...arguments);
    this.validate = this.implement;
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.function) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.function,
        received: ctx.parsedType
      });
      return INVALID;
    }
    function makeArgsIssue(args, error) {
      return makeIssue({
        data: args,
        path: ctx.path,
        errorMaps: [
          ctx.common.contextualErrorMap,
          ctx.schemaErrorMap,
          getErrorMap(),
          errorMap
        ].filter((x) => !!x),
        issueData: {
          code: ZodIssueCode.invalid_arguments,
          argumentsError: error
        }
      });
    }
    function makeReturnsIssue(returns, error) {
      return makeIssue({
        data: returns,
        path: ctx.path,
        errorMaps: [
          ctx.common.contextualErrorMap,
          ctx.schemaErrorMap,
          getErrorMap(),
          errorMap
        ].filter((x) => !!x),
        issueData: {
          code: ZodIssueCode.invalid_return_type,
          returnTypeError: error
        }
      });
    }
    const params = { errorMap: ctx.common.contextualErrorMap };
    const fn = ctx.data;
    if (this._def.returns instanceof ZodPromise) {
      const me = this;
      return OK(async function(...args) {
        const error = new ZodError([]);
        const parsedArgs = await me._def.args.parseAsync(args, params).catch((e) => {
          error.addIssue(makeArgsIssue(args, e));
          throw error;
        });
        const result = await Reflect.apply(fn, this, parsedArgs);
        const parsedReturns = await me._def.returns._def.type.parseAsync(result, params).catch((e) => {
          error.addIssue(makeReturnsIssue(result, e));
          throw error;
        });
        return parsedReturns;
      });
    } else {
      const me = this;
      return OK(function(...args) {
        const parsedArgs = me._def.args.safeParse(args, params);
        if (!parsedArgs.success) {
          throw new ZodError([makeArgsIssue(args, parsedArgs.error)]);
        }
        const result = Reflect.apply(fn, this, parsedArgs.data);
        const parsedReturns = me._def.returns.safeParse(result, params);
        if (!parsedReturns.success) {
          throw new ZodError([makeReturnsIssue(result, parsedReturns.error)]);
        }
        return parsedReturns.data;
      });
    }
  }
  parameters() {
    return this._def.args;
  }
  returnType() {
    return this._def.returns;
  }
  args(...items) {
    return new ZodFunction({
      ...this._def,
      args: ZodTuple.create(items).rest(ZodUnknown.create())
    });
  }
  returns(returnType) {
    return new ZodFunction({
      ...this._def,
      returns: returnType
    });
  }
  implement(func) {
    const validatedFunc = this.parse(func);
    return validatedFunc;
  }
  strictImplement(func) {
    const validatedFunc = this.parse(func);
    return validatedFunc;
  }
  static create(args, returns, params) {
    return new ZodFunction({
      args: args ? args : ZodTuple.create([]).rest(ZodUnknown.create()),
      returns: returns || ZodUnknown.create(),
      typeName: ZodFirstPartyTypeKind.ZodFunction,
      ...processCreateParams(params)
    });
  }
}
class ZodLazy extends ZodType {
  get schema() {
    return this._def.getter();
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const lazySchema = this._def.getter();
    return lazySchema._parse({ data: ctx.data, path: ctx.path, parent: ctx });
  }
}
ZodLazy.create = (getter, params) => {
  return new ZodLazy({
    getter,
    typeName: ZodFirstPartyTypeKind.ZodLazy,
    ...processCreateParams(params)
  });
};
class ZodLiteral extends ZodType {
  _parse(input) {
    if (input.data !== this._def.value) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_literal,
        expected: this._def.value
      });
      return INVALID;
    }
    return { status: "valid", value: input.data };
  }
  get value() {
    return this._def.value;
  }
}
ZodLiteral.create = (value, params) => {
  return new ZodLiteral({
    value,
    typeName: ZodFirstPartyTypeKind.ZodLiteral,
    ...processCreateParams(params)
  });
};
function createZodEnum(values, params) {
  return new ZodEnum({
    values,
    typeName: ZodFirstPartyTypeKind.ZodEnum,
    ...processCreateParams(params)
  });
}
class ZodEnum extends ZodType {
  constructor() {
    super(...arguments);
    _ZodEnum_cache.set(this, void 0);
  }
  _parse(input) {
    if (typeof input.data !== "string") {
      const ctx = this._getOrReturnCtx(input);
      const expectedValues = this._def.values;
      addIssueToContext(ctx, {
        expected: util.joinValues(expectedValues),
        received: ctx.parsedType,
        code: ZodIssueCode.invalid_type
      });
      return INVALID;
    }
    if (!__classPrivateFieldGet(this, _ZodEnum_cache)) {
      __classPrivateFieldSet(this, _ZodEnum_cache, new Set(this._def.values));
    }
    if (!__classPrivateFieldGet(this, _ZodEnum_cache).has(input.data)) {
      const ctx = this._getOrReturnCtx(input);
      const expectedValues = this._def.values;
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_enum_value,
        options: expectedValues
      });
      return INVALID;
    }
    return OK(input.data);
  }
  get options() {
    return this._def.values;
  }
  get enum() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  get Values() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  get Enum() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  extract(values, newDef = this._def) {
    return ZodEnum.create(values, {
      ...this._def,
      ...newDef
    });
  }
  exclude(values, newDef = this._def) {
    return ZodEnum.create(this.options.filter((opt) => !values.includes(opt)), {
      ...this._def,
      ...newDef
    });
  }
}
_ZodEnum_cache = /* @__PURE__ */ new WeakMap();
ZodEnum.create = createZodEnum;
class ZodNativeEnum extends ZodType {
  constructor() {
    super(...arguments);
    _ZodNativeEnum_cache.set(this, void 0);
  }
  _parse(input) {
    const nativeEnumValues = util.getValidEnumValues(this._def.values);
    const ctx = this._getOrReturnCtx(input);
    if (ctx.parsedType !== ZodParsedType.string && ctx.parsedType !== ZodParsedType.number) {
      const expectedValues = util.objectValues(nativeEnumValues);
      addIssueToContext(ctx, {
        expected: util.joinValues(expectedValues),
        received: ctx.parsedType,
        code: ZodIssueCode.invalid_type
      });
      return INVALID;
    }
    if (!__classPrivateFieldGet(this, _ZodNativeEnum_cache)) {
      __classPrivateFieldSet(this, _ZodNativeEnum_cache, new Set(util.getValidEnumValues(this._def.values)));
    }
    if (!__classPrivateFieldGet(this, _ZodNativeEnum_cache).has(input.data)) {
      const expectedValues = util.objectValues(nativeEnumValues);
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_enum_value,
        options: expectedValues
      });
      return INVALID;
    }
    return OK(input.data);
  }
  get enum() {
    return this._def.values;
  }
}
_ZodNativeEnum_cache = /* @__PURE__ */ new WeakMap();
ZodNativeEnum.create = (values, params) => {
  return new ZodNativeEnum({
    values,
    typeName: ZodFirstPartyTypeKind.ZodNativeEnum,
    ...processCreateParams(params)
  });
};
class ZodPromise extends ZodType {
  unwrap() {
    return this._def.type;
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.promise && ctx.common.async === false) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.promise,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const promisified = ctx.parsedType === ZodParsedType.promise ? ctx.data : Promise.resolve(ctx.data);
    return OK(promisified.then((data) => {
      return this._def.type.parseAsync(data, {
        path: ctx.path,
        errorMap: ctx.common.contextualErrorMap
      });
    }));
  }
}
ZodPromise.create = (schema, params) => {
  return new ZodPromise({
    type: schema,
    typeName: ZodFirstPartyTypeKind.ZodPromise,
    ...processCreateParams(params)
  });
};
class ZodEffects extends ZodType {
  innerType() {
    return this._def.schema;
  }
  sourceType() {
    return this._def.schema._def.typeName === ZodFirstPartyTypeKind.ZodEffects ? this._def.schema.sourceType() : this._def.schema;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    const effect = this._def.effect || null;
    const checkCtx = {
      addIssue: (arg) => {
        addIssueToContext(ctx, arg);
        if (arg.fatal) {
          status.abort();
        } else {
          status.dirty();
        }
      },
      get path() {
        return ctx.path;
      }
    };
    checkCtx.addIssue = checkCtx.addIssue.bind(checkCtx);
    if (effect.type === "preprocess") {
      const processed = effect.transform(ctx.data, checkCtx);
      if (ctx.common.async) {
        return Promise.resolve(processed).then(async (processed2) => {
          if (status.value === "aborted")
            return INVALID;
          const result = await this._def.schema._parseAsync({
            data: processed2,
            path: ctx.path,
            parent: ctx
          });
          if (result.status === "aborted")
            return INVALID;
          if (result.status === "dirty")
            return DIRTY(result.value);
          if (status.value === "dirty")
            return DIRTY(result.value);
          return result;
        });
      } else {
        if (status.value === "aborted")
          return INVALID;
        const result = this._def.schema._parseSync({
          data: processed,
          path: ctx.path,
          parent: ctx
        });
        if (result.status === "aborted")
          return INVALID;
        if (result.status === "dirty")
          return DIRTY(result.value);
        if (status.value === "dirty")
          return DIRTY(result.value);
        return result;
      }
    }
    if (effect.type === "refinement") {
      const executeRefinement = (acc) => {
        const result = effect.refinement(acc, checkCtx);
        if (ctx.common.async) {
          return Promise.resolve(result);
        }
        if (result instanceof Promise) {
          throw new Error("Async refinement encountered during synchronous parse operation. Use .parseAsync instead.");
        }
        return acc;
      };
      if (ctx.common.async === false) {
        const inner = this._def.schema._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (inner.status === "aborted")
          return INVALID;
        if (inner.status === "dirty")
          status.dirty();
        executeRefinement(inner.value);
        return { status: status.value, value: inner.value };
      } else {
        return this._def.schema._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx }).then((inner) => {
          if (inner.status === "aborted")
            return INVALID;
          if (inner.status === "dirty")
            status.dirty();
          return executeRefinement(inner.value).then(() => {
            return { status: status.value, value: inner.value };
          });
        });
      }
    }
    if (effect.type === "transform") {
      if (ctx.common.async === false) {
        const base = this._def.schema._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (!isValid(base))
          return base;
        const result = effect.transform(base.value, checkCtx);
        if (result instanceof Promise) {
          throw new Error(`Asynchronous transform encountered during synchronous parse operation. Use .parseAsync instead.`);
        }
        return { status: status.value, value: result };
      } else {
        return this._def.schema._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx }).then((base) => {
          if (!isValid(base))
            return base;
          return Promise.resolve(effect.transform(base.value, checkCtx)).then((result) => ({ status: status.value, value: result }));
        });
      }
    }
    util.assertNever(effect);
  }
}
ZodEffects.create = (schema, effect, params) => {
  return new ZodEffects({
    schema,
    typeName: ZodFirstPartyTypeKind.ZodEffects,
    effect,
    ...processCreateParams(params)
  });
};
ZodEffects.createWithPreprocess = (preprocess, schema, params) => {
  return new ZodEffects({
    schema,
    effect: { type: "preprocess", transform: preprocess },
    typeName: ZodFirstPartyTypeKind.ZodEffects,
    ...processCreateParams(params)
  });
};
class ZodOptional extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType === ZodParsedType.undefined) {
      return OK(void 0);
    }
    return this._def.innerType._parse(input);
  }
  unwrap() {
    return this._def.innerType;
  }
}
ZodOptional.create = (type, params) => {
  return new ZodOptional({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodOptional,
    ...processCreateParams(params)
  });
};
class ZodNullable extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType === ZodParsedType.null) {
      return OK(null);
    }
    return this._def.innerType._parse(input);
  }
  unwrap() {
    return this._def.innerType;
  }
}
ZodNullable.create = (type, params) => {
  return new ZodNullable({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodNullable,
    ...processCreateParams(params)
  });
};
class ZodDefault extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    let data = ctx.data;
    if (ctx.parsedType === ZodParsedType.undefined) {
      data = this._def.defaultValue();
    }
    return this._def.innerType._parse({
      data,
      path: ctx.path,
      parent: ctx
    });
  }
  removeDefault() {
    return this._def.innerType;
  }
}
ZodDefault.create = (type, params) => {
  return new ZodDefault({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodDefault,
    defaultValue: typeof params.default === "function" ? params.default : () => params.default,
    ...processCreateParams(params)
  });
};
class ZodCatch extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const newCtx = {
      ...ctx,
      common: {
        ...ctx.common,
        issues: []
      }
    };
    const result = this._def.innerType._parse({
      data: newCtx.data,
      path: newCtx.path,
      parent: {
        ...newCtx
      }
    });
    if (isAsync(result)) {
      return result.then((result2) => {
        return {
          status: "valid",
          value: result2.status === "valid" ? result2.value : this._def.catchValue({
            get error() {
              return new ZodError(newCtx.common.issues);
            },
            input: newCtx.data
          })
        };
      });
    } else {
      return {
        status: "valid",
        value: result.status === "valid" ? result.value : this._def.catchValue({
          get error() {
            return new ZodError(newCtx.common.issues);
          },
          input: newCtx.data
        })
      };
    }
  }
  removeCatch() {
    return this._def.innerType;
  }
}
ZodCatch.create = (type, params) => {
  return new ZodCatch({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodCatch,
    catchValue: typeof params.catch === "function" ? params.catch : () => params.catch,
    ...processCreateParams(params)
  });
};
class ZodNaN extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.nan) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.nan,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return { status: "valid", value: input.data };
  }
}
ZodNaN.create = (params) => {
  return new ZodNaN({
    typeName: ZodFirstPartyTypeKind.ZodNaN,
    ...processCreateParams(params)
  });
};
const BRAND = Symbol("zod_brand");
class ZodBranded extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const data = ctx.data;
    return this._def.type._parse({
      data,
      path: ctx.path,
      parent: ctx
    });
  }
  unwrap() {
    return this._def.type;
  }
}
class ZodPipeline extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.common.async) {
      const handleAsync = async () => {
        const inResult = await this._def.in._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (inResult.status === "aborted")
          return INVALID;
        if (inResult.status === "dirty") {
          status.dirty();
          return DIRTY(inResult.value);
        } else {
          return this._def.out._parseAsync({
            data: inResult.value,
            path: ctx.path,
            parent: ctx
          });
        }
      };
      return handleAsync();
    } else {
      const inResult = this._def.in._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      });
      if (inResult.status === "aborted")
        return INVALID;
      if (inResult.status === "dirty") {
        status.dirty();
        return {
          status: "dirty",
          value: inResult.value
        };
      } else {
        return this._def.out._parseSync({
          data: inResult.value,
          path: ctx.path,
          parent: ctx
        });
      }
    }
  }
  static create(a, b) {
    return new ZodPipeline({
      in: a,
      out: b,
      typeName: ZodFirstPartyTypeKind.ZodPipeline
    });
  }
}
class ZodReadonly extends ZodType {
  _parse(input) {
    const result = this._def.innerType._parse(input);
    const freeze = (data) => {
      if (isValid(data)) {
        data.value = Object.freeze(data.value);
      }
      return data;
    };
    return isAsync(result) ? result.then((data) => freeze(data)) : freeze(result);
  }
  unwrap() {
    return this._def.innerType;
  }
}
ZodReadonly.create = (type, params) => {
  return new ZodReadonly({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodReadonly,
    ...processCreateParams(params)
  });
};
function cleanParams(params, data) {
  const p = typeof params === "function" ? params(data) : typeof params === "string" ? { message: params } : params;
  const p2 = typeof p === "string" ? { message: p } : p;
  return p2;
}
function custom(check, _params = {}, fatal) {
  if (check)
    return ZodAny.create().superRefine((data, ctx) => {
      var _a, _b;
      const r = check(data);
      if (r instanceof Promise) {
        return r.then((r2) => {
          var _a2, _b2;
          if (!r2) {
            const params = cleanParams(_params, data);
            const _fatal = (_b2 = (_a2 = params.fatal) !== null && _a2 !== void 0 ? _a2 : fatal) !== null && _b2 !== void 0 ? _b2 : true;
            ctx.addIssue({ code: "custom", ...params, fatal: _fatal });
          }
        });
      }
      if (!r) {
        const params = cleanParams(_params, data);
        const _fatal = (_b = (_a = params.fatal) !== null && _a !== void 0 ? _a : fatal) !== null && _b !== void 0 ? _b : true;
        ctx.addIssue({ code: "custom", ...params, fatal: _fatal });
      }
      return;
    });
  return ZodAny.create();
}
const late = {
  object: ZodObject.lazycreate
};
var ZodFirstPartyTypeKind;
(function(ZodFirstPartyTypeKind2) {
  ZodFirstPartyTypeKind2["ZodString"] = "ZodString";
  ZodFirstPartyTypeKind2["ZodNumber"] = "ZodNumber";
  ZodFirstPartyTypeKind2["ZodNaN"] = "ZodNaN";
  ZodFirstPartyTypeKind2["ZodBigInt"] = "ZodBigInt";
  ZodFirstPartyTypeKind2["ZodBoolean"] = "ZodBoolean";
  ZodFirstPartyTypeKind2["ZodDate"] = "ZodDate";
  ZodFirstPartyTypeKind2["ZodSymbol"] = "ZodSymbol";
  ZodFirstPartyTypeKind2["ZodUndefined"] = "ZodUndefined";
  ZodFirstPartyTypeKind2["ZodNull"] = "ZodNull";
  ZodFirstPartyTypeKind2["ZodAny"] = "ZodAny";
  ZodFirstPartyTypeKind2["ZodUnknown"] = "ZodUnknown";
  ZodFirstPartyTypeKind2["ZodNever"] = "ZodNever";
  ZodFirstPartyTypeKind2["ZodVoid"] = "ZodVoid";
  ZodFirstPartyTypeKind2["ZodArray"] = "ZodArray";
  ZodFirstPartyTypeKind2["ZodObject"] = "ZodObject";
  ZodFirstPartyTypeKind2["ZodUnion"] = "ZodUnion";
  ZodFirstPartyTypeKind2["ZodDiscriminatedUnion"] = "ZodDiscriminatedUnion";
  ZodFirstPartyTypeKind2["ZodIntersection"] = "ZodIntersection";
  ZodFirstPartyTypeKind2["ZodTuple"] = "ZodTuple";
  ZodFirstPartyTypeKind2["ZodRecord"] = "ZodRecord";
  ZodFirstPartyTypeKind2["ZodMap"] = "ZodMap";
  ZodFirstPartyTypeKind2["ZodSet"] = "ZodSet";
  ZodFirstPartyTypeKind2["ZodFunction"] = "ZodFunction";
  ZodFirstPartyTypeKind2["ZodLazy"] = "ZodLazy";
  ZodFirstPartyTypeKind2["ZodLiteral"] = "ZodLiteral";
  ZodFirstPartyTypeKind2["ZodEnum"] = "ZodEnum";
  ZodFirstPartyTypeKind2["ZodEffects"] = "ZodEffects";
  ZodFirstPartyTypeKind2["ZodNativeEnum"] = "ZodNativeEnum";
  ZodFirstPartyTypeKind2["ZodOptional"] = "ZodOptional";
  ZodFirstPartyTypeKind2["ZodNullable"] = "ZodNullable";
  ZodFirstPartyTypeKind2["ZodDefault"] = "ZodDefault";
  ZodFirstPartyTypeKind2["ZodCatch"] = "ZodCatch";
  ZodFirstPartyTypeKind2["ZodPromise"] = "ZodPromise";
  ZodFirstPartyTypeKind2["ZodBranded"] = "ZodBranded";
  ZodFirstPartyTypeKind2["ZodPipeline"] = "ZodPipeline";
  ZodFirstPartyTypeKind2["ZodReadonly"] = "ZodReadonly";
})(ZodFirstPartyTypeKind || (ZodFirstPartyTypeKind = {}));
const instanceOfType = (cls, params = {
  message: `Input not instance of ${cls.name}`
}) => custom((data) => data instanceof cls, params);
const stringType = ZodString.create;
const numberType = ZodNumber.create;
const nanType = ZodNaN.create;
const bigIntType = ZodBigInt.create;
const booleanType = ZodBoolean.create;
const dateType = ZodDate.create;
const symbolType = ZodSymbol.create;
const undefinedType = ZodUndefined.create;
const nullType = ZodNull.create;
const anyType = ZodAny.create;
const unknownType = ZodUnknown.create;
const neverType = ZodNever.create;
const voidType = ZodVoid.create;
const arrayType = ZodArray.create;
const objectType = ZodObject.create;
const strictObjectType = ZodObject.strictCreate;
const unionType = ZodUnion.create;
const discriminatedUnionType = ZodDiscriminatedUnion.create;
const intersectionType = ZodIntersection.create;
const tupleType = ZodTuple.create;
const recordType = ZodRecord.create;
const mapType = ZodMap.create;
const setType = ZodSet.create;
const functionType = ZodFunction.create;
const lazyType = ZodLazy.create;
const literalType = ZodLiteral.create;
const enumType = ZodEnum.create;
const nativeEnumType = ZodNativeEnum.create;
const promiseType = ZodPromise.create;
const effectsType = ZodEffects.create;
const optionalType = ZodOptional.create;
const nullableType = ZodNullable.create;
const preprocessType = ZodEffects.createWithPreprocess;
const pipelineType = ZodPipeline.create;
const ostring = () => stringType().optional();
const onumber = () => numberType().optional();
const oboolean = () => booleanType().optional();
const coerce = {
  string: (arg) => ZodString.create({ ...arg, coerce: true }),
  number: (arg) => ZodNumber.create({ ...arg, coerce: true }),
  boolean: (arg) => ZodBoolean.create({
    ...arg,
    coerce: true
  }),
  bigint: (arg) => ZodBigInt.create({ ...arg, coerce: true }),
  date: (arg) => ZodDate.create({ ...arg, coerce: true })
};
const NEVER = INVALID;
var z = /* @__PURE__ */ Object.freeze({
  __proto__: null,
  defaultErrorMap: errorMap,
  setErrorMap,
  getErrorMap,
  makeIssue,
  EMPTY_PATH,
  addIssueToContext,
  ParseStatus,
  INVALID,
  DIRTY,
  OK,
  isAborted,
  isDirty,
  isValid,
  isAsync,
  get util() {
    return util;
  },
  get objectUtil() {
    return objectUtil;
  },
  ZodParsedType,
  getParsedType,
  ZodType,
  datetimeRegex,
  ZodString,
  ZodNumber,
  ZodBigInt,
  ZodBoolean,
  ZodDate,
  ZodSymbol,
  ZodUndefined,
  ZodNull,
  ZodAny,
  ZodUnknown,
  ZodNever,
  ZodVoid,
  ZodArray,
  ZodObject,
  ZodUnion,
  ZodDiscriminatedUnion,
  ZodIntersection,
  ZodTuple,
  ZodRecord,
  ZodMap,
  ZodSet,
  ZodFunction,
  ZodLazy,
  ZodLiteral,
  ZodEnum,
  ZodNativeEnum,
  ZodPromise,
  ZodEffects,
  ZodTransformer: ZodEffects,
  ZodOptional,
  ZodNullable,
  ZodDefault,
  ZodCatch,
  ZodNaN,
  BRAND,
  ZodBranded,
  ZodPipeline,
  ZodReadonly,
  custom,
  Schema: ZodType,
  ZodSchema: ZodType,
  late,
  get ZodFirstPartyTypeKind() {
    return ZodFirstPartyTypeKind;
  },
  coerce,
  any: anyType,
  array: arrayType,
  bigint: bigIntType,
  boolean: booleanType,
  date: dateType,
  discriminatedUnion: discriminatedUnionType,
  effect: effectsType,
  "enum": enumType,
  "function": functionType,
  "instanceof": instanceOfType,
  intersection: intersectionType,
  lazy: lazyType,
  literal: literalType,
  map: mapType,
  nan: nanType,
  nativeEnum: nativeEnumType,
  never: neverType,
  "null": nullType,
  nullable: nullableType,
  number: numberType,
  object: objectType,
  oboolean,
  onumber,
  optional: optionalType,
  ostring,
  pipeline: pipelineType,
  preprocess: preprocessType,
  promise: promiseType,
  record: recordType,
  set: setType,
  strictObject: strictObjectType,
  string: stringType,
  symbol: symbolType,
  transformer: effectsType,
  tuple: tupleType,
  "undefined": undefinedType,
  union: unionType,
  unknown: unknownType,
  "void": voidType,
  NEVER,
  ZodIssueCode,
  quotelessJson,
  ZodError
});
const Image$1 = z.object({
  /**The multiscale datasets for this image*/
  multiscales: z.array(
    z.object({
      name: z.string().optional(),
      datasets: z.array(
        z.object({
          path: z.string(),
          coordinateTransformations: z.array(
            z.any().superRefine((x, ctx) => {
              const schemas = [
                z.object({
                  type: z.literal("scale"),
                  scale: z.array(z.number()).min(2)
                }),
                z.object({
                  type: z.literal("translation"),
                  translation: z.array(z.number()).min(2)
                })
              ];
              const errors = schemas.reduce(
                (errors2, schema) => ((result) => result.error ? [...errors2, result.error] : errors2)(
                  schema.safeParse(x)
                ),
                []
              );
              if (schemas.length - errors.length !== 1) {
                ctx.addIssue({
                  path: ctx.path,
                  code: "invalid_union",
                  unionErrors: errors,
                  message: "Invalid input: Should pass single schema"
                });
              }
            })
          ).min(1)
        })
      ).min(1),
      version: z.literal("0.4").optional(),
      axes: z.array(
        z.any().superRefine((x, ctx) => {
          const schemas = [
            z.object({
              name: z.string(),
              type: z.enum(["channel", "time", "space"])
            }),
            z.object({
              name: z.string(),
              type: z.any().refine(
                (value) => !z.enum(["space", "time", "channel"]).safeParse(value).success,
                "Invalid input: Should NOT be valid against schema"
              ).optional()
            })
          ];
          const errors = schemas.reduce(
            (errors2, schema) => ((result) => result.error ? [...errors2, result.error] : errors2)(
              schema.safeParse(x)
            ),
            []
          );
          if (schemas.length - errors.length !== 1) {
            ctx.addIssue({
              path: ctx.path,
              code: "invalid_union",
              unionErrors: errors,
              message: "Invalid input: Should pass single schema"
            });
          }
        })
      ).min(2).max(5),
      coordinateTransformations: z.array(
        z.any().superRefine((x, ctx) => {
          const schemas = [
            z.object({
              type: z.literal("scale"),
              scale: z.array(z.number()).min(2)
            }),
            z.object({
              type: z.literal("translation"),
              translation: z.array(z.number()).min(2)
            }),
            // The JSON schema and my reading of the spec is that while
            // identity is a valid transformation, it cannot be used here.
            // However, some writers write it (e.g iohub), and it has no
            // effect on the overall transformation, so we manually added
            // after generation from the schema.
            // See the following PR for more context:
            // https://github.com/ome/ngff/pull/152
            z.object({
              type: z.literal("identity")
            })
          ];
          const errors = schemas.reduce(
            (errors2, schema) => ((result) => result.error ? [...errors2, result.error] : errors2)(
              schema.safeParse(x)
            ),
            []
          );
          if (schemas.length - errors.length !== 1) {
            ctx.addIssue({
              path: ctx.path,
              code: "invalid_union",
              unionErrors: errors,
              message: "Invalid input: Should pass single schema"
            });
          }
        })
      ).min(1).optional()
    })
  ).min(1).describe("The multiscale datasets for this image"),
  omero: z.object({
    channels: z.array(
      z.object({
        window: z.object({
          end: z.number(),
          max: z.number(),
          min: z.number(),
          start: z.number()
        }),
        label: z.string().optional(),
        family: z.string().optional(),
        color: z.string(),
        active: z.boolean().optional()
      })
    ),
    // The rdefs are not in the JSON schema and are not particularly well
    // described by the specification, but are written by some tools
    // (e.g. iohub), so we manually add them.
    // See the OMERO docs for more information:
    // https://docs.openmicroscopy.org/omero/5.6.1/developers/Web/WebGateway.html#rendering-settings
    rdefs: z.object({
      defaultT: z.number().optional(),
      defaultZ: z.number().optional(),
      color: z.enum(["color", "greyscale"]).optional(),
      projection: z.string().optional()
    }).optional()
  }).optional()
}).describe("JSON from OME-NGFF .zattrs");
const Plate$1 = z.object({
  plate: z.object({
    /**The acquisitions for this plate*/
    acquisitions: z.array(
      z.object({
        /**A unique identifier within the context of the plate*/
        id: z.number().int().gte(0).describe(
          "A unique identifier within the context of the plate"
        ),
        /**The maximum number of fields of view for the acquisition*/
        maximumfieldcount: z.number().int().gt(0).describe(
          "The maximum number of fields of view for the acquisition"
        ).optional(),
        /**The name of the acquisition*/
        name: z.string().describe("The name of the acquisition").optional(),
        /**The description of the acquisition*/
        description: z.string().describe("The description of the acquisition").optional(),
        /**The start timestamp of the acquisition, expressed as epoch time i.e. the number seconds since the Epoch*/
        starttime: z.number().int().gte(0).describe(
          "The start timestamp of the acquisition, expressed as epoch time i.e. the number seconds since the Epoch"
        ).optional(),
        /**The end timestamp of the acquisition, expressed as epoch time i.e. the number seconds since the Epoch*/
        endtime: z.number().int().gte(0).describe(
          "The end timestamp of the acquisition, expressed as epoch time i.e. the number seconds since the Epoch"
        ).optional()
      })
    ).describe("The acquisitions for this plate").optional(),
    /**The version of the specification*/
    version: z.literal("0.4").describe("The version of the specification").optional(),
    /**The maximum number of fields per view across all wells*/
    field_count: z.number().int().gt(0).describe("The maximum number of fields per view across all wells").optional(),
    /**The name of the plate*/
    name: z.string().describe("The name of the plate").optional(),
    /**The columns of the plate*/
    columns: z.array(
      z.object({
        /**The column name*/
        name: z.string().regex(new RegExp("^[A-Za-z0-9]+$")).describe("The column name")
      })
    ).min(1).describe("The columns of the plate"),
    /**The rows of the plate*/
    rows: z.array(
      z.object({
        /**The row name*/
        name: z.string().regex(new RegExp("^[A-Za-z0-9]+$")).describe("The row name")
      })
    ).min(1).describe("The rows of the plate"),
    /**The wells of the plate*/
    wells: z.array(
      z.object({
        /**The path to the well subgroup*/
        path: z.string().regex(new RegExp("^[A-Za-z0-9]+/[A-Za-z0-9]+$")).describe("The path to the well subgroup"),
        /**The index of the well in the rows list*/
        rowIndex: z.number().int().gte(0).describe("The index of the well in the rows list"),
        /**The index of the well in the columns list*/
        columnIndex: z.number().int().gte(0).describe("The index of the well in the columns list")
      })
    ).min(1).describe("The wells of the plate")
  }).optional()
}).describe("JSON from OME-NGFF .zattrs");
const Well$1 = z.object({
  well: z.object({
    /**The fields of view for this well*/
    images: z.array(
      z.object({
        /**A unique identifier within the context of the plate*/
        acquisition: z.number().int().describe("A unique identifier within the context of the plate").optional(),
        /**The path for this field of view subgroup*/
        path: z.string().regex(new RegExp("^[A-Za-z0-9]+$")).describe("The path for this field of view subgroup")
      })
    ).min(1).describe("The fields of view for this well"),
    /**The version of the specification*/
    version: z.literal("0.4").describe("The version of the specification").optional()
  }).optional()
}).describe("JSON from OME-NGFF .zattrs");
const Image = z.object({
  /**The versioned OME-Zarr Metadata namespace*/
  ome: z.object({
    /**The multiscale datasets for this image*/
    multiscales: z.array(
      z.object({
        name: z.string().optional(),
        datasets: z.array(
          z.object({
            path: z.string(),
            coordinateTransformations: z.array(
              z.any().superRefine((x, ctx) => {
                const schemas = [
                  z.object({
                    type: z.literal("scale"),
                    scale: z.array(z.number()).min(2)
                  }),
                  z.object({
                    type: z.literal("translation"),
                    translation: z.array(z.number()).min(2)
                  })
                ];
                const errors = schemas.reduce(
                  (errors2, schema) => ((result) => result.error ? [...errors2, result.error] : errors2)(schema.safeParse(x)),
                  []
                );
                if (schemas.length - errors.length !== 1) {
                  ctx.addIssue({
                    path: ctx.path,
                    code: "invalid_union",
                    unionErrors: errors,
                    message: "Invalid input: Should pass single schema"
                  });
                }
              })
            ).min(1)
          })
        ).min(1),
        axes: z.array(
          z.any().superRefine((x, ctx) => {
            const schemas = [
              z.object({
                name: z.string(),
                type: z.enum(["channel", "time", "space"])
              }),
              z.object({
                name: z.string(),
                type: z.any().refine(
                  (value) => !z.enum(["space", "time", "channel"]).safeParse(value).success,
                  "Invalid input: Should NOT be valid against schema"
                ).optional()
              })
            ];
            const errors = schemas.reduce(
              (errors2, schema) => ((result) => result.error ? [...errors2, result.error] : errors2)(
                schema.safeParse(x)
              ),
              []
            );
            if (schemas.length - errors.length !== 1) {
              ctx.addIssue({
                path: ctx.path,
                code: "invalid_union",
                unionErrors: errors,
                message: "Invalid input: Should pass single schema"
              });
            }
          })
        ).min(2).max(5),
        coordinateTransformations: z.array(
          z.any().superRefine((x, ctx) => {
            const schemas = [
              z.object({
                type: z.literal("scale"),
                scale: z.array(z.number()).min(2)
              }),
              z.object({
                type: z.literal("translation"),
                translation: z.array(z.number()).min(2)
              }),
              // The JSON schema and my reading of the spec is that while
              // identity is a valid transformation, it cannot be used here.
              // However, some writers write it (e.g iohub), and it has no
              // effect on the overall transformation, so we manually added
              // after generation from the schema.
              // See the following PR for more context:
              // https://github.com/ome/ngff/pull/152
              z.object({
                type: z.literal("identity")
              })
            ];
            const errors = schemas.reduce(
              (errors2, schema) => ((result) => result.error ? [...errors2, result.error] : errors2)(
                schema.safeParse(x)
              ),
              []
            );
            if (schemas.length - errors.length !== 1) {
              ctx.addIssue({
                path: ctx.path,
                code: "invalid_union",
                unionErrors: errors,
                message: "Invalid input: Should pass single schema"
              });
            }
          })
        ).min(1).optional()
      })
    ).min(1).describe("The multiscale datasets for this image"),
    omero: z.object({
      channels: z.array(
        z.object({
          window: z.object({
            end: z.number(),
            max: z.number(),
            min: z.number(),
            start: z.number()
          }).optional(),
          label: z.string().optional(),
          family: z.string().optional(),
          color: z.string().optional(),
          active: z.boolean().optional()
        })
      ),
      // The rdefs are not in the JSON schema and are not particularly well
      // described by the specification, but are written by some tools
      // (e.g. iohub), so we manually add them.
      // See the OMERO docs for more information:
      // https://docs.openmicroscopy.org/omero/5.6.1/developers/Web/WebGateway.html#rendering-settings
      rdefs: z.object({
        defaultT: z.number().optional(),
        defaultZ: z.number().optional(),
        color: z.enum(["color", "greyscale"]).optional(),
        projection: z.string().optional()
      }).optional()
    }).optional(),
    /**The version of the OME-Zarr Metadata*/
    version: z.literal("0.5").describe("The version of the OME-Zarr Metadata")
  }).describe("The versioned OME-Zarr Metadata namespace")
}).describe("The zarr.json attributes key");
const Plate = z.object({
  /**The versioned OME-Zarr Metadata namespace*/
  ome: z.object({
    plate: z.object({
      /**The acquisitions for this plate*/
      acquisitions: z.array(
        z.object({
          /**A unique identifier within the context of the plate*/
          id: z.number().int().gte(0).describe(
            "A unique identifier within the context of the plate"
          ),
          /**The maximum number of fields of view for the acquisition*/
          maximumfieldcount: z.number().int().gt(0).describe(
            "The maximum number of fields of view for the acquisition"
          ).optional(),
          /**The name of the acquisition*/
          name: z.string().describe("The name of the acquisition").optional(),
          /**The description of the acquisition*/
          description: z.string().describe("The description of the acquisition").optional(),
          /**The start timestamp of the acquisition, expressed as epoch time i.e. the number seconds since the Epoch*/
          starttime: z.number().int().gte(0).describe(
            "The start timestamp of the acquisition, expressed as epoch time i.e. the number seconds since the Epoch"
          ).optional(),
          /**The end timestamp of the acquisition, expressed as epoch time i.e. the number seconds since the Epoch*/
          endtime: z.number().int().gte(0).describe(
            "The end timestamp of the acquisition, expressed as epoch time i.e. the number seconds since the Epoch"
          ).optional()
        })
      ).describe("The acquisitions for this plate").optional(),
      /**The maximum number of fields per view across all wells*/
      field_count: z.number().int().gt(0).describe("The maximum number of fields per view across all wells").optional(),
      /**The name of the plate*/
      name: z.string().describe("The name of the plate").optional(),
      /**The columns of the plate*/
      columns: z.array(
        z.object({
          /**The column name*/
          name: z.string().regex(new RegExp("^[A-Za-z0-9]+$")).describe("The column name")
        })
      ).min(1).describe("The columns of the plate"),
      /**The rows of the plate*/
      rows: z.array(
        z.object({
          /**The row name*/
          name: z.string().regex(new RegExp("^[A-Za-z0-9]+$")).describe("The row name")
        })
      ).min(1).describe("The rows of the plate"),
      /**The wells of the plate*/
      wells: z.array(
        z.object({
          /**The path to the well subgroup*/
          path: z.string().regex(new RegExp("^[A-Za-z0-9]+/[A-Za-z0-9]+$")).describe("The path to the well subgroup"),
          /**The index of the well in the rows list*/
          rowIndex: z.number().int().gte(0).describe("The index of the well in the rows list"),
          /**The index of the well in the columns list*/
          columnIndex: z.number().int().gte(0).describe("The index of the well in the columns list")
        })
      ).min(1).describe("The wells of the plate")
    }),
    /**The version of the OME-Zarr Metadata*/
    version: z.literal("0.5").describe("The version of the OME-Zarr Metadata")
  }).describe("The versioned OME-Zarr Metadata namespace")
}).describe("The zarr.json attributes key");
const Well = z.object({
  /**The versioned OME-Zarr Metadata namespace*/
  ome: z.object({
    well: z.object({
      /**The fields of view for this well*/
      images: z.array(
        z.object({
          /**A unique identifier within the context of the plate*/
          acquisition: z.number().int().describe(
            "A unique identifier within the context of the plate"
          ).optional(),
          /**The path for this field of view subgroup*/
          path: z.string().regex(new RegExp("^[A-Za-z0-9]+$")).describe("The path for this field of view subgroup")
        })
      ).min(1).describe("The fields of view for this well")
    }),
    /**The version of the OME-Zarr Metadata*/
    version: z.literal("0.5").describe("The version of the OME-Zarr Metadata")
  }).describe("The versioned OME-Zarr Metadata namespace")
}).describe("JSON from OME-Zarr zarr.json");
const versions = ["0.4", "0.5"];
const versionsSet = new Set(versions);
function maybeGetVersion(attrs) {
  if (!("ome" in attrs)) return;
  if (!(attrs.ome instanceof Object)) return;
  const ome = attrs.ome;
  if (!("version" in ome)) return;
  if (typeof ome.version !== "string") return;
  if (!versionsSet.has(ome.version)) return;
  return ome.version;
}
function getVersion(attrs) {
  const version = maybeGetVersion(attrs);
  if (version === void 0) return "0.4";
  return version;
}
function omeZarrToZarrVersion(omeVersion) {
  switch (omeVersion) {
    case "0.4":
      return "v2";
    case "0.5":
      return "v3";
  }
}
function removeProperty(obj, prop) {
  const objCopy = { ...obj };
  delete objCopy[prop];
  return objCopy;
}
async function loadOmeZarrPlate(url) {
  const location = new Location(new FetchStore(url));
  const group = await openGroup(location);
  try {
    return parsePlate(group.attrs);
  } catch {
    throw Error(
      `Failed to parse OME-Zarr plate:
${JSON.stringify(group.attrs)}`
    );
  }
}
function parsePlate(attrs) {
  const version = getVersion(attrs);
  switch (version) {
    case "0.5":
      return {
        ...Plate.parse(attrs).ome,
        originalVersion: "0.5"
      };
    case "0.4":
      return {
        ...adaptPlateV04ToV05(Plate$1.parse(attrs)).ome,
        originalVersion: "0.4"
      };
  }
}
function adaptPlateV04ToV05(platev04) {
  if (platev04.plate === void 0) {
    throw new Error("Plate metadata is missing in OME-Zarr v0.4 plate");
  }
  const plate = removeProperty(platev04.plate, "version");
  return {
    ome: {
      plate,
      version: "0.5"
    }
  };
}
function adaptWellV04ToV05(wellv04) {
  if (wellv04.well === void 0) {
    throw new Error("Well metadata is missing in OME-Zarr v0.4 well");
  }
  const well = removeProperty(wellv04.well, "version");
  return {
    ome: {
      well,
      version: "0.5"
    }
  };
}
function parseWell(attrs) {
  const version = getVersion(attrs);
  switch (version) {
    case "0.5":
      return {
        ...Well.parse(attrs).ome,
        originalVersion: "0.5"
      };
    case "0.4":
      return {
        ...adaptWellV04ToV05(Well$1.parse(attrs)).ome,
        originalVersion: "0.4"
      };
  }
}
async function loadOmeZarrWell(url, path) {
  const location = new Location(new FetchStore(url + "/" + path));
  const group = await openGroup(location);
  try {
    return parseWell(group.attrs);
  } catch {
    throw Error(
      `Failed to parse OME-Zarr well:
${JSON.stringify(group.attrs)}`
    );
  }
}
async function loadOmeroChannels(source) {
  const group = await openGroup(source.location);
  const image = parseOmeZarrImage(group.attrs);
  return image.omero?.channels ?? [];
}
async function loadOmeroDefaults(source) {
  const group = await openGroup(source.location);
  const image = parseOmeZarrImage(group.attrs);
  return image.omero?.rdefs;
}
function adaptImageV04ToV05(imagev04) {
  return {
    ome: {
      multiscales: imagev04.multiscales,
      omero: imagev04.omero,
      version: "0.5"
    }
  };
}
function parseImage(attrs) {
  const version = getVersion(attrs);
  switch (version) {
    case "0.5":
      return {
        ...Image.parse(attrs).ome,
        originalVersion: "0.5"
      };
    case "0.4":
      return {
        ...adaptImageV04ToV05(Image$1.parse(attrs)).ome,
        originalVersion: "0.4"
      };
  }
}
function parseOmeZarrImage(attrs) {
  try {
    return parseImage(attrs);
  } catch {
    throw Error(`Failed to parse OME-Zarr image:
${JSON.stringify(attrs)}`);
  }
}
export {
  transformMat4 as A,
  create$2 as B,
  Color as C,
  Box2 as D,
  ortho as E,
  get_context as F,
  Geometry as G,
  Location as H,
  Idetik as I,
  FetchStore as J,
  openGroup as K,
  Layer as L,
  parseOmeZarrImage as M,
  Node as N,
  openArray as O,
  omeZarrToZarrVersion as P,
  distance$1 as Q,
  RenderableObject as R,
  loadOmeZarrWell as a,
  loadOmeroDefaults as b,
  loadOmeroChannels as c,
  create$3 as d,
  Logger as e,
  clamp as f,
  almostEqual as g,
  fromValues as h,
  distance as i,
  Camera as j,
  fromValues$2 as k,
  loadOmeZarrPlate as l,
  toRadian as m,
  clone$3 as n,
  bezier as o,
  perspective as p,
  copy$2 as q,
  sub as r,
  scaleAndAdd as s,
  transformMat4$1 as t,
  add as u,
  scale$1 as v,
  fromValues$1 as w,
  multiply$2 as x,
  create$4 as y,
  invert as z
};
//# sourceMappingURL=metadata_loaders-CXLkXwNR.js.map
