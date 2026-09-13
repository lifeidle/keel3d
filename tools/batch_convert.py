import bpy, sys, os, glob, json

argv = sys.argv[sys.argv.index("--") + 1:]
src_root, dst_root = argv[0], argv[1]

fbx_files = glob.glob(os.path.join(src_root, "**", "*.fbx"), recursive=True)
results = []
for src in fbx_files:
    rel = os.path.relpath(src, src_root)
    dst = os.path.join(dst_root, os.path.splitext(rel)[0] + ".glb")
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    try:
        bpy.ops.wm.read_factory_settings(use_empty=True)
        bpy.ops.import_scene.fbx(filepath=src)
        meshes = [o for o in bpy.data.objects if o.type == "MESH"]
        tris = sum(len(o.data.polygons) for o in meshes)
        anims = [a.name for a in bpy.data.actions]
        # node tree (top 2 levels)
        tree = []
        for o in bpy.data.objects:
            if o.parent is None:
                kids = [c.name for c in o.children]
                tree.append({"obj": o.name, "type": o.type, "kids": kids})
        bpy.ops.export_scene.gltf(filepath=dst, export_format="GLB", export_animations=True)
        results.append({"src": rel, "dst": os.path.relpath(dst, dst_root), "meshes": len(meshes), "tris": tris, "anims": anims, "tree": tree})
        print(f"OK {rel}: {len(meshes)}m {tris}t anims={anims}", flush=True)
    except Exception as e:
        results.append({"src": rel, "error": str(e)[:120]})
        print(f"FAIL {rel}: {e}", flush=True)

with open(os.path.join(dst_root, "_conversion_report.json"), "w", encoding="utf-8") as f:
    json.dump(results, f, ensure_ascii=False, indent=1)
print(f"=== BATCH DONE: {len(fbx_files)} files ===", flush=True)
