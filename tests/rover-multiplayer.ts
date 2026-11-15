import assert from "node:assert/strict";
import { WebSocket } from "ws";
import type { Game } from "../shared/src/sim";
import { roverState, roverExits, ROVER } from "../shared/src/rover";
class Client {
  ws = new WebSocket(process.env.TEST_SERVER || "ws://localhost:2567");
  id = "";
  room = "";
  state: Game | null = null;
  error = "";
  constructor() {
    this.ws.on("message", (b) => {
      const m = JSON.parse(b.toString());
      if (m.type === "welcome") {
        this.id = m.id;
        this.room = m.room;
      }
      if (m.type === "state") this.state = m.state;
      if (m.type === "error") this.error = m.message;
    });
  }
  ready() {
    return new Promise<void>((resolve, reject) => {
      this.ws.once("open", resolve);
      this.ws.once("error", reject);
    });
  }
  send(m: object) {
    this.ws.send(JSON.stringify(m));
  }
  action(a: object) {
    this.send({ type: "action", action: a });
  }
  async until(condition: () => boolean, label: string) {
    const end = Date.now() + 9000;
    while (!condition()) {
      if (Date.now() > end) throw Error(`Timed out: ${label} ${this.error}`);
      await new Promise((r) => setTimeout(r, 30));
    }
  }
}
const clients: Client[] = [];
try {
  const a = new Client();
  clients.push(a);
  await a.ready();
  a.send({ type: "create", name: "Rover A", seed: 420 });
  await a.until(() => !!a.state && !!a.id, "create");
  const b = new Client();
  clients.push(b);
  await b.ready();
  b.send({ type: "join", name: "Rover B", code: a.room });
  await b.until(() => !!b.id && !!b.state, "join");
  a.action({ type: "power", value: { air: 4, light: 3, radio: 0, heat: 1 } });
  await b.until(() => b.state?.phase === "day", "explore");
  await Promise.all(
    [a, b].map(async (c, index) => {
      // Approach separate boarding positions so the newly added crew collision
      // does not let the first arrival physically block the second explorer.
      const target = { x: ROVER.spawn.x + (index === 0 ? -3 : 3), z: ROVER.spawn.z };
      const p = c.state!.players[c.id],
        dx = target.x - p.x,
        dz = target.z - p.z,
        d = Math.hypot(dx, dz);
      c.action({ type: "move", x: dx / d, z: dz / d });
      await c.until(
        () =>
          Math.hypot(
            c.state!.players[c.id].x - target.x,
            c.state!.players[c.id].z - target.z,
          ) < .8,
        "walk to rover",
      );
      c.action({ type: "move", x: 0, z: 0 });
    }),
  );
  a.action({ type: "boardRover" });
  b.action({ type: "boardRover" });
  await a.until(
    () => roverState(a.state!).passengers.length === 1,
    "boarding race",
  );
  await b.until(
    () => roverState(b.state!).passengers.length === 1,
    "seat broadcast",
  );
  const driver = roverState(a.state!).driver === a.id ? a : b,
    passenger = driver === a ? b : a;
  assert.equal(roverState(passenger.state!).driver, driver.id);
  const start = { ...roverState(driver.state!) };
  passenger.action({
    type: "driveRover",
    x: start.x + 2,
    z: start.z,
    heading: 0,
    speed: 10,
  });
  await passenger.until(
    () => /driver/.test(passenger.error),
    "reject passenger steering",
  );
  driver.action({
    type: "driveRover",
    x: start.x,
    z: start.z - 1,
    heading: 0,
    speed: 5,
  });
  await passenger.until(
    () => roverState(passenger.state!).z < start.z - 0.7,
    "shared transport",
  );
  const riding = roverState(passenger.state!);
  assert.equal(passenger.state!.players[passenger.id].z, riding.z);
  assert.equal(passenger.state!.players[driver.id].z, riding.z);
  passenger.error = "";
  passenger.action({ type: "exitRover", ...roverExits(riding)[0] });
  await passenger.until(
    () => /stop/.test(passenger.error),
    "no moving dismount",
  );
  driver.action({
    type: "driveRover",
    x: riding.x,
    z: riding.z,
    heading: riding.heading,
    speed: 0,
  });
  await passenger.until(() => roverState(passenger.state!).speed === 0, "park");
  driver.ws.close();
  await passenger.until(
    () => !roverState(passenger.state!).driver,
    "disconnect releases wheel",
  );
  passenger.action({ type: "takeRover" });
  await passenger.until(
    () => roverState(passenger.state!).driver === passenger.id,
    "passenger takes wheel",
  );
  const parked = { ...roverState(passenger.state!) };
  passenger.action({ type: "exitRover", ...roverExits(parked)[0] });
  await passenger.until(
    () =>
      !roverState(passenger.state!).driver &&
      !roverState(passenger.state!).passengers.length,
    "dismount",
  );
  assert.equal(roverState(passenger.state!).z, parked.z);
  assert.notEqual(passenger.state!.players[passenger.id].x, parked.x);
  console.log(
    "PASS: shared rover boarding race, one driver, passenger transport, steering authorization, moving-exit guard, disconnect, handoff and dismount.",
  );
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  for (const c of clients) c.ws.close();
}
