import { it, expect } from "vitest";
import { arrivalStory, arrivalDuration } from "../client/src/ui/filmStory";

it("tells the Mars arrival story in six scenes over 27 seconds", () => {
  expect(arrivalStory.map(({ key, duration }) => [key, duration])).toEqual([
    ["launch", 6],
    ["cruise", 4],
    ["entry", 4],
    ["touchdown", 4],
    ["egress", 6],
    ["resolve", 3],
  ]);
  expect(arrivalDuration).toBe(27);
});

it("keeps a short caption visible throughout each scene and ends with the return objective", () => {
  for (const { key, lines } of arrivalStory) {
    expect(lines[0].trim(), key).not.toBe("");
    expect(lines[0].length, key).toBeLessThanOrEqual(70);
    expect(lines[1], key).toBe(lines[0]);
  }
  expect(arrivalStory.at(-1)?.lines[0]).toContain("Rebuild the return ship");
});
