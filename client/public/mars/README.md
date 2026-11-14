# Matching Mars asset library

49 original self-contained GLBs created for SpaceApps: rounded white shells, deep teal frames, blue glass and orange safety details. `manifest.json` lists the files and their authored dimensions in metres.

The outpost scene displays a habitat with an interior workbench, an outdoor workbench, clean and dusty solar arrays, greenhouse, shelter, radio dish, rocket, science beacon, supply crates, battery, scrap and all four crew suit colours. Other library assets are available for future game systems and terrain authoring; they are not automatically spawned.

`client/src/render/models.ts` caches model requests, clones materials per instance, batches static opaque meshes and preserves transparent glass. These instances are static props. The separate six-clip astronaut export is available for later animation integration; this preview does not retarget or play its clips.

The library also contains 16 transparent UI icons, four crew portraits and title artwork. The station buttons currently use three icons; remaining artwork is available for future menus. GLBs are requested when the scene places them. Other files are copied to the build as a reusable asset library.

Source `.blend` files remain in the separately delivered asset pack. No Blender installation, external textures or paid service is needed to run this preview.
