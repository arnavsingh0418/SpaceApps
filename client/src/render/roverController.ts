import { ROVER, roverPoint, type RoverState } from "../../../shared/src/rover";
import { WORLD } from "../../../shared/src/sim";
export type RoverGround = (x: number, z: number, fromY?: number) => number;
export class RoverController {
  x = 0;
  z = 0;
  y = 0;
  heading = 0;
  speed = 0;
  steer = 0;
  distance = 0;
  pitch = 0;
  roll = 0;
  reset(r: RoverState, ground: RoverGround) {
    this.x = r.x;
    this.z = r.z;
    this.y = ground(r.x, r.z);
    this.heading = r.heading;
    this.speed = r.speed;
    this.steer = 0;
    this.pitch = this.roll = 0;
    this.distance = r.odometer;
  }
  update(
    dt: number,
    input: { throttle: number; steer: number; brake: boolean },
    ground: RoverGround,
    blocked: (x: number, z: number, y: number) => boolean,
  ) {
    dt = Math.max(0, Math.min(dt, 0.1));
    const steps = Math.max(1, Math.ceil(dt / 0.02)),
      h = dt / steps;
    for (let n = 0; n < steps; n++) {
      const throttle = Math.max(-1, Math.min(1, input.throttle));
      const target = input.brake
        ? 0
        : throttle * (throttle < 0 ? ROVER.reverseSpeed : ROVER.maxSpeed);
      const rate = input.brake ? 18 : Math.abs(throttle) < 0.05 ? 4 : 5.5;
      this.speed += Math.max(
        -rate * h,
        Math.min(rate * h, target - this.speed),
      );
      if (Math.abs(this.speed) < 0.025) this.speed = 0;
      const maxSteer =
        0.6 - 0.32 * Math.min(1, Math.abs(this.speed) / ROVER.maxSpeed);
      this.steer +=
        (Math.max(-1, Math.min(1, input.steer)) * maxSteer - this.steer) *
        (1 - Math.exp(-10 * h));
      const heading =
        this.heading -
        ((Math.tan(this.steer) * this.speed) / ROVER.wheelbase) * h;
      const x = this.x - Math.sin(heading) * this.speed * h,
        z = this.z - Math.cos(heading) * this.speed * h;
      const candidate = { x, z, heading };
      const y = ground(x, z, this.y);
      let unsafe =
        Math.hypot(x - WORLD.x, z - WORLD.z) > WORLD.r - 5 ||
        Math.abs(y - this.y) > 0.6;
      // Sample the complete footprint, including side sills, wheel contacts and roof clearance.
      const heights: number[] = [];
      for (const dz of [-2.7, 0, 2.7])
        for (const dx of [-1.95, 0, 1.95]) {
          const p = roverPoint(candidate, dx, dz),
            floor = ground(p.x, p.z, this.y);
          heights.push(floor);
          if (
            !Number.isFinite(floor) ||
            Math.abs(floor - y) > 1.35 ||
            blocked(p.x, p.z, Math.min(this.y, y))
          )
            unsafe = true;
        }
      if (Math.max(...heights) - Math.min(...heights) > 2.2) unsafe = true;
      if (unsafe) {
        this.speed = 0;
        continue;
      }
      this.distance += this.speed * h;
      this.x = x;
      this.z = z;
      this.y = y;
      this.heading = heading;
      this.pitch = Math.atan2(
        (heights[0] +
          heights[1] +
          heights[2] -
          heights[6] -
          heights[7] -
          heights[8]) /
          3,
        5.4,
      );
      this.roll = -Math.atan2(
        (heights[0] +
          heights[3] +
          heights[6] -
          heights[2] -
          heights[5] -
          heights[8]) /
          3,
        3.9,
      );
    }
  }
}
