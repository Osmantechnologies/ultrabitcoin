# museworks — shrink Tripo HD character GLBs for the workshop floor (phone-first).
# Run:  "C:\Program Files\Blender Foundation\Blender 5.1\blender.exe" -b -P tools/optimize_muses.py [-- role ...]
#
# Same recipe as ai-society/tools/optimize_models.py: join every mesh (draw calls
# collapse to the material count), then WELD before each decimate round — Tripo
# HD meshes are thousands of disconnected shells and collapse-decimate floors at
# ~100k tris until they are stitched together.
import bpy, os, sys, glob

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(HERE, 'art-src')                    # <name>-hd.glb from Tripo
DEST = os.path.join(HERE, 'models')                    # <name>.glb

TARGET_TRIS = 9000    # a muse is the closest thing to the camera; silhouette matters
TEX_MAX = 1024


def clear():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete()
    for block in (bpy.data.meshes, bpy.data.materials, bpy.data.images):
        for b in list(block):
            try:
                block.remove(b)
            except Exception:
                pass


def process(path, role):
    clear()
    bpy.ops.import_scene.gltf(filepath=path)
    meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    if not meshes:
        print(f'  !! {role}: no meshes'); return None
    for o in meshes:
        o.data.calc_loop_triangles()
    tris_before = sum(len(o.data.loop_triangles) for o in meshes)
    draws_before = len(meshes)

    bpy.ops.object.select_all(action='DESELECT')
    for o in meshes:
        o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    if len(meshes) > 1:
        bpy.ops.object.join()
    obj = bpy.context.view_layer.objects.active

    for weld in (0.0008, 0.0025, 0.005, 0.009):
        obj.data.calc_loop_triangles()
        cur = len(obj.data.loop_triangles)
        if cur <= TARGET_TRIS * 1.15:
            break
        bpy.ops.object.mode_set(mode='EDIT')
        bpy.ops.mesh.select_all(action='SELECT')
        bpy.ops.mesh.remove_doubles(threshold=weld)
        bpy.ops.mesh.dissolve_degenerate()
        bpy.ops.object.mode_set(mode='OBJECT')
        obj.data.calc_loop_triangles()
        cur = len(obj.data.loop_triangles)
        if cur > TARGET_TRIS:
            m = obj.modifiers.new('dec', 'DECIMATE')
            m.decimate_type = 'COLLAPSE'
            m.ratio = max(0.02, TARGET_TRIS / cur)
            bpy.ops.object.modifier_apply(modifier=m.name)

    for img in bpy.data.images:
        if img.size[0] > TEX_MAX or img.size[1] > TEX_MAX:
            img.scale(min(img.size[0], TEX_MAX), min(img.size[1], TEX_MAX))

    # Normalise: feet on the floor, 1 unit tall, centred — so every role drops
    # into the scene at the same scale without per-model fudge.
    bpy.ops.object.origin_set(type='ORIGIN_GEOMETRY', center='BOUNDS')
    h = obj.dimensions.z or 1.0
    obj.scale = (1.0 / h,) * 3
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.location = (0, 0, obj.dimensions.z / 2)
    bpy.ops.object.transform_apply(location=True, rotation=False, scale=False)

    obj.data.calc_loop_triangles()
    tris_after = len(obj.data.loop_triangles)
    draws_after = max(1, len(obj.data.materials))
    dims = tuple(round(d, 2) for d in obj.dimensions)

    os.makedirs(DEST, exist_ok=True)
    out = os.path.join(DEST, f'{role}.glb')
    bpy.ops.export_scene.gltf(
        filepath=out, export_format='GLB', use_selection=False,
        export_materials='EXPORT', export_image_format='JPEG',
    )
    return dict(role=role, draws=(draws_before, draws_after), tris=(tris_before, tris_after),
                mb=(os.path.getsize(path) / 1e6, os.path.getsize(out) / 1e6), dims=dims)


ONLY = set(sys.argv[sys.argv.index('--') + 1:]) if '--' in sys.argv else None
rows = []
for path in sorted(glob.glob(os.path.join(SRC, '*-hd.glb'))):
    role = os.path.basename(path)[:-len('-hd.glb')]
    if ONLY and role not in ONLY:
        continue
    print(f'== {role}')
    r = process(path, role)
    if r:
        rows.append(r)

print('\n' + '=' * 78)
print(f'{"role":12} {"draws":>14} {"triangles":>22} {"MB":>16}   dims')
print('=' * 78)
for r in rows:
    print(f'{r["role"]:12} {r["draws"][0]:6} -> {r["draws"][1]:<4} '
          f'{r["tris"][0]:9,} -> {r["tris"][1]:<8,} '
          f'{r["mb"][0]:6.1f} -> {r["mb"][1]:<5.2f}   {r["dims"]}')
print('=' * 78)
