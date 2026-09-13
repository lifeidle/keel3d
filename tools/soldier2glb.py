import bpy, sys
# usage: blender --background --python soldier2glb.py -- <input.fbx> <output.glb>
# WWII infantry look (per reference: khaki uniform, big M1 helmet, web belt,
# ammo pouches, tall dark boots) — Quaternius Animated Men rig, CC0.
argv = sys.argv[sys.argv.index("--") + 1:]
src, dst = argv[0], argv[1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=src)

# ---------- military repaint: kill city-clothes textures, paint the uniform ----
def flat_material(name, col):
    """fresh opaque principled material, no textures"""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    m.blend_method = "OPAQUE"
    nt = m.node_tree
    bs = next((n for n in nt.nodes if n.type == "BSDF_PRINCIPLED"), None)
    bs.inputs["Base Color"].default_value = col
    bs.inputs["Alpha"].default_value = 1.0
    bs.inputs["Metallic"].default_value = 0.0
    bs.inputs["Roughness"].default_value = 0.85
    return m

MAT_SKIN = flat_material("uni_skin", (0.60, 0.47, 0.37, 1.0))
MAT_SHIRT = flat_material("uni_khaki", (0.43, 0.39, 0.28, 1.0))   # khaki field shirt
MAT_PANTS = flat_material("uni_pants", (0.35, 0.31, 0.22, 1.0))   # darker khaki
MAT_BOOTS = flat_material("uni_boots", (0.13, 0.11, 0.09, 1.0))   # dark brown
MAT_HAIR = flat_material("uni_hair", (0.16, 0.13, 0.10, 1.0))     # under helmet

for m in bpy.data.materials:
    name = (m.name or "").lower()
    if "skin" in name or "face" in name or "hand" in name or "ear" in name:
        new = MAT_SKIN
    elif "pant" in name or "trouser" in name or "leg" in name:
        new = MAT_PANTS
    elif "boot" in name or "shoe" in name or "sock" in name:
        new = MAT_BOOTS
    elif "hair" in name or "brow" in name or "beard" in name:
        new = MAT_HAIR
    elif "eye" in name:
        new = MAT_SKIN
    else:
        new = MAT_SHIRT  # shirt / tie / everything else -> one khaki uniform
    # rewire every material slot that uses this material to the flat repaint
    for o in bpy.data.objects:
        if o.type != "MESH":
            continue
        for i, slot in enumerate(o.material_slots):
            if slot.material == m:
                slot.material = new

# ---------- WWII gear welded to bones ----------
# NOTE on scale: the raw rig stands ~5.0 units tall (normalised to 1.7 m in
# engine => ~0.34 world/raw).  Gear sizes below are RAW units — a "0.4" dome
# radius reads as a real 27 cm helmet; the previous attempt used 0.06 (a 4 cm
# bead — invisible in game).
arm = bpy.data.objects["HumanArmature"]

def bone(name):
    return arm.data.bones.get(name) if name in arm.data.bones else None

def gear_mat(name, col):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bs = next((n for n in nt.nodes if n.type == "BSDF_PRINCIPLED"), None)
    bs.inputs["Base Color"].default_value = col
    bs.inputs["Metallic"].default_value = 0.0
    bs.inputs["Roughness"].default_value = 0.8
    return m

MAT_HELM = gear_mat("gear_helmet", (0.17, 0.18, 0.14, 1.0))       # dark olive steel
MAT_WEB = gear_mat("gear_web", (0.26, 0.22, 0.15, 1.0))           # webbing khaki-brown

def add_gear(obj_type, parent_bone, loc, scale, label, mat):
    if obj_type == "sphere":
        bpy.ops.mesh.primitive_uv_sphere_add(radius=1, location=(0, 0, 0), segments=16, ring_count=10)
    else:
        bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0))
    o = bpy.context.active_object
    o.name = label
    o.scale = scale
    o.location = loc
    o.parent = arm
    o.parent_type = "BONE"
    o.parent_bone = parent_bone
    o.data.materials.append(mat)
    return o

hb = bone("Head")
print("BONE Head length:", hb.length if hb else None)
if hb is not None:
    # M1 steel helmet: big dome swallowing the skull + flared rim
    dome = add_gear("sphere", "Head", (0, hb.length * 0.12, 0),
                    (0.40, 0.40, 0.34), "Helmet", MAT_HELM)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.45, depth=0.06, location=(0, 0, 0), vertices=16)
    rim = bpy.context.active_object
    rim.name = "HelmetRim"
    rim.scale = (1.0, 1.0, 1.0)
    rim.location = (0, hb.length * 0.04, 0)
    rim.parent = arm
    rim.parent_type = "BONE"
    rim.parent_bone = "Head"
    rim.data.materials.append(MAT_HELM)

tb = bone("Torso")
print("BONE Torso length:", tb.length if tb else None)
if tb is not None:
    # web belt around the waist + two ammo pouches at the front
    add_gear("cube", "Torso", (0, -tb.length * 0.30, 0),
             (1.00, 0.07, 0.36), "Belt", MAT_WEB)
    add_gear("cube", "Torso", (0.15, -tb.length * 0.30, 0.26),
             (0.17, 0.22, 0.10), "PouchL", MAT_WEB)
    add_gear("cube", "Torso", (-0.15, -tb.length * 0.30, 0.26),
             (0.17, 0.22, 0.10), "PouchR", MAT_WEB)

# tall dark boots on both feet
for fb, side in (("Foot.L", "L"), ("Foot.R", "R")):
    if bone(fb) is not None:
        add_gear("cube", fb, (0, 0.02, 0), (0.34, 0.42, 0.20), "Boot" + side, MAT_BOOTS)

# ---------- NLA tracks so the glTF exporter emits every action ----------
if arm.animation_data is None:
    arm.animation_data_create()
for _a in bpy.data.actions:
    _a.use_fake_user = True
    _tr = arm.animation_data.nla_tracks.new()
    _tr.name = _a.name
    _tr.strips.new(_a.name, 0, _a)

meshes = [o for o in bpy.data.objects if o.type == "MESH"]
tris = sum(len(o.data.polygons) for o in meshes)
bpy.ops.export_scene.gltf(filepath=dst, export_format="GLB", export_animations=True,
                          export_animation_mode="ACTIONS")
print(f"SOLDIER OK: {len(meshes)}m {tris}t {len(bpy.data.actions)} anims -> {dst}")
