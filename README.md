# Outpost Down

A browser-based Mars survival game for one to four explorers. Built from the supplied Outpost concept scenes and build brief, with original low-poly astronaut and prop builders preserved in `client/src/render/builders.js`.

## Run locally

Requires Node.js 22.12+ (Node 24 recommended).

```sh
npm ci
npm run dev
```

Open the Vite URL (normally http://localhost:5173). Solo play needs no account, backend, or NASA key. The production build precaches its code, fonts, and data for offline use after the first successful online load. A solo mission saves locally every two seconds; use **Continue mission** after reloading.

For co-op, run a second terminal:

```sh
npm run server
```

Choose **Play with friends → Create crew**. Send the five-digit code shown on the copy button to your friends. They open the same website, choose **Play with friends**, enter the code and click **Join crew**. Nobody enters a server address. Vite forwards local `/crew` connections to the server on port 2567. For a production-style local test, run `npm run build` then `npm run server` and open http://localhost:2567.

## How to play

- WASD or arrow keys: walk. E: interact with the nearest object. B: workbench when nearby. Q: field map. 1–5: choose a hotbar slot; G drops its stack.
- On touch devices, drag the lower-left joystick and tap E. All science lessons, budgets, tasks, and recipes also accept touch.
- Split electricity each morning. At least 3 blocks keeps air steady; 4 adds air. Plants turn light into food only after you build the greenhouse. One heater block keeps the crew warm.
- Follow cyan beacons, read the short field notes, and answer a question. Learned science unlocks recipes for the entire crew.
- Collect materials in a five-slot hotbar. Bring them to the hab workbench to store and build. Storage is shared and safe from storms.
- Build the greenhouse early. Food is eaten every sol. Watering costs one ice and adds food at night.
- Before a dust storm, store loose supplies and cover panels. Covering sacrifices their electricity and takes blocks away from radio, plants, heaters, then air. Clean dirty panels after the storm. Covers come off the next morning.
- Solar flares draw from real, archived NASA DONKI records. Shelter costs food; ice walls cost ice; continuing work adds a larger radiation dose. Ignored flares resolve as continued work after 45 seconds.
- Rebuild the four damaged ship systems and launch before Sol 15 ends. Field investigations, salvage quizzes and Nemi’s shared repair award replacement parts; install them at the return platform. Better parts and base upgrades strengthen the hull at launch. Steering and repairs determine how the flight ends.
- Solo play pauses when its browser tab is hidden or the pause menu is open. Multiplayer keeps running for the crew.

Roles: Engineer builds twice as fast; Scientist gets a field-map tip; Medic sees the shared crew dose; Comms gets 10 more seconds before an event and can lock power. Anyone can gather, learn, build, and complete tasks. The leader can also lock power. All players currently share air, food, and dose.

## Validation

### Wayfarer rover

The six-wheel rover parks southeast of the habitat and appears on the field map. Walk beside it and press **E** to board. The first explorer drives; three more can ride. Use **W/S** to accelerate/reverse, **A/D** to steer and **Space** to brake. On touch screens use the joystick and hold **STOP**. Stop before pressing **E** to exit. A seated passenger can take the wheel after the driver leaves. The camera follows the vehicle while retaining orbit and zoom.

The rover carries the crew and their existing bags. Solar panels and cargo pods are visual equipment; driving does not consume a separate fuel resource or add inventory slots. Solo saves preserve its position and distance travelled. Co-op shares one vehicle, validates driver ownership and bounded movement, and parks it when the driver disconnects. Terrain collision and slope handling run in the driver's client, as with walking.

Rover contact uses a swept footprint, tangential sliding, soft rebounds and finite Mars-gravity falls (3.71 m/s²). Uphill cliffs block the chassis; downhill ledges remove wheel support and the rover lands under gravity. Tire acceleration, braking and lateral grip use gravity-scaled limits. The circular perimeter uses the actual rotated hull corners instead of an extra invisible five-metre inset. Static collision refreshes after Blender visuals load, and rover ground sampling excludes building roofs. A recovery pass moves legacy placements inside solids to nearby clear ground.

Dust devils use a smooth finite-core wind field and 120 Hz integration, shared by solo and co-op. A heavy rover is lifted only in the strong inner updraft; the broader dust skirt warns of the hazard. Gusts collide with the habitat and perimeter, keep occupants synchronized and release driving after landing. Tossing a large crew rover remains a fictional gameplay effect. The effect has a swirling dust volume, terrain-following ground skirt, grit, surface scouring and local visibility loss; it uses three instanced draw calls and respects reduced motion. Preview with `?qaScene=devil-overview`; `?qaScene=rover-recovery` reproduces a legacy hab overlap. Regression tests cover frame-rate consistency, landing/control recovery, ghost colliders and sliding contacts.

The original Blender model and regeneration script are in `assets/blender/`; the game loads `client/public/mars/vehicles/Mars_Rover.glb` with a primitive fallback. Its wheel and steering pivots remain separate for animation. Run `TEST_SERVER=ws://127.0.0.1:2567 node --import tsx tests/rover-multiplayer.ts` with the server running to check boarding races, rider sync, braking, disconnects and driver handoff.

```sh
npm test          # deterministic simulation and gameplay rules
npm run build    # TypeScript + production bundle + offline cache
npm run test:net # with npm run server already running
```

The network integration check connects actual WebSocket clients, checks room membership and remote movement, races a shared pickup, and verifies no duplication and the four-player cap. CI runs all three checks.

Manual checks: start a solo mission, change its budget, gather and store supplies, learn a lesson at a beacon, craft a building, brush a panel, cover and uncover it, and read the night report. Create a crew in one browser and join in another. For offline QA, build and preview, load once online until the service worker finishes installing, reload once, then use browser offline mode and reload again.

## Architecture

- `shared/src/sim/`: pure deterministic state machine. No DOM, WebGL, clock, or network access. Inputs and fixed 100 ms ticks control all state. Seeded randomness controls event sequence and supply displacement.
- `shared/src/data/`: balance, recipes, lessons, source attributions, choice costs, and verified flare archive. Change gameplay numbers in `balance.json`.
- `client/src/render/`: three.js renderer and adapted supplied primitive builders. A Blender GLB terrain map, BVH camera collision, locally responsive astronaut movement and a third-person orbit camera.
- `client/src/main.ts`: HTML HUD, menus, keyboard/touch inputs, mini-tasks, local saves, and the local simulation driver.
- `client/src/net/`: WebSocket client. Remote players interpolate visually; the local controller reports bounded positions while shared actions and rewards are server validated.
- `server/index.ts`: authoritative 10 Hz simulation and room snapshots. Room codes, four-player limit, bounded payloads, per-connection rate limiting, sanitized display names, validated actions, and disconnect cleanup.

Plain **ws** was chosen over a larger room framework to keep the shared state machine transparent and deployable in one Node process. Single-player uses that same module locally. Rooms are ephemeral and disappear when the last player leaves; server restarts do not preserve rooms. No user accounts or freeform chat. Preset quick messages only.

## Science and data provenance

The in-game **NASA data & credits** screen lists every source and its use. DONKI API requests failed with HTTP 503 during development, including with the supplied private NASA key. The bundled records were therefore verified against NASA's published DONKI alert 30944/1, rather than being claimed as a successful API extraction:

https://kauai.ccmc.gsfc.nasa.gov/DONKI/view/Alert/30944/1

The archive includes X8.7 (14 May 2024), X3.9 (10 May), M2.5 and M4.4 (14 May), with recorded start/peak times and source positions. Regenerate from the API when available:

```sh
npm run fetch:donki -- 2024-05-08 2024-05-15
# Optional private key, never committed:
node --env-file=/path/to/private.env scripts/fetch-donki.mjs
```

`NASA_API_KEY` is used only by the fetch script. Failed fetches leave the embedded archive untouched. Never put the key in a `VITE_` variable: those variables are bundled into browser code.

Science boundaries: flare X-ray class is not a Mars particle-dose forecast; dose scaling is a game mechanic. The 0–100 dose bar is cumulative but not calibrated to mSv. RAD's 0.67 mSv/day figure is a historical average at Gale Crater, not a universal constant. OSD-658 studies plant responses to simulated radiation, not plants grown on Mars. Soil washing simplifies real perchlorate treatment research. Heavy-crate tossing by dust devils is an explicitly labeled game exaggeration. The 12-minute one-way comms delay is illustrative, shortened to 12 game seconds; it is not a current orbital calculation. The 15-sol return window is fictional; Earth launch opportunities are roughly 26 months apart.

## Deploy

Client: `npm run build` produces `dist/`, usable on GitHub Pages, Netlify, or Vercel. The included GitHub Actions workflows run checks on every push and offer manual publication to Pages. Enable **Settings → Pages → Source: GitHub Actions** if the repository does not have Pages enabled. Relative asset URLs support repository subpaths such as `/SpaceApps/`. No secrets are needed for the client.

Recommended: deploy the website and game server as **one Render Web Service** using the included `render.yaml`. See [MULTIPLAYER_SETUP.md](MULTIPLAYER_SETUP.md) for exact steps. Build: `npm ci --include=dev && npm run build`. Start: `npm run server`. Health: `/health`. The server serves `dist/` and WebSockets together, so browsers automatically connect to the website’s `/crew` endpoint. No API keys, database, or player server settings are required. Keep one instance: active rooms live in memory and end when everyone leaves or the service restarts.

If you prefer Vercel for the website, deploy the crew server to Render and set `VITE_CREW_SERVER=wss://YOUR-SERVICE.onrender.com/crew` in Vercel before building. Players still use codes only. A static-only preview without that setting cannot host multiplayer.

## Credits and scope

Original supplied concept scenes: preserved in `references/concept-scenes/`. Supplied brief: `references/BUILD_BRIEF.md`. Prior orbital/gesture prototypes were reference material and are not dependencies of this Mars game. three.js, ws, Vite, TypeScript, Vitest, and Fontsource retain their upstream licenses. Nine original normalized WAV effects are bundled locally and played through Web Audio; no external recordings or runtime sound APIs. Fonts are bundled locally for offline use.

The game implements solo survival, co-op, science gates, five mini-task types, events, save/resume, and touch controls. It uses an illustrative comms delay and archived data, with no live NASA mode. Touch layouts are responsive; real-device performance and a 60 fps target need hardware-specific testing. This project is not an official NASA product.

## UI and animation redesign

UI components live in `client/src/ui/`; procedural character/world motion and fixed particle pools live in `client/src/render/`. The expedition adds validated actions to the shared simulation without changing the existing survival win conditions.

Fresh solo missions open with a 5:16, 24-scene short film. Commander Vega, scientist Imani, and engineer Juno prepare in a suit room, receive a mission-control briefing, board and launch, perform a plant experiment during transit, descend through the Mars atmosphere, survive a fictional thruster fault, and step out into the game. The closing flyover uses the playable terrain. Forty-eight bundled, locally synthesized dialogue clips, a procedural score, captions, and science notes work without third-party media services. Sound, pause, previous/next scene, skip, and gentle motion are available; audio and the timeline pause when the tab is hidden. `scripts/generate-film-audio.ts` regenerates voices with macOS `say` and `afconvert`; playback needs neither macOS nor TTS. These are synthetic voices, not recordings of actors or NASA personnel.

## Expedition atlas and field campaign

The top-right minimap expands with a click or **Q** into a north-up atlas rendered from the actual GLB terrain. Seven named sites have physical terminals, numbered flags, distinctive equipment, and 12 investigations across three acts. Pin an available mission to get a bearing, distance, and in-world marker. The dotted line is not a pathfinding route: go around obstacles. The atlas also retains completed science notes and NASA references.

Investigations cover the flight recorder, buried ice, water treatment, solar orientation, weather, sedimentary rocks, clean sampling, radiation shielding, oxygen production, relay alignment, return-vehicle readiness, and reporting evidence. Students inspect all readings, order a procedure, or tune an instrument before answering an evidence question. Incorrect answers provide feedback. Successful investigations unlock dependencies and supply caches beside the terminal, exactly once. All readings and local deposits are explicitly simulated; the map is not an actual Gale Crater survey. Field progress is shared in co-op and saves immediately in solo, including partial measurements. Older saves initialize this optional campaign without resetting their base. Solo time pauses for maps and lessons; co-op continues running.

Verification: `npm test` covers mission prerequisites, proximity, measurement gates, retry feedback, duplicate rewards, complete campaign progression, save compatibility, map coordinates, and voice-clip duration. Run `node --import tsx scripts/check-field-routes.ts` for a conservative terrain-connectivity check against the shipped GLB. Exact building collisions and mobile input still require interactive testing.

After arrival, a mission briefing pauses the game until **Let's explore**. The four-step guide follows actual walk, pickup, growing-science and storage actions. Sol 1 starts with a safe default power allocation; the first interactive power plan appears on Sol 2. **How to play** and **Pause → Field guide** open the field guide with the premise, resource trade-offs, build loop, return objective, and NASA references. Solo gameplay pauses while this guide is open. Continue bypasses the story and briefing. Exploring has four HUD groups (vitals, objective, map and hotbar), contextual world labels, collapsible goals/chat and a pause-menu role picker. Phone layouts show four hotbar slots plus a joystick and action button. Q expands the expedition map, Tab opens goals, T opens chat, G drops, F toggles fullscreen, and Escape exits fullscreen or opens/closes pause. The character has a stable body with limb walking animations; the camera follows its visible position without gameplay shake.

Sound starts muted until a user gesture. The pause menu has mute and volume controls. All nine original WAV files are under 100 KB; regenerate with `python scripts/generate-sfx.py`, then copy the ignored staging files into `client/public/sfx/`.

With the dev server running, browser QA is reproducible:

```sh
npx playwright install chromium
node scripts/tutorial-qa.mjs
node scripts/motion-qa.mjs
node scripts/tasks-qa.mjs
node scripts/responsive-qa.mjs
# With npm run preview serving the production build:
node scripts/offline-qa.mjs
```

The supplied Develop Web Game action client is retained as `scripts/web-game-client.mjs`. `window.render_game_to_text()` exposes read-only state and `window.advanceTime(ms)` supports deterministic local stepping. Scene fixtures exist only in development and are used for visual coverage, separate from real-input interaction checks.

Before/after screenshots and state snapshots are under `references/redesign/`; `progress.md` records coverage and limitations. Final screenshots cover 1600×900, 1280×720 and 390×844. GPU bloom and a new Blender character were skipped to preserve the established lightweight world. Software-rendered QA does not certify 60 fps on a specific laptop. The private preview is https://outpost-down-mars-atreya.encouragingbean1.chatgpt.site; remote co-op still needs a deployed WebSocket server as described above.


## Nemi: shared repairs and ship hardware

Nemi is a fictional alien with a broken water loop near base at (-34, -8). Meet Nemi with E, accept the repair, and bring **3 ice, 2 clear panels and 2 scrap in your bag**. Crew members can split the deliveries. Brush at least six collector patches over two seconds, then explain why melted ice must be treated and tested. The crew receives one **Prototype navigation core**, with contribution credit for helpers. Solo players can complete every step. Progress saves with the mission and syncs through the crew server.

NASA’s SWIM ice mapping and InSight’s dust/power observations ground the lesson. Local deposits, Nemi and alien biology are invented. The dialogue links directly to the NASA sources and separates observations from the fictional repair.

Four field milestones also grant ship hardware: flight recorder → Standard booster; water-loop procedure → Rare life support; shielding test → Rare heat shield; relay alignment → Rare navigation core. Supply rewards remain. Salvage is an alternate part/upgrade route. Rewards never downgrade higher-rarity hardware or duplicate a completed task.

The return platform shows damaged components, replacement plinths and installation arcs with sparks. The repair screen lists each fault, where to find its replacement and which systems are online. Nemi idles, blinks, gestures and animates during dialogue; the collector changes color and the water tank fills on repair. Reduced motion removes large movements.

**No ElevenLabs key is configured and no voice-generation API is called.** Subtitles always work. A device speech voice is used when available; otherwise the dialogue remains text with a brief gesture. Add original pre-generated voice clips later using `client/public/alien/voice.json`; see that folder’s README. Never include a key in the browser build.

New validation: `npm test` includes shared deliveries, action validation, duplicate protection, solo/co-op rewards and component animation state. With the dev server: `node scripts/alien-qa.mjs`. With a crew server: `TEST_SERVER=ws://127.0.0.1:2572 node --import tsx tests/alien-multiplayer.ts` (PowerShell: set `$env:TEST_SERVER` first). Screenshots and state snapshots are in `references/alien-mission/`.

## Fly the rebuilt ship home

Installing all four parts and launching puts the crew inside an enclosed, Blender-authored return ship. The SpaceApps corridor/cockpit layout is recreated as a first-person environment with pressure panels, ceiling lights, service racks, handrails and a window overlooking Earth. WASD/arrows move relative to your view, mouse/drag looks around, E uses nearby stations, and Escape closes a station or opens Pause. Earth grows beyond the cockpit during the compressed three-minute flight. The helm has directional steering and a 30-second autopilot hold: center the marker and lock departure guidance, then lock entry guidance again after 120 seconds. Autopilot lets solo players leave the helm to repair systems.

Five timed faults affect electrical power, oxygen, hull seals and engine cooling. Walk to the relevant station to match circuits, reset valves, seal leaks or tune coolant. Repairs take at least three seconds and update everyone’s ship state. In co-op, one player can steer while others repair; helm ownership, movement, proximity, answers and contributor points are server-validated. Solo pauses in Pause; co-op keeps running. Faults continue while station puzzles are open.

Ship condition and the two guidance locks determine Earth arrival or recovery by a rescue craft, followed by a crew report. The ending has no random success roll. Flight progress saves locally in solo, and older in-flight saves migrate into the cabin. Travel duration, failures and spacecraft systems are fictional gameplay, not a real mission simulation. Remote co-op still requires a separately deployed WebSocket server.

The optional `node scripts/flight-qa.mjs` harness follows the current corridor layout (set `QA_BASE_URL` for a non-default dev port). It covers a full solo journey, repair types, endings, pause, reduced motion and responsive screenshots. `node --import tsx tests/flight-multiplayer.ts` against the crew server verifies two actual clients launching, walking, steering and repairing together. Historical flight screenshots and state snapshots live in `references/flight/`. See the [return-ship model guide](client/public/mars/interiors/RETURN_SHIP.md) for editable sources, layout footprints and regeneration.


## Matching Blender model pack

The game loads the matching Mars asset pack from `client/public/mars/`: 49 self-contained GLBs, 16 transparent UI icons, four crew portraits and title artwork. The playable crew, base structures, pickups, solar cleanliness/covers, radio repair, field-site props and return rocket now use these models. Extra terrain/plant variants and the six-clip astronaut export remain available for further scene authoring. The existing Mars terrain, authoritative simulation, multiplayer protocol and mission costs are preserved.

`client/src/render/modelAssets.ts` caches assets and adapts the imported crew to the existing gait rig. Models load asynchronously with the previous procedural visuals as fallbacks. Static opaque details are batched by material; per-instance material changes cannot tint another player's equipment. Runtime files are included in the offline production cache and use relative URLs for GitHub Pages.

Run `npm test` for the actual-GLB rig, solar-state isolation, asset integrity and existing gameplay checks; `npm run build` validates TypeScript and produces the offline client. For a visual fixture, open `http://localhost:5173/?qaScene=models` in development. Additional fixture URLs include `?qaScene=workbench`, `?qaScene=tasks`, `?qaScene=ship` and `?qaScene=ended`. These fixtures are development-only.

### Blender sandstorm effect

Dust-storm events now play the Blender-authored [sandstorm VFX](client/public/mars/vfx/README.md): soft billows, ground drift and windblown grains, with a seamless 12-second loop. The runtime GLB is loaded on demand and uses embedded alpha textures. It follows local terrain height, fades with storm intensity and preserves the existing particle fallback. Reduced-motion users see lighter, static dust without moving grains. Source `.blend` and a reproducible generator are in `assets/blender/`. Use `/?qaScene=storm` in development to preview it.

### Walkable Blender habitat interior

Approach the habitat's south airlock beside the workbench and press **E** to enter. The [furnished interior](client/public/mars/interiors/README.md) has four individually assigned crew quarters, environmental control/life-support equipment, galley, hygiene area, command/comms, medical bay and airlock suit preparation. Walk and orbit the camera normally; **E** inspects nearby equipment and **Q** opens the floor plan. Return to the airlock and choose **Cycle airlock · Go outside** to leave.

The expanded interior deck uses its own cutaway scene, with shared collision footprints, bounded server movement, crew synchronization and solo-save compatibility. Equipment displays existing mission readings; furniture does not introduce new resource, healing or inventory rules. Original `.blend`, review render and reproducible generator are under `assets/blender/`. `npm test` includes full-crew occupancy, room connectivity, movement/exit validation and actual-GLB checks. With the server running, `TEST_SERVER=ws://127.0.0.1:2567 node --import tsx tests/hab-multiplayer.ts` verifies real-client interior synchronization and berth reuse; CI runs this alongside the existing network checks.
