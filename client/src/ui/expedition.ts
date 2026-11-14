import {
  WORLD,
  distance,
  icons,
  type Game,
  type Item,
} from "../../../shared/src/sim";
import {
  sectors,
  fieldMissions,
  fieldProgress,
  missionAvailable,
  missionSector,
  nextFieldMission,
  actNames,
  type FieldMission,
} from "../../../shared/src/expedition";
import { escape as e } from "./components";
import { quizQuestion } from "./quiz";
import {
  launchSite,
  partNames,
  returnProgress,
  salvageSites,
  shipTarget,
} from "../../../shared/src/returnMission";
import "./expedition.css";
import { alienSite, alienProgress } from "../../../shared/src/alien";
import {
  fieldRewardText,
  fieldPartRewards,
} from "../../../shared/src/shipRewards";
import { partReward } from "./shipParts";

export const mapPoint = (x: number, z: number) => ({
  x: ((x - WORLD.x + WORLD.r) / (2 * WORLD.r)) * 100,
  y: ((z - WORLD.z + WORLD.r) / (2 * WORLD.r)) * 100,
});
const rewardText = (m: FieldMission, includePart = true) =>
  Object.entries(m.reward)
    .map(([k, n]) => `${icons[k as Item]} ${n}`)
    .join(" · ") +
  (includePart && fieldRewardText(m.id) ? ` + ${fieldRewardText(m.id)}` : "");
