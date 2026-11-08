import { it, expect } from "vitest";
import { createGame, addPlayer, dispatch } from "../shared/src/sim";
import { flareCard, report, eventBanner } from "../client/src/ui/events";
it("flare cards show actual shield-adjusted costs and archived attribution", () => {
  const s = createGame(420);
  addPlayer(s, "a");
  s.sol = 3;
  dispatch(s, "a", { type: "power", value: s.allocation });
  s.clock = s.event!.at;
  s.shield = 2;
  const card = flareCard(s);
  expect(card).toContain("NASA DONKI");
  expect(card).toContain("Archived data");
  dispatch(s, "a", { type: "choice", choice: "work" });
  expect(card).toContain(`+${s.dose}`);
  expect(card).toContain("−10");
  expect(card).toContain("−2");
});
it("only the crew leader gets an enabled next-sol button", () => {
  const s = createGame();
  addPlayer(s, "a");
  addPlayer(s, "b");
  const html = report(s, undefined, "b");
  expect(html).toContain('data-do="next" disabled');
});
it("storm countdowns remain concise and include their action", () => {
  const s = createGame();
  addPlayer(s, "a");
  s.event = { kind: "storm", at: 0, resolved: false };
  s.clock = 5;
  const banner = eventBanner(s);
  expect(banner).toContain("DUST STORM");
  expect(banner).toContain("0:30");
  expect(banner).toContain("Bring items and cover panels.");
});
