/**
 * Builds the San Francisco world.
 * Usage: npm run sf:build
 *
 * Writes:
 *  static/terrain/terrain.png, terrainHeight.png, terrain.glb
 *  static/areas/areas.glb               (13 stops)
 *  static/scenery/scenery.glb           (streets, city blocks, skyline)
 *  static/respawns/respawnsReferences.glb
 *  sources/data/placements.json         (trees, bushes, flowers, props)
 *  static/ui/map/map-day.(png|webp), map-night.(png|webp)
 */
import fs from 'node:fs'
import path from 'node:path'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import sharp from 'sharp'
import * as Layout from './layout.mjs'
import { buildRasters, quantize, writeTerrainTextures, groundY, sample, RES, lombardPoints } from './terrain.mjs'
import { writeGlb } from './gltf.mjs'
import { Model, C, meshNode, fixedNode, dynamicNode, refNode, rng } from './kit.mjs'
import { dogs as dogsData, turkey as turkeyData } from '../../sources/data/dogs.js'
import { builders, nameBlocks, christmasTree, christmasStar } from './landmarks.mjs'
import { bulb, lightString, litPine, candyCane, gifts, snowman, pumpkin, harvest, wreath } from './holiday.mjs'
import { dogNodes } from './dogs.mjs'
import { secrets } from '../../sources/data/secrets.js'
import { scaleOf } from '../../sources/data/sites.js'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..')
const out = (p) => path.join(ROOT, p)

const rastersRaw = await buildRasters()
const R = quantize(rastersRaw)
const W = Layout.W
// ground() is in design units (world / W) so models placed in design units land on the terrain after scaling
const groundWorld = (x, z) => groundY(R, x, z)
const ground = (x, z) => groundWorld(x, z) / W
const round = (v) => Math.round(v * 1000) / 1000

/** Road surface height: conservative max of the ground around a point so the ribbon never sinks into the floor mesh */
const roadY = (x, z, tx = 0, tz = 1) =>
{
    let y = - Infinity
    for(const [ ox, oz ] of [ [ 0, 0 ], [ tx * 0.8, tz * 0.8 ], [ - tx * 0.8, - tz * 0.8 ], [ 0.75, 0 ], [ - 0.75, 0 ], [ 0, 0.75 ], [ 0, - 0.75 ] ])
        y = Math.max(y, ground(x + ox, z + oz))
    return Math.max(y, - 0.2) + 0.05
}

/** Distance from a point to the nearest street edge (negative inside the street) */
const streetSegments = []
for(const street of Layout.streets)
{
    const curve = new THREE.CatmullRomCurve3(street.points.map(([ x, z ]) => new THREE.Vector3(x, 0, z)), false, 'centripetal')
    const pts = curve.getSpacedPoints(Math.ceil(curve.getLength() / 2))
    for(let i = 1; i < pts.length; i++)
        streetSegments.push([ pts[i - 1].x, pts[i - 1].z, pts[i].x, pts[i].z, street.width / 2 ])
}
/** Junction fillets: wherever a street ends on (or at) another one, round the corners with a quadratic curve */
const streetFillets = []
{
    const sampled = Layout.streets.filter(st => st.asphalt).map((street) =>
    {
        const curve = new THREE.CatmullRomCurve3(street.points.map(([ x, z ]) => new THREE.Vector3(x, 0, z)), false, 'centripetal')
        return { street, pts: curve.getSpacedPoints(Math.max(2, Math.ceil(curve.getLength() / 0.5))) }
    })
    const step = (pts) => pts[0].distanceTo(pts[1])
    for(const A of sampled)
    {
        for(const end of [ 0, A.pts.length - 1 ])
        {
            const E = A.pts[end]
            const inward = end === 0 ? 1 : - 1
            for(const B of sampled)
            {
                if(B === A)
                    continue
                let best = - 1, bestDistance = Infinity
                B.pts.forEach((p, j) => { const d = Math.hypot(p.x - E.x, p.z - E.z); if(d < bestDistance) { bestDistance = d; best = j } })
                if(bestDistance > B.street.width / 2 + 0.6)
                    continue
                const reach = Math.max(A.street.width, B.street.width) * 1.1
                const ia = end + inward * Math.round(reach / step(A.pts))
                if(ia < 0 || ia >= A.pts.length)
                    continue
                const P0 = A.pts[ia], C = B.pts[best]
                const dirA = new THREE.Vector3(P0.x - C.x, 0, P0.z - C.z).normalize()
                for(const dir of [ - 1, 1 ])
                {
                    const ib = best + dir * Math.round(reach / step(B.pts))
                    if(ib < 0 || ib >= B.pts.length)
                        continue
                    const P2 = B.pts[ib]
                    const dirB = new THREE.Vector3(P2.x - C.x, 0, P2.z - C.z).normalize()
                    // the two arms must open up (not fold back onto each other)
                    if(dirA.dot(dirB) > 0.5)
                        continue
                    const points = []
                    for(let k = 0; k <= 14; k++)
                    {
                        const t = k / 14
                        points.push(new THREE.Vector3(
                            (1 - t) * (1 - t) * P0.x + 2 * (1 - t) * t * C.x + t * t * P2.x, 0,
                            (1 - t) * (1 - t) * P0.z + 2 * (1 - t) * t * C.z + t * t * P2.z
                        ))
                    }
                    const width = Math.min(A.street.width, B.street.width)
                    streetFillets.push({ points, half: width * 0.42, width })
                }
            }
        }
    }
}
console.log('street fillets', streetFillets.length)
// the Alcatraz boardwalk counts as a street (keeps houses, trees and props off it)
{
    const pts = Layout.boardwalk.points
    for(let i = 1; i < pts.length; i++)
        streetSegments.push([ pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], Layout.boardwalk.width / 2 + 0.6 ])
}
// keep props and houses off the rounded corners too
for(const fillet of streetFillets)
    for(let i = 1; i < fillet.points.length; i++)
        streetSegments.push([ fillet.points[i - 1].x, fillet.points[i - 1].z, fillet.points[i].x, fillet.points[i].z, fillet.width / 2 ])

const nearRoad = (x, z, margin = 0) => streetSegments.some(([ ax, az, bx, bz, half ]) =>
{
    const dx = bx - ax, dz = bz - az
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)))
    return Math.hypot(x - (ax + dx * t), z - (az + dz * t)) < half + margin
})

/* ---------------- Terrain ---------------- */
await writeTerrainTextures(rastersRaw, out('static/terrain/terrain.png'), out('static/terrain/terrainHeight.png'))
{
    const rows = 193 // 1.5 world units between samples
    const positions = new Float32Array(rows * rows * 3)
    const indices = []
    for(let ix = 0; ix < rows; ix++)
    {
        for(let iz = 0; iz < rows; iz++)
        {
            const x = - Layout.HALF + ix * Layout.SIZE / (rows - 1)
            const z = - Layout.HALF + iz * Layout.SIZE / (rows - 1)
            const i = ix * rows + iz
            positions[i * 3 + 0] = x * W
            positions[i * 3 + 1] = groundWorld(x, z)
            positions[i * 3 + 2] = z * W
        }
    }
    for(let ix = 0; ix < rows - 1; ix++)
        for(let iz = 0; iz < rows - 1; iz++)
        {
            const a = ix * rows + iz, b = (ix + 1) * rows + iz, c = ix * rows + iz + 1, d = (ix + 1) * rows + iz + 1
            indices.push(a, c, b, b, c, d)
        }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setIndex(indices)
    await writeGlb(out('static/terrain/terrain.glb'), [ { name: 'terrain', mesh: { geometry, material: 'terrain' } } ])
}
console.log('terrain ok')

/* ---------------- Areas (stops) ---------------- */
const frustumOverrides = {
    goldenGate: { x: - 62, z: - 63, radius: 30 },
    ferryBuilding: { x: 66, z: - 14, radius: 26 },
    lombard: { x: 6, z: - 36, radius: 28 },
    napa: { x: - 79, z: - 84, radius: 14 },
    pier39: { x: 32, z: - 60, radius: 16 },
    levis: { x: 12, z: 79, radius: 24 },
}
const areaNodes = []
const SITE_LIGHTS_SKIP = new Set([])
const siteFootprints = [] // [cx, cz, halfX, halfZ, angle] in design units, from the fixed colliders of every site

/** Scale a landmark node around its own position (the position itself was already moved by ctx.at) */
const scaleNode = (node, k) =>
{
    if(k === 1 || node.noScale)
        return node
    const out = { ...node }
    if(node.mesh)
    {
        const g = node.mesh.geometry.clone()
        g.scale(k, k, k)
        out.mesh = { ...node.mesh, geometry: g }
    }
    else if(node.scale !== undefined)
    {
        out.scale = typeof node.scale === 'number' ? node.scale * k : node.scale.map(v => v * k)
    }
    if(node.children)
        out.children = node.children.map(child => ({
            ...child,
            position: child.position ? child.position.map(v => v * k) : child.position,
            scale: child.scale !== undefined ? (typeof child.scale === 'number' ? child.scale * k : child.scale.map(v => v * k)) : undefined,
        }))
    return out
}

for(const stop of [ ...Layout.stops, ...secrets ])
{
    const cx = stop.position.x, cz = stop.position.z
    const y = ground(cx, cz)
    const k = scaleOf(stop.id)
    const sx = (x) => cx + (x - cx) * k
    const sz = (z) => cz + (z - cz) * k
    const ctx = {
        cx, cz, y, ground, S: k,
        // world x/z of the unscaled design -> spread out by the site scale, resting on the ground
        at: (x, z, dy = 0) => [ round(sx(x) - cx), round(ground(sx(x), sz(z)) + dy * k - y), round(sz(z) - cz) ],
        atWorld: ([ x, wy, z ]) => [ round(x - cx), round(wy - y), round(z - cz) ],
        // street surface along a north-south street of the given width (Hyde St for the cable car)
        road: (x, z, width = 4.5) => Math.max(roadY(x, z), roadY(x - width * 0.4, z), roadY(x + width * 0.4, z)),
    }
    const children = builders[stop.id](ctx).map(node => scaleNode(node, k))
    // Holiday lights on the site's buildings: every solid block gets its roofline outlined in fairy lights and
    // strands down its corners (the colliders trace the building shapes, so the lights follow the silhouettes)
    if(!SITE_LIGHTS_SKIP.has(stop.id))
    {
        const deco = new Model()
        let bulbs = 0
        const boxes = [], tubes = []
        for(const node of children)
        {
            if(!/PhysicalFixed$/.test(node.name || '') || !node.children || !node.mesh || /^evaPlane/.test(node.name))
                continue
            const angle = node.rotation ? node.rotation[1] : 0
            for(const c of node.children)
            {
                if(/^tube/.test(c.name) && c.scale && c.scale[1] >= 1.6 * k && c.scale[0] >= 0.5 && c.scale[0] < 30)
                {
                    tubes.push({ node, angle, c })
                    continue
                }
                if(!/^cuboid/.test(c.name) || !c.scale || (c.rotation && (Math.abs(c.rotation[0] || 0) > 0.05 || Math.abs(c.rotation[2] || 0) > 0.05)))
                    continue
                const [ w, h, d ] = c.scale
                if(h < 1.6 * k || w < 1.2 || d < 1.2 || w > 40 || d > 40)
                    continue
                boxes.push({ node, angle, c, w, h, d, v: w * h * d })
            }
        }
        boxes.sort((a, b) => b.v - a.v)
        for(const { node, angle, c, w, h, d } of boxes.slice(0, 14))
        {
            const ry = c.rotation ? c.rotation[1] || 0 : 0
            const [ px, py, pz ] = c.position
            const top = py + h / 2 + 0.06
            const toSite = ([ lx, ly, lz ]) =>
            {
                // collider local -> node local -> site local (three.js Y rotation)
                const x1 = px + lx * Math.cos(ry) + lz * Math.sin(ry), z1 = pz - lx * Math.sin(ry) + lz * Math.cos(ry)
                const x2 = x1 * Math.cos(angle) + z1 * Math.sin(angle), z2 = - x1 * Math.sin(angle) + z1 * Math.cos(angle)
                return [ node.position[0] + x2, node.position[1] + ly, node.position[2] + z2 ]
            }
            const hw = w / 2 + 0.07, hd = d / 2 + 0.07
            const corners = [ [ - hw, - hd ], [ hw, - hd ], [ hw, hd ], [ - hw, hd ] ]
            for(let i = 0; i < 4; i++)
            {
                const [ ax, az ] = corners[i], [ bx, bz ] = corners[(i + 1) % 4]
                const len = Math.hypot(bx - ax, bz - az), n = Math.max(2, Math.round(len / 0.5))
                for(let j = 0; j < n; j++)
                {
                    const t = j / n
                    bulb(deco, toSite([ ax + (bx - ax) * t, top - Math.sin(t * Math.PI) * Math.min(0.25, len * 0.03), az + (bz - az) * t ]), 0.12)
                    bulbs++
                }
                for(let ly = py - h / 2 + 0.5; ly < top - 0.2; ly += 0.7)                      // a strand down each corner
                {
                    bulb(deco, toSite([ ax, ly, az ]), 0.1)
                    bulbs++
                }
            }
            if(bulbs > 1400)
                break
        }
        // round parts (columns, towers): a ring of lights round the top and a spiral down
        for(const { node, angle, c } of tubes.slice(0, 24))
        {
            const [ px, py, pz ] = c.position, [ d, h ] = c.scale
            const rr = d / 2 + 0.08, top = py + h / 2
            const cxw = px * Math.cos(angle) + pz * Math.sin(angle), czw = - px * Math.sin(angle) + pz * Math.cos(angle)
            const at = (lx, ly, lz) => [ node.position[0] + cxw + lx, node.position[1] + ly, node.position[2] + czw + lz ]
            const ring = Math.max(8, Math.round(rr * Math.PI * 2 / 0.45))
            for(let i = 0; i < ring; i++)
            {
                const a = i / ring * Math.PI * 2
                bulb(deco, at(Math.cos(a) * rr, top - 0.1, Math.sin(a) * rr), 0.11)
            }
            const turns = Math.max(1.5, h / 3), n = Math.round(turns * ring * 0.6)
            for(let i = 0; i < n; i++)
            {
                const t = i / n, a = t * turns * Math.PI * 2
                bulb(deco, at(Math.cos(a) * rr, py - h / 2 + 0.4 + t * (h - 0.6), Math.sin(a) * rr), 0.1)
            }
            bulbs += ring + n
        }
        if(!deco.empty)
            children.push(meshNode('siteLights', deco, [ 0, 0, 0 ]))
        console.log('site lights', stop.id, boxes.length, 'blocks,', tubes.length, 'round,', bulbs, 'bulbs')
    }
    const frustum = frustumOverrides[stop.id] || { x: cx, z: cz, radius: stop.radius + 14 }
    const radius = stop.radius * k
    children.push(refNode('ZoneBounding', [ 0, 0, 0 ], undefined, radius))
    children.push(refNode('ZoneFrustum', [ sx(frustum.x) - cx, 0, sz(frustum.z) - cz ], undefined, frustum.radius * k))
    areaNodes.push({ name: stop.id, position: [ cx, y, cz ], children })

    // footprints of everything solid at this site (to keep roads and houses out)
    for(const node of children)
    {
        if(!/PhysicalFixed$/.test(node.name || '') || !node.children)
            continue
        const angle = node.rotation ? node.rotation[1] : 0
        const [ nx, , nz ] = node.position
        for(const c of node.children)
        {
            if(!c.scale || !c.position)
                continue
            const [ px, , pz ] = c.position
            const rx = px * Math.cos(angle) + pz * Math.sin(angle)
            const rz = - px * Math.sin(angle) + pz * Math.cos(angle)
            const [ w, , d ] = Array.isArray(c.scale) ? c.scale : [ c.scale, c.scale, c.scale ]
            if(w < 0.5 && d < 0.5)
                continue
            siteFootprints.push([ cx + nx + rx, cz + nz + rz, w / 2, d / 2, angle, stop.id ])
        }
    }
}
console.log('site footprints', siteFootprints.length)
// no two sites may touch: report every overlap between parts of different stops (with a 1.5 unit gap)
{
    const box = ([ x, z, hx, hz, a ]) => { const c = Math.abs(Math.cos(a)), s = Math.abs(Math.sin(a)); return [ x - (hx * c + hz * s), z - (hx * s + hz * c), x + (hx * c + hz * s), z + (hx * s + hz * c) ] }
    const clashes = new Map()
    for(let i = 0; i < siteFootprints.length; i++)
        for(let j = i + 1; j < siteFootprints.length; j++)
        {
            const A = siteFootprints[i], B = siteFootprints[j]
            if(A[5] === B[5]) continue
            const a = box(A), b = box(B), g = 1.5
            if(a[0] < b[2] + g && b[0] < a[2] + g && a[1] < b[3] + g && b[1] < a[3] + g)
            {
                const key = [ A[5], B[5] ].sort().join(' <-> ')
                clashes.set(key, (clashes.get(key) || 0) + 1)
            }
        }
    for(const [ k, n ] of clashes) console.log('SITE CLASH:', k, n)
}
// knockable trees and lamps inside the sites must not stand on a street either
for(const area of areaNodes)
    for(const node of area.children)
        if(/^(palm|lombardLamp)/.test(node.name || '') && node.position)
        {
            const x = area.position[0] + node.position[0], z = area.position[2] + node.position[2]
            if(streetSegments.some(([ ax, az, bx, bz, half ]) => { const dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1))); return Math.hypot(x - (ax + dx * t), z - (az + dz * t)) < half + 0.5 }))
                console.log('ON A ROAD:', area.name, node.name, x.toFixed(1), z.toFixed(1))
        }

