import * as T from "three";
import { astronaut } from "./builders.js";
import { arrivalDuration, arrivalStory } from "../ui/filmStory";
import "../ui/arrival.css";
import "../ui/film.css";

const clamp = T.MathUtils.clamp;
const mix = T.MathUtils.lerp;
const smooth = (x: number) => {
  const t = clamp(x, 0, 1);
  return t * t * (3 - 2 * t);
};
const V = (x: number, y: number, z: number) => new T.Vector3(x, y, z);
const material = (
  color: number,
  extra: T.MeshStandardMaterialParameters = {},
) =>
  new T.MeshStandardMaterial({
    color,
    roughness: 0.65,
    flatShading: true,
    ...extra,
  });
function mesh(
  parent: T.Object3D,
  geometry: T.BufferGeometry,
  color: number,
  x = 0,
  y = 0,
  z = 0,
  extra: T.MeshStandardMaterialParameters = {},
) {
  const object = new T.Mesh(geometry, material(color, extra));
  object.position.set(x, y, z);
  parent.add(object);
  return object;
}
const box = (
  g: T.Object3D,
  w: number,
  h: number,
  d: number,
  c: number,
  x = 0,
  y = 0,
  z = 0,
) => mesh(g, new T.BoxGeometry(w, h, d), c, x, y, z);
function rod(
  parent: T.Object3D,
  a: T.Vector3,
  b: T.Vector3,
  radius = 0.035,
  color = 0xd6cbb1,
) {
  const direction = b.clone().sub(a);
  const m = mesh(
    parent,
    new T.CylinderGeometry(radius, radius, direction.length(), 5),
    color,
  );
  m.position.copy(a.clone().add(b).multiplyScalar(0.5));
  m.quaternion.setFromUnitVectors(V(0, 1, 0), direction.normalize());
  return m;
}
function flame(parent: T.Object3D, x = 0, y = 0, z = 0) {
  const g = new T.Group();
  g.position.set(x, y, z);
  for (const [radius, length, color] of [
    [0.45, 3, 0xff6a25],
    [0.25, 2.1, 0xffc961],
    [0.12, 1.25, 0xfff4d3],
  ]) {
    const f = mesh(
      g,
      new T.ConeGeometry(radius, length, 9),
      color,
      0,
      -length / 2,
      0,
      { emissive: color, emissiveIntensity: 1.4 },
    );
    f.rotation.z = Math.PI;
  }
  parent.add(g);
  return g;
}
function pilot(parent: T.Object3D, scale = 0.8, color = 0xf28b32) {
  // The existing builder adds to the gameplay scene. Reparent immediately,
  // keeping its material/geometry ownership exclusive to this sequence.
  const actor = astronaut(color) as T.Group;
  actor.scale.setScalar(scale);
  parent.add(actor);
  return actor;
}
function walk(actor: T.Group, time: number, active: boolean) {
  for (const [name, sign] of [
    ["armL", 1],
    ["armR", -1],
    ["legL", -1],
    ["legR", 1],
  ] as const) {
    const limb = actor.getObjectByName(name);
    if (limb) limb.rotation.x = active ? Math.sin(time * 7) * 0.42 * sign : 0;
  }
}

export class Arrival {
  scene = new T.Scene();
  camera = new T.PerspectiveCamera(44, 1, 0.1, 650);
  elapsed = 0;
  paused = false;
  reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  private element: HTMLElement;
  private chapter = -1;
  private captionIndex = -1;
  private done = false;
  private pad = new T.Group();
  private cabin = new T.Group();
  private space = new T.Group();
  private descent = new T.Group();
  private surface = new T.Group();
  private prep = new T.Group();
  private control = new T.Group();
  private lab = new T.Group();
  private prepCrew: T.Group[] = [];
  private controllers: T.Group[] = [];
  private scientist!: T.Group;
  private crewOutside: T.Group[] = [];
  private controlGlobe!: T.Group;
  private floatingTools: T.Group[] = [];
  private footprints: T.Mesh[] = [];
  private voice = new Audio();
  private voiceSource: MediaElementAudioSourceNode | null = null;
  private filmBus: GainNode | null = null;
  private filmMuted = false;
  private filmVolume = 0.35;
  private score: OscillatorNode[] = [];
  private lastBeat = -1;
  private visibilityChange = () => {
    if (document.hidden || this.paused) this.voice.pause();
    else if (!this.voice.ended && this.voice.src)
      void this.voice.play().catch(() => {});
  };
  private rocket = new T.Group();
  private booster = new T.Group();
  private launchFlame: T.Group;
  private boarder: T.Group;
  private boardingDoor: T.Group;
  private seated: T.Group;
  private hatch: T.Group;
  private harness: T.Group;
  private earth: T.Group;
  private mars: T.Group;
  private ship: T.Group;
  private lander: T.Group;
  private shield: T.Mesh<T.BufferGeometry, T.MeshStandardMaterial>;
  private chute = new T.Group();
  private jets: T.Group[] = [];
  private wreck: T.Group;
  private exitHatch: T.Group;
  private ladder: T.Group;
  private explorer: T.Group;
  private dust: T.Mesh<T.BufferGeometry, T.MeshStandardMaterial>[] = [];
  private smoke: T.Mesh<T.BufferGeometry, T.MeshStandardMaterial>[] = [];
  private airStreaks: T.Mesh[] = [];
  private alarm: T.PointLight;
  private lamp: T.DirectionalLight;
  private soundGain: GainNode | null = null;
  private soundSources: (OscillatorNode | AudioBufferSourceNode)[] = [];
  private noiseGain: GainNode | null = null;
  private readonly media = matchMedia("(prefers-reduced-motion: reduce)");
  private motionChange = (event: MediaQueryListEvent) => {
    this.reduced = event.matches;
    this.updateControls();
  };

