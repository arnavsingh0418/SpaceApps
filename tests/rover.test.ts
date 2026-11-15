import { describe, expect, it, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  createGame,
  addPlayer,
  dispatch,
  removePlayer,
  tick,
  WORLD,
  gaitSpeed,
} from "../shared/src/sim";
import {
  createRover,
  roverState,
  roverSeat,
  roverExits,
  roverBlocks,
  ROVER,
} from "../shared/src/rover";
import { RoverController } from "../client/src/render/roverController";
import { RoverView } from "../client/src/render/rover";
import { Terrain } from "../client/src/render/terrain";
import { roverDashboard } from "../client/src/ui/rover";
const setup = () => {
  const s = createGame(420);
  addPlayer(s, "a");
  addPlayer(s, "b");
  s.phase = "day";
  for (const p of Object.values(s.players))
    Object.assign(p, { x: ROVER.spawn.x + 3.8, z: ROVER.spawn.z });
  return s;
};
const board = (s: ReturnType<typeof setup>, id = "a") =>
  dispatch(s, id, { type: "boardRover" });
afterEach(() => vi.restoreAllMocks());

describe("shared rover authority and lifecycle", () => {
  it("upgrades old saves and assigns one driver plus three unique passenger seats", () => {
    const s = setup();
    delete s.rover;
    expect(roverState(s).driver).toBeNull();
    addPlayer(s, "c");
    addPlayer(s, "d");
    for (const p of Object.values(s.players)) Object.assign(p, ROVER.spawn);
    for (const id of ["a", "b", "c", "d"]) expect(board(s, id)).toBeUndefined();
    expect(roverState(s).driver).toBe("a");
    expect(roverState(s).passengers).toEqual(["b", "c", "d"]);
    board(s, "b");
    expect(roverState(s).passengers).toHaveLength(3);
    expect(
      ["a", "b", "c", "d"].map((id) => roverSeat(roverState(s), id)),
    ).toEqual([0, 1, 2, 3]);
  });
  it("rejects remote boarding, moving boarding, passenger steering and driver theft", () => {
    const s = setup();
    s.players.a.x += 20;
    expect(board(s)).toMatch(/closer/);
    Object.assign(s.players.a, ROVER.spawn);
    board(s);
    expect(
      dispatch(s, "b", {
        type: "driveRover",
        x: 25,
        z: -17,
        heading: 0,
        speed: 10,
      }),
    ).toMatch(/driver/);
    board(s, "b");
    expect(dispatch(s, "b", { type: "takeRover" })).toMatch(/Another/);
    roverState(s).speed = 3;
    expect(
      dispatch(s, "b", { type: "exitRover", ...roverExits(roverState(s))[0] }),
    ).toMatch(/stop/);
  });
  it("synchronizes riders and supplies without integrating walking twice", () => {
    const s = setup();
    board(s);
    board(s, "b");
    s.players.b.bag = { scrap: 4, ice: 2 };
    tick(s, 0.1);
    const r = roverState(s);
    const z = r.z;
    dispatch(s, "a", {
      type: "driveRover",
      x: r.x,
      z: z - 1,
      heading: 0,
      speed: 10,
    });
    expect(s.players.a.z).toBe(z - 1);
    expect(s.players.b.z).toBe(z - 1);
    dispatch(s, "a", { type: "pos", x: 300, z: 300, mx: 1, mz: 1 });
    dispatch(s, "b", { type: "move", x: 1, z: 0 });
    tick(s, 0.1);
    expect(s.players.a.z).toBe(z - 1);
    expect(s.players.b.x).toBe(r.x);
    expect(s.players.b.bag).toEqual({ scrap: 4, ice: 2 });
    expect(dispatch(s, "b", { type: "pick", target: s.items[0].id })).toMatch(
      /exit/,
    );
  });
  it("rejects invalid reports and prevents repeated same-tick messages manufacturing distance", () => {
    const s = setup();
    board(s);
    const r = roverState(s);
    const x = r.x;
    expect(
      dispatch(s, "a", {
        type: "driveRover",
        x: NaN,
        z: 0,
        heading: 0,
        speed: 0,
      }),
    ).toMatch(/Invalid/);
    for (let i = 0; i < 30; i++)
      dispatch(s, "a", {
        type: "driveRover",
        x: 500,
        z: r.z,
        heading: Math.PI,
        speed: 999,
      });
    expect(r.x - x).toBeLessThanOrEqual(0.80001);
    expect(r.speed).toBeLessThanOrEqual(ROVER.maxSpeed);
    expect(Math.abs(r.heading)).toBeLessThan(0.2);
    tick(s, 0.1);
    dispatch(s, "a", {
      type: "driveRover",
      x: r.x + 1,
      z: r.z,
      heading: r.heading,
      speed: 1,
    });
    expect(r.x - x).toBeGreaterThan(0.8);
  });
  it("validates dismounts, permits driver handoff and preserves parked position across saves", () => {
    const s = setup();
    board(s);
    board(s, "b");
    const r = roverState(s);
    expect(dispatch(s, "a", { type: "exitRover", x: r.x, z: r.z })).toMatch(
      /safe/,
    );
    expect(
      dispatch(s, "a", { type: "exitRover", x: r.x + 50, z: r.z }),
    ).toMatch(/safe/);
    const exit = roverExits(r)[0];
    expect(dispatch(s, "a", { type: "exitRover", ...exit })).toBeUndefined();
    expect(s.players.a.x).toBe(exit.x);
    expect(r.driver).toBeNull();
    expect(dispatch(s, "b", { type: "takeRover" })).toBeUndefined();
    expect(r.driver).toBe("b");
    const saved = JSON.parse(JSON.stringify(s));
    expect(roverState(saved).x).toBe(r.x);
    expect(roverState(saved).driver).toBe("b");
  });
  it("stops after lost packets or driver disconnect, and keeps flight positions independent", () => {
    const s = setup();
    board(s);
    board(s, "b");
    const r = roverState(s);
    r.speed = 15;
    tick(s, 0.5);
    expect(r.speed).toBe(0);
    removePlayer(s, "a");
    expect(r.driver).toBeNull();
    expect(r.passengers).toEqual(["b"]);
    dispatch(s, "b", { type: "takeRover" });
    s.phase = "flight";
    Object.assign(s.players.b, { x: 0, z: 4 });
    const control = structuredClone(s);
    delete control.rover;
    tick(control, 0.1);
    tick(s, 0.1);
    expect(r.driver).toBeNull();
    expect(r.passengers).toEqual([]);
    expect(s.players.b.z).toBe(control.players.b.z);
  });
  it("only accepts exploration-phase boarding and keeps the hull inside the world", () => {
    const s = setup();
    s.phase = "power";
    expect(board(s)).toMatch(/exploration/);
    s.phase = "day";
    board(s);
    const r = roverState(s);
    Object.assign(r, { x: WORLD.x + WORLD.r - 5.2, z: WORLD.z, credit: 5 });
    dispatch(s, "a", {
      type: "driveRover",
      x: r.x + 1,
      z: r.z,
      heading: 0,
      speed: 5,
    });
    for (const dx of [-ROVER.halfWidth, ROVER.halfWidth])
      for (const dz of [-ROVER.halfLength, ROVER.halfLength]) {
        const p = {x:r.x+dx,z:r.z+dz};
        expect(Math.hypot(p.x-WORLD.x,p.z-WORLD.z)).toBeLessThan(WORLD.r);
      }
  });
});

