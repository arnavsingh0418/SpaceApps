Original prompt: Build Outpost Down in https://github.com/AmoghAtreya/TEST_nasa.git from the supplied NASA mission brief; then apply CODEX_REDESIGN_PROMPT.md to the existing game, preserving simulation rules.

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

