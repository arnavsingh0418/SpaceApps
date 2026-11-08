import { B, WORLD, clampToWorld, gaitSpeed, type Gait } from "../../../shared/src/sim";

export type MoveInput = {
  x: number; // -1..1, +x right
  z: number; // -1..1, +z toward the camera
  sprint: boolean;
  crouch: boolean;
  jump: boolean; // held this frame
  forward?: boolean; // W/up held (camera-relative), for double-tap sprint
};

/**
 * Minecraft-style movement for *your own* astronaut, run every frame in the browser so
 * there is no waiting on the 10 Hz simulation or the server:
 *  - snappy ground acceleration and friction, weaker steering in the air
 *  - sprint (Shift or double-tap W), crouch (C / Ctrl), jump (Space)
 *  - real Mars gravity (3.72 m/s², 38% of Earth's), so jumps are floaty
 *  - follows the terrain; walks down slopes, falls off ledges, lands with a squash
 * The simulation receives the position via a "pos" action.
 */
export class LocalController {
  x = 0;
  z = 0;
  y = 0; // world height of the feet
  vx = 0;
  vz = 0;
  vy = 0;
  grounded = true;
  gait: Gait = "walk";
  heading = 0;
  landedAt = -10; // seconds (controller clock) of the last landing, for the squash
  landImpact = 0; // 0..1, how hard the last landing was
  jumpedAt = -10;
  time = 0;
  private wasJump = false;
  private lastForwardTap = -10;
  private forwardHeld = false;
  private tapSprint = false;

  /** Snap to a position (new game, respawn, or a large server correction). */
  reset(x: number, z: number, ground: number) {
    this.x = x;
    this.z = z;
    this.y = ground;
    this.vx = this.vz = this.vy = 0;
    this.grounded = true;
  }

  get speed() {
    return Math.hypot(this.vx, this.vz);
  }

  /** Returns true on the frame a jump starts. */
  update(dt: number, input: MoveInput, cold: boolean, groundAt: (x: number, z: number, fromY?: number) => number,
    collides: (x: number, z: number, y: number) => boolean = () => false,
  ) {
    this.time += dt;
    // Double-tap forward to sprint, like Minecraft. It ends when you stop moving forward.
    const forward = input.forward ?? input.z < -0.3;
    if (forward && !this.forwardHeld) {
      if (this.time - this.lastForwardTap < 0.3) this.tapSprint = true;
      this.lastForwardTap = this.time;
    }
    if (!forward) this.tapSprint = false;
    this.forwardHeld = forward;

    let ix = input.x,
      iz = input.z;
    const len = Math.hypot(ix, iz);
    if (len > 1) {
      ix /= len;
      iz /= len;
    }
    const moving = len > 0.05;
    // Crouch wins over sprint; you can't sprint backwards.
    this.gait = input.crouch ? "crouch" : (input.sprint || this.tapSprint) && moving ? "sprint" : "walk";
    const target = gaitSpeed(this.gait, cold);
    const tx = ix * target,
      tz = iz * target;
    // Ground: quick to reach speed and quick to stop. Air: keep momentum, steer a little.
    const accel = this.grounded ? (moving ? 38 : 30) : 6;
    const k = 1 - Math.exp(-accel * dt / Math.max(1, target));
    this.vx += (tx - this.vx) * k;
    this.vz += (tz - this.vz) * k;
    if (!moving && this.grounded && this.speed < 0.05) this.vx = this.vz = 0;

    let jumped = false;
    if (input.jump && !this.wasJump && this.grounded && this.time - this.jumpedAt > B.jumpCooldown) {
      // Sprint-jumping carries a little extra speed, crouch-jumping is a small hop.
      this.vy = B.jumpSpeed * (this.gait === "crouch" ? 0.7 : 1);
      if (this.gait === "sprint") {
        this.vx *= 1.12;
        this.vz *= 1.12;
      }
      this.grounded = false;
      this.jumpedAt = this.time;
      jumped = true;
    }
    this.wasJump = input.jump;

    let nx = this.x + this.vx * dt,
      nz = this.z + this.vz * dt;
    const edge = { x: nx, z: nz };
    if (clampToWorld(edge)) {
      // Slide along the dust-storm edge instead of sticking to it.
      const ux = (edge.x - WORLD.x) / WORLD.r,
        uz = (edge.z - WORLD.z) / WORLD.r,
        out = this.vx * ux + this.vz * uz;
      if (out > 0) {
        this.vx -= out * ux;
        this.vz -= out * uz;
      }
      nx = edge.x;
      nz = edge.z;
    }
    // Solid things (rocks, cave walls, buildings): slide along them like Minecraft.
    // If you are somehow already inside something, let you walk out.
    if ((nx !== this.x || nz !== this.z) && !collides(this.x, this.z, this.y) && collides(nx, nz, this.y)) {
      if (!collides(nx, this.z, this.y)) {
        nz = this.z;
        this.vz = 0;
      } else if (!collides(this.x, nz, this.y)) {
        nx = this.x;
        this.vx = 0;
      } else {
        nx = this.x;
        nz = this.z;
        this.vx = this.vz = 0;
      }
    }
    const ground = groundAt(nx, nz, this.y);
    // Crouching keeps you from walking off a ledge, like sneaking in Minecraft.
    if (this.grounded && this.gait === "crouch" && ground < this.y - 0.9) {
      this.vx = this.vz = 0;
    } else {
      this.x = nx;
      this.z = nz;
    }
    const floor = groundAt(this.x, this.z, this.y);
    if (this.grounded) {
      // Stick to downhill slopes; only become airborne at a real drop.
      if (floor < this.y - 0.7 - this.speed * dt * 2) {
        this.grounded = false;
        this.vy = 0;
      } else this.y = floor;
    }
    if (!this.grounded) {
      this.vy -= B.marsGravity * dt;
      this.y += this.vy * dt;
      if (this.y <= floor) {
        this.landImpact = Math.min(1, Math.max(0, -this.vy - 1) / 5);
        this.y = floor;
        this.vy = 0;
        this.grounded = true;
        this.landedAt = this.time;
      }
    }
    if (this.speed > 0.4) {
      const want = Math.atan2(this.vx, this.vz);
      this.heading += Math.atan2(Math.sin(want - this.heading), Math.cos(want - this.heading)) * (1 - Math.exp(-14 * dt));
    }
    return jumped;
  }
}

/** Height above the take-off point for a jump that started `t` seconds ago (other players). */
export function jumpArc(t: number) {
  if (t < 0) return 0;
  const h = B.jumpSpeed * t - 0.5 * B.marsGravity * t * t;
  return Math.max(0, h);
}
