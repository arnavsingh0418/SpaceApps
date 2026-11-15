# Ares hab interior

Original Blender-authored environment for four explorers. The white ceramic panels, deep teal equipment and orange safety details match the existing exterior asset library. The playable deck is an expanded interior scene, accessed from the original dome airlock. Its 22 × 22 m game-scale floor is intentionally larger than the exterior dome; it is not a one-to-one architectural reconstruction.

The interior includes:

- Four private cabins with sleeping berths, quilts, pillows, acoustic headboards, lockers, desks, personal terminals, reading lights and open privacy curtains. The first entry assigns each crew member a distinct berth; nameplates update from the shared game state.
- Environmental control and life support: separate labeled carbon-dioxide capture, oxygen generation and water-loop racks, replaceable cartridges, valves, a water recycler, tanks, pipe manifolds, overhead ventilation trunks and diffusers.
- A galley with pantry, food pouches, food warmer, sink, four-place table, stools, trays and cups.
- A hygiene area with screened wash stall, shower plumbing, sealed toilet, privacy divider, sink and linens.
- A command console with three telemetry screens, keyboards and seats, plus a separate communications rack.
- A medical examination couch, rails, monitor, oxygen cylinder and first-aid storage. Fire extinguishers remain beside the airlock.
- A two-hatch airlock vestibule, status panel, pressure indicators, dust grate, suit service packs and umbilicals.

## Play

Approach the south side of the hab beside the outdoor workbench and press **E** at **Enter habitat airlock**. Walk with WASD or the joystick; mouse/drag and wheel retain camera orbit/zoom. Press **E** beside room equipment for its information panel. **Q** or the small floor plan opens the room directory. At the airlock, press **E**, then **Cycle airlock · Go outside**.

The camera uses a cutaway roof and hides camera-facing outer pressure panels. Walls and furniture remain solid. Indoor players are visible to other indoor crew and disappear from the outdoor scene. Server-validated movement uses the same footprints as Blender. Interior position, assigned berth and carried supplies survive solo saves. Disconnecting frees the berth for a replacement explorer; launch returns all crew to the ship.

Equipment panels display existing mission resources; the beds, plumbing, medical and galley fixtures are scenery. They do not add healing, inventory capacity, pressure simulation or new resource costs. Existing survival events and resource rules continue. Inspecting equipment and reading the floor plan pause solo time; co-op continues.

## Authoring

`Mars_Hab_Interior.glb` is self-contained, uses meters, and has no external textures. It contains approximately 101,000 triangles and 135 material-batched meshes. The named zone groups, `Roof` and `Shell_N/S/E/W` are retained for cutaway rendering. The actual file budget and room hierarchy are checked in `tests/hab.test.ts`.

Editable source, cutaway review render and generator are in `assets/blender/`. Both Blender and gameplay use `shared/src/data/hab-layout.json` for navigation footprints. After changing a wall or large furnishing, update this layout and regenerate the asset:

```sh
blender --background --factory-startup --python assets/blender/build_hab_interior.py -- --output /tmp/hab-interior --render
```

Copy the generated GLB to this directory and the `.blend`/preview to `assets/blender/`. No Blender installation is needed to play. A simple room-and-furniture fallback remains if the GLB fails to load. Development preview scenes: `?qaScene=hab`, `?qaScene=hab-crew`, `?qaScene=hab-airlock`.

## Design references

NASA's [CHAPEA habitat](https://www.nasa.gov/humans-in-space/chapea/habitat/) informed the separation of four private quarters, galley and shared work areas. NASA's [ECLSS overview](https://www.nasa.gov/reference/environmental-control-and-life-support-systems-eclss/) informed the separation of air revitalization, oxygen generation and water recovery equipment. The asset is an original fictional game environment, not a NASA-certified design or a model of CHAPEA.
