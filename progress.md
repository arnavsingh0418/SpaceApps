Original prompt: Build Outpost Down in https://github.com/AmoghAtreya/TEST_nasa.git from the supplied NASA mission brief; then apply CODEX_REDESIGN_PROMPT.md to the existing game, preserving simulation rules.

## Rover range
- Replaced the flat footprint check with independent terrain samples and a shared chassis pose. The rover follows uneven ground with smoother suspension motion, steers a little tighter at low speed, and still stops for abrupt ledges, excessive tilt, obstacles, or low clearance.
- A terrain-only comparison from the rover spawn on the shipped Mars GLB used 16 straight headings. Seven reached farther and nine matched or nearly matched. The east route increased from 45 to 118 meters and one southwest heading from 134 to 260 meters. Actual driving also depends on surface props and crew positions.

## Surface tracks and weather
- Bootprints alternate by distance walked and rover tires leave two lines of tread. Marks follow the local ground and last up to 85 seconds before weathering away, with fixed rendering budgets.
- Dust devils continuously push, spin, and lift explorers and the rover. The crew server applies the same forces for every client, and seated players stay with the vehicle. Forces increase toward the vortex core.
- Uphill movement checks the terrain rise and slope ahead for both walking and driving. A seven-second screen-dust burst begins at storm impact; reduced motion uses static motes. The habitat interior is sheltered.
- Reproduce the browser checks with the development server and `node scripts/surface-weather-qa.mjs`. Captures are written under `artifacts/surface-weather/`.

## Multiplayer inventory and collisions
- Integrated the rover and sandstorm updates from main. Each player’s own selected slot drives their held model for everyone. Empty slots clear the model, and client and server movement both check against other players on Mars and aboard the ship.
- Added an HTTPS fallback into the same rooms when the initial WebSocket connection fails. Guests see a waiting screen when the host is setting power. The browser exercise deliberately blocks the guest WebSocket and verifies independent slot selection after the host starts.

## Checkpoint
- Original playable game: 80c245d, 30 passing tests and production build.
- Existing private preview: https://outpost-down-mars-atreya.encouragingbean1.chatgpt.site
- NASA key remains outside the repository. Authenticated DONKI fetch returned 503; verified archived records remain bundled.

## Redesign QA inventory
- Start without blocking instructions; four tutorial steps must follow real walk/pick/scan/store actions.
- Three persistent exploring HUD groups; goals, chat, roles, audio and help move into expandable surfaces.
- Budget allocation: mouse, keyboard, overspending, lock animation, next sol.
- Context labels: proximity, hover, nearest prompt, collision suppression, multiplayer names.
- Carry/pick/scan/build/dose effects; idle/walk/smoke/weather/daylight; reduced motion.
- Storm warning, flare choices with costs and attribution, compact summary, win/loss.
- Workbench, quizzes, all five mini-tasks, quick chat, map, roles, pause/resume, save/retry.
- Viewport checks: 1600x900, 1280x720, 390x844; no clipping; minimum 14px except key chips.
- Off-path checks: overspent budget, full bag, incorrect quiz, failed task, absent co-op server.
- Evidence: screenshots plus render_game_to_text; real inputs for interaction checks; dev-only scene fixtures for visual coverage, never as input signoff.

## Plan
1. Capture nine baseline screens before changing their appearance.
2. Task 1 components and tokens; task 2 onboarding/budget; task 3 labels; task 4 animation; task 5 events; task 6 polish; task 7 optional original synthesized audio.
3. Run the supplied Develop Web Game client after each task; inspect images; commit each stage.

## Constraints
- Keep shared/src/sim and balance unchanged.
- Context7 / Playwright MCP are not exposed in this session. Use installed three.js source and the supplied Playwright package workflow.
- GPU postprocessing is optional; favor existing emissive materials and CSS flash/vignette to avoid an extra full-screen render pass.

## Task 1 complete
- Added shared UI components and split HUD, hotbar, modals, budgets, events and toasts into client/src/ui/.
- Three permanent exploring groups; tokens and readable type replace the old stylesheet.
- Captured nine before screens and nine Task 1 screens. Reviewed explore image.
- Supplied Playwright loop and capture pass: zero browser page errors. All 30 tests and build pass. One concurrent CPU-starved test run timed out; serial rerun passed in 1.37s.


