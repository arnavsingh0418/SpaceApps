import { dispatch, tick, type Game } from "../shared/src/sim";
import { flightStations } from "../shared/src/flight";
export function runFlight(s: Game, seconds: number) {
  for (let t = 0; t < seconds - 1e-7; t += 0.1) tick(s, 0.1);
}
export function lockGuidance(s: Game, id: string) {
  Object.assign(s.players[id], flightStations.helm);
  dispatch(s, id, { type: "takeHelm" });
  const d = s.returnMission!.flight!.deck!;
  for (
    let guard = 0;
    Math.hypot(d.course.x, d.course.y) > 0.1 && guard < 100;
    guard++
  ) {
    dispatch(s, id, {
      type: "flightSteer",
      x: Math.abs(d.course.x) > 0.04 ? -Math.sign(d.course.x) : 0,
      y: Math.abs(d.course.y) > 0.04 ? -Math.sign(d.course.y) : 0,
    });
    tick(s, 0.1);
  }
  dispatch(s, id, { type: "holdCourse" });
  dispatch(s, id, { type: "releaseHelm" });
}
/** Unit fixture uses validated station actions; browser tests cover real walking/puzzles. */
export function flyHome(s: Game, id: string) {
  lockGuidance(s, id);
  let guard = 0;
  while (s.phase === "flight" && guard++ < 3000) {
    const d = s.returnMission!.flight!.deck!;
    if (d.arrivalAt !== undefined) {
      runFlight(s, 12.2);
      break;
    }
    const fault = d.incidents.find((f) => !f.fixed);
    if (fault) {
      Object.assign(s.players[id], flightStations[fault.kind]);
      const begin = dispatch(s, id, {
        type: "beginFlightRepair",
        fault: fault.id,
      });
      if (begin) throw Error(begin);
      runFlight(s, 3.2);
      const value =
        fault.kind === "power"
          ? "0,1,2"
          : fault.kind === "air"
            ? "2,0,1"
            : fault.kind === "hull"
              ? "0,1,2,3"
              : 35;
      const error = dispatch(s, id, {
        type: "finishFlightRepair",
        fault: fault.id,
        value,
      });
      if (error) throw Error(error);
    } else if (d.time >= 121 && !d.guidance[1]) lockGuidance(s, id);
    else tick(s, 0.1);
  }
  if (guard >= 3000) throw Error("Flight never ended");
}
