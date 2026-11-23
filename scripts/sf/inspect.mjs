import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
const file = process.argv[2], depth = +(process.argv[3]||2)
const doc = await io.read(file)
const root = doc.getRoot()
console.log('materials:', root.listMaterials().map(m=>m.getName()).join(', '))
console.log('textures:', root.listTextures().map(t=>t.getName()+':'+t.getMimeType()).join(', '))
function walk(n, d){
  const t = n.getTranslation().map(v=>+v.toFixed(2)), s=n.getScale().map(v=>+v.toFixed(2))
  const m = n.getMesh()
  const extras = n.getExtras()
  console.log('  '.repeat(d)+n.getName(), JSON.stringify(t), JSON.stringify(s), m? `mesh(${m.listPrimitives().map(p=>p.getMaterial()?.getName()).join('/')})`:'', Object.keys(extras).length?JSON.stringify(extras):'')
  if(d<depth) for(const c of n.listChildren()) walk(c,d+1)
}
for(const s of root.listScenes()) for(const n of s.listChildren()) walk(n,0)
