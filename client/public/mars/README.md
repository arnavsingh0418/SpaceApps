# Matching Mars asset library

49 original GLB assets created for this game, using rounded ceramic-white shells, deep-teal structure, blue glass/cells and orange safety details. All binaries are self-contained. `manifest.json` lists the full library and authored meter dimensions.

The playable renderer now uses these models for the crew, role badges, crashed rocket, habitat (with interior workbench), outdoor crafting station, solar arrays, radio, greenhouse, storm shelter, science beacons, crates and eight pickup types. Field sites use the ice, lander wreck, cliff, solar, shelter, dish and return-vehicle models. The dust devil uses the authored spiral. The existing terrain map remains the authoritative landscape and collision surface. Extra rocks, crater/cliff sections, lava-tube entrance, standalone plants and the six-clip astronaut export are available here for future map/animation authoring; they are not all added as extra obstacles to the current mission map.

`client/src/render/modelAssets.ts` loads assets lazily, caches geometry, isolates per-instance materials, batches static opaque details, and retains procedural fallback/collision objects. The Blender rigid-part suit is retargeted to the existing named gait rig, so jump, crouch, carry, footsteps, reduced motion and cinematic walking remain driven by existing gameplay. Role changes update the chest badge independently of suit color.

## State-dependent equipment

- Solar panel dust follows each panel's `clean` value. Clean panels hide dust; storm covers disable the visual cells and add a protective cover.
- Repaired radio dishes expose their authored azimuth pivot, which searches until the shared aligned state is true.
- The old broken radio disappears when the repaired building is built.
- Building growth animations, interaction targets, simulation costs and mission rules remain unchanged.

## Artwork

`icons/` contains 16 transparent 256×256 Blender-rendered images. The hotbar, vitals and build tabs use them. `portraits/` contains four transparent 256×256 crew head/shoulder images used in mission results. `title-hero.png` is the original rendered title art. Paths use Vite's relative `BASE_URL` and work under a repository subpath. All are included in the production offline cache.

The source `.blend` files remain in the separately delivered Mars asset pack; only runtime GLBs and artwork are included in this repository. No external textures, Blender installation or paid asset service is required to run the game.