  constructor(
    private renderer: T.WebGLRenderer,
    host: HTMLElement,
    private finish: () => void,
    audio: {
      context: AudioContext | null;
      master: GainNode | null;
      muted?: boolean;
      volume?: number;
    },
    private landscape?: {
      scene: T.Scene;
      terrain: { ready: boolean; heightAt: (x: number, z: number) => number };
    },
  ) {
    this.filmMuted = !!audio.muted;
    this.filmVolume = audio.volume ?? 0.35;
    host.innerHTML = `<section class="arrival" role="region" aria-label="Journey to Mars" tabindex="-1">
      <header class="arrival-header"><div class="arrival-brand"><span class="arrival-emblem">↗</span><div>OUTPOST DOWN<small>A LITTLE CREW / AN ORIGINAL SHORT FILM</small></div></div>
        <nav aria-label="Cinematic controls"><button data-arrival="pause">Pause</button><button data-arrival="sound">Sound: on</button><button data-arrival="motion">Motion: full</button><button data-arrival="skip">Skip film ↗</button></nav></header>
      <div class="film-act" data-act></div><div class="film-curtain" aria-hidden="true"></div><div class="film-vignette" aria-hidden="true"></div><div class="film-telemetry" data-telemetry aria-hidden="true"></div>
      <div class="arrival-location"><span data-place></span><h1 data-title></h1></div>
      <div class="arrival-crosshair" aria-hidden="true">＋</div><div class="arrival-film-edge" aria-hidden="true"></div>
      <footer class="arrival-footer"><div class="arrival-captions"><span class="arrival-eyebrow">MISSION LOG <b data-chapter></b></span><p data-caption role="status" aria-live="polite"></p></div>
        <aside class="arrival-fact"><span>THE SCIENCE BEHIND THE STORY</span><p data-fact></p></aside>
        <div class="arrival-bottom"><span data-status></span><div><span class="film-time" data-time></span><button data-arrival="previous" aria-label="Previous scene">←</button><button data-arrival="next">Next scene →</button></div></div>
        <div class="arrival-timeline" aria-label="Journey progress">${arrivalStory.map((s) => `<i title="${s.place}"><b></b></i>`).join("")}</div>
      </footer></section>`;
    this.element = host.querySelector(".arrival")!;
    this.element.addEventListener("click", this.onClick);
    this.element.focus({ preventScroll: true });
    this.media.addEventListener("change", this.motionChange);
    document.addEventListener("visibilitychange", this.visibilityChange);
    this.voice.preload = "auto";
    document.querySelector<HTMLElement>("#labels")!.hidden = true;
    this.scene.add(new T.HemisphereLight(0xcde5ff, 0x5b362a, 2.2));
    this.lamp = new T.DirectionalLight(0xffdfba, 3.2);
    this.lamp.position.set(-12, 20, 10);
    this.scene.add(this.lamp);
    this.scene.add(
      this.pad,
      this.cabin,
      this.space,
      this.descent,
      this.surface,
      this.prep,
      this.control,
      this.lab,
    );

    // Access bridge and launch vehicle.
    mesh(this.pad, new T.CylinderGeometry(11, 12, 0.45, 48), 0x263b46, 0, -0.3);
    for (let i = 0; i < 4; i++) {
      box(
        this.pad,
        0.24,
        11,
        0.24,
        0x687e88,
        -4.5 + (i % 2) * 1.7,
        5.5,
        -1.2 + Math.floor(i / 2) * 1.7,
      );
      for (let y = 1; y < 11; y += 2)
        rod(this.pad, V(-4.5, y, -1.2), V(-2.8, y + 1.5, -1.2), 0.07, 0x8296a0);
    }
    box(this.pad, 8, 0.2, 1.5, 0x718995, -3.8, 7.1, 2);
    for (const z of [1.3, 2.7]) {
      rod(this.pad, V(-7.5, 8, z), V(-0.6, 8, z), 0.04);
      for (let x = -7; x < 0; x++)
        rod(this.pad, V(x, 7.2, z), V(x, 8, z), 0.025);
    }
    this.pad.add(this.rocket);
    this.rocket.add(this.booster);
    mesh(this.booster, new T.CylinderGeometry(1, 1, 6, 24), 0xe7e4d6, 0, 3);
    mesh(
      this.booster,
      new T.CylinderGeometry(1.02, 1.02, 0.65, 24),
      0xef7e32,
      0,
      4.9,
    );
    for (const x of [-1.55, 1.55]) {
      mesh(
        this.booster,
        new T.CylinderGeometry(0.45, 0.45, 5, 12),
        0xe1e2da,
        x,
        2.7,
      );
      mesh(this.booster, new T.ConeGeometry(0.45, 1, 12), 0xe1e2da, x, 5.7);
    }
    mesh(this.rocket, new T.CylinderGeometry(0.95, 1, 3, 24), 0xcbd6db, 0, 7.5);
    mesh(this.rocket, new T.ConeGeometry(0.95, 2.5, 24), 0xe9ebdf, 0, 10.25);
    box(this.rocket, 0.9, 1.7, 0.09, 0x132731, 0, 7.95, 1);
    this.boardingDoor = new T.Group();
    this.boardingDoor.position.set(0.48, 7.95, 1.07);
    this.rocket.add(this.boardingDoor);
    box(this.boardingDoor, 0.92, 1.75, 0.12, 0xcdd9d8, -0.46, 0, 0);
    mesh(
      this.boardingDoor,
      new T.SphereGeometry(0.21, 16, 12),
      0x183b52,
      -0.46,
      0.3,
      0.1,
      { metalness: 0.5, roughness: 0.2 },
    );
    this.launchFlame = flame(this.booster, 0, 0);
    this.boarder = pilot(this.pad, 0.64);
    for (let i = 0; i < 20; i++)
      this.smoke.push(
        mesh(this.pad, new T.IcosahedronGeometry(1, 1), 0xc1c8c6, 0, 0, 0, {
          transparent: true,
          opacity: 0.65,
        }),
      );

    // Camera inside the capsule faces the pilot, with Earth beyond the window.
    box(this.cabin, 13, 8, 0.45, 0x182a36, 0, 3, -2.3);
    box(this.cabin, 13, 0.25, 9, 0x253c49, 0, -0.1, 0);
    for (const x of [-4.8, 4.8]) box(this.cabin, 0.35, 7, 8, 0x315466, x, 3, 0);
    const windowRing = mesh(
      this.cabin,
      new T.TorusGeometry(1.65, 0.15, 8, 48),
      0x8daeb9,
      2.5,
      3.8,
      -1.9,
    );
    mesh(this.cabin, new T.CircleGeometry(1.58, 48), 0x357ea7, 2.5, 3.8, -2, {
      emissive: 0x163c5c,
      emissiveIntensity: 0.8,
    });
    windowRing.rotation.z = Math.PI / 8;
    this.hatch = new T.Group();
    this.hatch.position.set(-4, 0, -1.7);
    this.cabin.add(this.hatch);
    box(this.hatch, 2.7, 5.5, 0.25, 0x65808b, 1.35, 2.75);
    box(this.hatch, 1.5, 0.1, 0.4, 0xe99844, 1.35, 2.8, 0.2);
    box(this.cabin, 1.5, 2.2, 0.5, 0x11212a, -0.5, 1.5, -0.35);
    box(this.cabin, 1.55, 0.3, 1.25, 0x3a5664, -0.5, 0.55, 0.1);
    this.seated = pilot(this.cabin, 1.18);
    this.seated.position.set(-0.5, 0.35, 0.25);
    for (const name of ["legL", "legR"])
      this.seated.getObjectByName(name)!.rotation.x = -1.2;
    this.harness = new T.Group();
    this.cabin.add(this.harness);
    rod(
      this.harness,
      V(-1.07, 2.1, 0.8),
      V(-0.05, 1.22, 0.96),
      0.075,
      0x27333c,
    );
    rod(this.harness, V(0.05, 2.1, 0.8), V(-1.05, 1.22, 0.96), 0.075, 0x27333c);
    box(this.harness, 0.25, 0.25, 0.12, 0xecc15d, -0.5, 1.5, 1);
    const console = box(this.cabin, 2.4, 0.4, 1.2, 0x0c1b23, 2.3, 0.8, 1);
    console.rotation.x = -0.25;
    for (let i = 0; i < 8; i++)
      mesh(
        this.cabin,
        new T.BoxGeometry(0.19, 0.06, 0.13),
        i % 3 ? 0x54dfbd : 0xffc766,
        1.6 + (i % 4) * 0.4,
        1.08,
        0.6 + Math.floor(i / 4) * 0.3,
        { emissive: i % 3 ? 0x54dfbd : 0xffc766 },
      );
    this.alarm = new T.PointLight(0xff6b36, 0, 25);
    this.alarm.position.set(1, 3, 3);
    this.cabin.add(this.alarm);

    // Orbital flight: modeled planets and a traveling spacecraft, all local assets.
    const positions: number[] = [];
    for (let i = 0; i < 520; i++) {
      const a = i * 2.39996,
        y = 1 - (2 * (i + 0.5)) / 520,
        r = Math.sqrt(1 - y * y);
      positions.push(Math.cos(a) * r * 180, y * 180, Math.sin(a) * r * 180);
    }
    const stars = new T.BufferGeometry();
    stars.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
    this.space.add(
      new T.Points(
        stars,
        new T.PointsMaterial({
          color: 0xe7efff,
          size: 0.34,
          sizeAttenuation: true,
        }),
      ),
    );
    this.earth = this.planet(false);
    this.earth.position.set(-10, 1, -15);
    this.earth.scale.setScalar(0.65);
    this.space.add(this.earth);
    this.mars = this.planet(true);
    this.mars.position.set(9, 2, -12);
    this.mars.scale.setScalar(0.55);
    this.space.add(this.mars);
    this.ship = this.capsule();
    this.ship.getObjectByName("landing-gear")!.visible = false;
    this.space.add(this.ship);
    this.ship.rotation.z = -Math.PI / 2;
    for (const x of [-3.4, 3.4]) {
      box(this.ship, 4, 0.1, 1.8, 0x183b68, x, 0.2, 0);
      for (let i = 0; i < 8; i++)
        box(this.ship, 0.025, 0.03, 1.8, 0x7ba7bb, x - 1.8 + i * 0.5, 0.27, 0);
      rod(this.ship, V(0, 0.2, 0), V(x, 0.2, 0), 0.06);
    }

    this.lander = this.capsule();
    this.descent.add(this.lander);
    const streakGeometry = new T.BoxGeometry(0.025, 1, 0.025);
    const streakMaterial = new T.MeshBasicMaterial({
      color: 0xffd6a2,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
    });
    for (let i = 0; i < 60; i++) {
      const streak = new T.Mesh(streakGeometry, streakMaterial);
      streak.position.set(
        Math.cos(i * 2.4) * (4 + (i % 9)),
        0,
        Math.sin(i * 2.4) * (4 + (i % 9)),
      );
      this.descent.add(streak);
      this.airStreaks.push(streak);
    }
    this.shield = mesh(
      this.descent,
      new T.CylinderGeometry(1.9, 1.5, 0.24, 24),
      0x3c2624,
      0,
      -0.7,
      0,
      { emissive: 0xf65b26, emissiveIntensity: 0.6 },
    );
    const canopy = mesh(
      this.chute,
      new T.SphereGeometry(4.3, 24, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      0xf1dcc2,
      0,
      8,
      0,
      { side: T.DoubleSide },
    );
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      rod(
        this.chute,
        V(Math.cos(a) * 4.3, 8, Math.sin(a) * 4.3),
        V(0, 1.8, 0),
        0.018,
      );
      if (i % 2 === 0) {
        const stripe = mesh(
          this.chute,
          new T.SphereGeometry(4.32, 3, 8, a, Math.PI / 6, 0, Math.PI / 2),
          0xd6693c,
          0,
          8,
        );
        stripe.material.side = T.DoubleSide;
      }
    }
    canopy.name = "parachute";
    this.descent.add(this.chute);
    for (const x of [-1.25, 1.25]) this.jets.push(flame(this.lander, x, -0.5));
    const ground = mesh(
      this.surface,
      new T.PlaneGeometry(160, 160, 1, 1),
      0xb45a35,
    );
    ground.rotation.x = -Math.PI / 2;
    for (let i = 0; i < 65; i++) {
      const a = i * 2.4,
        r = 8 + (i % 12) * 2.8;
      const rock = mesh(
        this.surface,
        new T.DodecahedronGeometry(0.25 + (i % 5) * 0.15, 0),
        0x7e4130,
        Math.cos(a) * r,
        0.1,
        Math.sin(a) * r,
      );
      rock.scale.y = 0.6;
    }
    for (let i = 0; i < 10; i++)
      mesh(
        this.surface,
        new T.ConeGeometry(8 + (i % 3) * 4, 4 + (i % 4), 6),
        0x9c553c,
        -45 + i * 10,
        1,
        -35,
      );
    mesh(
      this.surface,
      new T.SphereGeometry(2.6, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2),
      0xd5c8aa,
      6,
      0,
      -7,
    );
    box(this.surface, 1.1, 1.6, 0.2, 0x24313a, 6, 0.8, -4.55);
    for (let i = 0; i < 5; i++)
      box(
        this.surface,
        0.55,
        0.55,
        0.55,
        [0xc5a166, 0x72a3b9, 0x758a4c][i % 3],
        -4 + i * 2.4,
        0.28,
        2 + (i % 2) * 2,
      );
    this.wreck = this.capsule();
    this.surface.add(this.wreck);
    this.exitHatch = new T.Group();
    this.exitHatch.position.set(-0.5, 0.9, 1.28);
    this.wreck.add(this.exitHatch);
    box(this.exitHatch, 1, 1.3, 0.16, 0xf2e8d1, 0.5, 0.1, 0);
    this.ladder = new T.Group();
    this.surface.add(this.ladder);
    for (const x of [-0.38, 0.38])
      rod(this.ladder, V(x, 0, 0), V(x, 1.8, -1.1), 0.04);
    for (let i = 0; i < 6; i++)
      rod(
        this.ladder,
        V(-0.38, i * 0.3, -i * 0.183),
        V(0.38, i * 0.3, -i * 0.183),
        0.035,
      );
    this.ladder.position.set(0.5, 0, 3.2);
    this.explorer = pilot(this.surface, 0.8);
    for (let i = 0; i < 28; i++)
      this.dust.push(
        mesh(
          this.surface,
          new T.IcosahedronGeometry(0.6, 1),
          0xdaaa7a,
          0,
          0,
          0,
          { transparent: true, opacity: 0.5, depthWrite: false },
        ),
      );
    this.buildFilmSets();
    this.startAudio(audio);
    this.updateControls();
    this.update(0);
  }