const flat: (x: number, z: number, fromY?: number) => number = () => 0;
const clear: (x: number, z: number, y: number) => boolean = () => false;
function drive(
  c: RoverController,
  seconds: number,
  input = { throttle: 1, steer: 0, brake: false },
  ground = flat,
  blocked = clear,
) {
  for (let t = 0; t < seconds; t += 1 / 60)
    c.update(1 / 60, input, ground, blocked);
}
const controller = () => {
  const c = new RoverController();
  c.reset(createRover(), flat);
  return c;
};
describe("rover terrain controller", () => {
  it("accelerates beyond sprint, brakes to a stop and reverses more slowly", () => {
    const c = controller();
    drive(c, 5);
    expect(c.speed).toBeCloseTo(ROVER.maxSpeed, 1);
    expect(c.speed).toBeGreaterThan(gaitSpeed("sprint", false));
    const z = c.z;
    drive(c, 3.3, { throttle: 1, steer: 0, brake: true });
    expect(c.speed).toBe(0);
    expect(c.z).toBeLessThan(z);
    drive(c, 2, { throttle: -1, steer: 0, brake: false });
    expect(c.speed).toBeCloseTo(-ROVER.reverseSpeed);
    expect(c.speed).toBeGreaterThan(-ROVER.maxSpeed);
  });
  it("steers with motion, remains still under brakes, and rolls back correctly", () => {
    const c = controller();
    drive(c, 0.5, { throttle: 0, steer: 1, brake: false });
    expect(c.heading).toBe(0);
    drive(c, 2, { throttle: 1, steer: 1, brake: false });
    expect(c.heading).toBeLessThan(0);
    expect(c.x).toBeGreaterThan(ROVER.spawn.x);
  });
  it("stops the complete footprint before a wall instead of tunnelling at speed", () => {
    const c = controller();
    c.speed = 18;
    drive(
      c,
      2,
      { throttle: 1, steer: 0, brake: false },
      flat,
      (_x, z) => z < ROVER.spawn.z - 7,
    );
    expect(c.z).toBeGreaterThan(ROVER.spawn.z - 4.4);
    expect(c.speed).toBe(0);
  });
  it("falls off ledges under gravity, rejects steep uphill terrain and follows gentle slopes", () => {
    const cliff = controller();
    drive(cliff, 3, undefined, (_x, z) => (z < ROVER.spawn.z - 6 ? -8 : 0));
    expect(cliff.z).toBeLessThan(ROVER.spawn.z - 6);
    expect(cliff.y).toBeLessThan(0);
    expect(cliff.y).toBeGreaterThanOrEqual(-8);
    const gentle = controller();
    const slope = (_x: number, z: number) => (ROVER.spawn.z - z) * 0.12;
    gentle.reset(createRover(), slope);
    drive(gentle, 2, undefined, slope);
    expect(gentle.y).toBeGreaterThan(0.5);
    expect(gentle.pitch).toBeGreaterThan(0);
    const steep = controller();
    const hill = (_x: number, z: number) => (ROVER.spawn.z - z) * 0.8;
    steep.reset(createRover(), hill);
    drive(steep, 1, undefined, hill);
    expect(steep.z).toBe(ROVER.spawn.z);
  });
  it("uses rover-sized clearance under low ceilings", () => {
    const terrain = new Terrain();
    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(15, 0.4, 15),
      new THREE.MeshBasicMaterial(),
    );
    roof.position.y = 4;
    terrain.addStatic(roof);
    expect(terrain.collides(0, 0, 0)).toBe(false);
    expect(terrain.collides(0, 0, 0, 0.6, ROVER.height, 0.65)).toBe(true);
  });
  it("crosses uneven hills outside the landing pad without treating the uphill tires as obstacles", () => {
    const c = controller();
    const slope = (x: number, z: number) =>
      (ROVER.spawn.z - z) * 0.43 + (x - ROVER.spawn.x) * 0.17 + Math.sin(z) * 0.12;
    c.reset(createRover(), slope);
    // A collision query starting below the local hillside would detect the hillside itself.
    drive(c, 4, undefined, slope, (x, z, clearanceFloor) => slope(x, z) - clearanceFloor > 0.65);
    expect(ROVER.spawn.z - c.z).toBeGreaterThan(35);
    expect(c.pitch).toBeGreaterThan(0.34);
    expect(Math.abs(c.roll)).toBeGreaterThan(0.13);
  });
  it("lets the rover reverse away from an abrupt ledge", () => {
    const c = controller();
    const ledge = (_x: number, z: number) => z < ROVER.spawn.z - 9 ? 3 : 0;
    drive(c, 3, undefined, ledge);
    const stopped = c.z;
    expect(stopped).toBeGreaterThan(ROVER.spawn.z - 7);
    expect(c.speed).toBe(0);
    drive(c, 2, { throttle: -1, steer: 0, brake: false }, ledge);
    expect(c.z - stopped).toBeGreaterThan(4);
  });
  it("accounts for rotated hulls and provides exits outside the walking collision box", () => {
    const r = createRover();
    r.heading = Math.PI / 2;
    expect(roverBlocks(r, r.x + 3, r.z)).toBe(true);
    expect(roverBlocks(r, r.x, r.z + 4)).toBe(false);
    expect(roverExits(r).every((p) => !roverBlocks(r, p.x, p.z))).toBe(true);
  });
});

