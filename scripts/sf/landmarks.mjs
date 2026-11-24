/**
 * The 13 stop landmarks.
 * Each builder receives a context and returns children for the stop's area node.
 * Positions given to ctx.at() are WORLD x/z; it returns the area-local position resting on the ground.
 */
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { Model, C, meshNode, fixedNode, dynamicNode, kinematicNode, refNode, rng } from './kit.mjs'
import * as Layout from './layout.mjs'
import { bulb, lightString, litPine, wreath } from './holiday.mjs'

/* ---------- shared pieces ---------- */

export function palmTree(height = 6, lean = 0.12)
{
    const m = new Model()
    const r = rng(Math.round(height * 1000))

    // trunk: tapered rings, slight curve
    const segments = 7
    let x = 0, y = 0
    for(let i = 0; i < segments; i++)
    {
        const h = height / segments
        const radius = 0.3 - i * 0.022
        const tilt = - lean * (0.4 + i / segments)
        m.cylinder(radius * 0.92, radius, h + 0.05, C.wood, [ x, y, 0 ], 7, [ 0, 0, tilt ])
        m.cylinder(radius * 1.08, radius * 1.08, 0.12, C.khaki, [ x + Math.sin(- tilt) * h * 0.95, y + Math.cos(tilt) * h * 0.95, 0 ], 7, [ 0, 0, tilt ])
        x += Math.sin(- tilt) * h
        y += Math.cos(tilt) * h
    }
    const top = new THREE.Vector3(x, y, 0)
    m.sphere(0.38, C.olive, [ x, y + 0.05, 0 ], 1, [ 1, 0.8, 1 ])

    // dates hanging under the crown
    for(let i = 0; i < 6; i++)
    {
        const a = i / 6 * Math.PI * 2
        m.sphere(0.14, i % 2 ? C.gold : C.orange, [ x + Math.cos(a) * 0.32, y - 0.25, Math.sin(a) * 0.32 ], 0)
    }

    // fronds: one continuous ribbon per frond, folded in a shallow V, arching up then drooping
    const fronds = 11
    for(let f = 0; f < fronds; f++)
    {
        const yaw = f / fronds * Math.PI * 2 + r() * 0.35
        const length = 2.4 + r() * 0.9
        const rise = 0.5 + (f % 3) * 0.2
        const steps = 8
        const dirX = Math.cos(yaw), dirZ = Math.sin(yaw)
        const sideX = - dirZ, sideZ = dirX
        const spine = []
        for(let k = 0; k <= steps; k++)
        {
            const t = k / steps
            const out = Math.sin(t * Math.PI * 0.5) * length
            const h = rise * Math.sin(t * Math.PI) - t * t * 1.5
            spine.push([ top.x + dirX * out, top.y + h, top.z + dirZ * out, 0.55 * Math.sin(Math.min(1, t * 3) * Math.PI * 0.5) * (1 - t * 0.85) + 0.02 ])
        }
        const verts = []
        const tri = (a, b, c) => verts.push(...a, ...b, ...c)
        for(let k = 0; k < steps; k++)
        {
            const [ ax, ay, az, aw ] = spine[k]
            const [ bx, by, bz, bw ] = spine[k + 1]
            const fold = 0.18 // leaflets droop to the sides
            const aL = [ ax + sideX * aw, ay - aw * fold, az + sideZ * aw ], aR = [ ax - sideX * aw, ay - aw * fold, az - sideZ * aw ]
            const bL = [ bx + sideX * bw, by - bw * fold, bz + sideZ * bw ], bR = [ bx - sideX * bw, by - bw * fold, bz - sideZ * bw ]
            const aC = [ ax, ay, az ], bC = [ bx, by, bz ]
            // top faces and bottom faces (seen from above and below)
            tri(aC, bL, aL); tri(aC, bC, bL); tri(aC, aR, bR); tri(aC, bR, bC)
            tri(aC, aL, bL); tri(aC, bL, bC); tri(aC, bR, aR); tri(aC, bC, bR)
        }
        const g = new THREE.BufferGeometry()
        g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3))
        m.parts.push({ geometry: g, color: f % 3 === 0 ? C.olive : f % 3 === 1 ? C.moss : C.sage, matrix: new THREE.Matrix4() })
    }
    return m
}

function victorian(width, height, depth, wall, trim, roof, seed, accent = C.red)
{
    // Queen Anne row house (front faces -x, width along z). Clean, symmetric, every window framed in trim:
    // garage / ground storey, two storey three sided bay on the left, porch + door + stoop on the right,
    // bracketed cornice, a steep front gable with fish-scale shingles, an attic window and a finial
    const m = new Model()
    const F = - depth / 2                     // front face x
    const ground = 0.9                        // raised ground storey
    const H = height
    // body
    m.box([ depth, H, width ], wall)
    m.box([ depth + 0.04, ground, width + 0.04 ], trim, [ 0, 0, 0 ])
    m.box([ depth + 0.08, 0.12, width + 0.08 ], accent, [ 0, ground, 0 ])
    // garage door under the bay, with panel lines
    const bayZ = - width * 0.22, bayW = width * 0.5
    m.cbox([ 0.04, ground * 0.8, bayW * 0.85 ], C.wood, [ F - 0.02, ground * 0.4, bayZ ])
    for(let k = 1; k < 4; k++)
        m.cbox([ 0.05, 0.03, bayW * 0.85 ], C.dark, [ F - 0.03, ground * 0.8 * k / 4, bayZ ])
    // framed window: trim surround, dark glass, sill, a little pediment
    const window = (x, y, z, w, h, ry = 0) =>
    {
        m.cbox([ 0.05, h + 0.16, w + 0.16 ], trim, [ x, y, z ], [ 0, ry, 0 ])
        m.cbox([ 0.06, h, w ], C.window, [ x - 0.01, y, z ], [ 0, ry, 0 ])
        m.cbox([ 0.07, 0.03, w * 0.04 + 0.02 ], trim, [ x - 0.02, y, z ], [ 0, ry, 0 ])          // mullion
        m.cbox([ 0.14, 0.06, w + 0.26 ], trim, [ x - 0.04, y - h / 2 - 0.1, z ], [ 0, ry, 0 ])   // sill
        m.cbox([ 0.12, 0.1, w + 0.3 ], accent, [ x - 0.03, y + h / 2 + 0.13, z ], [ 0, ry, 0 ])  // head
    }
    // the bay: front face + two angled sides, two storeys of tall windows
    const bayD = 0.55, bayTop = H - 0.25
    m.box([ bayD, bayTop - ground, bayW * 0.62 ], wall, [ F - bayD / 2, ground, bayZ ])
    for(const sgn of [ - 1, 1 ])
        m.box([ 0.08, bayTop - ground, bayD * 1.25 ], wall, [ F - bayD / 2 + 0.02, ground, bayZ + sgn * bayW * 0.39 ], [ 0, sgn * 0.75, 0 ])
    const storey = (bayTop - ground) / 2
    for(const k of [ 0, 1 ])
    {
        const y = ground + storey * (k + 0.5)
        window(F - bayD - 0.03, y, bayZ, bayW * 0.42, storey * 0.62)
        m.box([ bayD + 0.12, 0.1, bayW * 0.7 ], trim, [ F - bayD / 2, ground + storey * (k + 1) - 0.05, bayZ ])   // band
    }
    m.box([ bayD + 0.22, 0.16, bayW * 0.78 ], accent, [ F - bayD / 2, bayTop, bayZ ])
    // porch on the right: two slim columns, a little roof, door, stairs with railings
    const doorZ = width * 0.27
    m.cbox([ 0.06, 1.15, 0.62 ], accent, [ F - 0.03, ground + 0.58, doorZ ])
    m.cbox([ 0.07, 0.3, 0.5 ], trim, [ F - 0.04, ground + 1.32, doorZ ])                     // transom
    for(const dz of [ - 0.42, 0.42 ])
        m.cylinder(0.05, 0.05, 1.5, trim, [ F - 0.55, ground, doorZ + dz ], 6)
    m.box([ 0.75, 0.1, 1.05 ], trim, [ F - 0.32, ground + 1.5, doorZ ])
    m.box([ 0.75, 0.08, 1.05 ], wall, [ F - 0.32, ground - 0.02, doorZ ])
    for(let k = 0; k < 5; k++)
        m.box([ 0.24, ground - k * ground / 5, 0.9 ], C.stone, [ F - 0.7 - k * 0.24, 0, doorZ ])
    for(const dz of [ - 0.48, 0.48 ])
        m.beam([ F - 1.9, 0.75, doorZ + dz ], [ F - 0.6, ground + 0.62, doorZ + dz ], 0.05, trim)
    // upper window above the porch
    window(F - 0.03, ground + storey * 1.5, doorZ, width * 0.24, storey * 0.6)
    // bracketed cornice under the gable
    m.box([ depth + 0.3, 0.22, width + 0.24 ], trim, [ 0, H - 0.22, 0 ])
    for(let k = 0; k < 7; k++)
        m.cbox([ 0.16, 0.26, 0.09 ], accent, [ F - 0.12, H - 0.36, - width / 2 + 0.18 + k * (width - 0.36) / 6 ])
    for(let k = 0; k <= 12; k++)                                                                 // fairy lights along the gable
    {
        const t = k / 12, zz = - (width / 2 + 0.1) + t * (width + 0.2)
        m.sphere(0.09, C.fairy, [ F - 0.24, H + (1 - Math.abs(t - 0.5) * 2) * 1.9 - 0.05, zz ], 0)
    }
    // steep front gable: roof, a filled front triangle with fish-scale bands, attic window, finial
    const gh = 1.9
    m.gable(depth + 0.3, width + 0.24, gh, roof, [ 0.05, H, 0 ], [ 0, Math.PI / 2, 0 ])
    const tri = new THREE.Shape()
    tri.moveTo(- width / 2, 0); tri.lineTo(width / 2, 0); tri.lineTo(0, gh * 0.98); tri.closePath()
    m.add(new THREE.ShapeGeometry(tri), wall, [ F - 0.16, H, 0 ], [ 0, - Math.PI / 2, 0 ])
    for(let row = 0; row < 3; row++)
    {
        const y = H + 0.22 + row * 0.3, half = (width / 2) * (1 - (y - H) / gh) - 0.12
        for(let z = - half + 0.12; z <= half - 0.12; z += 0.2)
            m.cylinder(0.09, 0.09, 0.04, row % 2 ? trim : accent, [ F - 0.18, y, z ], 6, [ 0, 0, Math.PI / 2 ])
    }
    window(F - 0.18, H + gh * 0.55, 0, width * 0.2, gh * 0.24)
    for(const sgn of [ - 1, 1 ])                                                                  // bargeboards
        m.cbox([ 0.07, 0.12, Math.hypot(width / 2 + 0.12, gh) ], trim, [ F - 0.2, H + gh / 2, sgn * (width / 4 + 0.06) ], [ - sgn * Math.atan2(gh, width / 2 + 0.12), 0, 0 ])
    m.cylinder(0.035, 0.06, 0.5, trim, [ F - 0.1, H + gh, 0 ], 6)
    m.sphere(0.075, C.gold, [ F - 0.1, H + gh + 0.55, 0 ], 1)
    return m
}

function lampPost(height = 3)
{
    const m = new Model()
    m.cylinder(0.08, 0.1, height, C.dark, [ 0, 0, 0 ], 6)
    m.box([ 0.4, 0.4, 0.4 ], C.snow, [ 0, height, 0 ])
    return m
}

function sign(width, height, color, textColor)
{
    const m = new Model()
    m.cylinder(0.08, 0.08, height, C.dark, [ - width / 2 + 0.2, 0, 0 ], 6)
    m.cylinder(0.08, 0.08, height, C.dark, [ width / 2 - 0.2, 0, 0 ], 6)
    m.box([ width, 1, 0.15 ], color, [ 0, height - 1, 0 ])
    m.box([ width * 0.8, 0.12, 0.17 ], textColor, [ 0, height - 0.55, 0 ])
    m.box([ width * 0.6, 0.12, 0.17 ], textColor, [ 0, height - 0.8, 0 ])
    return m
}

/** Blocky letters for physical signs (dynamic, can be knocked over) */
const GLYPHS = {
    S: [ '###', '#..', '###', '..#', '###' ],
    F: [ '###', '#..', '##.', '#..', '#..' ],
    O: [ '###', '#.#', '#.#', '#.#', '###' ],
    '4': [ '#.#', '#.#', '###', '..#', '..#' ],
    '9': [ '###', '#.#', '###', '..#', '###' ],
    E: [ '###', '#..', '##.', '#..', '###' ],
    R: [ '##.', '#.#', '##.', '#.#', '#.#' ],
    J: [ '###', '..#', '..#', '#.#', '###' ],
    A: [ '###', '#.#', '###', '#.#', '#.#' ],
    Y: [ '#.#', '#.#', '###', '.#.', '.#.' ],
    I: [ '###', '.#.', '.#.', '.#.', '###' ],
    C: [ '###', '#..', '#..', '#..', '###' ],
    '♥': [ '.#.#.', '#####', '#####', '.###.', '..#..' ],
}

/** 3x5 pixel font for painted sign lettering (merged into a model, not physical) */
const FONT = {
    A: '###' + '#.#' + '###' + '#.#' + '#.#', B: '##.#.###.#.###.', D: '##.#.##.##.###.', G: '####..#.##.####', H: '#.#' + '#.#' + '###' + '#.#' + '#.#', K: '#.##.###.#.##.#',
    L: '#..#..#..#..###', M: '#.#' + '###' + '###' + '#.#' + '#.#', N: '##.#.##.##.##.#', P: '###' + '#.#' + '###' + '#..' + '#..', Q: '####.##.####..#', T: '###.#..#..#..#.',
    U: '#.##.##.##.####', V: '#.##.##.##.#.#.', W: '#.##.##.#####.#', X: '#.##.#.#.#.##.#', Z: '###..#.#.#..###',
    '0': '####.##.##.####', '1': '.#.##..#..#.###', '2': '###..#####..###', '3': '###..####..####', '5': '####..###..####',
    '6': '####..####.####', '7': '###..#..#..#..#', '8': '####.#####.####', "'": '.#.' + '.#.' + '...' + '...' + '...', '.': '...' + '...' + '...' + '...' + '.#.', '-': '......###......', ' ': '...............',
}
for(const [ k, v ] of Object.entries(FONT))
    FONT[k] = v.padEnd(15, '.')
for(const [ k, rows ] of Object.entries(GLYPHS))
    if(rows[0].length === 3 && !FONT[k])
        FONT[k] = rows.join('')
FONT.A = GLYPHS.A.join('')

/** Paint text into a model: centered on origin [x, y, z] (y = bottom of the letters), reading along +x, facing +z (or -z with back) */
export function pixelText(model, text, color, origin = [ 0, 0, 0 ], cell = 0.12, { depth = 0.04, back = false } = {})
{
    const chars = [ ...text.toUpperCase() ]
    const advance = cell * 4
    const width = chars.length * advance - cell
    chars.forEach((char, ci) =>
    {
        const glyph = FONT[char] || FONT[' ']
        for(let i = 0; i < 15; i++)
        {
            if(glyph[i] !== '#')
                continue
            const col = i % 3, row = Math.floor(i / 3)
            let x = - width / 2 + ci * advance + col * cell + cell / 2
            if(back)
                x = - x
            model.cbox([ cell, cell, depth ], color, [ origin[0] + x, origin[1] + (4 - row) * cell + cell / 2, origin[2] ])
        }
    })
    return width
}

function letter(char, color, cell = 0.4)
{
    const m = new Model()
    const rows = GLYPHS[char]
    rows.forEach((row, ri) =>
    {
        ;[ ...row ].forEach((c, ci) =>
        {
            if(c === '#')
                m.cbox([ cell, cell, cell * 1.2 ], color, [ (ci - (row.length - 1) / 2) * cell, (rows.length - 1 - ri) * cell + cell / 2, 0 ])
        })
    })
    return { model: m, width: rows[0].length * cell, height: rows.length * cell }
}

/** Knockable name blocks in world coordinates: [{ text, color }] laid out left to right, centered on x */
export function nameBlocks(groundAt, parts, centerX, z, cell = 0.6, gap = 0.5)
{
    const items = []
    for(const { text, color } of parts)
        for(const char of text)
            items.push({ char, color, ...letter(char, color, cell) })
    const total = items.reduce((sum, item) => sum + item.width, 0) + gap * (items.length - 1)
    let x = centerX - total / 2
    return items.map((item, i) =>
    {
        const px = x + item.width / 2
        x += item.width + gap
        return dynamicNode('nameBlock', item.model, [ px, groundAt(px, z) + 0.02, z ], [ { position: [ 0, item.height / 2, 0 ], size: [ item.width, item.height, cell * 1.2 ] } ], 0.3)
    })
}

function letters(ctx, text, color, startX, z, rotationY = 0, cell = 0.4, gap = 0.4)
{
    const nodes = []
    let offset = 0
    for(const char of text)
    {
        const { model, width, height } = letter(char, color, cell)
        const x = startX + offset * Math.cos(rotationY)
        const zz = z - offset * Math.sin(rotationY)
        nodes.push({
            ...dynamicNode(`refLetters${char}`, model, ctx.at(x, zz, 0.02), [ { position: [ 0, height / 2, 0 ], size: [ width, height, cell * 1.2 ] } ], 0.3),
            rotation: [ 0, rotationY, 0 ],
        })
        offset += width + gap
    }
    return nodes
}

/* ---------- stops ---------- */

export const builders = {}

/** 1. SFO */
/** EVA Air Boeing 787-10 Dreamliner (model space: nose at -z, span along x, y up) */
export function evaPlane()
{
    const m = new Model()
    const L = 13, R = 0.85, y0 = 1.75                    // fuselage length, radius, centerline height
    const white = C.snow, green = C.moss, dark = C.dark, orange = C.orange
    const along = (g) => g.rotateX(Math.PI / 2)            // cylinders along z
    // fuselage: white body, the dark green belly with an orange pinstripe
    m.add(along(new THREE.CylinderGeometry(R, R, L, 20)), white, [ 0, y0, 0 ])
    m.add(along(new THREE.CylinderGeometry(R * 1.005, R * 1.005, L, 20, 1, true, Math.PI * 0.62, Math.PI * 0.76)).rotateZ(Math.PI), green, [ 0, y0, 0 ])
    for(const side of [ - 1, 1 ])
        m.cbox([ 0.04, 0.07, L ], orange, [ side * R * 0.83, y0 - R * 0.52, 0 ], [ 0, 0, side * 0.55 ])
    // nose and tail cone
    m.sphere(R, white, [ 0, y0, - L / 2 ], 2, [ 1, 1, 1.5 ])
    m.add(along(new THREE.CylinderGeometry(0.2, R, 3.2, 20)).rotateX(Math.PI), white, [ 0, y0 + 0.25, L / 2 + 1.5 ], [ - 0.12, 0, 0 ])
    m.add(along(new THREE.CylinderGeometry(0.25, R * 1.005, 3.2, 20, 1, true, Math.PI * 0.62, Math.PI * 0.76)).rotateX(Math.PI).rotateZ(Math.PI), green, [ 0, y0 + 0.25, L / 2 + 1.5 ], [ - 0.12, 0, 0 ])
    // cockpit windows, cabin window rows, doors
    for(const side of [ - 1, 1 ])
    {
        m.cbox([ 0.05, 0.16, 0.42 ], dark, [ side * 0.42, y0 + 0.42, - L / 2 - 0.82 ], [ 0, side * 0.5, 0 ])
        for(let z = - L / 2 + 0.6; z < L / 2 - 0.3; z += 0.32)
            m.cbox([ 0.03, 0.1, 0.12 ], dark, [ side * (R + 0.005), y0 + 0.28, z ])
        for(const z of [ - L / 2 + 0.25, - 1.6, 1.8, L / 2 - 0.4 ])
            m.cbox([ 0.03, 0.42, 0.24 ], C.stone, [ side * (R + 0.01), y0 + 0.05, z ])
        // EVA AIR in green along the front of the fuselage
        const t = new Model()
        pixelText(t, 'EVA AIR', green, [ 0, 0, 0 ], 0.09, { depth: 0.03 })
        m.merge(t, [ side * (R * 0.93 + 0.02), y0 + 0.1, - L / 2 + 3.4 ], [ 0, side * Math.PI / 2, 0 ])
    }
    // wings: swept, slight dihedral, raked tips; flap fairings underneath
    const wing = new THREE.Shape()
    wing.moveTo(0, 0); wing.lineTo(7.2, 2.9); wing.lineTo(7.4, 3.5); wing.lineTo(6.8, 3.5); wing.lineTo(0, 2.6); wing.closePath()
    for(const side of [ - 1, 1 ])
    {
        const g = new THREE.ExtrudeGeometry(wing, { depth: 0.12, bevelEnabled: false }).rotateX(Math.PI / 2)
        if(side < 0) g.scale(- 1, 1, 1)
        m.add(g, white, [ side * 0.4, y0 - 0.45, - 1.6 ], [ 0, 0, side * 0.07 ])
        for(const d of [ 2, 3.6, 5.1 ])
            m.cbox([ 0.15, 0.18, 1.1 ], C.stone, [ side * (0.4 + d), y0 - 0.55 + d * 0.07, - 1.6 + d * 0.4 + 1.7 ])
        // GE engine nacelle with a dark intake and a chevron exhaust
        const ex = side * 2.7
        m.add(along(new THREE.CylinderGeometry(0.52, 0.46, 2.2, 18)), white, [ ex, y0 - 1.05, - 1.2 ])
        m.add(along(new THREE.CylinderGeometry(0.42, 0.42, 0.05, 18)), dark, [ ex, y0 - 1.05, - 2.3 ])
        m.add(along(new THREE.CylinderGeometry(0.3, 0.22, 0.6, 12)), C.stone, [ ex, y0 - 1.05, 0.15 ])
        m.cbox([ 0.12, 0.5, 1.2 ], white, [ ex, y0 - 0.65, - 0.9 ])                           // pylon
        // horizontal stabilizer
        const stab = new THREE.Shape()
        stab.moveTo(0, 0); stab.lineTo(2.6, 1.3); stab.lineTo(2.6, 1.8); stab.lineTo(0, 1.4); stab.closePath()
        const sg = new THREE.ExtrudeGeometry(stab, { depth: 0.08, bevelEnabled: false }).rotateX(Math.PI / 2)
        if(side < 0) sg.scale(- 1, 1, 1)
        m.add(sg, white, [ side * 0.2, y0 + 0.2, L / 2 + 0.8 ], [ 0, 0, side * 0.1 ])
    }
    // the green tail with the EVA globe logo
    const fin = new THREE.Shape()
    fin.moveTo(0, 0); fin.lineTo(3.2, 0); fin.lineTo(3.4, 3.6); fin.lineTo(2.2, 3.6); fin.closePath()
    m.add(new THREE.ExtrudeGeometry(fin, { depth: 0.14, bevelEnabled: false }).translate(0, 0, - 0.07).rotateY(- Math.PI / 2), green, [ 0, y0 + 0.55, L / 2 - 1.2 ])
    for(const side of [ - 1, 1 ])
    {
        const lx = side * 0.09, ly = y0 + 2.6, lz = L / 2 + 1.25
        m.cylinder(0.7, 0.7, 0.02, white, [ lx, ly, lz ], 24, [ 0, 0, Math.PI / 2 ])
        m.add(new THREE.TorusGeometry(0.66, 0.05, 4, 28).rotateY(Math.PI / 2), orange, [ lx * 1.1, ly, lz ])
        for(const a of [ 0, Math.PI / 2 ])
            m.add(new THREE.TorusGeometry(0.66, 0.025, 3, 24, Math.PI).rotateY(Math.PI / 2).rotateX(a), orange, [ lx * 1.12, ly, lz ])
        for(const r of [ 0, Math.PI / 2, Math.PI / 4, - Math.PI / 4 ])
            m.cbox([ 0.03, 0.9 * (r % (Math.PI / 2) ? 0.6 : 1), 0.14 ], green, [ lx * 1.3, ly, lz ], [ r, 0, 0 ])
    }
    // Christmas livery: dressed as a reindeer (like the Emirates A380): a big glossy red nose, huge antlers rising
    // from a wreath of holly on the crown, a leather harness with gold bells behind the cockpit;
    // candy cane engines, MERRY XMAS along the rear and a Santa hat on the tail
    m.sphere(0.46, C.red, [ 0, y0 - 0.08, - L / 2 - R * 1.38 ], 2)
    {
        const hz = - L / 2 + 1.55
        m.add(along(new THREE.CylinderGeometry(R + 0.035, R + 0.035, 0.22, 24)), C.wood, [ 0, y0, hz ])      // harness strap
        for(let i = 0; i < 14; i++)                                                                          // gold bells around it
        {
            const a = i / 14 * Math.PI * 2
            m.sphere(0.09, C.gold, [ Math.cos(a) * (R + 0.1), y0 + Math.sin(a) * (R + 0.1), hz ], 1)
        }
        m.cbox([ 0.12, 0.08, 2.0 ], C.wood, [ 0, y0 - R * 0.72, hz - 1.0 ], [ 0, 0, 0 ])                  // chin strap
        const az = - L / 2 + 0.6
        for(let i = 0; i < 18; i++)                                                                          // holly wreath at the antler base
        {
            const a = i / 18 * Math.PI * 2
            m.sphere(0.13, i % 2 ? C.leaf : C.moss, [ Math.cos(a) * 0.55, y0 + R - 0.02, az + Math.sin(a) * 0.35 ], 0, [ 1, 0.6, 1 ])
            if(i % 3 === 0) m.sphere(0.06, C.red, [ Math.cos(a) * 0.6, y0 + R + 0.08, az + Math.sin(a) * 0.4 ], 0)
        }
        // antlers: a sweeping main beam with five tines each, tan
        for(const side of [ - 1, 1 ])
        {
            const pts = [ [ side * 0.3, y0 + R, az ], [ side * 0.75, y0 + R + 1.3, az + 0.15 ], [ side * 1.5, y0 + R + 2.5, az + 0.05 ], [ side * 2.0, y0 + R + 3.5, az - 0.3 ] ]
            const curve = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p)))
            m.add(new THREE.TubeGeometry(curve, 16, 0.12, 6), C.khaki)
            m.sphere(0.12, C.khaki, pts[3], 0)
            for(const [ t, len, lean ] of [ [ 0.22, 0.9, 0.6 ], [ 0.42, 1.1, 0.2 ], [ 0.6, 1.0, - 0.2 ], [ 0.76, 0.8, 0.5 ], [ 0.9, 0.6, - 0.4 ] ])
            {
                const p = curve.getPointAt(t)
                const tip = new THREE.Vector3(p.x - side * len * 0.25, p.y + len, p.z + lean * len * 0.6)
                const tine = new THREE.CatmullRomCurve3([ p, new THREE.Vector3((p.x + tip.x) / 2, (p.y + tip.y) / 2 - 0.05, (p.z + tip.z) / 2), tip ])
                m.add(new THREE.TubeGeometry(tine, 6, 0.07, 5), C.khaki)
            }
        }
    }
    for(const side of [ - 1, 1 ])
    {
        const ex = side * 2.7
        for(let k = 0; k < 4; k++)                                                          // candy cane stripes on the nacelles
            m.add(along(new THREE.CylinderGeometry(0.535, 0.53, 0.18, 18)), C.red, [ ex, y0 - 1.05, - 2.0 + k * 0.5 ])
        for(let k = 0; k < 3; k++)                                                          // holly sprig behind the cockpit
            m.cbox([ 0.03, 0.12, 0.34 ], C.leaf, [ side * (R + 0.02), y0 + 0.55, - L / 2 + 1.1 + k * 0.08 ], [ (k - 1) * 0.8, 0, 0 ])
        for(let k = 0; k < 3; k++)
            m.sphere(0.06, C.red, [ side * (R + 0.04), y0 + 0.5 + (k % 2) * 0.07, - L / 2 + 1.05 + k * 0.08 ], 0)
        const t = new Model()
        pixelText(t, 'MERRY XMAS', C.red, [ 0, 0, 0 ], 0.08, { depth: 0.03 })
        m.merge(t, [ side * (R * 0.93 + 0.03), y0 + 0.1, L / 2 - 2.9 ], [ 0, side * Math.PI / 2, 0 ])
        // red and white wingtips
        m.cbox([ 0.5, 0.14, 0.62 ], C.red, [ side * 7.6, y0 - 0.45 + 7.2 * 0.07, - 1.6 + 3.2 ], [ 0, 0, side * 0.07 ])
    }
    // Santa hat on top of the fin (the fin top runs from z +1.0 to +2.2 behind its root, at y0 + 0.55 + 3.6)
    {
        const hy = y0 + 0.55 + 3.6, hz = L / 2 - 1.2 + 2.8
        m.cylinder(0.42, 0.42, 0.22, C.snow, [ 0, hy - 0.08, hz ], 14)
        m.cone(0.38, 1.25, C.red, [ 0, hy + 0.12, hz ], 12, [ 0.45, 0, 0 ])
        m.sphere(0.17, C.snow, [ 0, hy + 1.2, hz + 0.55 ], 1)
    }
    // it flies like a sleigh now (it floats, see StopArea.setPlane): gold sleigh runners curling up at the front
    // instead of landing gear, a sack of presents behind Santa's seat, fairy lights along the spine and the wings
    for(const side of [ - 1, 1 ])
    {
        const rx = side * 0.95, ry = y0 - R - 0.55
        const curve = new THREE.CatmullRomCurve3([ [ rx, ry + 0.1, L / 2 - 0.5 ], [ rx, ry, L / 2 - 2 ], [ rx, ry, - L / 2 + 2 ], [ rx, ry + 0.25, - L / 2 ], [ rx, ry + 0.9, - L / 2 - 0.8 ], [ rx, ry + 1.25, - L / 2 - 0.2 ], [ rx, ry + 0.95, - L / 2 + 0.1 ] ].map(p => new THREE.Vector3(...p)))
        m.add(new THREE.TubeGeometry(curve, 60, 0.1, 8), C.gold)
        for(const z of [ - L / 2 + 2.2, - 1.5, 1.8, L / 2 - 2 ])
            m.beam([ rx, ry, z ], [ side * R * 0.55, y0 - R * 0.75, z ], 0.08, C.gold)
        // lights along the top of the fuselage (both sides of the spine) and the wing's leading edge
        for(let z = - L / 2 + 1.0; z < L / 2 - 0.2; z += 0.36)
            m.add(new THREE.OctahedronGeometry(0.07, 0), C.fairy, [ side * R * 0.68, y0 + R * 0.74, z ])
        for(let x = 0.9; x <= 7.2; x += 0.36)
            m.add(new THREE.OctahedronGeometry(0.07, 0), C.fairy, [ side * (0.4 + x), y0 - 0.45 + x * 0.07 + 0.06, - 1.6 + x * 2.9 / 7.2 - 0.04 ])
        for(let a = 0; a < Math.PI * 2; a += Math.PI / 7)                 // a ring of lights round each engine intake
            m.add(new THREE.OctahedronGeometry(0.06, 0), C.fairy, [ side * 2.7 + Math.cos(a) * 0.55, y0 - 1.05 + Math.sin(a) * 0.55, - 2.3 ])
    }
    {
        const sz = - L / 2 + 4.6, top = y0 + R
        m.sphere(0.55, C.wood, [ 0, top + 0.35, sz ], 1, [ 1, 0.9, 1.1 ])                          // the sack
        m.cylinder(0.12, 0.18, 0.25, C.wood, [ 0, top + 0.82, sz ], 8)
        m.add(new THREE.TorusGeometry(0.14, 0.04, 5, 10), C.gold, [ 0, top + 0.9, sz ], [ Math.PI / 2, 0, 0 ])
        for(const [ dx, dy, dz, size, col, rib ] of [ [ - 0.45, 0.85, 0.3, 0.38, C.red, C.gold ], [ 0.45, 0.8, 0.25, 0.34, C.leaf, C.red ], [ 0.05, 1.15, 0.55, 0.3, C.sky, C.snow ], [ - 0.2, 1.05, - 0.35, 0.32, C.gold, C.red ] ])
        {
            m.cbox([ size, size, size ], col, [ dx, top + dy - 0.2, sz + dz ], [ 0.2, dx, 0.15 ])
            m.cbox([ size + 0.02, size + 0.02, size * 0.22 ], rib, [ dx, top + dy - 0.2, sz + dz ], [ 0.2, dx, 0.15 ])
            m.cbox([ size * 0.22, size + 0.02, size + 0.02 ], rib, [ dx, top + dy - 0.2, sz + dz ], [ 0.2, dx, 0.15 ])
        }
        m.cbox([ 1.0, 0.12, 0.9 ], C.red, [ 0, top + 0.02, - L / 2 + 2.6 ])                       // Santa's red saddle blanket
        m.cbox([ 1.04, 0.06, 0.94 ], C.gold, [ 0, top - 0.02, - L / 2 + 2.6 ])
    }
    return m
}

