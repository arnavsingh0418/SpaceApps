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
export function wreck(x, z) {
  const g = new THREE.Group();
  const hull = new THREE.Mesh(
    new THREE.CylinderGeometry(1.8, 2.1, 9, 8),
    mat(0xe8e4dc),
  );
  hull.rotation.z = Math.PI / 2;
  g.add(hull);
  const stripe = new THREE.Mesh(
    new THREE.CylinderGeometry(1.86, 1.86, 1.2, 8),
    mat(0xf97316),
  );
  stripe.rotation.z = Math.PI / 2;
  stripe.position.x = 1.5;
  g.add(stripe);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(1.8, 3, 8), mat(0xe8e4dc));
  nose.rotation.z = -Math.PI / 2;
  nose.position.x = 6;
  g.add(nose);
  for (const s of [-1, 1]) {
    const fin = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 0.2, 2.2),
      mat(0xf97316),
    );
    fin.position.set(-3.6, 0.4, s * 2.2);
    fin.rotation.x = s * 0.4;
    g.add(fin);
  }
  const win = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, 0.8, 3.7),
    mat(0x334155, { roughness: 0.3 }),
  );
  win.position.set(4.2, 0.6, 0);
  g.add(win);
  g.position.set(x, 1.1, z);
  g.rotation.set(0.15, 0.5, -0.12);
  g.traverse((o) => {
    if (o.isMesh) o.castShadow = o.receiveShadow = true;
  });
  S.add(g);
  return g;
}
export function smoke(x, y, z) {
  for (let i = 0; i < 9; i++) {
    const p = add(
      new THREE.Mesh(
        new THREE.SphereGeometry(0.6 + i * 0.2, 12, 10),
        mat(0xb8aca4, {
          transparent: true,
          opacity: 0.4 - i * 0.035,
          depthWrite: false,
        }),
      ),
      x + Math.sin(i) * 0.6 + i * 0.4,
      y + i * 1.1,
      z,
    );
    p.castShadow = false;
  }
}
export function crate(x, z, c = 0x8b6a45, s = 0.8) {
  const b = add(
    new THREE.Mesh(new THREE.BoxGeometry(s, s, s), mat(c)),
    x,
    s / 2,
    z,
  );
  b.rotation.y = rnd();
  return b;
}
export function panel(x, z, rot = 0, dusty = 0) {
  const g = new THREE.Group();
  const post = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.06, 1),
    mat(0x9ca3af),
  );
  post.position.y = 0.5;
  g.add(post);
  const p = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 0.08, 1.3),
    mat(dusty ? 0x8a5a44 : 0x1e3a8a, { roughness: dusty ? 1 : 0.35 }),
  );
  p.position.y = 1.05;
  p.rotation.x = -0.5;
  g.add(p);
  g.position.set(x, 0, z);
  g.rotation.y = rot;
  g.traverse((o) => {
    if (o.isMesh) o.castShadow = true;
  });
  S.add(g);
  return g;
}
export function dome(x, z, r, c = 0xe8e4dc) {
  return add(
    new THREE.Mesh(
      new THREE.SphereGeometry(r, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      mat(c),
    ),
    x,
    0,
    z,
  );
}
export function greenhouse(x, z) {
  const g = new THREE.Group();
  const shell = new THREE.Mesh(
    new THREE.CylinderGeometry(1.6, 1.6, 5, 10, 1, false, 0, Math.PI),
    mat(0xbbf7d0, { transparent: true, opacity: 0.45, roughness: 0.2 }),
  );
  shell.rotation.z = Math.PI / 2;
  shell.rotation.y = Math.PI / 2;
  g.add(shell);
  for (let i = -2; i <= 2; i++)
    for (const s of [-0.7, 0.7]) {
      const plant = new THREE.Mesh(
        new THREE.ConeGeometry(0.3, 0.7, 6),
        mat(0x22c55e),
      );
      plant.position.set(s, 0.35, i * 0.9);
      g.add(plant);
    }
  g.position.set(x, 0, z);
  S.add(g);
  return g;
}
export function dish(x, z, broken = false) {
  const g = new THREE.Group();
  const mast = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1, 0.14, 3),
    mat(0x9ca3af),
  );
  mast.position.y = 1.5;
  g.add(mast);
  const d = new THREE.Mesh(
    new THREE.SphereGeometry(1.3, 14, 8, 0, Math.PI * 2, 0, Math.PI / 3.2),
    mat(0xe5e7eb, { side: THREE.DoubleSide }),
  );
  d.position.y = 3;
  d.rotation.x = broken ? 2.6 : -0.9;
  g.add(d);
  g.position.set(x, 0, z);
  g.traverse((o) => {
    if (o.isMesh) o.castShadow = true;
  });
  S.add(g);
  return g;
}
export function glow(x, y, z, c = 0xfacc15) {
  const r = add(
    new THREE.Mesh(
      new THREE.TorusGeometry(0.7, 0.07, 6, 24),
      new THREE.MeshBasicMaterial({ color: c }),
    ),
    x,
    y,
    z,
  );
  r.rotation.x = -Math.PI / 2;
  return r;
}
