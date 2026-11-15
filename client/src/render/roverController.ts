import { ROVER, roverPoint, type RoverState } from "../../../shared/src/rover";
import {
  MARS_GRAVITY,
  containRover,
  deflect,
} from "../../../shared/src/surfacePhysics";
export type RoverGround = (x: number, z: number, fromY?: number) => number;
type Input = { throttle: number; steer: number; brake: boolean };
type Blocked = (x: number, z: number, y: number) => boolean;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
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
  vx = 0;
  vz = 0;
  vy = 0;
  grounded = true;
  impact = 0;
  recoveries = 0;
  reset(r: RoverState, ground: RoverGround) {
    this.x = r.x;
    this.z = r.z;
    this.y = ground(r.x, r.z);
    this.heading = r.heading;
    this.speed = r.speed;
    this.vx = -Math.sin(r.heading) * r.speed;
    this.vz = -Math.cos(r.heading) * r.speed;
    this.vy = 0;
    this.steer = this.pitch = this.roll = 0;
    this.grounded = true;
    this.distance = r.odometer;
    this.impact = 0;
  }
  private samples(x: number, z: number, heading: number, ground: RoverGround) {
    const heights: number[] = [];
    for (const dz of [-2.7, 0, 2.7])
      for (const dx of [-1.95, 0, 1.95]) {
        const p = roverPoint({ x, z, heading }, dx, dz);
        heights.push(ground(p.x, p.z, this.y));
      }
    return heights;
  }
  private clear(
    x: number,
    z: number,
    heading: number,
    ground: RoverGround,
    blocked: Blocked,
    checkRise = true,
  ) {
    if (containRover({ x, z, heading }).hit) return false;
    const floor = ground(x, z, this.y);
    if (!Number.isFinite(floor)) return false;
    if (
      checkRise &&
      floor - this.y > 0.35 + Math.hypot(x - this.x, z - this.z) * 0.7
    )
      return false;
    const move = Math.hypot(x - this.x, z - this.z);
    if (
      checkRise &&
      move > 1e-7 &&
      ground(
        this.x + (x - this.x) / move,
        this.z + (z - this.z) / move,
        this.y,
      ) -
        this.y >
        0.7
    )
      return false;
    for (const dz of [-3.15, 0, 3.15])
      for (const dx of [-2.0, 0, 2.0]) {
        const p = roverPoint({ x, z, heading }, dx, dz);
        if (blocked(p.x, p.z, this.y)) return false;
      }
    return true;
  }
  /** Recover old saves or wind placements inside solids, once, to the nearest clear ground. */
  recover(ground: RoverGround, blocked: Blocked) {
    if (this.clear(this.x, this.z, this.heading, ground, blocked, false))
      return false;
    const x = this.x,
      z = this.z,
      y = this.y;
    for (let radius = 0.5; radius <= 20; radius += 0.5)
      for (let n = 0; n < 24; n++) {
        const nx = x + Math.cos((n * Math.PI) / 12) * radius,
          nz = z + Math.sin((n * Math.PI) / 12) * radius;
        this.y = ground(nx, nz);
        if (this.clear(nx, nz, this.heading, ground, blocked, false)) {
          this.x = nx;
          this.z = nz;
          this.vx = this.vz = this.vy = this.speed = 0;
          this.grounded = true;
          this.recoveries++;
          return true;
        }
      }
    this.y = y;
    return false;
  }
  update(dt: number, input: Input, ground: RoverGround, blocked: Blocked) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    dt = Math.min(dt, 0.1);
    this.recover(ground, blocked);
    const steps = Math.ceil(dt * 120),
      h = dt / steps;
    for (let n = 0; n < steps; n++) {
      this.impact *= Math.exp(-h * 5);
      const fx = -Math.sin(this.heading),
        fz = -Math.cos(this.heading),
        rx = Math.cos(this.heading),
        rz = -Math.sin(this.heading);
      const forward = this.vx * fx + this.vz * fz,
        lateral = this.vx * rx + this.vz * rz;
      const throttle = clamp(input.throttle, -1, 1),
        target = input.brake
          ? 0
          : throttle * (throttle < 0 ? ROVER.reverseSpeed : ROVER.maxSpeed);
      const grip = this.grounded ? 1 : 0.035;
      const acceleration =
        (input.brake ? 1.6 : Math.abs(throttle) < 0.05 ? 0.45 : 1.2) *
        MARS_GRAVITY *
        grip;
      const dv = clamp(target - forward, -acceleration * h, acceleration * h),
        side = clamp(
          -lateral,
          -MARS_GRAVITY * h * grip,
          MARS_GRAVITY * h * grip,
        );
      this.vx += fx * dv + rx * side;
      this.vz += fz * dv + rz * side;
      const maxSteer =
        0.6 - 0.32 * Math.min(1, Math.abs(forward) / ROVER.maxSpeed);
      this.steer +=
        (clamp(input.steer, -1, 1) * maxSteer - this.steer) *
        (1 - Math.exp(-10 * h));
      const heading =
        this.heading -
        ((Math.tan(this.steer) * forward) / ROVER.wheelbase) *
          h *
          (this.grounded ? 1 : 0.05);
      const oldX = this.x,
        oldZ = this.z;
      let x = this.x + this.vx * h,
        z = this.z + this.vz * h;
      const edge = containRover({ x, z, heading });
      if (edge.hit) {
        x = edge.x;
        z = edge.z;
        deflect(this, -edge.nx, -edge.nz);
        this.impact = Math.min(1, Math.hypot(this.vx, this.vz) / 12);
      }
      if (this.clear(x, z, heading, ground, blocked)) {
        this.x = x;
        this.z = z;
        this.heading = heading;
      } else {
        // Sweep to contact, then keep tangential travel rather than killing all momentum.
        let lo = 0,
          hi = 1;
        for (let i = 0; i < 9; i++) {
          const mid = (lo + hi) / 2;
          if (
            this.clear(
              oldX + (x - oldX) * mid,
              oldZ + (z - oldZ) * mid,
              this.heading,
              ground,
              blocked,
            )
          )
            lo = mid;
          else hi = mid;
        }
        this.x = oldX + (x - oldX) * lo;
        this.z = oldZ + (z - oldZ) * lo;
        const slideX = this.clear(x, this.z, this.heading, ground, blocked),
          slideZ = this.clear(this.x, z, this.heading, ground, blocked);
        this.impact = Math.min(1, Math.hypot(this.vx, this.vz) / 12);
        if (slideX && Math.abs(x - this.x) > 0.00001) {
          this.x = x;
          deflect(this, 0, this.vz > 0 ? -1 : 1);
        } else if (slideZ && Math.abs(z - this.z) > 0.00001) {
          this.z = z;
          deflect(this, this.vx > 0 ? -1 : 1, 0);
        } else {
          this.vx *= -0.1;
          this.vz *= -0.1;
        }
        if (this.clear(this.x, this.z, heading, ground, blocked))
          this.heading = heading;
      }
      const floor = ground(this.x, this.z, this.y);
      // A descending ledge removes wheel support; it is not an invisible horizontal wall.
      if (this.y - floor > 0.18) {
        this.grounded = false;
        this.vy -= MARS_GRAVITY * h;
        this.y += this.vy * h;
      } else if (this.vy <= 0) {
        this.y = floor;
        this.vy = 0;
        this.grounded = true;
      }
      if (this.y <= floor) {
        this.impact = Math.max(this.impact, Math.min(1, Math.abs(this.vy) / 9));
        this.y = floor;
        this.vy = 0;
        this.grounded = true;
      }
      const heights = this.samples(this.x, this.z, this.heading, ground);
      const pitch = clamp(
        Math.atan2(
          (heights[0] +
            heights[1] +
            heights[2] -
            heights[6] -
            heights[7] -
            heights[8]) /
            3,
          5.4,
        ),
        -0.6,
        0.6,
      );
      const roll = clamp(
        -Math.atan2(
          (heights[0] +
            heights[3] +
            heights[6] -
            heights[2] -
            heights[5] -
            heights[8]) /
            3,
          3.9,
        ),
        -0.5,
        0.5,
      );
      this.pitch += (pitch - this.pitch) * (1 - Math.exp(-h * 9));
      this.roll += (roll - this.roll) * (1 - Math.exp(-h * 9));
      this.speed =
        this.vx * -Math.sin(this.heading) + this.vz * -Math.cos(this.heading);
      if (Math.hypot(this.vx, this.vz) < 0.025) {
        this.vx = this.vz = this.speed = 0;
      }
      const travel = Math.hypot(this.x - oldX, this.z - oldZ);
      this.distance += travel * (this.speed < 0 ? -1 : 1);
    }
  }
}
