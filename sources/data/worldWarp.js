/**
 * The map spread at runtime (see spread.js): design units -> world, with the anchors the build used.
 */
import data from './spreadAnchors.json'
import { makeWarp } from './spread.js'

export const warp = makeWarp(data.anchors, data.S, data.field)
export const MAP_SPREAD = data.S
/** design [x, z] -> world [x, z] */
export const spreadXZ = (x, z) => warp.forward(x, z)
/** design [x, z] of something that belongs to a site (its respawn, task spots...) -> world, moved exactly with the site */
export const siteXZ = (id, x, z) => { const s = warp.shiftOf(id); return s ? [ x + s[0], z + s[1] ] : warp.forward(x, z) }