function mapSurface(
  s: Game,
  id: string,
  image: string,
  tracked: string,
  mini: boolean,
  trackedSalvage: string,
) {
  const player = s.players[id],
    p = mapPoint(player.x, player.z),
    next = tracked && nextFieldMission(s, tracked),
    target = next ? missionSector(next) : shipTarget(s, id, trackedSalvage),
    dest = mapPoint(target.x, target.z);
  const base = mapPoint(0, -17);
  const launch = mapPoint(launchSite.x, launchSite.z);
  const nemi = mapPoint(alienSite.x, alienSite.z);
  const salvage = returnProgress(s).caches;
  return `<div class="cartography ${mini ? "compact" : ""}">
    ${image ? `<img class="terrain-map" src="${image}" alt="North-up overhead view of the actual Mars game terrain">` : `<div class="terrain-map map-loading">Loading terrain…</div>`}
    <div class="map-grid" aria-hidden="true"></div><span class="map-north">N ↑</span>
    ${dest ? `<svg class="map-route" viewBox="0 0 100 100" aria-hidden="true"><path d="M${p.x} ${p.y} L${dest.x} ${dest.y}"/></svg>` : ""}
    ${sectors
      .map((site) => {
        const missions = fieldMissions.filter((m) => m.sector === site.id),
          done = missions.every((m) =>
            fieldProgress(s).completed.includes(m.id),
          ),
          available = missions.some((m) => missionAvailable(s, m)),
          point = mapPoint(site.x, site.z);
        const attrs = `class="site-pin ${done ? "done" : available ? "available" : "locked"} ${next && next.sector === site.id ? "tracked" : ""}" style="left:${point.x}%;top:${point.y}%;--site:${site.color}"`;
        return mini
          ? `<span ${attrs}>${done ? "✓" : site.symbol}</span>`
          : `<button ${attrs} data-do="selectSite" data-site="${site.id}" aria-label="${site.name}${done ? ", complete" : available ? ", mission available" : ", locked"}">${done ? "✓" : site.symbol}<span>${site.name}</span></button>`;
      })
      .join("")}
    ${salvageSites
      .map((site) => {
        const point = mapPoint(site.x, site.z);
        return `<span class="salvage-pin ${salvage[site.id]?.reward ? "recovered" : ""}" style="left:${point.x}%;top:${point.y}%" title="${e(partNames[site.part])} salvage">${salvage[site.id]?.reward ? "✓" : "✦"}</span>`;
      })
      .join("")}
    <span class="salvage-pin nemi-pin" style="left:${nemi.x}%;top:${nemi.y}%" title="Nemi · navigation core">${alienProgress(s).completed ? "✓" : "✧"}</span><span class="salvage-pin launch-pin" style="left:${launch.x}%;top:${launch.y}%" title="Return vehicle">↑</span>
    <span class="base-pin" style="left:${base.x}%;top:${base.y}%" title="Habitat / workbench">⌂</span>
    <span class="crew-pin" style="left:${p.x}%;top:${p.y}%" aria-label="Your position">▲</span>
    <span class="map-scale" style="width:${(100 / (WORLD.r * 2)) * 100}%"><i></i>100 m</span><span class="map-caption">TRAINING REGION · NOT A REAL GALE SURVEY</span>
  </div>`;
}
export function miniMap(
  s: Game,
  id: string,
  image: string,
  tracked: string,
  trackedSalvage = "",
) {
  const next = tracked ? nextFieldMission(s, tracked) : undefined,
    target = next ? missionSector(next) : shipTarget(s, id, trackedSalvage),
    done = fieldProgress(s).completed.length;
  return `<aside class="minimap-panel" data-hud="map" aria-label="Expedition minimap"><button class="minimap-open" data-do="map" aria-label="Expand expedition map"><header><span>◈ FIELD NAV</span><span>Q · EXPAND ↗</span></header>${mapSurface(s, id, image, tracked, true, trackedSalvage)}</button><div class="minimap-footer"><span>${done} / ${fieldMissions.length} INVESTIGATIONS</span><i>${Math.round(distance(s.players[id], target))} m</i></div></aside>`;
}
export function missionTracker(
  s: Game,
  id: string,
  tracked: string,
  trackedSalvage = "",
) {
  const nemi = alienProgress(s);
  if (
    nemi.accepted &&
    !nemi.completed &&
    (!tracked || trackedSalvage === "nemi")
  )
    return `<aside class="expedition-tracker"><small>CREW TASK / PROTOTYPE NAVIGATION</small><h3>Nemi’s water loop</h3><p>❄️ ${nemi.delivered.ice || 0}/3 · 🪟 ${nemi.delivered.glass || 0}/2 · 🔩 ${nemi.delivered.scrap || 0}/2</p><footer><span>☀ ${nemi.brushed ? "Collector clean" : "Brush the collector"}</span><button data-do="trackSalvage" data-site="nemi">Pin Nemi ↗</button></footer></aside>`;
  if (!tracked)
    return `<aside class="expedition-tracker"><small>MAIN MISSION / REBUILD THE SHIP</small><h3>Four systems. One way home.</h3><p>Help Nemi, investigate field sites and recover ship parts.</p><footer><button data-do="trackSalvage" data-site="nemi">✧ Meet Nemi</button><button data-do="map">Repair map ↗</button></footer></aside>`;
  const m = nextFieldMission(s, tracked);
  if (!m)
    return `<aside class="expedition-tracker complete"><small>FIELD CAMPAIGN COMPLETE</small><h3>Rebuild the return ship</h3><p>Find salvage caches and bring the crew home.</p><button data-do="map">Open expedition atlas ↗</button></aside>`;
  return `<aside class="expedition-tracker"><small>ACT ${m.act} · ${actNames[m.act]}</small><h3>${e(m.title)}</h3><p>${e(missionSector(m).name)} <span>· ${Math.round(distance(s.players[id], missionSector(m)))} m</span></p><footer><span>E at the field terminal</span><button data-do="map">Mission details ↗</button></footer></aside>`;
}
export function expeditionMap(
  s: Game,
  id: string,
  image: string,
  tracked: string,
  selected?: string,
  trackedSalvage = "",
) {
  const m =
    fieldMissions.find((m) => m.id === selected) ||
    nextFieldMission(s, tracked) ||
    fieldMissions[0];
  const progress = fieldProgress(s),
    done = progress.completed.includes(m.id),
    available = missionAvailable(s, m);
  return `<div class="expedition-map"><div class="map-overview"><div class="map-kicker"><span>GALE / TRAINING REGION</span><b>${progress.completed.length}<small> / 12 FIELD MISSIONS</small></b></div>${mapSurface(s, id, image, tracked, false, trackedSalvage)}<div class="expedition-legend"><span><i class="gold"></i> Pinned mission</span><span><i class="cyan"></i> Available</span><span>✓ Complete</span><span>✦ Salvage · ↑ Return ship</span><span>▲ You · ⌂ Base</span></div><div class="salvage-roster"><b>SHIP REPAIRS</b><button data-do="trackSalvage" data-site="nemi"><span>✧ Nemi’s refuge</span><small>${alienProgress(s).completed ? "✓ Water loop repaired" : "Team delivery · Prototype navigation"}</small></button>${salvageSites.map((site) => `<button data-do="trackSalvage" data-site="${site.id}" ${returnProgress(s).caches[site.id]?.reward ? "disabled" : ""}><span>${e(site.name)}</span><small>${returnProgress(s).caches[site.id]?.reward ?? "✦"} · ${partNames[site.part]}</small></button>`).join("")}<button data-do="trackSalvage" data-site="return"><span>↑ Return vehicle</span><small>Return platform</small></button></div><p class="map-note">North-up · distances in game metres. Dotted line is a bearing, not a safe walking route. Go around cliffs and rocks. ${s.phase === "day" ? "Solo exploration pauses while this map is open." : "Plan your next excursion."}</p></div>
    <div class="mission-dossier"><small>ACT ${m.act} / ${actNames[m.act].toUpperCase()}</small><h3>${e(m.title)}</h3><div class="dossier-place">${e(missionSector(m).name)} · ${Math.round(distance(s.players[id], missionSector(m)))} m</div><p>${e(done ? m.debrief : m.brief)}</p>
    ${
      done
        ? `<div class="journal-note"><b>YOUR SCIENCE NOTE</b><p>${e(m.explanation)}</p><a href="${m.source}" target="_blank" rel="noopener noreferrer">${m.sourceName} ↗</a></div>`
        : `<div class="mission-steps"><span>01 · Travel to the field terminal</span><span>02 · ${m.tool === "scan" ? "Inspect all readings" : m.tool === "tune" ? "Tune the instrument" : "Arrange the procedure"}</span><span>03 · Explain what the evidence means</span></div><div class="mission-reward">SUPPLY CACHE <b>${rewardText(m)}</b></div>${
            available
              ? `<button class="button" data-do="trackMission" data-mission="${m.id}">${tracked === m.id ? "FOLLOW PINNED MISSION ↗" : "PIN MISSION & EXPLORE ↗"}</button>`
              : `<p class="mission-locked">Complete first: ${m.requires
                  .filter((r) => !progress.completed.includes(r))
                  .map((r) => e(fieldMissions.find((f) => f.id === r)!.title))
                  .join(" · ")}</p>`
          }`
    }
    <div class="mission-roster" aria-label="All field missions">${[1, 2, 3]
      .map(
        (act) =>
          `<h4>ACT ${act} · ${actNames[act]}</h4>${fieldMissions
            .filter((f) => f.act === act)
            .map(
              (f) =>
                `<button class="${f.id === m.id ? "selected" : ""}" data-do="selectMission" data-mission="${f.id}"><span>${progress.completed.includes(f.id) ? "✓" : missionAvailable(s, f) ? "◇" : "·"}</span>${e(f.title)}</button>`,
            )
            .join("")}`,
      )
      .join("")}</div></div></div>`;
}
export function fieldStation(s: Game, m: FieldMission) {
  const progress = fieldProgress(s),
    scanned = progress.surveyed.includes(m.id),
    obs = progress.observations[m.id] || [];
  return `<div class="field-lab"><div class="lab-eyebrow">FIELD ${missionSector(m).symbol} · ${e(missionSector(m).name)} <b>${m.tool.toUpperCase()} / EXPLAIN</b></div>${scanned ? "" : `<div class="crew-transmission"><span>◉</span><div><small>${m.role}</small><p>${e(m.brief)}</p></div></div><p class="lab-instruction">${e(m.instruction)}</p>`}
    ${
      !scanned
        ? m.tool === "tune"
          ? `<div class="instrument"><div class="instrument-display"><span>LINK QUALITY</span><output id="field-signal">${100 - Math.abs(30 - m.target!)}%</output></div><div class="signal-meter"><i id="field-meter" style="width:${100 - Math.abs(30 - m.target!)}%"></i></div><label for="field-dial">${e(m.samples[0])}<input id="field-dial" type="range" min="0" max="100" value="30" data-target="${m.target}"></label><button class="button" data-do="fieldTune" data-mission="${m.id}">CAPTURE READING</button></div>`
          : `<div class="sample-grid ${m.tool}">${m.samples.map((sample, i) => `<button data-do="fieldObserve" data-mission="${m.id}" data-value="${i}" ${obs.includes(i) ? "disabled" : ""}><b>${obs.includes(i) ? (m.tool === "sequence" ? obs.indexOf(i) + 1 : "✓") : "＋"}</b><span>${e(sample)}</span></button>`).join("")}</div><div class="lab-progress">${obs.length} / ${m.samples.length} ${m.tool === "sequence" ? "STEPS ORDERED" : "READINGS COLLECTED"}${m.tool === "sequence" ? `<button data-do="fieldReset" data-mission="${m.id}">Reset order</button>` : ""}</div>`
        : `<div class="evidence-note"><small>INSTRUMENT RECORD · SIMULATED DATA</small><p>${e(m.reading)}</p></div>${quizQuestion(
            m.question,
            m.answers.map((text, index) => ({ text, index })),
            { mission: m.id },
          )}`
    }
    ${scanned ? "" : '<p class="field-feedback" role="status"></p>'}<footer class="lab-source"><span>Mission ${fieldMissions.indexOf(m) + 1} / 12 · Training simulation</span><a href="${m.source}" target="_blank" rel="noopener noreferrer">Science source ↗</a></footer></div>`;
}
export function fieldDebrief(s: Game, m: FieldMission) {
  return `<div class="field-debrief"><div class="debrief-seal">✓</div><small>FIELD JOURNAL UPDATED · ${fieldProgress(s).completed.length} / 12</small><h3>${e(m.title)}</h3><p>${e(m.debrief)}</p><div class="journal-note"><b>WHAT YOU LEARNED</b><p>${e(m.explanation)}</p></div>${fieldPartRewards[m.id] ? partReward(fieldPartRewards[m.id].part, fieldPartRewards[m.id].rarity) : ""}<div class="mission-reward">CACHE UNLOCKED BESIDE THIS TERMINAL <b>${rewardText(m, false)}</b></div><button class="button" data-do="close">CONTINUE EXPLORING ↗</button><button class="button secondary" data-do="map">PLAN THE NEXT MISSION</button></div>`;
}
