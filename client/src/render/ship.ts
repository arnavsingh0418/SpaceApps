import * as THREE from "three";

/** First-person return ship: corridor in front, cockpit toward -Z. */

const BACK = 10.4;
const DOOR = -15.2;
const NOSE = -27.6;
const HALF = 2.2;
const HEIGHT = 3.22;
const BODY = 0.32;

export type ShipInterior = {
  root: THREE.Group;
  displays: THREE.MeshStandardMaterial[];
  earth: THREE.Object3D;
  /** True when a standing player at eye height cannot occupy this floor spot. */
  occupied: (x: number, z: number) => boolean;
  spawn: THREE.Vector3;
};

export function createReturnShip(): ShipInterior {
  const root = new THREE.Group();
  root.name = "Return ship";
  const blocks: Aabb[] = [];
  const displays: THREE.MeshStandardMaterial[] = [];

  const wall = lambert(0xd4d4ce);
  const wallTrim = lambert(0xc2c2bb);
  const floorMat = lambert(0x8a8a84);
  const runnerMat = lambert(0x6a6a66);
  const ceilingMat = lambert(0xe6e6e0);
  const rust = standard(0x8a3d22, { roughness: 0.58, metalness: 0.28 });
  const rustDark = standard(0x5c2a16, { roughness: 0.5, metalness: 0.34 });
  const red = standard(0xd30c0c, { roughness: 0.42, metalness: 0.08 });
  const black = lambert(0x161616);
  const consoleMat = lambert(0x2c2e32);
  const consoleTop = lambert(0x3a3d42);
  const paper = lambert(0xf3e6c2);
  const shelfMat = lambert(0xb08960);
  const glow = standard(0x37f26a, { emissive: 0x37f26a, emissiveIntensity: 0.9, roughness: 0.4 });
  displays.push(glow);

  const span = BACK - NOSE;
  box(root, HALF * 2 + 0.8, 0.16, span, floorMat, 0, -0.08, (BACK + NOSE) / 2);
  box(root, 1.7, 0.02, span - 0.4, runnerMat, 0, 0.012, (BACK + NOSE) / 2);

  // Corridor shell. The nose end stays open into the cockpit.
  box(root, 0.18, HEIGHT, BACK - DOOR, wall, -HALF, HEIGHT / 2, (BACK + DOOR) / 2);
  box(root, 0.18, HEIGHT, BACK - DOOR, wall, HALF, HEIGHT / 2, (BACK + DOOR) / 2);
  box(root, HALF * 2 + 0.2, HEIGHT, 0.18, wall, 0, HEIGHT / 2, BACK);
  box(root, HALF * 2, 0.14, BACK - DOOR, ceilingMat, 0, HEIGHT, (BACK + DOOR) / 2);
  box(root, 0.12, 0.14, BACK - DOOR, wallTrim, -HALF + 0.12, 0.07, (BACK + DOOR) / 2);
  box(root, 0.12, 0.14, BACK - DOOR, wallTrim, HALF - 0.12, 0.07, (BACK + DOOR) / 2);

  addCeilingLights(root, BACK - 1.2, DOOR + 0.6);
  addLeftServices(root, {
    rust,
    rustDark,
    red,
    black,
    glow,
    shelfMat,
    consoleMat,
    blocks,
    displays,
  });
  addRightRail(root, rust, rustDark, blocks);
  addDoorway(root, wall, black);
  const earth = addCockpit(root, {
    wall,
    ceilingMat,
    black,
    red,
    consoleMat,
    consoleTop,
    paper,
    blocks,
    displays,
  });

  root.add(new THREE.HemisphereLight(0xfffdf8, 0xb9b9b2, 2.35));
  const fill = new THREE.DirectionalLight(0xfff8ee, 1.15);
  fill.position.set(-2, 8, 4);
  root.add(fill);

  return {
    root,
    displays,
    earth,
    spawn: new THREE.Vector3(0.08, 1.62, 8.25),
    occupied(x, z) {
      if (!walkable(x, z)) return true;
      return blocks.some((b) => circleHits(x, z, b));
    },
  };
}

