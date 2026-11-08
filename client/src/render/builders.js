import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
let S;
let seed = 7;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const mat = (c, o = {}) =>
  new THREE.MeshStandardMaterial({
    color: c,
    flatShading: true,
    roughness: 0.9,
    ...o,
  });
const add = (m, x = 0, y = 0, z = 0) => {
  m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = true;
  S.add(m);
  return m;
};
export function initBuilders(scene) {
  S = scene;
}
// ---------------------------------------------------------------------------
// Astronaut: cartoon cel-shaded suit with outlines (reference: chunky orange suit,
// round helmet with a glossy visor, big grey life-support pack, grey gloves/boots).
// Rig: rig > hips > { legL/legR (hip) > kneeL/kneeR, upper > armL/armR (shoulder) >
// elbowL/elbowR }. Names armL/armR/legL/legR stay the shoulder/hip pivots so older
// animation code (arrival cinematic, carry pose) keeps working.
// ---------------------------------------------------------------------------
let toonRamp;
function toon(color, o = {}) {
  if (!toonRamp) {
    toonRamp = new THREE.DataTexture(new Uint8Array([90, 170, 255]), 3, 1, THREE.RedFormat);
    toonRamp.minFilter = toonRamp.magFilter = THREE.NearestFilter;
    toonRamp.needsUpdate = true;
  }
  return new THREE.MeshToonMaterial({ color, gradientMap: toonRamp, ...o });
}
const INK = new THREE.MeshBasicMaterial({ color: 0x2a1812, side: THREE.BackSide });
/** Inverted-hull outline: same shape pushed out along its normals, drawn back-faces only. */
function outline(mesh, t = 0.032) {
  const g = mesh.geometry.clone();
  const p = g.attributes.position,
    n = g.attributes.normal;
  for (let i = 0; i < p.count; i++)
    p.setXYZ(i, p.getX(i) + n.getX(i) * t, p.getY(i) + n.getY(i) * t, p.getZ(i) + n.getZ(i) * t);
  const o = new THREE.Mesh(g, INK);
  o.name = mesh.name ? mesh.name + "-ink" : "ink";
  o.userData.ink = true;
  mesh.add(o);
  return mesh;
}
function part(geo, material, name, x = 0, y = 0, z = 0, ink = 0.032) {
  const m = new THREE.Mesh(geo, material);
  if (name) m.name = name;
  m.position.set(x, y, z);
  m.castShadow = true;
  if (ink) outline(m, ink);
  return m;
}
const rbox = (w, h, d, r = 0.06) => new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2, h / 2, d / 2));
const pivot = (name, x = 0, y = 0, z = 0) => {
  const g = new THREE.Group();
  g.name = name;
  g.position.set(x, y, z);
  return g;
};

