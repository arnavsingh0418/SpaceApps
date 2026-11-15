import {
  alienLines,
  alienLine,
  alienNeeds,
  alienProgress,
  alienScience,
  alienSupplied,
  type AlienLine,
} from "../../../shared/src/alien";
import {
  icons,
  itemNames,
  type Game,
  type Item,
} from "../../../shared/src/sim";
import { Button, escape } from "./components";
import { partReward } from "./shipParts";
import "./alien.css";

export function alienPortrait() {
  return `<div class="nemi-portrait" aria-hidden="true"><div class="nemi-halo"></div><div class="nemi-face"><i class="nemi-eye left"></i><i class="nemi-eye right"></i><i class="nemi-mouth"></i><i class="nemi-freckles">· · ·</i></div><div class="nemi-suit"><span>✦</span></div></div>`;
}
export function alienScreen(s: Game, id: string, line?: AlienLine) {
  const q = alienProgress(s),
    ready = alienSupplied(s) && q.brushed;
  const clip = line || alienLine(s);
  return `<div class="alien-contact"><header><span class="contact-live">● LOCAL CONTACT</span><small>FICTIONAL CHARACTER · REAL SCIENCE</small></header><div class="alien-intro">${alienPortrait()}<div><small>FIELD FRIEND / 01</small><h2>Nemi needs a hand.</h2><p>Restore the water loop.<br>Earn your ship's navigation core.</p></div></div><div class="alien-dialogue"><span>NEMI</span><p id="alien-subtitle">${escape(alienLines[clip])}</p><button class="voice-replay" data-do="alienSpeak" data-line="${clip}">▶ Listen again</button><small id="alien-voice-status" role="status">Subtitles on</small></div>
    ${
      q.completed
        ? `${partReward("nav", "Prototype", "A PROMISE KEPT")}<div class="alien-success">✓ Water flowing · collector online</div>${Button("PIN RETURN SHIP ↗", "trackSalvage", 'data-site="return"')}`
        : !q.accepted
          ? `<div class="alien-offer"><span>YOUR CREW BRINGS</span><b>❄️ 3 ice · 🪟 2 clear panels · 🔩 2 scrap</b><p>Anyone can deliver. Solo explorers can do it too.</p></div>${Button("WE'LL HELP YOU", "acceptAlien")}`
          : `<section class="alien-manifest"><div class="manifest-heading"><h3>One repair. Whole crew.</h3><span>${Object.keys(q.contributions).length} helpers</span></div>${Object.entries(
              alienNeeds,
            )
              .map(([k, n]) => {
                const kind = k as Item,
                  got = q.delivered[kind] || 0,
                  carried = s.players[id].bag[kind] || 0;
                return `<div class="supply-line"><span>${icons[kind]}</span><div><b>${itemNames[kind]}</b><small>${got}/${n} delivered · you carry ${carried}</small><progress max="${n}" value="${got}" aria-label="${itemNames[kind]} delivered"></progress></div>${Button(got >= n ? "DONE" : "GIVE", "donateAlien", `data-kind="${kind}" ${got >= n || !carried ? "disabled" : ""}`, true)}</div>`;
              })
              .join(
                "",
              )}<div class="collector-row"><span>${q.brushed ? "✓" : "☀"} Collector ${q.brushed ? "clean" : "dusty"}</span>${q.brushed ? "" : Button("BRUSH", "beginAlienRepair", "", true)}</div>${
              Object.entries(q.contributions).length
                ? `<div class="crew-deliveries">${Object.entries(
                    q.contributions,
                  )
                    .map(
                      ([who, bag]) =>
                        `<span>${escape(s.players[who]?.name || "Crewmate")}: ${
                          Object.entries(bag)
                            .map(([k, n]) => `${icons[k as Item]}${n}`)
                            .join(" ") || "☀ collector"
                        }</span>`,
                    )
                    .join("")}</div>`
                : ""
            }</section>${ready ? `<div class="alien-evidence"><h3>One last safety check</h3><p>Before Nemi uses the melted ice…</p><div class="alien-answers">${["Use it straight away", "Treat it, then test it", "Check only its color"].map((text, i) => Button(text, "alienAnswer", `data-answer="${i}"`, true)).join("")}</div></div>` : `<p class="alien-hint">Gather supplies around base or from field rewards. Bring them here in your bag.</p>`}`
    }
    <p class="alien-feedback" role="status"></p><details class="alien-science"><summary>Science behind the repair ↗</summary>${alienScience.map((source) => `<article><b>${source.title}</b><p>${source.text}</p><a href="${source.url}" target="_blank" rel="noopener noreferrer">NASA source ↗</a></article>`).join("")}<p>Nemi, alien biology and this local water unit are invented. This is not evidence of life on Mars.</p></details></div>`;
}
export function alienBrush() {
  return `<div class="alien-cleaning"><small>REPAIR / COLLECTOR ARRAY</small><h3>Let the sunlight through.</h3><p>Brush six patches. Take at least two seconds.</p><div class="alien-dust">${Array.from({ length: 8 }, (_, i) => `<button data-alien-dust="${i}" aria-label="Brush patch ${i + 1}"><span>✦</span></button>`).join("")}</div><output id="alien-brush-count">0 / 6 patches</output>${Button("COLLECTOR CLEAN", "finishAlienRepair")}<p class="alien-feedback" role="status"></p></div>`;
}
