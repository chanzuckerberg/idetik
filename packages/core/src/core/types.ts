import { vec2, vec3 } from "gl-matrix";

export type ClientToClip = (clientPos: vec2, depth?: number) => vec3;
