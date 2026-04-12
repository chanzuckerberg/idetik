struct Varyings {
    @builtin(position) position: vec4f,
};

struct FrameUniforms {
    projection: mat4x4f,
};

struct ObjectUniforms {
    modelView: mat4x4f,
};

@group(0) @binding(0) var<uniform> frame: FrameUniforms;
@group(1) @binding(0) var<uniform> object: ObjectUniforms;

@vertex
fn vert(@location(0) aPos: vec3f) -> Varyings {
    var out = Varyings();
    out.position = frame.projection * object.modelView * vec4f(aPos, 1.0);
    return out;
}

@fragment
fn frag(in: Varyings) -> @location(0) vec4f {
    return vec4f(1.0);
}