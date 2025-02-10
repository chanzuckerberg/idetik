import { Material } from "./material";
import { Texture } from "../textures/texture";

// Define what types are allowed as uniform values
type UniformValue =
    | number
    | number[]
    | boolean
    | boolean[]
    | Texture;

interface ShaderUniform {
    value: UniformValue;
}

interface ShaderMaterialParameters {
    vertexShader: string;
    fragmentShader: string;
    uniforms: {
        [key: string]: ShaderUniform;
    };
}

export class ShaderMaterial extends Material {
    public vertexShader: string;
    public fragmentShader: string;
    public uniforms: { [key: string]: ShaderUniform };
    public map: Texture | null = null;  // For texture handling

    constructor(parameters: ShaderMaterialParameters) {
        super();
        this.vertexShader = parameters.vertexShader;
        this.fragmentShader = parameters.fragmentShader;
        this.uniforms = parameters.uniforms;

        // Set the texture from uniforms if it exists
        if (parameters.uniforms.texture0?.value instanceof Texture) {
            this.map = parameters.uniforms.texture0.value;
        }
    }

    public get type() {
        return "ShaderMaterial";
    }
}