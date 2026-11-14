"""Blender 4.5: a game-ready four-seat Mars expedition rover.
blender --background --factory-startup --python build_rover.py -- --output /path
"""
import bpy, math, sys, argparse, random
from pathlib import Path
from mathutils import Vector
p=argparse.ArgumentParser();p.add_argument('--output',required=True);p.add_argument('--render',action='store_true')
a=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
out=Path(a.output).resolve();out.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
s=bpy.context.scene;s.name='WAYFARER | Mars expedition rover';s.unit_settings.system='METRIC'
bpy.context.preferences.filepaths.save_version=0
asset=bpy.data.collections.new('EXPORT | Wayfarer rover');s.collection.children.link(asset)
root=bpy.data.objects.new('Mars_Rover',None);asset.objects.link(root)
root['forward']='+Y Blender / -Z glTF';root['seats']=4;root['wheel_radius_m']=.85
root['notes']='Six wheel pivots roll about local X; Steer_FL/FR turn about glTF local Y. No terrain or presentation geometry in GLB.'
body=bpy.data.objects.new('Chassis',None);asset.objects.link(body);body.parent=root
parent=body
M={}
def mat(name,c,metal=0,rough=.4,alpha=1,emission=0):
 m=bpy.data.materials.new(name);m.diffuse_color=(*c,alpha);m.use_nodes=True
 q=m.node_tree.nodes['Principled BSDF'];q.inputs['Base Color'].default_value=(*c,1);q.inputs['Metallic'].default_value=metal;q.inputs['Roughness'].default_value=rough;q.inputs['Alpha'].default_value=alpha
 if emission:q.inputs['Emission Color'].default_value=(*c,1);q.inputs['Emission Strength'].default_value=emission
 if alpha<1:m.surface_render_method='BLENDED'
 M[name]=m;return m
mat('Ceramic white',(.88,.91,.84),.12);mat('Deep teal',(.018,.16,.17),.5)
mat('Tangerine safety',(.98,.30,.055),.2);mat('Soft tire rubber',(.025,.038,.043),0,.9)
mat('Brushed alloy',(.37,.49,.48),.65);mat('Blue solar cells',(.025,.10,.22),.4,.22)
mat('Cabin glass',(.20,.59,.65),.1,.12,.30);mat('Seat cushion',(.12,.31,.29),0,.75)
mat('Headlight',(.58,.94,1),.1,.2,1,2);mat('Status green',(.25,.95,.65),0,.3,1,1)
def put(o,name,m):
 o.name=name
 for c in list(o.users_collection):c.objects.unlink(o)
 asset.objects.link(o);o.parent=parent
 if m:o.data.materials.append(M[m])
 return o
def box(name,loc,dims,m='Ceramic white',bevel=.07,rot=None):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=put(bpy.context.object,name,m);o.scale=dims
 bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 if rot:o.rotation_euler=rot
 if bevel:
  b=o.modifiers.new('Soft corners','BEVEL');b.width=bevel;b.segments=3;o.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
 return o
def cyl(name,loc,r,depth,m,rot=None,verts=32):
 bpy.ops.mesh.primitive_cylinder_add(vertices=verts,radius=r,depth=depth,location=loc);o=put(bpy.context.object,name,m)
 if rot:o.rotation_euler=rot
 b=o.modifiers.new('Rounded rim','BEVEL');b.width=.035;b.segments=2;o.modifiers.new('Weighted normals','WEIGHTED_NORMAL');return o
def beam(name,a,b,r,m):
 a,b=Vector(a),Vector(b);o=cyl(name,(a+b)/2,r,(b-a).length,m,verts=12);o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler();return o
def text(t,loc,size=.18,rot=(math.pi/2,0,0),m='Deep teal'):
 d=bpy.data.curves.new(t,'FONT');d.body=t;d.align_x='CENTER';d.size=size;d.extrude=.001
 o=bpy.data.objects.new(t,d);asset.objects.link(o);o.parent=parent;o.location=loc;o.rotation_euler=rot;o.data.materials.append(M[m]);return o
# Broad, rounded pressurized cabin with actual open window bays and four seats.
box('Electric chassis',(0,0,1.25),(3.7,6.5,.6),'Deep teal',.22)
box('Cabin floor',(0,.1,1.72),(3.7,5.15,.35),bevel=.17)
box('Cabin lower shell',(0,.2,2.2),(3.8,5.2,.7),bevel=.25)
box('Roof',(0,.25,4.65),(3.95,5.2,.35),bevel=.2)
for x in [-1.78,1.78]:
 for y in [-2.2,.1,2.55]:box('Cabin pillar',(x,y,3.55),(.18,.2,2.05),bevel=.07)
 box('Side glass',(x*1.035,.25,3.54),(.065,4.68,1.75),'Cabin glass',.025)
 box('Orange side belt',(x*1.08,.2,2.51),(.12,5.05,.11),'Tangerine safety',.03)
 box('Side window sill',(x*1.07,.2,2.68),(.12,5.05,.12),'Deep teal',.03)
 # Side ladder and grip rail.
 for z in [1.05,1.37]:box('Boarding step',(x*1.13,.2,z),(.5,1.2,.1),'Brushed alloy',.03)
 beam('Hand rail',(x*1.09,-.5,2.0),(x*1.09,-.5,3.1),.045,'Tangerine safety')
