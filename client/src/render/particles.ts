import * as THREE from "three";
/** Fixed-size particle pool: no meshes or arrays allocated when emitting. */
export class ParticlePool {
  mesh: THREE.InstancedMesh;
  pos: Float32Array;
  vel: Float32Array;
  life: Float32Array;
  max: Float32Array;
  size: Float32Array;
  cursor = 0;
  dummy = new THREE.Object3D();
  color = new THREE.Color();
  constructor(
    scene: THREE.Scene,
    public capacity = 192,
    smoke = false,
  ) {
    this.mesh = new THREE.InstancedMesh(
      smoke
        ? new THREE.IcosahedronGeometry(1, 0)
        : new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: smoke,
        opacity: smoke ? 0.16 : 1,
        depthWrite: !smoke,
      }),
      capacity,
    );
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.pos = new Float32Array(capacity * 3);
    this.vel = new Float32Array(capacity * 3);
    this.life = new Float32Array(capacity);
    this.max = new Float32Array(capacity);
    this.size = new Float32Array(capacity);
    for (let i = 0; i < capacity; i++) {
      this.dummy.scale.setScalar(0);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
      this.mesh.setColorAt(i, this.color.setHex(0xffffff));
    }
    scene.add(this.mesh);
  }
  emit(
    x: number,
    y: number,
    z: number,
    color: number,
    count = 1,
    scale = 0.08,
    life = 0.7,
    vx = 0,
    vy = 0.8,
    vz = 0,
  ) {
    for (let n = 0; n < count; n++) {
      const i = this.cursor++ % this.capacity,
        j = i * 3;
      this.pos[j] = x;
      this.pos[j + 1] = y;
      this.pos[j + 2] = z;
      this.vel[j] = vx + (Math.random() - 0.5) * 0.7;
      this.vel[j + 1] = vy + Math.random() * 0.4;
      this.vel[j + 2] = vz + (Math.random() - 0.5) * 0.7;
      this.life[i] = this.max[i] = life;
      this.size[i] = scale;
      this.mesh.setColorAt(i, this.color.setHex(color));
    }
    this.mesh.instanceColor!.needsUpdate = true;
  }
  update(dt: number, smoke = false) {
    for (let i = 0; i < this.capacity; i++) {
      const j = i * 3;
      if (this.life[i] > 0) {
        this.life[i] = Math.max(0, this.life[i] - dt);
        this.pos[j] += this.vel[j] * dt;
        this.pos[j + 1] += this.vel[j + 1] * dt;
        this.pos[j + 2] += this.vel[j + 2] * dt;
        const t = this.life[i] / this.max[i];
        this.dummy.position.set(this.pos[j], this.pos[j + 1], this.pos[j + 2]);
        this.dummy.scale.setScalar(
          this.size[i] *
            (smoke ? (0.5 + (1 - t) * 2.5) * Math.min(1, t * 5) : t),
        );
      } else this.dummy.scale.setScalar(0);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
  get active() {
    let n = 0;
    for (const t of this.life) if (t > 0) n++;
    return n;
  }
}
