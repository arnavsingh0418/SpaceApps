"""Original game habitat interior. Blender 4.5+, no external assets.
blender --background --factory-startup --python assets/blender/build_hab_interior.py -- --output /path --render
Coordinates and navigation footprints: shared/src/data/hab-layout.json.
"""
import bpy, math, json, argparse, sys
from pathlib import Path
from mathutils import Vector
p=argparse.ArgumentParser();p.add_argument('--output',required=True);p.add_argument('--render',action='store_true');p.add_argument('--layout',help='Optional path to hab-layout.json')
a=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
out=Path(a.output).resolve();out.mkdir(parents=True,exist_ok=True)
layout_path=Path(a.layout).resolve() if a.layout else Path(__file__).resolve().parents[2]/'shared/src/data/hab-layout.json'
if not layout_path.exists():layout_path=Path(__file__).with_name('hab-layout.json')
layout=json.loads(layout_path.read_text())
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
s=bpy.context.scene;s.name='ARES HAB | Crew interior';s.unit_settings.system='METRIC';bpy.context.preferences.filepaths.save_version=0
asset=bpy.data.collections.new('EXPORT | Hab interior');s.collection.children.link(asset)
root=bpy.data.objects.new('Mars_Hab_Interior',None);asset.objects.link(root)
root['layout_version']=1;root['crew_capacity']=4;root['notes']='Game interior deck: 22 x 22 m. Roof / pressure panels can be cut away for third-person play. Simulation uses shared hab-layout.json.'
anchors={};M={}
def anchor(name):
 o=bpy.data.objects.new(name,None);asset.objects.link(o);o.parent=root;anchors[name]=o;return o
parent=anchor('Structure')
def mat(n,c,metal=0,rough=.5,em=0):
 m=bpy.data.materials.new(n);m.diffuse_color=(*c,1);m.use_nodes=True;q=m.node_tree.nodes['Principled BSDF'];q.inputs['Base Color'].default_value=(*c,1);q.inputs['Metallic'].default_value=metal;q.inputs['Roughness'].default_value=rough
 if em:q.inputs['Emission Color'].default_value=(*c,1);q.inputs['Emission Strength'].default_value=em
 M[n]=m;return m
mat('Warm ceramic',(.79,.83,.79),.08);mat('Pressure liner',(.52,.61,.61),.2);mat('Deep teal',(.025,.13,.15),.35)
mat('Safety orange',(.95,.31,.08),.1);mat('Alloy',(.41,.52,.54),.7);mat('Graphite',(.035,.058,.065),.25)
mat('Floor composite',(.16,.22,.24),.1,.8);mat('Floor inset',(.23,.31,.32),.15,.8);mat('Linen',(.68,.72,.67),0,.95)
mat('Cushion',(.16,.32,.34),0,.9);mat('Pillow',(.84,.85,.75),0,.95);mat('Water blue',(.12,.42,.54),.2)
mat('Screen',(.016,.065,.095),.15,.3);mat('Cyan light',(.2,.78,.84),0,.3,1.3);mat('Warm light',(.99,.79,.45),0,.3,1.8)
mat('Green light',(.3,.82,.48),0,.4,1);mat('Red marking',(.8,.14,.11),0,.5);mat('White marking',(.9,.93,.87),0,.6)
for i,c in enumerate([(.92,.39,.15),(.2,.48,.72),(.22,.55,.35),(.85,.66,.2)]):mat('Crew '+str(i+1),c,0,.8)
def put(o,n,m):
 o.name=n
 for c in list(o.users_collection):c.objects.unlink(o)
 asset.objects.link(o);o.parent=parent
 if m:o.data.materials.append(M[m])
 return o
def box(n,x,y,z,w,h,d,m='Warm ceramic',b=.045):
 bpy.ops.mesh.primitive_cube_add(size=1,location=(x,-z,y));o=put(bpy.context.object,n,m);o.scale=(w,d,h);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 if b:
  q=o.modifiers.new('Edge radius','BEVEL');q.width=b;q.segments=2;o.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
 return o
