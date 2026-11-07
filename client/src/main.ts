import "@fontsource/barlow-condensed/latin-900.css";
import "@fontsource/barlow-condensed/latin-800.css";
import "@fontsource/nunito-sans/latin-400.css";
import "@fontsource/nunito-sans/latin-700.css";
import "@fontsource/nunito-sans/latin-800.css";
import "@fontsource/nunito-sans/latin-900.css";
import "./style.css";
import { World } from "./render/world";
import { CrewConnection } from "./net/crew";
import {
  createGame,
  addPlayer,
  dispatch,
  tick,
  stations,
  distance,
  B,
  recipes,
  facts,
  budget,
  total,
  icons,
  itemNames,
  type Game,
  type Action,
  type Item,
  type Allocation,
  type Bag,
} from "../../shared/src/sim";
import sources from "../../shared/src/data/sources.json";
import eventData from "../../shared/src/data/events.json";
const $ = (q: string) => document.querySelector<HTMLElement>(q)!;
const esc = (s: unknown) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
let game = createGame(42),
  id = "solo",
  started = false,
  connection: CrewConnection | null = null,
  phase = "",
  modal = "",
  selected = 0,
  muted = true,
  saved: Game | null = null,
  toastTimer: ReturnType<typeof setTimeout>,
  draft: Allocation = { air: 3, light: 3, radio: 3, heat: 2 };
const world = new World();
addPlayer(game, id, "Explorer");
try {
  const data = JSON.parse(localStorage.getItem("outpost-save-v1") || "null");
  if (
    data?.version === 1 &&
    data.game?.players?.solo &&
    ["power", "day", "summary"].includes(data.game.phase)
  )
    saved = data.game;
} catch {}
const ui = $("#ui"),
  root = $("#modal-root");
