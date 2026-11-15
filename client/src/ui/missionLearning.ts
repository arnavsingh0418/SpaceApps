import type { Game, Panel } from "../../../shared/src/sim";
import { B, panelOutput, solarBrushPatches } from "../../../shared/src/sim";
import { surfaceLearning, type SurfaceLesson } from "../../../shared/src/missionLearning";
import { Button } from "./components";

export function surfaceReading(s: Game, kind: SurfaceLesson, target: string, count = 0, dial = 20) {
  if (kind === "clean") {
    const panel = s.panels.find((p) => p.id === target);
    if (!panel) return { label: "Panel unavailable", value: 0, status: "Move to a working array." };
    const progress = Math.min(1, count / solarBrushPatches);
    const preview = panelOutput(s, { ...panel, clean: panel.clean + (1 - panel.clean) * progress });
    return {
      label: `${panelOutput(s, panel).toFixed(1)} → ${preview.toFixed(1)} power blocks`,
      value: 100 * preview / B.panelPower,
      status: panel.covered ? "Covered: no sunlight" : `${count} / ${solarBrushPatches} patches brushed · estimated output`,
    };
  }
  if (kind === "align") {
    const error = Math.abs(dial - 72);
    return {
      label: `${Math.max(0, Math.round(100 - error * 2))}% signal strength`,
      value: Math.max(0, 100 - error * 2),
      status: error <= 5 ? "Signal lock acquired" : dial < 72 ? "Turn toward the green zone →" : "← Turn back toward the green zone",
    };
  }
  return {
    label: count === 3 ? "Pressure trend stable" : "Pressure falling",
    value: count * 100 / 3,
    status: `${count} / 3 seals in place · simulated pressure test`,
  };
}

export function surfaceInstrument(s: Game, kind: SurfaceLesson, target: string) {
  const reading = surfaceReading(s, kind, target);
  const lesson = surfaceLearning[kind];
  return `<p class="learning-definition"><b>${lesson.term}</b> · ${lesson.definition}</p><section class="learning-instrument"><b id="surface-reading">${reading.label}</b><progress id="surface-meter" max="100" value="${reading.value}" aria-label="Equipment reading"></progress><small id="surface-status" role="status">${reading.status}</small></section>`;
}

export function solarPanelReading(s: Game, panel: Panel) {
  return `<section class="learning-instrument"><b>${panelOutput(s, panel).toFixed(1)} / ${B.panelPower} power blocks</b><small>${Math.round(panel.clean * 100)}% clean${panel.covered ? " · Cover blocks sunlight" : ""}${s.event?.kind === "storm" && s.event.resolved ? " · Airborne dust dims sunlight" : ""}</small></section>`;
}

export function surfaceDebrief(s: Game, kind: SurfaceLesson, target: string) {
  const lesson = surfaceLearning[kind];
  const panel = s.panels.find((p) => p.id === target);
  const result = kind === "clean" && panel
    ? `Panel now supplies ${panelOutput(s, panel).toFixed(1)} power blocks. Your power budget is ${s.power} blocks to share across habitat systems.`
    : kind === "align"
      ? `Antenna aligned. The crew’s communications progress is ${s.radio}/${B.radioTarget}.`
      : "Leak sealed. The crew can avoid the air loss from this leak.";
  return `<div class="learning-debrief"><p class="learning-result">${result}</p><p><b>${lesson.term}</b> · ${lesson.definition}</p><details open><summary>${lesson.mission}</summary><p>${lesson.evidence}</p><p>${lesson.model}</p><a href="${lesson.url}" target="_blank" rel="noopener noreferrer">NASA mission evidence ↗</a></details><p><b>${lesson.role}</b> · ${lesson.work}</p><details><summary>${lesson.reflection}</summary><p>${lesson.answer}</p></details></div>${Button("BACK TO MISSION", "resumeSurface")}`;
}

export function careersPanel() {
  return `<p>Space missions need people who can diagnose, build, test, and repair equipment.</p><div class="learning-careers">${Object.values(surfaceLearning).map(lesson => `<article><b>${lesson.role}</b><p>${lesson.work}</p></article>`).join("")}<article><b>Thermal protection technician</b><p>Inspect materials that protect a spacecraft from heat during entry.</p></article><article><b>Flight controller</b><p>Read the ship’s instruments, set priorities, and coordinate the crew during a fault.</p></article></div><p><a href="https://www.nasa.gov/learning-resources/next-gen-stem-for-careers/" target="_blank" rel="noopener noreferrer">Explore NASA STEM careers ↗</a></p>`;
}