builders.sfo = (ctx) =>
{
    // Like SFO's International Terminal: a long glass hall under three white wave roofs on exposed trusses,
    // SAN FRANCISCO INTERNATIONAL across the facade, the curbside canopy, the AirTrain gliding past on its guideway,
    // the orange and blue sculpture out front, the new torch-shaped control tower, and an EVA Air 787-10 at the gate
    const nodes = []
    const tx = 69, tz = 66, depth = 7, length = 20            // terminal center and size (front faces -x, toward the road)
    const F = - depth / 2

    const t = new Model()
    t.box([ depth, 4.2, length ], C.stone)
    // glass facade with mullions and the light blue panels
    t.box([ 0.1, 3.6, length - 0.4 ], C.sky, [ F - 0.02, 0.3, 0 ])
    for(let z = - length / 2 + 0.8; z < length / 2; z += 1.2)
        t.box([ 0.12, 3.6, 0.06 ], C.snow, [ F - 0.06, 0.3, z ])
    for(const y of [ 1.5, 2.7 ])
        t.box([ 0.12, 0.06, length - 0.4 ], C.snow, [ F - 0.06, y, 0 ])
    {
        const label = new Model()
        pixelText(label, 'SAN FRANCISCO INTERNATIONAL', C.dark, [ 0, 0, 0 ], 0.11, { depth: 0.04 })
        t.merge(label, [ F - 0.12, 3.0, 0 ], [ 0, - Math.PI / 2, 0 ])
    }
    // three wave roofs on white trusses
    const spans = 3, spanL = length / spans
    for(let k = 0; k < spans; k++)
    {
        const zc = - length / 2 + spanL * (k + 0.5)
        for(let i = 0; i < 10; i++)
        {
            const a0 = (i / 10 - 0.5) * 1.3, a1 = ((i + 1) / 10 - 0.5) * 1.3
            const r = spanL * 0.85
            const z0 = zc + Math.sin(a0) * r, z1 = zc + Math.sin(a1) * r
            const y0r = 4.2 + Math.cos(a0) * 1.4 - 0.4, y1r = 4.2 + Math.cos(a1) * 1.4 - 0.4
            const mid = [ 0, (y0r + y1r) / 2, (z0 + z1) / 2 ]
            t.cbox([ depth + 2.4, 0.12, Math.hypot(z1 - z0, y1r - y0r) + 0.05 ], C.snow, mid, [ Math.atan2(y1r - y0r, z1 - z0) * - 1, 0, 0 ])
        }
        // the exposed truss under each wave, cantilevered out over the curb
        for(const x of [ F - 1.1, 0, - F + 1 ])
        {
            t.cylinder(0.12, 0.14, 4.6, C.snow, [ x, 0, zc ], 8)
            for(const sz of [ - 1, 1 ])
                t.beam([ x, 4.3, zc ], [ x, 5.1, zc + sz * spanL * 0.42 ], 0.08, C.snow)
        }
        t.beam([ F - 1.1, 4.6, zc ], [ - F + 1, 4.6, zc ], 0.08, C.snow)
    }
    // curbside canopy along the front
    t.box([ 2.4, 0.15, length ], C.snow, [ F - 1.5, 2.4, 0 ])
    for(let z = - length / 2 + 1; z < length / 2; z += 3)
        t.cylinder(0.07, 0.07, 2.4, C.stone, [ F - 2.5, 0, z ], 6)
    // Christmas at the terminal: lights along every wave roof's front and back edge and the curbside canopy,
    // wreaths with red bows on the glass facade between the mullions, garland swags under the canopy
    for(let k = 0; k < spans; k++)
    {
        const zc = - length / 2 + spanL * (k + 0.5), r = spanL * 0.85
        for(let a = - 0.65; a <= 0.65; a += 0.06)
            for(const ex of [ - 1, 1 ])
                bulb(t, [ ex * ((depth + 2.4) / 2 + 0.05), 4.2 + Math.cos(a) * 1.4 - 0.4 + 0.08, zc + Math.sin(a) * r ], 0.11)
    }
    for(let z = - length / 2 + 1; z < length / 2 - 1; z += 3)
    {
        lightString(t, [ F - 2.75, 2.5, z ], [ F - 2.75, 2.5, z + 3 ], 0.3, 0.3, 0.1)
        for(let i = 0; i <= 8; i++)
            t.sphere(0.09, i % 2 ? C.moss : C.leaf, [ F - 2.7, 2.3 - Math.sin(i / 8 * Math.PI) * 0.35, z + i * 3 / 8 ], 0)
        t.cbox([ 0.12, 0.14, 0.22 ], C.red, [ F - 2.72, 2.32, z ])
    }
    for(let z = - length / 2 + 2.6; z < length / 2 - 1; z += 3.6)
        wreath(t, [ F - 0.14, 2.2, z ], - Math.PI / 2, 1.5)
    nodes.push(fixedNode('terminal', t, ctx.at(tx, tz), [ { position: [ 0, 2.1, 0 ], size: [ depth, 4.2, length ] } ]))
    // a big lit Christmas tree with presents at the north end of the terminal
    {
        const tree = new Model()
        litPine(tree, [ 0, 0, 0 ], 2.6)
        for(let i = 0; i < 6; i++)
        {
            const a = i / 6 * Math.PI * 2
            tree.box([ 0.6, 0.6, 0.6 ], [ C.red, C.gold, C.sky, C.leaf, C.pink, C.snow ][i], [ Math.cos(a) * 2.2, 0, Math.sin(a) * 2.2 ], [ 0, a, 0 ])
            tree.box([ 0.64, 0.62, 0.12 ], C.gold, [ Math.cos(a) * 2.2, 0, Math.sin(a) * 2.2 ], [ 0, a, 0 ])
        }
        nodes.push(fixedNode('sfoTree', tree, ctx.at(tx - 2.5, tz - length / 2 - 2.5), [ { shape: 'tube', position: [ 0, 2.6, 0 ], radius: 1.2, height: 5.2 } ]))
    }

    // the sculpture out front: tall orange and blue blades on a round plinth
    {
        const sc = new Model()
        sc.cylinder(1.1, 1.1, 0.3, C.stone, [ 0, 0, 0 ], 16)
        sc.cbox([ 0.1, 4.2, 1.1 ], C.sky, [ 0, 2.3, 0 ], [ 0, 0.3, 0.15 ])
        sc.cbox([ 0.1, 3.4, 1.0 ], C.orange, [ 0.2, 2.0, 0.2 ], [ 0, - 0.5, - 0.2 ])
        sc.cbox([ 0.1, 2.6, 0.8 ], C.sky, [ - 0.2, 1.6, - 0.3 ], [ 0, 1.1, 0.25 ])
        nodes.push(fixedNode('sculpture', sc, ctx.at(tx - 6.5, tz - 7.5), [ { shape: 'tube', position: [ 0, 1.5, 0 ], radius: 0.6, height: 3 } ]))
    }

    // AirTrain: an elevated guideway along the front, a two car blue and white train on it
    {
        const g = new Model()
        g.box([ 1.1, 0.35, length + 6 ], C.stone, [ 0, 4.6, 0 ])
        for(let z = - length / 2 - 2; z <= length / 2 + 2; z += 4.5)
            g.cylinder(0.22, 0.28, 4.6, C.stone, [ 0, 0, z ], 8)
        for(const z of [ - 4.2, - 1.6 ])
        {
            g.box([ 0.95, 1.2, 2.5 ], C.snow, [ 0, 4.95, z ])
            g.box([ 0.97, 0.35, 2.5 ], C.sky, [ 0, 5.2, z ])
            g.box([ 0.96, 0.18, 2.5 ], C.sky, [ 0, 4.95, z ])
        }
        for(const ex of [ - 0.6, 0.6 ])                             // lights along both edges of the guideway
            for(let z = - length / 2 - 3; z <= length / 2 + 3; z += 0.5)
                bulb(g, [ ex, 4.98, z ], 0.09)
        nodes.push(fixedNode('airTrain', g, ctx.at(tx - 7.2, tz), [ ...[ - 12, - 7.5, - 3, 1.5, 6, 10.5 ].map(z => ({ shape: 'tube', position: [ 0, 2.3, z ], radius: 0.28, height: 4.6 })) ]))
    }

    // the new control tower: a slim tapering torch with a glass cab and a crown
    {
        const c = new Model()
        c.cylinder(0.9, 1.4, 1, C.stone, [ 0, 0, 0 ], 12)
        c.cylinder(0.7, 1.1, 11, C.snow, [ 0, 1, 0 ], 12)
        c.cylinder(1.5, 0.8, 1, C.snow, [ 0, 12, 0 ], 12)
        c.cylinder(1.5, 1.5, 1.4, C.slate, [ 0, 13, 0 ], 12)
        c.cylinder(1.6, 1.5, 0.5, C.snow, [ 0, 14.4, 0 ], 12)
        // a round holiday deck on the crown (Santa's sleigh and reindeer land here in winter, see Santa.js):
        // gold rail, a garland with red bows, the antenna moved to the rim
        c.cylinder(3.4, 1.6, 0.6, C.snow, [ 0, 14.3, 0 ], 24)
        c.cylinder(3.45, 3.45, 0.08, C.gold, [ 0, 14.86, 0 ], 24)
        for(let i = 0; i < 24; i++)
        {
            const a = i / 24 * Math.PI * 2
            c.cylinder(0.035, 0.035, 0.45, C.gold, [ Math.cos(a) * 3.3, 14.9, Math.sin(a) * 3.3 ], 4)
            if(i % 3 === 0)
                c.cbox([ 0.22, 0.16, 0.08 ], C.red, [ Math.cos(a) * 3.38, 15.25, Math.sin(a) * 3.38 ], [ 0, - a + Math.PI / 2, 0 ])
        }
        c.add(new THREE.TorusGeometry(3.3, 0.04, 4, 48), C.gold, [ 0, 15.35, 0 ], [ Math.PI / 2, 0, 0 ])
        c.add(new THREE.TorusGeometry(3.32, 0.09, 5, 48), C.moss, [ 0, 15.15, 0 ], [ Math.PI / 2, 0, 0 ])
        c.cylinder(0.08, 0.08, 1.5, C.dark, [ 2.9, 14.9, 0 ], 4)
        c.sphere(0.2, C.red, [ 2.9, 16.5, 0 ], 0)
        const towerAt = ctx.at(tx + 2, tz + 13)
        console.log('SFO tower deck (world):', (ctx.cx + towerAt[0]).toFixed(2), (ctx.y + towerAt[1] + 14.9 * ctx.S).toFixed(2), (ctx.cz + towerAt[2]).toFixed(2), 'radius', (3.3 * ctx.S).toFixed(2))
        nodes.push(fixedNode('tower', c, towerAt, [ { shape: 'tube', position: [ 0, 6, 0 ], radius: 1.2, height: 12 } ]))
    }

    // the EVA Air 787-10 at the gate, nose to the terminal, with its jet bridge
    {
        const px = 57.5, pz = 79
        // kinematic: it floats up and down like Santa's sleigh (StopArea.setPlane), Santa rides it (Santa.js)
        nodes.push({
            ...kinematicNode('refEvaPlane', evaPlane(), ctx.at(px, pz), [
                { position: [ 0, 1.75, 0.5 ], size: [ 1.7, 1.7, 15 ] },
                { shape: 'tube', position: [ 2.7, 0.7, - 1.2 ], radius: 0.5, height: 1.4 },
                { shape: 'tube', position: [ - 2.7, 0.7, - 1.2 ], radius: 0.5, height: 1.4 },
            ]),
            rotation: [ 0, - Math.PI / 2, 0 ],
        })
        const b = new Model()
        b.box([ 4.4, 1.1, 0.9 ], C.stone, [ 0, 1.3, 0 ])
        b.box([ 4.4, 0.08, 0.95 ], C.snow, [ 0, 2.4, 0 ])
        b.cylinder(0.12, 0.12, 1.3, C.dark, [ - 0.8, 0, 0 ], 6)
        b.box([ 0.6, 0.35, 0.6 ], C.dark, [ - 0.8, 0, 0 ])
        for(const ez of [ - 0.5, 0.5 ])
            lightString(b, [ - 2.2, 2.45, ez ], [ 2.2, 2.45, ez ], 0.3, 0.12, 0.09)
        nodes.push(fixedNode('jetBridge', b, ctx.at(px + 6.3 + 2.2, pz - 1.3), [ { position: [ 0, 1.8, 0 ], size: [ 4.4, 1.2, 0.9 ] } ]))
        // ground stripes on the apron: the lead-in line
        const lines = new Model()
        lines.box([ 14, 0.03, 0.15 ], C.gold, [ 0, 0, 0 ])
        lines.box([ 0.15, 0.03, 4 ], C.gold, [ 6.5, 0, 0 ])
        nodes.push(meshNode('apronLines', lines, ctx.at(px, pz, 0.01)))
    }

    // runway stripes and SFO letters
    const runway = new Model()
    for(let i = 0; i < 8; i++)
        runway.box([ 0.5, 0.04, 2 ], C.snow, [ 0, 0, i * 4 ])
    nodes.push(meshNode('runway', runway, ctx.at(76, 52)))
    nodes.push(...letters(ctx, 'SFO', C.bridge, 58, 62, - 0.3, 0.45))
    return nodes
}

/** 2. Ferry Building */
builders.ferryBuilding = (ctx) =>
{
    const nodes = []
    const cx = 61, cz = - 18
    // The Ferry Building: a long two storey hall of arched windows in grey-white stone, a three arch entrance
    // pavilion, flags along the roof, the red PORT OF SAN FRANCISCO sign, and the tall clock tower with its
    // stacked belfry stages, lit gold at night
    const hall = new Model()
    const stone = C.snow, trim = C.stone
    const L = 26
    hall.box([ 6, 3.8, L ], stone)
    hall.box([ 6.2, 0.25, L + 0.2 ], trim, [ 0, 1.7, 0 ])                          // string course between floors
    hall.box([ 6.3, 0.3, L + 0.3 ], trim, [ 0, 3.8, 0 ])                           // cornice
    hall.box([ 5.2, 0.7, L - 0.6 ], C.slate, [ 0.3, 4.1, 0 ])                      // low slate roof / skylight
    // arcade: tall arched windows on the city side (-x), two rows
    const arch = (x, y, z, w, h, color) =>
    {
        hall.cbox([ 0.08, h - w / 2, w ], color, [ x, y + (h - w / 2) / 2, z ])
        hall.cylinder(w / 2, w / 2, 0.08, color, [ x, y + h - w / 2, z ], 10, [ 0, 0, Math.PI / 2 ])
    }
    for(let i = 0; i < 22; i++)
    {
        const z = - L / 2 + 0.9 + i * ((L - 1.8) / 21)
        if(Math.abs(z) < 2.4)
            continue
        arch(- 3.02, 0.2, z, 0.7, 1.3, C.dark)
        arch(- 3.02, 2.0, z, 0.6, 1.4, C.dark)
    }
    // entrance pavilion with three big arches
    hall.box([ 1, 4.4, 4.8 ], stone, [ - 3.4, 0, 0 ])
    hall.box([ 1.1, 0.25, 5 ], trim, [ - 3.4, 4.4, 0 ])
    for(const z of [ - 1.45, 0, 1.45 ])
        arch(- 3.92, 0.1, z, 1.1, 2.9, C.dark)
    // flags along the roof line
    for(let i = 0; i < 8; i++)
    {
        const z = - L / 2 + 2 + i * ((L - 4) / 7)
        if(Math.abs(z) < 3)
            continue
        hall.cylinder(0.03, 0.03, 1.4, C.dark, [ - 2.6, 4.1, z ], 4)
        hall.cbox([ 0.02, 0.35, 0.55 ], [ C.red, C.gold, C.sky, C.red ][i % 4], [ - 2.6, 5.3, z + 0.28 ])
    }
    // PORT OF SAN FRANCISCO, red letters on a steel frame on the roof (facing the city)
    hall.box([ 0.1, 0.1, 9 ], C.dark, [ - 0.6, 4.8, 7.5 ])
    for(const z of [ 3.4, 7.5, 11.6 ])
        hall.box([ 0.1, 1, 0.1 ], C.dark, [ - 0.6, 4.1, z ])
    {
        const sign = new Model()
        pixelText(sign, 'PORT OF SAN FRANCISCO', C.red, [ 0, 0, 0 ], 0.1, { depth: 0.05 })
        hall.merge(sign, [ - 0.7, 4.9, 7.5 ], [ 0, - Math.PI / 2, 0 ])
    }
    // the clock tower
    hall.box([ 2.6, 9.5, 2.6 ], stone, [ 0, 3.8, 0 ])
    for(const x of [ - 1.3, 1.3 ])
        for(const z of [ - 1.3, 1.3 ])
            hall.box([ 0.25, 9.5, 0.25 ], trim, [ x, 3.8, z ])                     // corner pilasters
    for(let k = 0; k < 4; k++)
        for(const z of [ - 0.5, 0.5 ])
            hall.cbox([ 0.06, 0.5, 0.25 ], C.dark, [ - 1.32, 5 + k * 1.5, z ])     // slit windows
    hall.box([ 3, 0.3, 3 ], trim, [ 0, 13.3, 0 ])
    // four clock faces, one per side, standing proud of the wall (centered discs, so none sinks into the tower):
    // a cream dial in a gold rim, twelve hour marks, black hands at ten past ten
    for(const [ nx, nz ] of [ [ - 1, 0 ], [ 1, 0 ], [ 0, - 1 ], [ 0, 1 ] ])
    {
        const out = (d) => [ nx * d, 11.9, nz * d ]
        const disc = (r, t, color, d) =>
        {
            const g = new THREE.CylinderGeometry(r, r, t, 32)
            if(nx) g.rotateZ(Math.PI / 2)
            else g.rotateX(Math.PI / 2)
            hall.add(g, color, out(d))
        }
        disc(1.05, 0.08, C.gold, 1.34)
        disc(0.95, 0.06, C.cream, 1.39)
        // position on the dial: u to the viewer's right, v up (y)
        const ux = nz ? - nz : 0, uz = nx ? nx : 0
        const onDial = (u, v, d) => [ nx * d + ux * u, 11.9 + v, nz * d + uz * u ]
        const spin = (a) => nx ? [ - a * nx, 0, 0 ] : [ 0, 0, a * nz ]
        for(let h = 0; h < 12; h++)
        {
            const a = h / 12 * Math.PI * 2
            const long = h % 3 === 0
            hall.cbox(nx ? [ 0.04, long ? 0.2 : 0.12, 0.05 ] : [ 0.05, long ? 0.2 : 0.12, 0.04 ], C.black, onDial(Math.sin(a) * 0.78, Math.cos(a) * 0.78, 1.43), spin(a))
        }
        const hand = (angle, length, width) =>
            hall.cbox(nx ? [ 0.04, length, width ] : [ width, length, 0.04 ], C.black, onDial(Math.sin(angle) * length / 2, Math.cos(angle) * length / 2, 1.44), spin(angle))
        hand(- Math.PI / 6 * 2 + 0.09, 0.48, 0.09)          // hour hand, just past 10
        hand(Math.PI / 6 * 2, 0.7, 0.06)                    // minute hand on 2 (ten past)
        hall.cylinder(0.06, 0.06, 0.05, C.gold, onDial(0, 0, 1.43), 10, nx ? [ 0, 0, Math.PI / 2 ] : [ Math.PI / 2, 0, 0 ])
    }
    // belfry stages: arched openings that glow at night, then a colonnade and the little cupola
    const glow = new Model()
    hall.box([ 2.4, 1.8, 2.4 ], stone, [ 0, 13.6, 0 ])
    for(const [ x, z, ry ] of [ [ - 1.22, 0, 0 ], [ 1.22, 0, 0 ], [ 0, - 1.22, Math.PI / 2 ], [ 0, 1.22, Math.PI / 2 ] ])
        for(const o of [ - 0.6, 0, 0.6 ])
            glow.cbox([ 0.05, 1.1, 0.35 ], C.gold, [ x + (ry ? o : 0), 14.4, z + (ry ? 0 : o) ], [ 0, ry, 0 ])
    hall.box([ 2.7, 0.25, 2.7 ], trim, [ 0, 15.4, 0 ])
    hall.box([ 1.8, 1.3, 1.8 ], stone, [ 0, 15.65, 0 ])
    for(const [ x, z, ry ] of [ [ - 0.92, 0, 0 ], [ 0.92, 0, 0 ], [ 0, - 0.92, Math.PI / 2 ], [ 0, 0.92, Math.PI / 2 ] ])
        for(const o of [ - 0.35, 0.35 ])
            glow.cbox([ 0.05, 0.8, 0.25 ], C.gold, [ x + (ry ? o : 0), 16.3, z + (ry ? 0 : o) ], [ 0, ry, 0 ])
    hall.box([ 2.1, 0.2, 2.1 ], trim, [ 0, 16.95, 0 ])
    hall.cylinder(0.55, 0.7, 1, stone, [ 0, 17.15, 0 ], 8)
    hall.cylinder(0.7, 0.7, 0.15, trim, [ 0, 18.15, 0 ], 8)
    hall.sphere(0.55, C.slate, [ 0, 18.4, 0 ], 1, [ 1, 0.9, 1 ])
    hall.cylinder(0.03, 0.03, 1.6, C.dark, [ 0, 18.9, 0 ], 4)
    hall.cbox([ 0.02, 0.4, 0.7 ], C.red, [ 0, 20.2, 0.35 ])                       // the flag
    hall.cbox([ 0.03, 0.18, 0.3 ], C.sky, [ 0, 20.3, 0.15 ])
    nodes.push(fixedNode('hall', hall, ctx.at(cx, cz), [
        { position: [ 0, 2, 0 ], size: [ 6.2, 4, L + 0.2 ] },
        { position: [ - 3.4, 2.2, 0 ], size: [ 1, 4.4, 4.8 ] },
        { position: [ 0, 9, 0 ], size: [ 2.8, 18, 2.8 ] },
    ]))
    nodes.push({ ...meshNode('towerGlow', glow, ctx.at(cx, cz)), mesh: { geometry: glow.geometry(), material: 'emissiveOrangeRadialGradient' } })

    // Hog Island oyster stand
    const stand = new Model()
    stand.box([ 2, 1.1, 3 ], C.wood)
    stand.box([ 2.4, 0.15, 3.4 ], C.snow, [ 0, 1.1, 0 ])
    for(let i = 0; i < 6; i++)
        stand.sphere(0.18, C.stone, [ - 0.3 + (i % 2) * 0.4, 1.32, - 1 + i * 0.4 ], 0, [ 1, 0.5, 1.4 ])
    stand.box([ 2.6, 0.12, 3.6 ], C.sky, [ 0, 2.6, 0 ])
    stand.cylinder(0.05, 0.05, 1.5, C.dark, [ - 1.1, 1.1, - 1.6 ], 4)
    stand.cylinder(0.05, 0.05, 1.5, C.dark, [ - 1.1, 1.1, 1.6 ], 4)
    nodes.push(fixedNode('oysters', stand, ctx.at(54, - 20.5), [ { position: [ 0, 0.7, 0 ], size: [ 2.4, 1.4, 3.4 ] } ]))

    // Bay Bridge going off to the east (visual only, beyond the playable area)
    const bay = new Model()
    const y = 5
    bay.box([ 40, 0.6, 3.6 ], C.stone, [ 20, y, 0 ])
    for(const x of [ 8, 26 ])
    {
        for(const z of [ - 1.6, 1.6 ])
            bay.box([ 0.7, 15, 0.7 ], C.stone, [ x, - 2, z ])
        bay.box([ 0.8, 0.6, 4 ], C.stone, [ x, 12.2, 0 ])
        bay.box([ 0.8, 0.5, 4 ], C.stone, [ x, y - 1, 0 ])
    }
    for(const z of [ - 1.6, 1.6 ])
    {
        const pts = []
        for(let i = 0; i <= 20; i++)
        {
            const x = i * 2
            const t = (x - 17) / 9
            pts.push([ x, y + 0.6 + Math.min(8, 1 + t * t * 6.4), z ])
        }
        for(let i = 0; i < pts.length - 1; i++)
            bay.beam(pts[i], pts[i + 1], 0.15, C.stone)
    }
    nodes.push({ ...meshNode('bayBridge', bay, [ 72 - cx, - 1.5 - ctx.y, - 6 - cz ]), noScale: true })

    return nodes
}

