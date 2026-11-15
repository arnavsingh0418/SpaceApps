import { alienRoverSite } from "../shared/src/alien";
import { Client, unlockCrewRover } from "./alien-crew-fixture";
const a = new Client(),
  b = new Client();
try {
  await Promise.all([a.ready(), b.ready()]);
  a.send({ type: "create", name: "Ice runner", seed: 42 });
  await a.until(() => !!a.state, "create");
  b.send({ type: "join", name: "Panel runner", code: a.room });
  await b.until(() => !!b.state, "join");
  a.action({ type: "power", value: { air: 4, light: 3, radio: 0, heat: 1 } });
  await a.until(() => a.state!.phase === "day", "day");
  await b.until(() => b.state!.phase === "day", "guest day");
  a.action({ type: "boardRover" });
  await a.until(() => a.error.includes("unlock the rover"), "rover unavailable before quest");
  await unlockCrewRover(a, b);
  await Promise.all([a.walk(alienRoverSite.x - 1, alienRoverSite.z - 2), b.walk(alienRoverSite.x + 2, alienRoverSite.z)]);
  a.action({type:"boardRover"});
  await b.until(() => b.state!.rover?.driver === a.id, "shared rover boarding");
  b.action({type:"boardRover"});
  await a.until(() => !!a.state!.rover?.passengers.includes(b.id), "friend rides reward");
  console.log("PASS two explorers complete Nemi’s task and share the unlocked rover and nav core.");
} finally { a.ws.close(); b.ws.close(); }