function walkable(x: number, z: number) {
  const hall = Math.abs(x) <= 1.62 && z <= 9.7 && z >= DOOR + 0.15;
  const pit = Math.abs(x) <= 2.05 && z < DOOR + 0.15 && z >= -25.7;
  return hall || pit;
}

function addCeilingLights(parent: THREE.Object3D, fromZ: number, toZ: number) {
  const fixture = standard(0xf7f7f2, { emissive: 0xfffaf2, emissiveIntensity: 1.35, roughness: 1 });
  const housing = lambert(0xcfcfc8);
  const length = fromZ - toZ;
  const segments = 4;
  const gap = 0.22;
  const seg = (length - gap * (segments - 1)) / segments;
  for (let i = 0; i < segments; i++) {
    const z = fromZ - seg / 2 - i * (seg + gap);
    box(parent, 1.15, 0.06, seg, housing, 0, HEIGHT - 0.05, z);
    box(parent, 0.92, 0.04, seg - 0.12, fixture, 0, HEIGHT - 0.09, z);
    const lamp = new THREE.PointLight(0xfff6e8, 11, 11, 2);
    lamp.position.set(0, HEIGHT - 0.35, z);
    parent.add(lamp);
  }
}

function addLeftServices(
  parent: THREE.Object3D,
  mats: {
    rust: THREE.Material;
    rustDark: THREE.Material;
    red: THREE.Material;
    black: THREE.Material;
    glow: THREE.Material;
    shelfMat: THREE.Material;
    consoleMat: THREE.Material;
    blocks: Aabb[];
    displays: THREE.MeshStandardMaterial[];
  },
) {
  const xWall = -HALF + 0.12;
  // Overhead black run, then a drop toward the pump, matching the corridor photo.
  cylinder(parent, 0.055, 12.5, mats.black, xWall - 0.02, 2.72, 2.2, "z");
  cylinder(parent, 0.05, 1.15, mats.black, xWall - 0.02, 2.15, 6.55, "y");
  cylinder(parent, 0.05, 0.7, mats.black, xWall + 0.28, 2.72, 8.3, "x");

  // Rusty manifold cropped by the left edge of the opening view.
  cylinder(parent, 0.065, 2.15, mats.rust, -1.58, 1.15, 6.95, "y");
  cylinder(parent, 0.065, 2.15, mats.rustDark, -1.58, 1.15, 6.4, "y");
  cylinder(parent, 0.055, 0.62, mats.rust, -1.58, 2.05, 6.67, "z");
  cylinder(parent, 0.055, 0.62, mats.rust, -1.58, 0.32, 6.67, "z");
  cylinder(parent, 0.05, 0.48, mats.rustDark, -1.32, 1.35, 6.95, "x");

  addPump(parent, -0.98, 5.7, mats.red, mats.black, mats.blocks);
  addOxygenPanel(parent, xWall, 3.85, mats, mats.blocks);
  box(parent, 0.46, 0.06, 1.15, mats.shelfMat, -1.78, 1.48, 1.35);
  cylinder(parent, 0.025, 0.28, mats.black, -1.95, 1.34, 1.05, "y");
  cylinder(parent, 0.025, 0.28, mats.black, -1.95, 1.34, 1.65, "y");

  addTerminalBank(parent, xWall, -1.15, mats.consoleMat, mats.black, mats.displays, mats.blocks);
  addRack(parent, xWall, -5.6, mats.consoleMat, mats.glow, mats.blocks);
  addRack(parent, xWall, -8.7, mats.consoleMat, mats.glow, mats.blocks);
  addRack(parent, xWall, -11.6, mats.consoleMat, mats.glow, mats.blocks);
}

