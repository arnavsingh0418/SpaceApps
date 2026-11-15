import { it, expect } from "vitest";
import * as T from "three";
import { Terrain } from "../client/src/render/terrain";
import { RoverController } from "../client/src/render/roverController";
import { createRover, roverPoint, ROVER } from "../shared/src/rover";
import { blowDustDevil, type Gust } from "../shared/src/dustDevil";
import {
  MARS_GRAVITY,
  containRover,
  resolveRoverSurface,
  SURFACE_BOUNDS,
  separateHab,
  separateVestibule,
} from "../shared/src/surfacePhysics";
const flat = () => 0,
  none = () => false;
function drive(
  c: RoverController,
  seconds: number,
  input = { throttle: 1, steer: 0, brake: false },
  floor: (x: number, z: number) => number = flat,
  blocked: (x: number, z: number, y: number) => boolean = none,
) {
  for (let t = 0; t < Math.round(seconds * 60); t++)
    c.update(1 / 60, input, floor, blocked);
}
function car(x = 0, z = 0, heading = 0) {
  const c = new RoverController();
  c.reset({ ...createRover(), x, z, heading }, flat);
  return c;
}
it("glances along a wall and reverses away without freezing its steering or tangent motion", () => {
  const c = car(0, 0, -Math.PI / 4),
    wall = (x: number) => x > 5;
  drive(c, 4, undefined, flat, wall);
  expect(c.x).toBeLessThan(3.01);
  expect(c.z).toBeLessThan(-12);
  const at = { x: c.x, z: c.z };
  drive(c, 4, { throttle: -1, steer: 0, brake: false }, flat, wall);
  expect(c.x).toBeLessThan(at.x - 2);
  expect(c.z).toBeGreaterThan(at.z + 2);
});
it("slides along the map perimeter with every oriented hull corner inside it", () => {
  const bounds = SURFACE_BOUNDS,
    pose = containRover({
      x: bounds.x + bounds.r,
      z: bounds.z,
      heading: -Math.PI / 4,
    });
  const c = car(pose.x, pose.z, -Math.PI / 4);
  c.speed = 12;
  c.vx = Math.SQRT1_2 * 12;
  c.vz = -Math.SQRT1_2 * 12;
  drive(c, 1);
  expect(Math.abs(c.z - bounds.z)).toBeGreaterThan(4);
  for (const dx of [-ROVER.halfWidth, ROVER.halfWidth])
    for (const dz of [-ROVER.halfLength, ROVER.halfLength]) {
      const p = roverPoint(c, dx, dz);
      expect(Math.hypot(p.x - bounds.x, p.z - bounds.z)).toBeLessThanOrEqual(
        bounds.r,
      );
    }
});
it("drops with Mars gravity, lands, and can drive out after a descent", () => {
  const c = car();
  c.y = 6;
  c.grounded = false;
  drive(c, 0.5, { throttle: 0, steer: 0, brake: false });
  expect(c.vy).toBeCloseTo(-MARS_GRAVITY * 0.5, 1);
  expect(c.y).toBeCloseTo(6 - 0.5 * MARS_GRAVITY * 0.5 ** 2, 1);
  drive(c, 2, { throttle: 0, steer: 0, brake: false });
  expect(c.grounded).toBe(true);
  expect(c.y).toBe(0);
  drive(c, 2);
  expect(c.z).toBeLessThan(-5);
});
it("has the same vortex trajectory at 10, 30 and 60 Hz, with no random pulses", () => {
  const paths = [10, 30, 60].map((hz) => {
    const body: { x: number; z: number; gust?: Gust } = { x: 2, z: 0 };
    for (let i = 0; i < hz * 3; i++)
      blowDustDevil(body, { x: 0, z: 0 }, i / hz, 1 / hz, true);
    return body;
  });
  for (const p of paths.slice(1)) {
    expect(p.x).toBeCloseTo(paths[0].x, 5);
    expect(p.z).toBeCloseTo(paths[0].z, 5);
    expect(p.gust!.height).toBeCloseTo(paths[0].gust!.height, 5);
  }
});
it("clears a gust after landing, including an old save initially embedded in the habitat", () => {
  const body = {
    x: 0,
    z: -17,
    heading: 0.3,
    gust: { vx: 5, vz: -2, height: 2, vy: 0 },
  } as ReturnType<typeof createRover>;
  for (let i = 0; i < 240; i++) {
    blowDustDevil(
      body,
      i < 60 ? { x: 2, z: -17 } : { x: 100, z: 100 },
      i / 60,
      1 / 60,
      true,
      (_from, to, g) =>
        resolveRoverSurface({ ...to, heading: body.heading }, g),
    );
    expect(separateHab(body).hit).toBe(false);
    expect(separateVestibule(body).hit).toBe(false);
  }
  expect(body.gust).toBeUndefined();
  const c = car(body.x, body.z, body.heading);
  const before = c.z;
  drive(c, 1);
  expect(Math.abs(c.z - before)).toBeGreaterThan(1);
});
it("does not treat a habitat roof as rover ground, and reindexes visual replacements without ghost walls", async () => {
  const terrain = new Terrain();
  terrain.ready = true;
  const obj = new T.Group(),
    fallback = new T.Mesh(new T.BoxGeometry(12, 4, 12));
  fallback.position.y = 2;
  obj.add(fallback);
  let finish!: () => void;
  obj.userData.marsPromise = new Promise<void>((r) => (finish = r));
  terrain.addStatic(obj);
  expect(terrain.collides(0, 0, 0, .6, ROVER.height, .65)).toBe(true);
  fallback.visible = false;
  const actual = new T.Mesh(new T.BoxGeometry(2, 4, 2));
  actual.position.set(8, 2, 0);
  obj.add(actual);
  finish();
  await obj.userData.marsPromise;
  expect(terrain.collides(0, 0, 0, .6, ROVER.height, .65)).toBe(false);
  expect(terrain.collides(8, 0, 0, .6, ROVER.height, .65)).toBe(true);
  expect(terrain.groundAt(8, 0)).toBe(0);
  expect(terrain.heightAt(8, 0, 0)).toBe(0);
  expect(terrain.heightAt(8, 0, 4)).toBe(4);
  terrain.removeStatic(obj);
  expect(terrain.collides(8, 0, 0, .6, ROVER.height, .65)).toBe(false);
});
it("recovers a rover placed inside a solid and restores drive input", () => {
  const c = car(0, 0),
    solid = (x: number, z: number) => Math.hypot(x, z) < 5;
  c.update(1 / 60, { throttle: 0, steer: 0, brake: true }, flat, solid);
  expect(c.recoveries).toBe(1);
  expect(Math.hypot(c.x, c.z)).toBeGreaterThan(5);
  const before = { x: c.x, z: c.z };
  drive(c, 2, { throttle: -1, steer: 0, brake: false }, flat, solid);
  expect(Math.hypot(c.x - before.x, c.z - before.z)).toBeGreaterThan(1);
});