/** Is a design point inside (or within margin of) a site's solid parts? */
const inSite = (x, z, margin = 0) => siteFootprints.some(([ fx, fz, hx, hz, angle ]) =>
{
    const dx = x - fx, dz = z - fz
    const lx = dx * Math.cos(angle) - dz * Math.sin(angle)
    const lz = dx * Math.sin(angle) + dz * Math.cos(angle)
    return Math.abs(lx) < hx + margin && Math.abs(lz) < hz + margin
})
await writeGlb(out('static/areas/areas.glb'), areaNodes, { worldScale: W })
console.log('areas ok')

const TREE_SPOT = [ 2, 20 ] // the Christmas tree's lawn
const SUTRO_SPOT = [ - 31, 38 ] // Sutro Tower on Mount Sutro (clear of Dookie's front door)
/* ---------------- Exclusion zones (no buildings / trees) ---------------- */
const exclusions = [
    ...Layout.stops.map(s => ({ x: s.position.x, z: s.position.z, r: s.radius * scaleOf(s.id) + 4 })),
    { x: - 62, z: - 66, r: 0, rect: [ - 70, - 92, - 54, - 40 ] }, // bridge corridor
    { rect: [ - 20, - 56, - 14, - 10 ] },                           // cable car line (Hyde St)
    { rect: [ - 15, - 48, 29, - 24 ] },                             // Lombard crooked block
    { rect: [ - 8, 66, 34, 92 ] },                                  // stadium
    { rect: [ 42, 48, 90, 92 ] },                                   // SFO
    { rect: [ - 60, - 48, - 20, - 14 ] },                           // Palace
    { rect: [ - 80, 38, - 25, 80 ] },                               // turkey + dog houses
    { rect: [ - 73, - 8, - 43, 33 ] },                               // tennis (1.85x)
    { x: - 31.5, z: 10, r: 9 },                                     // Alamo Square park
    { rect: [ - 97, - 100, - 63, - 68 ] },                          // Napa vineyards
    { rect: [ 52, - 34, 70, - 2 ] },                                // Ferry Building
    ...secrets.map(s => ({ x: s.position.x, z: s.position.z, r: s.radius + 4 })),
    { x: 46, z: - 24, r: 5 }, { x: 41, z: - 15, r: 5 }, { x: TREE_SPOT[0], z: TREE_SPOT[1], r: 9 }, { x: 46, z: - 35, r: 5 }, { x: SUTRO_SPOT[0], z: SUTRO_SPOT[1], r: 4 },
]
const excluded = (x, z, margin = 0) => exclusions.some(e => e.rect
    ? x > e.rect[0] - margin && x < e.rect[2] + margin && z > e.rect[1] - margin && z < e.rect[3] + margin
    : Math.hypot(x - e.x, z - e.z) < e.r + margin)
const onLand = (x, z) => sample(R.depth, x, z) < 0.04
const paved = (x, z) => sample(R.paving, x, z)
const grassy = (x, z) => sample(R.parks, x, z) // parks (grass now covers all land)

/* ---------------- Scenery ---------------- */
const sceneryNodes = []
const footprints = [] // [x, z, w, d, isDowntown] for the map

// Asphalt roads: one merged ribbon mesh draped on the ground (Bruno's glittery road material),
// plus lane markings painted with the palette
{
    const positions = [], uvs = [], indices = []
    const marks = { positions: [], uvs: [] }
    const quad = (cx, cy, cz, tx, tz, length, width, colorIndex) =>
    {
        const nx = - tz, nz = tx
        const [ u, v ] = [ (colorIndex * 4 + 2) / 128, 0.5 ]
        const p = (a, b) => [ cx + tx * a + nx * b, cy, cz + tz * a + nz * b ]
        const c0 = p(- length / 2, - width / 2), c1 = p(- length / 2, width / 2), c2 = p(length / 2, - width / 2), c3 = p(length / 2, width / 2)
        for(const v3 of [ c0, c1, c2, c1, c3, c2 ])
        {
            marks.positions.push(...v3)
            marks.uvs.push(u, v)
        }
    }

    // Every cross section is 4 vertices: outer shoulder, edge, edge, outer shoulder.
    // The shoulders slope down into the ground, and each run of road starts/ends with a ramp,
    // so the car can always climb onto the asphalt (no ledge at road ends or edges)
    const SHOULDER = 0.9
    const groundAt = (x, z) => Math.max(ground(x, z), - 0.2) - 0.03
    const pushSection = (px, pz, nx, nz, cy, half, u, flat = false) =>
    {
        const first = positions.length / 3
        for(const [ side, outer ] of [ [ - 1, true ], [ - 1, false ], [ 1, false ], [ 1, true ] ])
        {
            const w = half + (outer ? SHOULDER : 0)
            const x = px + nx * w * side, z = pz + nz * w * side
            const y = flat ? groundAt(x, z) : outer ? Math.min(cy, groundAt(x, z)) : cy
            positions.push(x, y, z)
            uvs.push(u, side < 0 ? 0 : 1)
        }
        return first
    }
    const connectSections = (a, b) =>
    {
        for(let k = 0; k < 3; k++)
            indices.push(a + k, a + k + 1, b + k, a + k + 1, b + k + 1, b + k)
    }
    // ramp section just beyond the end of a run (dir = -1 before the start, 1 after the end)
    const pushRamp = (p, t, n, half, u, dir) => pushSection(p.x + t.x * dir * 1.2, p.z + t.z * dir * 1.2, n.x, n.z, 0, half, u, true)

    for(const street of Layout.streets.filter(s => s.asphalt))
    {
        const curve = new THREE.CatmullRomCurve3(street.points.map(([ x, z ]) => new THREE.Vector3(x, 0, z)), false, 'centripetal')
        const length = curve.getLength()
        const count = Math.ceil(length / 0.8)
        const pts = curve.getSpacedPoints(count)
        const half = street.width * (street.highway ? 0.45 : 0.4)
        const centerYs = []
        const blocked = pts.map(p => inSite(p.x, p.z, half * 0.6))
        let previous = - 1
        pts.forEach((p, i) =>
        {
            // the road stops where a (bigger) site stands
            if(blocked[i])
            {
                previous = - 1
                centerYs.push(null)
                return
            }
            const t = curve.getTangentAt(i / count)
            const n = new THREE.Vector3(- t.z, 0, t.x).normalize()
            const cy = Math.max(roadY(p.x, p.z, t.x, t.z), roadY(p.x + n.x * half, p.z + n.z * half, t.x, t.z), roadY(p.x - n.x * half, p.z - n.z * half, t.x, t.z))
            centerYs.push(cy)
            if(previous < 0)
                previous = pushRamp(p, t, n, half, i / count, - 1)
            const current = pushSection(p.x, p.z, n.x, n.z, cy, half, i / count)
            connectSections(previous, current) // counter clockwise seen from above
            previous = current
            // end of this run: ramp down
            if(i === pts.length - 1 || blocked[i + 1])
                connectSections(current, pushRamp(p, t, n, half, i / count, 1))
        })

        // markings
        const spacing = 0.8
        pts.forEach((p, i) =>
        {
            if(i === 0 || i === pts.length - 1 || centerYs[i] === null)
                return
            const t = curve.getTangentAt(i / count)
            const n = { x: - t.z, z: t.x }
            const y = centerYs[i] + 0.015
            if(street.highway)
            {
                // double yellow center line, white dashed lanes
                for(const o of [ - 0.16, 0.16 ])
                    quad(p.x + n.x * o, y, p.z + n.z * o, t.x, t.z, spacing + 0.05, 0.12, C.gold)
                if(i % 3 === 0)
                    for(const o of [ - half * 0.5, half * 0.5 ])
                        quad(p.x + n.x * o, y, p.z + n.z * o, t.x, t.z, 1.2, 0.14, C.snow)
            }
            else if(i % 3 === 0)
            {
                quad(p.x, y, p.z, t.x, t.z, 1.1, 0.14, C.snow)
            }
        })
    }
    // Rounded corners where streets meet: a curved strip from one street into the other (both sides of a T)
    for(const fillet of streetFillets)
    {
        const half = fillet.half
        let previous = - 1
        fillet.points.forEach((p, i) =>
        {
            const a = fillet.points[Math.max(0, i - 1)], b = fillet.points[Math.min(fillet.points.length - 1, i + 1)]
            const t = new THREE.Vector3(b.x - a.x, 0, b.z - a.z).normalize()
            const n = new THREE.Vector3(- t.z, 0, t.x)
            if(inSite(p.x, p.z, half * 0.6))
            {
                previous = - 1
                return
            }
            // a hair under the streets so the overlap never flickers
            const cy = Math.max(roadY(p.x, p.z, t.x, t.z), roadY(p.x + n.x * half, p.z + n.z * half, t.x, t.z), roadY(p.x - n.x * half, p.z - n.z * half, t.x, t.z)) - 0.008
            const current = pushSection(p.x, p.z, n.x, n.z, cy, half, i / fillet.points.length)
            if(previous >= 0)
                connectSections(previous, current)
            previous = current
        })
    }

    // Lombard crooked block: one brick lane, solid like the streets (asphalt underneath for the physics, bricks painted on top)
    {
        const pts = lombardPoints(0.3).map(([ x, z ]) => new THREE.Vector3(x, 0, z))
        const half = Layout.lombard.lane / 2
        let previous = - 1
        const sections = []
        pts.forEach((p, i) =>
        {
            const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)]
            const t = new THREE.Vector3(b.x - a.x, 0, b.z - a.z).normalize()
            const n = new THREE.Vector3(- t.z, 0, t.x)
            const cy = Math.max(roadY(p.x, p.z, t.x, t.z), roadY(p.x + n.x * half, p.z + n.z * half, t.x, t.z), roadY(p.x - n.x * half, p.z - n.z * half, t.x, t.z))
            const current = positions.length / 3
            for(const side of [ - 1, 1 ])
            {
                positions.push(p.x + n.x * half * side, cy, p.z + n.z * half * side)
                uvs.push(i / pts.length, side < 0 ? 0 : 1)
            }
            if(previous >= 0)
                indices.push(previous, previous + 1, current, previous + 1, current + 1, current)
            previous = current
            sections.push({ p, n, cy })
        })
        // painted on top as continuous strips (no gaps on the curves): red brick rows of two tones, light curbs
        const strip = (o0, o1, lift, colorOf) =>
        {
            for(let i = 1; i < sections.length; i++)
            {
                const A = sections[i - 1], B = sections[i]
                const [ u, v ] = [ (colorOf(i) * 4 + 2) / 128, 0.5 ]
                const at = (S, o) => [ S.p.x + S.n.x * o, S.cy + lift, S.p.z + S.n.z * o ]
                const a0 = at(A, o0), a1 = at(A, o1), b0 = at(B, o0), b1 = at(B, o1)
                for(const v3 of [ a0, a1, b0, a1, b1, b0 ])
                {
                    marks.positions.push(...v3)
                    marks.uvs.push(u, v)
                }
            }
        }
        strip(- half - 0.02, half + 0.02, 0.012, () => C.brick)
        strip(- half - 0.02, - half + 0.12, 0.02, () => C.stone)
        strip(half - 0.12, half + 0.02, 0.02, () => C.stone)
    }

    // compact: drop vertices no triangle uses (Rapier's trimesh builder panics on them)
    const remap = new Map()
    const cPositions = [], cUvs = [], cIndices = []
    for(const index of indices)
    {
        if(!remap.has(index))
        {
            remap.set(index, cPositions.length / 3)
            cPositions.push(positions[index * 3], positions[index * 3 + 1], positions[index * 3 + 2])
            cUvs.push(uvs[index * 2], uvs[index * 2 + 1])
        }
        cIndices.push(remap.get(index))
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(cPositions, 3))
    g.setAttribute('uv', new THREE.Float32BufferAttribute(cUvs, 2))
    g.setIndex(cIndices)
    g.computeVertexNormals()
    // solid road: the car drives on the asphalt itself, not on the coarser terrain heightfield
    sceneryNodes.push({
        name: 'refRoadPhysicalFixed',
        mesh: { geometry: g, material: 'road' },
        extras: { friction: 0.3 },
        children: [ { name: 'trimesh', mesh: { geometry: g, material: 'road' } } ],
    })

    const m = new THREE.BufferGeometry()
    m.setAttribute('position', new THREE.Float32BufferAttribute(marks.positions, 3))
    m.setAttribute('uv', new THREE.Float32BufferAttribute(marks.uvs, 2))
    m.computeVertexNormals()
    sceneryNodes.push({ name: 'roadMarkings', mesh: { geometry: m, material: 'palette' } })
}