function addPump(
  parent: THREE.Object3D,
  x: number,
  z: number,
  red: THREE.Material,
  black: THREE.Material,
  blocks: Aabb[],
) {
  const pump = new THREE.Group();
  pump.position.set(x, 0, z);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.62, 16), red);
  body.position.y = 0.4;
  pump.add(body);
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.08, 16), red);
  foot.position.y = 0.04;
  pump.add(foot);
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.1, 12), black);
  collar.position.y = 0.74;
  pump.add(collar);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.42, 10), black);
  shaft.position.y = 0.98;
  pump.add(shaft);
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.42, 10), black);
  handle.position.y = 1.2;
  handle.rotation.z = Math.PI / 2;
  pump.add(handle);
  parent.add(pump);

  const hose = new THREE.Mesh(
    new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(x - 0.05, 0.12, z + 0.12),
        new THREE.Vector3(x - 0.35, 0.06, z + 0.45),
        new THREE.Vector3(-2.02, 0.18, z + 0.7),
      ]),
      10,
      0.03,
      6,
      false,
    ),
    black,
  );
  parent.add(hose);
  blocks.push({ minX: x - 0.28, maxX: x + 0.28, minZ: z - 0.28, maxZ: z + 0.28 });
}

function addOxygenPanel(
  parent: THREE.Object3D,
  xWall: number,
  z: number,
  mats: { black: THREE.Material; glow: THREE.Material; consoleMat: THREE.Material },
  blocks: Aabb[],
) {
  box(parent, 0.1, 0.42, 1.35, mats.consoleMat, xWall + 0.06, 1.32, z);
  box(
    parent,
    0.04,
    0.16,
    0.92,
    new THREE.MeshBasicMaterial({ color: 0x3ee86a }),
    xWall + 0.12,
    1.28,
    z - 0.05,
  );
  const plate = screen(
    parent,
    0.34,
    0.2,
    readoutTexture("27.2"),
    xWall + 0.13,
    1.62,
    z + 0.15,
    Math.PI / 2,
  );
  plate.material = new THREE.MeshBasicMaterial({ map: (plate.material as THREE.MeshBasicMaterial).map });
  const tag = screen(parent, 0.22, 0.12, labelTexture("O2"), xWall + 0.13, 1.18, z + 0.48, Math.PI / 2);
  tag.material = new THREE.MeshBasicMaterial({ map: (tag.material as THREE.MeshBasicMaterial).map });
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), standard(0xff2a2a, { emissive: 0xff2a2a, emissiveIntensity: 0.8 }));
  lamp.position.set(xWall + 0.12, 1.48, z + 0.52);
  parent.add(lamp);
  blocks.push({ minX: xWall, maxX: xWall + 0.2, minZ: z - 0.7, maxZ: z + 0.7 });
}

function addTerminalBank(
  parent: THREE.Object3D,
  xWall: number,
  z: number,
  consoleMat: THREE.Material,
  black: THREE.Material,
  displays: THREE.MeshStandardMaterial[],
  blocks: Aabb[],
) {
  box(parent, 0.48, 1.05, 1.7, consoleMat, xWall + 0.28, 0.62, z);
  box(parent, 0.52, 0.08, 1.8, lambert(0x4a4d52), xWall + 0.32, 1.16, z);
  const lines = ["CABIN  OK", "O2    27.2", "PRESS 14.7", "ETA   04:12"];
  for (const side of [-0.42, 0.42]) {
    const face = screen(
      parent,
      0.62,
      0.42,
      terminalTexture(lines),
      xWall + 0.56,
      1.48,
      z + side,
      Math.PI / 2,
    );
    const bezel = lambert(0x101114);
    box(parent, 0.04, 0.5, 0.7, bezel, xWall + 0.52, 1.48, z + side);
    face.position.x = xWall + 0.56;
    const glowMat = standard(0x14301c, { emissive: 0x39ff6a, emissiveIntensity: 0.55 });
    displays.push(glowMat);
    box(parent, 0.02, 0.5, 0.7, glowMat, xWall + 0.5, 1.48, z + side);
  }
  box(parent, 0.08, 0.08, 0.7, black, xWall + 0.2, 0.2, z);
  blocks.push({ minX: xWall, maxX: xWall + 0.62, minZ: z - 0.95, maxZ: z + 0.95 });
}

