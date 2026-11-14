# SpaceApps

A minimal Mars terrain preview: a procedural surface, a level landing area,
scattered rocks, Mars lighting and a fixed camera.

## Run locally

Use Node.js 22.12 or newer.

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. Build with `npm run build`; serve the result
with `npm run preview`. WebGL 2 support is required.

## Source

The terrain, rocks and initial scene settings are extracted from Arnav Singh's
existing [TEST_nasa source](https://github.com/arnavsingh0418/TEST_nasa/commit/3fa3c0a5ee96a66fd47cdff9ddce78f3ff1e3336),
originally in `client/src/render/world.ts`. This bootstrap isolates that terrain
from the full game and adds the minimum build and preview entry points.

Three.js is distributed under the MIT license; see
`client/public/licenses/three.txt`.