// Alcatraz boardwalk: a wooden causeway on pilings, low white rails, lamp posts and swooping string lights
{
    const curve = new THREE.CatmullRomCurve3(Layout.boardwalk.points.map(([ x, z ]) => new THREE.Vector3(x, 0, z)), false, 'centripetal')
    const count = Math.ceil(curve.getLength() / 1.2)
    const pts = curve.getSpacedPoints(count)
    const half = Layout.boardwalk.width / 2
    // just above the water, following the ground where it lands on the shore
    let ys = pts.map(p => Math.max(0.3, ground(p.x, p.z) + 0.06))
    for(let it = 0; it < 6; it++)
        ys = ys.map((y, i) => i === 0 || i === ys.length - 1 ? y : Math.max(y, (ys[i - 1] + ys[i + 1]) / 2))
    const o = pts[0], oy = ys[0]
    const deck = new Model()
    const bulbs = new Model()
    const colliders = []
    const postEvery = 4
    for(let i = 1; i < pts.length; i++)
    {
        const a = pts[i - 1], b = pts[i], ya = ys[i - 1], yb = ys[i]
        const dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz)
        const rotation = [ - Math.atan2(yb - ya, len), Math.atan2(dx, dz), 0 ]
        const L = Math.hypot(len, yb - ya) + 0.06
        const mid = [ (a.x + b.x) / 2 - o.x, (ya + yb) / 2 - oy, (a.z + b.z) / 2 - o.z ]
        const nx = dz / len, nz = - dx / len
        // planks with dark seams
        deck.cbox([ half * 2, 0.22, L ], C.wood, [ mid[0], mid[1] - 0.11, mid[2] ], rotation)
        deck.cbox([ half * 2 - 0.3, 0.02, 0.05 ], C.olive, [ mid[0], mid[1] + 0.005, mid[2] ], rotation)
        colliders.push({ position: [ mid[0], mid[1] - 0.11, mid[2] ], size: [ half * 2, 0.22, L ], rotation })
        for(const side of [ - 1, 1 ])
        {
            const rx = mid[0] + nx * (half - 0.08) * side, rz = mid[2] + nz * (half - 0.08) * side
            deck.cbox([ 0.09, 0.09, L ], C.snow, [ rx, mid[1] + 0.55, rz ], rotation)          // top rail
            deck.cbox([ 0.05, 0.05, L ], C.snow, [ rx, mid[1] + 0.28, rz ], rotation)          // mid rail
            colliders.push({ position: [ rx, mid[1] + 0.3, rz ], size: [ 0.14, 0.6, L ], rotation })
            const px = a.x - o.x + nx * (half - 0.08) * side, pz = a.z - o.z + nz * (half - 0.08) * side
            deck.cbox([ 0.1, 0.6, 0.1 ], C.snow, [ px, ya - oy + 0.3, pz ])                    // rail post
            deck.cylinder(0.13, 0.13, 2, C.wood, [ px, ya - oy - 2.2, pz ], 6)                  // piling into the water
            // lamp posts in pairs, bulbs swooping post to post
            if((i - 1) % postEvery === 0)
            {
                deck.cylinder(0.06, 0.08, 2.3, C.dark, [ px, ya - oy, pz ], 6)
                deck.cbox([ 0.3, 0.08, 0.3 ], C.dark, [ px, ya - oy + 2.3, pz ])
                bulbs.sphere(0.16, C.gold, [ px, ya - oy + 2.48, pz ], 1)
            }
            for(const f of [ 0, 0.5 ])
            {
                const t = (((i - 1) % postEvery) + f) / postEvery
                const bx = a.x + dx * f - o.x + nx * (half - 0.08) * side, bz = a.z + dz * f - o.z + nz * (half - 0.08) * side
                bulbs.sphere(0.07, C.gold, [ bx, ya + (yb - ya) * f - oy + 2.2 - Math.sin(t * Math.PI) * 0.5, bz ], 0)
            }
        }
    }
    sceneryNodes.push(fixedNode('alcatrazBoardwalk', deck, [ o.x, oy, o.z ], colliders))
    sceneryNodes.push({ ...meshNode('boardwalkLights', bulbs, [ o.x, oy, o.z ]), mesh: { geometry: bulbs.geometry(), material: 'emissiveOrangeRadialGradient' } })
}

// Cable car network: every mainland street as a graph (junctions = nodes, street pieces between them = edges),
// so the cable car can wander the whole city at random (StopArea.setCableCar). Not the bridge, Marin, Napa or Alcatraz.
{
    const streets = Layout.streets.filter(st => st.asphalt && st.points.every(([ x, z ]) => z > - 60))
    const step = 0.6
    const lines = streets.map(st =>
    {
        const curve = new THREE.CatmullRomCurve3(st.points.map(([ x, z ]) => new THREE.Vector3(x, 0, z)), false, 'centripetal')
        return curve.getSpacedPoints(Math.max(2, Math.ceil(curve.getLength() / step))).map(p => [ p.x, p.z ])
    })
    const splits = lines.map(line => new Set([ 0, line.length - 1 ]))
    const junctions = []
    const nearestIndex = (line, x, z) =>
    {
        let best = 0, bestD = Infinity
        line.forEach(([ px, pz ], i) => { const d = Math.hypot(px - x, pz - z); if(d < bestD) { bestD = d; best = i } })
        return [ best, bestD ]
    }
    for(let i = 0; i < lines.length; i++)
        for(let j = i + 1; j < lines.length; j++)
        {
            // crossings / touching: the closest approach of every run where the two streets come within 1.5 units
            let run = null
            const flush = () => { if(run) { splits[i].add(run.a); splits[j].add(run.b); junctions.push(run.p) } run = null }
            lines[i].forEach(([ x, z ], a) =>
            {
                const [ b, d ] = nearestIndex(lines[j], x, z)
                if(d < 1.5)
                {
                    if(!run || d < run.d) run = { a, b, d, p: [ (x + lines[j][b][0]) / 2, (z + lines[j][b][1]) / 2 ], last: a, ...(run ? { a: d < run.d ? a : run.a, b: d < run.d ? b : run.b } : {}) }
                    run.last = a
                }
                else if(run && a - run.last > 3)
                    flush()
            })
            flush()
            // T junctions: a street ending near (but not on) the other one
            for(const [ from, to ] of [ [ i, j ], [ j, i ] ])
                for(const end of [ 0, lines[from].length - 1 ])
                {
                    const [ x, z ] = lines[from][end]
                    const [ b, d ] = nearestIndex(lines[to], x, z)
                    if(d >= 1.5 && d < 4)
                    {
                        splits[to].add(b)
                        junctions.push([ x, z ])
                    }
                }
        }
    // nodes: junction points merged within 3 units, plus dead ends
    const nodes = []
    const nodeAt = (x, z) =>
    {
        let found = nodes.findIndex(([ nx, nz ]) => Math.hypot(nx - x, nz - z) < 4.2)
        if(found < 0) { nodes.push([ x, z ]); found = nodes.length - 1 }
        return found
    }
    junctions.forEach(([ x, z ]) => nodeAt(x, z))
    const edges = []
    lines.forEach((line, li) =>
    {
        const cuts = [ ...splits[li] ].sort((a, b) => a - b)
        for(let k = 1; k < cuts.length; k++)
        {
            const piece = line.slice(cuts[k - 1], cuts[k] + 1)
            if(piece.length < 3)
                continue
            const a = nodeAt(...piece[0]), b = nodeAt(...piece[piece.length - 1])
            if(a === b)
                continue
            // keep every 2nd point (about 1.2 units apart), on the road surface
            const pts = piece.filter((_, n) => n % 2 === 0 || n === piece.length - 1).map(([ x, z ], n, all) =>
            {
                const q = all[Math.min(n + 1, all.length - 1)], r = all[Math.max(n - 1, 0)]
                const tx = q[0] - r[0], tz = q[1] - r[1], tl = Math.hypot(tx, tz) || 1
                return [ round(x * W), round(roadY(x, z, tx / tl, tz / tl) * W + 0.02), round(z * W) ]
            })
            edges.push({ a, b, points: pts })
        }
    })
    // only the part of the graph connected to Hyde St (the cable car's home), so it never gets stranded
    const adjacency = nodes.map(() => [])
    edges.forEach((e, i) => { adjacency[e.a].push(i); adjacency[e.b].push(i) })
    let hyde = 0
    nodes.forEach(([ x, z ], n) => { if(adjacency[n].length && Math.hypot(x + 17, z + 26) < Math.hypot(nodes[hyde][0] + 17, nodes[hyde][1] + 26)) hyde = n })
    const reached = new Set([ hyde ])
    const queue = [ hyde ]
    while(queue.length) { const n = queue.shift(); for(const ei of adjacency[n]) for(const m of [ edges[ei].a, edges[ei].b ]) if(!reached.has(m)) { reached.add(m); queue.push(m) } }
    const kept = edges.filter(e => reached.has(e.a))
    fs.writeFileSync(out('sources/data/cableCarNetwork.json'), JSON.stringify({ nodes: nodes.map(([ x, z ]) => [ round(x * W), round(z * W) ]), edges: kept }))
    console.log('cable car network:', nodes.length, 'nodes,', kept.length, 'edges', `(${edges.length - kept.length} unreachable dropped),`, Math.round(kept.reduce((t, e) => t + e.points.length * 1.2, 0)), 'units of track')
}

// Street lamps along every street: globe lamps on both sides, staggered; they glow after dark with a pool of light below
{
    const posts = new Model()
    const pools = []
    const colliders = []
    for(const street of Layout.streets.filter(st => st.asphalt))
    {
        const curve = new THREE.CatmullRomCurve3(street.points.map(([ x, z ]) => new THREE.Vector3(x, 0, z)), false, 'centripetal')
        const count = Math.floor(curve.getLength() / 4.5)
        for(let i = 1; i < count; i++)
        {
            const t = i / count
            const p = curve.getPointAt(t), d = curve.getTangentAt(t)
            const side = i % 2 ? 1 : - 1
            const off = street.width * (street.highway ? 0.45 : 0.4) + 1.1
            const x = p.x - d.z * off * side, z = p.z + d.x * off * side
            if(nearRoad(x, z, 0.5) || inSite(x, z, 1) || !onLand(x, z) || Math.abs(x) > 92 || Math.abs(z) > 92 || (x > - 70 && x < - 32 && z > 41.5 && z < 51))
                continue
            const y = ground(x, z)
            posts.cylinder(0.07, 0.1, 2.6, C.dark, [ x, y, z ], 6)
            posts.cylinder(0.14, 0.1, 0.18, C.dark, [ x, y + 2.6, z ], 6)
            posts.sphere(0.26, C.lamp, [ x, y + 2.95, z ], 1)
            for(let k = 0; k < 7; k++)                                     // fairy lights spiralling up the post
                posts.sphere(0.09, C.fairy, [ x + Math.cos(k * 1.9) * 0.13, y + 0.4 + k * 0.32, z + Math.sin(k * 1.9) * 0.13 ], 0)
            posts.add(new THREE.TorusGeometry(0.28, 0.07, 5, 12), C.moss, [ x, y + 2.25, z ], [ 0, Math.atan2(d.x, d.z), 0 ])   // wreath
            posts.cbox([ 0.2, 0.14, 0.06 ], C.red, [ x, y + 2.05, z ])
            pools.push([ x, y + 0.04, z ])
            colliders.push({ shape: 'tube', position: [ x, y + 1.3, z ], radius: 0.12, height: 2.6 })
        }
    }
    sceneryNodes.push(fixedNode('streetLamps', posts, [ 0, 0, 0 ], colliders))
    const g = new THREE.BufferGeometry()
    const parts = pools.map(([ x, y, z ]) => new THREE.CircleGeometry(3.4, 20).rotateX(- Math.PI / 2).translate(x, y, z))
    const merged = mergeGeometries(parts)
    sceneryNodes.push({ name: 'lampPools', position: [ 0, 0, 0 ], mesh: { geometry: merged, material: 'lampPool' } })
    console.log('street lamps', pools.length)
}

