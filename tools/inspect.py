import bpy, sys
argv = sys.argv[sys.argv.index("--") + 1:]
src = argv[0]
bpy.ops.wm.read_factory_settings(use_empty=True)
if src.lower().endswith(".fbx"):
    bpy.ops.import_scene.fbx(filepath=src)
elif src.lower().endswith(".blend"):
    bpy.ops.wm.open_mainfile(filepath=src)
import json
info = {"objects": [], "anims": [], "bbox": {}}
mins = [1e9]*3; maxs = [-1e9]*3
for o in bpy.data.objects:
    entry = {"name": o.name, "type": o.type, "parent": o.parent.name if o.parent else None,
             "loc": [round(v,3) for v in o.location], "scale": [round(v,3) for v in o.scale]}
    if o.type == "MESH":
        for corner in o.bound_box:
            w = o.matrix_world @ __import__("mathutils").Vector(corner)
            for i in range(3):
                mins[i] = min(mins[i], w[i]); maxs[i] = max(maxs[i], w[i])
    info["objects"].append(entry)
info["anims"] = [{"name": a.name, "frames": [a.frame_range[0], a.frame_range[1]]} for a in bpy.data.actions]
info["bbox"] = {"min": [round(v,2) for v in mins], "max": [round(v,2) for v in maxs], "size": [round(maxs[i]-mins[i],2) for i in range(3)]}
print("INSPECT " + json.dumps(info))
