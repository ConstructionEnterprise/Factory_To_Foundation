"""
The one place that knows anything about Blender specifically. Converts
whatever .blend file it's pointed at to glTF, using settings verified
against two structurally different real files (see FF_Frontend_OS_Handoff
/ CLAUDE.md, Manufacturing upload-pipeline task): respects the file's own
authored hide_render/hide_viewport as-is (no per-file visibility fixups),
exports real custom properties as glTF extras, and preserves real
Collection hierarchy alongside real object parenting — whichever the file
actually uses.

Run headless:
  blender.exe --background <input.blend> --python convert_to_gltf.py -- <output.glb>

Prints one JSON report line between marker comments for the calling
server to parse — real generic counts only, no claim about what kind of
model this is.
"""
import bpy
import sys
import json

argv = sys.argv
args = argv[argv.index("--") + 1:]
out_path = args[0]

all_objects = list(bpy.data.objects)
total_object_count = len(all_objects)
hidden_render_count = sum(1 for o in all_objects if o.hide_render)
mesh_object_count = sum(1 for o in all_objects if o.type == "MESH")

# three.js's GLTFLoader sanitizes node names on load (spaces become
# underscores, for animation-target-path safety) — confirmed live, not
# assumed. That would silently corrupt "a node's label is its real name,
# whatever that name is" for any real name containing a space. This
# operates on a disposable temp copy of the upload (see server.mjs), so
# stamping every real object/collection's own real name into a reserved
# extras key costs nothing real and needs no revert — it's the one place
# in this pipeline allowed to touch data, purely to keep it intact
# through a lossy transport step, not to alter what's real.
for o in all_objects:
    o["__source_name"] = o.name
all_collections = list(bpy.data.collections) + [bpy.context.scene.collection]
for c in all_collections:
    c["__source_name"] = c.name

# export_hierarchy_full_collections doesn't exist on every real Blender
# build this pipeline runs against (confirmed absent on Ubuntu 24.04's
# apt-packaged Blender 4.0.2 via a live AWS deploy, present on the local
# dev machine's 5.1.2) - it's a newer glTF-exporter-addon feature, not a
# rename. Introspected at runtime (get_rna_type().properties) rather than
# assumed present, same standing discipline as everywhere else in this
# pipeline. Real, disclosed effect when absent: only Collection-organized
# source files (e.g. Modern Heritage) lose full nested-Collection grouping
# on export - object-parented files (e.g. Garden Lofts) are unaffected,
# since this flag never controlled their hierarchy in the first place.
export_kwargs = {
    "filepath": out_path,
    "export_format": "GLB",
    "use_renderable": True,
    "export_extras": True,
    "export_yup": True,
}
gltf_props = {p.identifier for p in bpy.ops.export_scene.gltf.get_rna_type().properties}
hierarchy_flag_supported = "export_hierarchy_full_collections" in gltf_props
if hierarchy_flag_supported:
    export_kwargs["export_hierarchy_full_collections"] = True

bpy.ops.export_scene.gltf(**export_kwargs)

report = {
    "totalObjectCount": total_object_count,
    "meshObjectCount": mesh_object_count,
    "hiddenRenderCount": hidden_render_count,
    "hierarchyFullCollectionsSupported": hierarchy_flag_supported,
}

print("===BLENDER_BRIDGE_REPORT_START===")
print(json.dumps(report))
print("===BLENDER_BRIDGE_REPORT_END===")