function sound() {
  if (muted) return;
  try {
    const a = new AudioContext(),
      o = a.createOscillator(),
      g = a.createGain();
    o.connect(g);
    g.connect(a.destination);
    o.frequency.setValueAtTime(480, a.currentTime);
    o.frequency.exponentialRampToValueAtTime(720, a.currentTime + 0.1);
    g.gain.setValueAtTime(0.035, a.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + 0.15);
    o.start();
    o.stop(a.currentTime + 0.15);
    o.onended = () => a.close();
  } catch {}
}
function toast(text: string) {
  let el = document.querySelector("#toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast";
    el.setAttribute("role", "status");
    document.body.append(el);
  }
  el.textContent = text;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el!.classList.remove("show"), 4000);
}
function act(a: Action) {
  if (connection) {
    connection.send(a);
    return;
  }
  const error = dispatch(game, id, a);
  if (error) toast(error);
  else if (a.type !== "move") sound();
}
function open(kind: string, content: string, closable = true) {
  modal = kind;
  act({ type: "move", x: 0, z: 0 });
  root.innerHTML = `<div class="scrim"><section class="dialog ${kind === "sources" ? "wide" : ""}" role="dialog" aria-modal="true" aria-label="${kind}">${closable ? '<button class="close" data-do="close" aria-label="Close">×</button>' : ""}${content}</section></div>`;
  setTimeout(
    () =>
      root
        .querySelector<HTMLElement>("button:not(.close), input,select")
        ?.focus(),
    0,
  );
}
function close() {
  modal = "";
  root.innerHTML = "";
}
function subtitle(k: string) {
  return `<div class="eyebrow"><span class="dot"></span> ${k}</div>`;
}
function menu() {
  started = false;
  world.menu = true;
  close();
  ui.innerHTML = `<div class="menu-top"><b>◈ MARS EXPLORATION PROGRAM</b><span>MISSION 001 / GALE CRATER</span></div><section class="title-screen">${subtitle("A LITTLE CREW. A BIG PLANET.")}<h1>OUTPOST<br><span>DOWN</span><i>↘</i></h1><p>Your ship is down. Your crew is counting on you.<br>Gather, learn, and build a way home.</p><div class="menu-actions"><button class="primary" data-do="solo">Start a mission <span>↗</span></button>${saved ? '<button data-do="resume">Continue mission</button>' : ""}<button class="outline" data-do="crew">Play with friends <span>1–4 CREW</span></button></div><div class="menu-links"><button data-do="tutorial">How to play</button><span>·</span><button data-do="sources">NASA data & credits</button></div></section><div class="mission-stamp"><span>5.4° S / 137.8° E</span><b>NO ONE GETS LEFT BEHIND.</b><small>A science adventure for curious explorers.</small></div><footer class="menu-footer"><span>15 SOLS. ONE SHARED MISSION.</span><span>ORIGINAL LOW-POLY ADVENTURE · NASA OPEN DATA</span></footer>`;
}
function start(resume = false) {
  connection?.close();
  connection = null;
  if (resume && saved) {
    game = structuredClone(saved);
    game.players.solo.move = { x: 0, z: 0 };
  } else {
    game = createGame(Math.floor(Math.random() * 2147483647));
    addPlayer(game, "solo", "Explorer");
  }
  id = "solo";
  started = true;
  world.menu = false;
  phase = "";
  close();
  draw();
  if (!resume && !localStorage.getItem("outpost-tutorial")) tutorial();
}
function tutorial() {
  open(
    "tutorial",
    `${subtitle("YOUR FIRST 60 SECONDS")}<h2>Welcome to your<br>new little world.</h2><p>Your landing went wrong. There is a return vehicle on Mars, but you need a safe base and a working radio before sol 15.</p><div class="steps"><div><b>01</b><span><strong>Make a power plan.</strong> Give air at least 3 blocks. Plants need light; heaters keep you moving.</span></div><div><b>02</b><span><strong>Explore and gather.</strong> WASD / arrows to walk. E picks up supplies. Bring them to the workbench.</span></div><div><b>03</b><span><strong>Learn, then build.</strong> Scan cyan science beacons with E. Answer a question to unlock a recipe.</span></div><div><b>04</b><span><strong>Look after each other.</strong> Shelter from flares. Cover panels before storms, then clean and uncover them.</span></div></div><p class="note">A sol is one Mars day: about 24 hours 39 minutes. Here, it takes 3½ minutes. Dose means radiation received; it adds up and never goes down.</p><button class="primary full" data-do="tutorialDone">Let’s explore ↗</button>`,
  );
}
function sourceScreen() {
  open(
    "sources",
    `${subtitle("REAL SCIENCE. PLAYFUL SIMULATION.")}<h2>A mission grounded<br>in NASA data.</h2><p>Archived records power fictional events. This is a learning game, not a live forecast or a spaceflight safety tool.</p><div class="source-list">${sources.map((s) => `<article><a href="${s.url}" target="_blank" rel="noopener noreferrer">${esc(s.title)} ↗</a><p>${esc(s.use)}</p></article>`).join("")}</div><p class="note">Original astronaut and scene builders adapted from the supplied team mockups. Graphics: three.js (MIT). Sound effects: original synthesized tones, no recordings. Created for a junior astronaut training concept; not endorsed by NASA.</p>`,
  );
}
function powerScreen() {
  draft = { ...game.allocation };
  const cap = budget(game);
  while (total(draft) > cap) {
    const k = (["radio", "light", "heat", "air"] as const).find(
      (k) => draft[k] > 0,
    )!;
    draft[k]--;
  }
  powerBody();
}
function powerBody() {
  const cap = budget(game);
  open(
    "power",
    `${subtitle(`SOL ${game.sol} / MORNING BRIEFING`)}<h2>One sun.<br>A shared power plan.</h2><p>You have <b class="yellow">${cap} power blocks</b>. Every block given to one job leaves less for another.</p><div class="power-rows">${(["air", "light", "radio", "heat"] as const).map((k, i) => `<div class="power-row"><div><strong>${["💨 Air machine", "🌱 Greenhouse lights", "📡 Radio", "🔥 Heaters"][i]}</strong><small>${["3 blocks keeps air steady; 4 adds air", "4 food per block, once built", "Progress toward Earth, once built", "1 block keeps the crew warm"][i]}</small></div><div class="pips" role="group" aria-label="${k} power"><button data-do="pip" data-k="${k}" data-v="0" class="zero" aria-label="Set ${k} to zero">−</button>${[1, 2, 3, 4, 5, 6].map((v) => `<button aria-label="${v} blocks to ${k}" data-do="pip" data-k="${k}" data-v="${v}" class="pip ${v <= draft[k] ? "on" : ""}"></button>`).join("")}<b>${draft[k]}</b></div></div>`).join("")}</div><div class="allocation-total"><span>${cap - total(draft)} blocks left</span><b>${total(draft)} / ${cap} used</b></div><button class="primary full" data-do="lock">Lock in our plan →</button><p class="note">${connection && id !== game.host ? "The crew leader or Comms officer can lock this plan." : "Tip: a greenhouse cannot grow food until you build it."}</p>`,
    false,
  );
}
function bench() {
  const p = game.players[id];
  open(
    "bench",
    `${subtitle("HAB / WORKBENCH")}<h2>Build a way home.</h2><p>Supplies in your hotbar and shared storage both count. Stored supplies are safe from storms.</p><div class="stock">${
      Object.entries(game.stock)
        .filter(([, n]) => n)
        .map(
          ([k, n]) =>
            `<span>${icons[k as Item]} ${esc(itemNames[k as Item])} <b>${n}</b></span>`,
        )
        .join("") || "<span>No shared supplies yet.</span>"
    }</div><button class="primary full" data-do="store">📦 Store everything I’m carrying</button><div class="recipes">${recipes
      .map((r) => {
        const locked = !game.learned.includes(r.fact),
          built = game.built.includes(r.id);
        return `<article><div class="recipe-title"><b>${r.icon} ${r.name}</b><span>${built ? "✓ Built" : locked ? "🔒 Learn first" : "Ready to learn by doing"}</span></div><div class="ingredients">${Object.entries(
          r.cost,
        )
          .map(
            ([k, n]) =>
              `<span class="${(game.stock[k as Item] || 0) + (p.bag[k as Item] || 0) >= n ? "enough" : ""}">${icons[k as Item]} ${n} ${itemNames[k as Item]}</span>`,
          )
          .join(
            "",
          )}</div><button data-do="build" data-recipe="${r.id}" ${locked || built ? "disabled" : ""}>${built ? "Completed" : locked ? "Find its cyan science beacon" : "Build · " + (p.role === "Engineer" ? 2 : 4) + " seconds"}</button></article>`;
      })
      .join(
        "",
      )}</div><button class="outline full" data-do="task" data-kind="wire">🧩 Wire a spare circuit · −1 scrap</button>`,
  );
}
function learn(factId: string) {
  const f = facts.find((f) => f.id === factId)!;
  const order = f.answers
    .map((text, i) => ({ text, i }))
    .sort((a, b) => ((a.i + game.seed) % 3) - ((b.i + game.seed) % 3));
  open(
    "learn",
    `${subtitle("FIELD NOTES / " + (game.learned.includes(f.id) ? "LEARNED ✓" : "SCIENCE BEACON"))}<div class="science-icon">${{ shield: "🛡️", comms: "📡", grow: "🌱", power: "⚡", oxygen: "💨", plants: "🔬" }[f.id]}</div><h2>${esc(f.title)}</h2><p>${esc(f.text)}</p>${f.id === "comms" && game.built.includes("radio") ? '<button class="primary full" data-do="task" data-kind="align">📡 Align the dish</button>' : ""}${f.id === "grow" && game.built.includes("greenhouse") ? '<button class="primary full" data-do="task" data-kind="water">💧 Water the plants · −1 ice</button>' : ""}${f.id === "oxygen" ? '<button class="outline full" data-do="task" data-kind="patch">🔧 Patch the oxygen pipes</button>' : ""}<h3>${esc(f.question)}</h3><div class="answers">${order.map((a) => `<button data-do="answer" data-fact="${f.id}" data-answer="${a.i}">${esc(a.text)} <span>→</span></button>`).join("")}</div><a class="citation" href="${f.url}" target="_blank" rel="noopener noreferrer">${esc(f.source)} ↗</a>`,
  );
}
function flare() {
  const e = game.event;
  if (!e?.flare) return;
  open(
    "flare",
    `${subtitle("SPACE WEATHER / ARCHIVED NASA DATA")}<h2>☀️ A burst from the Sun.</h2><p>Energetic particles can raise the crew’s radiation dose. Choose together: every plan has a cost.</p><div class="choices">${eventData.choices.map((c) => `<button data-do="choice" data-choice="${c.id}" ${c.id === "shelter" && !game.built.includes("shelter") ? "disabled" : ""}><strong>${c.name}</strong><small class="good">${c.id === "work" ? "+3 progress if radio is built" : c.benefit}</small><small class="cost">${c.id === "shelter" ? "−10 food" : c.id === "ice" ? "−2 ice blocks" : `+${B.flareDose[e.flare!.classType[0] as keyof typeof B.flareDose]} dose before shielding`}</small></button>`).join("")}</div><p class="note">Real flare: <b>${e.flare.classType}</b> · ${e.flare.beginTime.slice(0, 10)} · NASA DONKI archive.<br>Recorded from Earth; game events and dose are fictional. Class is not a Mars dose forecast. Choose within ${Math.max(0, Math.ceil(e.at + 45 - game.clock))} seconds or the crew keeps working.</p><a class="citation" href="${e.flare.url}" target="_blank" rel="noopener noreferrer">View the archived NASA record ↗</a>`,
  );
}
let taskState: {
  kind: string;
  target: string;
  start: number;
  count: number;
  wires: number[];
  left: number | null;
} | null = null;
function task(kind: string, target = "") {
  act({ type: "beginTask", kind, target });
  taskState = {
    kind,
    target,
    start: performance.now(),
    count: 0,
    wires: [],
    left: null,
  };
  const body =
    kind === "align"
      ? `<p>Move the dish needle into the green signal zone.</p><div class="signal-track"><span></span></div><input id="needle" aria-label="Dish alignment" type="range" min="0" max="100" value="20"><button class="primary full" data-do="finishTask">Check the signal</button>`
      : kind === "clean"
        ? `<p>Drag your brush across the dusty panel. Clear at least 18 patches.</p><div id="scrub" aria-label="Drag to brush dust off the panel">${Array.from({ length: 24 }, (_, i) => `<button aria-label="Dust patch ${i + 1}" data-dust="${i}"></button>`).join("")}</div><button class="primary full" data-do="finishTask">Finish brushing</button>`
        : kind === "wire"
          ? `<p>Tap a wire on the left, then its matching color on the right. Uses 1 scrap.</p><div class="wires">${[0, 1].map((side) => `<div>${(side ? [2, 0, 1] : [0, 1, 2]).map((n) => `<button data-wire="${n}" data-side="${side}" style="--wire:${["#fb7185", "#38bdf8", "#facc15"][n]}" aria-label="${["Red", "Blue", "Yellow"][n]} wire ${side ? "right" : "left"}">${["◆", "●", "▲"][n]} ━━━</button>`).join("")}</div>`).join("")}</div><button class="primary full" data-do="finishTask">Connect the circuit</button>`
          : kind === "patch"
            ? `<p>Patch the three leaking holes before the warning expires.</p><div class="holes">${[0, 1, 2].map((i) => `<button data-hole="${i}" aria-label="Patch leak ${i + 1}">💨</button>`).join("")}</div><button class="primary full" data-do="finishTask">Check the seals</button>`
            : `<p>Use one ice block to water the greenhouse. More water means 4 extra food tonight.</p><label>Slide the water to the plants<input id="water" type="range" min="0" max="100" value="0"></label><button class="primary full" data-do="finishTask">Water the plants · −1 ice</button>`;
  open(
    "task",
    `${subtitle("CREW TASK / " + kind.toUpperCase())}<h2>${{ align: "A little to the left…", clean: "Let the sunshine in.", wire: "Make a connection.", patch: "Every breath counts.", water: "A drink for the garden." }[kind]}</h2>${body}<p class="note">Take at least 2 seconds. Any role can help.</p>`,
  );
}
function crewScreen() {
  open(
    "crew",
    `${subtitle("BETTER WITH A LITTLE CREW")}<h2>Room for everyone.</h2><p>Up to four friends, one shared outpost. No accounts needed. Solo play works without this server.</p><label>Your name<input id="crew-name" maxlength="16" value="Explorer"></label><label>Crew server address<input id="server-url" type="url" value="${esc(import.meta.env.VITE_CREW_SERVER || localStorage.getItem("crew-url") || "ws://localhost:2567")}" placeholder="wss://your-server.example"></label><button class="primary full" data-do="create">Create a crew ↗</button><div class="or">OR JOIN YOUR FRIENDS</div><label>Four-letter crew code<input id="room-code" maxlength="4" placeholder="MARS" autocapitalize="characters"></label><button class="outline full" data-do="join">Join crew →</button><p id="crew-error" class="cost" role="status"></p>`,
  );
}
function summary() {
  open(
    "summary",
    `${subtitle(`SOL ${game.sol} / NIGHT REPORT`)}<h2>Small choices.<br>Real consequences.</h2><div class="summary-lines">${game.summary.map((s, i) => `<div><span>${["💨", "🌱", "☢️", "⚡"][i]}</span><p>${esc(s)}</p></div>`).join("")}</div><p class="note">Tomorrow brings a new weather pattern. What will your crew do differently?</p><button class="primary full" data-do="next" ${id !== game.host ? "disabled" : ""}>${id === game.host ? "Next sol →" : "Waiting for crew leader…"}</button>`,
    false,
  );
}
function ended() {
  open(
    "ended",
    `${subtitle("MISSION DEBRIEF")}<div class="science-icon">${game.result.startsWith("Mission complete") ? "🚀" : "🪐"}</div><h2>${game.result.startsWith("Mission complete") ? "You made a home<br>on another world." : "Every explorer<br>learns something."}</h2><p>${esc(game.result)}</p><p class="note">Real crews prepare backup power, grow food carefully, and use shielding. Bring what you learned into your next mission.</p><button class="primary full" data-do="retry">Try again · a new storm pattern ↗</button><button class="outline full" data-do="menu">Back to mission control</button>`,
    false,
  );
  try {
    localStorage.removeItem("outpost-save-v1");
    saved = null;
  } catch {}
}
function nearest() {
  const p = game.players[id];
  if (!p) return null;
  const list: {
    type: string;
    target: string;
    pos: { x: number; z: number };
    text: string;
  }[] = [];
  for (const i of game.items)
    list.push({
      type: "pick",
      target: i.id,
      pos: i,
      text: `Pick up ${itemNames[i.kind]} ×${i.count}`,
    });
  for (const [k, pos] of Object.entries(stations))
    list.push({
      type: k === "workbench" ? "bench" : "learn",
      target: k,
      pos,
      text:
        k === "workbench"
          ? "Workbench · store & build"
          : `Scan ${facts.find((f) => f.id === k)?.title}`,
    });
  for (const o of game.panels)
    list.push({
      type: "panel",
      target: o.id,
      pos: o,
      text: "Solar panel · clean / cover",
    });
  if (game.built.includes("radio"))
    list.push({
      type: "align",
      target: "",
      pos: stations.comms,
      text: "Align the radio dish",
    });
  const n = list
    .filter((n) => distance(p, n.pos) < B.interactRadius)
    .sort((a, b) => distance(p, a.pos) - distance(p, b.pos))[0];
  return n;
}
function interact() {
  if (modal) return;
  const n = nearest();
  if (!n) {
    toast("Walk toward a glowing supply or cyan science beacon.");
    return;
  }
  if (n.type === "pick") act({ type: "pick", target: n.target });
  if (n.type === "bench") bench();
  if (n.type === "learn") learn(n.target);
  if (n.type === "align") task("align");
  if (n.type === "panel")
    open(
      "panel",
      `${subtitle("SOLAR ARRAY")}<h2>Take care of<br>your sunlight.</h2><p>Covering protects a panel from dust, but blocks its power until tomorrow. Cleaning restores its sunlight.</p><button class="primary full" data-do="clean" data-target="${n.target}">🧹 Brush the panel</button><button class="outline full" data-do="cover" data-target="${n.target}">🛡️ ${game.panels.find((p) => p.id === n.target)?.covered ? "Uncover" : "Cover"} panel · costs its power today</button>`,
    );
}
const bar = (
  name: string,
  icon: string,
  value: number,
  color: string,
  help: string,
) =>
  `<div class="resource"><span class="resource-icon">${icon}</span><div><div class="resource-name"><span title="${help}">${name}</span><b>${Math.round(value)}${name === "Power" ? " blocks" : "%"}</b></div><div class="resource-track"><i style="width:${name === "Power" ? Math.min(100, (value / 14) * 100) : value}%;background:${color}"></i></div></div></div>`;
