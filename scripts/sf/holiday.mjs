/**
 * Holiday decorations: small Christmas and Thanksgiving pieces shared by houses, yards, lawns and the landmark sites.
 * Everything is in design units, built around the origin (y = 0 is the ground).
 */
import * as THREE from 'three'
import { Model, C } from './kit.mjs'

/** one fairy light bulb (cheap octahedron; colour is picked by the palette, see gltf.mjs) */
export function bulb(m, position, radius = 0.1)
{
    return m.add(new THREE.OctahedronGeometry(radius, 0), C.fairy, position)
}

/** a sagging string of fairy lights between two points */
export function lightString(m, a, b, spacing = 0.34, sag = 0.12, radius = 0.1)
{
    const length = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2])
    const n = Math.max(1, Math.round(length / spacing))
    for(let i = 0; i <= n; i++)
    {
        const t = i / n
        bulb(m, [ a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - Math.sin(t * Math.PI) * sag, a[2] + (b[2] - a[2]) * t ], radius)
    }
    return n + 1
}

/** a little fir with a spiral of lights and a gold star */
export function litPine(m, [ x, y, z ], s = 1)
{
    m.cylinder(0.1 * s, 0.13 * s, 0.4 * s, C.wood, [ x, y, z ], 6)
    for(let i = 0; i < 3; i++)
        m.cone((0.85 - i * 0.22) * s, (1.0 - i * 0.1) * s, i % 2 ? C.scallion : C.leaf, [ x, y + (0.35 + i * 0.55) * s, z ], 8)
    for(let k = 0; k < 16; k++)
    {
        const t = k / 16, h = 0.45 + t * 1.45, rr = (0.82 - t * 0.68) * s
        bulb(m, [ x + Math.cos(t * 13) * rr, y + h * s, z + Math.sin(t * 13) * rr ], 0.075 * s)
    }
    m.add(new THREE.OctahedronGeometry(0.17 * s, 0), C.gold, [ x, y + 2.15 * s, z ], [ 0, 0, Math.PI / 4 ])
}

/** red and white striped candy cane */
export function candyCane(m, [ x, y, z ], ry = 0, s = 1)
{
    for(let i = 0; i < 6; i++)
        m.cylinder(0.06 * s, 0.06 * s, 0.18 * s, i % 2 ? C.snow : C.red, [ x, y + i * 0.18 * s, z ], 6)
    const hook = new THREE.TorusGeometry(0.17 * s, 0.06 * s, 4, 6, Math.PI)
    m.add(hook, C.red, [ x + Math.cos(ry) * 0.17 * s, y + 1.08 * s, z - Math.sin(ry) * 0.17 * s ], [ 0, ry, 0 ])
}

/** stacked gift boxes with ribbons */
export function gifts(m, [ x, y, z ], ry = 0, s = 1, seed = 0)
{
    const colors = [ C.red, C.sky, C.gold, C.pink, C.leaf, C.snow, C.purple ]
    const ribbons = [ C.gold, C.snow, C.red ]
    const boxes = [ [ 0, 0, 0.46 ], [ 0.45, 0.1, 0.34 ], [ 0.08, 0.46, 0.28 ] ]
    boxes.forEach(([ ox, oy, size ], i) =>
    {
        const px = x + (Math.cos(ry) * ox) * s, pz = z - (Math.sin(ry) * ox) * s, py = y + (i === 2 ? 0.46 : 0) * s
        const sz = size * s
        m.box([ sz, sz, sz ], colors[(seed + i * 3) % colors.length], [ px, py, pz ], [ 0, ry + i * 0.4, 0 ])
        m.box([ sz + 0.02, sz + 0.01, 0.06 * s ], ribbons[(seed + i) % 3], [ px, py, pz ], [ 0, ry + i * 0.4, 0 ])
        m.box([ 0.06 * s, sz + 0.01, sz + 0.02 ], ribbons[(seed + i) % 3], [ px, py, pz ], [ 0, ry + i * 0.4, 0 ])
    })
}