def cyl(n,x,y,z,r,h,m='Alloy',axis='y'):
 bpy.ops.mesh.primitive_cylinder_add(vertices=16,radius=r,depth=h,location=(x,-z,y));o=put(bpy.context.object,n,m)
 if axis=='x':o.rotation_euler[1]=math.pi/2
 if axis=='z':o.rotation_euler[0]=math.pi/2
 return o
def beam(n,a,b,r=.035,m='Alloy'):
 a=Vector((a[0],-a[2],a[1]));b=Vector((b[0],-b[2],b[1]));mid=(a+b)/2
 bpy.ops.mesh.primitive_cylinder_add(vertices=10,radius=r,depth=(b-a).length,location=mid);o=put(bpy.context.object,n,m);o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler();return o
def text(t,x,y,z,size=.20,m='White marking',floor=False):
 d=bpy.data.curves.new(t,'FONT');d.body=t;d.align_x='CENTER';d.align_y='CENTER';d.size=size;d.extrude=.0006
 o=bpy.data.objects.new(t,d);asset.objects.link(o);o.parent=parent;o.location=(x,-z,y);o.rotation_euler=(0,0,0) if floor else (math.pi/2,0,0);d.materials.append(M[m]);return o
def panel(n,x,y,z,w=1.2,h=.7):
 box(n+' frame',x,y,z,w+.10,h+.10,.1,'Graphite');box(n+' display',x,y,z+.065,w,h,.025,'Screen',.01)
 for i in range(3):
  box('Telemetry line',x-w*.2,y+h*(.28-i*.23),z+.084,w*(.65-i*.09),.018,.012,'Cyan light',0)
 for i in range(4):box('Status diode',x-w*.3+i*w*.2,y-h*.34,z+.084,.035,.035,.012,'Green light',0)
def handle(x,y,z,w=.25):beam('Cabinet handle',(x-w/2,y,z),(x+w/2,y,z),.022,'Alloy')
def drawer(n,x,y,z,w,h,d,m='Warm ceramic'):
 box(n,x,y,z,w,h,d,m);box(n+' face',x,y,z+d/2+.015,w-.06,h-.06,.035,m,.02);handle(x,y+h*.18,z+d/2+.06)
def chair(x,z):
 cyl('Chair pedestal',x,.4,z,.10,.8);box('Seat',x,.86,z,.8,.16,.75,'Cushion',.10);box('Seat back',x,1.35,z+.33,.8,.85,.13,'Cushion',.08)
 for q in [-1,1]:beam('Seat foot',(x,.08,z),(x+q*.4,.08,z+.28),.035)
# Raised access floor, panel seams, illuminated circulation strips.
box('Service floor',0,-.16,0,22.4,.32,22.4,'Deep teal',.14)
for x in range(-10,11,2):
 for z in range(-10,11,2):box('Removable floor panel',x,.008,z,1.97,.025,1.97,'Floor composite',.014)
for z in [-4,-1,2,5]:
 for x in [-3.4,3.4]:box('Aisle guide',x,.035,z,.055,.02,2.5,'Cyan light',.01)
text('ARES  /  HABITAT 01',0,.046,2,.55,'White marking',True)
text('CREW 04     /     SURFACE OPERATIONS',0,.047,3,.19,'Cyan light',True)
# All navigation walls share footprints with the simulation.
for r in layout['colliders']:
 if not (r['id'].startswith(('Shell','Quarters_divider')) or r['id'] in ['ECLSS_divider','Medical_divider','Medical_south','Hygiene_north','Hygiene_privacy'] or r['id'].startswith('Airlock_side')):continue
 name=r['id'];outer=name.startswith('Shell');parent=anchor(name) if outer else anchors['Structure']
 h=4.1 if outer else 2.8
 box(name,r['x'],h/2,r['z'],r['w'],h,r['d'],'Pressure liner' if outer else 'Warm ceramic',.025)
 box(name+' skirting',r['x'],.16,r['z'],r['w']+.02,.3,r['d']+.02,'Deep teal',.01)
 if outer:
  # Vertical service ribs on the pressure wall.
  for q in range(-9,10,3):
   x,z=(q,r['z']) if r['w']>r['d'] else (r['x'],q)
   box('Pressure rib',x,2.05,z,.14 if r['w']>r['d'] else .34,4.1,.34 if r['w']>r['d'] else .14,'Deep teal',.04)
