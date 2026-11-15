import { roverState, roverSeat } from "../../../shared/src/rover";
import type { Game } from "../../../shared/src/sim";
import { escape, KeyChip } from "./components";
export function roverDashboard(s: Game, id: string) {
  const r = roverState(s),
    seat = roverSeat(r, id);
  if (seat < 0) return "";
  const driver = r.driver && s.players[r.driver];
  return `<div class="rover-dashboard" aria-label="Rover controls"><header><span>WAYFARER 01</span><b>${Number(!!r.driver) + r.passengers.length} / 4 CREW</b></header><div class="rover-readout"><strong><span data-rover-speed>${Math.round(Math.abs(r.speed) * 3.6)}</span><small>km/h</small></strong><div><b>${seat === 0 ? "YOU ARE DRIVING" : "PASSENGER"}</b><span>${driver ? `Driver: ${escape(driver.name)}` : "Driver seat available"} · <span data-rover-distance>${Math.round(r.odometer)}</span> m travelled</span></div></div><p class="rover-desktop-help">${seat === 0 ? `${KeyChip("W / S")} Forward / reverse &nbsp; ${KeyChip("A / D")} Steer &nbsp; ${KeyChip("Space")} Brake` : "Enjoy the view. Your supplies travel with you."}</p>${seat === 0 ? '<p class="rover-touch-help">Joystick ↑↓ drive · ←→ steer · Hold STOP to brake.</p>' : ""}<footer>${!r.driver ? '<button data-do="takeRover">Take the wheel</button>' : ""}<button data-do="interact" ${Math.abs(r.speed) > 0.5 ? "disabled" : ""}>${KeyChip("E")} ${Math.abs(r.speed) > 0.5 ? "Stop to exit" : "Exit rover"}</button></footer></div>`;
}