box('Front windshield',(0,2.65,3.56),(3.45,.07,1.65),'Cabin glass',.025)
box('Windshield mullion',(0,2.69,3.55),(.12,.13,1.85),'Deep teal',.025)
box('Front orange brow',(0,2.7,4.4),(3.65,.15,.14),'Tangerine safety',.04)
box('Bumper',(0,3.05,1.55),(4.05,.35,.32),'Deep teal',.12)
for x in [-1.34,1.34]:
 box('Headlight bezel',(x,2.86,2.19),(.75,.25,.4),'Deep teal',.08)
 box('Headlight lens',(x,3.0,2.22),(.56,.035,.18),'Headlight',.035)
 cyl('Front tow lug',(x,3.24,1.4),.13,.12,'Tangerine safety',(math.pi/2,0,0),16)
text('WAYFARER 01',(0,2.818,2.48),.23,(math.pi/2,0,math.pi),'Deep teal')
# Rear airlock, external cargo shelf, oxygen bottles and spare tire.
box('Rear pressure bulkhead',(0,-2.32,3.4),(3.55,.2,2.5),bevel=.2)
box('Rear hatch frame',(0,-2.48,3.15),(1.9,.12,2.35),'Tangerine safety',.18)
box('Rear hatch',(0,-2.57,3.15),(1.65,.1,2.1),'Deep teal',.16)
box('Hatch porthole',(0,-2.64,3.65),(.95,.06,.62),'Cabin glass',.12)
box('Cargo platform',(0,-3.0,1.75),(3.65,1.1,.22),'Deep teal',.08)
for x in [-1.1,1.1]:
 box('Cargo pod',(x,-3.05,2.15),(.85,.72,.65),bevel=.1)
 box('Cargo strap',(x,-3.08,2.49),(.18,.75,.04),'Tangerine safety',.01)
for x in [-1.6,1.6]:
 cyl('Oxygen bottle',(x,-2.7,3.35),.19,1.35,'Ceramic white')
 cyl('Oxygen valve',(x,-2.7,4.1),.09,.15,'Tangerine safety')
# Cabin furniture. Driver is front-left in glTF coordinates.
for x in [-.86,.86]:
 for y in [-.9,1.0]:
  box('Seat cushion',(x,y,2.05),(.78,.8,.25),'Tangerine safety',.12)
  box('Seat back',(x,y-.35,2.65),(.82,.22,1.1),'Seat cushion',.12)
box('Dashboard',(0,2.0,2.78),(3.1,.65,.32),'Deep teal',.09)
box('Navigation screen',(.55,1.8,3.05),(.9,.10,.5),'Blue solar cells',.035,(.2,0,0))
for x in [.25,.55,.85]:box('Screen readout',(x,1.735,3.12),(.16,.02,.035),'Status green',.008)
# Steering wheel ring faces the driver, without copying a real vehicle design.
bpy.ops.mesh.primitive_torus_add(major_radius=.25,minor_radius=.035,major_segments=24,minor_segments=6,location=(-.86,1.7,3.05),rotation=(math.pi/2,0,0));put(bpy.context.object,'Driver wheel','Tangerine safety')
beam('Steering column',(-.86,1.95,2.8),(-.86,1.72,3.05),.045,'Deep teal')
# Solar roof and communications mast.
box('Solar roof frame',(0,.25,4.88),(3.3,3.9,.12),'Deep teal',.05)
for x in [-1.05,0,1.05]:
 for y in [-1.0,.25,1.5]:box('Solar cell',(x,y,4.96),(.92,1.1,.035),'Blue solar cells',.025)
