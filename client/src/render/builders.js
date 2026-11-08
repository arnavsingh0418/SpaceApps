import * as THREE from "three";
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
export function astronaut(color) {
  const g = new THREE.Group();
  const suit = mat(color),
    dark = mat(0x3a3a44),
    white = mat(0xe8e4dc);
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.42, 0.55, 4, 10),
    suit,
  );
  body.name = "body";
  body.position.y = 1.0;
  g.add(body);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.42, 16, 12),
    mat(0xf5f5f4),
  );
  head.name = "helmet";
  head.position.y = 1.78;
  g.add(head);
  const visor = new THREE.Mesh(
    new THREE.SphereGeometry(0.44, 16, 12, Math.PI / 2 - 0.95, 1.9, 0.75, 1.25),
    mat(0x67e8f9, {
      emissive: 0x0e7490,
      emissiveIntensity: 0.6,
      roughness: 0.2,
      flatShading: false,
    }),
  );
  visor.name = "visor";
  visor.position.set(0, 1.78, 0.02);
  g.add(visor);
  const pack = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.7, 0.32), white);
  pack.position.set(0, 1.12, -0.42);
  g.add(pack);
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.15, 0.35, 3, 8),
      suit,
    );
    leg.name = s < 0 ? "legL" : "legR";
    leg.geometry.translate(0, -0.3, 0);
    leg.position.set(s * 0.18, 0.65, 0);
    g.add(leg);
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.16, 0.34), dark);
    boot.position.set(0, -0.57, 0.04);
    leg.add(boot);
    const arm = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.12, 0.42, 3, 8),
      suit,
    );
    arm.geometry.translate(0, -0.2, 0);
    arm.position.set(s * 0.52, 1.25, 0);
    arm.rotation.z = s * 0.15;
    arm.name = s < 0 ? "armL" : "armR";
    g.add(arm);
  }
  g.traverse((o) => {
    if (o.isMesh) o.castShadow = true;
  });
  const carried = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 0.5, 0.5),
    mat(0x9ca3af),
  );
  carried.name = "carried";
  carried.position.set(0, 1.12, 0.65);
  carried.visible = false;
  g.add(carried);
  const wrench = new THREE.Group();
  wrench.name = "wrench";
  const handle = new THREE.Mesh(
    new THREE.BoxGeometry(0.07, 0.4, 0.07),
    mat(0x9ca3af),
  );
  const jaw = new THREE.Mesh(
    new THREE.TorusGeometry(0.1, 0.035, 4, 8, Math.PI * 1.5),
    mat(0x9ca3af),
  );
  jaw.position.y = 0.24;
  wrench.add(handle, jaw);
  wrench.position.set(0, -0.4, 0.15);
  wrench.visible = false;
  g.getObjectByName("armR").add(wrench);
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
