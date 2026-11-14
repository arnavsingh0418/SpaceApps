"""Blender 4.5: build a looping, self-contained glTF sandstorm for Outpost Down.
Run: blender --background --factory-startup --python build_sandstorm.py -- --output /path
Only mesh transforms and embedded RGBA textures are needed at runtime; no volume shader.
"""
import argparse
import bpy
import json
import math
import random
import sys
from mathutils import Vector, noise
from pathlib import Path

args = argparse.ArgumentParser()
args.add_argument('--output', required=True)
args.add_argument('--render', action='store_true')
opt = args.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
out = Path(opt.output).resolve()
out.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
scene = bpy.context.scene
bpy.context.preferences.filepaths.save_version = 0
scene.name = 'Mars Sandstorm | looping game VFX'
scene.unit_settings.system = 'METRIC'
scene.render.fps = 24
scene.frame_start, scene.frame_end = 1, 289
scene.render.engine = 'CYCLES'
scene.cycles.samples = 24
scene.cycles.use_denoising = True
scene.cycles.transparent_max_bounces = 128
scene.render.resolution_x, scene.render.resolution_y = 1280, 800
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.view_settings.view_transform = 'AgX'

fx = bpy.data.collections.new('EXPORT | Sandstorm')
scene.collection.children.link(fx)
root = bpy.data.objects.new('Mars_Sandstorm', None)
fx.objects.link(root)
root['description'] = '12-second looping billows, ground drift and sand streaks. +X wind. Meshes and embedded alpha textures.'
root['loop_seconds'] = 12.0
root['wind_axis'] = '+X'
root['runtime_notes'] = 'Blend transparency, double-sided, depthWrite false, no shadows. Pause animation for reduced motion; keep haze.'


def texture(name, streak=False):
    width, height = (256, 64) if streak else (256, 256)
    image = bpy.data.images.new(name, width=width, height=height, alpha=True)
    pixels = []
    for y in range(height):
        v = y / (height - 1) * 2 - 1
        for x in range(width):
            u = x / (width - 1) * 2 - 1
            n = noise.noise_vector(Vector((u * 5, v * 5, 3.7)))[0]
            fine = noise.noise_vector(Vector((u * 31, v * 22, 5.2)))[0]
            edge = max(0, 1 - u*u)**2 * max(0, 1 - v*v)**2
            if streak:
                alpha = edge * math.exp(-v*v*48) * (.65 + .3*n)
                rgb = (.85, .58, .32)
            else:
                # Curling lobes break up the outline, with a fully transparent perimeter.
                curl = math.sin(u * 7 + v * 3 + n * 3) * .14
                shape = math.exp(-((v + curl) / .5)**2)
                alpha = edge * shape * max(.08, .55 + .45*n + .13*fine)
                rgb = (.63 + n*.09, .31 + n*.065, .12 + n*.035)
            pixels.extend((*rgb, max(0, min(1, alpha))))
    image.pixels.foreach_set(pixels)
    image.pack()
    return image

cloud_image = texture('Sandstorm | soft curling dust RGBA')
streak_image = texture('Sandstorm | feathered wind streak RGBA', True)


def material(name, image, opacity):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    m.surface_render_method = 'BLENDED'
    m.use_backface_culling = False
    nodes = m.node_tree.nodes
    nodes.clear()
    output = nodes.new('ShaderNodeOutputMaterial')
    bsdf = nodes.new('ShaderNodeBsdfPrincipled')
    tex = nodes.new('ShaderNodeTexImage')
    tex.image = image
    tex.interpolation = 'Linear'
    tex.extension = 'CLIP'
    alpha = nodes.new('ShaderNodeMath')
    alpha.operation = 'MULTIPLY'
    alpha.inputs[1].default_value = opacity
    links = m.node_tree.links
    links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
    links.new(tex.outputs['Alpha'], alpha.inputs[0])
    links.new(alpha.outputs[0], bsdf.inputs['Alpha'])
    bsdf.inputs['Roughness'].default_value = 1
    links.new(bsdf.outputs[0], output.inputs['Surface'])
    m.diffuse_color = (.67, .34, .15, opacity)
    return m