// Highway signs: 101 north to Napa (11/28 day trip), 101 south to SFO and Levi's
{
    const highwaySign = (lines, color) =>
    {
        const m = new Model()
        m.cylinder(0.12, 0.12, 4.2, C.slate, [ - 1.8, 0, 0 ], 6)
        m.cylinder(0.12, 0.12, 4.2, C.slate, [ 1.8, 0, 0 ], 6)
        m.box([ 4.6, 2, 0.2 ], color, [ 0, 3.2, 0 ])
        m.box([ 4.8, 0.1, 0.22 ], C.snow, [ 0, 5.15, 0 ])
        m.box([ 4.8, 0.1, 0.22 ], C.snow, [ 0, 3.2, 0 ])
        lines.forEach((w, i) => m.box([ w, 0.22, 0.24 ], C.snow, [ - (4 - w) / 2, 4.55 - i * 0.55, 0 ]))
        // shield
        m.box([ 0.8, 0.8, 0.26 ], C.snow, [ 1.6, 4.1, 0 ])
        return m
    }
    sceneryNodes.push({ ...fixedNode('signNapa', highwaySign([ 2.4, 1.6, 2 ], C.moss), [ - 58, ground(- 58, - 93.5), - 93.5 ], [ { position: [ 0, 2.1, 0 ], size: [ 4.6, 4.2, 0.4 ] } ]), rotation: [ 0, 0, 0 ] }) // beside the road, not on it
    sceneryNodes.push({ ...fixedNode('sign101', highwaySign([ 2.4, 2 ], C.moss), [ 51.5, ground(51.5, 49), 49 ], [ { position: [ 0, 2.1, 0 ], size: [ 4.6, 4.2, 0.4 ] } ]), rotation: [ 0, 0.3, 0 ] })
}

// Skyline landmarks
{
    // Union Square's giant Christmas tree, on its own lawn between Chinatown and the Painted Ladies (clear of every street)
    {
        const T = 1.5, k = 1.5
        const [ tx, tz ] = TREE_SPOT
        console.log('christmas tree clear of roads:', !nearRoad(tx, tz, 3.4 * T * k), 'not in a site:', !inSite(tx, tz, 7))
        if(process.env.FIND_TREE)
        {
            const spots = []
            for(let x = - 16; x <= 16; x += 1) for(let z = - 14; z <= 22; z += 1)
            {
                let m = 0; while(m < 14 && !nearRoad(x, z, m)) m += 0.5
                if(!inSite(x, z, 7) && onLand(x, z)) spots.push([ m, x, z ])
            }
            console.log(spots.sort((a, b) => b[0] - a[0]).slice(0, 8))
        }
        sceneryNodes.push(scaleNode(fixedNode('christmasTree', christmasTree(), [ tx, ground(tx, tz), tz ], [ { shape: 'tube', position: [ 0, 4 * T, 0 ], radius: 2.4 * T, height: 8 * T } ]), k))
        const star = christmasStar()
        sceneryNodes.push(scaleNode({ ...meshNode('christmasStar', star, [ tx, ground(tx, tz) + (12.6 + 2.0) * T * k, tz ]), mesh: { geometry: star.geometry(), material: 'emissiveOrangeRadialGradient' } }, k))
    }
    // Napa: vineyards all around the castle (rows of vines on trellises, ripe purple and red grapes, autumn leaves),
    // Italian cypresses along the edges and olive trees on the lawn. World units; each row is a low wall the car can't cross.
    {
        const r = rng(2026)
        const leaves = [ C.leaf, C.leaf, C.moss, C.sage, C.gold, C.orange ]
        const grapes = [ C.purple, C.purple, C.red, C.lavender ]
        const blocks = [
            [ - 77, - 98.5, - 66.5, - 88.8 ],   // north east, between the driveway and the hills
            [ - 77, - 80.2, - 67.5, - 73.5 ],   // south east
            [ - 89.4, - 99.6, - 81.8, - 96.2 ], // north of the castle, between its towers
            [ - 89.4, - 72.0, - 81.8, - 70.0 ], // south of the castle
        ]
        for(const [ x0, z0, x1, z1 ] of blocks)
        {
            for(let z = z0 + 0.6; z < z1; z += 1.7)
            {
                const row = new Model()
                const len = x1 - x0
                const y = ground((x0 + x1) / 2, z)
                for(let x = 0; x <= len; x += 2.4)
                    row.cylinder(0.05, 0.06, 1.3, C.wood, [ x - len / 2, 0, 0 ], 4)
                row.cbox([ len, 0.03, 0.03 ], C.dark, [ 0, 1.15, 0 ])
                for(let x = 0.3; x < len - 0.2; x += 0.55)
                {
                    const px = x - len / 2
                    row.sphere(0.36 + r() * 0.12, leaves[Math.floor(r() * leaves.length)], [ px, 0.95 + r() * 0.15, (r() - 0.5) * 0.15 ], 1, [ 1.2, 0.85, 0.9 ])
                    if(r() < 0.55)
                    {
                        const g = grapes[Math.floor(r() * grapes.length)]
                        const side = r() < 0.5 ? - 1 : 1
                        row.sphere(0.11, g, [ px, 0.62, side * 0.3 ], 0)
                        row.sphere(0.09, g, [ px + 0.08, 0.5, side * 0.32 ], 0)
                        row.sphere(0.07, g, [ px - 0.03, 0.42, side * 0.3 ], 0)
                    }
                }
                sceneryNodes.push(fixedNode('vineRow', row, [ (x0 + x1) / 2, y, z ], [ { position: [ 0, 0.55, 0 ], size: [ len, 1.1, 0.5 ] } ]))
            }
        }
        // Italian cypresses: lining the driveway and framing the vineyards
        const trees = new Model()
        const cypress = (x, z, h = 4.5) =>
        {
            const y = ground(x, z)
            trees.cylinder(0.12, 0.16, 0.8, C.wood, [ x, y, z ], 5)
            trees.cone(0.75, h, C.moss, [ x, y + 0.6, z ], 7)
            trees.cone(0.55, h * 0.7, C.olive, [ x, y + 0.6 + h * 0.35, z ], 7)
        }
        for(const x of [ - 76.5, - 74.5, - 72.5, - 70.5, - 68.5 ])
            for(const z of [ - 88.2, - 79.6 ])
                cypress(x, z, 4 + r())
        for(let x = - 89; x < - 81; x += 2.6)
            cypress(x, - 94.4, 4 + r() * 1.2)
        for(let z = - 92; z > - 76; z -= 2.6)
            if(Math.abs(z + 84) > 4.4)
                cypress(- 94.6, z, 4 + r() * 1.2)
        // olive trees on the lawn by the gate: twisted trunks, silvery round crowns
        for(const [ x, z ] of [ [ - 77.6, - 90.8 ], [ - 77.8, - 77.2 ] ])
        {
            const y = ground(x, z)
            trees.beam([ x, y, z ], [ x + 0.3, y + 1.2, z - 0.2 ], 0.22, C.wood)
            trees.beam([ x + 0.3, y + 1.2, z - 0.2 ], [ x - 0.2, y + 1.9, z + 0.1 ], 0.16, C.wood)
            trees.sphere(1.3, C.sage, [ x, y + 2.3, z ], 1, [ 1.3, 0.75, 1.2 ])
            trees.sphere(0.9, C.stone, [ x + 0.6, y + 2.6, z + 0.4 ], 1, [ 1.2, 0.7, 1.1 ])
        }
        sceneryNodes.push(meshNode('napaTrees', trees, [ 0, 0, 0 ]))
    }

    // Transamerica Pyramid
    const pyramid = new Model()
    {
        // a slim four sided pyramid of white precast panels with dark window bands, two "wings" (elevator
        // shafts) running up its sides, a tall glass topped spire, and the A-frame legs at its base
        const H = 17, R0 = 2.6, R1 = 0.75
        const radius = (y) => R0 + (R1 - R0) * (y / H)
        const square = (r0, r1, h, color, y) => pyramid.add(new THREE.CylinderGeometry(r1, r0, h, 4, 1).translate(0, h / 2, 0), color, [ 0, y, 0 ], [ 0, Math.PI / 4, 0 ])
        square(R0, R1, H, C.snow, 1.4)
        for(let y = 2; y < H + 1.2; y += 0.42)
            square(radius(y - 1.4) * 1.012 + 0.01, radius(y - 1.25) * 1.012 + 0.01, 0.14, C.slate, y)
        for(const side of [ - 1, 1 ])
        {
            const tilt = Math.atan2(R0 - R1, H)
            pyramid.add(new THREE.BoxGeometry(0.9, 15.6, 1.1).translate(0, 7.8, 0), C.snow, [ side * (R0 * 0.71), 1.4, 0 ], [ 0, 0, side * tilt ])
        }
        // the spire
        square(R1, 0.02, 6.5, C.snow, H + 1.4)
        square(R1 * 0.9, R1 * 0.5, 1.6, C.sky, H + 1.4)
        // A-frame legs around the base
        for(let k = 0; k < 4; k++)
        {
            const a = k / 4 * Math.PI * 2
            const ux = Math.cos(a), uz = Math.sin(a), vx = - uz, vz = ux
            for(const o of [ - 1.2, 0, 1.2 ])
            {
                const base = [ ux * (R0 + 0.3) + vx * o, 0, uz * (R0 + 0.3) + vz * o ]
                pyramid.beam(base, [ ux * R0 * 0.95 + vx * (o - 0.6), 1.45, uz * R0 * 0.95 + vz * (o - 0.6) ], 0.12, C.snow)
                pyramid.beam(base, [ ux * R0 * 0.95 + vx * (o + 0.6), 1.45, uz * R0 * 0.95 + vz * (o + 0.6) ], 0.12, C.snow)
            }
        }
        pyramid.add(new THREE.BoxGeometry(R0 * 1.4, 1.4, R0 * 1.4).translate(0, 0.7, 0), C.dark, [ 0, 0, 0 ])   // glass lobby
        // Christmas: its four edges strung with lights to the tip of the spire, like a giant tree, a gold star on top
        for(let k = 0; k < 4; k++)
        {
            const a = Math.PI / 4 + k * Math.PI / 2 + Math.PI / 4
            for(let y = 1.6; y < H + 1.4 + 6.3; y += 0.4)
            {
                const r = (y < H + 1.4 ? radius(y - 1.4) : R1 + (0.02 - R1) * ((y - H - 1.4) / 6.5)) + 0.08
                bulb(pyramid, [ Math.cos(a) * r, y, Math.sin(a) * r ], 0.13)
            }
        }
        pyramid.add(new THREE.OctahedronGeometry(0.6, 0), C.gold, [ 0, H + 1.4 + 7.0, 0 ], [ 0, 0, Math.PI / 4 ])
    }
    sceneryNodes.push(fixedNode('transamerica', pyramid, [ 46, ground(46, - 24), - 24 ], [ { position: [ 0, 5, 0 ], size: [ 4.6, 10, 4.6 ] } ]))

    // Salesforce Tower
    const sf = new Model()
    sf.add(new THREE.CylinderGeometry(1.6, 2.4, 26, 10).translate(0, 13, 0), C.stone)
    sf.dome(1.6, C.stone, [ 0, 26, 0 ], 10)
    for(let i = 0; i < 12; i++)
        sf.cylinder(2.42 - i * 0.065, 2.42 - i * 0.065, 0.08, C.sky, [ 0, 1 + i * 2, 0 ], 10)
    for(let y = 2; y < 26; y += 3)                                     // rings of lights up the tower
    {
        const r = 2.4 - (y / 26) * 0.8 + 0.1
        for(let k = 0; k < 24; k++)
            bulb(sf, [ Math.cos(k / 24 * Math.PI * 2) * r, y, Math.sin(k / 24 * Math.PI * 2) * r ], 0.13)
    }
    for(let k = 0; k < 30; k++)                                        // the crown: lights over the dome and a star
    {
        const a = k / 30 * Math.PI * 2
        bulb(sf, [ Math.cos(a) * 1.62, 26.2, Math.sin(a) * 1.62 ], 0.14)
        bulb(sf, [ Math.cos(a) * 1.2, 27.0, Math.sin(a) * 1.2 ], 0.12)
    }
    sf.add(new THREE.OctahedronGeometry(0.55, 0), C.gold, [ 0, 28.3, 0 ], [ 0, 0, Math.PI / 4 ])
    sceneryNodes.push(fixedNode('salesforce', sf, [ 41, ground(41, - 15), - 15 ], [ { shape: 'tube', position: [ 0, 8, 0 ], radius: 2.3, height: 16 } ]))

    // Coit Tower on Telegraph Hill
    const coit = new Model()
    coit.cylinder(1.3, 1.3, 7, C.cream, [ 0, 0, 0 ], 10)
    for(let i = 0; i < 10; i++)
    {
        const a = i / 10 * Math.PI * 2
        coit.cbox([ 0.25, 0.8, 0.1 ], C.dark, [ Math.cos(a) * 1.31, 6.3, Math.sin(a) * 1.31 ], [ 0, - a + Math.PI / 2, 0 ])
    }
    coit.cylinder(1.5, 1.5, 0.4, C.cream, [ 0, 7, 0 ], 10)
    coit.box([ 4, 1, 4 ], C.cream)
    for(let k = 0; k < 70; k++)                                        // a spiral garland of lights up the column
    {
        const t = k / 70, a = t * Math.PI * 8
        bulb(coit, [ Math.cos(a) * 1.38, 1.1 + t * 5.6, Math.sin(a) * 1.38 ], 0.11)
    }
    for(let k = 0; k < 24; k++)
        bulb(coit, [ Math.cos(k / 24 * Math.PI * 2) * 1.58, 7.45, Math.sin(k / 24 * Math.PI * 2) * 1.58 ], 0.11)
    wreath(coit, [ 0, 5.0, 1.42 ], 0, 1.6)
    sceneryNodes.push(fixedNode('coit', coit, [ 46, ground(46, - 35), - 35 ], [ { shape: 'tube', position: [ 0, 3.5, 0 ], radius: 1.4, height: 7 } ]))

    // Sutro Tower
    const sutro = new Model()
    const legs = [ [ - 1.2, - 0.7 ], [ 1.2, - 0.7 ], [ 0, 1.4 ] ]
    for(const [ x, z ] of legs)
        sutro.beam([ x * 1.6, 0, z * 1.6 ], [ x * 0.6, 14, z * 0.6 ], 0.3, C.red)
    for(const h of [ 4, 8, 12 ])
        sutro.cylinder(1.6 - h * 0.06, 1.6 - h * 0.06, 0.25, C.snow, [ 0, h, 0 ], 3)
    for(const [ x, z ] of legs)
    {
        sutro.box([ 0.3, 3, 0.3 ], C.snow, [ x * 0.6, 14, z * 0.6 ])
        sutro.box([ 0.2, 1.2, 0.2 ], C.red, [ x * 0.6, 17, z * 0.6 ])
    }
    for(const [ x, z ] of legs)                                         // lights strung up each leg
        for(let t = 0.04; t < 1; t += 0.05)
            bulb(sutro, [ x * 1.6 + (x * 0.6 - x * 1.6) * t, 14 * t, z * 1.6 + (z * 0.6 - z * 1.6) * t ], 0.14)
    if(process.env.FIND_SUTRO)
    {
        const spots = []
        for(let x = - 56; x <= - 30; x += 1) for(let z = 28; z <= 50; z += 1)
        {
            let d = 0; while(d < 10 && !nearRoad(x, z, d)) d += 0.5
            const nearLetters = x > - 72 && x < - 30 && z > 38 && z < 54
            const nearTennis = x > - 76 && x < - 40 && z < 35
            if(!nearLetters && !nearTennis && !inSite(x, z, 4) && onLand(x, z)) spots.push([ d, x, z, Math.hypot(x + 29, z - 52).toFixed(1) ])
        }
        console.log('sutro spots', spots.sort((a, b) => b[0] - a[0]).slice(0, 8))
    }
    const [ sutroX, sutroZ ] = SUTRO_SPOT
    console.log('sutro tower clear of roads:', !nearRoad(sutroX, sutroZ, 3), 'not in a site:', !inSite(sutroX, sutroZ, 3), 'from Dookie:', Math.hypot(sutroX + 29, sutroZ - 52).toFixed(1))
    sceneryNodes.push(fixedNode('sutro', sutro, [ sutroX, ground(sutroX, sutroZ), sutroZ ], [ { position: [ 0, 4, 0 ], size: [ 3, 8, 3 ] } ]))
}