/** Union Square's giant Christmas tree (model only, T = 1.5x) */
export function christmasTree()
{
    // A grand plaza tree: many layered, drooping tiers of fir (dark at the core, lighter at the tips), a garland of
    // fairy lights spiralling to the top, red and gold baubles, gold ribbon, and presents around the base.
    // The big star is returned separately so it can glow (see build.mjs).
    const T = 1.5
    const tree = new Model()
    const r = rng(1225)
    tree.cylinder(0.5 * T, 0.65 * T, 1.6 * T, C.wood, [ 0, 0, 0 ], 8)
    tree.cylinder(1.7 * T, 1.9 * T, 0.5 * T, C.red, [ 0, 0, 0 ], 16)                     // skirt
    tree.cylinder(1.75 * T, 1.75 * T, 0.08 * T, C.gold, [ 0, 0.5 * T, 0 ], 16)
    const tiers = 9, top = 12.6
    const radiusAt = (h) => (3.7 - (h - 1.4) / (top - 1.4) * 3.5) * T
    for(let i = 0; i < tiers; i++)
    {
        const y = (1.4 + i * 1.22) * T
        const rr = radiusAt(y / T)
        tree.cone(rr, 2.2 * T, i % 2 ? C.scallion : C.leaf, [ 0, y, 0 ], 14)
        // drooping branch tips around the rim, lighter green
        const tips = 12 - Math.floor(i * 0.8)
        for(let k = 0; k < tips; k++)
        {
            const a = k / tips * Math.PI * 2 + i * 0.4
            tree.cone(0.42 * T, 0.9 * T, C.leaf, [ Math.cos(a) * rr * 0.86, y + 0.05 * T, Math.sin(a) * rr * 0.86 ], 5, [ Math.cos(a + Math.PI / 2) * 0.9, 0, Math.sin(a + Math.PI / 2) * - 0.9 ])
        }
    }
    const surface = (h, a, inset = 0.88) => { const rr = radiusAt(h) * inset; return [ Math.cos(a) * rr, h * T, Math.sin(a) * rr ] }
    // the garland of fairy lights: three spirals winding up
    for(let g = 0; g < 3; g++)
        for(let k = 0; k < 120; k++)
        {
            const t = k / 120, h = 1.8 + t * (top - 2.3)
            tree.sphere(0.12 * T, C.fairy, surface(h, t * Math.PI * 9 + g * 2.1, 0.92 + Math.sin(k) * 0.02), 0)
        }
    // gold ribbon spiral
    for(let k = 0; k < 70; k++)
    {
        const t = k / 70, h = 2 + t * (top - 3)
        const p = surface(h, - t * Math.PI * 6, 0.97)
        tree.cbox([ 0.5 * T, 0.12 * T, 0.12 * T ], C.gold, p, [ 0, t * Math.PI * 6, 0.35 ])
    }
    // baubles: red, gold and white, bigger near the bottom
    for(let i = 0; i < 70; i++)
    {
        const h = 1.8 + r() * (top - 2.6)
        const size = (0.32 - (h / top) * 0.14) * T
        tree.sphere(size, [ C.red, C.gold, C.red, C.snow, C.gold ][i % 5], surface(h, r() * Math.PI * 2, 0.95), 1)
    }
    // presents around the trunk
    for(let i = 0; i < 12; i++)
    {
        const a = i / 12 * Math.PI * 2 + 0.2
        const size = (0.55 + (i % 3) * 0.22) * T
        const x = Math.cos(a) * 2.9 * T, z = Math.sin(a) * 2.9 * T
        tree.box([ size, size, size ], [ C.red, C.sky, C.gold, C.pink, C.leaf, C.snow ][i % 6], [ x, 0, z ], [ 0, a, 0 ])
        tree.box([ size + 0.04, size + 0.02, 0.12 ], [ C.gold, C.red, C.snow ][i % 3], [ x, 0, z ], [ 0, a, 0 ])
        tree.box([ 0.12, size + 0.02, size + 0.04 ], [ C.gold, C.red, C.snow ][i % 3], [ x, 0, z ], [ 0, a, 0 ])
    }
    return tree
}

/** The big five pointed star on top of the tree (emissive) */
export function christmasStar()
{
    const T = 1.5
    const star = new Model()
    const shape = new THREE.Shape()
    for(let i = 0; i < 10; i++)
    {
        const a = i / 10 * Math.PI * 2 + Math.PI / 2, rr = (i % 2 ? 0.55 : 1.35) * T
        i === 0 ? shape.moveTo(Math.cos(a) * rr, Math.sin(a) * rr) : shape.lineTo(Math.cos(a) * rr, Math.sin(a) * rr)
    }
    shape.closePath()
    const g = new THREE.ExtrudeGeometry(shape, { depth: 0.35 * T, bevelEnabled: true, bevelThickness: 0.12 * T, bevelSize: 0.08 * T, bevelSegments: 1 }).translate(0, 0, - 0.17 * T)
    star.add(g, C.gold, [ 0, 0, 0 ])
    star.add(g.clone().rotateY(Math.PI / 2), C.gold, [ 0, 0, 0 ])     // two crossed stars: a star from every side
    return star
}

/** 3. Union Square: an open plaza. The big tree stands where the Dewey column was (east), the rink fills the west side */
builders.unionSquare = (ctx) =>
{
    const nodes = []
    const cx = 34, cz = 13
    const T = 1.5 // the tree is 1.5x bigger than the other site parts

    // the Christmas tree now stands on its own lawn west of Chinatown (scenery, see build.mjs), off the streets

    // Ice rink (bigger), west side of the square: slippery!
    const W = 12, D = 8
    const rink = new Model()
    rink.box([ W, 0.06, D ], C.snow)
    rink.box([ W + 0.4, 0.4, 0.2 ], C.stone, [ 0, 0, D / 2 + 0.1 ])
    rink.box([ W + 0.4, 0.4, 0.2 ], C.stone, [ 0, 0, - D / 2 - 0.1 ])
    rink.box([ 0.2, 0.4, D / 2 - 1.4 ], C.stone, [ W / 2 + 0.1, 0, - D / 4 - 0.7 ])
    rink.box([ 0.2, 0.4, D / 2 - 1.4 ], C.stone, [ W / 2 + 0.1, 0, D / 4 + 0.7 ])
    rink.box([ 0.2, 0.4, D + 0.2 ], C.stone, [ - W / 2 - 0.1, 0, 0 ])
    // string lights over the rink
    for(let i = 0; i <= 12; i++)
        rink.sphere(0.12, [ C.gold, C.red, C.sky ][i % 3], [ - W / 2 + i * W / 12, 2.6 - Math.sin(i / 12 * Math.PI) * 0.6, 0 ], 0)
    for(const x of [ - W / 2, W / 2 ])
        rink.cylinder(0.06, 0.06, 2.8, C.dark, [ x, 0, 0 ], 5)
    nodes.push(fixedNode('iceRink', rink, ctx.at(cx - 4, cz + 3.5), [
        { position: [ 0, 0.03, 0 ], size: [ W, 0.06, D ], friction: 0.01, restitution: 0 },
        { position: [ 0, 0.2, D / 2 + 0.1 ], size: [ W + 0.4, 0.4, 0.2 ] },
        { position: [ 0, 0.2, - D / 2 - 0.1 ], size: [ W + 0.4, 0.4, 0.2 ] },
        { position: [ - W / 2 - 0.1, 0.2, 0 ], size: [ 0.2, 0.4, D + 0.2 ] },
    ]))

    // Macy's on the south side with the red star
    const macys = new Model()
    macys.box([ 14, 7, 5 ], C.cream)
    for(let i = 0; i < 6; i++)
        for(let j = 0; j < 3; j++)
            macys.cbox([ 1.2, 1, 0.1 ], C.black, [ - 5.5 + i * 2.2, 1.6 + j * 1.9, - 2.52 ])
    macys.box([ 14.2, 0.3, 5.2 ], C.stone, [ 0, 7, 0 ])
    macys.cbox([ 1.6, 1.6, 0.2 ], C.red, [ 0, 7.9, - 2.4 ], [ 0, 0, Math.PI / 4 ])
    macys.add(new THREE.TorusGeometry(0.8, 0.25, 5, 10), C.moss, [ - 4.4, 5.2, - 2.6 ])
    macys.add(new THREE.TorusGeometry(0.8, 0.25, 5, 10), C.moss, [ 4.4, 5.2, - 2.6 ])
    pixelText(macys, "MACY'S", C.red, [ 0, 5.85, - 2.56 ], 0.2, { back: true })
    macys.box([ 14.2, 0.5, 0.6 ], C.red, [ 0, 1.0, - 2.8 ])                         // red awnings over the doors
    nodes.push(fixedNode('macys', macys, ctx.at(cx, cz + 13), [ { position: [ 0, 3.5, 0 ], size: [ 14, 7, 5 ] } ]))

    // Saks Fifth Avenue: rounded white corners, rows of deep square windows, the name across the top.
    // It stands on the open east side of the square (facing west, onto the plaza), clear of every street and of Chinatown.
    {
        const m = new Model()
        const w = 6, d = 2.6, h = 4.6
        m.box([ w, h, d ], C.snow)
        m.cylinder(d / 2, d / 2, h, C.snow, [ w / 2, 0, 0 ], 16)
        m.cylinder(d / 2, d / 2, h, C.snow, [ - w / 2, 0, 0 ], 16)
        for(const y of [ 1.1, 2.15, 3.2 ])
        {
            m.box([ w + d + 0.06, 0.12, d + 0.06 ], C.stone, [ 0, y - 0.55, 0 ])
            for(let i = 0; i < 7; i++)
                m.cbox([ 0.5, 0.62, 0.06 ], C.dark, [ - 2.7 + i * 0.9, y, d / 2 + 0.01 ])
        }
        m.box([ w + d + 0.12, 0.3, d + 0.12 ], C.stone, [ 0, h, 0 ])
        m.box([ w, 0.55, 0.06 ], C.snow, [ 0, h - 0.62, d / 2 + 0.02 ])
        pixelText(m, 'SAKS FIFTH AVENUE', C.dark, [ 0, h - 0.82, d / 2 + 0.06 ], 0.08, { depth: 0.03 })
        m.box([ w, 0.45, 0.4 ], C.dark, [ 0, 0, d / 2 + 0.2 ])                     // shop windows at street level
        nodes.push({ ...fixedNode('saks', m, ctx.at(cx + 11.6, cz + 3), [ { position: [ 0, h / 2, 0 ], size: [ w + d, h, d ] } ]), rotation: [ 0, - Math.PI / 2, 0 ] })
    }

    // the painted Union Square hearts, on their pedestals
    const heartShape = new THREE.Shape()
    heartShape.moveTo(0, - 1)
    heartShape.bezierCurveTo(- 0.2, - 0.6, - 1.2, - 0.3, - 1.2, 0.35)
    heartShape.bezierCurveTo(- 1.2, 1.05, - 0.25, 1.15, 0, 0.55)
    heartShape.bezierCurveTo(0.25, 1.15, 1.2, 1.05, 1.2, 0.35)
    heartShape.bezierCurveTo(1.2, - 0.3, 0.2, - 0.6, 0, - 1)
    const heartGeometry = () => new THREE.ExtrudeGeometry(heartShape, { depth: 0.5, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.1, bevelSegments: 2, curveSegments: 10 }).translate(0, 0, - 0.25)
    for(const [ x, z, colors, ry ] of [ [ cx + 6, cz - 5, [ C.red, C.gold, C.sky ], 0.5 ], [ cx + 3, cz + 8.5, [ C.pink, C.purple, C.snow ], - 0.4 ] ])
    {
        const heart = new Model()
        heart.box([ 1.6, 0.6, 1 ], C.stone)
        heart.add(heartGeometry(), colors[0], [ 0, 1.65, 0 ], [ 0, 0, 0 ], 1.05)
        // painted stripes and dots
        heart.cbox([ 1.9, 0.18, 0.78 ], colors[1], [ 0, 1.75, 0 ], [ 0, 0, 0.25 ])
        heart.cbox([ 1.5, 0.14, 0.8 ], colors[2], [ 0, 1.25, 0 ], [ 0, 0, - 0.3 ])
        for(const [ dx, dy ] of [ [ - 0.6, 2.2 ], [ 0.55, 2.25 ], [ 0.1, 0.95 ] ])
            heart.cylinder(0.12, 0.12, 0.82, colors[2], [ dx, dy, - 0.41 ], 8, [ Math.PI / 2, 0, 0 ])
        nodes.push({ ...fixedNode('unionHeart', heart, ctx.at(x, z), [ { position: [ 0, 1.3, 0 ], size: [ 1.8, 2.6, 0.9 ] } ]), rotation: [ 0, ry, 0 ] })
    }

    // palms on the corners, the middle stays open for driving
    for(const [ x, z ] of [ [ cx + 8.2, cz + 8.8 ], [ cx - 6.3, cz + 7.6 ] ] /* south side only: the north stays open toward Chinatown */)
        nodes.push(dynamicNode('palm', palmTree(5.5), ctx.at(x, z), [ { shape: 'tube', position: [ 0, 2, 0 ], radius: 0.3, height: 4 } ], 0.5))

    // granite paving: light and dark stripes like the real square (painted on, no bumps)
    {
        const paving = new Model()
        for(let i = 0; i < 9; i++)
        {
            const z = - 6.2 + i * 1.9
            paving.box([ 17.4, 0.02, 0.95 ], i % 2 ? C.slate : C.stone, [ 0, 0, z ])
        }
        nodes.push(meshNode('unionPaving', paving, ctx.at(cx - 0.3, cz - 2, 0.012)))
    }

    // the Dewey Monument: a slim granite column with the bronze Victory on top (on the east side, clear of the rink)
    {
        const m = new Model()
        m.box([ 1.8, 0.4, 1.8 ], C.stone)
        m.box([ 1.3, 1.6, 1.3 ], C.snow, [ 0, 0.4, 0 ])
        m.cylinder(0.32, 0.38, 9, C.snow, [ 0, 2, 0 ], 12)
        m.cylinder(0.55, 0.36, 0.7, C.cream, [ 0, 11, 0 ], 10)               // capital
        m.box([ 0.9, 0.25, 0.9 ], C.cream, [ 0, 11.7, 0 ])
        m.sphere(0.35, C.cream, [ 0, 12.1, 0 ], 1)                            // globe under the statue
        m.cylinder(0.12, 0.18, 1.1, C.sage, [ 0, 12.4, 0 ], 6)                 // Victory, verdigris bronze
        m.sphere(0.12, C.sage, [ 0, 13.6, 0 ], 1)
        m.beam([ 0, 13.2, 0 ], [ 0.7, 14.1, 0 ], 0.06, C.sage)                 // trident raised high
        m.beam([ 0, 13.1, 0 ], [ - 0.6, 12.7, 0.1 ], 0.06, C.sage)             // wreath arm
        m.add(new THREE.TorusGeometry(0.16, 0.04, 4, 10), C.sage, [ - 0.7, 12.65, 0.1 ])
        nodes.push(fixedNode('deweyMonument', m, ctx.at(cx + 7.2, cz + 3), [ { shape: 'tube', position: [ 0, 1, 0 ], radius: 0.8, height: 2 }, { shape: 'tube', position: [ 0, 6.5, 0 ], radius: 0.4, height: 9 } ]))
    }

    // café tables with green umbrellas (knockable) and globe street lamps
    {
        const r = rng(1850)
        for(const [ x, z ] of [ [ 3, 0.8 ], [ 6.8, 1.6 ], [ 3.2, 4.2 ], [ 6.6, 5 ] ])
        {
            const t = new Model()
            t.cylinder(0.05, 0.05, 1.7, C.dark, [ 0, 0, 0 ], 5)
            t.cone(0.75, 0.35, C.moss, [ 0, 1.6, 0 ], 8)
            t.cylinder(0.32, 0.32, 0.05, C.dark, [ 0, 0.7, 0 ], 10)
            for(let k = 0; k < 3; k++)
            {
                const a = k / 3 * Math.PI * 2 + r()
                t.box([ 0.24, 0.42, 0.24 ], C.dark, [ Math.cos(a) * 0.55, 0, Math.sin(a) * 0.55 ])
            }
            nodes.push(dynamicNode('cafeTable', t, ctx.at(cx + x, cz + z), [ { shape: 'tube', position: [ 0, 0.45, 0 ], radius: 0.45, height: 0.9 } ], 0.15))
        }
        for(const [ x, z ] of [ [ 8.4, 0 ], [ 8.4, 6 ], [ - 8.6, 1.5 ], [ - 2.2, 8.6 ], [ 4.2, 8.6 ] ])
        {
            const l = new Model()
            l.cylinder(0.12, 0.18, 2.6, C.wood, [ 0, 0, 0 ], 8)
            l.cylinder(0.22, 0.14, 0.3, C.wood, [ 0, 2.6, 0 ], 8)
            l.sphere(0.38, C.snow, [ 0, 3.25, 0 ], 1)
            nodes.push(dynamicNode('globeLamp', l, ctx.at(cx + x, cz + z), [ { shape: 'tube', position: [ 0, 1.5, 0 ], radius: 0.2, height: 3 } ], 0.25))
        }
    }

    // low terraced steps along the south edge
    {
        const steps = new Model()
        for(let k = 0; k < 3; k++)
            steps.box([ 4.5, 0.08 + k * 0.08, 0.5 ], C.stone, [ 0, 0, k * 0.5 ])
        for(const x of [ - 6, 6 ])
            nodes.push(meshNode('unionSteps', steps, ctx.at(cx + x, cz + 9.4)))
    }

    // hedges and leafy trees along the north and south edges (low, the car rolls past them)
    {
        const g = new Model()
        const r = rng(1902)
        for(const z of [ 9.9 ])                                              // south edge only: the north side opens onto Chinatown
            for(let x = - 8.5; x <= 8.5; x += 1.4)
            {
                if(z > 0 && Math.abs(x) < 3.5)
                    continue                                                   // the south entrance stays open
                const [ wx, wy, wz ] = ctx.at(cx + x, cz + z)
                g.sphere(0.45, C.moss, [ wx / ctx.S, wy / ctx.S, wz / ctx.S ], 1, [ 1.4, 0.7, 0.9 ])
                if(Math.round(x * 10) % 4 === 0)
                {
                    g.cylinder(0.08, 0.1, 1.2, C.wood, [ wx / ctx.S, wy / ctx.S, wz / ctx.S ], 5)
                    g.sphere(0.9 + r() * 0.3, r() < 0.5 ? C.leaf : C.sage, [ wx / ctx.S, wy / ctx.S + 1.9, wz / ctx.S ], 1, [ 1, 0.9, 1 ])
                }
            }
        nodes.push(meshNode('unionGreen', g, [ 0, 0, 0 ]))
    }


    return nodes
}

