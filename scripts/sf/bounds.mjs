// Debug helper: print the world-space bounds of a GLB
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { getBounds } from '@gltf-transform/core'
import draco3d from 'draco3dgltf'
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'draco3d.decoder': await draco3d.createDecoderModule() })
const doc = await io.read(process.argv[2])
for (const s of doc.getRoot().listScenes()) { const b = getBounds(s); console.log(b.min.map(v=>v.toFixed(2)), b.max.map(v=>v.toFixed(2))) }
