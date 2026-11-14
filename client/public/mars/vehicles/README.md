# Wayfarer 01

Original six-wheel expedition rover, styled to match the habitat: rounded ceramic white, deep teal and orange safety accents. Blender source, preview and generator are in `assets/blender/`.

`Mars_Rover.glb` is self-contained: 7 meshes, 27 primitives, 10 materials and 47,904 triangles. Meters; forward is glTF -Z. Six named `Wheel_*` pivots rotate around local X. `Steer_FL` and `Steer_FR` provide front steering. Preserve the hierarchy when importing. Four crew seats are positioned by the game renderer.

Regenerate with Blender 4.5:

```sh
blender --background --factory-startup --python assets/blender/build_rover.py -- --output /tmp/wayfarer --render
```

Copy the resulting GLB here. The game retains a simple vehicle fallback if loading fails; no Blender installation is needed to play.