# Flat upper utility canopy retained in Blender and hidden during cutaway play.
parent=anchor('Roof')
box('Insulated roof',0,4.35,0,22.3,.22,22.3,'Pressure liner',.1)
for x in [-8,-4,0,4,8]:box('Ceiling trunk',x,4.12,0,.28,.22,21,'Deep teal',.03)
# Room identity bands and high signs; fully modeled text, no external texture fetches.
parent=anchor('Wayfinding')
for zone in layout['zones']:
 if zone['id'].startswith('quarter'):continue
 x0,x1,z0,z1=zone['area'];x=(x0+x1)/2;z=z1-.38
 text(zone['label'],x,.06,z,.27,'White marking',True)
box('Central overhead sign',0,3.3,-4.5,6.5,.65,.14,'Deep teal',.06)
text('LIFE SUPPORT  /  COMMAND  /  MEDICAL',0,3.3,-4.405,.21)
# Four sound-lined personal cabins. Each has a bed, stowage, small desk, circadian light.
for i in range(4):
 parent=anchor('Crew_Quarter_'+str(i+1));z=-3.6+i*3.1;m='Crew '+str(i+1)
 box('Acoustic headboard',-10.55,1.25,z, .13,2.4,2.7,'Cushion',.025)
 box('Water shielding stowage',-8.65,.28,z+.22,3.3,.55,1.35,'Deep teal',.07)
 box('Bed mattress',-8.65,.68,z+.22,3.18,.25,1.28,'Linen',.12)
 box('Quilt',-8.2,.84,z+.22,2.15,.12,1.25,m,.055)
 box('Pillow',-9.75,.88,z+.22,.7,.19,1.0,'Pillow',.12)
 for k in range(5):box('Quilt seam',-8.95+k*.36,.91,z+.22,.017,.009,1.12,'Linen',0)
 drawer('Personal locker',-5.25,1.2,z+1.02,1.35,2.4,.55)
 box('Desk top',-6.05,1.1,z-1.08,2.05,.12,.55,'Alloy')
 panel('Personal terminal',-6.2,1.55,z-1.28,.7,.4)
 box('Notebook',-5.55,1.19,z-1.06,.35,.055,.3,m,.015)
 box('Reading lamp',-10.32,2.1,z, .13,.11,1.2,'Warm light',.02)
 box('Berth number plaque',-4.8,2.5,z+1.23,.9,.35,.08,'Deep teal',.02)
 text('0'+str(i+1),-4.8,2.5,z+1.29,.22)
 # Rails and open privacy curtain gathered beside the entry, never blocks the aisle.
 beam('Privacy track',(-4.35,2.8,z-1.45),(-4.35,2.8,z+1.45),.025)
 for k in range(5):box('Gathered curtain',-4.35+k*.025,1.65,z+1.2,.06,2.25,.07,'Cushion',.018)
# Environmental control: separate CO2 capture, oxygen generation and water loop racks.
parent=anchor('ECLSS')
for n,x in enumerate([-9.6,-7.6,-5.6]):
 box('Service rack',x,1.45,-10,1.6,2.9,1.2,'Deep teal',.065)
 box('Rack header',x,2.64,-9.36,1.4,.32,.07,'Alloy',.02)
 text(['CO2 CAPTURE','O2 GENERATOR','WATER LOOP'][n],x,2.64,-9.31,.14)
 panel('Rack telemetry',x,2.13,-9.36,.95,.45)
 for k in range(3):
  if n==0:
   cyl('Scrubber cartridge',x-.45+k*.45,1.0,-9.4,.17,1.25,'Warm ceramic');cyl('Cartridge cap',x-.45+k*.45,1.66,-9.4,.18,.08,'Safety orange')
  else:drawer('Service drawer',x,.5+k*.43,-9.37,1.35,.35,.1,'Pressure liner')
 for v in [-.57,.57]:beam('Rack grab rail',(x+v,.4,-9.26),(x+v,2.4,-9.26),.025,'Safety orange')
