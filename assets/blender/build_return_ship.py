"""Enclosed walk-through return ship, modeled in Blender 4.5.
blender --background --factory-startup --python assets/blender/build_return_ship.py -- --output /path --render
The floor plan and collision footprints live in shared/src/data/flight-layout.json.
"""
import bpy,math,json,sys,argparse
from pathlib import Path
from mathutils import Vector
p=argparse.ArgumentParser();p.add_argument('--output',required=True);p.add_argument('--render',action='store_true');p.add_argument('--layout')
a=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
out=Path(a.output).resolve();out.mkdir(parents=True,exist_ok=True)
lp=Path(a.layout) if a.layout else Path(__file__).resolve().parents[2]/'shared/src/data/flight-layout.json'
if not lp.exists():lp=Path(__file__).with_name('flight-layout.json')
layout=json.loads(lp.read_text())
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
s=bpy.context.scene;s.name='WAYFARER | Return ship interior';s.unit_settings.system='METRIC';bpy.context.preferences.filepaths.save_version=0
asset=bpy.data.collections.new('EXPORT | Return ship');s.collection.children.link(asset)
root=bpy.data.objects.new('Mars_Return_Ship_Interior',None);asset.objects.link(root);root['layout_version']=2;root['notes']='Enclosed perspective interior. +Y Blender / -Z game forward. Original SpaceApps corridor/cockpit layout recreated in Blender. No external images.'
anchors={};M={}
def anchor(n):
 o=bpy.data.objects.new(n,None);asset.objects.link(o);o.parent=root;anchors[o.name]=o;return o
parent=anchor('Hull')
def mat(n,c,metal=0,rough=.5,em=0):
 m=bpy.data.materials.new(n);m.diffuse_color=(*c,1);m.use_nodes=True;q=m.node_tree.nodes['Principled BSDF'];q.inputs['Base Color'].default_value=(*c,1);q.inputs['Metallic'].default_value=metal;q.inputs['Roughness'].default_value=rough
 if em:q.inputs['Emission Color'].default_value=(*c,1);q.inputs['Emission Strength'].default_value=em
 M[n]=m;return m
mat('Ivory pressure liner',(.76,.79,.73),.05);mat('Ceiling white',(.87,.89,.81),.03);mat('Warm grey trim',(.39,.45,.43),.3)
mat('Deck composite',(.30,.34,.32),.1,.85);mat('Runner',(.18,.22,.20),0,.9);mat('Graphite',(.025,.04,.036),.25)
mat('Equipment casing',(.08,.12,.12),.4);mat('Brushed metal',(.4,.48,.45),.7);mat('Copper piping',(.48,.18,.07),.6)
mat('Red enamel',(.75,.035,.025),.2);mat('Teal trim',(.03,.21,.20),.35);mat('Amber safety',(.96,.48,.09),.1)
mat('Display glass',(.008,.035,.02),.1,.25);mat('Terminal green',(.19,.88,.34),0,.4,1.2);mat('Cyan status',(.18,.77,.81),0,.4,1.1)
mat('Light strip',(.98,.94,.80),0,.4,2.2);mat('Paper',(.84,.78,.58),0,.9);mat('White print',(.84,.91,.80),0,.6);mat('Seat upholstery',(.27,.08,.055),0,.85)
def put(o,n,m):
 o.name=n
 for c in list(o.users_collection):c.objects.unlink(o)
 asset.objects.link(o);o.parent=parent
 if m:o.data.materials.append(M[m])
 return o
def box(n,x,y,z,w,h,d,m='Ivory pressure liner',b=.03):
 bpy.ops.mesh.primitive_cube_add(size=1,location=(x,-z,y));o=put(bpy.context.object,n,m);o.scale=(w,d,h);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 if b:
  q=o.modifiers.new('Edge radius','BEVEL');q.width=b;q.segments=2;o.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
 return o
def cyl(n,x,y,z,r,h,m='Brushed metal',axis='y'):
 bpy.ops.mesh.primitive_cylinder_add(vertices=16,radius=r,depth=h,location=(x,-z,y));o=put(bpy.context.object,n,m)
 if axis=='x':o.rotation_euler[1]=math.pi/2
 if axis=='z':o.rotation_euler[0]=math.pi/2
 return o
def beam(n,a,b,r=.035,m='Copper piping'):
 a=Vector((a[0],-a[2],a[1]));b=Vector((b[0],-b[2],b[1]));bpy.ops.mesh.primitive_cylinder_add(vertices=12,radius=r,depth=(b-a).length,location=(a+b)/2);o=put(bpy.context.object,n,m);o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler();return o
