# SpaceApps

An interactive Mars outpost set on the imported Blender map. The habitat dome, solar arrays and crafting bench are joined by four crew members, a greenhouse, radio, shelter, rocket and supplies.

## Run locally

Use Node.js 22.12 or newer.

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. Build with `npm run build`; serve the result with `npm run preview`. WebGL 2 support is required.

## Explore

- Drag to orbit; scroll or pinch to zoom; right-drag or two-finger drag to pan.
- Select **Habitat**, **Solar array** or **Workbench** to focus the camera and read about the station. You can also select those objects directly in the scene.
- Choose **View whole outpost** or press **R** to reset the camera.
- The loading status reports unavailable models rather than leaving them silently missing.

This is an outpost scene preview, ready for further game development. It does not yet implement crafting, resource consumption, crew movement or multiplayer.

## Assets and rendering

`client/public/mars` contains the previously created 49 self-contained GLBs, 16 icons, four crew portraits and title artwork. See its [asset guide](client/public/mars/README.md) and [manifest](client/public/mars/manifest.json). The outpost uses 17 placed model instances and loads only the models it needs. Props are grounded and scaled to the landing area. Static opaque details are batched by material; transparent glass stays separate. Model requests are cached and instance materials isolated. The scene renders on loading, camera interaction or resize rather than running a continuous animation loop.

`client/src/render/base.ts` controls placement and station descriptions. `client/src/render/models.ts` handles GLB loading. The relative Vite base supports hosting under a repository subpath.

`client/src/render/marsTerrain.ts` loads the meshopt-compressed Mars map, centers the outpost on the southern plain, and samples the ground height for models and station views. The original procedural terrain remains visible while the map loads and serves as the fallback if loading fails.

`npm test` validates the actual GLB catalog, self-contained resources and scene-model fit/material isolation. `window.render_game_to_text()` exposes loaded/failed models and camera state for QA; `window.advanceTime()` renders one frame.

## Source

The terrain, rocks and initial scene settings were extracted from Arnav Singh's existing [TEST_nasa source](https://github.com/arnavsingh0418/TEST_nasa/commit/3fa3c0a5ee96a66fd47cdff9ddce78f3ff1e3336), originally in `client/src/render/world.ts`. This repository started as a minimal terrain preview; this change adds the matching asset library and outpost scene.

The Blender map and its terrain loader come from the [TEST_nasa Mars map commit](https://github.com/arnavsingh0418/TEST_nasa/commit/4eb8ccbfe88abe0b97a9165fdb4540747645ed09).

Three.js is distributed under the MIT license; see `client/public/licenses/three.txt`.