function draw() {
  if (!started) return;
  const p = game.players[id];
  if (!p) return;
  const n = nearest();
  const active =
    game.event && game.clock >= game.event.at && !game.event.resolved
      ? game.event
      : null;
  const remaining = Math.max(0, Math.ceil(B.solSeconds - game.clock));
  const bag = Object.entries(p.bag).filter(([, v]) => v && v > 0);
  const phaseName =
    game.phase === "day" ? "EXPLORATION" : game.phase.toUpperCase();
  ui.innerHTML = `<section class="panel stats"><div class="sol-row"><strong>SOL ${String(game.sol).padStart(2, "0")}</strong><span>/ ${B.missionSols}</span><small>${phaseName}</small></div><div class="sol-track"><i style="width:${(game.clock / B.solSeconds) * 100}%"></i></div><div class="sol-meta">1 sol ≈ 24h 39m <span>${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}</span></div>${bar("Power", "⚡", game.phase === "power" ? budget(game) : game.power, "#facc15", "Shared electricity available each sol")}${bar("Air", "💨", game.air, "#38bdf8", "Air for the crew to breathe")}${bar("Food", "🥔", game.food, "#4ade80", "Food left for the crew")}${bar("Dose", "☢️", game.dose, "#fb7185", "Cumulative radiation received. It never decreases.")}</section><section class="panel goals"><div class="eyebrow">THE WAY HOME <span>${connection ? esc(connection.room) : "SOLO / OFFLINE READY"}</span></div>${[
    ["radio", "📡", "Fix the radio"],
    ["shelter", "🛡️", "Build a shelter"],
    ["greenhouse", "🌱", "Grow a garden"],
  ]
    .map(
      ([k, ico, t]) =>
        `<div class="goal-row"><span class="check ${game.built.includes(k) ? "done" : ""}">${game.built.includes(k) ? "✓" : ""}</span><span>${ico} ${t}</span>${k === "radio" ? `<small>${game.radio}/${B.radioTarget}${game.aligned ? " ✓" : " · align"}</small>` : ""}</div>`,
    )
    .join(
      "",
    )}<div class="goal-foot">Survive to sol 15 · keep power stable</div></section><div class="top-tools"><button data-do="help" aria-label="Help">?</button><button data-do="pause" aria-label="Pause or crew menu">Ⅱ</button><button data-do="mute" aria-label="Toggle sound">${muted ? "♩ OFF" : "♫ ON"}</button></div>${active ? `<button class="alert ${active.kind}" data-do="event">${active.kind === "storm" ? `🌫️ DUST STORM IN ${Math.max(0, Math.ceil(active.at + B.stormWarningSeconds - game.clock))}s · Store supplies & cover panels` : active.kind === "flare" ? "☀️ SOLAR FLARE · Choose how to respond" : active.kind === "leak" ? "💨 AIR LEAK · Patch the oxygen station" : "📦 SUPPLY CACHE"}</button>` : ""}<section class="panel chat"><div class="eyebrow">📡 CREW CHANNEL <span>${Object.keys(game.players).length} / 4</span></div>${game.messages
    .slice(-2)
    .map((m, i) => `<p class="${i === 1 ? "recent" : ""}">${esc(m)}</p>`)
    .join(
      "",
    )}<div class="fact-callout"><b>REAL OR GAME?</b><p>${game.event?.kind === "storm" ? "Mars dust blocks sunlight. Flying heavy crates are a game exaggeration: real Mars air is very thin." : "Dose means radiation received. It adds up; resting cannot erase the radiation already received."}</p></div><div class="chat-actions"><button data-do="quick" data-index="0">❄️ Found ice</button><button data-do="quick" data-index="1">🔧 Meet here</button></div></section><div class="bottom-center">${n && game.phase === "day" ? `<button class="interact" data-do="interact"><kbd>E</kbd> ${esc(n.text)}</button>` : '<div class="explore-hint">Follow the cyan beacons. Bring the crew home.</div>'}<div class="panel hotbar">${Array.from({ length: 5 }, (_, i) => `<button class="slot ${selected === i ? "sel" : ""}" data-do="slot" data-index="${i}" title="${bag[i] ? itemNames[bag[i][0] as Item] : "Empty slot"}"><small>${i + 1}</small>${bag[i] ? `${icons[bag[i][0] as Item]}<b>${bag[i][1]}</b>` : "<span>·</span>"}</button>`).join("")}<button class="pack-action" data-do="drop" title="Drop selected stack">↥</button></div><div class="key-hints"><span><kbd>W A S D</kbd> walk</span><span><kbd>E</kbd> interact</span><span><kbd>B</kbd> build</span><span><kbd>Q</kbd> scan map</span></div></div><section class="panel crew-status"><span class="eyebrow">YOUR CREW ROLE</span><select id="role-select" aria-label="Crew role">${["Engineer", "Scientist", "Medic", "Comms"].map((r) => `<option ${r === p.role ? "selected" : ""}>${r}</option>`).join("")}</select><small>${{ Engineer: "Builds twice as fast", Scientist: "Science beacon guide on the map", Medic: `Crew dose: ${Math.round(game.dose)} / 100`, Comms: "Gets 10 more seconds of event warning" }[p.role]}</small><button data-do="map">Field map ↗</button></section><div id="touch"><div id="joystick"><div></div></div><button data-do="interact" aria-label="Interact">E</button></div>`;
  const s = $("#role-select") as HTMLSelectElement;
  s.onchange = () => act({ type: "role", role: s.value });
  if (phase !== game.phase) {
    phase = game.phase;
    close();
    if (phase === "power") powerScreen();
    if (phase === "summary") summary();
    if (phase === "ended") ended();
  }
  if (modal === "flare" && game.event?.resolved) close();
}
function mapScreen() {
  open(
    "map",
    `${subtitle("GALE CRATER / FIELD MAP")}<h2>Your little corner<br>of a big planet.</h2><div class="field-map"><span class="north">N ↑</span>${Object.entries(
      stations,
    )
      .map(
        ([k, pos]) =>
          `<div style="left:${50 + pos.x * 2}%;top:${50 + pos.z * 2}%" title="${k}"><b>${k === "workbench" ? "🏠" : "🔹"}</b><small>${esc(k)}</small></div>`,
      )
      .join(
        "",
      )}${game.items.map((i) => `<div class="map-item" style="left:${50 + i.x * 2}%;top:${50 + i.z * 2}%" title="${itemNames[i.kind]}">${icons[i.kind]}</div>`).join("")}${Object.values(
      game.players,
    )
      .map(
        (p) =>
          `<div class="map-player" style="left:${50 + p.x * 2}%;top:${50 + p.z * 2}%">●<small>${esc(p.name)}</small></div>`,
      )
      .join(
        "",
      )}</div><p class="note">Cyan beacons hold science lessons. The house is your workbench and safe storage. The orange dot is you. ${game.players[id].role === "Scientist" ? "Scientist tip: learn growing food and shielding early." : ""}</p>`,
  );
}
async function connect(join: boolean) {
  const name = ($("#crew-name") as HTMLInputElement).value,
    url = ($("#server-url") as HTMLInputElement).value.trim(),
    code = ($("#room-code") as HTMLInputElement).value.trim().toUpperCase();
  if (join && !/^[A-Z]{4}$/.test(code)) {
    toast("Enter the four-letter code from your friend.");
    return;
  }
  try {
    if (!/^wss?:\/\//.test(url))
      throw Error("Use a ws:// or wss:// server address.");
    const conn = new CrewConnection(url);
    conn.onError = toast;
    conn.onState = (s) => {
      game = s;
      if (started) draw();
    };
    await conn.join(
      name,
      join ? code : undefined,
      Math.floor(Math.random() * 1e6),
    );
    connection?.close();
    connection = conn;
    id = conn.id;
    started = true;
    world.menu = false;
    phase = "";
    close();
    draw();
    toast(`Crew ${conn.room}: share these four letters with your friends.`);
    localStorage.setItem("crew-url", url);
    conn.onClose = () => {
      started = false;
      open(
        "disconnected",
        `${subtitle("SIGNAL LOST")}<h2>The crew connection<br>was interrupted.</h2><p>The shared mission cannot continue without its server. Start a new solo mission, or reconnect to your crew if it is still running.</p><button class="primary full" data-do="solo">Start solo</button><button class="outline full" data-do="crew">Reconnect to crew</button>`,
        false,
      );
    };
  } catch (e) {
    const el = document.querySelector("#crew-error");
    if (el) el.textContent = (e as Error).message;
    else toast((e as Error).message);
  }
}
let buildingTimer: ReturnType<typeof setTimeout> | null = null;
document.addEventListener("click", (e) => {
  const el = (e.target as HTMLElement).closest<HTMLElement>("[data-do]");
  if (!el || el.hasAttribute("disabled")) return;
  const d = el.dataset;
  switch (d.do) {
    case "solo":
      start();
      break;
    case "resume":
      start(true);
      break;
    case "crew":
      crewScreen();
      break;
    case "create":
      void connect(false);
      break;
    case "join":
      void connect(true);
      break;
    case "close":
      close();
      break;
    case "tutorial":
    case "help":
      tutorial();
      break;
    case "tutorialDone":
      try {
        localStorage.setItem("outpost-tutorial", "1");
      } catch {}
      close();
      if (started && game.phase === "power") powerScreen();
      break;
    case "sources":
      sourceScreen();
      break;
    case "mute":
      muted = !muted;
      draw();
      break;
    case "pip": {
      const k = d.k as keyof Allocation,
        v = Number(d.v);
      if (total(draft) - draft[k] + v <= budget(game)) {
        draft[k] = v;
        powerBody();
      } else toast("No blocks left. Take one from another job first.");
      break;
    }
    case "lock":
      act({ type: "power", value: draft });
      if (game.phase === "day" || connection) close();
      break;
    case "next":
      act({ type: "next" });
      break;
    case "interact":
      interact();
      break;
    case "bench":
      bench();
      break;
    case "store":
      act({ type: "store" });
      setTimeout(bench, 130);
      break;
    case "answer": {
      const f = facts.find((f) => f.id === d.fact)!;
      if (Number(d.answer) === f.correct) {
        act({ type: "learn", fact: d.fact, answer: Number(d.answer) });
        toast("Science learned! Your whole crew can use this recipe.");
        close();
      } else toast("Almost. Read the field note and try again.");
      break;
    }
    case "build": {
      act({ type: "beginBuild", recipe: d.recipe });
      const wait =
        game.players[id].role === "Engineer"
          ? B.engineerBuildSeconds
          : B.buildSeconds;
      open(
        "building",
        `${subtitle("CREW AT WORK")}<h2>Building something<br>that matters.</h2><div class="build-progress" style="--duration:${wait}s"><i></i></div><p>Stay at the workbench. Engineer builds take 2 seconds; other roles take 4.</p>`,
        false,
      );
      buildingTimer = setTimeout(
        () => {
          act({ type: "finishBuild" });
          close();
        },
        wait * 1000 + 250,
      );
      break;
    }
    case "clean":
      task("clean", d.target);
      break;
    case "cover":
      act({ type: "cover", target: d.target });
      close();
      break;
    case "task":
      task(d.kind!);
      break;
    case "finishTask": {
      if (!taskState) break;
      let value: unknown = taskState.count;
      if (taskState.kind === "align")
        value = Number(($("#needle") as HTMLInputElement).value);
      if (taskState.kind === "wire")
        value = [...taskState.wires].sort().join(",");
      if (taskState.kind === "water") {
        value = Number(($("#water") as HTMLInputElement).value);
        if (Number(value) < 90) {
          toast("Move the water all the way to the plants.");
          break;
        }
      }
      if (performance.now() - taskState.start < 2100) {
        toast("Take a moment—finish the task before checking it.");
        break;
      }
      if (taskState.kind === "clean" && Number(value) < 18) {
        toast("Keep brushing; clear at least 18 patches.");
        break;
      }
      if (taskState.kind === "wire" && value !== "0,1,2") {
        toast("Match all three colors first.");
        break;
      }
      if (taskState.kind === "align" && Math.abs(Number(value) - 72) > 5) {
        toast("Move the needle into the green zone.");
        break;
      }
      if (taskState.kind === "patch" && value !== 3) {
        toast("Patch all three holes first.");
        break;
      }
      act({ type: "finishTask", value });
      close();
      taskState = null;
      break;
    }
    case "choice":
      act({ type: "choice", choice: d.choice });
      if (game.event?.resolved || connection) close();
      break;
    case "event":
      if (game.event?.kind === "flare") flare();
      else if (game.event?.kind === "leak") {
        toast(
          "Walk to the oxygen science station, then press its repair button.",
        );
      } else
        toast(
          `${game.panels.filter((p) => p.covered).length}/${game.panels.length} panels covered. Store loose supplies at the workbench before the storm.`,
        );
      break;
    case "quick":
      act({ type: "chat", index: Number(d.index) });
      break;
    case "slot":
      selected = Number(d.index);
      break;
    case "drop": {
      const bag = Object.entries(game.players[id].bag).filter(
        ([, v]) => v && v > 0,
      );
      if (bag[selected]) act({ type: "drop", kind: bag[selected][0] });
      break;
    }
    case "map":
      mapScreen();
      break;
    case "pause":
      open(
        "pause",
        `${subtitle(connection ? "CREW MISSION / CLOCK CONTINUES" : "SOLO MISSION / PAUSED")}<h2>Take a breath.</h2><p>${connection ? "Your crew’s mission continues while you read." : "Your solo mission pauses here. Your last save is kept on this device. Mission seed: ${game.seed}."}</p><button class="primary full" data-do="close">Back to the crew →</button><button class="outline full" data-do="sources">NASA data & credits</button><button class="outline full" data-do="menu">Mission control</button>`,
      );
      break;
    case "menu":
      connection?.close();
      connection = null;
      menu();
      break;
    case "retry":
      connection?.close();
      connection = null;
      start();
      break;
  }
});
document.addEventListener("click", (e) => {
  const el = (e.target as HTMLElement).closest<HTMLElement>(
    "[data-wire],[data-hole],[data-dust]",
  );
  if (!el || !taskState || el.classList.contains("cleared")) return;
  if (el.dataset.hole !== undefined || el.dataset.dust !== undefined) {
    el.classList.add("cleared");
    taskState.count++;
  } else if (el.dataset.side === "0") {
    taskState.left = Number(el.dataset.wire);
    document
      .querySelectorAll('[data-side="0"]')
      .forEach((b) => b.classList.remove("active"));
    el.classList.add("active");
  } else if (taskState.left === Number(el.dataset.wire)) {
    const n = Number(el.dataset.wire);
    if (!taskState.wires.includes(n)) taskState.wires.push(n);
    document
      .querySelectorAll(`[data-wire="${n}"]`)
      .forEach((b) => b.classList.add("cleared"));
    taskState.left = null;
  } else toast("Match the same color and shape.");
});
let scrubbing = false;
document.addEventListener("pointerdown", (e) => {
  if ((e.target as HTMLElement).closest("#scrub")) scrubbing = true;
});
document.addEventListener("pointermove", (e) => {
  if (scrubbing && taskState?.kind === "clean") {
    const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement;
    if (el?.dataset.dust !== undefined && !el.classList.contains("cleared")) {
      el.classList.add("cleared");
      taskState.count++;
    }
  }
});
document.addEventListener("pointerup", () => (scrubbing = false));
const keys = new Set<string>();
let joy = { x: 0, z: 0 },
  joyPointer: number | null = null;
addEventListener("keydown", (e) => {
  if ((e.target as HTMLElement).matches("input,select,textarea")) return;
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key))
    e.preventDefault();
  keys.add(e.key.toLowerCase());
  if (e.repeat) return;
  if (
    e.key === "Escape" &&
    modal &&
    !["power", "summary", "ended", "building"].includes(modal)
  )
    close();
  if (!started || game.phase !== "day") return;
  if (e.key.toLowerCase() === "e") interact();
  if (e.key.toLowerCase() === "b" && !modal) {
    if (distance(game.players[id], stations.workbench) <= B.interactRadius)
      bench();
    else toast("Walk to the hab workbench to build.");
  }
  if (e.key.toLowerCase() === "q" && !modal) mapScreen();
  if (/^[1-5]$/.test(e.key)) selected = Number(e.key) - 1;
});
addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));
addEventListener("blur", () => {
  keys.clear();
  joy = { x: 0, z: 0 };
});
document.addEventListener("pointerdown", (e) => {
  if ((e.target as HTMLElement).closest("#joystick")) {
    joyPointer = e.pointerId;
    joystick(e);
  }
});
document.addEventListener("pointermove", (e) => {
  if (e.pointerId === joyPointer) joystick(e);
});
document.addEventListener("pointerup", (e) => {
  if (e.pointerId === joyPointer) {
    joyPointer = null;
    joy = { x: 0, z: 0 };
  }
});
function joystick(e: PointerEvent) {
  const r = document.querySelector("#joystick")?.getBoundingClientRect();
  if (!r) return;
  joy = {
    x: Math.max(-1, Math.min(1, (e.clientX - r.left - r.width / 2) / 40)),
    z: Math.max(-1, Math.min(1, (e.clientY - r.top - r.height / 2) / 40)),
  };
}
let last = performance.now(),
  fixed = 0,
  redraw = 0,
  saveAt = 0,
  lastMove = "",
  inputAt = 0;