// City blocks: every house is its own light block the car can knock around
{
    const r = rng(415)
    const downtown = { x: 44, z: - 14 }
    const pastel = [ C.blush, C.cream, C.sky, C.sage, C.peach, C.lavender, C.snow, C.salmon, C.pink ]
    const glass = [ C.stone, C.slate, C.snow, C.cream, C.sky ]
    const step = 4.2
    let count = 0
    for(let gx = - 88; gx <= 88; gx += step)
    {
        for(let gz = - 92; gz <= 90; gz += step)
        {
            const x = gx + (r() - 0.5) * 1.4
            const z = gz + (r() - 0.5) * 1.4
            const dt = Math.hypot(x - downtown.x, z - downtown.z)
            const isDowntown = dt < 20
            const w = isDowntown ? 3.2 + r() * 1.2 : 2.6 + r() * 1.2
            const d = isDowntown ? 3.2 + r() * 1.2 : 2.8 + r() * 1.4
            const corners = [ [ x - w / 2 - 0.6, z - d / 2 - 0.6 ], [ x + w / 2 + 0.6, z - d / 2 - 0.6 ], [ x - w / 2 - 0.6, z + d / 2 + 0.6 ], [ x + w / 2 + 0.6, z + d / 2 + 0.6 ], [ x, z ] ]
            if(excluded(x, z, 3) || inSite(x, z, 3))
                continue
            if(!corners.every(([ cx, cz ]) => onLand(cx, cz) && paved(cx, cz) < 0.05 && grassy(cx, cz) < 0.15))
                continue
            if(nearRoad(x, z, Math.max(w, d) / 2 + 0.6))
                continue
            if(Math.abs(x) > 88 || Math.abs(z) > 90)
                continue
            if(r() < (isDowntown ? 0.03 : 0.06))
                continue
            const ys = corners.map(([ cx, cz ]) => ground(cx, cz))
            if(Math.max(...ys) - Math.min(...ys) > 1.1)
                continue
            const baseY = ys.reduce((a, b) => a + b, 0) / ys.length
            const height = isDowntown ? 5 + (1 - dt / 20) * 10 + r() * 3 : 2.6 + r() * 1.6
            const color = isDowntown ? glass[Math.floor(r() * glass.length)] : pastel[Math.floor(r() * pastel.length)]
            const m = new Model()
            m.box([ w, height, d ], color, [ 0, 0, 0 ])
            if(isDowntown)
            {
                for(let k = 1; k < height / 1.6; k++)
                    m.box([ w + 0.04, 0.35, d + 0.04 ], C.window, [ 0, k * 1.6 - 0.6, 0 ])
                m.box([ w * 0.5, 0.8, d * 0.5 ], C.slate, [ 0, height, 0 ])
                for(const [ cx2, cz2 ] of [ [ - 1, - 1 ], [ 1, - 1 ], [ - 1, 1 ], [ 1, 1 ] ])          // lights strung down the corners
                    for(let ly = 0.6; ly < height; ly += 0.45)
                        bulb(m, [ cx2 * (w / 2 + 0.04), ly, cz2 * (d / 2 + 0.04) ], 0.12)
                // the roofline outlined in lights, a second ring on the penthouse, and a lit tree or star on top
                for(const [ a, b ] of [ [ [ - 1, - 1 ], [ 1, - 1 ] ], [ [ 1, - 1 ], [ 1, 1 ] ], [ [ 1, 1 ], [ - 1, 1 ] ], [ [ - 1, 1 ], [ - 1, - 1 ] ] ])
                {
                    lightString(m, [ a[0] * (w / 2 + 0.05), height + 0.05, a[1] * (d / 2 + 0.05) ], [ b[0] * (w / 2 + 0.05), height + 0.05, b[1] * (d / 2 + 0.05) ], 0.35, 0, 0.11)
                    lightString(m, [ a[0] * (w / 4 + 0.04), height + 0.85, a[1] * (d / 4 + 0.04) ], [ b[0] * (w / 4 + 0.04), height + 0.85, b[1] * (d / 4 + 0.04) ], 0.3, 0, 0.09)
                }
                if(r() < 0.5) litPine(m, [ 0, height + 0.8, 0 ], 0.7)
                else m.add(new THREE.OctahedronGeometry(0.35, 0), C.gold, [ 0, height + 1.3, 0 ], [ 0, 0, Math.PI / 4 ])
            }
            else
            {
                m.box([ w + 0.06, 0.22, d + 0.06 ], C.snow, [ 0, height - 0.18, 0 ]) // sits a hair above the flat top (coplanar faces flicker)
                for(const sd of [ - 1, 1 ])
                {
                    m.cbox([ w * 0.3, 0.8, 0.05 ], C.window, [ sd * w * 0.22, height * 0.6, - d / 2 - 0.01 ])
                    m.cbox([ w * 0.3, 0.8, 0.05 ], C.window, [ sd * w * 0.22, height * 0.6, d / 2 + 0.01 ])
                }
                m.cbox([ 0.7, 1.2, 0.05 ], C.wood, [ 0, 0.6, - d / 2 - 0.02 ])
                // Christmas: fairy lights swagging along all four eaves, a wreath with a red bow on the door, garland over it
                const ey = height + 0.02
                lightString(m, [ - w / 2 - 0.08, ey, - d / 2 - 0.08 ], [ w / 2 + 0.08, ey, - d / 2 - 0.08 ], 0.3, 0.14)
                lightString(m, [ - w / 2 - 0.08, ey, d / 2 + 0.08 ], [ w / 2 + 0.08, ey, d / 2 + 0.08 ], 0.3, 0.14)
                lightString(m, [ - w / 2 - 0.08, ey, - d / 2 - 0.08 ], [ - w / 2 - 0.08, ey, d / 2 + 0.08 ], 0.3, 0.14)
                lightString(m, [ w / 2 + 0.08, ey, - d / 2 - 0.08 ], [ w / 2 + 0.08, ey, d / 2 + 0.08 ], 0.3, 0.14)
                for(const [ cx2, cz2 ] of [ [ - 1, - 1 ], [ 1, - 1 ], [ - 1, 1 ], [ 1, 1 ] ])          // icicle drops down the front corners
                    for(let ly = 0.35; ly < height - 0.2; ly += 0.5)
                        bulb(m, [ cx2 * (w / 2 + 0.06), ly, cz2 * (d / 2 + 0.06) ], 0.08)
                wreath(m, [ 0, 1.0, - d / 2 - 0.08 ], 0)
                for(let gx = - 0.45; gx <= 0.46; gx += 0.15)                                         // garland arch over the door
                    m.sphere(0.07, gx * 7 % 2 ? C.moss : C.leaf, [ gx, 1.32 - gx * gx * 0.5, - d / 2 - 0.06 ], 0)
                for(const sd of [ - 1, 1 ])                                                          // window tops strung with lights
                    for(const fz of [ - 1, 1 ])
                    {
                        const wx = sd * w * 0.22, wy = height * 0.6, wz = fz * (d / 2 + 0.06)
                        lightString(m, [ wx - w * 0.17, wy + 0.45, wz ], [ wx + w * 0.17, wy + 0.45, wz ], 0.26, 0.08, 0.065)
                    }
                // the yard: each house gets one holiday piece in front of the door (Thanksgiving or Christmas)
                const pick = r()
                const fx = (r() < 0.5 ? - 1 : 1) * (w / 2 - 0.25)
                if(pick < 0.24) harvest(m, [ fx, 0, - d / 2 - 0.55 ], 0, 0.8)
                else if(pick < 0.44) litPine(m, [ fx, 0, - d / 2 - 0.6 ], 0.6)
                else if(pick < 0.6) { candyCane(m, [ - 0.6, 0, - d / 2 - 0.5 ], 0, 0.75); candyCane(m, [ 0.6, 0, - d / 2 - 0.5 ], Math.PI, 0.75) }
                else if(pick < 0.74) snowman(m, [ fx, 0, - d / 2 - 0.6 ], 0, 0.7)
                else if(pick < 0.88) gifts(m, [ fx, 0, - d / 2 - 0.55 ], 0.3, 0.8, count)
                else { pumpkin(m, [ - 0.55, 0, - d / 2 - 0.35 ], 1.1); pumpkin(m, [ 0.55, 0, - d / 2 - 0.35 ], 0.9, C.gold) }
                if(r() < 0.6)
                {
                    const gh = 1 + r() * 0.6
                    m.gable(w + 0.1, d + 0.1, gh, r() < 0.5 ? C.slate : C.brick, [ 0, height + 0.04, 0 ]) // ridge along x, spans the depth
                    // lights outlining the roof: both gable ends and the ridge, a lit star at one end
                    const ry0 = height + 0.1
                    for(const ex of [ - 1, 1 ])
                    {
                        const gx = ex * (w / 2 + 0.07)
                        lightString(m, [ gx, ry0, - d / 2 - 0.05 ], [ gx, ry0 + gh, 0 ], 0.3, 0)
                        lightString(m, [ gx, ry0 + gh, 0 ], [ gx, ry0, d / 2 + 0.05 ], 0.3, 0)
                    }
                    lightString(m, [ - w / 2, ry0 + gh + 0.02, 0 ], [ w / 2, ry0 + gh + 0.02, 0 ], 0.3, 0)
                    if(r() < 0.5)
                        m.add(new THREE.OctahedronGeometry(0.22, 0), C.gold, [ w / 2 - 0.1, ry0 + gh + 0.3, 0 ], [ 0, 0, Math.PI / 4 ])
                }
                else
                {
                    if(r() < 0.4)
                        litPine(m, [ 0, height + 0.04, 0 ], 0.55)                                    // a little lit tree up on the flat roof
                    else if(r() < 0.5)
                        gifts(m, [ 0, height + 0.04, 0 ], 0.6, 0.7, count + 3)
                }
            }
            const mass = isDowntown ? 1.5 + height * 0.08 : 0.9
            sceneryNodes.push({
                ...dynamicNode('house', m, [ round(x), round(baseY), round(z) ], [ { position: [ 0, height / 2, 0 ], size: [ w, height, d ] } ], mass),
                rotation: [ 0, (r() - 0.5) * 0.2, 0 ],
            })
            footprints.push([ x, z, w, d, isDowntown ])
            count++
        }
    }
    console.log('houses', count)
}