export function astronaut(color) {
  const g = new THREE.Group();
  const suit = toon(color),
    suitDark = toon(new THREE.Color(color).multiplyScalar(0.78)),
    grey = toon(0x6f7480),
    greyDark = toon(0x4a4e57),
    pack = toon(0xcfd0d2),
    packDark = toon(0x8a8d94),
    strap = toon(0x34363c),
    patch = toon(0xa874c8),
    sticker = toon(0xf08a3c),
    light = new THREE.MeshBasicMaterial({ color: 0x7ee05a }),
    visorMat = new THREE.MeshStandardMaterial({
      color: 0x16323a,
      emissive: 0x1aa3c4,
      emissiveIntensity: 0.6,
      roughness: 0.12,
      metalness: 0.3,
    });

  const rig = pivot("rig");
  g.add(rig);
  const hips = pivot("hips", 0, 0.8, 0);
  rig.add(hips);

  // Legs: thigh (hip pivot) + shin (knee pivot) + chunky boot.
  for (const s of [-1, 1]) {
    const side = s < 0 ? "L" : "R";
    const hip = pivot("leg" + side, s * 0.17, 0, 0);
    hips.add(hip);
    hip.add(part(new THREE.CapsuleGeometry(0.15, 0.2, 4, 10).translate(0, -0.17, 0), suit, "thigh" + side));
    const knee = pivot("knee" + side, 0, -0.38, 0);
    hip.add(knee);
    knee.add(part(new THREE.CapsuleGeometry(0.14, 0.16, 4, 10).translate(0, -0.15, 0), suit, "shin" + side));
    knee.add(part(new THREE.CylinderGeometry(0.165, 0.165, 0.09, 14), grey, "cuff" + side, 0, -0.26, 0));
    knee.add(part(rbox(0.27, 0.17, 0.38, 0.07), greyDark, "boot" + side, 0, -0.36, 0.04));
  }

  // Upper body: torso, belt, helmet, pack, arms. Pivots at the hips so it can lean.
  const upper = pivot("upper");
  hips.add(upper);
  upper.add(part(rbox(0.74, 0.66, 0.5, 0.2), suit, "body", 0, 0.33, 0));
  upper.add(part(rbox(0.78, 0.1, 0.54, 0.05), grey, "belt", 0, 0.04, 0));
  upper.add(part(new THREE.TorusGeometry(0.27, 0.06, 8, 20).rotateX(Math.PI / 2), grey, "collar", 0, 0.68, 0));
  const head = pivot("head", 0, 0.96, 0);
  upper.add(head);
  head.add(part(new THREE.SphereGeometry(0.43, 22, 16), suit, "helmet", 0, 0, 0, 0.036));
  const visor = new THREE.Mesh(
    new THREE.SphereGeometry(0.445, 24, 16, Math.PI / 2 - 1.05, 2.1, 0.78, 1.2),
    visorMat,
  );
  visor.name = "visor";
  head.add(visor);
  // side comm ports: grey rings with a cyan lamp (the detail on the reference helmet)
  for (const s of [-1, 1]) {
    const port = part(new THREE.CylinderGeometry(0.1, 0.1, 0.06, 16).rotateZ(Math.PI / 2), grey, "port", s * 0.42, 0.02, 0.05, 0.015);
    port.add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.07, 12).rotateZ(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x9be7ff })));
    head.add(port);
  }
  // Life-support pack: light shell, darker vent panel, strap band, sticker and a status light.
  const pk = pivot("pack", 0, 0.38, -0.42);
  upper.add(pk);
  pk.add(part(rbox(0.68, 0.66, 0.34, 0.07), pack, "packShell"));
  pk.add(part(rbox(0.52, 0.22, 0.06, 0.03), packDark, "vent", 0, -0.17, -0.16, 0.012));
  pk.add(part(rbox(0.74, 0.08, 0.4, 0.03), strap, "strap", 0, 0.02, 0, 0.012));
  pk.add(part(rbox(0.12, 0.09, 0.02, 0.01), sticker, "sticker", -0.18, 0.18, -0.175, 0));
  const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.02), light);
  lamp.name = "packLight";
  lamp.position.set(0.18, 0.18, -0.175);
  pk.add(lamp);
  // Arms: upper arm (shoulder pivot) + forearm (elbow pivot) + glove; patch on the shoulder.
  for (const s of [-1, 1]) {
    const side = s < 0 ? "L" : "R";
    const shoulder = pivot("arm" + side, s * 0.47, 0.56, 0);
    shoulder.rotation.z = s * 0.12;
    upper.add(shoulder);
    shoulder.add(part(new THREE.SphereGeometry(0.17, 14, 10), suit, "shoulderPad" + side));
    shoulder.add(part(new THREE.CapsuleGeometry(0.12, 0.16, 4, 10).translate(0, -0.15, 0), suit, "upperArm" + side));
    if (s > 0) shoulder.add(part(rbox(0.04, 0.13, 0.13, 0.02), patch, "patch", 0.15, -0.06, 0, 0.01));
    const elbow = pivot("elbow" + side, 0, -0.32, 0);
    shoulder.add(elbow);
    elbow.add(part(new THREE.CapsuleGeometry(0.115, 0.12, 4, 10).translate(0, -0.12, 0), suitDark, "forearm" + side));
    elbow.add(part(new THREE.CylinderGeometry(0.135, 0.135, 0.07, 14), grey, "wristCuff" + side, 0, -0.23, 0, 0.012));
    elbow.add(part(new THREE.SphereGeometry(0.13, 14, 10).scale(1, 1.1, 1), grey, "glove" + side, 0, -0.32, 0.01));
  }

  const carried = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.5, 0.5), mat(0x9ca3af));
  carried.name = "carried";
  carried.position.set(0, 0.35, 0.62);
  carried.visible = false;
  upper.add(carried);
  const wrench = new THREE.Group();
  wrench.name = "wrench";
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.4, 0.07), mat(0x9ca3af));
  const jaw = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.035, 4, 8, Math.PI * 1.5), mat(0x9ca3af));
  jaw.position.y = 0.24;
  wrench.add(handle, jaw);
  wrench.position.set(0, -0.42, 0.12);
  wrench.visible = false;
  g.getObjectByName("elbowR").add(wrench);
  g.traverse((o) => {
    if (o.isMesh && !o.userData.ink) o.castShadow = true;
  });
  g.scale.setScalar(1.35);
  S.add(g);
  return g;
}
// ---------------------------------------------------------------------------
// Base structures. Life-sized next to the ~3 m astronaut, cel-shaded with outlines
// to match the characters. Units are metres.
// ---------------------------------------------------------------------------
const shade = (o) => {
  o.traverse((m) => {
    if (m.isMesh && !m.userData.ink) m.castShadow = m.receiveShadow = true;
  });
  return o;
};
const lathe = (pts, seg = 48) =>
  new THREE.LatheGeometry(
    pts.map(([x, y]) => new THREE.Vector2(x, y)),
    seg,
  );