for y in [.45,2.85]:beam('Water manifold',(-10.4,y,-10),(-4.4,y,-10),.055,'Water blue')
for x in [-9.5,-5.5]:beam('Return line',(x,.45,-9.25),(x,2.85,-9.25),.04,'Water blue')
box('Water recycler',-10.05,1.15,-7.1,1.1,2.3,2.2,'Warm ceramic',.08)
for z in [-7.6,-6.6]:cyl('Water storage',-10.05,2.7,z,.35,.75,'Water blue')
text('FILTER  /  VERIFY  /  RECIRCULATE',-6.9,.055,-6.2,.22,'Cyan light',True)
# Command workstation and independent communications rack, tangible telemetry graphics.
parent=anchor('Command_Comms')
box('Console plinth',0,.55,-9.8,5.6,1.1,1.2,'Deep teal',.08)
box('Work surface',0,1.16,-9.7,5.85,.14,1.35,'Alloy')
for x in [-1.9,0,1.9]:
 panel('Command screen',x,1.95,-10,1.55,.93)
 for j in range(7):box('Keyboard key',x-.5+j*.16,1.25,-9.28,.12,.035,.25,'Graphite',.008)
for x in [-1.6,1.6]:chair(x,-8.1)
box('Communications rack',2.85,1.4,-7.2,.75,2.8,2,'Deep teal')
for y in [.45,.9,1.35,1.8,2.25]:
 drawer('Radio module',2.85,y,-6.18,.65,.33,.08,'Alloy');cyl('Radio dial',3.05,y,-6.08,.055,.04,'Graphite','z')
text('EARTH LINK  /  DELAYED MESSAGES',0,.05,-6.1,.24,'Cyan light',True)
# Medical: examination couch, diagnostic monitor, labeled first aid, oxygen and sharps stowage.
parent=anchor('Medical')
box('Medical couch base',8.95,.55,-7.2,1.1,1.1,2.9,'Deep teal',.1)
box('Medical mattress',8.95,1.2,-7.2,1.45,.3,3.5,'Pillow',.16)
box('Raised head cushion',8.95,1.45,-8.45,1.3,.25,.8,'Cushion',.12)
for x in [8.1,9.8]:beam('Couch rail',(x,1.55,-8),(x,1.55,-6.4),.035)
for i in range(2):drawer('Medical stores',5.8+i*1.3,1.2,-10,1.15,2.4,.9)
box('First aid box',6.4,1.3,-9.48,.7,.65,.15,'White marking')
box('Red cross horizontal',6.4,1.3,-9.39,.42,.13,.025,'Red marking',.005);box('Red cross vertical',6.4,1.3,-9.37,.13,.42,.025,'Red marking',.005)
beam('Monitor stand',(7.65,.1,-8),(7.65,2.25,-8),.035);panel('Medical monitor',7.65,2.5,-8,.85,.6)
cyl('Medical oxygen',10.2,.8,-9.2,.23,1.4,'Warm ceramic');cyl('Oxygen regulator',10.2,1.57,-9.2,.1,.15,'Green light')
# Galley: food rehydration, heater, sink, restrained storage and four dining seats.
parent=anchor('Galley')
box('Galley cabinet run',10,.55,-.3,1.05,1.1,4.8,'Warm ceramic')
box('Galley worktop',10,1.16,-.3,1.16,.13,4.95,'Alloy')
for z in [-1.9,-.7,.5,1.7]:
 box('Cabinet reveal',9.46,.62,z,.025,.85,.95,'Pressure liner',.01)
box('Sink rim',9.99,1.24,.5,.8,.04,.85,'Graphite',.05);box('Sink basin',9.99,1.26,.5,.65,.02,.66,'Alloy',.08)
beam('Faucet riser',(10.3,1.2,.5),(10.3,1.65,.5),.035);beam('Faucet spout',(10.3,1.65,.5),(9.95,1.65,.5),.035)
box('Food warmer',10,1.6,-1.65,.92,.75,.82,'Deep teal',.06);panel('Warmer',10,1.6,-1.2,.65,.4)
for z in [.9,1.3,1.7]:box('Food pouch',9.9,1.55,z,.46,.6,.26,'Safety orange',.04)
box('Dining table',7.3,1.04,-.2,2.15,.13,1.7,'Pillow',.12)
cyl('Dining pedestal',7.3,.5,-.2,.18,1,'Deep teal')
for x in [6.45,8.15]:
 for z in [-1.5,1.1]:
  cyl('Dining stool',x,.65,z,.36,.17,'Cushion');cyl('Stool support',x,.3,z,.07,.6,'Alloy')