/** 4. Chinatown Dragon Gate */
builders.chinatown = (ctx) =>
{
    const nodes = []
    const cx = 24, cz = - 6
    // The Dragon Gate (like the real one at Bush & Grant): four white stone pillars, a tall center roof over the street and
    // two lower side roofs, green glazed tiles with upturned eaves on orange brackets, dragons chasing a pearl on the ridge,
    // the blue 天下為公 board, white plaques over the side passages, stone lions guarding it
    const gate = new Model()
    const pillars = [ - 5.6, - 4.0, 4.0, 5.6 ]
    for(const x of pillars)
    {
        gate.box([ 1.2, 0.35, 1.2 ], C.stone, [ x, 0, 0 ])                       // stepped base
        gate.box([ 0.95, 0.3, 0.95 ], C.snow, [ x, 0.35, 0 ])
        gate.box([ 0.7, 3.7, 0.7 ], C.snow, [ x, 0.65, 0 ])                      // white stone pillar
        for(const y of [ 1.5, 2.5, 3.5 ])
            gate.box([ 0.74, 0.06, 0.74 ], C.stone, [ x, y, 0 ])                 // carved panel lines
        gate.box([ 0.85, 0.25, 0.85 ], C.stone, [ x, 4.35, 0 ])
    }
    // a glazed tile roof: green ribs, a darker ridge, upturned eave tips, orange brackets underneath
    const roof = (cxr, y, w, d, h) =>
    {
        gate.box([ w - 0.6, 0.35, d - 0.3 ], C.orange, [ cxr, y - 0.35, 0 ])     // bracket band (dougong)
        for(let k = 0; k < Math.floor(w / 0.45); k++)
            gate.cbox([ 0.18, 0.25, 0.22 ], C.red, [ cxr - w / 2 + 0.5 + k * 0.45, y - 0.25, d / 2 - 0.1 ])
        gate.box([ w, 0.12, d ], C.red, [ cxr, y, 0 ])
        gate.gable(w, d + 0.3, h, C.sage, [ cxr, y + 0.12, 0 ])
        const ribs = Math.floor(w / 0.32)
        for(const side of [ - 1, 1 ])
            for(let k = 0; k <= ribs; k++)
                gate.cbox([ 0.12, 0.08, (d + 0.3) / 2 * 1.08 ], C.moss, [ cxr - w / 2 + k * w / ribs, y + 0.12 + h / 2, side * (d + 0.3) / 4 ], [ side * Math.atan2(h, (d + 0.3) / 2), 0, 0 ])
        gate.box([ w + 0.1, 0.22, 0.3 ], C.olive, [ cxr, y + 0.12 + h - 0.05, 0 ])   // ridge
        for(const sx of [ - 1, 1 ])
            for(const sz of [ - 1, 1 ])
                gate.cbox([ 0.25, 0.14, 0.7 ], C.sage, [ cxr + sx * (w / 2 - 0.05), y + 0.25, sz * (d / 2 + 0.1) ], [ sz * 0.5, sx * 0.6, sx * 0.4 ]) // upturned eaves
    }
    roof(0, 5.1, 9.6, 2.6, 1.05)
    roof(- 4.8, 4.4, 3.3, 2.0, 0.75)
    roof(4.8, 4.4, 3.3, 2.0, 0.75)
    gate.box([ 8.2, 0.45, 0.9 ], C.red, [ 0, 4.35, 0 ])                          // main beam
    // the blue 天下為公 board with its gold frame and characters
    for(const z of [ - 0.48, 0.48 ])
    {
        const f = z > 0 ? 1 : - 1
        gate.cbox([ 2.4, 1.0, 0.1 ], C.gold, [ 0, 3.9, z ])
        gate.cbox([ 2.15, 0.78, 0.12 ], C.sky, [ 0, 3.9, z + f * 0.01 ])
    }
    // white plaques with black characters over the side passages
    for(const x of [ - 4.8, 4.8 ])
        for(const z of [ - 0.42, 0.42 ])
        {
            gate.cbox([ 1.3, 0.4, 0.08 ], C.snow, [ x, 3.75, z ])
        }
    // dragons on the ridge, chasing the flaming pearl, fish finials at the ends
    for(const side of [ - 1, 1 ])
    {
        for(let k = 0; k < 8; k++)
        {
            const t = k / 7
            gate.sphere(0.16 - t * 0.05, C.gold, [ side * (0.55 + t * 2.4), 6.45 + Math.sin(t * Math.PI * 2) * 0.25, 0 ], 1)
        }
        gate.cbox([ 0.35, 0.3, 0.28 ], C.gold, [ side * 0.45, 6.6, 0 ])               // head
        gate.cbox([ 0.18, 0.4, 0.06 ], C.gold, [ side * 0.4, 6.95, 0 ], [ 0, 0, - side * 0.4 ]) // horns
        gate.cbox([ 0.3, 0.6, 0.2 ], C.sage, [ side * 4.75, 6.55, 0 ], [ 0, 0, side * 0.35 ]) // fish finial
        gate.cbox([ 0.35, 0.25, 0.15 ], C.sage, [ side * 4.95, 6.95, 0 ], [ 0, 0, side * 0.9 ])
    }
    gate.sphere(0.2, C.orange, [ 0, 6.7, 0 ], 1)                                    // the pearl
    gate.cone(0.12, 0.35, C.red, [ 0, 6.85, 0 ], 5)
    nodes.push(fixedNode('dragonGate', gate, ctx.at(cx, cz + 4), pillars.map(x => ({ position: [ x, 2.2, 0 ], size: [ 0.8, 4.4, 0.8 ] }))))

    // stone guardian lions on pedestals, either side of the gate
    for(const x of [ - 6.9, 6.9 ])
    {
        const lion = new Model()
        lion.box([ 1, 0.9, 1 ], C.stone)
        lion.box([ 1.1, 0.12, 1.1 ], C.slate, [ 0, 0.9, 0 ])
        lion.sphere(0.4, C.stone, [ 0, 1.35, 0.05 ], 1, [ 0.9, 1.1, 1.1 ])         // body, sitting up
        lion.sphere(0.32, C.stone, [ 0, 1.95, 0.25 ], 1)                            // head
        lion.sphere(0.22, C.slate, [ 0, 2.05, 0.18 ], 1, [ 1.6, 1.2, 1 ])          // curly mane
        lion.sphere(0.13, C.stone, [ x < 0 ? 0.2 : - 0.2, 1.25, 0.45 ], 1)         // paw on the ball
        nodes.push(fixedNode('fooDog', lion, ctx.at(cx + x, cz + 4.6), [ { position: [ 0, 1.1, 0 ], size: [ 1, 2.2, 1 ] } ]))
    }

    // shop houses along Grant Ave
    const colors = [ C.red, C.sage, C.cream, C.gold, C.peach ]
    // (4 rows: the north end stops short of the Lombard crooked block)
    for(let i = 0; i < 3; i++)
    {
        for(const side of [ - 1, 1 ])
        {
            const z = cz - 1 - i * 4
            const shop = new Model()
            shop.box([ 4, 3.6 + (i % 2) * 0.8, 3.8 ], colors[(i + (side > 0 ? 2 : 0)) % colors.length])
            shop.box([ 0.6, 0.15, 4 ], C.moss, [ - side * 2.1, 2.2, 0 ])
            shop.box([ 4.2, 0.2, 4 ], C.moss, [ 0, 3.6 + (i % 2) * 0.8, 0 ])
            shop.cbox([ 0.1, 1.4, 2.4 ], C.black, [ - side * 2.02, 0.9, 0 ])
            if(i === 1 && side === - 1)
                continue // the beef noodle restaurant takes this spot
            nodes.push(fixedNode('shop', shop, ctx.at(cx + side * 6.5, z), [ { position: [ 0, 2, 0 ], size: [ 4, 4, 3.8 ] } ]))
        }
    }

    /* 牛肉麵 restaurant (west side, second row), facing the street (+x) */
    {
        const z = cz - 5
        const shop = new Model()
        shop.box([ 4, 4.2, 3.8 ], C.cream)
        shop.box([ 4.2, 0.25, 4 ], C.red, [ 0, 4.2, 0 ])
        shop.box([ 4.3, 0.12, 4.1 ], C.gold, [ 0, 4.45, 0 ])
        // big red signboard with gold "characters" (three blocky glyphs) and a gold frame
        shop.box([ 0.2, 1.2, 3.4 ], C.red, [ 2.1, 3.3, 0 ])
        shop.cbox([ 0.22, 1.3, 0.1 ], C.gold, [ 2.11, 3.3, 1.72 ])
        shop.cbox([ 0.22, 1.3, 0.1 ], C.gold, [ 2.11, 3.3, - 1.72 ])
        for(const gz of [ - 1.05, 0, 1.05 ])
        {
            shop.cbox([ 0.24, 0.12, 0.7 ], C.gold, [ 2.12, 3.6, gz ])
            shop.cbox([ 0.24, 0.12, 0.7 ], C.gold, [ 2.12, 3.25, gz ])
            shop.cbox([ 0.24, 0.12, 0.7 ], C.gold, [ 2.12, 2.9, gz ])
            shop.cbox([ 0.24, 0.8, 0.12 ], C.gold, [ 2.12, 3.25, gz - 0.05 ])
        }
        // red and white striped awning
        for(let k = 0; k < 7; k++)
            shop.cbox([ 1.2, 0.08, 0.5 ], k % 2 ? C.snow : C.red, [ 2.55, 2.35, - 1.5 + k * 0.5 ], [ 0, 0, - 0.35 ])
        // open kitchen window with a steaming pot, a door with a lantern pair
        shop.cbox([ 0.08, 1.0, 1.6 ], C.black, [ 2.02, 1.5, - 0.9 ])
        shop.box([ 0.6, 0.9, 1.9 ], C.wood, [ 2.3, 0, - 0.9 ])                 // counter
        shop.cylinder(0.35, 0.3, 0.45, C.slate, [ 2.25, 0.9, - 0.9 ], 10)     // pot
        for(let k = 0; k < 4; k++)
            shop.sphere(0.16 + k * 0.03, C.snow, [ 2.25 + (k % 2) * 0.1, 1.55 + k * 0.35, - 0.9 ], 0)
        shop.cbox([ 0.08, 1.6, 0.8 ], C.wood, [ 2.02, 0.8, 1.0 ])
        for(const lz of [ 0.35, 1.65 ])
        {
            shop.sphere(0.2, C.red, [ 2.4, 2.0, lz ], 1, [ 1, 1.3, 1 ])
            shop.cbox([ 0.05, 0.3, 0.05 ], C.gold, [ 2.4, 1.65, lz ])
        }
        // two stools by the counter
        for(const sz of [ - 1.5, - 0.3 ])
            shop.cylinder(0.18, 0.18, 0.55, C.red, [ 2.95, 0, sz ], 8)
        nodes.push(fixedNode('beefNoodleShop', shop, ctx.at(cx - 6.5, z), [ { position: [ 0, 2.1, 0 ], size: [ 4, 4.2, 3.8 ] } ]))

        // the GIANT bowl of beef noodle soup, out in the street: knock it over!
        const bowl = new Model()
        // off-white ceramic bowl with fluted (ribbed) sides, like a real 牛肉麵 bowl
        bowl.cylinder(1.35, 0.78, 1.0, C.porcelain, [ 0, 0.1, 0 ], 28)
        bowl.cylinder(0.78, 0.72, 0.12, C.stone, [ 0, 0, 0 ], 20)               // foot
        bowl.add(new THREE.TorusGeometry(1.34, 0.06, 5, 32), C.porcelain, [ 0, 1.1, 0 ], [ Math.PI / 2, 0, 0 ]) // rim
        for(let k = 0; k < 28; k++)
        {
            const a = k / 28 * Math.PI * 2
            const tilt = Math.atan2(1.35 - 0.78, 1.0)                           // follow the taper of the bowl
            bowl.cbox([ 0.07, 1.0, 0.07 ], C.stone, [ Math.cos(a) * 1.08, 0.6, Math.sin(a) * 1.08 ], [ 0, - a, - tilt ])
        }
        // clear brown broth (on top of the solid bowl so it shows)
        bowl.cylinder(1.3, 1.3, 0.06, C.broth, [ 0, 1.1, 0 ], 28)
        const rb = rng(4242)
        // wide, flat, wavy hand-pulled noodles peeking out of the broth all around
        for(let k = 0; k < 26; k++)
        {
            const a = rb() * Math.PI * 2, d = 0.25 + rb() * 0.85
            bowl.cbox([ 0.5 + rb() * 0.25, 0.04, 0.16 ], C.noodle, [ Math.cos(a) * d, 1.15 + rb() * 0.04, Math.sin(a) * d ], [ (rb() - 0.5) * 0.5, rb() * Math.PI, (rb() - 0.5) * 0.4 ])
        }
        // big chunks of braised beef shank, piled together on one side (chunks, not a skewer)
        for(const [ bx, bz, sx, sy, sz ] of [ [ - 0.55, 0.25, 0.5, 0.36, 0.42 ], [ - 0.2, 0.55, 0.46, 0.34, 0.4 ], [ - 0.6, - 0.25, 0.44, 0.38, 0.46 ], [ - 0.15, 0.05, 0.48, 0.4, 0.42 ], [ 0.15, 0.6, 0.4, 0.32, 0.38 ] ])
            bowl.cbox([ sx, sy, sz ], C.beef, [ bx, 1.2 + sy * 0.3, bz ], [ (rb() - 0.5) * 0.5, rb() * Math.PI, (rb() - 0.5) * 0.5 ])
        // greens on the other side: bok choy / napa cabbage leaves with white stems, lots of green onion
        for(let k = 0; k < 6; k++)
        {
            const a = - 0.9 + k * 0.32, d = 0.5 + (k % 2) * 0.25
            bowl.sphere(0.26, C.leaf, [ Math.cos(a) * d + 0.25, 1.22, Math.sin(a) * d - 0.2 ], 1, [ 1.4, 0.35, 0.9 ])
            bowl.cbox([ 0.36, 0.08, 0.12 ], C.white, [ Math.cos(a) * d + 0.15, 1.2, Math.sin(a) * d - 0.15 ], [ 0, - a, 0 ])
        }
        for(let k = 0; k < 22; k++)                                             // chopped green onion
            bowl.cbox([ 0.08, 0.05, 0.08 ], k % 3 === 0 ? C.white : C.scallion, [ 0.35 + (rb() - 0.5) * 0.9, 1.3, - 0.15 + (rb() - 0.5) * 0.9 ], [ 0, rb() * 3, 0 ])
        bowl.cylinder(0.12, 0.08, 0.7, C.snow, [ - 0.95, 1.25, - 0.75 ], 6, [ 0.5, 0, - 0.6 ]) // soup spoon
        nodes.push(dynamicNode('refBeefNoodle', bowl, ctx.at(cx - 2.2, z), [ { shape: 'tube', position: [ 0, 0.6, 0 ], radius: 1.2, height: 1.1 } ], 0.7))

        // and a little noodle cart (攤) by the first shop
        const cart = new Model()
        cart.box([ 0.9, 0.8, 1.3 ], C.red, [ 0, 0.25, 0 ])
        cart.cylinder(0.25, 0.25, 0.1, C.dark, [ 0, 0.25, 0.65 ], 8, [ Math.PI / 2, 0, 0 ])
        cart.cylinder(0.25, 0.25, 0.1, C.dark, [ 0, 0.25, - 0.65 ], 8, [ Math.PI / 2, 0, 0 ])
        cart.cylinder(0.04, 0.04, 1.2, C.wood, [ 0.4, 1.05, 0.6 ], 4)
        cart.cylinder(0.04, 0.04, 1.2, C.wood, [ 0.4, 1.05, - 0.6 ], 4)
        cart.cbox([ 1.1, 0.06, 1.5 ], C.gold, [ 0.25, 2.25, 0 ], [ 0, 0, - 0.2 ])
        cart.cylinder(0.25, 0.22, 0.35, C.slate, [ 0, 1.05, 0.3 ], 8)
        cart.cylinder(0.2, 0.14, 0.18, C.snow, [ 0, 1.05, - 0.35 ], 8)
        nodes.push(dynamicNode('noodleCart', cart, ctx.at(cx - 3.7, cz - 1.6), [ { position: [ 0, 0.65, 0 ], size: [ 0.9, 1.1, 1.3 ] } ], 0.35))
    }
    return nodes
}

/** 5. Alcatraz */
builders.alcatraz = (ctx) =>
{
    // Like the real island: tan rock cliffs and scrub, the long cellhouse on the summit with the lighthouse at its
    // west end, a white water tower and the power house chimney, Building 64 by the dock, the ruined warden's house,
    // the exercise yard behind the cellhouse, and the ferry tied up at the dock.
    const nodes = []
    const cx = ctx.cx, cz = ctx.cz, k = ctx.S
    const P = (dx, dz, dy = 0) => ctx.at(cx + dx, cz + dz, dy)
    const localY = (dx, dz) => (ctx.ground(cx + dx * k, cz + dz * k) - ctx.y) / k
    const half = [ 19 / k, 12 / k ]                      // island ellipse in design units
    const inIsland = (dx, dz, m = 0) => (dx / (half[0] - m)) ** 2 + (dz / (half[1] - m)) ** 2 < 1
    const r = rng(1934)
    const keepOut = []                                    // design rects [x0, z0, x1, z1] (buildings, landing)

    /* Cellhouse */
    {
        const m = new Model()
        const L = 7, D = 2.8, H = 2.4
        m.box([ L + 1.8, 1.4, D + 1.2 ], C.stone, [ 0.5, - 1.4, 0 ])                 // plinth into the hill
        m.box([ L, H, D ], C.cream)
        m.box([ L + 0.15, 0.18, D + 0.15 ], C.stone, [ 0, H, 0 ])                    // parapet
        for(let i = 0; i < 6; i++)
            m.box([ 0.7, 0.22, 1.1 ], C.slate, [ - 2.9 + i * 1.16, H + 0.18, 0 ])     // skylights
        for(let i = 0; i < 12; i++)
            for(const y of [ 0.75, 1.65 ])
                for(const side of [ - 1, 1 ])
                    m.cbox([ 0.26, 0.62, 0.05 ], C.black, [ - 3.2 + i * 0.58, y, side * (D / 2 + 0.01) ])
        // administration wing at the east end, a bit taller, with the main door
        m.box([ 1.6, H + 0.5, D + 0.8 ], C.snow, [ L / 2 + 0.7, 0, 0 ])
        m.box([ 1.7, 0.16, D + 0.9 ], C.stone, [ L / 2 + 0.7, H + 0.5, 0 ])
        for(const z of [ - 1.2, - 0.6, 0.6, 1.2 ])
            for(const y of [ 0.8, 1.8 ])
                m.cbox([ 0.05, 0.5, 0.3 ], C.black, [ L / 2 + 1.51, y, z ])
        m.cbox([ 0.06, 1, 0.6 ], C.dark, [ L / 2 + 1.52, 0.5, 0 ])
        m.cylinder(0.03, 0.03, 1.4, C.dark, [ L / 2 + 0.7, H + 0.6, 0.9 ], 4)       // flag
        m.cbox([ 0.02, 0.35, 0.6 ], C.red, [ L / 2 + 0.7, H + 1.8, 1.2 ])
        nodes.push(fixedNode('cellhouse', m, P(- 0.4, - 0.9), [
            { position: [ 0, H / 2, 0 ], size: [ L, H, D ] },
            { position: [ L / 2 + 0.7, (H + 0.5) / 2, 0 ], size: [ 1.6, H + 0.5, D + 0.8 ] },
        ]))
        keepOut.push([ - 5, - 2.8, 4.8, 1 ])
    }

    /* Lighthouse at the west end, with the keeper's house */
    {
        const m = new Model()
        m.box([ 1.6, 0.8, 1.6 ], C.stone, [ 0, - 0.8, 0 ])
        m.cylinder(0.3, 0.42, 4.2, C.snow, [ 0, 0, 0 ], 8)
        m.cylinder(0.52, 0.52, 0.12, C.dark, [ 0, 4.2, 0 ], 8)
        m.cylinder(0.3, 0.3, 0.55, C.gold, [ 0, 4.32, 0 ], 8)
        m.cone(0.38, 0.4, C.dark, [ 0, 4.87, 0 ], 8)
        m.box([ 1.1, 0.9, 1 ], C.cream, [ 0.95, 0, 0.2 ])
        m.gable(1.2, 1.1, 0.45, C.brick, [ 0.95, 0.9, 0.2 ])
        nodes.push(fixedNode('lighthouse', m, P(- 5, 0.2), [ { shape: 'tube', position: [ 0, 2.1, 0 ], radius: 0.45, height: 4.2 }, { position: [ 0.95, 0.45, 0.2 ], size: [ 1.1, 0.9, 1 ] } ]))
        nodes.push(refNode('Searchlight', P(- 5, 0.2, 4.6)))
        keepOut.push([ - 5.8, - 0.7, - 3.9, 1 ])
    }

    /* Water tower (white tank on a steel frame) */
    {
        const m = new Model()
        for(const [ x, z ] of [ [ - 0.5, - 0.5 ], [ 0.5, - 0.5 ], [ - 0.5, 0.5 ], [ 0.5, 0.5 ] ])
        {
            m.beam([ x * 1.3, 0, z * 1.3 ], [ x, 3.2, z ], 0.07, C.dark)
            m.beam([ x * 1.3, 0.2, z * 1.3 ], [ - x * 1.15, 1.6, z * 1.15 ], 0.03, C.dark)
        }
        m.cylinder(0.78, 0.78, 1.1, C.snow, [ 0, 3.2, 0 ], 14)
        m.cone(0.82, 0.45, C.snow, [ 0, 4.3, 0 ], 14)
        nodes.push(fixedNode('waterTower', m, P(4.7, - 2), [ { position: [ 0, 1.6, 0 ], size: [ 1.6, 3.2, 1.6 ] } ]))
        keepOut.push([ 3.7, - 3, 5.7, - 1 ])
    }

    /* Power house with its tall chimney */
    {
        const m = new Model()
        m.box([ 1.5, 1.1, 1.1 ], C.brick)
        m.gable(1.6, 1.2, 0.4, C.slate, [ 0, 1.1, 0 ])
        m.cylinder(0.2, 0.3, 4.4, C.brick, [ 0.45, 0, 0 ], 8)
        m.cylinder(0.24, 0.24, 0.15, C.dark, [ 0.45, 4.4, 0 ], 8)
        nodes.push(fixedNode('powerHouse', m, P(2.6, - 3.4), [ { position: [ 0, 0.55, 0 ], size: [ 1.5, 1.1, 1.1 ] } ]))
        keepOut.push([ 1.6, - 4.2, 3.6, - 2.6 ])
    }

    /* Building 64, the barracks by the dock, with the penitentiary sign */
    {
        const m = new Model()
        m.box([ 3.2, 0.8, 1.7 ], C.stone, [ 0, - 0.8, 0 ])
        m.box([ 3, 1.9, 1.5 ], C.cream)
        m.box([ 3.1, 0.14, 1.6 ], C.stone, [ 0, 1.9, 0 ])
        for(let i = 0; i < 8; i++)
            for(const y of [ 0.45, 1.0, 1.5 ])
                m.cbox([ 0.18, 0.3, 0.05 ], C.black, [ - 1.3 + i * 0.37, y, 0.76 ])
        m.cbox([ 2.2, 0.22, 0.04 ], C.black, [ 0, 1.75, 0.78 ])                         // UNITED STATES PENITENTIARY
        m.cbox([ 1.9, 0.06, 0.05 ], C.snow, [ 0, 1.75, 0.8 ])
        nodes.push(fixedNode('building64', m, P(4.3, 2.4), [ { position: [ 0, 0.95, 0 ], size: [ 3, 1.9, 1.5 ] } ]))
        keepOut.push([ 2.6, 1.5, 6, 3.3 ])
    }

    /* Ruins of the warden's house: brick walls, no roof */
    {
        const m = new Model()
        m.box([ 1.8, 1.1, 0.12 ], C.brick, [ 0, 0, - 0.65 ])
        m.box([ 1.8, 0.7, 0.12 ], C.brick, [ 0, 0, 0.65 ])
        m.box([ 0.12, 1.1, 1.4 ], C.brick, [ - 0.85, 0, 0 ])
        m.box([ 0.12, 0.5, 1.4 ], C.brick, [ 0.85, 0, 0 ])
        m.box([ 0.3, 1.6, 0.3 ], C.brick, [ - 0.6, 0, - 0.5 ])
        for(const x of [ - 0.45, 0.35 ])
            m.cbox([ 0.3, 0.4, 0.14 ], C.black, [ x, 0.6, - 0.65 ])
        nodes.push(fixedNode('wardenRuins', m, P(- 3.2, 2.2), [ { position: [ 0, 0.55, - 0.65 ], size: [ 1.8, 1.1, 0.12 ] }, { position: [ - 0.85, 0.55, 0 ], size: [ 0.12, 1.1, 1.4 ] } ]))
        keepOut.push([ - 4.2, 1.4, - 2.2, 3 ])
    }

    /* Exercise yard behind the cellhouse: concrete walls and a guard tower */
    {
        const m = new Model()
        const w = 3.6, d = 1.3, h = 0.8
        m.box([ w, h, 0.15 ], C.stone, [ 0, 0, - d ])
        m.box([ 0.15, h, d ], C.stone, [ - w / 2, 0, - d / 2 ])
        m.box([ 0.15, h, d ], C.stone, [ w / 2, 0, - d / 2 ])
        m.box([ 0.5, 1.8, 0.5 ], C.stone, [ w / 2, 0, - d ])
        m.box([ 0.8, 0.5, 0.8 ], C.cream, [ w / 2, 1.8, - d ])
        m.cbox([ 0.82, 0.18, 0.82 ], C.black, [ w / 2, 2.1, - d ])
        nodes.push(fixedNode('exerciseYard', m, P(- 0.8, - 2.4), [
            { position: [ 0, h / 2, - d ], size: [ w, h, 0.15 ] },
            { position: [ - w / 2, h / 2, - d / 2 ], size: [ 0.15, h, d ] },
            { position: [ w / 2, h / 2, - d / 2 ], size: [ 0.15, h, d ] },
        ]))
        keepOut.push([ - 3, - 4, 1.4, - 2.3 ])
    }

    /* Dock and the ferry (in the water, absolute heights) */
    {
        const dock = new Model()
        dock.box([ 2.4, 0.12, 1.2 ], C.wood)
        for(const x of [ - 1, 0, 1 ])
            for(const z of [ - 0.5, 0.5 ])
                dock.cylinder(0.07, 0.07, 1, C.wood, [ x, - 1, z ], 5)
        nodes.push(fixedNode('alcatrazDock', dock, ctx.atWorld([ 9, 0.25 - 0.12 * k, - 70.2 ]), [ { position: [ 0, 0.06, 0 ], size: [ 2.4, 0.12, 1.2 ] } ]))

        // the Alcatraz Cruises ferry (sails around the bay, see Ferry.js): black hull, white decks, window bands
        const boat = new Model()
        boat.box([ 1.3, 0.45, 3.6 ], C.black, [ 0, - 0.3, 0 ])                             // hull
        boat.cone(0.65, 0.9, C.black, [ 0, - 0.08, - 2.25 ], 4, [ - Math.PI / 2, Math.PI / 4, 0 ])
        boat.box([ 1.32, 0.08, 3.62 ], C.snow, [ 0, 0.15, 0 ])                             // white rub rail
        boat.box([ 1.25, 0.55, 3.3 ], C.snow, [ 0, 0.2, 0.1 ])                             // main deck cabin
        boat.box([ 1.27, 0.22, 3.0 ], C.dark, [ 0, 0.38, 0.15 ])                           // windows
        boat.box([ 1.15, 0.5, 2.7 ], C.snow, [ 0, 0.75, 0.3 ])                             // upper deck
        boat.box([ 1.17, 0.18, 2.4 ], C.dark, [ 0, 0.9, 0.35 ])
        boat.box([ 0.9, 0.4, 0.8 ], C.snow, [ 0, 1.25, - 0.45 ])                           // wheelhouse
        boat.box([ 0.92, 0.15, 0.82 ], C.dark, [ 0, 1.4, - 0.45 ])
        for(const side of [ - 1, 1 ])
        {
            const label = new Model()
            pixelText(label, 'ALCATRAZ CRUISES', C.dark, [ 0, 0, 0 ], 0.035, { depth: 0.02 })
            boat.merge(label, [ side * 0.59, 1.04, 0.35 ], [ 0, side * Math.PI / 2, 0 ])
            boat.box([ 0.03, 0.12, 2.6 ], C.snow, [ side * 0.56, 1.25, 0.3 ])           // top deck railing
        }
        const rp = rng(1934)
        for(let k = 0; k < 10; k++)                                                        // passengers on the top deck
        {
            const x = (rp() - 0.5) * 0.9, z = 0.2 + rp() * 1.6
            boat.cbox([ 0.12, 0.2, 0.1 ], [ C.red, C.sky, C.gold, C.snow, C.pink ][k % 5], [ x, 1.35, z ])
            boat.sphere(0.06, [ C.peach, C.khaki, C.wood ][k % 3], [ x, 1.5, z ], 0)
        }
        boat.cylinder(0.02, 0.02, 0.6, C.dark, [ 0, 1.6, - 0.45 ], 4)                     // mast and flag
        boat.cbox([ 0.01, 0.15, 0.25 ], C.red, [ 0, 2.1, - 0.33 ])
        nodes.push(meshNode('alcatrazFerry', boat, ctx.atWorld([ 20, 0, - 74 ])))
    }

    /* The landing from the boardwalk and the path up stay clear */
    const landing = [ (6.8 - cx) / k, (- 73.5 - cz) / k ]
    keepOut.push([ landing[0] - 1.2, landing[1] - 2.6, landing[0] + 1.2, landing[1] + 1.5 ])
    const clear = (dx, dz, m = 0) => !keepOut.some(([ x0, z0, x1, z1 ]) => dx > x0 - m && dx < x1 + m && dz > z0 - m && dz < z1 + m)

    /* Tan rock cliffs around the shore and below the summit, scrub and little trees on the slopes */
    {
        const rocks = new Model()
        const scrub = new Model()
        for(let i = 0; i < 70; i++)
        {
            const a = i / 70 * Math.PI * 2 + r() * 0.05
            const f = 0.9 + r() * 0.08
            const dx = Math.cos(a) * half[0] * f, dz = Math.sin(a) * half[1] * f
            if(!clear(dx, dz, 0.6) || Math.hypot((dx - (9 - cx) / k), (dz - (- 70.2 - cz) / k)) < 1.6)
                continue
            const s = [ 0.35 + r() * 0.35, 0.3 + r() * 0.4, 0.3 + r() * 0.3 ]
            rocks.cbox(s, r() < 0.7 ? C.khaki : C.stone, [ dx, localY(dx, dz) + s[1] * 0.2, dz ], [ (r() - 0.5) * 0.4, - a + r(), (r() - 0.5) * 0.4 ])
        }
        // cliff faces under the summit (the cellhouse terrace)
        for(let i = 0; i < 34; i++)
        {
            const a = i / 34 * Math.PI * 2
            const dx = - 0.4 + Math.cos(a) * 4.4, dz = - 0.9 + Math.sin(a) * 3.3
            if(!inIsland(dx, dz, 0.8) || !clear(dx, dz, 0.3))
                continue
            const s = [ 0.9 + r() * 0.5, 0.8 + r() * 0.5, 0.6 + r() * 0.3 ]
            rocks.cbox(s, C.khaki, [ dx, localY(dx, dz) + s[1] * 0.1, dz ], [ 0, - a + Math.PI / 2, (r() - 0.5) * 0.3 ])
        }
        nodes.push(meshNode('alcatrazRocks', rocks, P(0, 0)))
        for(let i = 0; i < 160 ; i++)
        {
            const dx = (r() * 2 - 1) * half[0], dz = (r() * 2 - 1) * half[1]
            if(!inIsland(dx, dz, 0.9) || !clear(dx, dz, 0.4))
                continue
            const y = localY(dx, dz)
            if(r() < 0.12)
            {
                scrub.cylinder(0.05, 0.07, 0.6, C.wood, [ dx, y, dz ], 4)
                scrub.sphere(0.4 + r() * 0.2, C.moss, [ dx, y + 0.8, dz ], 1, [ 1, 0.85, 1 ])
            }
            else
                scrub.sphere(0.18 + r() * 0.22, [ C.moss, C.sage, C.olive, C.leaf ][Math.floor(r() * 4)], [ dx, y + 0.05, dz ], 1, [ 1.2, 0.55, 1 ])
        }
        nodes.push(meshNode('alcatrazScrub', scrub, P(0, 0)))
    }
    return nodes
}