  private buildFilmSets() {
    // Suit room: lockers, illuminated inspection rails, a crew and actual moving glove checks.
    box(this.prep, 16, 0.2, 12, 0x243746, 0, -0.1, 0);
    box(this.prep, 16, 7, 0.3, 0x1b303f, 0, 3, -3);
    for (let i = 0; i < 6; i++) {
      box(
        this.prep,
        1.5,
        3.7,
        0.55,
        i % 2 ? 0x435a67 : 0x304653,
        -5 + i * 2,
        1.85,
        -2.6,
      );
      box(this.prep, 0.12, 0.7, 0.12, 0xbdb99c, -4.5 + i * 2, 1.8, -2.22);
      mesh(
        this.prep,
        new T.BoxGeometry(1.25, 0.06, 0.08),
        0x98ecdd,
        -5 + i * 2,
        4,
        -2.3,
        { emissive: 0x98ecdd, emissiveIntensity: 1.8 },
      );
    }
    for (const [i, color] of [0xe78b39, 0x71c4bc, 0xb49ee4].entries()) {
      const actor = pilot(this.prep, 1.15, color);
      actor.position.set(-2.4 + i * 2.4, 0, 0.4);
      this.prepCrew.push(actor);
      box(this.prep, 1.2, 0.12, 0.65, 0x405765, -2.4 + i * 2.4, 0.5, -1);
    }
    // Mission Control: rows of consoles, seated operators and a rotating briefing globe.
    box(this.control, 24, 0.2, 20, 0x10232e, 0, -0.1, 0);
    box(this.control, 24, 9, 0.3, 0x122c3c, 0, 4, -6);
    for (let row = 0; row < 2; row++)
      for (let col = 0; col < 3; col++) {
        const x = (col - 1) * 4.6,
          z = row * 4;
        box(this.control, 3.2, 1, 1.4, 0x2d4654, x, 0.7, z);
        mesh(
          this.control,
          new T.BoxGeometry(1.2, 0.8, 0.1),
          0x7ce5cf,
          x,
          1.6,
          z - 0.4,
          { emissive: 0x39a990, emissiveIntensity: 0.8 },
        );
        for (let i = 0; i < 3; i++)
          box(
            this.control,
            0.18,
            0.04,
            0.12,
            [0x9cf1cb, 0xf2cb7d, 0xe87868][i],
            x - 0.4 + i * 0.4,
            1.23,
            z + 0.25,
          );
        const actor = pilot(this.control, 0.85, col % 2 ? 0x699aa4 : 0xd19c59);
        actor.position.set(x, 0, z + 1.5);
        actor.rotation.y = Math.PI;
        actor.getObjectByName("armL")!.rotation.x = -0.8;
        actor.getObjectByName("armR")!.rotation.x = -0.8;
        this.controllers.push(actor);
      }
    this.controlGlobe = this.planet(true);
    this.controlGlobe.scale.setScalar(0.32);
    this.controlGlobe.position.set(0, 4.7, -4.4);
    this.control.add(this.controlGlobe);
    for (const x of [-7, 7]) {
      mesh(
        this.control,
        new T.BoxGeometry(5.4, 3.1, 0.1),
        0x235669,
        x,
        4.4,
        -5.7,
        { emissive: 0x16384d },
      );
      for (let i = 0; i < 8; i++)
        box(
          this.control,
          3 + (i % 3) * 0.4,
          0.07,
          0.1,
          i % 3 ? 0x78bfb8 : 0xf2ca75,
          x,
          3.4 + i * 0.27,
          -5.6,
        );
    }
    // Transit lab: two plant trays, differing growth, water lines and restrained floating tools.
    box(this.lab, 14, 0.2, 10, 0x263d49, 0, -0.1, 0);
    box(this.lab, 14, 7, 0.3, 0x122c39, 0, 3, -3);
    box(this.lab, 5.5, 0.15, 2, 0x516c78, 1, 1.1, 0);
    for (const [index, x] of [-0.5, 2.2].entries()) {
      box(this.lab, 2.1, 0.25, 1.5, 0x172e2f, x, 1.3, 0);
      box(this.lab, 1.8, 0.04, 1.3, 0x634434, x, 1.46, 0);
      for (let i = 0; i < 5; i++) {
        const height = index ? 0.25 : 0.55;
        rod(
          this.lab,
          V(x - 0.7 + i * 0.35, 1.5, 0),
          V(x - 0.7 + i * 0.35, 1.5 + height, 0),
          0.035,
          0x76a74b,
        );
        const leaf = mesh(
          this.lab,
          new T.SphereGeometry(0.2, 8, 6),
          0x8ebd59,
          x - 0.7 + i * 0.35,
          1.6 + height,
          0,
        );
        leaf.scale.set(1, 0.25, 0.5);
      }
      mesh(
        this.lab,
        new T.BoxGeometry(2.1, 0.08, 1.5),
        index ? 0x445766 : 0xc5a9f0,
        x,
        3.2,
        0,
        { emissive: index ? 0x152838 : 0x9e7ee0, emissiveIntensity: 0.8 },
      );
      for (const dx of [-1, 1])
        rod(this.lab, V(x + dx, 1.2, -0.6), V(x + dx, 3.2, -0.6), 0.04);
    }
    this.scientist = pilot(this.lab, 1.2, 0x71c4bc);
    this.scientist.position.set(-2.5, 0.25, 0.3);
    this.scientist.rotation.y = 0.5;
    for (let i = 0; i < 3; i++) {
      const item = new T.Group();
      box(item, 0.2, 0.5, 0.12, 0xb7c3b5);
      item.position.set(3.9 + i * 0.35, 2.8, -1.2);
      this.lab.add(item);
      this.floatingTools.push(item);
    }
    for (const [i, color] of [0x71c4bc, 0xb49ee4].entries()) {
      const a = pilot(this.surface, 0.8, color);
      a.position.set(3.2 + i * 1.5, 0, 4.5);
      this.crewOutside.push(a);
    }
    for (let i = 0; i < 18; i++) {
      const print = mesh(
        this.surface,
        new T.PlaneGeometry(0.18, 0.32),
        0x763f30,
        2 + (i % 2) * 0.35,
        0.012,
        3.9 + i * 0.32,
      );
      print.rotation.x = -Math.PI / 2;
      this.footprints.push(print);
    }
  }