def text(t,x,y,z,size=.15,m='White print',yaw=0):
 d=bpy.data.curves.new(t,'FONT');d.body=t;d.align_x='CENTER';d.align_y='CENTER';d.size=size;d.extrude=.0003;o=bpy.data.objects.new(t,d);asset.objects.link(o);o.parent=parent;o.location=(x,-z,y);o.rotation_euler=(math.pi/2,0,yaw);d.materials.append(M[m]);return o
def monitor(n,x,y,z,w=1,h=.65,yaw=0):
 # The local plane faces the corridor when rotated around its standing axis.
 g=anchor(n);old=globals()['parent'];globals()['parent']=g
 box('Terminal bezel',0,y,0,w+.12,h+.12,.12,'Equipment casing')
 box('Terminal display',0,y,.071,w,h,.025,'Display glass',.01)
 for i in range(4):box('Telemetry trace',-.12*w,y+h*(.3-i*.18),.09,w*(.7-i*.07),.016,.012,'Terminal green',0)
 for i in range(5):box('Terminal key',-.35*w+i*w*.175,y-h*.68,.1,.09,.035,.10,'Warm grey trim',.006)
 g.location=(x,-z,0);g.rotation_euler[2]=yaw;globals()['parent']=old;return g
# Pressure shell: actual ceiling and bulkheads enclose the first-person view.
for r in layout['rooms']:
 box('Insulated deck',r['x'],-.12,r['z'],r['w']+.3,.24,r['d'],'Warm grey trim',.05)
 box('Deck runner',0,.012,r['z'],1.9,.025,r['d']-.08,'Runner',.006)
 for sign in [-1,1]:
  box('Pressure sidewall',sign*(r['w']/2+.08),1.9,r['z'],.16,3.8,r['d'],'Ivory pressure liner',.02)
  box('Skirting',sign*(r['w']/2-.05),.12,r['z'],.13,.24,r['d'],'Warm grey trim',.02)
 # Seams and shallow ribs make the narrow corridor read at human scale.
 count=int(r['d']/2.2)
 for i in range(count):
  z=r['z']-r['d']/2+(i+.5)*r['d']/count
  for sign in [-1,1]:box('Panel seam',sign*(r['w']/2-.015),1.9,z,.025,3.4,.035,'Warm grey trim',.003)
  box('Floor cross seam',0,.027,z,r['w']-.12,.008,.025,'Warm grey trim',0)
parent=anchor('Ceiling')
for r in layout['rooms']:
 box('Pressure ceiling',0,3.86,r['z'],r['w']+.3,.12,r['d'],'Ceiling white')
 for z in [r['z']-r['d']*.3,r['z'],r['z']+r['d']*.3]:
  box('Light housing',0,3.73,z,1.25,.10,r['d']*.24,'Warm grey trim')
  box('Diffused ceiling light',0,3.66,z,1.02,.035,r['d']*.24-.12,'Light strip',.01)
parent=anchors['Hull']
box('Aft bulkhead',0,1.9,10.6,6.2,3.8,.2)
box('Aft service hatch',0,1.7,10.47,1.65,3.2,.08,'Teal trim',.15)
text('PRESSURIZED CABIN',0,3.25,10.39,.19,yaw=math.pi)
# Transition into the wider flight deck, with an open, full-height central doorway.
for x in [-3.65,3.65]:box('Bridge shoulder',x,1.9,-15.2,1.1,3.8,.2)
for x in [-2.95,2.95]:box('Cockpit jamb',x,1.9,-15.2,.20,3.8,.3,'Graphite')
box('Bridge lintel',0,3.55,-15.2,6.1,.5,.3,'Teal trim')
text('FLIGHT DECK  /  EARTH RETURN',0,3.53,-15.0,.22)
# The glass opening has a physical sill and mullions. Space is rendered beyond it.
box('Nose lower bulkhead',0,.55,-27.15,8.4,1.1,.2)
box('Nose header',0,3.65,-27.15,8.4,.3,.2,'Teal trim')
for x in [-4.05,-2.7,2.7,4.05]:box('Window frame',x,2.3,-27.15,.12,2.7,.22,'Graphite')
box('Window sill',0,1.2,-27.1,8.3,.12,.3,'Brushed metal')
# Starboard handrail and visible cable runs echo the SpaceApps reference.
parent=anchor('Services')
beam('Continuous copper handrail',(2.78,1.38,9),(2.78,1.38,-13.7),.055)
for z in [8,4,0,-4,-8,-12]:beam('Rail bracket',(2.78,1.38,z),(2.98,1.38,z),.04,'Warm grey trim')
beam('Overhead cable',(-2.85,3.1,9.5),(-2.85,3.1,-14),.055,'Graphite')
for z in [6.7,6.1]:beam('Copper manifold',(-2.75,.25,z),(-2.75,2.55,z),.075)
for y in [.3,2.5]:beam('Manifold bridge',(-2.75,y,6.1),(-2.75,y,6.7),.06)
cyl('Red cabin pump',-2.35,.5,6.4,.23,.85,'Red enamel');cyl('Pump foot',-2.35,.08,6.4,.31,.12,'Graphite')
beam('Pump shaft',(-2.35,.9,6.4),(-2.35,1.4,6.4),.045,'Graphite');beam('Pump handle',(-2.65,1.4,6.4),(-2.05,1.4,6.4),.045,'Graphite')
beam('Pump hose',(-2.35,.2,6.4),(-2.8,.12,7.1),.04,'Graphite')
# Life-support station: side-facing monitor, cylinder valves and live status marker.
parent=anchor('Station_air')
box('Oxygen cabinet',-2.55,1.1,3.6,.65,2.2,1.5,'Equipment casing')
for z in [3.2,4]:
 cyl('Oxygen bottle',-2.2,.9,z,.19,1.4,'Ivory pressure liner');cyl('Isolation valve',-2.2,1.67,z,.12,.1,'Copper piping')