for x in [6.7,7.9]:
 for z in [-.55,.2]:cyl('Meal tray',x,1.13,z,.25,.025,'Deep teal');cyl('Cup',x+.25,1.25,z,.09,.23,'Warm ceramic')
drawer('Pantry',5,1.3,-2.6,1.5,2.6,.6)
# Wet room: privacy partition, dry toilet, closed shower, handwashing and linen.
parent=anchor('Hygiene')
box('Shower base',9.5,.08,6.6,2.5,.16,2.5,'Alloy',.08)
for x in [8.3,10.7]:box('Shower stall',x,1.5,6.6,.08,3,2.5,'Water blue',.02)
box('Shower rear',9.5,1.5,7.85,2.5,3,.08,'Pressure liner')
for i in range(12):box('Shower privacy curtain',8.4+i*.2,1.5,5.4,.22,2.9,.05,'Linen',.015)
beam('Shower riser',(10.5,.3,7.5),(10.5,2.85,7.5),.035)
cyl('Shower head',10.1,2.85,7.5,.16,.08,'Alloy');beam('Shower neck',(10.5,2.85,7.5),(10.1,2.85,7.5),.035)
box('Sanitation pedestal',9.4,.42,3.95,.9,.84,1.05,'Warm ceramic',.16);cyl('Toilet seat',9.4,.91,3.95,.44,.1,'Graphite')
box('Toilet cistern',9.4,1.1,3.45,.9,1.1,.25,'Warm ceramic')
box('Hygiene vanity',5.5,.6,7.6,1.7,1.2,.7,'Warm ceramic');box('Handwashing sink',5.5,1.25,7.6,1.45,.12,.65,'Alloy',.08)
panel('Water use display',5.5,2.05,7.9,.8,.5)
for x in [5,5.5,6]:box('Folded towel',x,1.4,7.6,.35,.13,.4,'Pillow')
text('WATER IS PRECIOUS',6,.05,4.4,.24,'Cyan light',True)
# Airlock vestibule: two pressure hatches, suit service racks, dust grid, emergency gear.
parent=anchor('Airlock')
for z in [7,10.8]:
 for x in [-2.45,2.45]:box('Hatch jamb',x,1.8,z,.28,3.6,.35,'Safety orange',.06)
 box('Hatch lintel',0,3.55,z,5.2,.28,.35,'Deep teal',.06)
 if z>10:box('Outer hatch',0,1.7,z,4.6,3.4,.18,'Pressure liner',.12)
 else:
  for x in [-2.1,2.1]:box('Retracted inner hatch',x,1.65,z,.55,3.15,.16,'Pressure liner',.04)
for z in [7.4,7.7,8,8.3,8.6,8.9,9.2,9.5,9.8,10.1]:box('Dust grate',0,.05,z,4.4,.03,.12,'Alloy',.005)
for x in [-1.8,1.8]:box('Pressure status lamp',x,3.17,7,.14,.18,.39,'Green light',.02)
text('INNER SEAL  /  HAB SIDE',0,3.55,7.2,.21)
text('EXTERIOR HATCH',0,2.8,10.65,.3,'Deep teal')
panel('Airlock control',1.85,1.9,10.56,.7,.85)
for side in [-1,1]:
 box('Suit rack',side*5,.28,9.7,3.5,.5,1,'Deep teal')
 for j in [-1,1]:
  x=side*5+j*.8
  box('Suit service pack',x,1.65,9.8,.7,1.2,.35,'Warm ceramic',.12)
  cyl('Helmet ring',x,2.45,9.8,.29,.1,'Safety orange')
  for dx in [-.22,.22]:box('Suit boot',x+dx,.8,9.8,.3,.55,.55,'Graphite',.07)
  beam('Suit umbilical',(x+.4,.7,10),(x+.4,2.1,10),.04,'Water blue')
for x in [-3.5,3.5]:
 cyl('Fire extinguisher',x,1.15,7.7,.18,.9,'Red marking');beam('Extinguisher hose',(x+.15,1.5,7.7),(x+.3,.9,7.7),.025,'Graphite')
