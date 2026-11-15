# Blender sandstorm VFX

`Mars_Sandstorm.glb` is a mesh-based sandstorm authored in Blender 4.5.4 for Outpost Down. It matches the warm Martian landscape and the rounded habitat/crew kit. The selected export contains no preview habitat, ground, lights or camera.

- One seamless **12-second** `Sandstorm_Loop` animation, with staggered dust billows, ground drift and sand streaks.
- **7 meshes, 564 triangles**, two embedded RGBA PNGs and three alpha-blended materials; about **167 KiB**. No external textures, volumes or particle simulation cache.
- Local +X is the wind direction; Blender Z-up exports to glTF Y-up. The renderer scales the volume 1.6× around the local player at terrain height.

`client/src/render/sandstorm.ts` lazily loads it when a storm starts. The existing five-second storm ramp controls opacity and nearby fog. Meshes test depth against buildings, do not write depth or cast shadows, and never enter collision or shared simulation. The stock wind particles remain available if the GLB cannot load. Reduced motion freezes the imported clip, hides fast grains and keeps lighter static haze. The effect disappears in menus and fades after leaving the storm/day phase.

Editable source: `assets/blender/Mars_Sandstorm.blend`. The `EXPORT | Sandstorm` collection is the actual VFX; `PREVIEW ONLY` contains presentation scenery. Scrub frames 1–289 at 24 fps. Regenerate both files with Blender:

```sh
blender --background --factory-startup --python assets/blender/build_sandstorm.py -- --output /path/to/sandstorm --render
```

Copy the resulting GLB to this directory and the `.blend` to `assets/blender/`. The source script needs only Blender. A supplied habitat GLB is used for the optional preview scale reference.

Run `npm test` for real-GLB parsing/loop tests, material/fade/reduced-motion checks, failure fallback and disposal during a pending load. For local visual QA, start `npm run dev` and open `/?qaScene=storm`; `window.render_game_to_text()` includes `motion.sandstorm` diagnostics.