## Task 2 complete
- Fresh solo missions start immediately with a default first-sol allocation; the first budget appears on sol 2. Simulation rules are unchanged.
- Four action-driven tutorial steps, a world marker, concise hints, keyboard budget controls, and lock-in feedback added.
- Real-input Playwright flow completed walk, pickup, scan, storage, night report and sol-2 power. Zero page errors. State snapshots verify three HUD groups.
- Reviewed tutorial-complete screenshot; task-2 captures and supplied-loop state are saved under references/redesign/after/.


## Task 3 complete
- World labels now appear by proximity or raycast hover. Nearby secondary objects get icon chips; solo name tags are hidden.
- Added screen-space overlap suppression against labels and HUD, panel-mounted cleanliness segments, emissive highlights and a small objective arrow.
- Moved only the visual hab back so the workbench is reachable without hiding the astronaut inside its shell; simulation station coordinates are unchanged.
- Supplied loop and nine screenshots show zero page errors. Reviewed near-item screenshot: short prompt, quiet world labels and no overlapping labels.


## Task 4 complete
- Procedural idle/breathing/glints, opposite limbs, smooth turning, lean, footsteps, crouch/pickup arcs, carry props, build tool loop and overshoot growth added.
- Fixed-size instanced pools drive dust, sparks, beacon motes, drifting smoke and storm wind. Added scan beams/rings, panel dust tint, clean sparkles, dose flashes, storm fade and sunset lighting.
- Resource transitions, count ticks and transient feedback animate. Reduced motion disables breathing, shakes and large movements.
- Motion QA passed real-input pickup/scan/crafting plus staged storm and flare controls. Reviewed pickup/build frames; moved progress away from the astronaut and delayed the quiz until its beam is visible.
- The initial reduced-motion assertion raced the media-change event; waiting for that event made the deterministic pose check pass.


## Task 5 complete
- Added countdown rings and concise storm checklists in the objective group, archived-flare cards with shield-adjusted costs, timed countdown bars, compact night-report deltas, and full-screen crew debriefs.
- Build progress follows simulation time and stays clear of the astronaut.
- Supplied loop and 11 event/state captures report zero page errors. Reviewed flare and full-screen debrief images.
- All 33 tests pass, including displayed-cost/simulation agreement, concise storm countdowns, and guest next-sol permissions.


## Task 6 complete
- Camera uses a damped follow and bounded wheel zoom; instanced rocks and fixed particle pools remain in use. Added local favicon and bundled dependency/font notices.
- 36 screen/size combinations passed geometry, minimum-text, label-width/overlap, and console checks at 1600x900, 1280x720 and 390x844. Real controls covered goals/chat open-close, roles, gauge focus, fullscreen/Escape, phone joystick and touch pickup.
- Visual review caught a toast covering a flare option; dialogs now suppress toasts. A fresh 12-screen phone pass has zero layout failures, copy warnings or console errors. Reviewed the corrected phone flare image.
- Persistent REPL imports were unavailable in this host (ESM/CJS loader errors); the installed Playwright CLI performed interactive checks instead. Context7/Playwright MCP were not exposed.
- Optional bloom/vignette GPU passes skipped: no reliable target-hardware GPU timing is available. Warm world lighting remains; 60 fps on a particular laptop is not certified by software-rendered browser QA.
- Shared simulation and balance files have no diff from the pre-redesign checkpoint.


## Task 7 complete and final verification
- Added nine original normalized local WAV effects, including build and storm loops, a master volume, persisted mute settings and first-gesture audio unlock. Each asset is under 100 KB. ElevenLabs MCP was unavailable; original procedural sounds avoid external recording licenses and runtime APIs.
- All five timed tasks, panel cover/uncover, dropping, quiz retry, sound loading/mute/volume and phone controls passed real-input checks. The supplied Develop Web Game loop completed with state and screenshots under after/task-7-loop/.
- Final responsive QA passed 36 scene/size combinations with no layout failures, copy warnings or browser errors; nine audio buffers load. Reviewed sound controls and production offline-resume images.
- Production offline QA found cached module/CSS responses were rejected due to Vary matching. Static same-origin cache fallback now ignores Vary; a clean browser successfully reloaded offline, resumed its saved mission, loaded all nine sounds and moved, with zero page errors.
- Final checks: 33 unit/mission/UI tests pass; TypeScript and production build pass; two-client WebSocket integration passes room membership, sync, remote movement, leader permissions, pickup race and four-player limit. Simulation and balance remain unchanged.
- Render blueprint explicitly installs dev dependencies because the server starts through tsx. Remote co-op requires deploying that WebSocket server; the static private preview supports solo/offline play.

