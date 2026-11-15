import { it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { arrivalStory, arrivalDuration } from "../client/src/ui/filmStory";
it("provides a five-minute story with 24 unique, skippable chapters", () => {
  expect(arrivalStory).toHaveLength(24);
  expect(new Set(arrivalStory.map((s) => s.key)).size).toBe(24);
  expect(arrivalDuration).toBeGreaterThan(300);
  expect(arrivalDuration).toBeLessThan(360);
  expect(arrivalStory.at(-1)!.key).toBe("resolve");
});
it("ships real audio for every caption with no dialogue cut off by a scene boundary", () => {
  for (const shot of arrivalStory)
    for (let i = 0; i < 2; i++) {
      const audio = readFileSync(
        new URL(`../client/public/film/${shot.key}-${i}.wav`, import.meta.url),
      );
      const at = audio.indexOf(Buffer.from("data"));
      expect(at, shot.key).toBeGreaterThan(0);
      const duration = audio.readUInt32LE(at + 4) / 44100;
      expect(duration, `${shot.key}-${i}`).toBeGreaterThan(0.3);
      expect(duration, `${shot.key}-${i}`).toBeLessThan(shot.duration / 2);
    }
});
