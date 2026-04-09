#version 300 es

precision mediump float;
precision highp int;

layout (location = 0) out vec4 fragColor;

uniform highp usampler2D ImageSampler;
uniform mediump sampler2D ColorCycleSampler;
uniform highp usampler2D ColorLookupTableSampler;

uniform float u_opacity;
uniform float u_outlineSelected; // Note: Using float instead of bool due to framework uniform handling
uniform float u_selectedValue;

in vec2 TexCoords;

vec4 unpackRgba(uint packed) {
    uint r = (packed >> 24u) & 0xFFu;
    uint g = (packed >> 16u) & 0xFFu;
    uint b = (packed >> 8u) & 0xFFu;
    uint a = packed & 0xFFu;
    return vec4(float(r), float(g), float(b), float(a)) / 255.0;
}

bool isEdgePixel(uint centerValue) {
    vec2 texSize = vec2(textureSize(ImageSampler, 0));
    vec2 texelSize = 1.0 / texSize;
    
    // Check 8-connected neighbors
    for (int dx = -1; dx <= 1; dx++) {
        for (int dy = -1; dy <= 1; dy++) {
            if (dx == 0 && dy == 0) continue; // Skip center pixel
            
            vec2 neighborCoords = TexCoords + vec2(float(dx), float(dy)) * texelSize;
            
            // Skip if out of bounds
            if (neighborCoords.x < 0.0 || neighborCoords.x > 1.0 || 
                neighborCoords.y < 0.0 || neighborCoords.y > 1.0) {
                continue;
            }
            
            uint neighborValue = texture(ImageSampler, neighborCoords).r;
            if (neighborValue != centerValue) {
                return true;
            }
        }
    }
    return false;
}

void main() {
    uint texel = texture(ImageSampler, TexCoords).r;
    
    // Check if this pixel is the selected value
    bool isSelectedValue = u_outlineSelected > 0.5 && u_selectedValue >= 0.0 && float(texel) == u_selectedValue;
    
    // Check if we should outline this selected segment
    if (isSelectedValue) {
        if (isEdgePixel(texel)) {
            // Draw outline in bright white with layer opacity
            fragColor = vec4(1.0, 1.0, 1.0, u_opacity);
            return;
        }
    }

    uint mapLength = uint(textureSize(ColorLookupTableSampler, 0).x);
    for (uint i = 0u; i < mapLength; ++i) {
        uint key = texelFetch(ColorLookupTableSampler, ivec2(i, 0), 0).r;
        if (texel == key) {
            uint value = texelFetch(ColorLookupTableSampler, ivec2(i, 1), 0).r;
            vec4 color = unpackRgba(value);
            
            // If this is the selected segment and outlining is enabled, make it slightly transparent
            float alpha = isSelectedValue ? u_opacity * color.a * 0.9 : u_opacity * color.a;
            
            fragColor = vec4(color.rgb, alpha);
            return;
        }
    }

    uint cycleLength = uint(textureSize(ColorCycleSampler, 0).x);
    uint index = uint(texel - 1u) % cycleLength;
    vec4 color = texelFetch(ColorCycleSampler, ivec2(index, 0), 0);
    
    // If this is the selected segment and outlining is enabled, make it slightly transparent
    float alpha = isSelectedValue ? u_opacity * color.a * 0.9 : u_opacity * color.a;
    
    fragColor = vec4(color.rgb, alpha);
}