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

Choose **Play with friends**, use `ws://localhost:2567`, and create a crew. In another browser tab, join the four-letter room code at that same server address. For friends on your LAN, use the host computer's LAN IP instead of localhost. For an HTTPS client deployment, use a `wss://` server address.

## How to play

- WASD or arrow keys: walk. E: interact with the nearest object. B: workbench when nearby. Q: field map. 1–5: choose a hotbar slot; the up arrow drops its stack.
- On touch devices, drag the lower-left joystick and tap E. All science lessons, budgets, tasks, and recipes also accept touch.
- Split electricity each morning. At least 3 blocks keeps air steady; 4 adds air. Plants turn light into food only after you build the greenhouse. One heater block keeps the crew warm.
- Follow cyan beacons, read the short field notes, and answer a question. Learned science unlocks recipes for the entire crew.
- Collect materials in a five-slot hotbar. Bring them to the hab workbench to store and build. Storage is shared and safe from storms.
- Build the greenhouse early. Food is eaten every sol. Watering costs one ice and adds food at night.
- Before a dust storm, store loose supplies and cover panels. Covering sacrifices their electricity and takes blocks away from radio, plants, heaters, then air. Clean dirty panels after the storm. Covers come off the next morning.
- Solar flares draw from real, archived NASA DONKI records. Shelter costs food; ice walls cost ice; continuing work adds a larger radiation dose. Ignored flares resolve as continued work after 45 seconds.
- Repair and align the radio, build a shelter and greenhouse, and survive to sol 15 with at least 4 power blocks and 10 radio progress to prepare the return vehicle already on Mars.
- Solo play pauses when its browser tab is hidden or the pause menu is open. Multiplayer keeps running for the crew.

Roles: Engineer builds twice as fast; Scientist gets a field-map tip; Medic sees the shared crew dose; Comms gets 10 more seconds before an event and can lock power. Anyone can gather, learn, build, and complete tasks. The leader can also lock power. All players currently share air, food, and dose.

## Validation

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
- `client/src/render/`: three.js renderer and adapted supplied primitive builders. Instanced rocks, flat terrain within the playable radius, and an overhead third-person follow camera.
- `client/src/main.ts`: HTML HUD, menus, keyboard/touch inputs, mini-tasks, local saves, and the local simulation driver.
- `client/src/net/`: WebSocket client. Remote players interpolate visually; no client can set their absolute position.
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

Client: `npm run build` produces `dist/`, usable on GitHub Pages, Netlify, or Vercel. The included GitHub Actions workflow tests and deploys to Pages. Enable **Settings → Pages → Source: GitHub Actions** if the repository does not have Pages enabled. Relative asset URLs support the `/TEST_nasa/` subpath. No secrets are needed for the client.

Server: use the included `render.yaml` blueprint or deploy the Node app to another WebSocket-capable host. Build: `npm ci`. Start: `npm run server`. Health: `/`. The host's `PORT` is used automatically. Rooms are stored in memory, so run one instance without autoscaling; a persistent shared room store is outside this prototype's scope. Render free services can sleep; solo play remains available. Set `VITE_CREW_SERVER=wss://your-crew-server.example` before building the client, or enter the server URL in the lobby.

## Credits and scope

Original supplied concept scenes: preserved in `references/concept-scenes/`. Supplied brief: `references/BUILD_BRIEF.md`. Prior orbital/gesture prototypes were reference material and are not dependencies of this Mars game. three.js, ws, Vite, TypeScript, Vitest, and Fontsource retain their upstream licenses. Sound is generated locally with Web Audio; no external recordings. Fonts are bundled locally for offline use.

The game implements solo survival, co-op, science gates, five mini-task types, events, save/resume, and touch controls. It uses an illustrative comms delay and archived data, with no live NASA mode. Touch layouts are responsive; real-device performance and a 60 fps target need hardware-specific testing. This project is not an official NASA product.