cloud = material('Dust billows | soft alpha', cloud_image, .62)
ground = material('Ground drift | soft alpha', cloud_image, .44)
streak = material('Windblown sand | soft alpha', streak_image, .7)


def cards(name, mat, specs):
    verts, faces, uvs = [], [], []
    for center, width, height, yaw, horizontal in specs:
        c = Vector(center)
        right = Vector((math.cos(yaw), math.sin(yaw), 0))
        up = Vector((-math.sin(yaw), math.cos(yaw), 0)) if horizontal else Vector((0, 0, 1))
        k = len(verts)
        for xx, yy in [(-.5, -.5), (.5, -.5), (.5, .5), (-.5, .5)]:
            verts.append(tuple(c + right * width * xx + up * height * yy))
        faces.append((k, k+1, k+2, k+3))
        uvs.extend([(0, 0), (1, 0), (1, 1), (0, 1)])
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    uv = mesh.uv_layers.new()
    for polygon in mesh.polygons:
        for idx, loop in enumerate(polygon.loop_indices):
            uv.data[loop].uv = uvs[polygon.vertices[idx]]
    obj = bpy.data.objects.new(name, mesh)
    fx.objects.link(obj)
    obj.parent = root
    mesh.materials.append(mat)
    obj.visible_shadow = False
    return obj


def animate(obj, phase, travel):
    # Identical first/last transforms. The offscreen wrap is hidden at zero scale.
    # Bake each frame so the glTF clip faithfully matches Blender's phase offset.
    for frame in range(1, 290):
        t = ((frame - 1) / 288 + phase) % 1
        envelope = min(1, t / .14, (1-t) / .14)
        envelope = envelope * envelope * (3-2*envelope)
        obj.location.x = (t - .5) * travel
        obj.scale = (1, max(.001, envelope), max(.001, envelope))
        obj.keyframe_insert(data_path='location', frame=frame, group='Wind transport')
        obj.keyframe_insert(data_path='scale', frame=frame, group='Soft loop seam')
    action = obj.animation_data.action
    action.name = 'Sandstorm_Loop'

rng = random.Random(6309)
objects = []
for layer in range(3):
    specs = []
    for i in range(18):
        # Crossed shallow angles keep the effect readable while the camera orbits.
        x = rng.uniform(-13, 13)
        y = rng.uniform(-10, 10)
        z = rng.uniform(.65, 4.3)
        specs.append(((x, y, z), rng.uniform(6, 13), rng.uniform(1.3, 3.5), rng.uniform(-.45, .45), False))
    obj = cards(f'Dust_Billows_{layer+1}', cloud, specs)
    animate(obj, layer/3, 28)
    objects.append(obj)
for layer in range(2):
    specs = []
    for i in range(24):
        specs.append(((rng.uniform(-14, 14), rng.uniform(-11, 11), rng.uniform(.09, .24)), rng.uniform(4, 10), rng.uniform(1.0, 3), rng.uniform(-.25, .25), True))
    obj = cards(f'Ground_Drift_{layer+1}', ground, specs)
    animate(obj, .21 + layer*.5, 34)
    objects.append(obj)
for layer in range(2):
    specs = []
    for i in range(90):
        specs.append(((rng.uniform(-16, 16), rng.uniform(-11, 11), rng.uniform(.15, 3.6)), rng.uniform(.25, 1.1), rng.uniform(.025, .065), rng.uniform(-.18, .18), False))
    obj = cards(f'Sand_Streaks_{layer+1}', streak, specs)
    animate(obj, .1 + layer*.5, 80)
    objects.append(obj)

scene.frame_set(97)
bpy.ops.object.select_all(action='DESELECT')
root.select_set(True)
for obj in objects: obj.select_set(True)
bpy.context.view_layer.objects.active = root
bpy.ops.export_scene.gltf(filepath=str(out / 'Mars_Sandstorm.glb'), export_format='GLB', use_selection=True, export_animations=True, export_animation_mode='ACTIVE_ACTIONS', export_merge_animation='ACTION', export_nla_strips_merged_animation_name='Sandstorm_Loop', export_anim_slide_to_zero=True, export_force_sampling=True, export_optimize_animation_size=True, export_extras=True)