monitor('Oxygen_monitor',-2.12,2.35,3.6,1.0,.6,math.pi/2)
text('O2  /  LIFE SUPPORT',-2.03,2.85,3.6,.18,yaw=math.pi/2)
# Electrical: green CRT-style wall terminals, breakers and cable channels.
parent=anchor('Station_power')
box('Electrical cabinet',-2.4,1.15,-2,.9,2.3,2.4,'Equipment casing')
for z in [-2.6,-1.4]:monitor('Electrical_display',-1.89,2.1,z,.85,.65,math.pi/2)
for z in [-2.75,-2.25,-1.75,-1.25]:
 box('Breaker body',-1.90,1,z,.12,.3,.35,'Graphite');box('Breaker toggle',-1.81,1,z,.08,.1,.18,'Amber safety')
text('POWER DISTRIBUTION',-1.85,2.9,-2,.17,yaw=math.pi/2)
# Hull panel on the opposite wall: four visible replaceable seals.
parent=anchor('Station_hull')
box('Hull access panel',2.7,1.65,-7,.35,2.8,2.3,'Brushed metal')
for z in [-7.6,-6.4]:
 for y in [1,2.05]:
  box('Pressure seal',2.49,y,z,.1,.62,.65,'Graphite');box('Seal grip',2.4,y,z,.08,.1,.45,'Red enamel')
text('CABIN SEAL ACCESS',2.43,3.18,-7,.18,yaw=-math.pi/2)
# Cooling station: radiator fins, return loop, pressure gauge, captive service fasteners.
parent=anchor('Station_engine')
box('Coolant rack',-2.4,1.35,-11,.9,2.7,2.2,'Equipment casing')
for z in [-11.75,-11.25,-10.75,-10.25]:beam('Coolant loop',(-1.86,.3,z),(-1.86,2.35,z),.055,'Copper piping')
monitor('Coolant_display',-1.86,2.85,-11,1.1,.55,math.pi/2)
for y in [.55,.85,1.15]:box('Heat exchanger',-1.85,y,-11,.06,.16,1.6,'Brushed metal')
text('ENGINE COOLING',-1.80,3.35,-11,.18,yaw=math.pi/2)
# Stowage along the hall and cockpit shoulders.
parent=anchor('Stowage')
for x,z,w,d in [(2.55,-11,.65,2.6),(-3.6,-18,.7,1.9),(3.6,-18,.7,1.9)]:
 box('Crew storage locker',x,1.25,z,w,2.5,d,'Warm grey trim')
 for q in [-.5,.5]:box('Locker door',x+(w/2+.02)*(1 if x<0 else -1),1.25,z+q*d*.45,.04,2.36,d*.42,'Ivory pressure liner')
# Control deck with layered green screens, real keys and guarded switches.
parent=anchor('Station_helm')
box('Main console',0,.68,-25.4,5.6,1.35,1.1,'Equipment casing',.10)
box('Console work surface',0,1.43,-25.25,5.8,.16,1.5,'Graphite',.06)
for x in [-1.85,0,1.85]:
 monitor('Flight_telemetry',x,1.82,-25.55,1.45,.54)
 for i in range(8):box('Keyboard key',x-.48+i*.14,1.54,-24.9,.10,.04,.23,'Warm grey trim',.006)
 for q in [-.4,0,.4]:cyl('Console button',x+q,1.56,-24.65,.065,.045,'Amber safety')