/** 6. Pier 39 */
builders.pier39 = (ctx) =>
{
    const nodes = []
    const cx = 36, deckY = 0.25
    const z0 = - 52, z1 = - 66
    // world x/z spread by the site scale, absolute heights (the deck sits just above the water)
    const local = (x, y, z) => [ (x - ctx.cx) * ctx.S, y - ctx.y, (z - ctx.cz) * ctx.S ]

    const deck = new Model()
    deck.box([ 10, 0.4, z0 - z1 ], C.wood, [ 0, - 0.4, 0 ])
    for(let z = z1 + 1; z < z0; z += 3)
        for(const x of [ - 4.5, 4.5 ])
            deck.cylinder(0.25, 0.25, 2, C.wood, [ x, - 2.4, z - (z0 + z1) / 2 ], 5)
    // railings
    deck.box([ 0.15, 0.7, z0 - z1 ], C.snow, [ - 5, 0, 0 ])
    deck.box([ 0.15, 0.7, z0 - z1 ], C.snow, [ 5, 0, 0 ])
    nodes.push(fixedNode('pierDeck', deck, local(cx, deckY, (z0 + z1) / 2), [
        { position: [ 0, - 0.2, 0 ], size: [ 10, 0.4, z0 - z1 ] },
        { position: [ - 5, 0.35, 0 ], size: [ 0.15, 0.7, z0 - z1 ] },
        { position: [ 5, 0.35, 0 ], size: [ 0.15, 0.7, z0 - z1 ] },
    ]))
    // ramp from the street onto the deck
    const ramp = new Model()
    ramp.box([ 10, 0.3, 3 ], C.wood, [ 0, - 0.3, 0 ])
    nodes.push(fixedNode('pierRamp', ramp, local(cx, deckY - 0.05, z0 + 1.2), [ { position: [ 0, - 0.15, 0 ], size: [ 10, 0.3, 3 ] } ]))

    // two storey weathered wood shops (like the real pier), awnings, shop signs and balconies
    const shopColors = [ C.sky, C.red, C.gold, C.sage ]
    const shopNames = [ 'CRAB', 'FUDGE', 'CREPES', 'GIFTS' ]
    for(let i = 0; i < 4; i++)
    {
        const shop = new Model()
        shop.box([ 2.6, 2.4, 3 ], C.wood)
        shop.box([ 2.4, 1.6, 2.8 ], C.khaki, [ - 0.1, 2.4, 0 ])                    // upper floor
        shop.gable(3.2, 3, 0.9, C.slate, [ - 0.1, 4.0, 0 ])
        shop.cbox([ 0.9, 0.12, 3 ], shopColors[i], [ 1.6, 1.9, 0 ], [ 0, 0, - 0.3 ])   // awning
        shop.cbox([ 0.06, 1.2, 1.4 ], C.black, [ 1.32, 0.9, 0 ])                      // shop window
        for(const z of [ - 0.8, 0.8 ])
            shop.cbox([ 0.06, 0.6, 0.6 ], C.black, [ 1.12, 3.2, z ])                   // upstairs windows
        shop.box([ 0.5, 0.08, 3 ], C.wood, [ 1.35, 2.4, 0 ])                          // balcony
        shop.cbox([ 0.06, 0.45, 3 ], C.snow, [ 1.58, 2.7, 0 ])                        // balcony rail
        shop.cbox([ 0.08, 0.5, 2.4 ], shopColors[i], [ 1.33, 2.0, 0 ])                // name board
        const label = new Model()
        pixelText(label, shopNames[i], C.snow, [ 0, 1.82, 0 ], 0.075)
        shop.merge(label, [ 1.38, 0, 0 ], [ 0, Math.PI / 2, 0 ])
        const x = i % 2 ? cx + 3.2 : cx - 3.2
        nodes.push({ ...fixedNode('pierShop', shop, local(x, deckY, - 56 - Math.floor(i / 2) * 5), [ { position: [ 0, 1.6, 0 ], size: [ 2.6, 3.2, 3 ] } ]), rotation: [ 0, i % 2 ? Math.PI : 0, 0 ] })
    }

    // lamp posts with red Christmas bows along the rails, and strings of bulbs criss-crossing the deck
    const decor = new Model()
    const bulbs = new Model()
    for(let z = z0 - 2; z > z1 + 1; z -= 3)
    {
        for(const side of [ - 1, 1 ])
        {
            const x = side * 4.6
            decor.cylinder(0.07, 0.09, 3, C.dark, [ x, 0, z - (z0 + z1) / 2 ], 6)
            decor.sphere(0.2, C.cream, [ x, 3.1, z - (z0 + z1) / 2 ], 1)
            decor.sphere(0.16, C.red, [ x, 2.3, z - (z0 + z1) / 2 + side * 0.05 ], 0, [ 1.6, 1, 0.6 ])  // bow
            decor.cbox([ 0.08, 0.5, 0.08 ], C.red, [ x, 2.0, z - (z0 + z1) / 2 ], [ 0, 0, 0.3 ])
            bulbs.sphere(0.12, C.gold, [ x, 3.1, z - (z0 + z1) / 2 ], 1)
        }
        for(let k = 0; k <= 12; k++)
        {
            const t = k / 12
            bulbs.sphere(0.07, C.gold, [ - 4.6 + 9.2 * t, 3.0 - Math.sin(t * Math.PI) * 0.6, z - 1.5 * t - (z0 + z1) / 2 ], 0)
        }
    }
    nodes.push(meshNode('pierDecor', decor, local(cx, deckY, (z0 + z1) / 2)))
    nodes.push({ ...meshNode('pierLights', bulbs, local(cx, deckY, (z0 + z1) / 2)), mesh: { geometry: bulbs.geometry(), material: 'emissiveOrangeRadialGradient' } })

    // the famous crab statue: a bronze crab whose back is a planter of yellow succulents, huge raised claws,
    // jointed legs gripping the red planter box full of flowers
    {
        const crab = new Model()
        const bronze = C.olive, dark = C.dark
        crab.box([ 2.2, 0.55, 2.2 ], C.red)                                          // red planter
        crab.box([ 2.3, 0.1, 2.3 ], C.brick, [ 0, 0.55, 0 ])
        const rr = rng(390)
        for(let k = 0; k < 24; k++)                                                  // flowers around the base
            crab.sphere(0.1, [ C.gold, C.pink, C.snow, C.purple ][k % 4], [ - 1 + rr() * 2, 0.68, (k % 2 ? 1 : - 1) * (0.8 + rr() * 0.25) ], 0)
        // carapace: a wide bronze shell, its top a mound of succulents and yellow blooms
        crab.sphere(0.85, bronze, [ 0, 1.3, 0 ], 2, [ 1.35, 0.55, 1.05 ])
        crab.sphere(0.8, C.moss, [ 0, 1.5, 0 ], 1, [ 1.25, 0.5, 0.95 ])
        for(let k = 0; k < 40; k++)
        {
            const a = rr() * Math.PI * 2, d = Math.sqrt(rr()) * 0.85
            crab.sphere(0.07 + rr() * 0.06, k % 3 ? C.gold : C.sage, [ Math.cos(a) * d * 1.15, 1.72 + (0.9 - d) * 0.2, Math.sin(a) * d * 0.85 ], 0)
        }
        // bronze spots on the rim of the shell
        for(let k = 0; k < 14; k++)
        {
            const a = k / 14 * Math.PI * 2
            crab.sphere(0.07, dark, [ Math.cos(a) * 1.12, 1.3, Math.sin(a) * 0.86 ], 0)
        }
        // eyes on stalks
        for(const side of [ - 1, 1 ])
        {
            crab.cylinder(0.035, 0.035, 0.55, bronze, [ side * 0.22, 1.55, - 0.75 ], 4)
            crab.sphere(0.08, dark, [ side * 0.22, 2.12, - 0.75 ], 1)
        }
        // four jointed legs a side, splayed out and gripping the planter
        for(const side of [ - 1, 1 ])
            for(let l = 0; l < 4; l++)
            {
                const z = - 0.45 + l * 0.32
                const hip = [ side * 0.95, 1.2, z ], knee = [ side * 1.6, 1.65, z * 1.35 ], foot = [ side * 1.95, 0.6, z * 1.6 ]
                crab.beam(hip, knee, 0.11, bronze)
                crab.beam(knee, foot, 0.08, bronze)
                crab.sphere(0.08, dark, knee, 0)
            }
        // the big claws, raised high: arm segments up to wide, toothed pincers
        for(const side of [ - 1, 1 ])
        {
            const shoulder = [ side * 0.7, 1.45, - 0.7 ], elbow = [ side * 1.25, 2.3, - 1.05 ], wrist = [ side * 1.15, 3.05, - 1.0 ]
            crab.beam(shoulder, elbow, 0.16, bronze)
            crab.beam(elbow, wrist, 0.14, bronze)
            crab.sphere(0.13, dark, elbow, 0)
            crab.sphere(0.42, bronze, [ side * 1.12, 3.45, - 0.98 ], 1, [ 0.75, 1.15, 0.45 ])        // the palm of the claw
            for(let k = 0; k < 6; k++)
                crab.sphere(0.05, dark, [ side * (1.12 + (k % 2 ? 0.18 : - 0.18)), 3.2 + k * 0.12, - 1.18 ], 0)
            crab.cbox([ 0.16, 0.9, 0.22 ], bronze, [ side * 1.3, 4.1, - 0.98 ], [ 0, 0, side * 0.25 ])  // fixed finger
            crab.cbox([ 0.14, 0.75, 0.2 ], bronze, [ side * 0.88, 4.0, - 0.98 ], [ 0, 0, - side * 0.45 ]) // moving finger (open)
        }
        nodes.push(fixedNode('crabStatue', crab, local(cx - 3.4, deckY, - 53.3), [ { position: [ 0, 1, 0 ], size: [ 2.2, 2, 2.2 ] } ]))
    }

    // carousel
    const carousel = new Model()
    carousel.cylinder(2.2, 2.2, 0.3, C.snow, [ 0, 0, 0 ], 12)
    carousel.cylinder(0.3, 0.3, 2.6, C.gold, [ 0, 0.3, 0 ], 8)
    for(let i = 0; i < 8; i++)
    {
        const a = i / 8 * Math.PI * 2
        carousel.cylinder(0.05, 0.05, 2.2, C.gold, [ Math.cos(a) * 1.7, 0.3, Math.sin(a) * 1.7 ], 4)
        carousel.box([ 0.3, 0.5, 0.7 ], [ C.pink, C.sky, C.snow, C.gold ][i % 4], [ Math.cos(a) * 1.7, 0.9, Math.sin(a) * 1.7 ], [ 0, - a, 0 ])
    }
    carousel.cone(2.6, 1.2, C.red, [ 0, 2.8, 0 ], 12)
    carousel.sphere(0.2, C.gold, [ 0, 4.1, 0 ], 0)
    nodes.push(fixedNode('carousel', carousel, local(cx, deckY, - 62.5), [ { shape: 'tube', position: [ 0, 1.5, 0 ], radius: 2.2, height: 3 } ]))

    // PIER 39 gateway: wooden towers either side of the entrance, the blue sign across, a cupola and the flag on top
    {
        const gate = new Model()
        for(const side of [ - 1, 1 ])
        {
            gate.box([ 0.8, 4.6, 0.8 ], C.wood, [ side * 4.55, 0, 0 ])
            gate.box([ 0.95, 0.2, 0.95 ], C.snow, [ side * 4.55, 4.6, 0 ])
        }
        gate.box([ 10, 0.7, 0.5 ], C.wood, [ 0, 4.6, 0 ])
        gate.box([ 7.2, 1.3, 0.3 ], C.sky, [ 0, 4.9, 0.25 ])                // the blue sign
        gate.box([ 7.4, 0.1, 0.32 ], C.snow, [ 0, 4.85, 0.25 ])
        gate.box([ 7.4, 0.1, 0.32 ], C.snow, [ 0, 6.15, 0.25 ])
        pixelText(gate, 'PIER 39', C.snow, [ 0, 5.15, 0.42 ], 0.17, { depth: 0.06 })
        pixelText(gate, 'PIER 39', C.snow, [ 0, 5.15, 0.08 ], 0.17, { depth: 0.06, back: true })
        gate.cylinder(0.75, 0.85, 0.9, C.snow, [ 0, 6.2, 0 ], 8)              // octagonal cupola
        for(let k = 0; k < 8; k++)
        {
            const a = k / 8 * Math.PI * 2
            gate.cbox([ 0.22, 0.4, 0.04 ], C.dark, [ Math.cos(a) * 0.8, 6.65, Math.sin(a) * 0.8 ], [ 0, - a + Math.PI / 2, 0 ])
        }
        gate.cone(0.95, 0.5, C.slate, [ 0, 7.1, 0 ], 8)
        gate.cylinder(0.03, 0.03, 1.6, C.snow, [ 0, 7.6, 0 ], 4)              // flag
        gate.cbox([ 0.9, 0.5, 0.02 ], C.red, [ 0.47, 8.9, 0 ])
        gate.cbox([ 0.38, 0.26, 0.03 ], C.sky, [ 0.21, 9.03, 0 ])
        for(let k = 0; k < 3; k++)
            gate.cbox([ 0.9, 0.05, 0.025 ], C.snow, [ 0.47, 8.72 + k * 0.1, 0 ])
        nodes.push(fixedNode('pierGate', gate, local(cx, deckY, z0 + 0.4), [
            { position: [ - 4.55, 2.3, 0 ], size: [ 0.8, 4.6, 0.8 ] },
            { position: [ 4.55, 2.3, 0 ], size: [ 0.8, 4.6, 0.8 ] },
        ]))
    }

    // Sea lion floats west of the pier, with sea lions you can push around
    const r = rng(39)
    for(let f = 0; f < 3; f++)
    {
        const fx = cx - 9 - (f % 2) * 4, fz = - 56 - f * 3.4
        const float = new Model()
        float.box([ 3.6, 0.35, 2.6 ], C.khaki)
        nodes.push(fixedNode('seaLionFloat', float, local(fx, - 0.45, fz), [ { position: [ 0, 0.17, 0 ], size: [ 3.6, 0.35, 2.6 ] } ]))
        for(let s = 0; s < 3; s++)
        {
            const lion = new Model()
            lion.sphere(0.45, C.wood, [ 0, 0.35, 0 ], 1, [ 1, 0.8, 1.9 ])
            lion.sphere(0.28, C.wood, [ 0, 0.75, - 0.75 ], 1)
            lion.cbox([ 0.1, 0.1, 0.2 ], C.black, [ 0, 0.78, - 1.02 ])
            lion.cbox([ 0.9, 0.08, 0.3 ], C.olive, [ 0, 0.12, 0.5 ])
            nodes.push(dynamicNode('refSeaLion', lion, local(fx - 1.1 + s * 1.1, - 0.1 + 0.02, fz + (r() - 0.5) * 0.8), [ { shape: 'ball', position: [ 0, 0.45, 0 ], radius: 0.45 } ], 0.6, [ 0, r() * Math.PI * 2, 0 ]))
        }
    }

    // Giant clams (蛤蠣) on their own floats next to the sea lions: Jessica's favourite
    const clam = (seed) =>
    {
        const rr = rng(seed)
        const m = new Model()
        const shell = (y, flip, open) =>
        {
            const g = new THREE.SphereGeometry(1, 16, 6, 0, Math.PI * 2, 0, Math.PI / 2)
            m.add(g, rr() < 0.5 ? C.cream : C.khaki, [ 0, y, 0 ], [ flip ? Math.PI - open : - open, 0, 0 ], [ 1, 0.38, 0.85 ])
            // growth ridges
            for(let k = 1; k <= 3; k++)
                m.add(new THREE.TorusGeometry(0.28 * k, 0.025, 3, 20, Math.PI), C.wood, [ 0, y + (flip ? - 0.02 : 0.02) * k, 0.1 ], [ Math.PI / 2 + (flip ? Math.PI - open : - open), 0, 0 ], [ 1, 0.85, 1 ])
        }
        shell(0.38, true, 0)       // bottom shell
        shell(0.42, false, 0.45)   // top shell, propped open
        m.sphere(0.55, C.peach, [ 0, 0.42, 0.1 ], 1, [ 1.2, 0.35, 0.9 ]) // the clam
        m.sphere(0.16, C.snow, [ 0.25, 0.55, 0.25 ], 1)                  // a pearl
        return m
    }
    let seed = 500
    for(const [ fx, fz ] of [ [ cx - 13.4, - 56 ], [ cx - 13.4, - 62.8 ] ])
    {
        const float = new Model()
        float.box([ 3.6, 0.35, 2.6 ], C.khaki)
        nodes.push(fixedNode('clamFloat', float, local(fx, - 0.45, fz), [ { position: [ 0, 0.17, 0 ], size: [ 3.6, 0.35, 2.6 ] } ]))
        for(const dx of [ - 0.85, 0.85 ])
            nodes.push(dynamicNode('clam', clam(seed++), local(fx + dx, - 0.08, fz), [ { position: [ 0, 0.45, 0 ], size: [ 1.6, 0.8, 1.4 ] } ], 0.35, [ 0, r() * Math.PI * 2, 0 ]))
    }
    // a couple more washed up on the sea lion floats
    for(const [ fx, fz ] of [ [ cx - 9 + 1.9, - 56 ], [ cx - 9 + 1.9, - 62.8 ] ])
        nodes.push(dynamicNode('clam', clam(seed++), local(fx, - 0.08, fz), [ { position: [ 0, 0.45, 0 ], size: [ 1.6, 0.8, 1.4 ] } ], 0.35, [ 0, r() * Math.PI * 2, 0 ]))

    // Clam chowder in a sourdough bread bowl (Fisherman's Wharf classic), on the pier between the shops
    const chowder = new Model()
    chowder.sphere(1.1, C.khaki, [ 0, 0.75, 0 ], 2, [ 1, 0.72, 1 ])                   // sourdough loaf
    chowder.sphere(1.0, C.wood, [ 0, 0.62, 0 ], 2, [ 1.04, 0.55, 1.04 ])             // darker crust base
    for(const a of [ 0.4, 1.4, 2.6, 3.9, 5.1 ])                                       // flour scoring
        chowder.cbox([ 0.06, 0.04, 0.5 ], C.cream, [ Math.cos(a) * 0.95, 0.95, Math.sin(a) * 0.95 ], [ 0.6, - a, 0 ])
    chowder.cylinder(0.82, 0.82, 0.06, C.cream, [ 0, 1.42, 0 ], 18)                  // the chowder
    for(let k = 0; k < 10; k++)
        chowder.cbox([ 0.14, 0.08, 0.14 ], k % 2 ? C.khaki : C.peach, [ Math.cos(k * 2.1) * 0.5, 1.47, Math.sin(k * 2.1) * 0.5 ]) // potato & clam bits
    for(let k = 0; k < 8; k++)
        chowder.cbox([ 0.06, 0.03, 0.06 ], C.moss, [ Math.cos(k * 1.3) * 0.35, 1.5, Math.sin(k * 1.7) * 0.4 ]) // parsley
    chowder.sphere(0.55, C.khaki, [ 1.15, 0.35, 0.6 ], 1, [ 1, 0.55, 1 ])             // the bread lid on the side
    chowder.cylinder(0.08, 0.12, 0.9, C.snow, [ - 0.4, 1.7, 0.3 ], 6, [ 0.6, 0, 0.4 ]) // spoon
    for(let k = 0; k < 5; k++)                                                        // oyster crackers
        chowder.sphere(0.1, C.cream, [ - 1.2 + (k % 3) * 0.2, 0.08, - 0.8 + Math.floor(k / 3) * 0.2 ], 0)
    for(let k = 0; k < 3; k++)
        chowder.sphere(0.2 + k * 0.06, C.snow, [ (k - 1) * 0.25, 1.9 + k * 0.35, 0 ], 0)    // steam
    nodes.push(dynamicNode('clamChowder', chowder, local(cx, deckY, - 58.5), [ { shape: 'ball', position: [ 0, 0.8, 0 ], radius: 1.0 } ], 0.5))
    return nodes
}

