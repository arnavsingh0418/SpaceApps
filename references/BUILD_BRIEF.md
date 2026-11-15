# Build prompt: "Outpost Down" (working title), a NASA Space Apps 2026 game

> Paste everything below into Codex. Attach the 4 screenshots (`scene-1.png` … `scene-4.png`) and the mockup file `concept-scenes/index.html`.

---

## 0. Who you are and what we're building

You are building a **browser game** for the **2026 NASA Space Apps Challenge**, challenge **"Build a Junior Astronaut Mission Trainer"**
(https://www.spaceappschallenge.org/2026/challenges/junior-astronaut-mission-trainer/).

The challenge, summarized:
- Build an **interactive game for kids ages 7–12** where they **manage a lunar or Martian outpost**.
- They make real decisions about **life support, radiation shielding, power budgeting, food production, and communication delay**, and see how those choices play out over a simulated mission.
- **No choice is free.** Every decision must be a real trade-off ("a choice that saves power today might cost oxygen tomorrow").
- **Ground it in real NASA open data**: DONKI (space weather and solar flares), OSDR (astronaut health and radiation research), and Mars surface mission data. **Attribute data sources inside the game.** Never present static data as live.
- **Keep it simple for kids.** Track 2–3 core resources, not 6. Use plain language, and explain words like "sol", "dose" and "microgravity" right where they appear.
- **Browser playable, no download, no account.**
- What stands out to judges:
  - linking in-game choices to real space weather
  - replayability (events differ each run)
  - failure that teaches without feeling punishing
  - a short explanation of which NASA datasets were used and why

We have about 48 hours. **A simple game that teaches a real constraint beats a beautiful one that doesn't.** Prioritize working mechanics over polish.

---

## 1. The story

1. **Crash landing.** A crew of up to **4 friends** (the players) is flying a mission to Mars. The landing goes wrong and they crash inside a crater. The ship is wrecked and the **radio is half broken**.
2. **The call.** Mission Control gets through for a few seconds: *"We can't send a rescue ship. Earth and Mars only line up for a launch about every 26 months, and we're low on resources. You'll have to survive and fix things yourselves. Fix the radio and we can guide you home."* (The 26-month launch window is a real fact, so use it.)
3. **Goal.** Survive a set number of **sols** (Mars days, 24 h 39 min), gather materials, learn what you need to know, and build the **radio**, a **shelter** and a **greenhouse** to win. Winning means the radio is fixed and power is stable when the return vehicle's launch window opens.
4. **Pressure that keeps building:**
   - **Dust storms** come every few sols. They bury solar panels (power drops) and damage anything left outside.
   - **Dust devils** roam the map and steal loose items.
   - **Solar flares** (from real DONKI data) raise radiation dose unless the crew shelters.
   - Air, food and power drain every sol.

The feel we want: **Roblox + Minecraft gathering and building, plus Among Us-style crew tasks, plus the tension of surviving through nights**. All of it must be **original**: our own characters, art and names. Do not copy any existing game's characters, art, UI or levels.

---

## 2. Visual style (match the attached screenshots)

The attached `scene-1.png` … `scene-4.png` and `concept-scenes/index.html` are **our approved mockups, built in three.js**. Match this look:
- **Simple low-poly 3D, flat-shaded** (`MeshStandardMaterial` with `flatShading: true`), soft shadows, and warm Mars colors (ground about `#c4562a`, sky about `#e0a982`, fog the same tone). **No pixel art.**
- **Third-person camera** angled about 30–40° down behind and above the player, with the horizon visible. Not straight top-down.
- **Chunky, cute astronauts:** capsule body, big round white helmet, a large glowing cyan visor that faces forward, a backpack box, and short legs. One suit color per player (orange, blue, green, yellow). **Name tags** float above each head.
- Props are simple primitives: the wrecked ship (cylinder, cone and fins, with smoke), white hab domes, a transparent greenhouse tunnel with little green plants, solar panels on posts, a radio dish on a mast, crates, ice chunks, and dodecahedron rocks.
- **The UI is an HTML overlay** on top of the canvas, with dark rounded panels (`rgba(20,14,12,.82)`), bold friendly font, and emoji icons:
  - top left: **SOL counter** plus **4 bars**: ⚡ Power, 💨 Air, 🥔 Food, ☢️ Dose
  - top right: **crew goals / checklist**
  - bottom center: **hotbar** (item slots with counts)
  - bottom left: **team chat** and "Real astronaut fact" cards (blue panel)
  - world-space prompts like **"E Pick up Solar Panel"** projected above objects
  - big top-center **alert banners** for storms and flares
  - **choice cards** for decisions, each option showing its cost in red and its benefit in green
- Reuse the builder functions in `concept-scenes/index.html` (`astronaut()`, `wreck()`, `dome()`, `greenhouse()`, `panel()`, `dish()`, `crate()`, the label projection) as the starting point for the real game.

What each screenshot shows:
- **scene-1 (Explore & gather):** players walk around the crash site; pickups have glowing rings; hotbar, crew goals, chat.
- **scene-2 (Split today's power):** the core trade-off UI. A daily power budget (for example 10 blocks) shared out with pip sliders between Air machine / Greenhouse lights / Radio / Heaters; one panel is dusty, so power is lower.
- **scene-3 (Solar flare):** a real DONKI flare triggers a choice card ("Everyone into the shelter" costs food; "Finish the radio first" costs dose; "Stack ice blocks on the hab" costs power but helps next time). Mission Control's warning arrives late because of the comms delay.
- **scene-4 (Dust storm):** a countdown banner, a storm checklist, a dust devil sucking up loose crates, and players carrying items into the hab ("E Store in hab, 2 slots left").

---

## 3. Core gameplay loop (one sol = about 3–4 real minutes of play)

1. **Morning: power split.** The game shows today's power (from the number of panels × how clean they are × storm factor). Players spend power blocks between:
   - **Air machine:** below the minimum, Air drains.
   - **Greenhouse lights:** more light means more food tomorrow.
   - **Radio:** progress on contacting Earth, and receiving forecasts.
   - **Heaters:** below the minimum, everyone moves slower, and Air drains a bit at night.
   - **Shielding / building:** optional.
   One player (the Comms officer) or a crew vote locks it in.
2. **Day: explore, gather, build.** WASD + mouse (or touch joystick). Pick up items with **E**. Items go to a personal hotbar with limited slots, so carrying things back to base matters. Build at the **workbench** in the hab.
3. **Events** (seeded random, varied each playthrough): dust storm warning, dust devil, solar flare (DONKI), equipment failure (an Among Us-style mini-task to fix it), supply drop from an old lander.
4. **Night: sol summary.** Resources tick: Air, Food and Power are consumed, and Dose is added. A friendly summary card explains *why* things went up or down in one sentence each ("Your greenhouse got only 2 light blocks, so it grew less food").
5. **Win / lose:**
   - **Win:** radio, shelter and greenhouse are built and the crew survives until sol N (for example 15).
   - **Lose:** Air or Food reaches 0, or Dose reaches max. **Losing is not punishing.** Show what happened, what a real astronaut would have done, and a **"Try again with a new storm pattern"** button.

### Learn before you craft (this is where the education comes in)
Each important recipe is **locked until the crew learns the fact behind it**. You learn by scanning an object, finding a data log in old lander wreckage, or doing a 30-second mini-lesson card with one question.
- **Radiation shelter:** learn that water, ice and soil (regolith) block radiation. Recipe: ice blocks + regolith bags + scrap frame.
- **Radio fix:** learn that radio signals take **3–22 minutes** to travel between Earth and Mars, and that the dish must point at Earth or at a satellite overhead. Recipe: antenna + battery + circuit board, plus an alignment mini-task.
- **Greenhouse:** learn that plants need light, water and warmth, and that Martian soil contains **perchlorates** (toxic salts) that must be washed out. Recipe: transparent panels + washed soil + ice (water) + seeds.
- **Power:** learn that dust on panels lowers power (it really happened to the Spirit and Opportunity rovers; wind sometimes cleaned them). Recipe: battery bank + panel stands. Includes a "brush the panel" mini-task.
- **Water and air from ice:** learn that ice can be melted for water, and that oxygen can be made from Mars's CO₂ air (NASA's **MOXIE** experiment on Perseverance did this). Recipe: ice melter, O₂ maker.
Keep every fact to 1–2 short sentences a 9-year-old understands. Each fact card cites its source (NASA page or dataset).

### Mini-tasks (Among Us-style, 10–30 seconds each, mouse or touch)
- Align the radio dish: drag a needle until the signal bar turns green.
- Brush dust off a solar panel: scrub with the mouse.
- Wire the circuit: connect matching colors.
- Patch a leak: click the holes before the air bar drops.
- Water the plants: drag the ice melter output.

### The 4 crew roles (co-op; each role makes some tasks faster, and anyone can do anything)
- 🔧 **Engineer:** builds and repairs 2× faster.
- 🔬 **Scientist:** scans to unlock facts and recipes; sees item info.
- 🩺 **Medic:** sees everyone's dose; can treat and rest the crew.
- 📡 **Comms officer:** sees storm and flare forecasts early, and locks in the power split.
With 1 player, they can switch roles freely. With 2–3, roles are shared.

---

## 4. Simulation rules (keep numbers simple, honest and tunable)

Put all numbers in **one config file** (`src/data/balance.json`) so we can tune them, and write a **pure, deterministic simulation module** (`src/sim/`) with no DOM and no three.js, and with a **seeded RNG** so playthroughs can be replayed and tested.

Suggested starting values (0–100 scale for bars):
- Power per sol = `panelsBuilt × 3 × panelCleanliness(0–1) × stormFactor(1.0 clear, 0.4 storm)`, plus 2 from the emergency battery.
- Air: −8/sol if the air machine gets fewer than 3 blocks; +5 if it gets 4 or more.
- Food: −10/sol for the crew; the greenhouse adds `lightBlocks × 4`.
- Dose: +2/sol normally; +15 to +30 during a flare if unsheltered; +3 if sheltered. Max 100 = mission over. Dose never goes down (it's cumulative, which is a real fact; show it).
- Storms: each panel left uncovered loses 30–60% cleanliness; each uncovered loose item has a 50% chance to be damaged (worth half) or carried off.
- Dust devils: wander on a path; any loose item they touch is picked up and dropped somewhere random within 20 m.
- **Every decision must have a cost.** Check this: there must be no option in any choice card that is free. Write a unit test that asserts it.

---

## 5. Real NASA data (judges care about this; it's required to stand out)

1. **DONKI solar flares** (NASA Space Weather Database), via `https://api.nasa.gov/DONKI/FLR?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&api_key=DEMO_KEY`.
   - Ship a **curated embedded JSON** of real past flares (`src/data/donki_flares.json`, fetched once at build time with a script; keep `classType`, `beginTime`, `peakTime`, `sourceLocation`).
   - Each in-game flare event draws one **real flare**. Its class (C, M, X) scales the dose. Show on the card: *"Real flare: X8.7 on 14 May 2024, from NASA DONKI."*
   - Optional "Live mode": try the live API for the last 30 days. If it fails or there's no key, fall back to the embedded data and **label it "archived data"**, never "live".
2. **Radiation numbers:** Curiosity's **RAD** instrument measured about **0.67 mSv/day** on the Mars surface (Hassler et al., Science 2014). Use it to explain the dose bar ("1 sol on Mars ≈ the radiation of several chest X-rays"; keep comparisons accurate and cite them).
3. **OSDR (NASA Open Science Data Repository)**, https://osdr.nasa.gov: pick 1–2 real findings about radiation or spaceflight effects on astronaut health, or plant growth in space, for fact cards. Cite the study ID.
4. **Mars environment:** temperature swings (about −80 °C nights near the equator, from Curiosity REMS / Perseverance MEDA), thin air (under 1% of Earth's pressure), and the 2018 global dust storm that ended Opportunity. Embed small curated values with citations.
5. **Comms delay:** compute the current Earth–Mars light-time from a simple ephemeris, or use a curated table. Mission Control messages in the game arrive with that delay (sped up for gameplay, but state the real value).
6. A **"Data Sources" screen** reachable from the main menu, listing every dataset, what it's used for, and links. Judges explicitly reward traceable science.

Ask me before adding any API key to the repo. Use `DEMO_KEY` or an `.env` that's gitignored.

---

## 6. Multiplayer (up to 4 players, keep it simple and reliable)

- **Room code lobby:** "Create crew" gives a 4-letter code; friends "Join crew" with it. No accounts.
- **Server-authoritative simulation:** the server runs the sim (the same `src/sim/` module) and broadcasts state; clients send inputs (move, pick up, build, vote, power split).
- Recommended stack: **Colyseus** (Node, rooms + state sync) *or* **PartyKit / Cloudflare Durable Objects**. Pick one and justify it in the README. A plain `ws` WebSocket server is acceptable if it's simpler.
- Sync at 10–20 Hz with interpolation for remote players. Items, structures and resources are server state.
- **Single-player must work offline** with the same sim running locally, so judges can play even if the server is down.
- Deploy the client as a static site (Vercel, Netlify or GitHub Pages) and the server on Render, Fly.io or Railway. Document both.

---

## 7. Tech stack and project structure

- **Vite + TypeScript + three.js** (pin a version, for example `three@0.186.x`). No heavy engine.
- Optional helpers: `camera-controls` or a simple custom follow camera; `lil-gui` for debug tuning (hidden in production).
- Plain HTML/CSS for the UI overlay (no framework needed; Preact is fine if you prefer).
- Suggested layout:
  ```
  /client
    index.html
    src/main.ts            // boot, menus, scene switch
    src/render/            // three.js scene, builders (astronaut, dome, wreck...), camera, labels
    src/ui/                // HUD bars, hotbar, choice cards, power split, chat, fact cards, minigames
    src/net/               // multiplayer client
    src/input/             // keyboard, mouse, touch joystick
  /server
    src/room.ts            // game room, authoritative sim loop
  /shared
    src/sim/               // PURE simulation: resources, events, storms, dust devils, recipes, seeded RNG
    src/data/              // balance.json, recipes.json, facts.json, donki_flares.json, events.json
  /scripts
    fetch-donki.mjs        // builds donki_flares.json from the NASA API
  /tests                   // sim unit tests (vitest)
  README.md                // how to run, deploy, datasets used, team credits
  ```

---

## 8. Build order (milestones; each must be playable before moving on)

1. **M1 Single-player walkaround:** the crater map, your astronaut moving with WASD and a follow camera, the wreck, rocks, pickups with "E" prompts, the hotbar, and HUD bars. Match the screenshot style.
2. **M2 Sim + sol loop:** pure sim module with tests; morning power split UI (scene-2), night summary, win/lose screens.
3. **M3 Learn → craft:** facts.json + recipes.json, the scanner / fact cards, workbench crafting for shelter, radio and greenhouse.
4. **M4 Events:** dust storm with countdown + checklist (scene-4), dust devils, solar flare choice card with real DONKI data (scene-3), 3 mini-tasks.
5. **M5 Multiplayer:** lobby with room codes, 2–4 players, roles, synced items and structures, team chat (preset quick messages are fine, and safer for kids).
6. **M6 Polish for judging:** title screen, a 60-second tutorial, Data Sources screen, sound effects (CC0), mobile/touch support, and a deployed URL.

After each milestone: run the tests, run the game in a browser, and fix console errors.

---

## 9. Acceptance tests (the game is done when all of these pass)

- [ ] Opens from a URL in Chrome with no install or login; first playable within 10 seconds.
- [ ] A 9-year-old can understand every on-screen word, or it has a tooltip.
- [ ] Every choice card option has a visible cost (unit test asserts no free option).
- [ ] The power split visibly changes Air and Food the next sol, and the night summary explains why.
- [ ] A solar flare event shows a real DONKI flare (class + date) with attribution.
- [ ] A dust storm damages or removes items left outside and dims uncovered panels; stored items are safe.
- [ ] Each of shelter, radio and greenhouse is locked until its fact is learned.
- [ ] Two browsers can join the same room code, see each other move, and pick up shared items without duplication.
- [ ] Single-player works with the server offline.
- [ ] The same seed gives the same event sequence (sim test).
- [ ] Losing shows what happened plus a "try again" button; no game-over shaming.
- [ ] The Data Sources screen lists every dataset with links.
- [ ] Runs at 60 fps on a mid-range laptop (keep draw calls low; use instancing for rocks).

---

## 10. Rules for you (Codex)

- Keep science accurate. If you aren't sure a fact is true, mark it `// TODO verify` and tell me; don't invent numbers.
- Don't present archived data as live.
- Don't copy any existing game's art, characters, names or UI. Everything is original.
- Keep the sim pure and tested; keep rendering separate.
- Commit after each milestone with a clear message.
- When you finish a milestone, tell me how to run it and what to test by hand.
