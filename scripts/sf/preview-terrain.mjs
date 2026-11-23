// Debug helper: writes terrain mask + height previews to the given folder
import { buildRasters, writeTerrainTextures } from './terrain.mjs'
import sharp from 'sharp'
const out = process.argv[2]
const r = await buildRasters()
await writeTerrainTextures(r, out + '/mask.png', out + '/height.png')
await sharp(out + '/mask.png').removeAlpha().toFile(out + '/mask_rgb.png')
console.log('ok')