/** 7. Cable car + Lombard */
builders.lombard = (ctx) =>
{
    const nodes = []
    const { hydeX, firstLegX, hairpins, spacing, north, south, lane } = Layout.lombard
    const r = spacing / 2
    const lastX = firstLegX + hairpins * spacing
    const edgeN = north - r - lane / 2 - 0.55 // outer hedges, north and south of the block
    const edgeS = south + r + lane / 2 + 0.55
    const blooms = [ C.pink, C.blush, C.lavender, C.sky, C.snow, C.pink, C.purple, C.blush ] // hydrangeas: pink, blue, white, violet
    const r0 = rng(77)

    // a clipped box hedge with hydrangea / rose blooms on top, running along z
    const bed = (length, width, height, seed) =>
    {
        const rr = rng(seed)
        const m = new Model()
        m.box([ width, 0.18, length ], C.brick)                    // brick curb
        m.box([ width - 0.12, height, length - 0.12 ], C.moss, [ 0, 0.1, 0 ])
        // leafy shrub mounds, each crowned with a round hydrangea head (a cluster of little florets)
        const count = Math.max(2, Math.round(length / 0.6))
        for(let k = 0; k < count; k++)
        {
            const z = - length / 2 + 0.3 + (length - 0.6) * k / (count - 1)
            const x = (rr() - 0.5) * Math.max(0, width - 0.5)
            m.sphere(0.3, rr() < 0.5 ? C.moss : C.sage, [ x, height + 0.08, z ], 1, [ 1.2, 0.6, 1.1 ])
            const color = blooms[Math.floor(rr() * blooms.length)]
            const y = height + 0.3
            m.sphere(0.19, color, [ x, y, z ], 1)
            for(let f = 0; f < 4; f++)
            {
                const a = f / 4 * Math.PI * 2 + rr()
                m.sphere(0.12, color, [ x + Math.cos(a) * 0.13, y + 0.04 + rr() * 0.06, z + Math.sin(a) * 0.13 ], 1)
            }
        }
        // Christmas: fairy lights draped along both edges of every hedge and bed, a red bow now and then
        for(const ex of [ - 1, 1 ])
            for(let z = - length / 2 + 0.15; z <= length / 2 - 0.1; z += 0.32)
                bulb(m, [ ex * (width / 2 - 0.02), height + 0.12 + Math.abs(Math.sin(z * 4.9)) * 0.08, z ], 0.07)
        for(let z = - length / 2 + 0.6; z < length / 2; z += 2.2)
            m.cbox([ 0.22, 0.14, 0.1 ], C.red, [ - width / 2 - 0.02, height + 0.05, z ], [ 0, Math.PI / 2, 0 ])
        return m
    }

    // Flower beds filling every bend: they are what makes the car follow the switchbacks
    for(let k = 0; k < hairpins; k++)
    {
        const x = firstLegX + k * spacing + r
        const atSouth = k % 2 === 0
        const z0 = atSouth ? south : north           // hairpin center (round end of the bed)
        const z1 = atSouth ? edgeN + 0.3 : edgeS - 0.3 // open end, against the outer hedge
        const length = Math.abs(z1 - z0)
        const width = spacing - lane - 0.05
        const m = bed(length, width, 0.22, 300 + k)
        m.cylinder(width / 2, width / 2, 0.32, C.moss, [ 0, 0, (atSouth ? 1 : - 1) * length / 2 ], 10)
        litPine(m, [ 0, 0.3, (atSouth ? 1 : - 1) * length / 2 ], 0.75)        // a lit little Christmas tree in each bend
        nodes.push(fixedNode('lombardBed', m, ctx.at(x, (z0 + z1) / 2), [ { position: [ 0, 0.15, 0 ], size: [ width - 0.25, 0.3, length ] } ]))
    }
    // bed between Hyde St and the first leg, and between the last leg and Grant Ave
    {
        const xa = hydeX + 2.2 + 0.1, xb = firstLegX - lane / 2 - 0.1
        const length = edgeS - (north - r + lane / 2 + 0.2)
        nodes.push(fixedNode('lombardBed', bed(length, xb - xa, 0.22, 290), ctx.at((xa + xb) / 2, edgeS - length / 2), [ { position: [ 0, 0.15, 0 ], size: [ xb - xa, 0.3, length ] } ]))
        const length2 = south - 0.8 - (edgeN + 0.3)
        nodes.push(fixedNode('lombardBed', bed(length2, 1, 0.22, 291), ctx.at(lastX + lane / 2 + 0.7, edgeN + 0.3 + length2 / 2), [ { position: [ 0, 0.15, 0 ], size: [ 1, 0.3, length2 ] } ]))
    }
    // outer hedges along both sides of the crooked block (cut in short pieces so they follow the slope)
    for(const [ z, x0, x1 ] of [ [ edgeN, hydeX + 2.6, lastX + 2.2 ], [ edgeS, hydeX + 2.6, lastX - 1 ] ])
    {
        for(let x = x0; x < x1 - 0.5; x += 2)
        {
            const len = Math.min(2, x1 - x)
            const m = bed(len, 0.8, 0.4, Math.round(x * 10) + (z > - 35 ? 500 : 900))
            nodes.push({ ...fixedNode('lombardHedge', m, ctx.at(x + len / 2, z), [ { position: [ 0, 0.25, 0 ], size: [ 0.8, 0.5, len ] } ]), rotation: [ 0, Math.PI / 2, 0 ] })
        }
    }
    // stone stairs for walkers on both sides (visual), stepping down the hill
    const stairs = new Model()
    for(const z of [ edgeN - 1.1, edgeS + 1.1 ])
    {
        for(let x = hydeX + 2.6; x < (z < - 35 ? lastX + 2 : 9); x += 1)
        {
            const y = ctx.ground(x + 0.5, z) - ctx.y
            stairs.box([ 1.02, 0.25, 1.2 ], C.stone, [ x + 0.5 - ctx.cx, y - 0.05, z - ctx.cz ])
        }
    }
    nodes.push(meshNode('lombardStairs', stairs, [ 0, 0, 0 ]))

    // painted houses lining the block, stepping down the hill, facing the street
    const colors = [ C.blush, C.sky, C.cream, C.sage, C.peach, C.lavender, C.snow, C.gold ]
    let n = 0
    for(const [ z, x0, x1, ry, size ] of [ [ edgeN - 2.65, hydeX + 7, lastX + 1, Math.PI / 2, 3 ], [ edgeS + 3.4, hydeX + 6, 8, - Math.PI / 2, 3.4 ] ])
    {
        for(let x = x0; x <= x1; x += 4)
        {
            const height = 3 + (n % 3) * 0.5
            const house = victorian(size, height, size, colors[n % colors.length], C.snow, [ C.slate, C.dark, C.brick ][n % 3], n + 70)
            house.box([ size + 0.1, 2, size + 0.1 ], C.stone, [ 0, - 2, 0 ]) // foundation for the slope
            nodes.push({ ...fixedNode('lombardHouse', house, ctx.at(x, z), [ { position: [ 0, height / 2, 0 ], size: [ size, height, size ] } ]), rotation: [ 0, ry, 0 ] })
            n++
        }
    }

    // "Lombard St" street sign at the top (Hyde) and the famous lamp posts
    const plate = new Model()
    plate.cylinder(0.07, 0.07, 2.6, C.dark, [ 0, 0, 0 ], 6)
    plate.box([ 0.06, 0.3, 1.4 ], C.sage, [ 0, 2.5, 0 ])
    plate.box([ 0.07, 0.08, 1.1 ], C.snow, [ 0, 2.5, 0 ])
    nodes.push(fixedNode('lombardSign', plate, ctx.at(firstLegX - lane / 2 - 0.9, north - r + lane / 2 + 0.6), [ { shape: 'tube', position: [ 0, 1.3, 0 ], radius: 0.1, height: 2.6 } ]))
    for(let k = 0; k < hairpins; k += 2)
    {
        const x = firstLegX + k * spacing + r
        const lamp = lampPost(2.2)
        for(let i = 0; i < 9; i++)
            bulb(lamp, [ Math.cos(i * 1.9) * 0.13, 0.25 + i * 0.22, Math.sin(i * 1.9) * 0.13 ], 0.06)
        wreath(lamp, [ 0, 1.75, 0.12 ], 0, 0.8)
        nodes.push(dynamicNode('lombardLamp', lamp, ctx.at(x, edgeN - 0.6), [ { position: [ 0, 1.1, 0 ], size: [ 0.25, 2.2, 0.25 ] } ], 0.3)) // knockable
    }

    // Cable car on Hyde St, a kinematic body moving along the line (path in world coordinates)
    const path = []
    for(let z = - 51; z <= - 14; z += 1)
        path.push([ hydeX, (ctx.road ? ctx.road(hydeX, z) : ctx.ground(hydeX, z)) + 0.02, z ])
    const car = new Model()
    car.box([ 2, 0.5, 4.8 ], C.dark, [ 0, 0.25, 0 ])
    car.box([ 2.1, 1.0, 4.8 ], C.red, [ 0, 0.75, 0 ])
    car.box([ 2.0, 0.9, 4.6 ], C.cream, [ 0, 1.75, 0 ])
    for(let i = 0; i < 5; i++)
        car.cbox([ 2.04, 0.6, 0.6 ], C.black, [ 0, 2.25, - 1.8 + i * 0.9 ])
    car.box([ 2.3, 0.2, 5.2 ], C.red, [ 0, 2.65, 0 ])
    car.box([ 1.6, 0.25, 4.2 ], C.cream, [ 0, 2.85, 0 ])
    car.cbox([ 0.4, 0.2, 0.05 ], C.gold, [ 0, 2.4, - 2.42 ])
    // Christmas on the cable car: lights along the roof edges and down the corners, a wreath on each end,
    // garland swags under the windows with red bows, a little lit tree on the roof
    for(const ex of [ - 1, 1 ])
    {
        lightString(car, [ ex * 1.17, 2.78, - 2.55 ], [ ex * 1.17, 2.78, 2.55 ], 0.3, 0, 0.08)
        for(let z = - 2.2; z < 2.2; z += 1.1)
        {
            for(let i = 0; i <= 6; i++)
                car.sphere(0.07, i % 2 ? C.moss : C.leaf, [ ex * 1.08, 1.7 - Math.sin(i / 6 * Math.PI) * 0.18, z + i * 1.1 / 6 ], 0)
            car.cbox([ 0.06, 0.14, 0.2 ], C.red, [ ex * 1.09, 1.72, z ])
        }
        for(const ez of [ - 1, 1 ])
            for(let y = 0.4; y < 2.6; y += 0.32)
                bulb(car, [ ex * 1.08, y, ez * 2.42 ], 0.07)
    }
    for(const ez of [ - 1, 1 ])
    {
        lightString(car, [ - 1.17, 2.78, ez * 2.6 ], [ 1.17, 2.78, ez * 2.6 ], 0.3, 0, 0.08)
        wreath(car, [ 0, 1.95, ez * 2.45 ], 0, 1.1)
    }
    litPine(car, [ 0, 2.97, 0 ], 0.55)
    for(const z of [ - 1.6, 1.6 ])
        for(const x of [ - 0.8, 0.8 ])
            car.cylinder(0.3, 0.3, 0.2, C.black, [ x, 0.3, z ], 8, [ 0, 0, Math.PI / 2 ])
    nodes.push(kinematicNode('refCableCar', car, ctx.atWorld(path[0]), [ { position: [ 0, 1.5, 0 ], size: [ 2.2, 3, 5 ] } ], { path }))

    // turnaround turntable at Hyde and Beach
    const turntable = new Model()
    turntable.cylinder(3, 3, 0.08, C.wood, [ 0, 0, 0 ], 16)
    turntable.cylinder(3.1, 3.1, 0.05, C.dark, [ 0, 0, 0 ], 16)
    nodes.push(meshNode('turntable', turntable, ctx.at(hydeX, - 53, 0.02)))
    // rails (visual) along Hyde
    const rails = new Model()
    for(let i = 0; i < path.length - 1; i++)
        for(const x of [ - 0.7, 0.7 ])
            rails.beam([ path[i][0] + x, path[i][1] + 0.02, path[i][2] ], [ path[i + 1][0] + x, path[i + 1][1] + 0.02, path[i + 1][2] ], 0.12, C.slate)
    nodes.push(meshNode('rails', rails, [ - ctx.cx, - ctx.y, - ctx.cz ]))
    return nodes
}

/** 8. Dolores Park */
builders.doloresPark = (ctx) =>
{
    // Like the real park: a wide lawn sloping down toward downtown, full of people on picnic blankets,
    // palms along the edges, the curving path, a playground, and Mission High's white tower with its dome
    const nodes = []
    const cx = 10, cz = 42
    const r = rng(8)
    const skins = [ C.peach, C.blush, C.khaki, C.wood ]
    const clothes = [ C.red, C.sky, C.snow, C.dark, C.gold, C.sage, C.pink, C.lavender, C.slate ]

    // people relaxing on the lawn (no collisions: drive gently around them)
    const crowd = new Model()
    const person = (x, z, facing, sitting) =>
    {
        const c = clothes[Math.floor(r() * clothes.length)], skin = skins[Math.floor(r() * skins.length)]
        const m = new Model()
        if(sitting)
        {
            m.cbox([ 0.34, 0.42, 0.24 ], c, [ 0, 0.27, 0 ])
            m.cbox([ 0.3, 0.14, 0.45 ], C.slate, [ 0, 0.08, - 0.25 ])
            m.sphere(0.14, skin, [ 0, 0.62, 0 ], 1)
        }
        else
        {
            m.cbox([ 0.3, 0.55, 0.22 ], C.slate, [ 0, 0.28, 0 ])
            m.cbox([ 0.36, 0.5, 0.24 ], c, [ 0, 0.8, 0 ])
            m.sphere(0.14, skin, [ 0, 1.18, 0 ], 1)
        }
        m.sphere(0.145, r() < 0.5 ? C.black : C.wood, [ 0, sitting ? 0.68 : 1.24, 0.03 ], 0, [ 1, 0.6, 1 ])  // hair
        const [ wx, wy, wz ] = ctx.at(x, z)
        crowd.merge(m, [ wx / ctx.S, wy / ctx.S, wz / ctx.S ], [ 0, facing, 0 ])
    }
    const blanketModel = new Model()
    const blankets = [ C.red, C.sky, C.gold, C.pink, C.sage, C.snow, C.lavender ]
    const spots = []
    for(let i = 0; i < 40 && spots.length < 16; i++)
    {
        const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 6.2
        const x = cx - 1 + Math.cos(a) * d * 1.15, z = cz + 1 + Math.sin(a) * d * 0.8
        if(spots.some(([ sx, sz ]) => Math.hypot(sx - x, sz - z) < 2.2))
            continue
        spots.push([ x, z ])
    }
    for(const [ x, z ] of spots)
    {
        const b = new Model()
        b.box([ 1.6, 0.03, 1.2 ], blankets[Math.floor(r() * blankets.length)])
        b.cbox([ 1.6, 0.032, 0.12 ], C.snow, [ 0, 0.016, 0.25 ])
        if(r() < 0.6) b.box([ 0.35, 0.25, 0.25 ], C.wood, [ 0.45, 0.03, - 0.3 ])          // basket
        if(r() < 0.6) b.cylinder(0.06, 0.06, 0.28, C.sage, [ - 0.5, 0.03, - 0.35 ], 5)   // bottle
        const [ wx, wy, wz ] = ctx.at(x, z, 0.02)
        const rot = r() * 0.8
        blanketModel.merge(b, [ wx / ctx.S, wy / ctx.S, wz / ctx.S ], [ 0, rot, 0 ])
        // everyone faces downhill, toward the skyline (north east)
        const n = 1 + Math.floor(r() * 3)
        for(let k = 0; k < n; k++)
            person(x - 0.5 + k * 0.5, z + 0.1 + (k % 2) * 0.25, Math.PI * 0.8 + (r() - 0.5) * 0.6, true)
    }
    for(let i = 0; i < 6; i++)
        person(cx - 6 + r() * 12, cz - 5 + r() * 10, r() * Math.PI * 2, false)
    nodes.push({ ...meshNode('picnics', blanketModel, [ 0, 0, 0 ]), noScale: false })
    nodes.push(meshNode('parkCrowd', crowd, [ 0, 0, 0 ]))

    // the curving concrete path around the lawn
    const path = new Model()
    for(let i = 0; i < 48; i++)
    {
        const a = i / 48 * Math.PI * 2
        const x = cx - 1 + Math.cos(a) * 7.8, z = cz + 1 + Math.sin(a) * 5.6
        const [ wx, wy, wz ] = ctx.at(x, z, 0.015)
        path.cbox([ 0.7, 0.03, 1.15 ], C.stone, [ wx / ctx.S, wy / ctx.S, wz / ctx.S ], [ 0, - a, 0 ])
    }
    nodes.push(meshNode('parkPath', path, [ 0, 0, 0 ]))

    // tall palms around the edges (knockable)
    for(const [ x, z, h ] of [ [ cx - 6.5, cz + 1, 7 ], [ cx - 6.8, cz + 4.2, 6 ], [ cx - 6, cz + 7, 7.5 ], [ cx + 4, cz + 7.5, 6.5 ], [ cx + 7.5, cz + 4.5, 7 ], [ cx + 6.5, cz + 7, 6 ], [ cx - 3, cz - 6.8, 6.8 ] ])
        nodes.push(dynamicNode('palm', palmTree(h), ctx.at(x, z), [ { shape: 'tube', position: [ 0, 2, 0 ], radius: 0.3, height: 4 } ], 0.5))

    // playground at the south west corner
    const play = new Model()
    play.box([ 2.6, 0.05, 2.2 ], C.khaki)
    for(const [ x, z ] of [ [ - 0.8, - 0.6 ], [ 0.2, - 0.6 ], [ - 0.8, 0.4 ], [ 0.2, 0.4 ] ])
        play.cylinder(0.06, 0.06, 1.4, C.red, [ x, 0, z ], 5)
    play.box([ 1.2, 0.1, 1.2 ], C.sky, [ - 0.3, 0.9, - 0.1 ])
    play.cone(0.8, 0.6, C.gold, [ - 0.3, 1.4, - 0.1 ], 4, [ 0, Math.PI / 4, 0 ])
    play.cbox([ 0.5, 0.06, 1.4 ], C.red, [ 0.75, 0.5, - 0.1 ], [ 0.6, 0, 0 ])             // slide
    play.cbox([ 0.5, 0.06, 1.4 ], C.red, [ 0.6, 0.45, - 0.1 ], [ 0, 0, 0.6 ])
    nodes.push(fixedNode('playground', play, ctx.at(cx - 3, cz + 6.4), [ { position: [ - 0.3, 0.7, - 0.1 ], size: [ 1.3, 1.4, 1.3 ] } ]))

    // Mission High School on the east side: white walls, orange tile roofs, the ornate white tower with a dome
    {
        const m = new Model()
        m.box([ 3, 2.6, 9 ], C.snow)
        m.gable(9.2, 3.2, 1, C.salmon, [ 0, 2.6, 0 ], [ 0, Math.PI / 2, 0 ])
        for(let i = 0; i < 7; i++)
            for(const y of [ 0.7, 1.7 ])
                m.cbox([ 0.05, 0.55, 0.45 ], C.black, [ - 1.52, y, - 3.6 + i * 1.2 ])
        // the tower, rising from the middle of the west facade
        m.box([ 1.6, 6.4, 1.6 ], C.snow, [ - 1.2, 0, 0 ])
        m.box([ 1.8, 0.2, 1.8 ], C.cream, [ - 1.2, 3.2, 0 ])
        m.box([ 1.8, 0.2, 1.8 ], C.cream, [ - 1.2, 6.4, 0 ])
        for(const y of [ 4.2, 5.4 ])
            m.cbox([ 0.05, 0.7, 0.5 ], C.black, [ - 2.02, y, 0 ])
        m.cylinder(0.08, 0.08, 0.1, C.cream, [ - 1.2, 6.6, 0 ], 4)
        m.box([ 1.3, 1.2, 1.3 ], C.snow, [ - 1.2, 6.6, 0 ])                          // belfry
        for(const z of [ - 0.4, 0.4 ])
            m.cbox([ 0.05, 0.7, 0.3 ], C.dark, [ - 1.86, 7.1, z ])
        m.sphere(0.75, C.salmon, [ - 1.2, 7.8, 0 ], 1, [ 1, 1.1, 1 ])                  // tiled dome
        m.cylinder(0.05, 0.05, 0.6, C.gold, [ - 1.2, 8.6, 0 ], 4)
        m.sphere(0.1, C.gold, [ - 1.2, 9.25, 0 ], 0)
        nodes.push(fixedNode('missionHigh', m, ctx.at(cx + 10.5, cz - 0.5), [ { position: [ 0, 1.3, 0 ], size: [ 3, 2.6, 9 ] }, { position: [ - 1.2, 4, 0 ], size: [ 1.6, 8, 1.6 ] } ]))
    }

    // the golden fire hydrant (the famous one is just up the hill)
    const hydrant = new Model()
    hydrant.cylinder(0.25, 0.3, 0.8, C.gold, [ 0, 0, 0 ], 8)
    hydrant.sphere(0.27, C.gold, [ 0, 0.8, 0 ], 0)
    hydrant.cylinder(0.1, 0.1, 0.5, C.gold, [ 0, 0.5, 0 ], 6, [ 0, 0, Math.PI / 2 ])
    nodes.push(fixedNode('hydrant', hydrant, ctx.at(cx - 8.5, cz + 6), [ { shape: 'tube', position: [ 0, 0.5, 0 ], radius: 0.3, height: 1 } ]))
    return nodes
}

/** 9. Palace of Fine Arts (1.5x: the car fits between the pillars) */
builders.palaceOfFineArts = (ctx) =>
{
    // Like the real Palace: an open octagonal rotunda of paired Corinthian columns with arches, a deep entablature
    // with relief panels and the "weeping women" boxes on top, a ribbed ochre dome; a long curving colonnade of
    // columns topped by planter boxes wrapping behind it; and a big lagoon in front with a fountain and swans
    const nodes = []
    const cx = - 40, cz = - 32
    const S = 1.5
    const stoneA = C.salmon, stoneB = C.blush, stoneC = C.peach
    const rot = new Model()
    const radius = 4 * S + 0.5
    const colH = 6 * S
    const colliders = []
    rot.cylinder(radius + 1.6, radius + 1.9, 0.35, C.stone, [ 0, 0, 0 ], 8)         // stepped plinth
    for(let i = 0; i < 8; i++)
    {
        const a = i / 8 * Math.PI * 2 + Math.PI / 8
        const ux = Math.cos(a), uz = Math.sin(a), tx = - uz, tz = ux
        const px = ux * radius, pz = uz * radius
        // a pair of fluted columns at every corner of the octagon
        for(const o of [ - 0.55, 0.55 ])
        {
            const x = px + tx * o, z = pz + tz * o
            rot.box([ 0.85, 0.5, 0.85 ], stoneB, [ x, 0.35, z ])                     // base
            rot.cylinder(0.32, 0.38, colH - 1.2, stoneA, [ x, 0.85, z ], 10)
            rot.cylinder(0.5, 0.34, 0.5, stoneC, [ x, colH - 0.35, z ], 8)            // capital
        }
        colliders.push({ shape: 'tube', position: [ px, colH / 2, pz ], radius: 0.95, height: colH })
        // arch over the opening to the next corner
        const b = (i + 1) / 8 * Math.PI * 2 + Math.PI / 8
        const mx = (Math.cos(a) + Math.cos(b)) / 2 * radius, mz = (Math.sin(a) + Math.sin(b)) / 2 * radius
        const span = 2 * radius * Math.sin(Math.PI / 8) - 1.6
        rot.add(new THREE.TorusGeometry(span / 2, 0.28, 6, 14, Math.PI), stoneA, [ mx, colH - 1.0 - span / 2 + 0.6, mz ], [ 0, - (a + b) / 2 + Math.PI / 2, 0 ])
    }
    // entablature: a thick octagonal band with relief panels
    rot.cylinder(radius + 1.0, radius + 1.0, 1.6, stoneB, [ 0, colH, 0 ], 8)
    rot.cylinder(radius + 1.2, radius + 1.2, 0.25, stoneC, [ 0, colH + 1.6, 0 ], 8)
    for(let i = 0; i < 8; i++)
    {
        const a = i / 8 * Math.PI * 2
        rot.cbox([ 2.2, 0.9, 0.1 ], stoneA, [ Math.cos(a) * (radius + 0.95), colH + 0.8, Math.sin(a) * (radius + 0.95) ], [ 0, - a + Math.PI / 2, 0 ])
        // the weeping women boxes over each corner
        const c = a + Math.PI / 8
        rot.box([ 0.9, 1.3, 0.9 ], stoneB, [ Math.cos(c) * (radius + 0.7), colH + 1.85, Math.sin(c) * (radius + 0.7) ])
        rot.sphere(0.22, stoneC, [ Math.cos(c) * (radius + 0.7), colH + 3.25, Math.sin(c) * (radius + 0.7) ], 0)
    }
    // drum and the ribbed dome
    rot.cylinder(radius - 0.2, radius - 0.2, 1.4, stoneA, [ 0, colH + 1.85, 0 ], 16)
    rot.cylinder(radius + 0.1, radius + 0.1, 0.25, stoneC, [ 0, colH + 3.25, 0 ], 16)
    rot.dome(radius - 0.3, C.cream, [ 0, colH + 3.5, 0 ], 16)
    for(let k = 0; k < 16; k++)
    {
        const a = k / 16 * Math.PI * 2
        for(let j = 0; j < 6; j++)
        {
            const e = j / 6 * Math.PI / 2
            rot.cbox([ 0.12, 0.12, 0.12 ], C.khaki, [ Math.cos(a) * Math.cos(e) * (radius - 0.25), colH + 3.5 + Math.sin(e) * (radius - 0.25), Math.sin(a) * Math.cos(e) * (radius - 0.25) ])
        }
    }
    // an altar-like urn in the middle
    rot.cylinder(0.6, 0.8, 1.2, stoneB, [ 0, 0.35, 0 ], 8)
    rot.sphere(0.5, stoneC, [ 0, 1.9, 0 ], 1)
    nodes.push(fixedNode('rotunda', rot, ctx.at(cx, cz), colliders))

    // the colonnade: a long arc of columns, each pair topped by a planter box, wrapping behind the rotunda
    const arcRadius = 12 * S
    const arcCenter = 7 * S
    for(const side of [ - 1, 1 ])
    {
        const col = new Model()
        const cols = []
        const steps = 9
        let prev = null
        for(let i = 0; i < steps; i++)
        {
            const a = side * (0.42 + i * 0.16)
            const x = Math.sin(a) * arcRadius, z = - Math.cos(a) * arcRadius + arcCenter
            col.box([ 0.9, 0.45, 0.9 ], stoneB, [ x, 0, z ])
            col.cylinder(0.33, 0.38, 4.5 * S - 0.6, stoneA, [ x, 0.45, z ], 10)
            col.cylinder(0.48, 0.34, 0.45, stoneC, [ x, 4.5 * S - 0.15, z ], 8)
            cols.push({ shape: 'tube', position: [ x, 2.25 * S, z ], radius: 0.45, height: 4.5 * S })
            if(prev)
                col.beam([ prev[0], 4.5 * S + 0.55, prev[1] ], [ x, 4.5 * S + 0.55, z ], 0.85, stoneB)
            if(i % 2 === 0)
            {
                col.box([ 1.3, 1.6, 1.3 ], stoneB, [ x, 4.5 * S + 0.9, z ])         // planter box
                col.box([ 1.45, 0.2, 1.45 ], stoneC, [ x, 4.5 * S + 2.5, z ])
                col.sphere(0.55, C.moss, [ x, 4.5 * S + 2.8, z ], 1, [ 1, 0.6, 1 ])
            }
            prev = [ x, z ]
        }
        nodes.push(fixedNode('colonnade', col, ctx.at(cx, cz), cols))
    }

    // the lagoon: a fountain jet, cypress and willow trees on the banks, a path around it
    {
        const fountain = new Model()
        fountain.cylinder(0.35, 0.45, 0.3, C.stone, [ 0, 0, 0 ], 8)
        fountain.cylinder(0.08, 0.2, 2.2, C.snow, [ 0, 0.3, 0 ], 6)
        fountain.sphere(0.3, C.snow, [ 0, 2.5, 0 ], 1, [ 1, 0.6, 1 ])
        nodes.push(meshNode('fountain', fountain, [ - 38 - ctx.cx, - 0.35 - ctx.y, - 16 - ctx.cz ]))
        const banks = new Model()
        const rb = rng(1915)
        for(let k = 0; k < 22; k++)
        {
            const a = 0.15 + k / 22 * (Math.PI * 2 - 0.3)
            const x = - 40 + Math.cos(a) * 15.5, z = - 19 + Math.sin(a) * 7.4
            if(z < - 25 && Math.abs(x + 40) < 9)
                continue                                                        // leave the rotunda side open
            const [ wx, wy, wz ] = ctx.at(x, z)
            if(k % 3 === 0)
            {
                banks.cylinder(0.14, 0.2, 1.2, C.wood, [ wx, wy, wz ], 5)
                banks.cone(0.9, 3.4, C.moss, [ wx, wy + 1, wz ], 7)               // cypress
            }
            else
            {
                banks.cylinder(0.12, 0.18, 1, C.wood, [ wx, wy, wz ], 5)
                banks.sphere(1.1 + rb() * 0.4, k % 2 ? C.sage : C.olive, [ wx, wy + 1.7, wz ], 1, [ 1.1, 0.8, 1.1 ]) // willow
            }
        }
        nodes.push(meshNode('lagoonTrees', banks, [ 0, 0, 0 ]))
    }

    // swans in the lagoon
    for(let i = 0; i < 4; i++)
    {
        const swan = new Model()
        swan.sphere(0.35, C.snow, [ 0, 0, 0 ], 1, [ 1, 0.7, 1.4 ])
        swan.cylinder(0.08, 0.1, 0.6, C.snow, [ 0, 0.1, - 0.35 ], 5, [ - 0.3, 0, 0 ])
        swan.sphere(0.12, C.snow, [ 0, 0.68, - 0.55 ], 0)
        swan.cone(0.06, 0.2, C.orange, [ 0, 0.66, - 0.65 ], 4, [ - Math.PI / 2, 0, 0 ])
        nodes.push(meshNode('swan', swan, [ cx - 6 + i * 4.5 - ctx.cx, - 0.2 - ctx.y, - 18 + (i % 2) * 2 - ctx.cz ])) // water surface (-0.3 world) in design units
    }
    return nodes
}

