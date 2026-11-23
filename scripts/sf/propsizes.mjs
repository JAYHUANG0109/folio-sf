// Debug helper: size and first-instance transform of each prop GLB
import { NodeIO, getBounds } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import draco3d from 'draco3dgltf'
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'draco3d.decoder': await draco3d.createDecoderModule() })
for (const f of process.argv.slice(2)) {
  const doc = await io.read(f)
  const kids = doc.getRoot().listScenes()[0].listChildren()
  const n = kids[0]; const b = getBounds(n)
  console.log(f.split('/').pop(), 'count', kids.length, 'first', n.getName(), 't', n.getTranslation().map(v=>v.toFixed(2)).join(','), 'size', b.max.map((v,i)=>(v-b.min[i]).toFixed(2)).join(','), 'minY', (b.min[1]-n.getTranslation()[1]).toFixed(2))
}