function addRack(
  parent: THREE.Object3D,
  xWall: number,
  z: number,
  consoleMat: THREE.Material,
  glow: THREE.Material,
  blocks: Aabb[],
) {
  box(parent, 0.42, 1.85, 0.78, consoleMat, xWall + 0.24, 0.95, z);
  for (let i = 0; i < 5; i++) {
    box(parent, 0.03, 0.06, 0.58, i % 2 ? glow : lambert(0x101114), xWall + 0.46, 0.4 + i * 0.28, z);
  }
  blocks.push({ minX: xWall, maxX: xWall + 0.5, minZ: z - 0.42, maxZ: z + 0.42 });
}

function addRightRail(
  parent: THREE.Object3D,
  rust: THREE.Material,
  rustDark: THREE.Material,
  blocks: Aabb[],
) {
  cylinder(parent, 0.075, BACK - DOOR - 0.4, rust, 1.78, 1.38, (BACK + DOOR) / 2 - 0.2, "z");
  for (let z = 8.2; z > DOOR + 1; z -= 3.1) {
    cylinder(parent, 0.04, 0.42, rustDark, 1.98, 1.38, z, "x");
    box(parent, 0.08, 0.16, 0.1, rustDark, 2.05, 1.38, z);
  }
  blocks.push({ minX: 1.62, maxX: 2.15, minZ: DOOR, maxZ: BACK - 0.4 });
}

function addDoorway(parent: THREE.Object3D, wall: THREE.Material, black: THREE.Material) {
  box(parent, 4.6, 0.42, 0.22, wall, 0, HEIGHT - 0.18, DOOR);
  box(parent, 0.28, 2.55, 0.22, wall, -1.85, 1.28, DOOR);
  box(parent, 0.28, 2.55, 0.22, wall, 1.85, 1.28, DOOR);
  box(parent, 3.4, 0.08, 0.24, black, 0, 2.5, DOOR);
  // Yellow-black caution step where the corridor meets the flight deck.
  for (let i = 0; i < 8; i++) {
    box(parent, 0.38, 0.012, 0.28, i % 2 ? lambert(0xe2b133) : black, -1.45 + i * 0.4, 0.02, DOOR - 0.28);
  }
}

function addCockpit(
  parent: THREE.Object3D,
  mats: {
    wall: THREE.Material;
    ceilingMat: THREE.Material;
    black: THREE.Material;
    red: THREE.Material;
    consoleMat: THREE.Material;
    consoleTop: THREE.Material;
    paper: THREE.Material;
    blocks: Aabb[];
    displays: THREE.MeshStandardMaterial[];
  },
) {
  const mid = (DOOR + NOSE) / 2;
  const depth = DOOR - NOSE;
  box(parent, 0.16, HEIGHT, depth, mats.wall, -2.55, HEIGHT / 2, mid);
  box(parent, 0.16, HEIGHT, depth, mats.wall, 2.55, HEIGHT / 2, mid);
  box(parent, 5.3, 0.16, depth, mats.ceilingMat, 0, HEIGHT, mid);

  addWindowWall(parent, mats.wall, mats.black);
  addVisors(parent, mats.black, mats.wall);
  addConsole(parent, mats);
  addNoteLocker(parent, mats);
  addSeat(parent, mats.red, mats.black, mats.blocks);

  const lamp = new THREE.PointLight(0xfff4e5, 9, 12, 2);
  lamp.position.set(0, 2.7, -21.5);
  parent.add(lamp);

  return addEarth(parent);
}