/** 10. Golden Gate Bridge (south anchor at z -48, north end at z -78 where the road to Napa / Muir Woods continues) */
builders.goldenGate = (ctx) =>
{
    const nodes = []
    const x = - 62
    const deckY = 3.2
    const zS = - 48, zN = - 78
    const length = zS - zN
    const midZ = (zS + zN) / 2
    const local = (lx, y, z) => [ lx - ctx.cx, y - ctx.y, z - ctx.cz ]
    const halfWidth = 3.4

    // Deck + rails (physical)
    const deck = new Model()
    deck.box([ halfWidth * 2, 0.6, length ], C.bridge, [ 0, - 0.6, 0 ])
    // roadway: grey asphalt, six lanes with dashed lines, the yellow center divider; raised sidewalks behind red railings
    const road = halfWidth - 0.75
    deck.box([ road * 2, 0.62, length ], C.slate, [ 0, - 0.6, 0 ])
    deck.box([ 0.16, 0.25, length ], C.gold, [ 0, 0.02, 0 ])                            // the moveable median barrier
    for(let z = - length / 2 + 0.4; z < length / 2 - 0.4; z += 1.1)
        for(const o of [ - road * 2 / 3, - road / 3, road / 3, road * 2 / 3 ])
            deck.cbox([ 0.06, 0.03, 0.55 ], C.snow, [ o, 0.03, z ])
    for(const side of [ - 1, 1 ])
    {
        deck.box([ 0.7, 0.75, length ], C.stone, [ side * (road + 0.35), - 0.6, 0 ])       // sidewalk
        deck.box([ 0.08, 0.45, length ], C.bridge, [ side * road, 0.15, 0 ])               // traffic railing
        for(let z = - length / 2 + 0.5; z < length / 2; z += 0.5)
            deck.box([ 0.04, 0.45, 0.05 ], C.bridge, [ side * road, 0.15, z ])
    }
    // the rails stop a little before the north end, so the exit opens up into the bend toward Napa / Muir Woods
    const railCut = 2.5
    deck.box([ 0.3, 0.9, length - railCut ], C.bridge, [ - halfWidth, 0, railCut / 2 ])
    deck.box([ 0.3, 0.9, length - railCut ], C.bridge, [ halfWidth, 0, railCut / 2 ])
    // truss under the deck
    deck.box([ halfWidth * 2, 1.2, length ], C.bridge, [ 0, - 1.8, 0 ])
    // the stiffening truss: a lattice of diagonals along both sides of the deck, and lamp posts along the rails
    for(const side of [ - 1, 1 ])
    {
        deck.box([ 0.15, 0.15, length ], C.bridge, [ side * (halfWidth + 0.05), - 2.4, 0 ])
        for(let z = - length / 2; z < length / 2 - 1; z += 1.5)
        {
            deck.beam([ side * (halfWidth + 0.05), - 2.4, z ], [ side * (halfWidth + 0.05), - 0.6, z + 0.75 ], 0.09, C.bridge)
            deck.beam([ side * (halfWidth + 0.05), - 0.6, z + 0.75 ], [ side * (halfWidth + 0.05), - 2.4, z + 1.5 ], 0.09, C.bridge)
        }
        for(let z = - length / 2 + 2; z < length / 2 - 3; z += 4)
        {
            deck.cylinder(0.05, 0.06, 2.2, C.bridge, [ side * (halfWidth - 0.15), 0.15, z ], 6)
            deck.beam([ side * (halfWidth - 0.15), 2.35, z ], [ side * (halfWidth - 0.5), 2.55, z ], 0.05, C.bridge)
            deck.beam([ side * (halfWidth - 0.5), 2.55, z ], [ side * (halfWidth - 0.85), 2.45, z ], 0.05, C.bridge)
            deck.cbox([ 0.28, 0.08, 0.16 ], C.gold, [ side * (halfWidth - 0.9), 2.38, z ])
        }
    }
    nodes.push(fixedNode('bridgeDeck', deck, local(x, deckY, midZ), [
        { position: [ 0, - 0.3, 0 ], size: [ halfWidth * 2, 0.6, length ], friction: 0.4 },
        { position: [ - halfWidth, 0.45, railCut / 2 ], size: [ 0.3, 0.9, length - railCut ] },
        { position: [ halfWidth, 0.45, railCut / 2 ], size: [ 0.3, 0.9, length - railCut ] },
    ]))

    // Towers
    const towerZ = [ - 57.5, - 69.5 ]
    const towerHeight = 20
    for(const tz of towerZ)
    {
        // Art Deco tower: two stepped legs (slimmer at each setback), portal openings framed by
        // portal struts that get shorter toward the top, X bracing under the deck, a concrete pier in the water
        const tower = new Model()
        const legX = halfWidth + 0.55
        for(const side of [ - 1, 1 ])
        {
            tower.box([ 1.3, 9, 1.8 ], C.bridge, [ side * legX, - 5, 0 ])
            tower.box([ 1.15, 7, 1.6 ], C.bridge, [ side * legX, 4, 0 ])
            tower.box([ 1.0, 5.5, 1.4 ], C.bridge, [ side * legX, 11, 0 ])
            tower.box([ 0.85, 4, 1.2 ], C.bridge, [ side * legX, 16.5, 0 ])
            for(const y of [ 4, 11, 16.5 ])
                tower.box([ 1.35, 0.2, 1.85 ], C.red, [ side * legX, y - 0.1, 0 ])          // setback ledges
            for(const z of [ - 0.9, 0.9 ])
                tower.box([ 0.12, towerHeight + 4, 0.12 ], C.red, [ side * (legX + 0.6), - 4, z ]) // vertical fluting
        }
        // portal struts (with the openings between them shrinking upward), heaviest at the top
        for(const [ y, h ] of [ [ 7.6, 0.9 ], [ 13, 0.9 ], [ 17.2, 0.8 ], [ 20, 1.2 ] ])
        {
            tower.box([ legX * 2, h, 1.3 ], C.bridge, [ 0, y, 0 ])
            tower.box([ legX * 2, 0.15, 1.35 ], C.red, [ 0, y - 0.15, 0 ])
        }
        // X bracing below the deck
        for(const z of [ - 0.6, 0.6 ])
        {
            tower.beam([ - legX, - 5.5, z ], [ legX, - 1.6, z ], 0.35, C.bridge)
            tower.beam([ legX, - 5.5, z ], [ - legX, - 1.6, z ], 0.35, C.bridge)
        }
        tower.box([ legX * 2, 0.6, 1.3 ], C.bridge, [ 0, - 1.6, 0 ])
        // red aircraft lights
        tower.sphere(0.25, C.red, [ - legX, towerHeight + 1.4, 0 ], 0)
        tower.sphere(0.25, C.red, [ legX, towerHeight + 1.4, 0 ], 0)
        // concrete pier in the water with its fender
        tower.box([ halfWidth * 2 + 4.5, 3.5, 4.4 ], C.stone, [ 0, - 6.5, 0 ])
        tower.box([ halfWidth * 2 + 5, 0.4, 4.9 ], C.snow, [ 0, - 3.1, 0 ])
        nodes.push(fixedNode('bridgeTower', tower, local(x, deckY, tz), [
            { position: [ - halfWidth - 0.55, towerHeight / 2 - 2, 0 ], size: [ 1.3, towerHeight + 4, 1.8 ] },
            { position: [ halfWidth + 0.55, towerHeight / 2 - 2, 0 ], size: [ 1.3, towerHeight + 4, 1.8 ] },
        ]))
    }

    // Main cables + suspenders (visual)
    const cables = new Model()
    const top = deckY + towerHeight + 0.4
    const sag = (z) =>
    {
        // between towers: parabola, outside: straight down to the anchors
        const [ ta, tb ] = towerZ
        if(z <= ta && z >= tb)
        {
            const t = (z - (ta + tb) / 2) / ((ta - tb) / 2)
            return deckY + 1.6 + (top - deckY - 1.6) * t * t
        }
        const anchor = z > ta ? zS + 2 : zN - 2
        const tower = z > ta ? ta : tb
        const t = (z - anchor) / (tower - anchor)
        return deckY + 1 + (top - deckY - 1) * t
    }
    for(const side of [ - 1, 1 ])
    {
        const cx = x + side * (halfWidth + 0.5)
        let prev = null
        for(let z = zS + 2; z >= zN - 2; z -= 1)
        {
            const p = [ cx, sag(z), z ]
            if(prev)
                cables.beam(prev, p, 0.22, C.bridge)
            if(Math.round(z) % 2 === 0 && p[1] - deckY > 1.2)
                cables.beam([ cx, deckY + 0.6, z ], p, 0.06, C.bridge)
            prev = p
        }
    }
    nodes.push(meshNode('bridgeCables', cables, local(0, 0, 0)))

    // Vista Point lookout at the north end (the stop itself)
    const vista = new Model()
    vista.cylinder(0.12, 0.12, 1.1, C.dark, [ 0, 0, 0 ], 6)
    vista.box([ 0.5, 0.4, 0.8 ], C.slate, [ 0, 1.1, 0 ])
    vista.cylinder(0.12, 0.12, 0.4, C.dark, [ - 0.15, 1.3, - 0.4 ], 6, [ Math.PI / 2, 0, 0 ])
    vista.cylinder(0.12, 0.12, 0.4, C.dark, [ 0.15, 1.3, - 0.4 ], 6, [ Math.PI / 2, 0, 0 ])
    nodes.push({ ...fixedNode('viewer', vista, ctx.at(- 62, - 90), [ { shape: 'tube', position: [ 0, 0.7, 0 ], radius: 0.3, height: 1.4 } ]), rotation: [ 0, Math.PI, 0 ] })
    nodes.push(meshNode('vistaSign', sign(4, 2.6, C.moss, C.snow), ctx.at(- 65, - 90.5)))
    return nodes
}

/** 11. Levi's Stadium */
builders.levis = (ctx) =>
{
    const nodes = []
    const cx = 12, cz = 79
    // field (runs along x)
    const field = new Model()
    field.box([ 24, 0.05, 11 ], C.leaf)
    for(let i = 0; i <= 10; i++)
        field.box([ 0.12, 0.06, 11 ], C.snow, [ - 10 + i * 2, 0, 0 ])
    field.box([ 2, 0.055, 11 ], C.red, [ - 11, 0, 0 ])
    field.box([ 2, 0.055, 11 ], C.red, [ 11, 0, 0 ])
    // 49ERS painted in gold in both end zones, reading along the end line
    for(const side of [ - 1, 1 ])
    {
        const t = new Model()
        pixelText(t, '49ERS', C.gold, [ 0, - 0.45, 0 ], 0.18, { depth: 0.03 })
        field.merge(t, [ side * 11, 0.075, 0 ], [ - Math.PI / 2, 0, side * Math.PI / 2 ], 1)
    }
    // midfield logo: the red SF oval with a gold ring
    field.cylinder(1.6, 1.6, 0.07, C.gold, [ 0, 0, 0 ], 20, undefined)
    field.add(new THREE.CylinderGeometry(1.45, 1.45, 0.08, 20).translate(0, 0.04, 0), C.red, [ 0, 0, 0 ], [ 0, 0, 0 ], [ 1.35, 1, 0.85 ])
    {
        const logo = new Model()
        pixelText(logo, 'SF', C.snow, [ 0, - 0.38, 0 ], 0.17, { depth: 0.04 })
        field.merge(logo, [ 0, 0.1, 0 ], [ - Math.PI / 2, 0, 0 ])
    }
    // yard numbers
    for(const [ i, n ] of [ [ 1, '10' ], [ 2, '20' ], [ 3, '30' ], [ 4, '40' ], [ 5, '50' ], [ 6, '40' ], [ 7, '30' ], [ 8, '20' ], [ 9, '10' ] ])
    {
        const t = new Model()
        pixelText(t, n, C.snow, [ 0, 0, 0 ], 0.09, { depth: 0.03 })
        field.merge(t, [ - 10 + i * 2, 0.07, 4 ], [ - Math.PI / 2, 0, 0 ])
    }
    nodes.push(meshNode('field', field, ctx.at(cx, cz, 0.01)))

    // goal posts
    for(const side of [ - 1, 1 ])
    {
        const post = new Model()
        post.cylinder(0.12, 0.12, 2.2, C.gold, [ 0, 0, 0 ], 6)
        post.box([ 0.2, 0.2, 4 ], C.gold, [ 0, 2.2, 0 ])
        post.cylinder(0.1, 0.1, 3, C.gold, [ 0, 2.2, - 1.9 ], 6)
        post.cylinder(0.1, 0.1, 3, C.gold, [ 0, 2.2, 1.9 ], 6)
        nodes.push(fixedNode('goalPost', post, ctx.at(cx + side * 12.6, cz), [ { shape: 'tube', position: [ 0, 1.1, 0 ], radius: 0.15, height: 2.2 } ]))
    }

    // the bowl: steep tiers of red seats packed with fans (49ers red and gold, a corner of Seahawks blue and green),
    // concourse ring and light towers on top, gaps at the corners to drive in
    const addStand = (name, px, pz, length, rotationY, seahawks = false) =>
    {
        const s = new Model(), fans = new Model()
        const rr = rng(Math.round(px * 7 + pz * 13))
        for(let t = 0; t < 6; t++)
        {
            s.box([ length - t * 0.3, 0.75 + t * 0.85, 0.95 ], t % 2 ? C.red : C.brick, [ 0, 0, t * 0.95 ])
            s.box([ length - t * 0.3, 0.06, 0.95 ], C.stone, [ 0, 0.75 + t * 0.85, t * 0.95 ])       // aisle step
            for(let k = 0; k < (length - t * 0.3) / 0.55; k++)
            {
                const x = - (length - t * 0.3) / 2 + 0.3 + k * 0.55
                if(rr() < 0.12)
                    continue
                const away = seahawks && x > length * 0.15
                const c = away ? (rr() < 0.6 ? C.dark : C.sage) : [ C.red, C.red, C.gold, C.snow, C.red ][Math.floor(rr() * 5)]
                // fans are their own mesh (the 'crowd' material makes them jump on a touchdown); uv.y = each fan's phase
                const phase = rr()
                fans.cbox([ 0.28, 0.32, 0.22 ], c, [ x, 0.95 + t * 0.85, t * 0.95 - 0.05 ])
                fans.sphere(0.11, [ C.peach, C.wood, C.khaki, C.blush ][Math.floor(rr() * 4)], [ x, 1.22 + t * 0.85, t * 0.95 - 0.05 ], 0)
                fans.parts.slice(- 2).forEach(part => { part.v = phase })
            }
        }
        for(const t of [ 0, 3, 5 ])                                                                     // glowing LED ribbons along the tiers (like Levi's ring)
            s.box([ length - t * 0.3 + 0.02, 0.07, 0.06 ], C.lamp, [ 0, 0.72 + t * 0.85, t * 0.95 - 0.5 ])
        s.box([ length + 0.42, 0.1, 0.08 ], C.lamp, [ 0, 6.4, 4.68 ])
        s.box([ length + 0.4, 0.5, 1.2 ], C.snow, [ 0, 5.9, 5.3 ])                                   // concourse rim
        s.box([ length + 0.4, 6, 0.3 ], C.stone, [ 0, 0, 6 ])                                        // back wall (white frame)
        for(let k = 0; k <= length / 3; k++)
            s.box([ 0.25, 6.6, 0.3 ], C.snow, [ - length / 2 + k * 3, 0, 6.2 ])                     // the white steel columns
        nodes.push({ ...fixedNode(name, s, ctx.at(px, pz), [ { position: [ 0, 3, 3 ], size: [ length, 6, 6.2 ] } ]), rotation: [ 0, rotationY, 0 ] })
        nodes.push({ ...meshNode('levisFans', fans, ctx.at(px, pz), { material: 'crowd' }), rotation: [ 0, rotationY, 0 ] })
    }
    addStand('standNorth', cx, cz - 7.5, 22, Math.PI)
    addStand('standSouth', cx, cz + 7.5, 22, 0)
    addStand('standWest', cx - 15.5, cz, 9, - Math.PI / 2, true)
    addStand('standEast', cx + 15.5, cz, 9, Math.PI / 2)
    // light towers on the corners: a bank of floodlights (they blaze at night) aimed at the field, light beams pouring
    // down onto the grass, and the field itself lit bright white (Materials: floodBeam / floodPool)
    const beams = []
    for(const [ x, z ] of [ [ - 15, - 9 ], [ 15, - 9 ], [ - 15, 12 ], [ 15, 12 ] ])
    {
        const l = new Model()
        l.cylinder(0.15, 0.2, 9, C.snow, [ 0, 0, 0 ], 6)
        l.box([ 2.6, 1.5, 0.3 ], C.slate, [ 0, 8.9, 0 ], [ 0.35, 0, 0 ])
        for(let k = 0; k < 12; k++)
            l.cbox([ 0.36, 0.3, 0.12 ], C.lamp, [ - 0.99 + (k % 4) * 0.66, 9.25 + Math.floor(k / 4) * 0.42, 0.22 - Math.floor(k / 4) * 0.14 ], [ 0.35, 0, 0 ])
        nodes.push({ ...fixedNode('lightTower', l, ctx.at(cx + x, cz + z), [ { shape: 'tube', position: [ 0, 4.5, 0 ], radius: 0.25, height: 9 } ]), rotation: [ 0, Math.atan2(- x, - z), 0 ] })
        // the beam: an open cone from the lamp bank down to a wide patch of the field (design offsets from the center)
        const from = new THREE.Vector3(x * 0.97, 9.6, z * 0.97)
        const to = new THREE.Vector3(x * 0.25, 0.05, z * 0.2)
        const length = from.distanceTo(to)
        const cone = new THREE.CylinderGeometry(0.9, 5.2, length, 24, 1, true)   // uv.y: 0 at the field, 1 at the lamps
        cone.translate(0, - length / 2, 0)
        cone.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, - 1, 0), to.clone().sub(from).normalize()))
        cone.translate(from.x, from.y, from.z)
        beams.push(cone)
    }
    {
        const g = mergeGeometries(beams)
        nodes.push({ name: 'floodBeams', position: ctx.at(cx, cz), mesh: { geometry: g, material: 'floodBeam' } })
        const pool = new THREE.PlaneGeometry(28, 15).rotateX(- Math.PI / 2).translate(0, 0.17, 0)   // just above the SF logo (no z-fighting)
        nodes.push({ name: 'floodPool', position: ctx.at(cx, cz), mesh: { geometry: pool, material: 'floodPool' } })
    }

    // the suite tower on the north side: stacked glass decks, a green roof, LEVI'S STADIUM in red letters
    {
        const tower = new Model()
        tower.box([ 24, 9, 3.6 ], C.stone)
        for(let lvl = 0; lvl < 4; lvl++)
        {
            tower.box([ 24.1, 1.1, 3.7 ], C.slate, [ 0, 1.2 + lvl * 1.9, 0 ])                  // glass bands
            tower.box([ 24.2, 0.15, 3.9 ], C.snow, [ 0, 2.35 + lvl * 1.9, 0 ])
        }
        tower.box([ 24.4, 0.3, 4 ], C.snow, [ 0, 9, 0 ])
        tower.box([ 23, 0.25, 3.2 ], C.moss, [ 0, 9.3, 0 ])                                  // the green roof
        for(let i = 0; i < 10; i++)
            tower.cbox([ 1.6, 0.08, 1.1 ], C.slate, [ - 9.9 + i * 2.2, 9.6, 0.5 ], [ 0.25, 0, 0 ]) // solar panels
        tower.box([ 20, 1.4, 0.2 ], C.snow, [ 0, 7.25, 1.85 ])
        pixelText(tower, "LEVI'S STADIUM", C.red, [ 0, 7.45, 1.98 ], 0.2, { depth: 0.08 })
        tower.box([ 20, 1.4, 0.2 ], C.snow, [ 0, 7.25, - 1.85 ])
        pixelText(tower, "LEVI'S STADIUM", C.red, [ 0, 7.45, - 1.98 ], 0.2, { depth: 0.08, back: true })
        nodes.push(fixedNode('suiteTower', tower, ctx.at(cx, cz - 12.5), [ { position: [ 0, 4.7, 0 ], size: [ 24, 9.4, 3.6 ] } ]))
    }

    // giant video boards above both end zones, playing the 49ers
    for(const side of [ - 1, 1 ])
    {
        const b = new Model()
        for(const z of [ - 2.6, 2.6 ])
            b.box([ 0.5, 6.5, 0.5 ], C.dark, [ z, 0, 0 ])
        b.box([ 8.4, 3.4, 0.5 ], C.dark, [ 0, 6.2, 0 ])
        b.box([ 8, 3, 0.1 ], C.black, [ 0, 6.4, 0.25 ])
        b.box([ 8, 0.5, 0.11 ], C.dark, [ 0, 5.2, 0.26 ])
        nodes.push({ ...fixedNode('videoBoard', b, ctx.at(cx + side * 20.5, cz), [ { position: [ - 2.6, 3.25, 0 ], size: [ 0.5, 6.5, 0.5 ] }, { position: [ 2.6, 3.25, 0 ], size: [ 0.5, 6.5, 0.5 ] } ]), rotation: [ 0, - side * Math.PI / 2, 0 ] })
    }

    // giant 49ERS letters outside
    nodes.push(...letters(ctx, '49ERS', C.red, cx + 14, cz - 12, 0, 0.45))

    // the football, push it into the end zone
    const ball = new Model()
    ball.sphere(0.45, C.wood, [ 0, 0, 0 ], 1, [ 1, 1, 1.6 ])
    ball.cbox([ 0.06, 0.04, 0.5 ], C.snow, [ 0, 0.44, 0 ])
    nodes.push(dynamicNode('refFootball', ball, ctx.at(cx, cz, 0.6), [ { shape: 'ball', radius: 0.5 } ], 0.15))
    nodes.push(refNode('EndZoneEast', ctx.at(cx + 11, cz), undefined, [ 2, 2, 11 ]))
    nodes.push(refNode('EndZoneWest', ctx.at(cx - 11, cz), undefined, [ 2, 2, 11 ]))
    return nodes
}

/** 12. Painted Ladies */
builders.paintedLadies = (ctx) =>
{
    const nodes = []
    // the seven "Postcard Row" houses, shoulder to shoulder, each in its own colors
    const colors = [ C.sage, C.cream, C.sage, C.peach, C.blush, C.sky, C.cream ]
    const trims = [ C.snow, C.snow, C.cream, C.snow, C.snow, C.snow, C.snow ]
    const accents = [ C.red, C.gold, C.olive, C.red, C.brick, C.sky, C.gold ]
    const roofs = [ C.slate, C.dark, C.slate, C.khaki, C.wood, C.dark, C.slate ]
    for(let i = 0; i < 7; i++)
    {
        const z = 6.5 + i * 2.9
        const house = victorian(2.85, 4.4, 4, colors[i], trims[i], roofs[i], i + 12, accents[i])
        nodes.push(fixedNode('lady', house, ctx.at(- 15, z), [ { position: [ 0, 2.2, 0 ], size: [ 4, 4.4, 2.85 ] } ]))
    }
    // clipped round trees along the sidewalk in front of them
    for(let i = 0; i < 4; i++)
    {
        const t = new Model()
        t.cylinder(0.08, 0.1, 0.9, C.wood, [ 0, 0, 0 ], 5)
        t.sphere(0.55, C.moss, [ 0, 1.2, 0 ], 1, [ 1, 0.85, 1 ])
        nodes.push(meshNode('streetTree', t, ctx.at(- 17.8, 7.9 + i * 5.3)))
    }

    // Alamo Square park, on its hill across the street: lawns cut by curving paths, a grove of cypress and pines
    // in the middle, people on blankets looking at the houses and the skyline
    const pcx = - 29, pcz = 11.3
    const park = new Model()
    const r = rng(1894)
    const local = (x, z, dy = 0) => { const [ wx, wy, wz ] = ctx.at(x, z, dy); return [ wx / ctx.S, wy / ctx.S, wz / ctx.S ] }
    // curving paths: an oval loop and two diagonals
    for(let i = 0; i < 40; i++)
    {
        const a = i / 40 * Math.PI * 2
        park.cbox([ 0.55, 0.03, 0.85 ], C.stone, local(pcx + Math.cos(a) * 4.6, pcz + Math.sin(a) * 3.8, 0.015), [ 0, - a, 0 ])
    }
    for(const [ ax, az, bx, bz ] of [ [ - 6, - 5, 6, 5 ], [ - 6, 5, 6, - 5 ] ])
        for(let k = 0; k <= 14; k++)
        {
            const t = k / 14
            if(Math.hypot(ax + (bx - ax) * t, (az + (bz - az) * t) * 1.2) < 2.2)
                continue
            park.cbox([ 0.5, 0.03, 0.9 ], C.stone, local(pcx + ax + (bx - ax) * t, pcz + az + (bz - az) * t, 0.015), [ 0, Math.atan2(bx - ax, bz - az), 0 ])
        }
    // the grove at the top of the hill
    for(let i = 0; i < 9; i++)
    {
        const a = i / 9 * Math.PI * 2 + r()
        const d = 0.6 + r() * 1.6
        const [ x, y, z ] = local(pcx + Math.cos(a) * d, pcz + Math.sin(a) * d)
        park.cylinder(0.1, 0.15, 1.6, C.wood, [ x, y, z ], 5)
        if(i % 2)
            park.cone(0.9, 2.6, C.moss, [ x, y + 1.2, z ], 7)
        else
            park.sphere(1.1, C.olive, [ x, y + 2.2, z ], 1, [ 1.2, 0.6, 1.2 ])
    }
    // a playground and benches on the edge
    {
        const [ x, y, z ] = local(pcx - 4.2, pcz - 3.2)
        park.box([ 1.6, 0.05, 1.4 ], C.khaki, [ x, y, z ])
        park.box([ 0.8, 0.08, 0.8 ], C.sky, [ x, y + 0.7, z ])
        for(const [ dx, dz ] of [ [ - 0.35, - 0.35 ], [ 0.35, - 0.35 ], [ - 0.35, 0.35 ], [ 0.35, 0.35 ] ])
            park.cylinder(0.04, 0.04, 0.7, C.red, [ x + dx, y, z + dz ], 4)
        park.cone(0.6, 0.45, C.gold, [ x, y + 0.78, z ], 4, [ 0, Math.PI / 4, 0 ])
    }
    // picnickers on the east slope, facing the houses (east, +x)
    const skins = [ C.peach, C.blush, C.khaki, C.wood ]
    const clothes = [ C.red, C.sky, C.snow, C.dark, C.gold, C.sage, C.pink, C.lavender ]
    for(let i = 0; i < 9; i++)
    {
        const x = pcx + 2.5 + r() * 3, z = pcz - 4 + i * 1.0 + (r() - 0.5) * 0.4
        const [ bx, by, bz ] = local(x, z, 0.02)
        park.box([ 0.9, 0.03, 0.7 ], [ C.red, C.sky, C.gold, C.pink, C.snow ][i % 5], [ bx, by, bz ], [ 0, r() * 0.6, 0 ])
        const n = 1 + (i % 2)
        for(let k = 0; k < n; k++)
        {
            const px = bx + 0.1, pz = bz - 0.15 + k * 0.35
            park.cbox([ 0.22, 0.28, 0.18 ], clothes[Math.floor(r() * clothes.length)], [ px, by + 0.17, pz ])
            park.cbox([ 0.2, 0.09, 0.3 ], C.slate, [ px + 0.15, by + 0.05, pz ])
            park.sphere(0.1, skins[Math.floor(r() * skins.length)], [ px, by + 0.42, pz ], 1)
        }
    }
    nodes.push(meshNode('alamoPark', park, [ 0, 0, 0 ]))

    // a dog on the lawn
    const dog = new Model()
    dog.box([ 0.8, 0.4, 0.35 ], C.gold, [ 0, 0.3, 0 ])
    dog.box([ 0.3, 0.3, 0.3 ], C.gold, [ 0.45, 0.6, 0 ])
    for(const [ x, z ] of [ [ - 0.3, - 0.12 ], [ 0.3, - 0.12 ], [ - 0.3, 0.12 ], [ 0.3, 0.12 ] ])
        dog.box([ 0.1, 0.3, 0.1 ], C.gold, [ x, 0, z ])
    nodes.push(dynamicNode('dog', dog, ctx.at(pcx + 3, pcz + 5, 0.1), [ { position: [ 0, 0.4, 0 ], size: [ 0.9, 0.8, 0.4 ] } ], 0.3))
    return nodes
}

