import { it, expect } from "vitest";
import { arrivalStory, arrivalDuration } from "../client/src/ui/filmStory";

it("tells the arrival story in under 30 seconds", () => {
  expect(arrivalStory.map((shot) => shot.key)).toEqual([
    "launch", "cruise", "entry", "touchdown", "egress", "resolve",
  ]);
  expect(arrivalDuration).toBeLessThan(30);
  expect(arrivalStory.every((shot) => shot.lines[0].trim())).toBe(true);
});