cyl('Radio mast base',(1.4,-1.8,4.95),.16,.12,'Tangerine safety')
beam('Radio whip',(1.4,-1.8,5.0),(1.4,-1.8,5.9),.025,'Brushed alloy')
for x in [-1.7,1.7]:cyl('Roof beacon',(x,2.2,4.95),.12,.22,'Tangerine safety')
# Six articulated, replaceable wheel assemblies. Pivots stay separate after batching.
for tag,y in [('F',2.25),('M',0),('R',-2.25)]:
 for side,x in [('L',-2.05),('R',2.05)]:
  name=tag+side
  parent=body
  beam('Suspension',(.95*(1 if x>0 else -1),y,1.45),(x,y,.88),.11,'Brushed alloy')
  steer=bpy.data.objects.new('Steer_'+name,None);asset.objects.link(steer);steer.parent=root;steer.location=(x,y,.86)
  wheel=bpy.data.objects.new('Wheel_'+name,None);asset.objects.link(wheel);wheel.parent=steer
  parent=wheel
  cyl('Tire',(0,0,0),.85,.62,'Soft tire rubber',(0,math.pi/2,0),32)
  for sign in [-1,1]:
   cyl('Rim',(sign*.325,0,0),.52,.05,'Deep teal',(0,math.pi/2,0),24)
   cyl('Hub',(sign*.37,0,0),.24,.08,'Tangerine safety',(0,math.pi/2,0),16)
  for i in range(20):
   t=i*2*math.pi/20
   box('Traction cleat',(0,.84*math.sin(t),.84*math.cos(t)),(.66,.105,.07),'Soft tire rubber',.015,(-t,0,0))
parent=body
# Apply bevels and join stationary geometry per articulated parent to reduce draw calls.
for o in list(asset.objects):
 if o.type=='FONT':
  bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.convert(target='MESH')
for o in list(asset.objects):
 if o.type=='MESH':
  bpy.context.view_layer.objects.active=o
  for m in list(o.modifiers):bpy.ops.object.modifier_apply(modifier=m.name)
for anchor in [body]+[o for o in asset.objects if o.name.startswith('Wheel_')]:
 meshes=[o for o in asset.objects if o.type=='MESH' and o.parent==anchor]
 if not meshes:continue
 bpy.ops.object.select_all(action='DESELECT')
 for o in meshes:o.select_set(True)
 bpy.context.view_layer.objects.active=meshes[0];bpy.ops.object.join();meshes[0].name=anchor.name+'_Geometry'
# Join keeps all material slots; remove unused/duplicate slots on export automatically.
bpy.ops.object.select_all(action='DESELECT')
for o in asset.objects:o.select_set(True)
bpy.context.view_layer.objects.active=root
bpy.ops.export_scene.gltf(filepath=str(out/'Mars_Rover.glb'),export_format='GLB',use_selection=True,export_apply=True,export_extras=True)
# Preview stage is not exported.
preview=bpy.data.collections.new('PREVIEW ONLY');s.collection.children.link(preview)
def stage(o):
 for c in list(o.users_collection):c.objects.unlink(o)
 preview.objects.link(o);return o
bpy.ops.mesh.primitive_plane_add(size=200);floor=stage(bpy.context.object);floor.data.materials.append(mat('Regolith',(.42,.15,.065),0,1))
bpy.ops.object.camera_add(location=(12,17,10));cam=stage(bpy.context.object);cam.rotation_euler=(Vector((0,0,2.2))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=13;s.camera=cam
s.world=bpy.data.worlds.new('Mars studio');s.world.use_nodes=True;s.world.node_tree.nodes['Background'].inputs[0].default_value=(.22,.13,.08,1);s.world.node_tree.nodes['Background'].inputs[1].default_value=.7
for pos,power,size in [((-6,7,12),1800,8),((7,-5,9),1200,7)]:
 bpy.ops.object.light_add(type='AREA',location=pos);o=stage(bpy.context.object);o.data.energy=power;o.data.shape='DISK';o.data.size=size;o.rotation_euler=(Vector((0,0,2))-o.location).to_track_quat('-Z','Y').to_euler()
s.render.engine='CYCLES';s.cycles.samples=24;s.cycles.use_denoising=True;s.cycles.transparent_max_bounces=32
s.render.resolution_x=1280;s.render.resolution_y=960;s.render.resolution_percentage=100;s.render.image_settings.file_format='PNG';s.view_settings.view_transform='AgX'
s['README']='Select EXPORT | Wayfarer rover for GLB export. PREVIEW ONLY holds the stage. Wheel and steering empties are the runtime joints. All materials are embedded; no external textures.'
for area in bpy.context.screen.areas:
 if area.type=='VIEW_3D':area.spaces.active.region_3d.view_perspective='CAMERA';area.spaces.active.overlay.show_overlays=False;area.spaces.active.shading.type='MATERIAL'
bpy.ops.object.select_all(action='DESELECT');root.select_set(True);bpy.context.view_layer.objects.active=root
bpy.ops.wm.save_as_mainfile(filepath=str(out/'Mars_Rover.blend'),compress=True)
if a.render:s.render.filepath=str(out/'Mars_Rover_Preview.png');bpy.ops.render.render(write_still=True)
print('ROVER_DONE',flush=True)