function addWindowWall(parent: THREE.Object3D, wall: THREE.Material, black: THREE.Material) {
  const z = NOSE + 0.2;
  box(parent, 5.2, 0.7, 0.16, wall, 0, 0.35, z);
  box(parent, 5.2, 0.55, 0.16, wall, 0, 2.95, z);
  box(parent, 1.15, 2.2, 0.16, wall, -2.0, 1.6, z);
  box(parent, 1.15, 2.2, 0.16, wall, 2.0, 1.6, z);
  box(parent, 2.7, 0.08, 0.18, black, 0, 2.55, z - 0.02);
  const glass = new THREE.Mesh(
    new THREE.PlaneGeometry(2.55, 1.45),
    new THREE.MeshBasicMaterial({
      color: 0xc5e4ff,
      transparent: true,
      opacity: 0.08,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  glass.position.set(0, 1.72, z - 0.02);
  parent.add(glass);
}

function addVisors(parent: THREE.Object3D, black: THREE.Material, wall: THREE.Material) {
  for (const side of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const band = box(
        parent,
        0.85,
        0.055,
        0.16,
        i % 2 === 0 ? black : wall,
        side * 1.62,
        2.82,
        -23.15 - i * 0.34,
      );
      band.rotation.z = side * -0.42;
    }
  }
}

function addConsole(
  parent: THREE.Object3D,
  mats: {
    consoleMat: THREE.Material;
    consoleTop: THREE.Material;
    black: THREE.Material;
    blocks: Aabb[];
    displays: THREE.MeshStandardMaterial[];
  },
) {
  const z = -23.15;
  box(parent, 1.7, 1.05, 0.72, mats.consoleMat, 0.05, 0.52, z);
  box(parent, 1.82, 0.08, 0.84, mats.consoleTop, 0.05, 1.06, z);
  // Tan instrument cheek from the cockpit reference.
  box(parent, 0.34, 0.55, 0.06, lambert(0xc47a3a), -0.62, 0.7, z + 0.38);

  const screens: Array<[number, number, number, string[]]> = [
    [-0.48, 1.32, 0.46, ["ALT  412", "VEL  7.6"]],
    [0.08, 1.38, 0.62, ["EARTH", "HOLD", "PITCH -2"]],
    [0.58, 1.3, 0.4, ["GEAR", "DOWN"]],
  ];
  for (const [x, y, w, lines] of screens) {
    box(parent, w + 0.06, w * 0.62, 0.05, mats.black, x, y, z + 0.4);
    screen(parent, w, w * 0.52, terminalTexture(lines), x, y, z + 0.44, 0);
    const glowMat = standard(0x102416, { emissive: 0x39ff6a, emissiveIntensity: 0.45 });
    mats.displays.push(glowMat);
    box(parent, w, w * 0.52, 0.02, glowMat, x, y, z + 0.4);
  }

  const redBtn = standard(0xe10600, { emissive: 0x6a0000, emissiveIntensity: 0.4 });
  const greenBtn = standard(0x18b84a, { emissive: 0x0c5a22, emissiveIntensity: 0.45 });
  for (const [x, mat] of [
    [-0.28, redBtn],
    [-0.08, greenBtn],
    [0.12, mats.black],
    [0.32, greenBtn],
  ] as const) {
    const button = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.04, 10), mat);
    button.position.set(x, 1.12, z + 0.28);
    parent.add(button);
  }

  // Overhead pair, tilted toward the pilot.
  const mount = box(parent, 1.15, 0.06, 0.08, mats.black, 0.1, 2.48, -22.7);
  mount.rotation.x = 0.2;
  for (const x of [-0.32, 0.36]) {
    const panel = screen(
      parent,
      0.48,
      0.28,
      terminalTexture(x < 0 ? ["NAV", "LOCK"] : ["O2 27.2", "CAB OK"]),
      x,
      2.28,
      -22.55,
      0,
    );
    panel.rotation.x = -0.45;
    box(parent, 0.54, 0.34, 0.04, mats.black, x, 2.28, -22.62).rotation.x = -0.45;
  }

  mats.blocks.push({ minX: -0.9, maxX: 1.0, minZ: z - 0.45, maxZ: z + 0.5 });
}