## Screenshot and state index
All paths below are relative to references/redesign/. Each capture folder also contains state JSON or a checks report.
- before/: nine original screens and contact sheet.
- after/task-1/ through after/task-5/, plus after/task-6-final/: staged comparisons for each committed redesign task; adjacent task-N-loop/ folders retain the supplied action-client outputs.
- after/task-2-functional/: real tutorial/next-sol keyboard flow.
- after/task-4-motion/: pickup, scan, build, storm, flare and reduced-motion frames.
- after/task-6-phone/: corrected 12-screen phone pass.
- after/task-7-controls/: sound settings and complete timed-task/control state.
- after/task-7-loop/: final supplied Playwright loop.
- after/final/: 36 screenshots at 1600x900, 1280x720 and 390x844, three gauge-tooltip frames and checks.json.
- after/offline/: production offline resume and state.

## Remaining verification limits
No reliable target-laptop GPU timing was available, so 60 fps is unverified and optional GPU bloom/color-grade passes were skipped. Existing warm lighting and inexpensive event flashes remain. A new Blender astronaut was unnecessary for the requested procedural motion. Context7 and Playwright MCP were unavailable; installed source plus CLI Playwright provided implementation and browser verification. Authenticated NASA DONKI fetch previously returned 503; verified archived data remains bundled without API keys.


## Nemi and spaceship repair — current task
User request: add a friendly alien with a NASA-science problem, shared supply collection, a ship-part reward, broken/rebuilt ship visuals and animations. Voice should be ready for ElevenLabs later; user explicitly says there is no API key now.
- Added a deterministic, server-validated shared water-loop repair at Nemi's refuge (-34, -8): accept, donate carried ice/panels/scrap, brush collector, explain safe water treatment, earn a Prototype navigation core. Any mix of crew members can help; solo is supported. Duplicate deliveries/rewards, remote actions, invalid quantities and skipped steps are rejected.
- Existing field milestones now award booster, life-support, shield and navigation parts in addition to supply caches. Higher rarity is preserved. Salvage quizzes remain a second route / upgrade source.
- New original procedural alien model and portrait, captioned dialogue, idle/blink/gesture/talking animation, collector and tank feedback, reward art and local voice manifest. Device speech is optional; captions work with no key or installed voice. No ElevenLabs call has been made.
- Added distinct 3D component models, damaged components, display plinths, animated installation arcs/sparks and reduced-motion handling. Ship inspection camera and damage cards keep the main goal visible.
- First verification: 58 tests and TypeScript pass. CLI browser flow covers actual walking to Nemi, UI delivery/cleaning/retry/reward, all installations, flight tasks, 1600/1280/390 widths, reduced motion, no console/page errors. Visual review caught an inherited hover tint washing out whole field-site models; these now retain their native materials.
- Browser QA: scripts/alien-qa.mjs. Screenshots/state: references/alien-mission/. Supplied loop: artifacts/alien-loop-final/. Further final checks and private Site update follow.
- Final verification: all 58 tests pass; production build passes (75 precached files); terrain route checker includes Nemi and all existing destinations. Two actual WebSocket clients gathered separate supplies, shared the repair and received one Prototype core, with exactly-once contributor points. The new co-op check is included in CI.
- Full browser flow passed at 1600x900, 1280x720 and 390x844, including wrong-answer retry, every installation, flight tasks and reduced motion; zero page/console errors. Images reviewed in references/alien-mission/. A formatting edit reloaded one in-progress browser run; a clean rerun passed. Settled camera captures use extra visual frames because advanceTime batches simulation ticks.
- No paid speech service or key was used. ElevenLabs remains a later asset-generation step; client/public/alien/README.md documents the local clip manifest. Current device speech availability varies; subtitles remain the reliable fallback.

