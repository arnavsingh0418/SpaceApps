/** macOS authoring helper. Bundled PCM clips play without a TTS service. */
import { mkdir, mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { arrivalStory } from "../client/src/ui/filmStory";
const temp = await mkdtemp(join(tmpdir(), "outpost-voices-"));
await mkdir("client/public/film", { recursive: true });
const voices: Record<string, string> = {
  Vega: "Samantha",
  Juno: "Daniel",
  Imani: "Karen",
  Control: "Daniel",
};
try {
  for (const shot of arrivalStory)
    for (const [i, caption] of shot.lines.entries()) {
      const [speaker, ...words] = caption.split(":");
      const text = words.join(":").trim(),
        aiff = join(temp, `${shot.key}-${i}.aiff`);
      const rate = Math.max(
        175,
        Math.ceil((text.split(/\s+/).length / (shot.duration / 2 - 0.6)) * 60),
      );
      execFileSync("/usr/bin/say", [
        "-v",
        voices[speaker] || "Samantha",
        "-r",
        String(rate),
        "-o",
        aiff,
        text,
      ]);
      execFileSync("/usr/bin/afconvert", [
        aiff,
        `client/public/film/${shot.key}-${i}.wav`,
        "-f",
        "WAVE",
        "-d",
        "LEI16@22050",
      ]);
      if ((await stat(`client/public/film/${shot.key}-${i}.wav`)).size < 10000)
        throw Error(
          "Speech service returned empty audio. Run with access to the local macOS speech service.",
        );
      console.log(`${shot.key}-${i}: ${rate} wpm`);
    }
} finally {
  await rm(temp, { recursive: true, force: true });
}
