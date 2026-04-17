struct Varyings {
    @builtin(position) position: vec4f,
    @location(0) tex_coords: vec2f,
};

struct FrameUniforms {
    projection: mat4x4f,
};

struct LayerUniforms {
    opacity: f32,
};

struct ObjectUniforms {
    modelView: mat4x4f,
    color: vec3f,
    valueOffset: f32,
    valueScale: f32,
};

@group(0) @binding(0) var<uniform> frame: FrameUniforms;
@group(1) @binding(0) var<uniform> layer: LayerUniforms;
@group(2) @binding(0) var<uniform> object: ObjectUniforms;

@group(3) @binding(0) var texture: texture_2d<u32>;

@vertex
fn vert(
    @location(0) aPos: vec3f,
    @location(2) aTexCoords: vec2f,
) -> Varyings {
    var out = Varyings();
    out.position = frame.projection * object.modelView * vec4f(aPos, 1.0);
    out.tex_coords = aTexCoords;
    return out;
}

@fragment
fn frag(in: Varyings) -> @location(0) vec4f {
    let dims = textureDimensions(texture);
    let coords = vec2u(in.tex_coords * vec2f(dims));
    let texel = f32(textureLoad(texture, coords, 0).r);
    let value = (texel + object.valueOffset) * object.valueScale;
    return vec4f(value * object.color, layer.opacity);
}