  private capsule() {
    const g = new T.Group();
    mesh(g, new T.CylinderGeometry(0.95, 1.5, 2.4, 16), 0xe8e1cd, 0, 0.7);
    mesh(g, new T.ConeGeometry(0.96, 1.2, 16), 0xe8e1cd, 0, 2.5);
    mesh(g, new T.CylinderGeometry(1.36, 1.43, 0.4, 16), 0xf2843f, 0, -0.1);
    mesh(g, new T.SphereGeometry(0.3, 16, 10), 0x235770, 0, 1.5, 1.03, {
      metalness: 0.5,
      roughness: 0.18,
    });
    box(g, 0.7, 1.05, 0.12, 0x1c2c34, 0, 0.8, 1.29);
    const gear = new T.Group();
    gear.name = "landing-gear";
    g.add(gear);
    for (let i = 0; i < 4; i++) {
      const a = Math.PI / 4 + (i * Math.PI) / 2;
      rod(
        gear,
        V(Math.cos(a), -0.3, Math.sin(a)),
        V(Math.cos(a) * 2, -1.25, Math.sin(a) * 2),
        0.09,
        0x666b66,
      );
      box(
        gear,
        0.55,
        0.15,
        0.55,
        0x424646,
        Math.cos(a) * 2,
        -1.25,
        Math.sin(a) * 2,
      );
    }
    return g;
  }
  private planet(mars: boolean) {
    const g = new T.Group(),
      radius = 6;
    mesh(g, new T.IcosahedronGeometry(radius, 4), mars ? 0xb85c38 : 0x1e6790);
    if (mars) {
      for (let i = 0; i < 22; i++) {
        const a = i * 2.399,
          y = (i / 22 - 0.5) * 10,
          r = Math.sqrt(36 - y * y);
        const crater = mesh(
          g,
          new T.CircleGeometry(0.3 + (i % 4) * 0.17, 12),
          0x91432f,
          Math.cos(a) * r * 1.005,
          y,
          Math.sin(a) * r * 1.005,
        );
        crater.lookAt(crater.position.clone().multiplyScalar(2));
      }
    } else {
      const continents = [
        [
          [-165, 65],
          [-130, 72],
          [-60, 52],
          [-82, 10],
          [-110, 26],
          [-128, 50],
        ],
        [
          [-80, 10],
          [-36, -6],
          [-50, -30],
          [-70, -55],
          [-78, -20],
        ],
        [
          [-18, 35],
          [32, 32],
          [51, 10],
          [25, -34],
          [8, -22],
          [-15, 10],
        ],
        [
          [-10, 36],
          [10, 66],
          [80, 72],
          [160, 55],
          [126, 8],
          [70, 20],
          [45, 40],
        ],
        [
          [112, -12],
          [153, -15],
          [153, -36],
          [115, -35],
        ],
      ];
      const point = (lon: number, lat: number) => {
        const a = (lon * Math.PI) / 180,
          b = (lat * Math.PI) / 180;
        return V(
          Math.cos(b) * Math.sin(a) * 6.04,
          Math.sin(b) * 6.04,
          Math.cos(b) * Math.cos(a) * 6.04,
        );
      };
      for (const outline of continents) {
        const center = outline.reduce(
          (p, c) => [
            p[0] + c[0] / outline.length,
            p[1] + c[1] / outline.length,
          ],
          [0, 0],
        );
        const vertices: number[] = [];
        for (let i = 0; i < outline.length; i++) {
          const a = point(...(center as [number, number])),
            b = point(...(outline[i] as [number, number])),
            c = point(
              ...(outline[(i + 1) % outline.length] as [number, number]),
            );
          const surface = (u: number, v: number) =>
            a
              .clone()
              .multiplyScalar(1 - u - v)
              .addScaledVector(b, u)
              .addScaledVector(c, v)
              .normalize()
              .multiplyScalar(6.045);
          const n = 14;
          for (let j = 0; j < n; j++)
            for (let k = 0; k < n - j; k++) {
              vertices.push(
                ...surface(j / n, k / n).toArray(),
                ...surface((j + 1) / n, k / n).toArray(),
                ...surface(j / n, (k + 1) / n).toArray(),
              );
              if (j + k < n - 1)
                vertices.push(
                  ...surface((j + 1) / n, k / n).toArray(),
                  ...surface((j + 1) / n, (k + 1) / n).toArray(),
                  ...surface(j / n, (k + 1) / n).toArray(),
                );
            }
        }
        const geo = new T.BufferGeometry();
        geo.setAttribute("position", new T.Float32BufferAttribute(vertices, 3));
        geo.computeVertexNormals();
        mesh(g, geo, 0x8dbb87, 0, 0, 0, { side: T.DoubleSide });
      }
    }
    mesh(
      g,
      new T.SphereGeometry(6.12, 32, 20),
      mars ? 0xe1a47a : 0x7ed7f5,
      0,
      0,
      0,
      { transparent: true, opacity: 0.09, side: T.BackSide, depthWrite: false },
    );
    return g;
  }
  private onClick = (event: MouseEvent) => {
    const action = (event.target as HTMLElement).closest<HTMLElement>(
      "[data-arrival]",
    )?.dataset.arrival;
    if (action === "skip") this.complete();
    if (action === "pause") this.togglePause();
    if (action === "motion") {
      this.reduced = !this.reduced;
      this.updateControls();
    }
    if (action === "next") this.next();
    if (action === "previous") {
      this.elapsed = arrivalStory
        .slice(0, Math.max(0, this.chapter - 1))
        .reduce((n, s) => n + s.duration, 0);
      this.update(0);
    }
    if (action === "sound") {
      this.filmMuted = !this.filmMuted;
      this.filmBus?.gain.setTargetAtTime(
        this.filmMuted ? 0 : this.filmVolume,
        this.filmBus.context.currentTime,
        0.05,
      );
      this.voice.muted = this.filmMuted;
      this.updateControls();
      if (!this.paused && !document.hidden && !this.voice.ended)
        void this.voice.play().catch(() => {});
    }
  };
  togglePause() {
    this.paused = !this.paused;
    this.visibilityChange();
    this.updateControls();
  }
  next() {
    this.elapsed = arrivalStory
      .slice(0, this.chapter + 1)
      .reduce((n, s) => n + s.duration, 0);
    this.update(0);
  }
  complete() {
    if (this.done) return;
    this.done = true;
    this.finish();
  }
  private updateControls() {
    this.element.querySelector('[data-arrival="sound"]')!.textContent = this
      .filmMuted
      ? "Sound: off"
      : "Sound: on";
    this.element.querySelector('[data-arrival="pause"]')!.textContent = this
      .paused
      ? "Play"
      : "Pause";
    this.element.querySelector('[data-arrival="motion"]')!.textContent = this
      .reduced
      ? "Motion: gentle"
      : "Motion: full";
  }
  private startAudio(audio: {
    context: AudioContext | null;
    master: GainNode | null;
  }) {
    const { context: ctx } = audio;
    if (!ctx) return;
    const master = (this.filmBus = ctx.createGain());
    master.gain.value = this.filmMuted ? 0 : this.filmVolume;
    master.connect(ctx.destination);
    this.voiceSource = ctx.createMediaElementSource(this.voice);
    this.voiceSource.connect(master);
    this.soundGain = ctx.createGain();
    this.soundGain.gain.value = 0.045;
    this.soundGain.connect(master);
    for (const frequency of [110, 165]) {
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.value = frequency;
      o.connect(this.soundGain);
      o.start();
      this.soundSources.push(o);
      this.score.push(o);
    }
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate),
      data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 320;
    this.noiseGain = ctx.createGain();
    this.noiseGain.gain.value = 0;
    noise.connect(filter);
    filter.connect(this.noiseGain);
    this.noiseGain.connect(this.soundGain);
    noise.start();
    this.soundSources.push(noise);
  }
  update(dt: number, render = true) {
    if (this.done) return;
    const running = !this.paused && !document.hidden;
    if (running) this.elapsed += dt;
    if (this.elapsed >= arrivalDuration) {
      this.complete();
      return;
    }
    let local = this.elapsed,
      index = 0;
    while (local >= arrivalStory[index].duration)
      local -= arrivalStory[index++].duration;
    const shot = arrivalStory[index],
      u = local / shot.duration;
    const caption = u < 0.5 ? 0 : 1;
    if (index !== this.chapter) {
      this.chapter = index;
      this.element.dataset.shot = shot.key;
      this.element.querySelector("[data-place]")!.textContent = shot.place;
      this.element.querySelector("[data-title]")!.textContent = shot.title;
      this.element.querySelector("[data-chapter]")!.textContent =
        `${String(index + 1).padStart(2, "0")} / ${arrivalStory.length}`;
      this.element.querySelector("[data-fact]")!.textContent = shot.fact;
      this.element.querySelector("[data-status]")!.textContent = shot.status;
      this.element.querySelector("[data-act]")!.textContent = shot.act;
      this.score.forEach((o, i) =>
        o.frequency.setTargetAtTime(
          (["entry", "rattle", "braking", "touchdown"].includes(shot.view)
            ? 82.41
            : index > 18
              ? 130.81
              : 110) * (i ? 1.5 : 1),
          o.context.currentTime,
          1.2,
        ),
      );
      this.captionIndex = -1;
    }
    if (caption !== this.captionIndex) {
      this.element.querySelector("[data-caption]")!.textContent =
        shot.lines[caption];
      this.captionIndex = caption;
      this.voice.pause();
      this.voice.src = `${import.meta.env.BASE_URL}film/${shot.key}-${caption}.wav`;
      this.voice.muted = this.filmMuted;
      if (running) void this.voice.play().catch(() => {});
    }
    const remaining = Math.max(0, Math.ceil(arrivalDuration - this.elapsed));
    this.element.querySelector("[data-time]")!.textContent =
      `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")} LEFT`;
    this.element.style.setProperty(
      "--cut",
      String(
        this.reduced
          ? 0
          : Math.max(0, 1 - local / 0.4, 1 - (shot.duration - local) / 0.35),
      ),
    );
    this.element.style.setProperty(
      "--title-opacity",
      String(this.reduced ? 1 : 1 - smooth((local - 3) / 1.5) * 0.75),
    );
    this.element.dataset.view = shot.view;
    const telemetry =
      this.element.querySelector<HTMLElement>("[data-telemetry]")!;
    telemetry.textContent =
      shot.view === "countdown"
        ? u < 0.5
          ? "ALL SYSTEMS\nGO"
          : `T − ${Math.max(0, Math.ceil((1 - u) * 10))}`
        : ["entry", "parachute", "braking"].includes(shot.view)
          ? `${shot.view === "entry" ? "THERMAL SHIELD" : shot.view === "parachute" ? "DESCENT SYSTEM" : "BACKUP THRUST"}\n${shot.view === "braking" ? "FAULT DETECTED" : "TRACKING"}`
          : "";
    this.element
      .querySelectorAll<HTMLElement>(".arrival-timeline b")
      .forEach(
        (bar, i) =>
          (bar.style.transform = `scaleX(${i < index ? 1 : i === index ? u : 0})`),
      );
    if (this.soundGain)
      this.soundGain.gain.setTargetAtTime(
        running ? (shot.key === "silence" ? 0.008 : 0.045) : 0,
        this.soundGain.context.currentTime,
        0.15,
      );
    if (this.noiseGain)
      this.noiseGain.gain.setTargetAtTime(
        ["launch", "entry", "rattle", "braking", "touchdown"].includes(
          shot.view,
        )
          ? 1.2
          : 0.04,
        this.noiseGain.context.currentTime,
        0.3,
      );
    if (
      running &&
      this.filmBus &&
      Math.floor(this.elapsed / 2) !== this.lastBeat
    ) {
      this.lastBeat = Math.floor(this.elapsed / 2);
      const ctx = this.filmBus.context as AudioContext,
        osc = ctx.createOscillator(),
        gain = ctx.createGain();
      osc.frequency.value = [196, 261.63, 293.66, 220][this.lastBeat % 4];
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(
        shot.key === "silence" ? 0 : 0.025,
        ctx.currentTime + 0.02,
      );
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.4);
      osc.connect(gain);
      gain.connect(this.filmBus);
      osc.start();
      osc.stop(ctx.currentTime + 1.5);
      osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
      };
    }
    if (render)
      this.render(shot.view, this.reduced ? 0.55 : u, local, shot.key);
  }
  private render(key: string, u: number, time: number, shot: string) {
    this.pad.visible = ["boarding", "launch", "padwide"].includes(key);
    this.cabin.visible = key === "cabin" || key === "rattle";
    this.prep.visible = key === "prep";
    this.control.visible = ["control", "countdown"].includes(key);
    this.lab.visible = key === "lab";
    this.space.visible = ["cruise", "orbit", "mars"].includes(key);
    this.descent.visible =
      ["entry", "parachute", "braking"].includes(key) && !this.cabin.visible;
    this.surface.visible = [
      "braking",
      "touchdown",
      "egress",
      "aftermath",
      "steps",
      "resolve",
      "frontier",
    ].includes(key);
    this.wreck.visible = this.surface.visible && key !== "braking";
    this.explorer.visible = ["egress", "steps", "resolve", "frontier"].includes(
      key,
    );
    this.ladder.visible = ["egress", "steps", "resolve", "frontier"].includes(
      key,
    );
    this.crewOutside.forEach(
      (a) => (a.visible = ["steps", "resolve", "frontier"].includes(key)),
    );
    this.footprints.forEach(
      (p, i) =>
        (p.visible =
          ["resolve", "frontier"].includes(key) ||
          (key === "steps" && i < u * 18)),
    );
    this.scene.background = new T.Color(
      this.space.visible
        ? 0x060d1c
        : this.pad.visible
          ? 0x6e9da8
          : this.cabin.visible ||
              this.prep.visible ||
              this.control.visible ||
              this.lab.visible
            ? 0x091722
            : 0xc89471,
    );
    this.scene.fog =
      this.space.visible ||
      this.cabin.visible ||
      this.prep.visible ||
      this.control.visible ||
      this.lab.visible
        ? null
        : new T.Fog(this.pad.visible ? 0x6e9da8 : 0xc89471, 45, 140);
    this.lamp.intensity = this.cabin.visible ? 1.4 : 3.2;
    const cinematicTime = this.reduced ? 0 : time;
    const camera = (a: number[], b: number[], target: number[]) => {
      this.camera.position.lerpVectors(
        new T.Vector3(...(a as [number, number, number])),
        new T.Vector3(...(b as [number, number, number])),
        smooth(u),
      );
      this.camera.lookAt(
        new T.Vector3(...(target as [number, number, number])),
      );
    };
    if (key === "prep") {
      this.prepCrew.forEach((a, i) => {
        a.getObjectByName("armR")!.rotation.x =
          -1.1 + Math.sin(cinematicTime * 1.2 + i) * 0.18;
        a.getObjectByName("elbowR")!.rotation.x = -0.7;
        a.getObjectByName("head")!.rotation.y =
          Math.sin(cinematicTime * 0.5 + i) * 0.16;
      });
      camera([5.5, 3.2, 8], [-3.8, 2.4, 5.5], [0, 1.4, 0]);
    }
    if (this.control.visible) {
      this.controlGlobe.rotation.y = cinematicTime * 0.15;
      this.controllers.forEach((actor, i) => {
        actor.getObjectByName("head")!.rotation.y =
          Math.sin(cinematicTime * 0.65 + i) * 0.28;
        actor.getObjectByName("armR")!.rotation.x =
          -0.8 + Math.sin(cinematicTime * 2.4 + i) * 0.14;
        actor.getObjectByName("armL")!.rotation.x =
          -0.8 + Math.sin(cinematicTime * 1.8 + i) * 0.1;
      });
      camera(
        key === "countdown" ? [5, 5, 5] : [11, 6, 12],
        [3, 4, 6],
        [0, 2.8, -2],
      );
    }
    if (key === "lab") {
      this.scientist.position.y = 0.25 + Math.sin(cinematicTime * 0.7) * 0.09;
      this.scientist.getObjectByName("armR")!.rotation.x = -1.2;
      this.floatingTools.forEach((t, i) => {
        t.rotation.z = cinematicTime * 0.15 + i;
        t.position.y = 2.8 + Math.sin(cinematicTime + i) * 0.12;
      });
      camera([6, 4, 7], [-3.8, 2.6, 5.4], [0, 1.8, 0]);
    }
    if (key === "padwide") {
      this.rocket.position.set(0, 0, 0);
      this.booster.position.y = 0;
      this.launchFlame.visible = false;
      this.boarder.visible = false;
      camera([30, 13, 35], [21, 12, 28], [-1, 5, 0]);
    }
    if (key === "boarding") {
      this.rocket.position.set(0, 0, 0);
      this.booster.position.y = 0;
      this.launchFlame.visible = false;
      this.boardingDoor.rotation.y = 1.9;
      this.boarder.visible = u < 0.88;
      this.boarder.position.set(
        mix(-6.7, -0.1, smooth(u / 0.85)),
        7.2,
        mix(2, 0.85, smooth((u - 0.72) / 0.18)),
      );
      this.boarder.rotation.y = u < 0.7 ? Math.PI / 2 : Math.PI;
      walk(this.boarder, cinematicTime, true);
      camera([9, 10, 17], [5, 9, 12], [-1.8, 7.9, 1]);
    }
    if (this.cabin.visible) {
      this.hatch.rotation.y = key === "cabin" ? mix(-1.6, 0, smooth(u * 3)) : 0;
      this.harness.visible = true;
      this.harness.scale.y = key === "cabin" ? 0.1 + 0.9 * smooth(u * 3) : 1;
      this.seated.getObjectByName("head")!.rotation.y =
        Math.sin(cinematicTime * 0.65) * 0.16;
      this.alarm.intensity = key === "rattle" ? 2.5 : 0;
      for (const name of ["armL", "armR"])
        this.seated.getObjectByName(name)!.rotation.x = -0.9;
      camera([3.2, 3.1, 8], [1.2, 2.9, 6], [-0.1, 1.9, 0]);
      if (key === "rattle" && !this.reduced) {
        this.camera.position.x += Math.sin(time * 43) * 0.045;
        this.camera.position.y += Math.sin(time * 37) * 0.027;
        this.camera.rotateZ(Math.sin(time * 29) * 0.009);
      }
    }
    if (key === "launch") {
      this.boardingDoor.rotation.y = 0;
      this.boarder.visible = false;
      this.launchFlame.visible = true;
      this.rocket.position.y = mix(0, 33, u * u);
      this.booster.position.y = u > 0.65 ? -smooth((u - 0.65) / 0.35) * 13 : 0;
      this.launchFlame.scale.set(
        1,
        1 + (this.reduced ? 0 : Math.sin(time * 31) * 0.12),
        1,
      );
      camera(
        [16, 9 + this.rocket.position.y, 24],
        [23, 13 + this.rocket.position.y, 30],
        [0, this.rocket.position.y + 6, 0],
      );
      if (shot === "separation") {
        this.rocket.position.y = 40 + u * 8;
        this.booster.position.y = -1 - u * 13;
        camera([10, 47 + u * 8, 18], [7, 51 + u * 8, 15], [0, 46 + u * 8, 0]);
      }
    }
    this.smoke.forEach((p, i) => {
      p.visible = key === "launch";
      const a = i * 2.4,
        r = 1 + u * 12 + (i % 5);
      p.position.set(Math.cos(a) * r, 0.2 + (i % 3) * 0.4, Math.sin(a) * r);
      p.scale.setScalar(0.7 + u * 2 + (i % 3) * 0.3);
    });
    this.earth.visible = key !== "mars";
    this.mars.visible = key !== "orbit";
    this.ship.visible = key !== "orbit" || shot === "orbit";
    if (["cruise", "orbit", "mars"].includes(key)) {
      this.ship.position.set(mix(-3, 3, u), 0.4, 0);
      this.ship.rotation.x = 0.2 + Math.sin(cinematicTime * 0.5) * 0.06;
      this.ship.rotation.z =
        -Math.PI / 2 + Math.sin(cinematicTime * 0.4) * 0.08;
      this.ship.position.y += Math.sin(cinematicTime * 0.65) * 0.18;
      this.earth.rotation.y = -0.8 + u * 0.2;
      this.mars.rotation.y = u * 0.1;
      camera([9, 8, 27], [6, 5, 24], [0, 1, -5]);
      this.earth.position.set(-10, 1, -15);
      this.earth.scale.setScalar(0.65);
      this.mars.position.set(9, 2, -12);
      this.mars.scale.setScalar(0.55);
      if (key === "orbit") {
        this.earth.position.set(-4, -2, -10);
        this.earth.scale.setScalar(1.2);
        camera([11, 7, 15], [7, 4, 12], [-3, 0, -9]);
        this.ship.position.set(4 + u * 2, 2, 0);
      }
      if (key === "mars") {
        this.mars.position.set(3, 0, -10);
        this.mars.scale.setScalar(1.2);
        this.ship.position.set(-3 + u * 2, 1, 0);
        camera([10, 6, 20], [8, 3, 14], [2, 0, -7]);
      }
    }
    this.jets.forEach((j) => {
      j.visible = key === "braking";
      j.scale.y = 1 + Math.sin(cinematicTime * 24) * 0.15;
    });
    this.chute.visible = key === "parachute";
    this.shield.visible = key === "entry" || key === "parachute";
    const gear = this.lander.getObjectByName("landing-gear")!;
    gear.visible = key === "braking" || (key === "parachute" && u > 0.7);
    gear.scale.setScalar(key === "parachute" ? smooth((u - 0.7) / 0.25) : 1);
    if (key === "entry" && !this.cabin.visible) {
      this.lander.position.set(0, 0, 0);
      this.lander.rotation.z = 0.32 + Math.sin(cinematicTime * 2.1) * 0.035;
      this.lander.position.y = -u * 2;
      this.lander.position.x = u * 3;
      this.shield.position.set(
        this.lander.position.x + 0.2,
        this.lander.position.y - 0.7,
        0,
      );
      this.shield.material.emissiveIntensity =
        1.7 + Math.sin(cinematicTime * 9) * 0.3;
      camera([8, 3, 16], [6, 2, 12], [0, 0.5, 0]);
      if (!this.reduced) this.camera.rotateZ(Math.sin(time * 19) * 0.006);
    }
    if (key === "parachute") {
      this.lander.position.set(0, 0, 0);
      this.lander.rotation.z = Math.sin(cinematicTime * 1.4) * 0.075;
      this.lander.position.y = -u * 3;
      this.chute.rotation.z = Math.sin(cinematicTime * 1.4 - 0.3) * 0.035;
      this.chute.position.copy(this.lander.position);
      this.chute.scale.setScalar(0.15 + 0.85 * smooth(u * 4));
      this.shield.position.set(
        u * 3,
        this.lander.position.y - 0.7 - smooth((u - 0.35) / 0.65) * 14,
        0,
      );
      this.shield.material.emissiveIntensity = 0;
      camera([18, 10, 32], [17, 10, 30], [0, 5, 0]);
    }
    if (key === "braking") {
      this.lander.position.set(mix(-4, 0, u), mix(11, 2, u), 0);
      this.lander.rotation.z = -smooth((u - 0.35) / 0.65) * 0.45;
      this.jets[0].visible = u < 0.4;
      this.jets[1].scale.y = 1.2 + Math.sin(cinematicTime * 22) * 0.2;
      camera([15, 10, 23], [10, 6, 18], [0, 4, -1]);
    }
    if (key === "touchdown") {
      this.wreck.position.set(
        mix(-2, 0, smooth(u * 2)),
        mix(2, 1.2, smooth(u * 3)),
        0,
      );
      this.wreck.rotation.z = mix(-0.45, -0.9, smooth((u - 0.1) * 3));
      this.exitHatch.rotation.y = 0;
      camera([12, 5, 21], [10, 4, 18], [1, 1, -1]);
      if (!this.reduced && u < 0.35) {
        const strength = (1 - u / 0.35) * 0.12;
        this.camera.position.x += Math.sin(time * 45) * strength;
      }
    }
    if (key === "egress") {
      this.wreck.position.set(0, 1.2, 0);
      this.wreck.rotation.z = -0.9;
      this.exitHatch.rotation.y = -smooth(u * 4) * 1.7;
      this.ladder.rotation.x = mix(-0.9, 0, smooth((u - 0.1) / 0.18));
      const climb = smooth((u - 0.22) / 0.42),
        travel = smooth((u - 0.65) / 0.35);
      this.explorer.visible = u > 0.22;
      this.explorer.position.set(
        0.5 + travel * 1.5,
        mix(1.6, 0, climb),
        mix(1.5, 3.3, climb) + travel * 1.1,
      );
      this.explorer.rotation.y = climb < 0.95 ? Math.PI : 0.25;
      walk(this.explorer, cinematicTime, u > 0.25 && u < 0.95);
      camera([7, 4, 12], [12, 7, 17], [1, 1.3, 0]);
    }
    if (["aftermath", "steps", "resolve", "frontier"].includes(key)) {
      this.wreck.position.set(0, 1.2, 0);
      this.wreck.rotation.z = -0.9;
      this.exitHatch.rotation.y = key === "aftermath" ? 0 : -1.7;
      this.ladder.rotation.x = 0;
      this.explorer.position.set(2.2, 0, key === "steps" ? 3.8 + u * 5 : 8.5);
      this.explorer.rotation.y = key === "steps" ? 0 : Math.PI * 0.6;
      walk(this.explorer, cinematicTime, key === "steps");
      this.explorer.getObjectByName("head")!.rotation.y =
        key === "steps" ? 0 : Math.sin(cinematicTime * 0.65) * 0.25;
      this.crewOutside.forEach((actor, i) => {
        actor.getObjectByName("head")!.rotation.y =
          Math.sin(cinematicTime * 0.55 + i) * 0.22;
        actor.getObjectByName("armR")!.rotation.x =
          -0.3 + Math.sin(cinematicTime * 1.2 + i) * 0.2;
      });
      if (key === "aftermath") camera([16, 4, 21], [10, 3, 15], [1, 1.5, 0]);
      else if (key === "steps")
        camera([6, 1.8, 12], [8, 2.5, 15], [2, 1, 5 + u * 2]);
      else camera([11, 4.5, 17], [16, 8, 25], [2, 1.4, 3]);
      if (key === "frontier" && this.landscape?.terrain.ready) {
        const x = mix(-70, 230, u),
          z = mix(-50, -200, u),
          h = this.landscape.terrain.heightAt(x, z);
        camera([x + 40, h + 45, z + 70], [x + 25, h + 55, z + 50], [x, h, z]);
      }
    }
    this.airStreaks.forEach((streak, i) => {
      streak.visible =
        !this.reduced && ["entry", "parachute", "braking"].includes(key);
      const speed = key === "entry" ? 18 : 5;
      streak.position.y = ((i * 1.73 + cinematicTime * speed) % 24) - 8;
      streak.scale.y = key === "entry" ? 2.2 : 0.65;
    });
    this.dust.forEach((p, i) => {
      p.visible = key === "touchdown" || key === "braking";
      const a = i * 2.4,
        r = (key === "braking" ? u : Math.min(1, u * 2)) * 8 + (i % 4) * 0.3;
      p.position.set(Math.cos(a) * r, 0.3 + (i % 5) * 0.24, Math.sin(a) * r);
      p.scale.setScalar(0.5 + r * 0.18);
      p.material.opacity = key === "touchdown" ? 0.5 * (1 - u) : 0.18 * u;
    });
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.fov = innerWidth < 650 ? 62 : 44;
    this.camera.updateProjectionMatrix();
    // Raise the composition above the subtitle band without distorting the view.
    this.camera.setViewOffset(
      innerWidth,
      innerHeight,
      0,
      innerHeight * 0.075,
      innerWidth,
      innerHeight,
    );
    this.renderer.render(
      key === "frontier" && this.landscape?.terrain.ready
        ? this.landscape.scene
        : this.scene,
      this.camera,
    );
  }
  dispose() {
    this.done = true;
    this.media.removeEventListener("change", this.motionChange);
    document.removeEventListener("visibilitychange", this.visibilityChange);
    this.voice.pause();
    this.voice.removeAttribute("src");
    this.voice.load();
    this.voiceSource?.disconnect();
    this.filmBus?.disconnect();
    this.element.removeEventListener("click", this.onClick);
    const geometries = new Set<T.BufferGeometry>(),
      materials = new Set<T.Material>();
    this.scene.traverse((o) => {
      o.userData.marsDisposed = true;
      if (o instanceof T.Mesh || o instanceof T.Points) {
        if (!o.geometry.userData.marsShared) geometries.add(o.geometry);
        for (const m of Array.isArray(o.material) ? o.material : [o.material])
          materials.add(m);
      }
    });
    geometries.forEach((g) => g.dispose());
    materials.forEach((m) => m.dispose());
    for (const source of this.soundSources) {
      source.stop();
      source.disconnect();
    }
    this.noiseGain?.disconnect();
    this.soundGain?.disconnect();
    document.querySelector<HTMLElement>("#labels")!.hidden = false;
    this.element.remove();
  }
  get state() {
    return {
      chapter: this.chapter,
      shot: arrivalStory[Math.max(0, this.chapter)].key,
      duration: arrivalStory[Math.max(0, this.chapter)].duration,
      elapsed: this.elapsed,
      paused: this.paused,
      reduced: this.reduced,
      camera: this.camera.position.toArray(),
      spacecraft: this.ship.position.toArray(),
    };
  }
}