function addNoteLocker(
  parent: THREE.Object3D,
  mats: { consoleMat: THREE.Material; paper: THREE.Material; blocks: Aabb[] },
) {
  box(parent, 0.55, 1.7, 0.7, mats.consoleMat, -1.85, 0.9, -21.6);
  const note = screen(
    parent,
    0.52,
    0.78,
    noteTexture(),
    -1.54,
    1.15,
    -21.55,
    Math.PI / 2,
  );
  note.rotation.z = -0.05;
  note.rotation.y = Math.PI / 2 + 0.06;
  const tape = lambert(0xd9d4c8);
  box(parent, 0.02, 0.05, 0.16, tape, -1.52, 1.4, -21.62);
  mats.blocks.push({ minX: -2.2, maxX: -1.5, minZ: -22.05, maxZ: -21.15 });
}

function addSeat(
  parent: THREE.Object3D,
  red: THREE.Material,
  black: THREE.Material,
  blocks: Aabb[],
) {
  const seat = new THREE.Group();
  seat.position.set(0.72, 0, -20.7);
  box(seat, 0.48, 0.1, 0.48, red, 0, 0.48, 0);
  box(seat, 0.48, 0.55, 0.1, red, 0, 0.78, 0.2);
  box(seat, 0.1, 0.48, 0.1, black, -0.18, 0.24, 0);
  box(seat, 0.1, 0.48, 0.1, black, 0.18, 0.24, 0);
  parent.add(seat);
  blocks.push({ minX: 0.42, maxX: 1.05, minZ: -21.05, maxZ: -20.35 });
}

function addEarth(parent: THREE.Object3D) {
  const sky = new THREE.Group();
  const backdrop = new THREE.Mesh(
    new THREE.PlaneGeometry(36, 22),
    new THREE.MeshBasicMaterial({ color: 0x070910 }),
  );
  backdrop.position.set(0, 2.4, -52);
  sky.add(backdrop);

  const stars = new Float32Array(180 * 3);
  for (let i = 0; i < 180; i++) {
    stars[i * 3] = (Math.random() - 0.5) * 22;
    stars[i * 3 + 1] = Math.random() * 12;
    stars[i * 3 + 2] = -49 - Math.random() * 2;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute("position", new THREE.BufferAttribute(stars, 3));
  sky.add(
    new THREE.Points(
      starGeo,
      new THREE.PointsMaterial({ color: 0xffffff, size: 0.07, sizeAttenuation: true }),
    ),
  );

  const earth = new THREE.Mesh(
    new THREE.SphereGeometry(2.15, 48, 32),
    new THREE.MeshBasicMaterial({ map: earthTexture() }),
  );
  earth.position.set(0, 1.7, -41);
  sky.add(earth);
  const air = new THREE.Mesh(
    new THREE.SphereGeometry(2.35, 32, 24),
    new THREE.MeshBasicMaterial({
      color: 0x9fd4ff,
      transparent: true,
      opacity: 0.2,
      side: THREE.BackSide,
      depthWrite: false,
    }),
  );
  air.position.copy(earth.position);
  sky.add(air);
  parent.add(sky);
  return earth;
}

type Aabb = { minX: number; maxX: number; minZ: number; maxZ: number };

function circleHits(x: number, z: number, box: Aabb) {
  const cx = Math.max(box.minX, Math.min(x, box.maxX));
  const cz = Math.max(box.minZ, Math.min(z, box.maxZ));
  const dx = x - cx;
  const dz = z - cz;
  return dx * dx + dz * dz < BODY * BODY;
}

function lambert(color: number) {
  return new THREE.MeshLambertMaterial({ color });
}

function standard(
  color: number,
  extra: { roughness?: number; metalness?: number; emissive?: number; emissiveIntensity?: number } = {},
) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: extra.roughness ?? 0.82,
    metalness: extra.metalness ?? 0.04,
    emissive: extra.emissive ?? 0x000000,
    emissiveIntensity: extra.emissiveIntensity ?? 1,
  });
}