function canvasTex(w, h, draw) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
let cellTex, hazardTex;
const solarCells = () =>
  (cellTex ||= canvasTex(256, 128, (g, w, h) => {
    g.fillStyle = "#1c3f8f";
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 8; i++)
      for (let j = 0; j < 4; j++) {
        const grd = g.createLinearGradient(0, j * 32, 0, j * 32 + 30);
        grd.addColorStop(0, "#4a80e8");
        grd.addColorStop(1, "#1a3b8a");
        g.fillStyle = grd;
        g.fillRect(i * 32 + 2, j * 32 + 2, 28, 28);
      }
  }));
const hazard = () =>
  (hazardTex ||= canvasTex(128, 32, (g, w, h) => {
    g.fillStyle = "#f2c230";
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#24201c";
    for (let x = -h; x < w; x += 24) {
      g.beginPath();
      g.moveTo(x, h);
      g.lineTo(x + 12, h);
      g.lineTo(x + 12 + h, 0);
      g.lineTo(x + h, 0);
      g.fill();
    }
  }));
const C = {
  hull: 0xeeeae2,
  hullShade: 0xc9c4ba,
  orange: 0xee7a2c,
  metal: 0x8d939c,
  dark: 0x3a3d44,
  glass: 0x1c3440,
  scorch: 0x3b2c25,
};

