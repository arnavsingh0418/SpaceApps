import assert from "node:assert/strict";
import { WebSocket } from "ws";
import { salvageSites, launchSite } from "../shared/src/returnMission";
import type { Game, Action } from "../shared/src/sim";
const url = process.env.TEST_SERVER || "ws://127.0.0.1:2572";
class Client {
  ws = new WebSocket(url);
  id = "";
  room = "";
  state: Game | null = null;
  error = "";
  constructor() {
    this.ws.on("message", (raw) => {
      const m = JSON.parse(raw.toString());
      if (m.type === "welcome") {
        this.id = m.id;
        this.room = m.room;
      }
      if (m.type === "state") this.state = m.state;
      if (m.type === "error") this.error = m.message;
    });
  }
  async ready() {
    await new Promise<void>((resolve, reject) => {
      this.ws.once("open", resolve);
      this.ws.once("error", reject);
    });
  }
  send(value: object) {
    this.ws.send(JSON.stringify(value));
  }
  action(a: Action) {
    this.send({ type: "action", action: a });
  }
  async until(check: () => boolean, label: string) {
    const end = Date.now() + 10000;
    while (!check()) {
      if (Date.now() > end) throw Error(`${label}: ${this.error}`);
      await new Promise((r) => setTimeout(r, 25));
    }
  }
  async walk(x: number, z: number) {
    for (let guard = 0; guard < 500; guard++) {
      const p = this.state!.players[this.id],
        dx = x - p.x,
        dz = z - p.z,
        d = Math.hypot(dx, dz);
      if (d < 0.1) return;
      const step = Math.min(2, d),
        nx = p.x + (dx / d) * step,
        nz = p.z + (dz / d) * step;
      this.action({ type: "pos", x: nx, z: nz, mx: 0, mz: 0, gait: "walk" });
      await this.until(
        () =>
          Math.hypot(
            this.state!.players[this.id].x - nx,
            this.state!.players[this.id].z - nz,
          ) < 0.1,
        "walk report",
      );
    }
    throw Error("walk limit");
  }
  async collect(kind: string) {
    const item = this.state!.items.find((i) => i.kind === kind)!;
    await this.walk(item.x, item.z);
    this.action({ type: "pick", target: item.id });
    await this.until(
      () =>
        (this.state!.players[this.id].bag as Record<string, number>)[kind] > 0,
      `pick ${kind}`,
    );
  }
}
const a = new Client(),
  b = new Client();
const heartbeat = setInterval(() => {
  for (const c of [a, b])
    if (c.ws.readyState === WebSocket.OPEN) c.send({ type: "ping" });
}, 5000);
async function deckWalk(c: Client, x: number, z: number) {
  for (const [axis, target] of [
    ["x", x],
    ["z", z],
  ] as const) {
    for (let guard = 0; guard < 160; guard++) {
      const d = target - c.state!.players[c.id][axis];
      if (Math.abs(d) < 0.45) break;
      c.action({
        type: "flightMove",
        x: axis === "x" ? Math.sign(d) : 0,
        z: axis === "z" ? Math.sign(d) : 0,
      });
      await new Promise((r) => setTimeout(r, 80));
    }
    c.action({ type: "flightMove", x: 0, z: 0 });
    await new Promise((r) => setTimeout(r, 150));
    assert.ok(
      Math.abs(target - c.state!.players[c.id][axis]) < 0.7,
      "physical deck travel",
    );
  }
}
try {
  await Promise.all([a.ready(), b.ready()]);
  a.send({ type: "create", name: "Pilot", seed: 42 });
  await a.until(() => !!a.state, "create");
  b.send({ type: "join", name: "Engineer", code: a.room });
  await b.until(() => !!b.state, "join");
  a.action({ type: "power", value: { air: 4, light: 3, radio: 3, heat: 1 } });
  await a.until(() => a.state!.phase === "day", "day");
  for (const site of salvageSites) {
    await a.walk(site.x, site.z);
    a.action({ type: "startSalvage", site: site.id });
    await a.until(() => !!a.state!.returnMission?.caches[site.id], "salvage");
    for (let step = 0; step < site.questions.length; step++) {
      a.action({
        type: "salvageAnswer",
        site: site.id,
        step,
        answer: site.questions[step].correct,
      });
      await a.until(
        () => a.state!.returnMission!.caches[site.id].step > step,
        "quiz",
      );
    }
  }
  await a.walk(launchSite.x, launchSite.z);
  for (const part of ["booster", "hull", "nav", "air"])
    a.action({ type: "installPart", part });
  await a.until(
    () => Object.keys(a.state!.returnMission!.installed).length === 4,
    "installed",
  );
  a.action({ type: "launchShip" });
  await a.until(
    () => a.state!.phase === "flight",
    `host launch (${a.state!.phase}, elapsed ${a.state!.elapsed})`,
  );
  await b.until(() => b.state!.phase === "flight", "shared launch");
  await deckWalk(a, 0, -8);
  await deckWalk(b, 1.35, 0);
  await deckWalk(b, -8, 0);
  a.action({ type: "takeHelm" });
  await b.until(
    () => b.state!.returnMission!.flight!.deck!.pilot === a.id,
    "shared helm",
  );
  b.action({ type: "takeHelm" });
  await b.until(() => !!b.error, "reject remote helm");
  assert.match(b.error, /helm/);
  // Steer from authoritative feedback rather than assuming wall time equals server ticks.
  for (let i = 0; i < 40; i++) {
    const course = a.state!.returnMission!.flight!.deck!.course;
    if (Math.hypot(course.x, course.y) < 0.12) break;
    const horizontal = Math.abs(course.x) > Math.abs(course.y);
    a.action({
      type: "flightSteer",
      x: horizontal ? -Math.sign(course.x) : 0,
      y: horizontal ? 0 : -Math.sign(course.y),
    });
    await new Promise((r) => setTimeout(r, 120));
  }
  a.action({ type: "flightSteer", x: 0, y: 0 });
  a.action({ type: "holdCourse" });
  await a.until(
    () => a.state!.returnMission!.flight!.deck!.guidance[0],
    "departure lock",
  );
  const wait = Date.now() + 25000;
  while (!b.state!.returnMission!.flight!.deck!.incidents.length) {
    assert.ok(Date.now() < wait, "first timed failure");
    await new Promise((r) => setTimeout(r, 100));
  }
  const fault = b.state!.returnMission!.flight!.deck!.incidents[0];
  b.action({ type: "beginFlightRepair", fault: fault.id });
  await b.until(
    () => b.state!.players[b.id].task?.kind === "flightRepair",
    "repair starts",
  );
  const repairAt = b.state!.players[b.id].task!.at;
  await b.until(
    () => b.state!.elapsed - repairAt >= 3.1,
    "server repair duration",
  );
  b.action({ type: "finishFlightRepair", fault: fault.id, value: "0,1,2" });
  await b.until(
    () => b.state!.returnMission!.flight!.deck!.repaired === 1,
    "engineer repair confirmation",
  );
  await a.until(
    () => a.state!.returnMission!.flight!.deck!.repaired === 1,
    "shared repair",
  );
  assert.equal(
    a.state!.returnMission!.flight!.deck!.incidents[0].repairedBy,
    b.id,
  );
  assert.equal(a.state!.returnMission!.crewPoints[b.id], 150);
  assert.equal(a.state!.returnMission!.flight!.deck!.pilot, a.id);
  console.log(
    "PASS: two WebSocket clients salvage, install, launch, walk inside, steer and repair concurrently with shared ownership and credit.",
  );
} finally {
  clearInterval(heartbeat);
  a.ws.close();
  b.ws.close();
}
