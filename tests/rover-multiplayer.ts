import assert from "node:assert/strict";
import { roverState, roverExits } from "../shared/src/rover";
import { Client, unlockCrewRover } from "./alien-crew-fixture";
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
  await unlockCrewRover(a, b);
  const parkedRover = roverState(a.state!);
  await a.walk(parkedRover.x - 3, parkedRover.z);
  await b.walk(parkedRover.x + 3, parkedRover.z);
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
  // Meet the actual server-driven vortex with both explorers aboard.
  const windDeadline=Date.now()+9000;
  while(!roverState(driver.state!).gust && Date.now()<windDeadline) {
    const r=roverState(driver.state!),center=driver.state!.devil;
    const dx=center.x-r.x,dz=center.z-r.z,d=Math.hypot(dx,dz);
    driver.action({type:"driveRover",x:r.x+dx/d*1.5,z:r.z+dz/d*1.5,heading:r.heading,speed:10});
    await new Promise(r=>setTimeout(r,100));
  }
  await passenger.until(()=>!!roverState(passenger.state!).gust,"shared wind encounter");
  const landDeadline=Date.now()+25000;let lifted=false;
  while(roverState(passenger.state!).gust && Date.now()<landDeadline){
    const r=roverState(passenger.state!);
    lifted ||= (r.gust?.height??0)>.4;
    assert.equal(passenger.state!.players[passenger.id].x,r.x);
    assert.equal(passenger.state!.players[driver.id].z,r.z);
    await new Promise(r=>setTimeout(r,100));
  }
  assert.ok(lifted,"rover was visibly lifted");
  assert.equal(roverState(passenger.state!).gust,undefined,"gust releases control after landing");
  const landed={...roverState(driver.state!)};
  driver.action({type:"driveRover",x:landed.x+1,z:landed.z,heading:landed.heading,speed:3});
  await passenger.until(()=>roverState(passenger.state!).x>landed.x+.5,"driving restored after wind landing");
  driver.action({type:"driveRover",x:roverState(driver.state!).x,z:roverState(driver.state!).z,heading:landed.heading,speed:0});
  await passenger.until(()=>roverState(passenger.state!).speed===0,"park after landing");
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
    "PASS: shared rover boarding race, one driver, passenger transport, steering authorization, moving-exit guard, wind lift/landing/recovery, disconnect, handoff and dismount.",
  );
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  for (const c of clients) c.ws.close();
}