# Presentation collection stays out of the selected GLB export.
studio = bpy.data.collections.new('PREVIEW ONLY | Mars ground, camera and habitat reference')
scene.collection.children.link(studio)
def preview_object(obj):
    for col in list(obj.users_collection): col.objects.unlink(obj)
    studio.objects.link(obj)
    return obj

bpy.ops.mesh.primitive_plane_add(size=200)
plane = preview_object(bpy.context.object)
plane.name = 'Preview regolith | not exported'
soil = bpy.data.materials.new('Preview regolith')
soil.diffuse_color = (.38, .115, .035, 1)
soil.use_nodes = True
soil.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (.38, .115, .035, 1)
soil.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = 1
plane.data.materials.append(soil)

# Reuse a supplied habitat only as visual scale reference in the editable file.
hab_path = Path(__file__).resolve().parents[2] / 'client/public/mars/models/Habitat_With_Workbench.glb'
if hab_path.exists():
    prior = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(hab_path))
    imported = set(bpy.data.objects) - prior
    parent = bpy.data.objects.new('Preview habitat reference | not exported', None)
    studio.objects.link(parent)
    for obj in imported:
        preview_object(obj)
        if obj.parent not in imported: obj.parent = parent
    parent.location = (-3, 3, 0)
    parent.scale = (.75, .75, .75)

world = scene.world or bpy.data.worlds.new('Mars dusty sky')
scene.world = world
world.use_nodes = True
world.node_tree.nodes['Background'].inputs['Color'].default_value = (.42, .22, .115, 1)
world.node_tree.nodes['Background'].inputs['Strength'].default_value = .8
bpy.ops.object.light_add(type='SUN', location=(-10, -15, 20))
sun = preview_object(bpy.context.object)
sun.name = 'Preview sun'
sun.data.energy = 2.5
sun.rotation_euler = (.4, -.35, -.4)
bpy.ops.object.camera_add(location=(24, -31, 12))
cam = preview_object(bpy.context.object)
cam.rotation_euler = (Vector((0, 1, 2)) - cam.location).to_track_quat('-Z', 'Y').to_euler()
cam.data.type = 'ORTHO'
cam.data.ortho_scale = 42
scene.camera = cam
scene['README'] = 'Select EXPORT | Sandstorm only for glTF export. PREVIEW ONLY contains ground, lighting and habitat reference. Scrub frames 1–289 (12 seconds at 24 fps). The GLB uses embedded RGBA textures and transform animation, with no simulation bake required.'
for area in bpy.context.screen.areas:
    if area.type == 'VIEW_3D':
        area.spaces.active.region_3d.view_perspective = 'CAMERA'
        area.spaces.active.shading.type = 'MATERIAL'
        area.spaces.active.overlay.show_overlays = False
bpy.ops.object.select_all(action='DESELECT')
root.select_set(True)
bpy.context.view_layer.objects.active = root
bpy.ops.wm.save_as_mainfile(filepath=str(out / 'Mars_Sandstorm.blend'), compress=True)
meta = {'name':'Mars_Sandstorm', 'loop_seconds':12, 'fps':24, 'frames':[1,289], 'meshes':len(objects), 'triangles':sum(len(o.data.polygons)*2 for o in objects), 'textures':'2 embedded RGBA PNGs', 'wind_axis':'+X', 'notes':'No volume shaders, particle cache, external texture URLs or Blender runtime needed. Preview habitat is not in GLB.'}
(out / 'Sandstorm_Metadata.json').write_text(json.dumps(meta, indent=2) + '\n')
if opt.render:
    scene.render.filepath = str(out / 'Mars_Sandstorm_Preview.png')
    bpy.ops.render.render(write_still=True)
print('SANDSTORM_DONE', json.dumps(meta), flush=True)
