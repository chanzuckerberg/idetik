import { vec3 } from "gl-matrix";

export type SphericalProps = {
  radius: number;
  phi: number;
  theta: number;
};

export class Spherical {
  public radius;
  public phi;
  public theta;

  constructor({ radius, phi, theta }: SphericalProps) {
    this.radius = radius;
    this.phi = phi;
    this.theta = theta;
  }

  public toVec3() {
    const c = Math.cos(this.theta);
    return vec3.fromValues(
      this.radius * Math.sin(this.phi) * c,
      -this.radius * Math.sin(this.theta),
      this.radius * Math.cos(this.phi) * c
    );
  }
}