// Thanksgiving: a giant, detailed roast turkey dish in the bottom left (built at 1x, placed at 1.5x)
{
    const { x, z } = turkeyData
    const S = 1.5
    const y = ground(x, z)
    const r = rng(1124)
    const dish = new Model()
    // platter: white porcelain, gold rim with a beaded pattern, a little foot
    dish.cylinder(5.4, 5.0, 0.25, C.snow, [ 0, 0, 0 ], 32)
    dish.cylinder(6.3, 5.4, 0.35, C.snow, [ 0, 0.25, 0 ], 32)
    dish.add(new THREE.TorusGeometry(6.15, 0.16, 6, 48), C.gold, [ 0, 0.62, 0 ], [ Math.PI / 2, 0, 0 ])
    for(let i = 0; i < 40; i++)
    {
        const a = i / 40 * Math.PI * 2
        dish.sphere(0.12, C.gold, [ Math.cos(a) * 6.0, 0.66, Math.sin(a) * 6.0 ], 0)
    }
    dish.cylinder(5.3, 5.3, 0.04, C.cream, [ 0, 0.6, 0 ], 32)
    // bed of greens under the bird
    for(let i = 0; i < 26; i++)
    {
        const a = r() * Math.PI * 2, d = 2.2 + r() * 1.6
        dish.sphere(0.45 + r() * 0.25, i % 3 ? C.moss : C.olive, [ Math.cos(a) * d * 1.2, 0.75, Math.sin(a) * d * 0.85 ], 1, [ 1.3, 0.35, 1 ])
    }

    // the roast turkey: layered golden-brown body, crispy darker underside, glossy highlights
    const T = [ 0, 0.7, 0 ]
    dish.sphere(2.7, C.wood, [ 0, T[1] + 1.25, 0 ], 2, [ 1.45, 0.62, 1.05 ])          // darker underside
    dish.sphere(2.6, C.brick, [ 0, T[1] + 1.65, 0 ], 2, [ 1.42, 0.78, 1.0 ])          // main roast
    dish.sphere(2.0, C.orange, [ 0.4, T[1] + 2.35, 0 ], 2, [ 1.45, 0.62, 0.95 ])      // golden breast
    // breast bone ridge and skin highlights
    dish.sphere(0.55, C.gold, [ 0.6, T[1] + 3.45, 0 ], 1, [ 4.2, 0.45, 0.6 ])
    for(const [ hx, hz ] of [ [ - 1.2, 0.9 ], [ 0.9, - 1 ], [ 1.8, 0.7 ], [ - 0.4, - 1.3 ], [ - 2, - 0.5 ] ])
        dish.sphere(0.35, C.gold, [ hx, T[1] + 3.0, hz ], 1, [ 1.6, 0.35, 1 ])
    // crispy browned spots
    for(let i = 0; i < 14; i++)
    {
        const a = r() * Math.PI * 2
        dish.sphere(0.22 + r() * 0.15, C.wood, [ Math.cos(a) * 2.8, T[1] + 2.2 + r() * 0.7, Math.sin(a) * 1.9 ], 0)
    }
    // tail end (pope's nose) and the neck end
    dish.sphere(0.9, C.brick, [ - 3.4, T[1] + 1.8, 0 ], 1, [ 1, 0.8, 1.1 ])
    dish.sphere(0.8, C.orange, [ 3.3, T[1] + 1.9, 0 ], 1, [ 0.8, 0.9, 1.3 ])
    for(const side of [ - 1, 1 ])
    {
        // thighs, drumsticks pointing up and forward, with paper frill crowns
        dish.sphere(1.15, C.brick, [ 1.9, T[1] + 1.7, side * 1.75 ], 1, [ 1.5, 0.95, 0.95 ])
        dish.sphere(0.55, C.orange, [ 2.1, T[1] + 2.25, side * 1.85 ], 1, [ 1.5, 0.6, 0.8 ])
        dish.cylinder(0.32, 0.5, 1.6, C.brick, [ 3.3, T[1] + 2.0, side * 1.55 ], 8, [ 0, 0, - Math.PI * 0.36 ])
        dish.cylinder(0.16, 0.16, 0.8, C.snow, [ 4.45, T[1] + 2.75, side * 1.45 ], 6, [ 0, 0, - Math.PI * 0.36 ])
        for(let k = 0; k < 7; k++)
        {
            const a = k / 7 * Math.PI * 2
            dish.cone(0.1, 0.35, C.snow, [ 4.85 + Math.cos(a) * 0.15, T[1] + 3.05, side * 1.45 + Math.sin(a) * 0.18 ], 4)
        }
        // wings tucked on the sides
        dish.sphere(0.95, C.brick, [ - 0.8, T[1] + 1.9, side * 2.45 ], 1, [ 1.6, 0.55, 0.45 ])
        dish.sphere(0.45, C.wood, [ 0.3, T[1] + 1.7, side * 2.6 ], 1, [ 1.2, 0.6, 0.5 ])
    }
    // herb sprigs on top (rosemary, thyme) and a bay leaf
    for(let i = 0; i < 6; i++)
    {
        const hx = - 1.6 + i * 0.6, hz = (i % 2 - 0.5) * 0.6
        dish.cylinder(0.04, 0.04, 1.1, C.olive, [ hx, T[1] + 3.35, hz ], 4, [ Math.PI / 2, 0, 0.4 + i * 0.5 ])
        for(let k = 0; k < 4; k++)
            dish.sphere(0.08, C.moss, [ hx + (k - 1.5) * 0.15, T[1] + 3.4, hz + (k - 1.5) * 0.2 ], 0)
    }

    // garnish ring: orange slices, cranberries, roasted potatoes and carrots, grapes, green beans
    for(let i = 0; i < 18; i++)
    {
        const a = i / 18 * Math.PI * 2 + 0.1
        const px = Math.cos(a) * 4.55, pz = Math.sin(a) * 4.35
        const kind = i % 6
        if(kind === 0)
        {
            dish.cylinder(0.55, 0.55, 0.12, C.orange, [ px, 0.75, pz ], 10, [ 0.5, a, 0.4 ])
            dish.cylinder(0.42, 0.42, 0.13, C.gold, [ px, 0.76, pz ], 10, [ 0.5, a, 0.4 ])
        }
        else if(kind === 1)
            for(let k = 0; k < 5; k++)
                dish.sphere(0.17, C.red, [ px + (r() - 0.5) * 0.6, 0.85 + r() * 0.15, pz + (r() - 0.5) * 0.6 ], 0)
        else if(kind === 2)
            for(let k = 0; k < 3; k++)
                dish.sphere(0.32, C.khaki, [ px + (k - 1) * 0.45, 0.88, pz + (r() - 0.5) * 0.3 ], 1, [ 1.2, 0.8, 1 ])
        else if(kind === 3)
            for(let k = 0; k < 3; k++)
                dish.cone(0.16, 0.9, C.orange, [ px + (k - 1) * 0.28, 0.85, pz ], 6, [ Math.PI / 2, a + k * 0.3, 0 ])
        else if(kind === 4)
            for(let k = 0; k < 6; k++)
                dish.sphere(0.16, C.purple, [ px + (k % 3 - 1) * 0.25, 0.85 + Math.floor(k / 3) * 0.2, pz + (k % 2) * 0.2 ], 0)
        else
            for(let k = 0; k < 5; k++)
                dish.cylinder(0.06, 0.06, 0.9, C.moss, [ px + (k - 2) * 0.12, 0.8, pz ], 4, [ Math.PI / 2, a + (k - 2) * 0.15, 0 ])
    }
    // carving knife and fork resting on the platter
    dish.box([ 2.6, 0.06, 0.32 ], C.stone, [ 0.5, 0.67, 4.2 ], [ 0, 0.2, 0 ])
    dish.box([ 1.2, 0.18, 0.28 ], C.wood, [ - 1.3, 0.67, 4.55 ], [ 0, 0.2, 0 ])
    dish.box([ 2.1, 0.08, 0.12 ], C.stone, [ 0.2, 0.67, - 4.3 ], [ 0, - 0.15, 0 ])
    for(const o of [ - 0.12, 0, 0.12 ])
        dish.box([ 0.6, 0.06, 0.05 ], C.stone, [ 1.5, 0.67, - 4.5 + o ], [ 0, - 0.15, 0 ])

    // gravy boat and cranberry bowl next to the platter
    const sides = new Model()
    sides.cylinder(0.9, 0.6, 0.7, C.snow, [ 0, 0, 0 ], 14)
    sides.cylinder(0.82, 0.82, 0.05, C.wood, [ 0, 0.68, 0 ], 14)           // gravy, a hair above the rim (equal heights flicker)
    sides.cone(0.3, 0.6, C.snow, [ 0.95, 0.45, 0 ], 6, [ 0, 0, - Math.PI / 2 ])
    sides.cylinder(0.75, 0.55, 0.6, C.gold, [ 0, 0, 2.2 ], 14)
    sides.cylinder(0.7, 0.7, 0.05, C.red, [ 0, 0.58, 2.2 ], 14)            // cranberry sauce, above the rim
    for(let k = 0; k < 8; k++)
        sides.sphere(0.13, C.red, [ (r() - 0.5) * 0.9, 0.66, 2.2 + (r() - 0.5) * 0.9 ], 0)

    // pumpkin pie with a fluted crust, a missing slice and whipped cream
    const pie = new Model()
    pie.cylinder(2.25, 1.95, 0.6, C.khaki, [ 0, 0, 0 ], 24)
    pie.cylinder(2.05, 2.05, 0.08, C.orange, [ 0, 0.6, 0 ], 24)
    for(let i = 0; i < 24; i++)
    {
        const a = i / 24 * Math.PI * 2
        pie.sphere(0.2, C.khaki, [ Math.cos(a) * 2.15, 0.65, Math.sin(a) * 2.15 ], 0)
    }
    for(let i = 0; i < 6; i++)
    {
        const a = i / 6 * Math.PI * 2 + 0.3
        pie.sphere(0.28, C.snow, [ Math.cos(a) * 1.3, 0.75, Math.sin(a) * 1.3 ], 1, [ 1, 0.7, 1 ])
        pie.cone(0.18, 0.3, C.snow, [ Math.cos(a) * 1.3, 0.9, Math.sin(a) * 1.3 ], 6)
    }
    // the slice, on its own plate
    pie.cylinder(0.9, 0.8, 0.1, C.snow, [ 3.2, 0, 0.5 ], 14)
    pie.box([ 1.1, 0.6, 0.7 ], C.orange, [ 3.2, 0.1, 0.5 ], [ 0, 0.4, 0 ])
    pie.box([ 0.35, 0.65, 0.75 ], C.khaki, [ 3.65, 0.1, 0.65 ], [ 0, 0.4, 0 ])

    sceneryNodes.push(scaleNode(fixedNode('turkeyDish', dish, [ x, y, z ], [
        { shape: 'tube', position: [ 0, 0.35, 0 ], radius: 6.3, height: 0.7 },
        { position: [ 0, 2.4, 0 ], size: [ 7.6, 3.6, 4.8 ] },
    ]), S))
    sceneryNodes.push(scaleNode(fixedNode('gravy', sides, [ x - 7.2 * S, ground(x - 7.2 * S, z - 1), z - 1 ], [ { shape: 'tube', position: [ 0, 0.35, 1.1 ], radius: 0.9, height: 0.7 } ]), S))
    sceneryNodes.push(scaleNode(fixedNode('pumpkinPie', pie, [ x + 12.7 * S, ground(x + 12.7 * S, z + 2), z + 2 ], [ { shape: 'tube', position: [ 0, 0.3, 0 ], radius: 2.2, height: 0.7 } ]), S))
    // sign
    const sign = new Model()
    sign.cylinder(0.12, 0.12, 2.4, C.wood, [ - 1.6, 0, 0 ], 6)
    sign.cylinder(0.12, 0.12, 2.4, C.wood, [ 1.6, 0, 0 ], 6)
    sign.box([ 4, 1.2, 0.2 ], C.orange, [ 0, 1.6, 0 ])
    sign.box([ 3.2, 0.2, 0.22 ], C.snow, [ 0, 2.25, 0 ])
    sign.box([ 2.4, 0.2, 0.22 ], C.snow, [ 0, 1.95, 0 ])
    // JAY ♥ JESSICA in big knockable blocks, north of the dish between the two dog houses
    sceneryNodes.push(...nameBlocks(ground, [ { text: 'JAY', color: C.sky }, { text: '♥', color: C.red }, { text: 'JESSICA', color: C.pink } ], x, z - 20))
}