/** snowman with a top hat, carrot nose and red scarf */
export function snowman(m, [ x, y, z ], ry = 0, s = 1)
{
    m.sphere(0.42 * s, C.snow, [ x, y + 0.38 * s, z ], 1)
    m.sphere(0.31 * s, C.snow, [ x, y + 0.98 * s, z ], 1)
    m.sphere(0.22 * s, C.snow, [ x, y + 1.42 * s, z ], 1)
    const fx = Math.sin(ry), fz = Math.cos(ry)
    m.cylinder(0.25 * s, 0.25 * s, 0.1 * s, C.red, [ x, y + 1.17 * s, z ], 8)           // scarf
    m.cbox([ 0.1 * s, 0.32 * s, 0.05 * s ], C.red, [ x + fx * 0.22 * s + fz * 0.12 * s, y + 1.05 * s, z + fz * 0.22 * s - fx * 0.12 * s ], [ 0, ry, 0.2 ])
    m.cone(0.045 * s, 0.24 * s, C.orange, [ x + fx * 0.2 * s, y + 1.44 * s, z + fz * 0.2 * s ], 5, [ Math.PI / 2, ry, 0 ])
    for(const e of [ - 1, 1 ])
        m.sphere(0.03 * s, C.black, [ x + fx * 0.19 * s + fz * e * 0.08 * s, y + 1.5 * s, z + fz * 0.19 * s - fx * e * 0.08 * s ], 0)
    for(const b of [ 0.85, 1.0 ])
        m.sphere(0.035 * s, C.black, [ x + fx * 0.3 * s, y + b * s, z + fz * 0.3 * s ], 0)
    m.cylinder(0.24 * s, 0.24 * s, 0.03 * s, C.black, [ x, y + 1.6 * s, z ], 10)          // hat
    m.cylinder(0.15 * s, 0.15 * s, 0.3 * s, C.black, [ x, y + 1.6 * s, z ], 10)
    m.cylinder(0.155 * s, 0.155 * s, 0.06 * s, C.red, [ x, y + 1.64 * s, z ], 10)
    for(const e of [ - 1, 1 ])                                                               // twig arms
        m.beam([ x + fz * e * 0.28 * s, y + 1.0 * s, z - fx * e * 0.28 * s ], [ x + fz * e * 0.62 * s, y + 1.25 * s, z - fx * e * 0.62 * s ], 0.04 * s, C.wood)
}

/** a pumpkin: ribbed (a ring of squashed spheres) with a stem */
export function pumpkin(m, [ x, y, z ], s = 1, color = C.orange)
{
    for(let i = 0; i < 4; i++)
    {
        const a = i / 4 * Math.PI * 2
        m.sphere(0.2 * s, color, [ x + Math.cos(a) * 0.1 * s, y + 0.17 * s, z + Math.sin(a) * 0.1 * s ], 0, [ 0.85, 0.8, 0.85 ])
    }
    m.cylinder(0.03 * s, 0.045 * s, 0.14 * s, C.olive, [ x, y + 0.3 * s, z ], 5)
}

/** Thanksgiving harvest corner: hay bale, pumpkins and corn stalks */
export function harvest(m, [ x, y, z ], ry = 0, s = 1)
{
    const ax = Math.cos(ry), az = - Math.sin(ry)
    m.box([ 0.9 * s, 0.45 * s, 0.5 * s ], C.khaki, [ x, y, z ], [ 0, ry, 0 ])
    m.box([ 0.92 * s, 0.05 * s, 0.52 * s ], C.gold, [ x, y + 0.2 * s, z ], [ 0, ry, 0 ])
    pumpkin(m, [ x + ax * 0.2 * s, y + 0.45 * s, z + az * 0.2 * s ], 0.9 * s)
    pumpkin(m, [ x - ax * 0.6 * s, y, z - az * 0.6 * s ], 1.2 * s)
    pumpkin(m, [ x + ax * 0.65 * s, y, z + az * 0.65 * s ], 0.8 * s, C.gold)
    pumpkin(m, [ x - ax * 0.25 * s + az * 0.4 * s, y + 0.45 * s, z - az * 0.25 * s - ax * 0.4 * s ], 0.6 * s, C.snow)
    for(const e of [ - 1, 1 ])                                                               // corn stalk bundles
    {
        const cx = x + ax * e * 0.55 * s - az * 0.32 * s, cz = z + az * e * 0.55 * s + ax * 0.32 * s
        for(let k = 0; k < 4; k++)
            m.cone(0.08 * s, 1.3 * s, k % 2 ? C.khaki : C.gold, [ cx + Math.cos(k * 1.6) * 0.06 * s, y, cz + Math.sin(k * 1.6) * 0.06 * s ], 4, [ Math.cos(k * 1.6) * 0.12, 0, Math.sin(k * 1.6) * 0.12 ])
        m.cylinder(0.11 * s, 0.11 * s, 0.07 * s, C.orange, [ cx, y + 0.5 * s, cz ], 6)
    }
}

/** a wreath with a red bow, facing along +z (rotate with ry) */
export function wreath(m, [ x, y, z ], ry = 0, s = 1)
{
    m.add(new THREE.TorusGeometry(0.24 * s, 0.085 * s, 4, 10), C.moss, [ x, y, z ], [ 0, ry, 0 ])
    for(let i = 0; i < 4; i++)
    {
        const a = i / 4 * Math.PI * 2
        m.sphere(0.04 * s, C.red, [ x + Math.cos(ry) * Math.cos(a) * 0.24 * s, y + Math.sin(a) * 0.24 * s, z - Math.sin(ry) * Math.cos(a) * 0.24 * s ], 0)
    }
    m.cbox([ 0.2 * s, 0.13 * s, 0.07 * s ], C.red, [ x, y - 0.22 * s, z ], [ 0, ry, 0 ])
}
