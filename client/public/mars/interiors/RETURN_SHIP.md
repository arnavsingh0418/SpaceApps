# Enclosed return ship

Original Blender interior recreating the SpaceApps corridor/cockpit layout: ivory pressure liner, overhead lights and cable runs, copper handrail, oxygen cylinders, electrical panels, cooling equipment, stowage and a wide enclosed cockpit with three terminals and red chairs. Earth is rendered by the game beyond a real window opening. No external textures or downloaded models are required.

After launch, flight uses an eye-level perspective camera. WASD/arrows move relative to the view; click and move the mouse or drag/swipe to look; E opens the nearby equipment; Escape closes a panel or pauses solo. Touch movement and the helm touch controls remain available. Other crew appear in the cabin; your own avatar is hidden from your view. The arrival cinematic uses an exterior camera.

The helm is at the front console. Electrical, oxygen and cooling are on the left of the service corridor; hull repair is on the right. Existing steering, departure/entry guidance, autopilot, five timed faults, repair puzzles, resources, flight duration and endings are preserved. Camera and local rendering do not change authoritative station proximity. Co-op movement, crew separation, helm ownership and repairs remain validated on the server.

`shared/src/data/flight-layout.json` is the shared source for room bounds, furniture collisions, station positions and four spawn points. `shared/src/flightLayout.ts` applies swept circle movement. Version 1 saves migrate crew to safe spawn points and release the old helm/task without resetting journey progress, incidents, inventories or repair credit.

## Assets and regeneration

- Runtime: `Mars_Return_Ship_Interior.glb`, self-contained, about 2.3 MB and 50,000 triangles.
- Source: `assets/blender/Mars_Return_Ship_Interior.blend`.
- Generator: `assets/blender/build_return_ship.py`.
- Review render: `assets/blender/Mars_Return_Ship_Interior_Preview.png`.

```sh
blender --background --factory-startup --python assets/blender/build_return_ship.py -- --output /tmp/return-ship --render
```

Copy the generated GLB into this directory and the blend/preview into `assets/blender/`. The generator also accepts `--layout /path/to/flight-layout.json`. Keep large equipment footprints in the JSON in sync with geometry. `Hull`, `Ceiling`, services and furniture groups are retained, along with `Station_helm/power/air/hull/engine` and separate `Indicator_*` groups. Runtime clones indicator materials to allow independent fault colors. If loading fails, an enclosed geometry fallback uses the same navigation layout.

`npm test` verifies all four crew spawns, reachable stations, corridor/cockpit connection, swept collisions, view-relative movement, save migration, actual model hierarchy and triangle budget. `npm run build` validates types and packages the offline asset cache. With a crew server running, `TEST_SERVER=ws://127.0.0.1:2579 node --import tsx tests/flight-multiplayer.ts` checks two real clients launching, walking to equipment, steering and sharing a repair.
