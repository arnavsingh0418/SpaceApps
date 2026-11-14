import {
  facts,
  recipes,
  icons,
  itemNames,
  B,
  type Game,
  type Item,
  type Allocation,
} from "../../../shared/src/sim";
import sources from "../../../shared/src/data/sources.json";
import { Button, Panel, KeyChip, escape } from "./components";
import { expeditionMap } from "./expedition";
import { quizQuestion } from "./quiz";
import { returnReport } from "./returnMission";
import { artURL, itemArt, buildingArt, crewPortrait } from "./modelArt";
export function titleScreen(hasSave: boolean) {
  return `<img class="menu-model-art" src="${artURL("title-hero.png")}" alt="Mars crew beside their crashed rocket"><div class="menu-top"><b>◈ MARS EXPLORATION PROGRAM</b><span>MISSION 001 / GALE CRATER</span></div><section class="title-screen"><div class="eyebrow">A LITTLE CREW. A BIG PLANET.</div><h1>OUTPOST<br><span>DOWN</span><i>↘</i></h1><div class="menu-actions">${Button("START MISSION ↗", "solo")}${hasSave ? Button("CONTINUE", "resume", "", true) : ""}${Button("PLAY WITH FRIENDS", "crew", "", true)}</div><div class="menu-links">${Button("HOW TO PLAY", "help", "", true)}${Button("NASA DATA", "sources", "", true)}</div></section><div class="mission-stamp"><span>5.4° S / 137.8° E</span><b>GALE CRATER</b></div><footer class="menu-footer">REBUILD YOUR SHIP / BRING THE CREW HOME · 15 SOLS</footer>`;
}
export function pauseScreen(
  s: Game,
  id: string,
  muted: boolean,
  network: boolean,
  volume = 35,
) {
  return `<p>${network ? "Crew mission keeps running." : "Solo mission paused."}</p><div class="settings-grid"><label>Crew role<select id="role-select">${["Engineer", "Scientist", "Medic", "Comms"].map((r) => `<option ${s.players[id].role === r ? "selected" : ""}>${r}</option>`).join("")}</select></label><label>Sound volume<input id="master-volume" aria-label="Sound volume" type="range" min="0" max="100" value="${volume}"></label></div><div class="menu-grid">${Button("RESUME", "close")}${Button(muted ? "SOUND OFF" : "SOUND ON", "mute", "", true)}${Button("FIELD GUIDE", "help", "", true)}${Button("FIELD MAP", "map", "", true)}${Button("SKIP TUTORIAL", "skip", "", true)}${Button("NASA DATA", "sources", "", true)}${Button("MAIN MENU", "menu", "", true)}</div>`;
}
export function controls() {
  return `<ul class="body-lines"><li>${KeyChip("WASD")} Walk ${KeyChip("E")} Interact</li><li>${KeyChip("B")} Build ${KeyChip("G")} Drop ${KeyChip("Q")} Map</li><li>${KeyChip("Tab")} Goals ${KeyChip("T")} Chat ${KeyChip("F")} Screen</li></ul>${Button("RESUME", "close")}`;
}
export function crewLobby(url: string) {
  return `<label>Your name<input id="crew-name" maxlength="16" value="Explorer"></label><label>Server address<input id="server-url" type="url" value="${escape(url)}"></label><label>Crew role<select id="lobby-role">${["Engineer", "Scientist", "Medic", "Comms"].map((r) => `<option>${r}</option>`).join("")}</select></label>${Button("CREATE CREW", "create")}<label>Room code<input id="room-code" maxlength="4" placeholder="MARS" autocapitalize="characters"></label>${Button("JOIN CREW", "join", "", true)}<p id="crew-error" role="status"></p>`;
}
export function scienceLesson(s: Game, key: string) {
  const f = facts.find((f) => f.id === key)!;
  const short: Record<string, string> = {
    shield:
      "Water, ice, and soil block some radiation. Thick walls help protect the crew.",
    comms:
      "Radio signals take 3–22 minutes to reach Mars. Point the dish at Earth.",
    grow: "Plants need light, water, and warmth. Mars soil has harmful salts; treat it first.",
    power: "Dust blocks sunlight. Clean panels make more electricity.",
    oxygen:
      "MOXIE made oxygen from Mars’s carbon dioxide air. Melting ice gives water.",
    plants:
      "Radiation changed plant repair instructions in OSD-658. These tests help scientists study crops.",
  };
  const answers = f.answers
    .map((text, index) => ({ text, index }))
    .sort((a, b) => ((a.index + s.seed) % 3) - ((b.index + s.seed) % 3));
  return `<p class="science-copy" data-copy="fact">${short[key]}</p>${quizQuestion(f.question, answers, { fact: key })}${key === "comms" && s.built.includes("radio") ? Button("ALIGN DISH", "task", 'data-kind="align"') : ""}${key === "grow" && s.built.includes("greenhouse") ? Button("WATER PLANTS −1 ❄️", "task", 'data-kind="water"') : ""}${key === "oxygen" ? Button("PATCH PIPES", "task", 'data-kind="patch"') : ""}<a class="citation" href="${f.url}" target="_blank" rel="noopener noreferrer">${escape(f.source)} ↗</a>`;
}
export function workbench(s: Game, id: string, index: number) {
  const r = recipes[index],
    p = s.players[id],
    built = s.built.includes(r.id),
    locked = !s.learned.includes(r.fact);
  return `<div class="recipe-tabs">${recipes.map((r, i) => `<button class="${i === index ? "selected" : ""}" data-do="recipe" data-index="${i}" aria-label="${r.name}">${buildingArt(r.id, r.icon)}</button>`).join("")}</div><h3>${r.name}</h3><div class="ingredients">${Object.entries(
    r.cost,
  )
    .map(
      ([k, n]) =>
        `<span class="${(s.stock[k as Item] || 0) + (p.bag[k as Item] || 0) >= n ? "enough" : ""}">${itemArt(k as Item)} ${n}</span>`,
    )
    .join(
      "",
    )}</div><p>${built ? "Built and ready." : locked ? "Scan its science beacon first." : "Your supplies and storage both count."}</p>${Button(built ? "BUILT" : locked ? "LEARN FIRST" : "BUILD", "build", `data-recipe="${r.id}" ${built || locked ? "disabled" : ""}`)}${Button("STORE ITEMS", "store", "", true)}${Button("WIRE CIRCUIT −1 🔩", "task", 'data-kind="wire"', true)}<div class="stock">${Object.entries(
    s.stock,
  )
    .filter(([, n]) => n)
    .map(
      ([k, n]) =>
        `<span title="${itemNames[k as Item]}">${itemArt(k as Item)} ${n}</span>`,
    )
    .join("")}</div>`;
}
export function panelMenu(covered: boolean, target: string) {
  return `${Button("BRUSH PANEL", "clean", `data-target="${target}"`)}${Button(covered ? "UNCOVER PANEL" : "COVER PANEL", "cover", `data-target="${target}"`, true)}<p>Covering protects it but costs its electricity.</p>`;
}
export const taskTitles: Record<string, string> = {
  align: "ALIGN DISH",
  clean: "BRUSH PANEL",
  wire: "CONNECT CIRCUIT",
  patch: "PATCH AIR LEAK",
  water: "WATER PLANTS",
};
export function miniTask(kind: string) {
  const body =
    kind === "align"
      ? `<p>Move the needle into green.</p><div class="signal-track"><span></span></div><input id="needle" aria-label="Dish alignment" type="range" min="0" max="100" value="20">`
      : kind === "clean"
        ? `<p>Brush at least 18 dusty patches.</p><div id="scrub">${Array.from({ length: 24 }, (_, i) => `<button aria-label="Dust patch ${i + 1}" data-dust="${i}"></button>`).join("")}</div>`
        : kind === "wire"
          ? `<p>Match the colors and shapes. Costs 1 scrap.</p><div class="wires">${[0, 1].map((side) => `<div>${(side ? [2, 0, 1] : [0, 1, 2]).map((n) => `<button data-wire="${n}" data-side="${side}" class="wire-${n}" aria-label="${["Red", "Blue", "Yellow"][n]} wire ${side ? "right" : "left"}">${["◆", "●", "▲"][n]} ━━</button>`).join("")}</div>`).join("")}</div>`
          : kind === "patch"
            ? `<p>Patch all three holes.</p><div class="holes">${[0, 1, 2].map((i) => `<button data-hole="${i}" aria-label="Patch leak ${i + 1}">💨</button>`).join("")}</div>`
            : `<p>Slide water to the plants. Costs 1 ice.</p><input id="water" aria-label="Water the plants" type="range" min="0" max="100" value="0">`;
  return body + Button("DONE", "finishTask");
}
const shortUses = [
  "Real flare classes shape fictional events. Archived records are not live Mars forecasts.",
  "Curiosity once measured 0.67 mSv/day. Our meter uses a separate game scale.",
  "OSD-658 found changes in plant repair instructions. These lab tests used simulated radiation.",
  "MOXIE extracted oxygen from Mars air. Melting ice is a separate process.",
  "Signals take 3–22 minutes to reach Mars. Our delay becomes 12 game seconds.",
  "Dust blocks solar power. Flying heavy crates exaggerate thin Mars air.",
  "Mars soil contains harmful salts. Washing simplifies complex soil treatment.",
  "A sol lasts 24 hours 39 minutes. Earth launch chances come every 26 months; our return window is fictional.",
  "Water and soil reduce exposure. No shelter blocks all radiation.",
];
export function dataSources(index: number) {
  const source = sources[index];
  return `<div class="source-progress">${index + 1}/${sources.length}</div><h3>${escape(source.title)}</h3><p class="source-copy">${escape(shortUses[index]).replace("mSv/day", '<abbr title="A unit of radiation received each day.">mSv/day</abbr>')}</p><a href="${source.url}" target="_blank" rel="noopener noreferrer">NASA source ↗</a><div class="menu-grid">${Button("PREVIOUS", "sourcePage", `data-index="${(index + sources.length - 1) % sources.length}"`, true)}${Button("NEXT", "sourcePage", `data-index="${(index + 1) % sources.length}"`)}</div>`;
}
export function endScreen(s: Game, id: string) {
  const win = s.result.startsWith("Mission complete");
  return `<div class="end-screen"><h1>${win ? "MISSION COMPLETE" : "MISSION REPORT"}</h1><div class="portraits">${Object.values(
    s.players,
  )
    .map((p) => `<div><span>🧑‍🚀</span><b>${escape(p.name)}</b></div>`)
    .join(
      "",
    )}</div><div class="end-stats"><span><b>${s.sol}</b>SOLS</span><span><b>${Math.round(s.dose)}</b>DOSE</span><span><b>${s.radio}/10</b>SIGNAL</span></div>${returnReport(s, id)}<div class="menu-grid">${Button("TRY AGAIN", "retry")}${Button("MAIN MENU", "menu", "", true)}</div></div>`;
}
export function fieldMap(s: Game, id: string) {
  return expeditionMap(s, id, "", "");
}
export function buildIndicator(seconds: number) {
  return Panel(
    `<strong>BUILDING</strong><div class="build-progress" style="--duration:${seconds}s"><i></i></div>`,
    "build-status",
  );
}