/** 13. Tennis */
builders.tennis = (ctx) =>
{
    const nodes = []
    const cx = - 58, cz = 17
    for(const side of [ - 1, 1 ])
    {
        const z = cz + side * 4
        const court = new Model()
        court.box([ 13, 0.04, 6.4 ], C.sky)
        court.box([ 11.8, 0.05, 5.4 ], C.sage)
        for(const lz of [ - 2.7, 2.7, - 2.0, 2.0 ])
            court.box([ 11.8, 0.06, 0.08 ], C.snow, [ 0, 0, lz ])
        for(const lx of [ - 5.9, 5.9, - 3.3, 3.3 ])
            court.box([ 0.08, 0.06, lx === - 5.9 || lx === 5.9 ? 5.4 : 4 ], C.snow, [ lx, 0, 0 ])
        court.box([ 6.6, 0.06, 0.08 ], C.snow, [ 0, 0, 0 ])
        nodes.push(meshNode('court', court, ctx.at(cx, z, 0.01)))

        const net = new Model()
        net.cylinder(0.06, 0.06, 1.0, C.dark, [ 0, 0, - 3.1 ], 5)
        net.cylinder(0.06, 0.06, 1.0, C.dark, [ 0, 0, 3.1 ], 5)
        net.box([ 0.04, 0.6, 6.2 ], C.black, [ 0, 0.25, 0 ])
        net.box([ 0.06, 0.1, 6.2 ], C.snow, [ 0, 0.85, 0 ])
        nodes.push(fixedNode('net', net, ctx.at(cx, z), [ { position: [ 0, 0.45, 0 ], size: [ 0.1, 0.9, 6.2 ] } ]))
    }
    // fences around the courts with openings at the ends
    for(const side of [ - 1, 1 ])
    {
        const fence = new Model()
        fence.box([ 14, 2, 0.08 ], C.moss)
        for(let i = 0; i <= 7; i++)
            fence.cylinder(0.06, 0.06, 2.1, C.dark, [ - 7 + i * 2, 0, 0 ], 4)
        nodes.push(fixedNode('courtFence', fence, ctx.at(cx, cz + side * 7.8), [ { position: [ 0, 1, 0 ], size: [ 14, 2, 0.1 ] } ]))
    }
    // clubhouse
    const club = new Model()
    club.box([ 4, 2.8, 7 ], C.cream)
    club.gable(7.4, 4.4, 1.2, C.brick, [ 0, 2.8, 0 ], [ 0, Math.PI / 2, 0 ])
    club.cbox([ 0.06, 1.3, 1 ], C.black, [ 2.02, 1, 0 ])
    nodes.push({ ...fixedNode('clubhouse', club, ctx.at(cx - 1, cz - 10), [ { position: [ 0, 1.4, 0 ], size: [ 4, 2.8, 7 ] } ]), rotation: [ 0, Math.PI / 2, 0 ] })

    // ball basket and tennis balls (dynamic)
    const r = rng(13)
    for(let i = 0; i < 10; i++)
    {
        const ball = new Model()
        ball.sphere(0.22, C.moss, [ 0, 0, 0 ], 1)
        nodes.push(dynamicNode('refTennisBall', ball, ctx.at(cx + 3 + r() * 2, cz - 4 + r() * 1.6, 0.3 + i * 0.05), [ { shape: 'ball', radius: 0.22 } ], 0.02))
    }
    // two rackets leaning on the bench (for the two of you)
    for(const [ k, color ] of [ [ 0, C.red ], [ 1, C.sky ] ])
    {
        const racket = new Model()
        racket.cylinder(0.05, 0.05, 0.7, C.dark, [ 0, 0, 0 ], 5)
        racket.add(new THREE.TorusGeometry(0.35, 0.05, 4, 10), color, [ 0, 1.05, 0 ])
        racket.cbox([ 0.5, 0.5, 0.02 ], C.snow, [ 0, 1.05, 0 ])
        nodes.push({ ...meshNode('racket', racket, ctx.at(cx + 6.5 + k * 0.6, cz, 0.05)), rotation: [ 0, 0, 0.3 ] })
    }
    // courtside: pennant bunting over the gap between the courts, a scoreboard, benches with an umbrella, potted plants
    {
        const d = new Model()
        for(const z of [ cz - 0.1 ])
        {
            for(let k = 0; k <= 18; k++)
            {
                const t = k / 18, x = cx - 7 + t * 14
                const y = 3.2 - Math.sin(t * Math.PI) * 0.6
                d.cone(0.16, 0.38, [ C.red, C.gold, C.sky, C.snow, C.leaf ][k % 5], [ x - cx, y - 0.38, z - cz ], 3, [ Math.PI, 0, 0 ])
            }
            for(const x of [ - 7, 7 ])
                d.cylinder(0.05, 0.05, 3.3, C.snow, [ x, 0, z - cz ], 5)
        }
        // scoreboard
        // scoreboard: a real tennis board, J on top and DJ below, three sets and the game score:
        // 6-4, 4-6, 5-5 in the decider and deuce (40-40), the serve with J. Readable from both sides.
        {
            const bx = - 9.2, by = 1.3, bw = 3.3, bh = 1.65
            d.box([ bw, bh, 0.15 ], C.dark, [ bx, by, 0 ])
            d.box([ bw + 0.1, 0.08, 0.19 ], C.gold, [ bx, by + bh, 0 ])
            d.box([ bw + 0.1, 0.08, 0.19 ], C.gold, [ bx, by - 0.04, 0 ])
            for(const ex of [ - 1, 1 ])
            {
                d.cylinder(0.06, 0.06, by, C.dark, [ bx + ex * (bw / 2 - 0.25), 0, 0 ], 4)
                d.box([ 0.08, bh + 0.12, 0.19 ], C.gold, [ bx + ex * (bw / 2 + 0.01), by - 0.04, 0 ])
            }
            const cell = 0.07, small = 0.045
            const nameLeft = - 1.5, sets = [ - 0.3, 0.15, 0.6 ], point = 1.2
            const rowJ = by + 0.92, rowDJ = by + 0.32, header = by + 1.37
            for(const side of [ 1, - 1 ])
            {
                const z = side * 0.09, back = side < 0
                const X = (x) => bx + (back ? - x : x)
                const left = (text, c, x, y, sz) => pixelText(d, text, c, [ X(x + ([ ...text ].length * sz * 4 - sz) / 2), y, z ], sz, { depth: 0.03, back })
                const center = (text, c, x, y, sz) => pixelText(d, text, c, [ X(x), y, z ], sz, { depth: 0.03, back })
                sets.forEach((x, i) => center(String(i + 1), C.stone, x, header, small))
                d.cbox([ 0.62, 1.16, 0.02 ], C.slate, [ X(point), by + 0.78, z * 0.95 ])                  // the game score panel
                left('J', C.snow, nameLeft, rowJ, cell)
                left('DJ', C.snow, nameLeft, rowDJ, cell)
                d.sphere(0.06, C.gold, [ X(nameLeft + 0.62), rowJ + 0.17, z ], 0)                           // serving
                d.cbox([ 2.95, 0.03, 0.02 ], C.stone, [ bx, by + 0.79, z ])                                 // divider
                ;[ '6', '4', '5' ].forEach((v, i) => center(v, i === 0 ? C.gold : C.snow, sets[i], rowJ, cell))
                ;[ '4', '6', '5' ].forEach((v, i) => center(v, i === 1 ? C.gold : C.snow, sets[i], rowDJ, cell))
                center('40', C.red, point, rowJ, cell)
                center('40', C.red, point, rowDJ, cell)
            }
        }
        // umbrellas and planters along the middle walkway
        for(const x of [ - 4, 4 ])
        {
            d.cylinder(0.04, 0.04, 2.1, C.snow, [ x, 0, 0.9 ], 4)
            d.cone(1.0, 0.45, x < 0 ? C.leaf : C.red, [ x, 1.95, 0.9 ], 8)
            d.box([ 0.55, 0.45, 0.55 ], C.stone, [ x, 0, - 0.9 ])
            d.sphere(0.38, C.moss, [ x, 0.75, - 0.9 ], 1)
            d.sphere(0.1, C.pink, [ x + 0.15, 1.05, - 0.8 ], 0)
            d.sphere(0.1, C.gold, [ x - 0.12, 1.02, - 1.0 ], 0)
        }
        nodes.push(meshNode('tennisDecor', d, ctx.at(cx, cz)))
    }

    return nodes
}

/* ---------- secret places ---------- */

/** Napa: a tiny castle winery, vine rows, barrels and Bright Nights string lights */
builders.napa = (ctx) =>
{
    const nodes = []
    const cx = ctx.cx, cz = ctx.cz
    const driveZ = cz             // the driveway runs east -> west, from the bridge to the castle gate
    const castleX = cx - 3        // castle center, west of the driveway; its gate faces east (toward the bridge)

    /* Castle (like Castello di Amorosa): stone curtain walls with crenellations, round corner towers with conical roofs,
       a tall square keep at the back, and a great hall inside you can drive into through the gate.
       'castleUpper' (upper walls, roof, battlements) hides while the car is inside, so the hall and its photos show. */
    const castle = new Model()      // lower walls, towers, keep, the hall's floor and furniture (always visible)
    const upper = new Model()       // upper walls, the roof over the hall, battlements
    const stoneA = C.khaki, stoneB = C.cream, roofC = C.brick
    const crenels = (m, x0, z0, x1, z1, y) =>
    {
        const length = Math.hypot(x1 - x0, z1 - z0)
        const count = Math.floor(length / 0.9)
        for(let i = 0; i <= count; i++)
        {
            const t = i / count
            m.box([ 0.5, 0.55, 0.5 ], stoneB, [ x0 + (x1 - x0) * t, y, z0 + (z1 - z0) * t ])
        }
    }
    const hw = 3.2, hd = 4.0, t = 0.3, H = 4.4, low = 1.75, gate = 1.05 // half depth (x), half width (z), wall thickness, heights, half gate width
    const wall = (sx, sz, px, pz, y0, y1, m) => m.box([ sx, y1 - y0, sz ], stoneA, [ px, y0, pz ])
    const walls = [
        [ t, 2 * hd, - hw, 0 ],                                   // back
        [ 2 * hw, t, 0, - hd ], [ 2 * hw, t, 0, hd ],             // sides
        [ t, hd - gate, hw, - (hd + gate) / 2 ], [ t, hd - gate, hw, (hd + gate) / 2 ], // front, either side of the gate
    ]
    for(const [ sx, sz, px, pz ] of walls)
    {
        wall(sx, sz, px, pz, 0, low, castle)
        wall(sx, sz, px, pz, low, H, upper)
    }
    upper.box([ t, H - 2.7, 2 * gate ], stoneA, [ hw, 2.7, 0 ])                 // over the gate
    upper.box([ 2 * hw - 0.2, 0.25, 2 * hd - 0.2 ], C.wood, [ 0, H - 0.25, 0 ])   // roof over the hall
    upper.box([ 2 * hw + 0.2, 0.3, 2 * hd + 0.2 ], stoneB, [ 0, H, 0 ])
    crenels(upper, hw, - hd, hw, hd, H + 0.3); crenels(upper, - hw, - hd, - hw, hd, H + 0.3)
    crenels(upper, - hw, - hd, hw, - hd, H + 0.3); crenels(upper, - hw, hd, hw, hd, H + 0.3)
    // stone texture: a few darker courses on the outside
    for(const y of [ 0.9, 2.2, 3.4 ])
    {
        const m = y < low ? castle : upper
        m.box([ 2 * hw + t + 0.02, 0.08, 0.02 ], C.wood, [ 0, y, - hd - t / 2 - 0.01 ])
        m.box([ 2 * hw + t + 0.02, 0.08, 0.02 ], C.wood, [ 0, y, hd + t / 2 + 0.01 ])
    }
    // round corner towers with tall conical roofs and pennants
    for(const [ x, z ] of [ [ hw, hd ], [ hw, - hd ], [ - hw, hd ], [ - hw, - hd ] ])
    {
        castle.cylinder(1.25, 1.4, 7, stoneA, [ x, 0, z ], 12)
        castle.cylinder(1.45, 1.45, 0.35, stoneB, [ x, 7, z ], 12)
        for(let k = 0; k < 8; k++)
        {
            const a = k / 8 * Math.PI * 2
            castle.box([ 0.4, 0.45, 0.4 ], stoneB, [ x + Math.cos(a) * 1.3, 7.5, z + Math.sin(a) * 1.3 ])
        }
        castle.cone(1.55, 3.4, roofC, [ x, 7.4, z ], 12)
        castle.cylinder(0.04, 0.04, 1.2, C.dark, [ x, 10.7, z ], 4)
        castle.cbox([ 0.05, 0.45, 0.8 ], C.red, [ x, 11.6, z + 0.4 ])
        for(const y of [ 2.4, 4.6 ])
            castle.cbox([ 0.1, 0.8, 0.3 ], C.gold, [ x + Math.sign(x) * 1.36, y, z ])
    }
    // the keep, tall and square, rising from the back wall (its front face holds the big screen inside)
    const keepX = - hw - 0.2
    castle.box([ 3.4, 9.5, 3.4 ], stoneB, [ keepX, 0, 0 ])
    castle.box([ 3.7, 0.3, 3.7 ], stoneA, [ keepX, 9.5, 0 ])
    crenels(castle, keepX + 1.75, - 1.75, keepX + 1.75, 1.75, 9.85); crenels(castle, keepX - 1.75, - 1.75, keepX - 1.75, 1.75, 9.85)
    crenels(castle, keepX - 1.75, - 1.75, keepX + 1.75, - 1.75, 9.85); crenels(castle, keepX - 1.75, 1.75, keepX + 1.75, 1.75, 9.85)
    for(let k = 0; k < 6; k++)
        castle.box([ 0.35, 0.3, 0.2 ], stoneA, [ keepX + 1.7, 9.2, - 1.5 + k * 0.6 ])   // machicolations
    castle.cylinder(0.05, 0.05, 1.6, C.dark, [ keepX, 10.1, 0 ], 4)
    castle.cbox([ 0.06, 0.6, 1.2 ], C.gold, [ keepX, 11.3, 0.6 ])
    for(const z of [ - 1, 0, 1 ])
        castle.cbox([ 0.1, 1, 0.45 ], C.gold, [ keepX + 1.72, 6.5, z ])
    // gatehouse: two small towers around the arched gate, a wooden portcullis raised up, a name plate
    for(const z of [ - 1.6, 1.6 ])
    {
        castle.cylinder(0.8, 0.9, 6, stoneB, [ hw + 0.4, 0, z ], 10)
        castle.cone(1, 2.2, roofC, [ hw + 0.4, 6, z ], 10)
    }
    upper.add(new THREE.TorusGeometry(gate, 0.18, 6, 14, Math.PI), stoneB, [ hw + 0.16, 2.6, 0 ], [ 0, Math.PI / 2, 0 ])
    upper.cbox([ 0.12, 0.3, 2 ], C.gold, [ hw + 0.2, 3.8, 0 ])
    for(let k = 0; k < 5; k++)
        upper.cbox([ 0.06, 0.5, 0.06 ], C.dark, [ hw + 0.05, 3.25, - 0.8 + k * 0.4 ])        // portcullis teeth
    // windows on the outer walls, lit at night
    for(const z of [ - 3.3, - 2.5, 2.5, 3.3 ])
        for(const y of [ 1.0, 3.2 ])
            (y < low ? castle : upper).cbox([ 0.1, 0.7, 0.4 ], C.gold, [ hw + 0.17, y, z ])

    /* The great hall inside: stone floor, a red carpet from the gate to the keep, wine barrels and a long tasting table,
       iron candle stands (the photos and the video screen are added in code, see CastleGallery.js) */
    castle.box([ 2 * hw - t, 0.06, 2 * hd - t ], C.stone, [ 0, 0, 0 ])
    castle.box([ 2 * hw - t - 1.6, 0.07, 1.0 ], C.red, [ 0.6, 0, 0 ])
    castle.box([ 2 * hw - t - 1.6, 0.075, 0.1 ], C.gold, [ 0.6, 0, 0.5 ])
    castle.box([ 2 * hw - t - 1.6, 0.075, 0.1 ], C.gold, [ 0.6, 0, - 0.5 ])
    for(const z of [ - 3.3, 3.3 ])
        for(let k = 0; k < 4; k++)
        {
            const x = - 2.2 + k * 1.3
            castle.cylinder(0.32, 0.32, 0.7, C.wood, [ x, 0.35, z ], 10, [ Math.PI / 2, 0, 0 ])   // barrels on their side
            castle.cylinder(0.34, 0.34, 0.06, C.dark, [ x, 0.35, z - 0.25 ], 10, [ Math.PI / 2, 0, 0 ])
            castle.cylinder(0.34, 0.34, 0.06, C.dark, [ x, 0.35, z + 0.25 ], 10, [ Math.PI / 2, 0, 0 ])
        }
    for(const [ x, z ] of [ [ - 1.2, - 1.6 ], [ 1.6, - 1.6 ], [ - 1.2, 1.6 ], [ 1.6, 1.6 ] ])
    {
        castle.cylinder(0.04, 0.08, 1.1, C.dark, [ x, 0, z ], 5)
        castle.cylinder(0.18, 0.1, 0.1, C.dark, [ x, 1.1, z ], 6)
        castle.cylinder(0.04, 0.04, 0.18, C.snow, [ x, 1.2, z ], 5)
        castle.sphere(0.06, C.gold, [ x, 1.42, z ], 0)
    }
    nodes.push({ ...fixedNode('castle', castle, ctx.at(castleX, driveZ), [
        ...walls.map(([ sx, sz, px, pz ]) => ({ position: [ px, H / 2, pz ], size: [ sx, H, sz ] })),
        { position: [ hw, 2.7 + (H - 2.7) / 2, 0 ], size: [ t, H - 2.7, 2 * gate ] },
        { position: [ keepX, 4.75, 0 ], size: [ 3.4, 9.5, 3.4 ] },
        ...[ [ hw, hd ], [ hw, - hd ], [ - hw, hd ], [ - hw, - hd ] ].map(([ x, z ]) => ({ shape: 'tube', position: [ x, 3.5, z ], radius: 1.35, height: 7 })),
        ...[ - 1.6, 1.6 ].map(z => ({ shape: 'tube', position: [ hw + 0.4, 3, z ], radius: 0.85, height: 6 })),
        ...[ - 3.3, 3.3 ].map(z => ({ position: [ - 0.25, 0.35, z ], size: [ 4.6, 0.7, 0.7 ] })),
    ]) })
    nodes.push(meshNode('castleUpper', upper, ctx.at(castleX, driveZ)))

    // Aura: a warm halo on the ground and soft light beams rising from the towers
    nodes.push({ name: 'castleHalo', position: ctx.at(castleX + 3.2 + 3.2, driveZ, 0.06), mesh: { geometry: new THREE.CircleGeometry(3.6, 48).rotateX(- Math.PI / 2), material: 'auraHalo' } })
    for(const [ x, z, h, r ] of [ [ hw, hd, 14, 1.3 ], [ hw, - hd, 14, 1.3 ], [ - hw, hd, 14, 1.3 ], [ - hw, - hd, 14, 1.3 ], [ keepX, 0, 22, 1.6 ] ])
    {
        const geometry = new THREE.CylinderGeometry(r * 0.35, r, h, 16, 1, true).translate(0, h / 2, 0)
        nodes.push({ name: 'castleBeam', position: ctx.at(castleX + x, driveZ + z, 0.2), mesh: { geometry, material: 'auraBeam' } })
    }
    // floating sparkles around the castle (emissive)
    const sparkles = new Model()
    const rs = rng(1028)
    for(let i = 0; i < 40; i++)
    {
        const a = rs() * Math.PI * 2, d = 4 + rs() * 5
        sparkles.sphere(0.08 + rs() * 0.08, C.gold, [ Math.cos(a) * d, 1 + rs() * 9, Math.sin(a) * d ], 0)
    }
    nodes.push({ ...meshNode('castleSparkles', sparkles, ctx.at(castleX, driveZ)), mesh: { geometry: sparkles.geometry(), material: 'emissiveOrangeRadialGradient' } })

    // wine barrels you can knock over, stacked by the gate
    for(let i = 0; i < 6; i++)
    {
        const barrel = new Model()
        barrel.cylinder(0.45, 0.45, 1, C.wood, [ 0, 0, 0 ], 10)
        barrel.cylinder(0.47, 0.47, 0.1, C.dark, [ 0, 0.15, 0 ], 10)
        barrel.cylinder(0.47, 0.47, 0.1, C.dark, [ 0, 0.75, 0 ], 10)
        nodes.push(dynamicNode('barrel', barrel, ctx.at(cx + 2.3 + (i % 2) * 1.1, driveZ - 3.6 - Math.floor(i / 2) * 1.1, 0.02), [ { shape: 'tube', position: [ 0, 0.5, 0 ], radius: 0.45, height: 1 } ], 0.25))
    }

    // tasting table with two glasses, south of the gate
    const table = new Model()
    table.box([ 2.4, 0.1, 1.2 ], C.wood, [ 0, 0.9, 0 ])
    for(const [ x, z ] of [ [ - 1, - 0.5 ], [ 1, - 0.5 ], [ - 1, 0.5 ], [ 1, 0.5 ] ])
        table.cylinder(0.06, 0.06, 0.9, C.wood, [ x, 0, z ], 4)
    for(const x of [ - 0.3, 0.3 ])
    {
        table.cylinder(0.02, 0.12, 0.05, C.snow, [ x, 1.0, 0 ], 6)
        table.cylinder(0.02, 0.02, 0.2, C.snow, [ x, 1.05, 0 ], 4)
        table.cylinder(0.12, 0.08, 0.2, C.red, [ x, 1.25, 0 ], 6)
    }
    nodes.push(fixedNode('tasting', table, ctx.at(cx + 5.4, driveZ - 3.2), [ { position: [ 0, 0.5, 0 ], size: [ 2.4, 1, 1.2 ] } ]))

    // Bright Nights: strings of lights swooping across the driveway, a tunnel of bulbs up to the gate
    const posts = new Model()
    const bulbs = new Model()
    for(const x of [ cx + 3.2, cx + 4.6 ])
    {
        for(const side of [ - 1, 1 ])
            posts.cylinder(0.07, 0.09, 3.4, C.wood, [ x - cx, 0, driveZ + side * 1.75 - cz ], 5)
        for(let i = 0; i <= 10; i++)
        {
            const t = i / 10
            bulbs.sphere(0.11, C.gold, [ x - cx, 3.3 - Math.sin(t * Math.PI) * 0.7, driveZ - 1.75 + 3.5 * t - cz ], 0)
        }
    }
    // and along both sides, post to post
    for(const side of [ - 1, 1 ])
        for(let i = 0; i <= 12; i++)
        {
            const t = i / 12
            const x = cx + 3.2 + 1.4 * t
            bulbs.sphere(0.1, C.gold, [ x - cx, 3.3 - Math.abs(Math.sin(t * Math.PI * 3)) * 0.5, driveZ + side * 1.75 - cz ], 0)
        }
    nodes.push(meshNode('lightPosts', posts, ctx.at(cx, cz)))
    nodes.push({ ...meshNode('brightNights', bulbs, ctx.at(cx, cz)), mesh: { geometry: bulbs.geometry(), material: 'emissiveOrangeRadialGradient' } })
    return nodes
}

/** Muir Woods: giant redwoods */
builders.muirWoods = (ctx) =>
{
    const nodes = []
    const cx = ctx.cx, cz = ctx.cz
    const r = rng(77)
    // the redwoods themselves are Bruno's tree model, placed as 'redwoods' in build.mjs
    // trail sign
    const sign = new Model()
    sign.cylinder(0.1, 0.1, 1.8, C.wood, [ 0, 0, 0 ], 5)
    sign.box([ 1.8, 0.7, 0.12 ], C.wood, [ 0, 1.4, 0 ])
    sign.box([ 1.4, 0.12, 0.14 ], C.cream, [ 0, 1.75, 0 ])
    nodes.push(meshNode('trailSign', sign, ctx.at(cx + 5, cz + 2.4)))
    return nodes
}
