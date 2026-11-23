// Debug helper: validate the road trimesh (NaN, degenerate triangles, index range)
import { NodeIO } from '@gltf-transform/core'
const doc = await new NodeIO().read('static/scenery/scenery.glb')
for (const node of doc.getRoot().listNodes()) {
  if (!/^trimesh/.test(node.getName())) continue
  const prim = node.getMesh().listPrimitives()[0]
  const pos = prim.getAttribute('POSITION').getArray(), idx = prim.getIndices().getArray()
  let nan = 0, degenerate = 0, outOfRange = 0
  for (const v of pos) if (!Number.isFinite(v)) nan++
  const n = pos.length / 3
  for (let i = 0; i < idx.length; i += 3) {
    const [a, b, c] = [idx[i], idx[i + 1], idx[i + 2]]
    if (a >= n || b >= n || c >= n) { outOfRange++; continue }
    const ax = pos[b*3]-pos[a*3], ay = pos[b*3+1]-pos[a*3+1], az = pos[b*3+2]-pos[a*3+2]
    const bx = pos[c*3]-pos[a*3], by = pos[c*3+1]-pos[a*3+1], bz = pos[c*3+2]-pos[a*3+2]
    const cx = ay*bz-az*by, cy = az*bx-ax*bz, cz = ax*by-ay*bx
    if (Math.hypot(cx, cy, cz) < 1e-6) degenerate++
  }
  console.log(node.getName(), 'verts', n, 'tris', idx.length / 3, 'idxType', idx.constructor.name, { nan, degenerate, outOfRange })
}