# Exposed service runs above partitions and actual ceiling fixtures retained in the cutaway.
parent=anchor('Services_Lighting')
for x in [-3.65,3.65]:
 beam('Ventilation trunk',(x,3.35,-10),(x,3.35,6.7),.14,'Pressure liner')
 for z in [-8,-4,0,4]:
  box('Supply diffuser',x,3.1,z,.6,.16,.65,'Alloy')
  for k in range(4):box('Vent grille',x-.2+k*.13,3.0,z,.045,.02,.5,'Graphite',0)
for zone in layout['zones']:
 x,z=zone['x'],zone['z'];box('Ceiling light strip',x,3.8,z,2,.08,.12,'Warm light',.02)
# Convert all text, apply edge radii and join by zone/material to keep the draw budget bounded.
for o in list(asset.objects):
 if o.type=='FONT':
  bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.convert(target='MESH')
for o in list(asset.objects):
 if o.type=='MESH':
  bpy.context.view_layer.objects.active=o
  for q in list(o.modifiers):bpy.ops.object.modifier_apply(modifier=q.name)
for aroot in anchors.values():
 groups={}
 for o in list(asset.objects):
  if o.type=='MESH' and o.parent==aroot:groups.setdefault(o.data.materials[0].name,[]).append(o)
 for material,meshes in groups.items():
  bpy.ops.object.select_all(action='DESELECT')
  for o in meshes:o.select_set(True)
  bpy.context.view_layer.objects.active=meshes[0]
  if len(meshes)>1:bpy.ops.object.join()
  meshes[0].name=aroot.name+' | '+material
bpy.ops.object.select_all(action='DESELECT')
for o in asset.objects:o.select_set(True)
bpy.context.view_layer.objects.active=root
bpy.ops.export_scene.gltf(filepath=str(out/'Mars_Hab_Interior.glb'),export_format='GLB',use_selection=True,export_apply=True,export_extras=True)
# Cutaway studio: presentation camera and lights are excluded from the exported GLB.
preview=bpy.data.collections.new('PREVIEW ONLY');s.collection.children.link(preview)
def stage(o):
 for c in list(o.users_collection):c.objects.unlink(o)
 preview.objects.link(o);return o
for name in ['Roof','Shell_S','Shell_E']:
 for child in anchors[name].children_recursive:child.hide_render=True;child.hide_set(True)
bpy.ops.object.camera_add(location=(16,-22,43));cam=stage(bpy.context.object);cam.rotation_euler=(Vector((0,0,.2))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=32;s.camera=cam
s.world=bpy.data.worlds.new('Interior studio');s.world.use_nodes=True;s.world.node_tree.nodes['Background'].inputs[0].default_value=(.09,.14,.17,1);s.world.node_tree.nodes['Background'].inputs[1].default_value=.6
for pos,power,size in [((0,0,13),4200,18),((6,-12,9),1800,12),((-10,5,9),2200,10)]:
 bpy.ops.object.light_add(type='AREA',location=pos);o=stage(bpy.context.object);o.data.energy=power;o.data.shape='DISK';o.data.size=size;o.rotation_euler=(Vector((0,0,0))-o.location).to_track_quat('-Z','Y').to_euler()
s.render.engine='CYCLES';s.cycles.samples=24;s.cycles.use_denoising=True;s.render.resolution_x=1600;s.render.resolution_y=1400;s.render.resolution_percentage=100;s.view_settings.view_transform='AgX'
s['README']='Cutaway review: Roof, Shell_S and Shell_E hidden for render. All are included in GLB and can be restored for enclosed views. Export hierarchy groups are batched by material. Source navigation layout is shared/src/data/hab-layout.json.'
for area in bpy.context.screen.areas:
 if area.type=='VIEW_3D':area.spaces.active.region_3d.view_perspective='CAMERA';area.spaces.active.overlay.show_overlays=False
bpy.ops.wm.save_as_mainfile(filepath=str(out/'Mars_Hab_Interior.blend'),compress=True)
if a.render:s.render.filepath=str(out/'Mars_Hab_Interior_Preview.png');bpy.ops.render.render(write_still=True)
print('HAB_INTERIOR_DONE',flush=True)