// Dog houses: 小可's pink cottage and Dookie's Swiss chalet
for(const dog of dogsData)
{
    const { x, z, rotation } = dog.home
    const m = new Model()
    if(dog.id === 'xiaoke')
    {
        // 小可 (boy): navy cabin with a sky-blue roof, a bone sign, a little basketball hoop and his ball
        m.box([ 2.4, 1.6, 2.2 ], C.slate, [ 0, 0, 0 ])
        m.box([ 2.6, 0.2, 2.4 ], C.snow, [ 0, 0, 0 ])
        m.gable(2.8, 2.7, 1.2, C.sky, [ 0, 1.6, 0 ])
        m.box([ 2.9, 0.12, 0.2 ], C.snow, [ 0, 1.6, - 1.2 ])
        m.cbox([ 0.9, 1.0, 0.06 ], C.black, [ 0, 0.55, - 1.12 ]) // door hole
        // bone sign over the door
        m.cbox([ 0.9, 0.22, 0.08 ], C.snow, [ 0, 1.35, - 1.14 ])
        for(const x of [ - 0.45, 0.45 ])
            for(const y of [ - 0.08, 0.08 ])
                m.sphere(0.1, C.snow, [ x, 1.35 + y, - 1.15 ], 0)
        // basketball hoop on a pole beside the house, and a ball
        m.cylinder(0.05, 0.05, 2.2, C.slate, [ 1.7, 0, 0.6 ], 6)
        m.box([ 0.06, 0.5, 0.7 ], C.snow, [ 1.7, 2.0, 0.6 ])
        m.add(new THREE.TorusGeometry(0.18, 0.03, 4, 10), C.orange, [ 1.5, 2.05, 0.6 ], [ Math.PI / 2, 0, 0 ])
        m.sphere(0.22, C.orange, [ 1.5, 0.22, - 1.3 ], 1)
        // food bowl
        m.cylinder(0.35, 0.25, 0.2, C.sky, [ - 1.6, 0, - 1.2 ], 10)
        m.cylinder(0.28, 0.28, 0.05, C.wood, [ - 1.6, 0.18, - 1.2 ], 10)
    }
    else
    {
        // Dookie (girl): big Swiss chalet with a pink roof, a bow, heart window and flower boxes
        m.box([ 5, 3, 4.4 ], C.wood, [ 0, 0, 0 ])
        for(let i = 0; i < 6; i++)
            m.box([ 5.1, 0.12, 4.5 ], C.brick, [ 0, 0.3 + i * 0.48, 0 ])
        m.gable(5.8, 5.6, 2.2, C.pink, [ 0, 3, 0 ])
        m.cbox([ 2.0, 2.2, 0.08 ], C.black, [ 0, 1.1, - 2.21 ]) // arched door
        m.cylinder(1.0, 1.0, 0.08, C.black, [ 0, 2.2, - 2.21 ], 10, [ Math.PI / 2, 0, 0 ])
        // heart window in the gable
        m.sphere(0.32, C.blush, [ - 0.22, 3.75, - 2.25 ], 0)
        m.sphere(0.32, C.blush, [ 0.22, 3.75, - 2.25 ], 0)
        m.cbox([ 0.45, 0.45, 0.08 ], C.blush, [ 0, 3.5, - 2.25 ], [ 0, 0, Math.PI / 4 ])
        // big bow on the roof ridge
        m.cone(0.5, 0.9, C.pink, [ - 0.45, 4.9, - 2.4 ], 4, [ 0, 0, Math.PI / 2 ])
        m.cone(0.5, 0.9, C.pink, [ 0.45, 4.9, - 2.4 ], 4, [ 0, 0, - Math.PI / 2 ])
        m.sphere(0.22, C.pink, [ 0, 4.9, - 2.4 ], 0)
        // flower boxes under the side windows
        for(const x of [ - 1.8, 1.8 ])
        {
            m.cbox([ 0.8, 0.7, 0.08 ], C.cream, [ x, 1.7, - 2.22 ])
            m.box([ 1, 0.25, 0.35 ], C.brick, [ x, 1.15, - 2.35 ])
            for(let k = 0; k < 4; k++)
                m.sphere(0.13, [ C.pink, C.blush, C.snow, C.purple ][k], [ x - 0.35 + k * 0.23, 1.45, - 2.4 ], 0)
        }
        // giant pink bowl and a barrel
        m.cylinder(0.7, 0.5, 0.35, C.pink, [ 2.8, 0, - 2.2 ], 12)
        m.cylinder(0.6, 0.6, 0.06, C.wood, [ 2.8, 0.32, - 2.2 ], 12)
        m.cylinder(0.5, 0.55, 1.2, C.brick, [ - 3.1, 0, - 1.4 ], 10)
    }
    const size = dog.id === 'xiaoke' ? [ 2.6, 2.8, 2.4 ] : [ 5.2, 5.2, 4.6 ]
    sceneryNodes.push({ ...fixedNode(`dogHouse`, m, [ x, ground(x, z), z ], [ { position: [ 0, size[1] / 2, 0 ], size } ]), rotation: [ 0, rotation, 0 ] })
}
// Holiday lawns: little lit firs, snowmen, candy canes, gift piles and Thanksgiving harvest corners scattered over the grass
const holidaySpots = []
{
    const r = rng(1124)
    const m = new Model()
    const colliders = []
    const clearOfHouses = (x, z, gap) => footprints.every(([ hx, hz, w, d ]) => Math.abs(x - hx) > w / 2 + gap || Math.abs(z - hz) > d / 2 + gap)
    const rejects = {}
    const kinds = [ 'pine', 'pine', 'pine', 'harvest', 'harvest', 'snowman', 'gifts', 'canes', 'pumpkins' ]
    for(let i = 0; i < 12000 && holidaySpots.length < 110; i++)
    {
        const x = (r() - 0.5) * 176, z = (r() - 0.5) * 180
        const why = paved(x, z) > 0.05 ? 'paved' : !onLand(x, z) ? 'water' : excluded(x, z, 1) ? 'excluded' : nearRoad(x, z, 2) ? 'road' : inSite(x, z, 2.5) ? 'site' : !clearOfHouses(x, z, 1.6) ? 'house' : null
        if(why) { rejects[why] = (rejects[why] || 0) + 1; continue }
        if(holidaySpots.some(([ hx, hz ]) => Math.hypot(hx - x, hz - z) < 5))
            continue
        const kind = kinds[holidaySpots.length % kinds.length]
        const y = ground(x, z), ry = r() * Math.PI * 2
        holidaySpots.push([ x, z ])
        if(kind === 'pine')
        {
            const s = 0.9 + r() * 0.7
            litPine(m, [ x, y, z ], s)
            colliders.push({ shape: 'tube', position: [ x, y + s, z ], radius: 0.5 * s, height: 2 * s })
            if(r() < 0.6) gifts(m, [ x + 0.9 * s, y, z + 0.3 ], ry, 0.7, i)
        }
        else if(kind === 'harvest')
        {
            harvest(m, [ x, y, z ], ry, 1.1)
            colliders.push({ shape: 'tube', position: [ x, y + 0.4, z ], radius: 0.7, height: 0.8 })
        }
        else if(kind === 'snowman')
        {
            snowman(m, [ x, y, z ], ry, 1.1)
            colliders.push({ shape: 'tube', position: [ x, y + 0.9, z ], radius: 0.45, height: 1.8 })
        }
        else if(kind === 'gifts')
            gifts(m, [ x, y, z ], ry, 1.2, i)
        else if(kind === 'canes')
            for(let k = 0; k < 5; k++)
                candyCane(m, [ x + Math.cos(ry) * (k - 2) * 0.9, ground(x + Math.cos(ry) * (k - 2) * 0.9, z - Math.sin(ry) * (k - 2) * 0.9), z - Math.sin(ry) * (k - 2) * 0.9 ], ry + (k % 2) * Math.PI, 1.1)
        else
            for(let k = 0; k < 6; k++)
            {
                const a = k / 6 * Math.PI * 2 + ry, rr = 0.5 + (k % 2) * 0.5
                pumpkin(m, [ x + Math.cos(a) * rr, ground(x + Math.cos(a) * rr, z + Math.sin(a) * rr), z + Math.sin(a) * rr ], 1 + (k % 3) * 0.35, [ C.orange, C.orange, C.gold, C.snow ][k % 4])
            }
    }
    sceneryNodes.push(fixedNode('holidayLawns', m, [ 0, 0, 0 ], colliders))
    console.log('holiday lawn props', holidaySpots.length, rejects)
}

// Parks dressed for the holidays: light canopies (four posts with fairy lights swagged between them and criss-crossing
// overhead, a lit tree with presents underneath) and extra lit Christmas trees around each park's lawns
{
    const r = rng(2412)
    const m = new Model()
    const colliders = []
    const clearOfHouses = (x, z, gap) => footprints.every(([ hx, hz, w, d ]) => Math.abs(x - hx) > w / 2 + gap || Math.abs(z - hz) > d / 2 + gap)
    const keepOut = [ [ - 73, - 8, - 43, 33 ], [ - 70, 41.5, - 32, 51 ] ]          // tennis courts, JAY ♥ JESSICA strip
    const placed = []
    const free = (x, z, d) => placed.every(([ px, pz ]) => Math.hypot(px - x, pz - z) > d) && holidaySpots.every(([ hx, hz ]) => Math.hypot(hx - x, hz - z) > 4)
    const ok = (x, z, radius) => onLand(x, z) && !nearRoad(x, z, radius + 0.6) && !inSite(x, z, radius + 0.8) && clearOfHouses(x, z, radius + 0.6)
        && !keepOut.some(([ x0, z0, x1, z1 ]) => x > x0 - radius && x < x1 + radius && z > z0 - radius && z < z1 + radius)
        && paved(x, z) < 0.05
    const inPark = (park, x, z) => park.rect
        ? x > park.rect[0] && x < park.rect[2] && z > park.rect[1] && z < park.rect[3]
        : ((x - park.ellipse[0]) / park.ellipse[2]) ** 2 + ((z - park.ellipse[1]) / park.ellipse[3]) ** 2 < 0.85
    const sample = (park) => park.rect
        ? [ park.rect[0] + r() * (park.rect[2] - park.rect[0]), park.rect[1] + r() * (park.rect[3] - park.rect[1]) ]
        : [ park.ellipse[0] + (r() * 2 - 1) * park.ellipse[2], park.ellipse[1] + (r() * 2 - 1) * park.ellipse[3] ]
    const canopy = (x, z) =>
    {
        const a = r() * Math.PI, half = 2.2
        const corners = [ [ - 1, - 1 ], [ 1, - 1 ], [ 1, 1 ], [ - 1, 1 ] ].map(([ u, v ]) =>
        {
            const px = x + (u * Math.cos(a) - v * Math.sin(a)) * half, pz = z + (u * Math.sin(a) + v * Math.cos(a)) * half
            return [ px, ground(px, pz), pz ]
        })
        for(const [ px, py, pz ] of corners)
        {
            m.cylinder(0.07, 0.09, 2.7, C.wood, [ px, py, pz ], 6)
            m.sphere(0.12, C.gold, [ px, py + 2.75, pz ], 0)
            wreath(m, [ px, py + 2.0, pz ], a, 0.6)
            colliders.push({ shape: 'tube', position: [ px, py + 1.35, pz ], radius: 0.1, height: 2.7 })
        }
        const top = (c) => [ c[0], c[1] + 2.6, c[2] ]
        for(let i = 0; i < 4; i++)
            lightString(m, top(corners[i]), top(corners[(i + 1) % 4]), 0.3, 0.45, 0.09)
        lightString(m, top(corners[0]), top(corners[2]), 0.3, 0.8, 0.09)
        lightString(m, top(corners[1]), top(corners[3]), 0.3, 0.8, 0.09)
        const y = ground(x, z)
        litPine(m, [ x, y, z ], 0.85)
        gifts(m, [ x + 0.8, y, z + 0.4 ], a, 0.6, placed.length)
        colliders.push({ shape: 'tube', position: [ x, y + 0.9, z ], radius: 0.45, height: 1.8 })
    }
    const plan = [ [ 0, 5, 6 ], [ 1, 1, 2 ], [ 2, 2, 3 ], [ 3, 3, 4 ], [ 5, 1, 3 ], [ 6, 2, 4 ], [ 7, 1, 2 ] ]   // [park index, canopies, extra trees]
    let canopies = 0, trees = 0
    for(const [ index, nCanopy, nTree ] of plan)
    {
        const park = Layout.parks[index]
        let c = 0, t = 0
        for(let i = 0; i < 4000 && (c < nCanopy || t < nTree); i++)
        {
            const [ x, z ] = sample(park)
            if(!inPark(park, x, z))
                continue
            if(c < nCanopy && ok(x, z, 3) && free(x, z, 8))
            {
                canopy(x, z)
                placed.push([ x, z ])
                c++
                continue
            }
            if(c >= nCanopy && t < nTree && ok(x, z, 1.2) && free(x, z, 4))
            {
                const s = 1.1 + r() * 0.5, y = ground(x, z)
                litPine(m, [ x, y, z ], s)
                colliders.push({ shape: 'tube', position: [ x, y + s, z ], radius: 0.5 * s, height: 2 * s })
                placed.push([ x, z ])
                t++
            }
        }
        canopies += c
        trees += t
    }
    holidaySpots.push(...placed)
    sceneryNodes.push(fixedNode('parkLights', m, [ 0, 0, 0 ], colliders))
    console.log('park canopies', canopies, 'park trees', trees)
}

await writeGlb(out('static/scenery/scenery.glb'), sceneryNodes, { worldScale: W })
console.log('scenery ok')

/* ---------------- Respawns ---------------- */
{
    const nodes = Layout.stops.map(s => ({
        name: `respawn${s.id.charAt(0).toUpperCase()}${s.id.slice(1)}`,
        position: [ s.respawn.x, round(Math.max(ground(s.respawn.x, s.respawn.z), 0)), s.respawn.z ],
        rotation: [ 0, s.respawn.rotation, 0 ],
    }))
    // extra teleport point: the giant Thanksgiving turkey (just north of the dish, facing it)
    nodes.push({ name: 'respawnTurkey', position: [ - 52, round(Math.max(ground(- 52, 55.8), 0)), 55.8 ], rotation: [ 0, Math.PI, 0 ] }) // on the hilltop, by the dish
    await writeGlb(out('static/respawns/respawnsReferences.glb'), nodes, { worldScale: W })
}
console.log('respawns ok')