/** Crashed lander, ~24 m long, half-buried and scorched. */
export function wreck(x, z) {
  const g = new THREE.Group();
  const hull = toon(C.hull),
    orange = toon(C.orange),
    metal = toon(C.metal),
    dark = toon(C.dark),
    scorch = toon(C.scorch),
    glass = new THREE.MeshStandardMaterial({
      color: C.glass,
      roughness: 0.15,
      metalness: 0.4,
      emissive: 0x0b2a35,
      emissiveIntensity: 0.4,
    });
  const body = new THREE.Group();
  g.add(body);
  // fuselage along +x, nose at +x, engines at -x
  body.add(part(new THREE.CylinderGeometry(3.1, 3.3, 15, 40, 1).rotateZ(Math.PI / 2), hull, "fuselage", 0, 0, 0, 0.06));
  body.add(
    part(
      // profile from the tip (y = 0) to the base (y = 6.2); rotated so the tip points +x
      lathe([[0, 0], [1.2, 0.4], [2.2, 1.6], [2.9, 3.6], [3.1, 6], [3.1, 6.2], [0, 6.2]]).rotateZ(Math.PI / 2),
      hull,
      "nose",
      13.7,
      0,
      0,
      0.06,
    ),
  );
  for (const bx of [-4.2, 4.6])
    body.add(part(new THREE.CylinderGeometry(3.36, 3.36, 1.1, 40).rotateZ(Math.PI / 2), orange, "band", bx, 0, 0, 0.04));
  for (let i = 0; i < 4; i++) {
    const w = new THREE.Mesh(rbox(0.9, 0.7, 0.3, 0.12), glass);
    w.position.set(-1.6 + i * 1.6, 1.2, 3.1);
    body.add(w);
  }
  body.add(part(new THREE.CylinderGeometry(3.3, 2.8, 2.4, 40).rotateZ(Math.PI / 2), metal, "engineBay", -8.6, 0, 0, 0.05));
  for (const [dy, dz] of [[0, 0], [1.3, 1.3], [1.3, -1.3], [-1.3, 1.3], [-1.3, -1.3]]) {
    // bell opens toward -x
    const bell = part(
      lathe([[0.45, 0], [0.55, 0.3], [0.8, 0.9], [1.15, 1.8], [1.2, 1.9]], 28).rotateZ(Math.PI / 2),
      scorch,
      "bell",
      -9.8,
      dy,
      dz,
      0.03,
    );
    bell.material = toon(C.scorch, { side: THREE.DoubleSide });
    body.add(bell);
  }
  for (const ang of [0.3, 2.4]) {
    const holder = new THREE.Group();
    holder.rotation.x = ang;
    const fin = part(rbox(3.4, 0.35, 2.6, 0.12), orange, "fin", -6.6, 0, 4.1, 0.04);
    fin.rotation.y = 0.15;
    holder.add(fin);
    body.add(holder);
  }
  for (const [px, py, pz, sx] of [[2, -1.4, 2.75, 3], [-5, 1.8, 2.5, 2.2], [7, 0.5, 2.95, 1.6]]) {
    const m = new THREE.Mesh(rbox(sx, 1.3, 0.25, 0.1), scorch);
    m.position.set(px, py, pz);
    body.add(m);
  }
  const hatch = new THREE.Mesh(rbox(1.5, 2.1, 0.3, 0.15), toon(0xffffff, { map: hazard() }));
  hatch.position.set(5.6, -0.4, 3.0);
  body.add(hatch);
  for (const [lx, lz, tilt] of [[3, 1, 0.55], [-3.5, -1, -1.1]]) {
    const leg = part(new THREE.CylinderGeometry(0.22, 0.22, 4.2, 10), metal, "leg", lx, -2.4, lz * 3.4, 0.03);
    leg.rotation.x = tilt;
    body.add(leg);
  }
  body.rotation.set(0.22, 0, -0.08);
  body.position.y = 1.9;
  const bits = [
    [rbox(2.6, 0.3, 1.8, 0.1), orange, 9, 0.3, 7, 0.7],
    [rbox(1.8, 0.25, 1.2, 0.08), hull, -2, 0.2, 8.5, 2.2],
    [new THREE.CylinderGeometry(0.25, 0.25, 3.2, 10).rotateZ(Math.PI / 2), metal, 4, 0.3, -7, 0.4],
    [rbox(1.2, 0.9, 1.0, 0.1), dark, -11, 0.45, 6, 1.1],
    [rbox(2.2, 0.3, 1.4, 0.08), scorch, 12, 0.2, -5.5, 2.6],
    [rbox(3.4, 0.35, 2.6, 0.12), orange, -13, 0.6, -6, 0.8],
  ];
  for (const [geo, m, bx, by, bz, ry] of bits) {
    const b = part(geo, m, "debris", bx, by, bz, 0.03);
    b.rotation.set(0.12, ry, 0.15);
    g.add(b);
  }
  g.position.set(x, 0, z);
  g.rotation.y = 0.5;
  S.add(shade(g));
  return g;
}
export function smoke(x, y, z) {
  for (let i = 0; i < 9; i++) {
    const p = add(
      new THREE.Mesh(
        new THREE.SphereGeometry(0.6 + i * 0.2, 12, 10),
        mat(0xb8aca4, { transparent: true, opacity: 0.4 - i * 0.035, depthWrite: false }),
      ),
      x + Math.sin(i) * 0.6 + i * 0.4,
      y + i * 1.1,
      z,
    );
    p.castShadow = false;
  }
}
/** Rounded supply crate with metal bands. s = edge length (m). */
export function crate(x, z, c = 0x8b6a45, s = 1.4) {
  const g = new THREE.Group();
  g.add(part(rbox(s, s, s, s * 0.08), toon(c), "crateBox", 0, s / 2, 0, 0.03));
  const band = toon(0x6b6f78);
  for (const by of [s * 0.18, s * 0.82])
    g.add(part(rbox(s * 1.03, s * 0.1, s * 1.03, s * 0.03), band, "crateBand", 0, by, 0, 0));
  g.position.set(x, 0, z);
  g.rotation.y = rnd() * Math.PI;
  S.add(shade(g));
  return g;
}
/** Solar array on a tilt mount. children[1] is the cell surface (tinted by dust in world.ts). */
export function panel(x, z, rot = 0, dusty = 0) {
  const g = new THREE.Group();
  const mount = new THREE.Group();
  const metal = toon(C.metal),
    dark = toon(C.dark);
  mount.add(part(new THREE.CylinderGeometry(0.75, 0.9, 0.35, 16), dark, "foot", 0, 0.17, 0, 0.03));
  mount.add(part(new THREE.CylinderGeometry(0.14, 0.14, 2.2, 10), metal, "post", 0, 1.25, 0, 0.03));
  const frame = part(rbox(5.3, 0.16, 3.1, 0.06), metal, "frame", 0, 2.4, 0, 0.03);
  frame.rotation.x = -0.5;
  mount.add(frame);
  g.add(mount);
  const surface = new THREE.Mesh(
    rbox(5.0, 0.12, 2.8, 0.04),
    new THREE.MeshToonMaterial({ color: dusty ? 0xb07a55 : 0xffffff, map: solarCells(), gradientMap: toonRamp }),
  );
  surface.position.set(0, 2.5, 0.05);
  surface.rotation.x = -0.5;
  surface.castShadow = true;
  g.add(surface);
  g.position.set(x, 0, z);
  g.rotation.y = rot;
  S.add(shade(g));
  return g;
}
/** Simple dome. */
export function dome(x, z, r, c = 0xe8e4dc) {
  const g = new THREE.Group();
  g.add(part(new THREE.SphereGeometry(r, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2), toon(c), "dome", 0, 0, 0, 0.05));
  g.position.set(x, 0, z);
  S.add(shade(g));
  return g;
}
/** Main habitat: ribbed dome on a base ring, portholes, airlock with hazard trim, antenna. */
export function hab(x, z, r = 6.2) {
  const g = new THREE.Group();
  const shell = toon(C.hull),
    rib = toon(C.hullShade),
    metal = toon(C.metal),
    dark = toon(C.dark),
    glow = new THREE.MeshStandardMaterial({ color: 0xffd08a, emissive: 0xffa646, emissiveIntensity: 0.9, roughness: 0.3 });
  const y0 = 0.9;
  g.add(part(new THREE.CylinderGeometry(r + 0.35, r + 0.6, 1.0, 56), metal, "habBase", 0, 0.5, 0, 0.05));
  g.add(part(new THREE.SphereGeometry(r, 56, 28, 0, Math.PI * 2, 0, Math.PI / 2), shell, "habShell", 0, y0, 0, 0.07));
  for (const lat of [0.42, 0.85, 1.22]) {
    const rr = r * Math.cos(lat) + 0.03;
    g.add(part(new THREE.TorusGeometry(rr, 0.07, 6, 64).rotateX(Math.PI / 2), rib, "seam", 0, y0 + r * Math.sin(lat), 0, 0));
  }
  // meridian ribs: quarter circles from the rim up to the top
  for (let i = 0; i < 10; i++) {
    const holder = new THREE.Group();
    holder.rotation.y = (i / 10) * Math.PI * 2;
    holder.position.y = y0;
    holder.add(part(new THREE.TorusGeometry(r + 0.03, 0.08, 6, 40, Math.PI / 2), rib, "rib", 0, 0, 0, 0));
    g.add(holder);
  }
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    const lat = 0.42;
    const ph = new THREE.Group();
    const px = Math.sin(a) * r * Math.cos(lat),
      pz = Math.cos(a) * r * Math.cos(lat),
      py = y0 + r * Math.sin(lat);
    ph.position.set(px, py, pz);
    ph.lookAt(px * 2, y0 + (py - y0) * 2, pz * 2);
    ph.add(part(new THREE.TorusGeometry(0.55, 0.12, 8, 24), metal, "porthole", 0, 0, 0, 0.02));
    const pane = new THREE.Mesh(new THREE.CircleGeometry(0.5, 24), glow);
    pane.position.z = 0.03;
    ph.add(pane);
    g.add(ph);
  }
  const porch = new THREE.Group();
  porch.position.set(0, 0, r - 0.4);
  porch.add(part(rbox(3.6, 3.8, 2.6, 0.3), shell, "airlock", 0, 1.9, 0.4, 0.05));
  const door = new THREE.Mesh(rbox(2.0, 2.9, 0.3, 0.12), toon(0x3a3532));
  door.position.set(0, 1.55, 1.72);
  porch.add(door);
  const trim = new THREE.Mesh(rbox(2.5, 0.28, 0.2, 0.05), toon(0xffffff, { map: hazard() }));
  trim.position.set(0, 3.2, 1.75);
  porch.add(trim);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), new THREE.MeshBasicMaterial({ color: 0x7ee05a }));
  lamp.name = "habLamp";
  lamp.position.set(1.45, 3.2, 1.8);
  porch.add(lamp);
  g.add(porch);
  g.add(part(new THREE.CylinderGeometry(0.08, 0.1, 3, 8), metal, "mast", 1.5, y0 + r + 0.9, -1, 0.02));
  const blink = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8), new THREE.MeshBasicMaterial({ color: 0xff4b3a }));
  blink.name = "habBlink";
  blink.position.set(1.5, y0 + r + 2.5, -1);
  g.add(blink);
  g.add(part(new THREE.CylinderGeometry(0.35, 0.35, 1.2, 16), dark, "vent", -2.5, y0 + r - 0.6, 1.5, 0.02));
  g.position.set(x, 0, z);
  S.add(shade(g));
  return g;
}
/** Outdoor workbench with a tool board and a glowing tablet. Returns { group, top }. */
export function workbench(x, z) {
  const g = new THREE.Group();
  const top = part(rbox(3.2, 0.3, 1.6, 0.08), toon(0xd8c7a8), "benchTop", 0, 1.4, 0, 0.03);
  g.add(top);
  const metal = toon(C.metal);
  for (const [lx, lz] of [[-1.4, -0.6], [1.4, -0.6], [-1.4, 0.6], [1.4, 0.6]])
    g.add(part(new THREE.CylinderGeometry(0.08, 0.08, 1.3, 8), metal, "benchLeg", lx, 0.65, lz, 0.02));
  g.add(part(rbox(3.0, 1.2, 0.12, 0.04), toon(0x6b6f78), "toolBoard", 0, 2.2, -0.75, 0.02));
  const toolColors = [0xee7a2c, 0x9ca3af, 0x3b82f6];
  for (let i = 0; i < 5; i++)
    g.add(part(rbox(0.12, 0.6, 0.08, 0.03), toon(toolColors[i % 3]), "tool", -1.1 + i * 0.55, 2.2, -0.66, 0));
  const tablet = new THREE.Mesh(
    rbox(0.9, 0.06, 0.6, 0.03),
    new THREE.MeshStandardMaterial({ color: 0x0d1c26, emissive: 0x39e6e0, emissiveIntensity: 0.6 }),
  );
  tablet.position.set(0.7, 1.6, 0.1);
  tablet.rotation.x = -0.3;
  g.add(tablet);
  g.position.set(x, 0, z);
  S.add(shade(g));
  return { group: g, top };
}
/** Science beacon: footing, pole, floating crystal and halo. */
export function beacon(x, z) {
  const g = new THREE.Group();
  g.add(part(new THREE.CylinderGeometry(0.6, 0.75, 0.3, 16), toon(C.dark), "beaconFoot", 0, 0.15, 0, 0.03));
  g.add(part(new THREE.CylinderGeometry(0.1, 0.12, 2.2, 10), toon(0xe8e4dc), "beaconPole", 0, 1.4, 0, 0.02));
  const orb = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.45, 0),
    new THREE.MeshStandardMaterial({ color: 0x67e8f9, emissive: 0x0891b2, emissiveIntensity: 0.8, roughness: 0.2, flatShading: true }),
  );
  orb.name = "beaconOrb";
  orb.position.y = 3.0;
  g.add(orb);
  const halo = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.04, 6, 32), new THREE.MeshBasicMaterial({ color: 0x9be7ff }));
  halo.name = "beaconHalo";
  halo.position.y = 3.0;
  halo.rotation.x = Math.PI / 2;
  g.add(halo);
  g.position.set(x, 0, z);
  S.add(shade(g));
  return g;
}
/** Greenhouse tunnel: glass shell on ribs, soil beds, leafy plants and purple grow lights. */
export function greenhouse(x, z) {
  const g = new THREE.Group();
  const len = 9,
    r = 3;
  const glass = new THREE.MeshStandardMaterial({
    color: 0xcff7e2,
    transparent: true,
    opacity: 0.3,
    roughness: 0.05,
    metalness: 0.1,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  // half cylinder lying along x, open side down
  const shell = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 40, 1, true, 0, Math.PI).rotateZ(Math.PI / 2), glass);
  shell.position.y = 0.5;
  g.add(shell);
  const metal = toon(C.metal);
  for (let i = 0; i <= 6; i++) {
    const rib = part(new THREE.TorusGeometry(r + 0.02, 0.09, 6, 32, Math.PI), metal, "ghRib", -len / 2 + (i * len) / 6, 0.5, 0, 0);
    rib.rotation.y = Math.PI / 2;
    g.add(rib);
  }
  g.add(part(rbox(len + 0.4, 0.5, 2 * r + 0.4, 0.1), toon(C.dark), "ghBase", 0, 0.25, 0, 0.03));
  const soil = toon(0x5a3a26),
    leaf = [toon(0x3fbf5a), toon(0x2f9e4a), toon(0x7bd45a)];
  for (const bz of [-1.4, 1.4]) {
    g.add(part(rbox(len - 1, 0.5, 1.4, 0.08), soil, "bed", 0, 0.75, bz, 0.02));
    for (let i = 0; i < 7; i++) {
      const plant = new THREE.Group();
      plant.name = "plant";
      for (let k = 0; k < 5; k++) {
        const l = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8).scale(0.7, 0.45, 1.5), leaf[(i + k) % 3]);
        l.rotation.set(-0.5, (k / 5) * Math.PI * 2, 0, "YXZ");
        l.position.set(Math.sin((k / 5) * Math.PI * 2) * 0.2, 0.2 + (k % 2) * 0.1, Math.cos((k / 5) * Math.PI * 2) * 0.2);
        l.castShadow = true;
        plant.add(l);
      }
      plant.position.set(-3.6 + i * 1.2, 1.0, bz);
      g.add(plant);
    }
  }
  for (const bz of [-1.0, 1.0]) {
    const light = new THREE.Mesh(rbox(len - 1.2, 0.08, 0.2, 0.03), new THREE.MeshBasicMaterial({ color: 0xc58cff }));
    light.position.set(0, 2.9, bz);
    g.add(light);
  }
  g.position.set(x, 0, z);
  S.add(shade(g));
  return g;
}
/** Storm shelter: regolith-grey dome ringed by water tanks and sandbags (water blocks radiation). */
export function shelter(x, z) {
  const g = new THREE.Group();
  g.add(part(new THREE.SphereGeometry(4.2, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2), toon(0x8a7c70), "shelterDome", 0, 0, 0, 0.05));
  const tank = toon(0x1a8fb0),
    cap = toon(0xd9dde2),
    bag = toon(0xa0886a);
  for (let i = 1; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    g.add(part(new THREE.CylinderGeometry(0.6, 0.6, 2.2, 16), tank, "tank", Math.sin(a) * 5.4, 1.1, Math.cos(a) * 5.4, 0.03));
    g.add(part(new THREE.CylinderGeometry(0.4, 0.4, 0.2, 12), cap, "tankCap", Math.sin(a) * 5.4, 2.3, Math.cos(a) * 5.4, 0.02));
  }
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + 0.2;
    const b = part(rbox(1.1, 0.5, 0.7, 0.2), bag, "sandbag", Math.sin(a) * 4.4, 0.25, Math.cos(a) * 4.4, 0.02);
    b.rotation.y = a;
    g.add(b);
  }
  g.position.set(x, 0, z);
  S.add(shade(g));
  return g;
}
/** Radio dish on a tripod. broken = knocked over. */
export function dish(x, z, broken = false) {
  const g = new THREE.Group();
  const metal = toon(C.metal),
    dark = toon(C.dark);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const leg = part(new THREE.CylinderGeometry(0.09, 0.09, 3.2, 8), metal, "dishLeg", Math.sin(a) * 0.8, 1.45, Math.cos(a) * 0.8, 0.02);
    leg.rotation.set(Math.cos(a) * 0.3, 0, -Math.sin(a) * 0.3);
    g.add(leg);
  }
  g.add(part(new THREE.CylinderGeometry(0.22, 0.22, 2.2, 12), metal, "dishMast", 0, 3.6, 0, 0.02));
  const head = new THREE.Group();
  head.name = "dishHead";
  head.position.y = 4.8;
  const bowl = part(
    lathe([[0, 0], [0.8, 0.06], [1.6, 0.28], [2.3, 0.65], [2.45, 0.8], [2.35, 0.82], [1.55, 0.36], [0.75, 0.12], [0, 0.08]], 48),
    toon(0xf1eee8, { side: THREE.DoubleSide }),
    "dishBowl",
    0,
    0,
    0,
    0.04,
  );
  head.add(bowl);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.3, 6), metal);
    const from = new THREE.Vector3(Math.sin(a) * 2.0, 0.6, Math.cos(a) * 2.0),
      to = new THREE.Vector3(0, 2.1, 0);
    strut.position.copy(from).add(to).multiplyScalar(0.5);
    strut.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize());
    head.add(strut);
  }
  head.add(part(new THREE.CylinderGeometry(0.18, 0.28, 0.5, 12), dark, "feed", 0, 2.1, 0, 0.02));
  head.rotation.x = -0.75;
  if (broken) {
    head.position.set(1.6, 0.9, 0.8);
    head.rotation.set(2.2, 0, 0.6);
  }
  g.add(head);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), new THREE.MeshBasicMaterial({ color: broken ? 0xff4b3a : 0x7ee05a }));
  lamp.position.set(0, 4.75, 0.25);
  g.add(lamp);
  g.position.set(x, 0, z);
  S.add(shade(g));
  return g;
}
/** Battery bank (generic built module). */
export function batteryBank(x, z) {
  const g = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    g.add(part(rbox(1.1, 2.0, 1.4, 0.12), toon(0x2d6e8e), "battery", -1.3 + i * 1.3, 1.2, 0, 0.03));
    const led = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.05), new THREE.MeshBasicMaterial({ color: 0x7ee05a }));
    led.position.set(-1.3 + i * 1.3, 1.8, 0.72);
    g.add(led);
  }
  g.add(part(rbox(4.2, 0.3, 1.8, 0.08), toon(C.dark), "batteryBase", 0, 0.15, 0, 0.03));
  g.position.set(x, 0, z);
  S.add(shade(g));
  return g;
}
export function glow(x, y, z, c = 0xfacc15) {
  const r = add(new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.07, 6, 40), new THREE.MeshBasicMaterial({ color: c })), x, y, z);
  r.castShadow = r.receiveShadow = false;
  r.rotation.x = -Math.PI / 2;
  return r;
}