function box(
  parent: THREE.Object3D,
  w: number,
  h: number,
  d: number,
  material: THREE.Material,
  x: number,
  y: number,
  z: number,
) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

function cylinder(
  parent: THREE.Object3D,
  radius: number,
  length: number,
  material: THREE.Material,
  x: number,
  y: number,
  z: number,
  axis: "x" | "y" | "z",
) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 8), material);
  mesh.position.set(x, y, z);
  if (axis === "x") mesh.rotation.z = Math.PI / 2;
  if (axis === "z") mesh.rotation.x = Math.PI / 2;
  parent.add(mesh);
  return mesh;
}

function screen(
  parent: THREE.Object3D,
  w: number,
  h: number,
  map: THREE.Texture,
  x: number,
  y: number,
  z: number,
  rotY: number,
) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map }));
  mesh.position.set(x, y, z);
  mesh.rotation.y = rotY;
  parent.add(mesh);
  return mesh;
}

function makeTexture(width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not draw a ship display");
  draw(ctx);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function terminalTexture(lines: string[]) {
  return makeTexture(512, 256, (ctx) => {
    ctx.fillStyle = "#031407";
    ctx.fillRect(0, 0, 512, 256);
    ctx.fillStyle = "#6dff7a";
    ctx.font = "600 42px ui-monospace, monospace";
    lines.forEach((line, index) => ctx.fillText(line, 28, 64 + index * 52));
    ctx.fillStyle = "rgba(0, 0, 0, 0.18)";
    for (let y = 0; y < 256; y += 4) ctx.fillRect(0, y, 512, 1);
  });
}

function readoutTexture(text: string) {
  return makeTexture(256, 128, (ctx) => {
    ctx.fillStyle = "#04180a";
    ctx.fillRect(0, 0, 256, 128);
    ctx.fillStyle = "#8dff78";
    ctx.font = "700 78px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 128, 68);
  });
}

function labelTexture(text: string) {
  return makeTexture(256, 128, (ctx) => {
    ctx.fillStyle = "#1a1c1a";
    ctx.fillRect(0, 0, 256, 128);
    ctx.fillStyle = "#d7d7d0";
    ctx.font = "700 72px ui-sans-serif, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 128, 68);
  });
}

function noteTexture() {
  return makeTexture(512, 680, (ctx) => {
    ctx.fillStyle = "#f4e6c4";
    ctx.fillRect(0, 0, 512, 680);
    ctx.strokeStyle = "#e2d0a4";
    ctx.lineWidth = 8;
    ctx.strokeRect(16, 16, 480, 648);
    ctx.fillStyle = "#243044";
    ctx.font = "italic 42px 'Segoe Script', 'Comic Sans MS', cursive";
    const lines = [
      "Before the burn",
      "Prime the cabin pump",
      "Read the wall O2",
      "Leave the abort",
      "cover alone",
      "",
      "Earth is the",
      "blue one.",
    ];
    lines.forEach((line, index) => ctx.fillText(line, 40, 90 + index * 68));
  });
}

function earthTexture() {
  return makeTexture(512, 256, (ctx) => {
    ctx.fillStyle = "#1c6eae";
    ctx.fillRect(0, 0, 512, 256);
    ctx.fillStyle = "#2f8a45";
    for (const [x, y, rx, ry] of [
      [90, 120, 70, 48],
      [200, 90, 54, 36],
      [280, 150, 80, 34],
      [390, 100, 46, 58],
      [150, 190, 40, 22],
      [430, 180, 36, 24],
    ]) {
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    for (const [x, y, rx, ry] of [
      [60, 70, 50, 16],
      [240, 50, 70, 14],
      [360, 140, 60, 16],
      [140, 150, 40, 12],
    ]) {
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, -0.3, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}