text('WAYFARER  /  GUIDANCE',0,1.16,-24.83,.13)
# Red chairs flank a clear route to the helm, avoiding the old central obstruction.
parent=anchor('Cockpit_furniture')
for x in [-2.5,2.5]:
 cyl('Seat pedestal',x,.45,-21,.13,.9,'Brushed metal')
 box('Red seat cushion',x,.95,-21,1.05,.22,1.1,'Red enamel',.13)
 box('Seat back',x,1.55,-20.53,1.05,1.15,.18,'Seat upholstery',.10)
 for sign in [-1,1]:beam('Seat arm',(x+sign*.52,1.3,-21.4),(x+sign*.52,1.3,-20.5),.035,'Graphite')
box('Flight notes',-3.18,2.15,-18,.025,.72,.55,'Paper',.005)
text('BEFORE THE BURN',-3.15,2.3,-18,.09,m='Graphite',yaw=math.pi/2)
text('CHECK AIR / LOCK COURSE',-3.15,2.12,-18,.075,m='Graphite',yaw=math.pi/2)
# Named indicator sockets allow faults to tint separate meshes without recoloring cabinetry.
for key,at in layout['stations'].items():
 parent=anchor('Indicator_'+key)
 x,z={'helm':(1.3,-25.4),'air':(-1.9,3.6),'power':(-1.8,-2),'hull':(2.4,-7),'engine':(-1.8,-11)}[key];cyl('Status lens',x,2.14 if key=='helm' else 2.65,z,.095,.06,'Cyan status','z' if key=='helm' else 'x')
# Convert labels and batch static geometry by anchor and material.
for o in list(asset.objects):
 if o.type=='FONT':
  bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.convert(target='MESH')
for o in list(asset.objects):
 if o.type=='MESH':
  bpy.context.view_layer.objects.active=o
  for q in list(o.modifiers):bpy.ops.object.modifier_apply(modifier=q.name)
for group in anchors.values():
 buckets={}
 for o in list(asset.objects):
  if o.type=='MESH' and o.parent==group:buckets.setdefault(o.data.materials[0].name,[]).append(o)
 for material,meshes in buckets.items():
  bpy.ops.object.select_all(action='DESELECT')
  for o in meshes:o.select_set(True)
  bpy.context.view_layer.objects.active=meshes[0]
  if len(meshes)>1:bpy.ops.object.join()
  meshes[0].name=group.name+' | '+material
bpy.ops.object.select_all(action='DESELECT')
for o in asset.objects:o.select_set(True)
bpy.context.view_layer.objects.active=root
bpy.ops.export_scene.gltf(filepath=str(out/'Mars_Return_Ship_Interior.glb'),export_format='GLB',use_selection=True,export_apply=True,export_extras=True)
# Eye-level corridor render. Preview lighting and camera are excluded from game export.
preview=bpy.data.collections.new('PREVIEW ONLY');s.collection.children.link(preview)
def stage(o):
 for c in list(o.users_collection):c.objects.unlink(o)
 preview.objects.link(o);return o
s.world=bpy.data.worlds.new('Cabin ambient');s.world.use_nodes=True;s.world.node_tree.nodes['Background'].inputs[0].default_value=(.32,.38,.35,1);s.world.node_tree.nodes['Background'].inputs[1].default_value=.65
for z in [7,0,-7,-13,-20,-25]:
 bpy.ops.object.light_add(type='AREA',location=(0,-z,3.5));o=stage(bpy.context.object);o.data.energy=180;o.data.shape='RECTANGLE';o.data.size=2;o.data.size_y=3
bpy.ops.object.camera_add(location=(.3,-8.1,layout['eyeHeight']));cam=stage(bpy.context.object);cam.rotation_euler=(Vector((0,24,2.0))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.lens=19;s.camera=cam
s.render.engine='CYCLES';s.cycles.samples=24;s.cycles.use_denoising=True;s.render.resolution_x=1600;s.render.resolution_y=1000;s.render.resolution_percentage=100;s.view_settings.view_transform='AgX'
s['README']='Original enclosed return-ship interior, matching the SpaceApps long service hall and cockpit layout. Status indicator groups remain separate for runtime fault lights. Floor plan and collision: shared/src/data/flight-layout.json.'
for area in bpy.context.screen.areas:
 if area.type=='VIEW_3D':area.spaces.active.region_3d.view_perspective='CAMERA';area.spaces.active.overlay.show_overlays=False
bpy.ops.wm.save_as_mainfile(filepath=str(out/'Mars_Return_Ship_Interior.blend'),compress=True)
if a.render:s.render.filepath=str(out/'Mars_Return_Ship_Interior_Preview.png');bpy.ops.render.render(write_still=True)
print('RETURN_SHIP_DONE',flush=True)
