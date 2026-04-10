import { vec3 } from "gl-matrix";

export class Spherical {
  public radius;
  public phi;
  public theta;

  constructor(radius: number, phi: number, theta: number) {
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