it("loads the actual self-contained Blender rover and animates its wheel/steering joints", async () => {
  const bytes = readFileSync(
    new URL("../client/public/mars/vehicles/Mars_Rover.glb", import.meta.url),
  );
  const json = JSON.parse(
    bytes.toString("utf8", 20, 20 + bytes.readUInt32LE(12)),
  );
  expect(json.buffers.every((b: { uri?: string }) => !b.uri)).toBe(true);
  expect(json.meshes).toHaveLength(7);
  expect(
    json.meshes.reduce(
      (sum: number, m: { primitives: unknown[] }) => sum + m.primitives.length,
      0,
    ),
  ).toBeLessThan(32);
  vi.spyOn(GLTFLoader.prototype, "loadAsync").mockImplementation(() =>
    new GLTFLoader().parseAsync(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      "",
    ),
  );
  const view = new RoverView(new THREE.Scene());
  await view.ready;
  expect(view.status).toBe("ready");
  const c = controller();
  c.distance = 3;
  c.steer = 0.2;
  view.update(
    createRover(),
    { heightAt: flat } as unknown as Terrain,
    0.016,
    c,
  );
  for (const n of ["FL", "FR", "ML", "MR", "RL", "RR"])
    expect(view.group.getObjectByName("Wheel_" + n)!.rotation.x).toBeCloseTo(
      -3 / ROVER.wheelRadius,
    );
  expect(view.group.getObjectByName("Steer_FL")!.rotation.y).toBeCloseTo(-0.2);
  const box = new THREE.Box3().setFromObject(view.group);
  expect(box.max.y - box.min.y).toBeGreaterThan(5);
  expect(box.max.y - box.min.y).toBeLessThan(6.3);
});
it("keeps the vehicle usable if its GLB download fails", async () => {
  vi.spyOn(GLTFLoader.prototype, "loadAsync").mockRejectedValue(
    new Error("offline"),
  );
  vi.spyOn(console, "warn").mockImplementation(() => {});
  const view = new RoverView(new THREE.Scene());
  await view.ready;
  expect(view.status).toBe("fallback");
  expect(view.group.children.length).toBeGreaterThan(0);
});
it("shows driver and passenger controls without interpreting crew names as markup", () => {
  const s = setup();
  s.players.a.name = "<img>";
  board(s);
  board(s, "b");
  expect(roverDashboard(s, "a")).toContain("Space");
  expect(roverDashboard(s, "a")).toContain("&lt;img&gt;");
  expect(roverDashboard(s, "b")).toContain("PASSENGER");
});