function frame(now: number) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  fixed += dt;
  redraw += dt;
  if (started) {
    const x =
        (keys.has("d") || keys.has("arrowright") ? 1 : 0) -
        (keys.has("a") || keys.has("arrowleft") ? 1 : 0) +
        joy.x,
      z =
        (keys.has("s") || keys.has("arrowdown") ? 1 : 0) -
        (keys.has("w") || keys.has("arrowup") ? 1 : 0) +
        joy.z;
    const moving = modal || document.hidden ? { x: 0, z: 0 } : { x, z };
    const sig = JSON.stringify(moving);
    if (sig !== lastMove || (now - inputAt > 1000 && connection)) {
      act({ type: "move", ...moving });
      lastMove = sig;
      inputAt = now;
    }
    while (fixed >= 0.1) {
      if (!connection && modal !== "pause" && !document.hidden) tick(game, 0.1);
      fixed -= 0.1;
    }
    if (redraw > 0.2) {
      if (joyPointer === null && !document.activeElement?.matches("select"))
        draw();
      redraw = 0;
    }
    if (!connection && now - saveAt > 2000 && game.phase !== "ended") {
      try {
        saved = structuredClone(game);
        localStorage.setItem(
          "outpost-save-v1",
          JSON.stringify({ version: 1, game }),
        );
      } catch {}
      saveAt = now;
    }
  } else {
    game.elapsed += dt;
    fixed = 0;
  }
  world.update(game, id, dt);
  requestAnimationFrame(frame);
}
menu();
requestAnimationFrame(frame);
if ("serviceWorker" in navigator && import.meta.env.PROD)
  navigator.serviceWorker
    .register(`${import.meta.env.BASE_URL}sw.js`)
    .catch(() => {});
// Read-only diagnostics used for manual QA; gameplay still goes through the simulation.
Object.defineProperty(window, "outpost", {
  value: {
    get state() {
      return structuredClone(game);
    },
    get fps() {
      return Math.round(world.fps);
    },
  },
});