## Physical return flight — November 14
User request: after rebuilding, players should be physically inside the spaceship, steer/manage it while space moves outside, and fix problems together during the journey home.
- Replaced the automatic three-modal ending with a server-owned walkable cabin, helm, four repair stations, five timed incidents, resources, departure/entry guidance locks, solo autopilot, arrival animation and action-based home/rescue endings. No random final success roll. Existing launch/assembly gates stay in place.
- Original procedural cabin, Earth texture, moving stars, station lamps, animated crew/repair gestures, capsule arrival and reduced-motion support. Flight HUD and touch controls use the existing UI/input system. Solo saves retain flight progress; older flights migrate. No speech API or key used.
- All 65 unit tests pass and production build passes, with the existing bundle-size advisory. Full browser QA passed actual walking between rooms, steering, all five repairs, both locks, Earth and rescue outcomes, pause, 1600/1280/390 widths and reduced motion without browser errors. Reviewed departure, repair and phone screenshots; moved Earth into the visible bridge view after the first capture.
- Added scripts/flight-qa.mjs and tests/flight-multiplayer.ts; updated alien QA launch assertion for the physical cabin. Added flight network coverage to CI. Artifacts: references/flight/ and artifacts/flight-loop/. Local software-rendered checks do not certify target GPU frame rate. Remote co-op still needs its own WebSocket host.
- Final integration fetched main 0d6522a (teammates' matching model pack). Resolved the fixture whitelist and report conflicts by retaining both the new art/portraits and physical flight results. Combined suite: 73 tests pass, production build passes with 147 precached files. Two real WebSocket clients gathered four components, installed/launched, walked inside, shared helm state, and repaired electrical power while the pilot remained at the helm. Existing alien/browser regression passes. Network fixture uses the correct `site` field and keeps the waiting guest connected.

## Five-digit multiplayer and Render hosting
- User wants host-issued five-digit codes without server-address entry, and is creating a Render account. Prepared one Render Web Service for both dist/ and WebSocket simulation, /health endpoint, automatic same-origin /crew connection, Vite development proxy, five-digit numeric room generation, mobile numeric code entry, persistent copy-code button, and optional VITE_CREW_SERVER override for a separate Vercel frontend.
- Added MULTIPLAYER_SETUP.md with exact Render/manual/Vercel steps, free-instance cold starts, single-instance requirement and temporary in-memory room behavior. No hosting credentials or game API keys are needed in the client. Current private Sites preview has no multiplayer backend; use the Render URL after deployment.
- Production build, 73 unit tests and actual network integration pass, including serving the game HTML, health check, code format, shared players and four-player limit. Local browser QA is being checked separately; concurrent software-rendered browsers initially exceeded startup timeouts.
- Browser QA found and fixed a real initial-state race: the connection now waits for the authoritative snapshot containing the new player before gameplay begins. Added regression coverage for delayed snapshots and early disconnects, and updated the existing heartbeat test for the new readiness contract. Desktop host/phone guest now create and join the same five-digit code with no page exceptions or viewport overflow. scripts/crew-lobby-qa.mjs deliberately uses existing procedural fallback models to keep this UI/network test independent of software-rendered GLB performance; model art remains covered by the existing asset tests and previous flight QA. Reviewed host lobby and connected phone captures in references/multiplayer/.
- User created a Render Web Service at https://test-nasa.onrender.com/. Its first deployment serves the old d8084b8 JSON backend; the new commit needs to deploy before the same URL serves the website and code-only lobby. No runtime API keys are required.
- Deployed commit 6d28ca7 on the user's Render service. Public website now serves the game HTML; remote network integration passed real shared rooms/movement/pickup races and four-player limit, and desktop-host/phone-guest browser QA passed through the public website's automatic /crew connection. 75 unit tests and production build pass. CI exposed an unrelated fixed-duration steering assumption in the flight network fixture; changed that fixture to steer from authoritative course feedback and check the pilot's own confirmation/errors. No gameplay steering behavior changed.

## Five-digit multiplayer and Render hosting
- User wants host-issued five-digit codes without server-address entry, and is creating a Render account. Prepared one Render Web Service for both dist/ and WebSocket simulation, /health endpoint, automatic same-origin /crew connection, Vite development proxy, five-digit numeric room generation, mobile numeric code entry, persistent copy-code button, and optional VITE_CREW_SERVER override for a separate Vercel frontend.
- Added MULTIPLAYER_SETUP.md with exact Render/manual/Vercel steps, free-instance cold starts, single-instance requirement and temporary in-memory room behavior. No hosting credentials or game API keys are needed in the client. Current private Sites preview has no multiplayer backend; use the Render URL after deployment.
- Production build, 73 unit tests and actual network integration pass, including serving the game HTML, health check, code format, shared players and four-player limit. Local browser QA is being checked separately; concurrent software-rendered browsers initially exceeded startup timeouts.