/* ---------------- Placements (vegetation + props) ---------------- */
{
    const r = rng(2026)
    const placements = { redwoods: [], oakTrees: [], birchTrees: [], cherryTrees: [], bushes: [], flowers: [], benches: [], lanterns: [], poleLights: [], explosiveCrates: [], bricks: [], fences: [], tornado: [] }
    // props keep their real size: world positions, offsets in world units
    const push = (list, x, z, dy = 0, rotation = 0, scale = 1) => list.push([ round(x * W), round(groundWorld(x, z) + dy), round(z * W), round(rotation), round(scale) ])
    const trees = []
    trees.push(...holidaySpots)
    const free = (x, z, d) => trees.every(([ tx, tz ]) => Math.hypot(tx - x, tz - z) > d)

    for(let i = 0; i < 9000 && trees.length < 230; i++)
    {
        const x = (r() - 0.5) * 180, z = (r() - 0.5) * 184
        const g = grassy(x, z)
        if(g < 0.5 || paved(x, z) > 0.05 || !onLand(x, z) || excluded(x, z, 1) || !free(x, z, 3.2) || nearRoad(x, z, 1.8) || inSite(x, z, 2))
            continue
        trees.push([ x, z ])
        const k = r()
        const list = k < 0.3 ? placements.oakTrees : k < 0.65 ? placements.birchTrees : placements.cherryTrees
        push(list, x, z, - 0.05, r() * Math.PI * 2, 0.8 + r() * 0.4)
    }
    for(let i = 0; i < 6000 && placements.bushes.length < 140; i++)
    {
        const x = (r() - 0.5) * 180, z = (r() - 0.5) * 184
        if(grassy(x, z) < 0.25 || paved(x, z) > 0.1 || !onLand(x, z) || excluded(x, z, - 2) || !free(x, z, 2.2) || nearRoad(x, z, 1.5) || inSite(x, z, 1.5))
            continue
        trees.push([ x, z ])
        push(placements.bushes, x, z, 1.1, r() * Math.PI * 2, 0.7 + r() * 0.5)
    }
    for(let i = 0; i < 4000 && placements.flowers.length < 220; i++)
    {
        const x = (r() - 0.5) * 180, z = (r() - 0.5) * 184
        if(grassy(x, z) < 0.35 || paved(x, z) > 0.1 || !onLand(x, z) || !free(x, z, 1.5) || nearRoad(x, z, 0.8) || inSite(x, z, 1))
            continue
        push(placements.flowers, x, z, 0.38)
    }
    // Muir Woods: tall redwoods (Bruno's tree model, scaled up, dark green)
    for(const [ dx, dz ] of [ [ - 5, - 3 ], [ - 1, - 5 ], [ 4, - 4 ], [ 6, 1 ], [ - 6, 2 ], [ 1, 4 ], [ - 3, 6 ], [ 7, 5 ], [ 9, - 1 ], [ - 8, - 2 ] ])
    {
        const muir = secrets.find(s => s.id === 'muirWoods').position
        const x = muir.x + dx * 1.2, z = muir.z + dz * 1.1
        if(onLand(x, z) && !nearRoad(x, z, 1.5))
            push(placements.redwoods, x, z, - 0.05, (dx * 7 + dz) % 6, 1.9 + ((dx + dz + 20) % 4) * 0.15)
    }

    // benches [x, z, facing]
    for(const [ x, z, ry ] of [ [ 6, 46, Math.PI * 0.8 ], [ 12, 47, Math.PI ], [ 2, 44, Math.PI * 0.7 ], [ - 27, 10, - Math.PI / 2 ], [ - 27, 17, - Math.PI / 2 ], [ - 60, - 91, 0 ], [ - 64, - 91, 0 ], [ 52, - 26, Math.PI / 2 ], [ 52, - 10, Math.PI / 2 ], [ - 36, - 28, Math.PI ] ])
        if(!nearRoad(x, z, 1.4) && !inSite(x, z, 1.2))
            push(placements.benches, x, z, 0.76, ry)

    // lanterns hanging over Grant Ave
    for(let z = - 9; z >= - 27; z -= 3)
        for(const x of [ 18.6, 29.4 ]) // along the shop fronts, out of the way
            push(placements.lanterns, x, z, 5.6)

    // street lights along the Embarcadero and Market
    for(const street of [ Layout.streets[0], Layout.streets[1] ])
    {
        const curve = new THREE.CatmullRomCurve3(street.points.map(([ x, z ]) => new THREE.Vector3(x, 0, z)))
        const count = Math.floor(curve.getLength() / 11)
        for(let i = 1; i < count; i++)
        {
            const p = curve.getPointAt(i / count)
            const t = curve.getTangentAt(i / count)
            const x = p.x + t.z * 4.2, z = p.z - t.x * 4.2
            if(!excluded(x, z, - 4) && onLand(x, z) && !nearRoad(x, z, 1.2) && !inSite(x, z, 1.2))
                push(placements.poleLights, x, z, 1.78)
        }
    }

    // explosive crates: SFO cargo, Pier 39 dock, stadium lot
    const stack = (x, z) =>
    {
        push(placements.explosiveCrates, x, z, 0.53)
        push(placements.explosiveCrates, x + 1.15, z, 0.53)
        push(placements.explosiveCrates, x + 0.57, z, 1.6)
    }

    // a brick wall at the stadium lot, made to be driven through
    for(let row = 0; row < 3; row++)
        for(let i = 0; i < 6; i++)
            push(placements.bricks, 30 + i * 1.6 + (row % 2) * 0.8, 84, 0.38 + row * 0.75)

    // fences along the Ferry Building waterfront
    for(let z = - 30; z <= - 6; z += 2.2)
        push(placements.fences, 65.5, z, 1.05, Math.PI / 2)

    // tornado path: a loop around the city
    for(let i = 0; i < 10; i++)
    {
        const a = i / 10 * Math.PI * 2
        placements.tornado.push([ round(Math.cos(a) * 55 * W), 3.27, round(Math.sin(a) * 55 * W) ])
    }

    // nothing may stand on a street: drop any tree, bush or prop whose trunk ends up on one
    for(const key of [ 'redwoods', 'oakTrees', 'birchTrees', 'cherryTrees', 'bushes', 'benches', 'lanterns', 'poleLights' ])
    {
        // keep the JAY ♥ JESSICA blocks clear
        placements[key] = placements[key].filter(p => !(p[0] > - 70 && p[0] < - 32 && p[2] > 41.5 && p[2] < 51))
        const before = placements[key].length
        placements[key] = placements[key].filter(p => !nearRoad(p[0] ?? p.position?.[0] ?? p.x, p[2] ?? p.position?.[2] ?? p.z, key === 'lanterns' ? - 10 : 0.6))
        if(placements[key].length !== before)
            console.log('removed from roads:', key, before - placements[key].length)
    }
    fs.writeFileSync(out('sources/data/placements.json'), JSON.stringify(placements))
    console.log('placements', Object.fromEntries(Object.entries(placements).map(([ k, v ]) => [ k, v.length ])))
}

/* ---------------- Dogs (rigs) ---------------- */
fs.mkdirSync(out('static/dogs'), { recursive: true })
await writeGlb(out('static/dogs/dogs.glb'), dogNodes())
console.log('dogs ok')

/* ---------------- Map images (4096, vector) ---------------- */
{
    const size = 4096
    const k = size / Layout.SIZE
    const P = ([ x, z ]) => `${((x + Layout.HALF) * k).toFixed(1)},${((z + Layout.HALF) * k).toFixed(1)}`
    const poly = (points) => `M${points.map(P).join('L')}Z`
    const line = (points) => {
        const curve = new THREE.CatmullRomCurve3(points.map(([ x, z ]) => new THREE.Vector3(x, 0, z)), false, 'centripetal')
        return `M${curve.getSpacedPoints(Math.ceil(curve.getLength())).map(p => P([ p.x, p.z ])).join('L')}`
    }
    const shape = (s, fill, extra = '') =>
    {
        if(Array.isArray(s)) return `<path d="${poly(s)}" fill="${fill}" ${extra}/>`
        if(s.ellipse) { const [ x, z, rx, rz ] = s.ellipse; const [ cx, cy ] = P([ x, z ]).split(','); return `<ellipse cx="${cx}" cy="${cy}" rx="${rx * k}" ry="${rz * k}" fill="${fill}" ${extra}/>` }
        if(s.rect) { const [ x0, z0, x1, z1 ] = s.rect; const [ px, py ] = P([ x0, z0 ]).split(','); return `<rect x="${px}" y="${py}" width="${(x1 - x0) * k}" height="${(z1 - z0) * k}" rx="${2 * k}" fill="${fill}" ${extra}/>` }
        return ''
    }
    const lands = [ Layout.land.city, Layout.land.marin, Layout.land.alcatraz ]

    // hill shading layer from the height raster
    const shadeSize = 1024
    const shade = Buffer.alloc(shadeSize * shadeSize)
    for(let py = 0; py < shadeSize; py++)
        for(let px = 0; px < shadeSize; px++)
        {
            const x = (px + 0.5) / shadeSize * Layout.SIZE - Layout.HALF
            const z = (py + 0.5) / shadeSize * Layout.SIZE - Layout.HALF
            const e = 0.6
            const dx = sample(R.height, x + e, z) - sample(R.height, x - e, z)
            const dz = sample(R.height, x, z + e) - sample(R.height, x, z - e)
            shade[py * shadeSize + px] = Math.max(0, Math.min(255, 128 + (- dx - dz) * 70 + sample(R.height, x, z) * 6))
        }
    const shadePng = await sharp(shade, { raw: { width: shadeSize, height: shadeSize, channels: 1 } }).resize(size, size, { kernel: 'cubic' }).png().toBuffer()

    const themes = {
        day: { deep: '#24304f', shore: '#5bc2b9', sand: '#86c24c', grass: '#5f9e35', paving: '#e6dccb', road: '#3a3140', mark: '#fff2e8', building: '#c98d6d', downtown: '#9a8aa3', landmark: '#ec8a5c', bridge: '#ec3f1c', label: '#ffffff', pin: '#ec3f1c' },
        night: { deep: '#111733', shore: '#2b6a7a', sand: '#3f6a2c', grass: '#2f5222', paving: '#7d7468', road: '#221c2a', mark: '#ffd88a', building: '#6d4c48', downtown: '#5a5070', landmark: '#a85a3c', bridge: '#ff6a3a', label: '#ffe9c8', pin: '#ff6a3a' },
    }
    for(const [ name, t ] of Object.entries(themes))
    {
        let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">`
        svg += `<defs><filter id="blur" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="${3 * k}"/></filter><filter id="soft"><feGaussianBlur stdDeviation="${0.6 * k}"/></filter></defs>`
        svg += `<rect width="100%" height="100%" fill="${t.deep}"/>`
        svg += `<g filter="url(#blur)">${lands.map(l => shape(l, 'none', `stroke="${t.shore}" stroke-width="${7 * k}" stroke-linejoin="round"`)).join('')}</g>`
        svg += lands.map(l => shape(l, t.sand, `stroke="${t.sand}" stroke-width="${1.5 * k}" stroke-linejoin="round"`)).join('')
        svg += `<path d="${line(Layout.boardwalk.points)}" fill="none" stroke="#b8875a" stroke-width="${Layout.boardwalk.width * k}" stroke-linecap="butt"/>`
        svg += Layout.sandbars.map(b => `<path d="${line(b.points)}" fill="none" stroke="${t.shore}" stroke-width="${b.width * k}" stroke-linecap="round"/>`).join('')
        svg += `<g filter="url(#soft)">${Layout.parks.map(p => shape(p, t.grass)).join('')}</g>`
        svg += Layout.ponds.map(p => shape(p, t.deep, `stroke="${t.shore}" stroke-width="${1 * k}"`)).join('')
        svg += Layout.plazas.map(p => shape(p, t.paving)).join('')
        // streets: paving, asphalt, markings
        for(const street of Layout.streets)
            svg += `<path d="${line(street.points)}" fill="none" stroke="${t.paving}" stroke-width="${street.width * k}" stroke-linecap="round" stroke-linejoin="round"/>`
        for(const fillet of streetFillets)
            svg += `<path d="M${fillet.points.map(p => P([ p.x, p.z ])).join('L')}" fill="none" stroke="${t.paving}" stroke-width="${fillet.width * k}" stroke-linecap="round" stroke-linejoin="round"/>`
        for(const fillet of streetFillets)
            svg += `<path d="M${fillet.points.map(p => P([ p.x, p.z ])).join('L')}" fill="none" stroke="${t.road}" stroke-width="${fillet.width * 0.8 * k}" stroke-linecap="round" stroke-linejoin="round"/>`
        for(const street of Layout.streets)
            svg += `<path d="${line(street.points)}" fill="none" stroke="${t.road}" stroke-width="${street.width * (street.highway ? 0.9 : 0.8) * k}" stroke-linecap="round" stroke-linejoin="round"/>`
        for(const street of Layout.streets)
            svg += street.highway
                ? `<path d="${line(street.points)}" fill="none" stroke="#e4a90c" stroke-width="${0.3 * k}"/>`
                : `<path d="${line(street.points)}" fill="none" stroke="${t.mark}" stroke-width="${0.16 * k}" stroke-dasharray="${1.1 * k},${1.3 * k}" opacity="0.8"/>`
        // Lombard zigzag
        svg += `<path d="M${lombardPoints().map(P).join('L')}" fill="none" stroke="${t.paving}" stroke-width="${(Layout.lombard.lane + 0.5) * k}" stroke-linejoin="round" stroke-linecap="round"/>`
        svg += `<path d="M${lombardPoints().map(P).join('L')}" fill="none" stroke="${name === 'day' ? '#b4533a' : '#6e3428'}" stroke-width="${Layout.lombard.lane * k}" stroke-linejoin="round" stroke-linecap="round"/>`
        // buildings
        svg += footprints.map(([ x, z, w, d, dt ]) => { const [ px, py ] = P([ x - w / 2, z - d / 2 ]).split(','); return `<rect x="${px}" y="${py}" width="${w * k}" height="${d * k}" fill="${dt ? t.downtown : t.building}" stroke="rgba(0,0,0,0.25)" stroke-width="${0.15 * k}"/>` }).join('')
        // Golden Gate Bridge + Bay Bridge
        svg += `<path d="M${P([ - 62, - 46 ])}L${P([ - 62, - 78 ])}" stroke="${t.bridge}" stroke-width="${6.8 * k}"/>`
        svg += `<path d="M${P([ - 62, - 46 ])}L${P([ - 62, - 78 ])}" stroke="${t.road}" stroke-width="${5 * k}"/>`
        for(const z of [ - 57.5, - 69.5 ])
            svg += `<rect x="${(- 66 + Layout.HALF) * k}" y="${(z - 0.9 + Layout.HALF) * k}" width="${8 * k}" height="${1.8 * k}" fill="${t.bridge}"/>`
        svg += `<path d="M${P([ 64, - 6 ])}L${P([ 96, - 6 ])}" stroke="#b8b2b8" stroke-width="${3.6 * k}" opacity="0.8"/>`
        // landmarks (solid parts of every site)
        svg += siteFootprints.map(([ fx, fz, hx, hz, angle ]) =>
        {
            const [ px, py ] = P([ fx, fz ]).split(',').map(Number)
            return `<rect x="${px - hx * k}" y="${py - hz * k}" width="${hx * 2 * k}" height="${hz * 2 * k}" fill="${t.landmark}" stroke="rgba(0,0,0,0.3)" stroke-width="${0.15 * k}" transform="rotate(${(- angle * 180 / Math.PI).toFixed(2)} ${px} ${py})"/>`
        }).join('')
        // turkey dish and dog houses
        {
            const [ tx, ty ] = P([ turkeyData.x, turkeyData.z ]).split(',').map(Number)
            svg += `<circle cx="${tx}" cy="${ty}" r="${9.6 * k}" fill="#fff2e8" stroke="#e4a90c" stroke-width="${0.5 * k}"/>`
            svg += `<ellipse cx="${tx}" cy="${ty}" rx="${5.7 * k}" ry="${4 * k}" fill="#b36d45"/>`
            for(const dog of dogsData)
            {
                const [ hx, hy ] = P([ dog.home.x, dog.home.z ]).split(',').map(Number)
                const s2 = (dog.id === 'xiaoke' ? 1.3 : 2.6) * k
                svg += `<rect x="${hx - s2}" y="${hy - s2}" width="${s2 * 2}" height="${s2 * 2}" rx="${0.4 * k}" fill="${dog.id === 'xiaoke' ? '#2f7fe0' : '#ff6fae'}" stroke="#fff2e8" stroke-width="${0.3 * k}"/>`
            }
        }
        // stop markers with numbers
        for(const stop of Layout.stops)
        {
            const [ cx, cy ] = P([ stop.position.x, stop.position.z ]).split(',').map(Number)
            svg += `<circle cx="${cx}" cy="${cy}" r="${stop.radius * k}" fill="${t.pin}" opacity="0.12" stroke="${t.pin}" stroke-width="${0.3 * k}" stroke-dasharray="${1 * k},${0.8 * k}"/>`
        }
        svg += `</svg>`

        const base = await sharp(Buffer.from(svg), { limitInputPixels: false }).png().toBuffer()
        const image = sharp(base).composite([ { input: shadePng, blend: 'overlay' } ])
        const png = await image.png({ compressionLevel: 9 }).toBuffer()
        await sharp(png).webp({ quality: 88 }).toFile(out(`static/ui/map/map-${name}.webp`))
    }
    console.log('map ok', size)
}
