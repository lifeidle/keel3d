import bpy, sys
# usage: blender --background --python fbx2glb.py -- <input.fbx> <output.glb>
argv = sys.argv[sys.argv.index("--") + 1:]
src, dst = argv[0], argv[1]
bpy.ops.wm.read_factory_settings(use_empty=True)
if src.lower().endswith(".fbx"):
    bpy.ops.import_scene.fbx(filepath=src)
elif src.lower().endswith(".blend"):
    bpy.ops.wm.open_mainfile(filepath=src)
else:
    raise SystemExit("unsupported: " + src)
# web-friendly PBR: FBX imports often have legacy materials — force a clean
# Principled setup with an olive-drab base (models ship without textures)
for m in bpy.data.materials:
    m.blend_method = 'OPAQUE'  # FBX legacy alpha would export a MASK material with alpha 0 — invisible!
    if not m.use_nodes:
        m.use_nodes = True
    nt = m.node_tree
    bsdf = next((n for n in nt.nodes if n.type == "BSDF_PRINCIPLED"), None)
    if bsdf is None:
        bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
        out = next((n for n in nt.nodes if n.type == "OUTPUT_MATERIAL"), None)
        if out is None:
            out = nt.nodes.new("ShaderNodeOutputMaterial")
        for l in list(nt.links):
            if l.to_node == out:
                nt.links.remove(l)
        nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    bsdf.inputs["Base Color"].default_value = (0.30, 0.34, 0.24, 1.0)  # olive drab
    bsdf.inputs["Alpha"].default_value = 1.0
    bsdf.inputs["Metallic"].default_value = 0.0
    bsdf.inputs["Roughness"].default_value = 0.85


# glTF exporter only emits the ACTIVE action by default: push every action
# onto its own NLA track so all clips end up in the file
_arm = next((o for o in bpy.data.objects if o.type == "ARMATURE"), None)
if _arm is not None:
    if _arm.animation_data is None:
        _arm.animation_data_create()
    for _a in bpy.data.actions:
        _a.use_fake_user = True
        _tr = _arm.animation_data.nla_tracks.new()
        _tr.name = _a.name
        _tr.strips.new(_a.name, 0, _a)

# stats
meshes = [o for o in bpy.data.objects if o.type == "MESH"]
tris = sum(len(o.data.polygons) for o in meshes)
anims = list(bpy.data.actions)
bpy.ops.export_scene.gltf(filepath=dst, export_format="GLB", export_animations=True, export_animation_mode="ACTIONS")
print(f"CONVERTED: {len(meshes)} meshes, {tris} tris, {len(anims)} animations -> {dst}")
