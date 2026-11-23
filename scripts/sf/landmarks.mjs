/**
 * The 13 stop landmarks.
 * Each builder receives a context and returns children for the stop's area node.
 * Positions given to ctx.at() are WORLD x/z; it returns the area-local position resting on the ground.
 */
import * as THREE from 'three'
import { Model, C, meshNode, fixedNode, dynamicNode, kinematicNode, refNode, rng } from './kit.mjs'
import * as Layout from './layout.mjs'

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

function victorian(width, height, depth, wall, trim, roof, seed)
{
    const r = rng(seed)
    const m = new Model()
    m.box([ width, height, depth ], wall)
    // bay window (front is -x)
    m.box([ 0.7, height * 0.55, width * 0.45 ], wall, [ - depth / 2 - 0.3, height * 0.2, 0 ])
    m.box([ 0.8, 0.12, width * 0.5 ], trim, [ - depth / 2 - 0.3, height * 0.75, 0 ])
    // windows
    for(const fy of [ 0.35, 0.68 ])
        for(const fz of [ - 0.28, 0.28 ])
            m.cbox([ 0.06, height * 0.18, width * 0.16 ], C.black, [ - depth / 2 - 0.66, height * fy, fz * width ])
    // trim bands
    m.box([ depth + 0.1, 0.15, width + 0.1 ], trim, [ 0, height - 0.15, 0 ])
    m.box([ depth + 0.1, 0.2, width + 0.1 ], trim, [ 0, 0, 0 ])
    // door + stairs
    m.box([ 0.1, 1.1, 0.6 ], trim, [ - depth / 2 - 0.05, 0.4, width * 0.32 ])
    m.box([ 0.6, 0.4, 0.8 ], C.stone, [ - depth / 2 - 0.3, 0, width * 0.32 ])
    // pointy gable roof, ridge front to back
    m.gable(depth + 0.2, width + 0.2, 1.4 + r() * 0.8, roof, [ 0, height, 0 ], [ 0, Math.PI / 2, 0 ])
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
builders.sfo = (ctx) =>
{
    const nodes = []
    // Terminal along the east side
    const terminal = new Model()
    terminal.box([ 6, 3.2, 16 ], C.stone)
    terminal.box([ 6.2, 0.9, 16.2 ], C.sky, [ 0, 1.6, 0 ])
    terminal.box([ 7, 0.3, 17 ], C.snow, [ 0, 3.2, 0 ])
    terminal.gable(17, 7, 1.2, C.snow, [ 0, 3.5, 0 ], [ 0, Math.PI / 2, 0 ])
    nodes.push(fixedNode('terminal', terminal, ctx.at(70, 66), [ { position: [ 0, 2.2, 0 ], size: [ 7, 4.4, 17 ] } ]))

    // Control tower
    const tower = new Model()
    tower.cylinder(0.8, 1.1, 9, C.stone, [ 0, 0, 0 ], 8)
    tower.cylinder(2, 1.2, 0.6, C.snow, [ 0, 9, 0 ], 8)
    tower.cylinder(1.9, 1.9, 1.5, C.sky, [ 0, 9.6, 0 ], 8)
    tower.cylinder(2.2, 2, 0.4, C.snow, [ 0, 11.1, 0 ], 8)
    tower.cylinder(0.08, 0.08, 1.5, C.dark, [ 0, 11.5, 0 ], 4)
    tower.sphere(0.2, C.red, [ 0, 13.1, 0 ], 0)
    nodes.push(fixedNode('tower', tower, ctx.at(70, 76), [ { shape: 'tube', position: [ 0, 5, 0 ], radius: 1.2, height: 10 } ]))

    // Parked plane (AA, of course)
    const plane = new Model()
    plane.add(new THREE.CapsuleGeometry(1, 9, 4, 8), C.stone, [ 0, 1.8, 0 ], [ Math.PI / 2, 0, 0 ])
    plane.cbox([ 13, 0.25, 2.4 ], C.stone, [ 0, 1.5, 0.5 ])
    plane.cbox([ 4.5, 0.2, 1.4 ], C.stone, [ 0, 2.2, 5.5 ])
    plane.cbox([ 0.25, 2.6, 1.8 ], C.red, [ 0, 3.5, 5.6 ], [ - 0.3, 0, 0 ])
    plane.cbox([ 0.27, 0.6, 1.6 ], C.sky, [ 0, 3.0, 5.4 ], [ - 0.3, 0, 0 ])
    plane.cbox([ 2.02, 0.25, 9 ], C.red, [ 0, 1.6, 0 ])
    plane.cbox([ 2.04, 0.18, 9 ], C.sky, [ 0, 1.85, 0 ])
    for(const x of [ - 3, 3 ])
        plane.cylinder(0.45, 0.45, 1.6, C.slate, [ x, 0.7, 0 ], 8, [ Math.PI / 2, 0, 0 ])
    plane.cylinder(0.12, 0.12, 0.8, C.dark, [ 0, 0, - 3.5 ], 6)
    plane.cylinder(0.12, 0.12, 0.8, C.dark, [ - 1.2, 0, 0.6 ], 6)
    plane.cylinder(0.12, 0.12, 0.8, C.dark, [ 1.2, 0, 0.6 ], 6)
    nodes.push({
        ...fixedNode('plane', plane, ctx.at(60, 74), [
            { position: [ 0, 1.8, 0 ], size: [ 2, 2, 11 ] },
            { position: [ 0, 1.5, 0.5 ], size: [ 13, 0.4, 2.4 ] },
        ]),
        rotation: [ 0, - 0.5, 0 ],
    })

    // Runway stripes
    const runway = new Model()
    for(let i = 0; i < 6; i++)
        runway.box([ 0.5, 0.04, 2 ], C.snow, [ 0, 0, i * 4 ])
    nodes.push(meshNode('runway', runway, ctx.at(55, 58)))

    // SFO letters
    nodes.push(...letters(ctx, 'SFO', C.bridge, 58, 62, - 0.3, 0.45))

    // Baggage cart crates are added as explosive crates in placements
    return nodes
}

/** 2. Ferry Building */
builders.ferryBuilding = (ctx) =>
{
    const nodes = []
    const cx = 61, cz = - 18
    const hall = new Model()
    hall.box([ 6, 3.6, 26 ], C.cream)
    hall.box([ 6.2, 0.3, 26.2 ], C.snow, [ 0, 3.6, 0 ])
    hall.gable(26.4, 6.6, 1.4, C.slate, [ 0, 3.9, 0 ], [ 0, Math.PI / 2, 0 ])
    // arcade arches on the city side (-x)
    for(let i = - 5; i <= 5; i++)
    {
        hall.cbox([ 0.1, 1.8, 1.4 ], C.black, [ - 3.02, 1.1, i * 2.3 ])
        hall.cbox([ 0.1, 0.6, 1.1 ], C.black, [ - 3.02, 2.6, i * 2.3 ])
    }
    // clock tower in the middle
    hall.box([ 3.2, 6, 3.2 ], C.cream, [ 0, 3.6, 0 ])
    hall.box([ 3.6, 0.3, 3.6 ], C.snow, [ 0, 9.6, 0 ])
    hall.box([ 2.6, 2.4, 2.6 ], C.cream, [ 0, 9.9, 0 ])
    for(const [ x, z, ry ] of [ [ - 1.31, 0, 0 ], [ 1.31, 0, 0 ], [ 0, - 1.31, Math.PI / 2 ], [ 0, 1.31, Math.PI / 2 ] ])
    {
        hall.cylinder(0.85, 0.85, 0.05, C.snow, [ x, 11.1, z ], 12, [ 0, ry, Math.PI / 2 ])
        hall.cbox([ 0.08, 0.6, 0.08 ], C.black, [ x * 1.03, 11.35, z * 1.03 ])
        hall.cbox([ 0.08, 0.08, 0.5 ], C.black, [ x * 1.03, 11.1, z * 1.03 ], [ 0, ry, 0 ])
    }
    hall.box([ 2.8, 0.3, 2.8 ], C.snow, [ 0, 12.3, 0 ])
    hall.box([ 2, 1.6, 2 ], C.cream, [ 0, 12.6, 0 ])
    hall.cylinder(0.9, 1.2, 1, C.cream, [ 0, 14.2, 0 ], 8)
    hall.cone(0.9, 2.2, C.slate, [ 0, 15.2, 0 ], 8)
    hall.cylinder(0.04, 0.04, 1.4, C.dark, [ 0, 17.3, 0 ], 4)
    hall.cbox([ 0.05, 0.4, 0.7 ], C.bridge, [ 0, 18.4, 0.35 ])
    nodes.push(fixedNode('hall', hall, ctx.at(cx, cz), [
        { position: [ 0, 2, 0 ], size: [ 6.2, 4, 26.2 ] },
        { position: [ 0, 8, 0 ], size: [ 3.4, 16, 3.4 ] },
    ]))

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
    const T = 1.5
    const tree = new Model()
    tree.cylinder(0.4 * T, 0.5 * T, 1.4 * T, C.wood, [ 0, 0, 0 ], 6)
    const tiers = 6
    for(let i = 0; i < tiers; i++)
    {
        const r = (3.4 - i * 0.5) * T
        tree.cone(r, 3 * T, i % 2 ? C.olive : C.moss, [ 0, (1.2 + i * 1.6) * T, 0 ], 10)
    }
    const r = rng(7)
    for(let i = 0; i < 70; i++)
    {
        const t = r()
        const h = (1.6 + t * 9) * T
        const radius = (3.3 - t * 3) * 0.85 * T
        const a = r() * Math.PI * 2
        tree.sphere(0.22 * T, [ C.red, C.gold, C.snow, C.sky ][i % 4], [ Math.cos(a) * radius, h, Math.sin(a) * radius ], 0)
    }
    tree.cone(0.6 * T, 1.0 * T, C.gold, [ 0, 11.8 * T, 0 ], 5)
    tree.cone(0.6 * T, 1.0 * T, C.gold, [ 0, 13.8 * T, 0 ], 5, [ Math.PI, 0, 0 ])
    // gifts around the base
    for(let i = 0; i < 8; i++)
    {
        const a = i / 8 * Math.PI * 2 + 0.3
        const size = 0.5 + (i % 3) * 0.2
        tree.box([ size, size, size ], [ C.red, C.sky, C.gold, C.pink ][i % 4], [ Math.cos(a) * 3.2 * T, 0, Math.sin(a) * 3.2 * T ])
        tree.cbox([ size + 0.04, 0.1, 0.12 ], C.snow, [ Math.cos(a) * 3.2 * T, size, Math.sin(a) * 3.2 * T ])
    }
    return tree
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

    // palms only on the outer corners, the middle stays open for driving
    for(const [ x, z ] of [ [ cx + 8.5, cz + 7.5 ], [ cx - 10.5, cz + 8.5 ] ])
        nodes.push(dynamicNode('palm', palmTree(5.5), ctx.at(x, z), [ { shape: 'tube', position: [ 0, 2, 0 ], radius: 0.3, height: 4 } ], 0.5))

    return nodes
}

/** 4. Chinatown Dragon Gate */
builders.chinatown = (ctx) =>
{
    const nodes = []
    const cx = 24, cz = - 6
    const gate = new Model()
    // gate spans x (Grant Ave runs north south)
    const pillars = [ - 5.6, - 4.0, 4.0, 5.6 ]
    for(const x of pillars)
    {
        gate.box([ 0.6, 4.2, 0.6 ], C.red, [ x, 0, 0 ])
        gate.box([ 0.9, 0.5, 0.9 ], C.stone, [ x, 0, 0 ])
    }
    // side roofs
    for(const x of [ - 4.8, 4.8 ])
    {
        gate.box([ 2.6, 0.6, 1.0 ], C.gold, [ x, 3.6, 0 ])
        gate.gable(3.6, 2, 0.8, C.sage, [ x, 4.2, 0 ])
    }
    // main roof
    gate.box([ 8.4, 0.9, 1.1 ], C.red, [ 0, 4.6, 0 ])
    gate.box([ 1.6, 0.6, 0.2 ], C.gold, [ 0, 4.75, - 0.6 ])
    gate.gable(9.6, 2.4, 1.1, C.sage, [ 0, 5.5, 0 ])
    gate.cbox([ 10, 0.2, 0.4 ], C.moss, [ 0, 5.55, 1.1 ], [ 0.2, 0, 0 ])
    gate.cbox([ 10, 0.2, 0.4 ], C.moss, [ 0, 5.55, - 1.1 ], [ - 0.2, 0, 0 ])
    gate.sphere(0.25, C.gold, [ 0, 6.7, 0 ], 0)
    // dragons on the ridge ends
    gate.cbox([ 0.3, 0.6, 0.3 ], C.moss, [ - 4.6, 6.7, 0 ], [ 0, 0, 0.4 ])
    gate.cbox([ 0.3, 0.6, 0.3 ], C.moss, [ 4.6, 6.7, 0 ], [ 0, 0, - 0.4 ])
    nodes.push(fixedNode('dragonGate', gate, ctx.at(cx, cz + 4), pillars.map(x => ({ position: [ x, 2.1, 0 ], size: [ 0.7, 4.2, 0.7 ] }))))

    // foo dog statues
    for(const x of [ - 4.8, 4.8 ])
    {
        const dog = new Model()
        dog.box([ 0.8, 0.6, 0.8 ], C.stone)
        dog.box([ 0.5, 0.6, 0.6 ], C.stone, [ 0, 0.6, 0 ])
        dog.sphere(0.35, C.stone, [ 0, 1.45, - 0.1 ], 0)
        nodes.push(fixedNode('fooDog', dog, ctx.at(cx + x, cz + 5.3), [ { position: [ 0, 0.8, 0 ], size: [ 0.8, 1.6, 0.8 ] } ]))
    }

    // shop houses along Grant Ave
    const colors = [ C.red, C.sage, C.cream, C.gold, C.peach ]
    // (4 rows: the north end stops short of the Lombard crooked block)
    for(let i = 0; i < 4; i++)
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
        nodes.push(fixedNode('alcatrazDock', dock, ctx.atWorld([ 17.5, 0.25 - 0.12 * k, - 72.5 ]), [ { position: [ 0, 0.06, 0 ], size: [ 2.4, 0.12, 1.2 ] } ]))

        const boat = new Model()
        boat.box([ 3.2, 0.45, 1.2 ], C.snow)
        boat.box([ 3.22, 0.1, 1.22 ], C.sky, [ 0, 0.22, 0 ])
        boat.cone(0.6, 0.9, C.snow, [ 1.6, 0.225, 0 ], 4, [ 0, 0, - Math.PI / 2 ])
        boat.box([ 1.8, 0.45, 0.9 ], C.snow, [ - 0.2, 0.45, 0 ])
        for(let i = 0; i < 5; i++)
            for(const side of [ - 1, 1 ])
                boat.cbox([ 0.22, 0.18, 0.04 ], C.black, [ - 0.95 + i * 0.38, 0.68, side * 0.46 ])
        boat.box([ 0.8, 0.35, 0.7 ], C.snow, [ 0.1, 0.9, 0 ])
        boat.cylinder(0.08, 0.1, 0.4, C.dark, [ - 0.5, 0.9, 0 ], 6)
        nodes.push(fixedNode('ferry', boat, ctx.atWorld([ 22, - 0.55, - 69.8 ]), [ { position: [ 0, 0.45, 0 ], size: [ 3.2, 0.9, 1.2 ] } ]))
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
            if(!clear(dx, dz, 0.6) || Math.hypot((dx - (17.5 - cx) / k), (dz - (- 72.5 - cz) / k)) < 1.6)
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

    // the famous crab statue on its red planter, just inside the entrance
    {
        const crab = new Model()
        crab.box([ 1.6, 0.5, 1.6 ], C.red)
        crab.box([ 1.7, 0.08, 1.7 ], C.brick, [ 0, 0.5, 0 ])
        crab.sphere(0.7, C.olive, [ 0, 1.2, 0 ], 1, [ 1.3, 0.75, 1 ])                  // body, planted with yellow flowers
        const rr = rng(390)
        for(let k = 0; k < 26; k++)
        {
            const a = rr() * Math.PI * 2, e = rr() * 0.9
            crab.sphere(0.09, k % 3 ? C.gold : C.sage, [ Math.cos(a) * 0.85 * Math.cos(e), 1.2 + Math.sin(e) * 0.5, Math.sin(a) * 0.65 * Math.cos(e) ], 0)
        }
        for(const side of [ - 1, 1 ])
        {
            for(let l = 0; l < 3; l++)
            {
                const z = - 0.35 + l * 0.35
                crab.beam([ side * 0.75, 1.1, z ], [ side * 1.3, 1.35, z * 1.3 ], 0.08, C.dark)
                crab.beam([ side * 1.3, 1.35, z * 1.3 ], [ side * 1.55, 0.55, z * 1.5 ], 0.07, C.dark)
            }
            crab.beam([ side * 0.6, 1.4, - 0.5 ], [ side * 1.0, 2.3, - 0.8 ], 0.12, C.dark)             // arm up
            crab.sphere(0.32, C.dark, [ side * 1.05, 2.7, - 0.85 ], 1, [ 0.7, 1.3, 0.5 ])               // claw
            crab.cbox([ 0.12, 0.5, 0.18 ], C.dark, [ side * 0.92, 3.05, - 0.85 ], [ 0, 0, side * 0.4 ])
            crab.cylinder(0.03, 0.03, 0.5, C.dark, [ side * 0.2, 1.6, - 0.55 ], 4)                      // eye stalks
            crab.sphere(0.07, C.dark, [ side * 0.2, 2.1, - 0.55 ], 0)
        }
        nodes.push(fixedNode('crabStatue', crab, local(cx - 3.4, deckY, - 53.3), [ { position: [ 0, 0.8, 0 ], size: [ 1.6, 1.6, 1.6 ] } ]))
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
        m.sphere(0.3, C.pink, [ 0, 0.45, (atSouth ? 1 : - 1) * length / 2 ], 0)
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
        nodes.push(dynamicNode('lombardLamp', lampPost(2.2), ctx.at(x, edgeN - 0.6), [ { position: [ 0, 1.1, 0 ], size: [ 0.25, 2.2, 0.25 ] } ], 0.3)) // knockable
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
    for(const [ x, z, h ] of [ [ cx - 8, cz - 3, 7 ], [ cx - 8.5, cz + 2, 6 ], [ cx - 6, cz + 7, 7.5 ], [ cx + 4, cz + 7.5, 6.5 ], [ cx + 7.5, cz + 4.5, 7 ], [ cx + 2, cz - 6.5, 6 ], [ cx - 3, cz - 6.8, 6.8 ] ])
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
    nodes.push(fixedNode('playground', play, ctx.at(cx - 6.5, cz + 4.5), [ { position: [ - 0.3, 0.7, - 0.1 ], size: [ 1.3, 1.4, 1.3 ] } ]))

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
    const nodes = []
    const cx = - 40, cz = - 32
    const S = 1.5
    const rot = new Model()
    const pillars = 8
    const radius = 4 * S + 0.5
    for(let i = 0; i < pillars; i++)
    {
        const a = i / pillars * Math.PI * 2 + Math.PI / 8
        const px = Math.cos(a) * radius, pz = Math.sin(a) * radius
        rot.cylinder(0.5, 0.6, 6 * S, C.salmon, [ px, 0, pz ], 8)
        rot.box([ 1.3, 0.6, 1.3 ], C.salmon, [ px, 6 * S, pz ])
        rot.box([ 1.4, 0.6, 1.4 ], C.salmon, [ px, 0, pz ])
    }
    rot.cylinder(radius + 1.1, radius + 1.1, 1.8, C.salmon, [ 0, 6 * S + 0.5, 0 ], 8)
    rot.cylinder(radius + 0.8, radius + 1.1, 0.8, C.blush, [ 0, 6 * S + 2.3, 0 ], 8)
    rot.dome(radius + 0.5, C.peach, [ 0, 6 * S + 3.0, 0 ], 12)
    rot.cylinder(0.5, 0.8, 0.8, C.blush, [ 0, 6 * S + 3.0 + radius + 0.3, 0 ], 8)
    // statues on the entablature corners
    for(let i = 0; i < 4; i++)
    {
        const a = i / 4 * Math.PI * 2
        rot.box([ 0.8, 1.4, 0.8 ], C.cream, [ Math.cos(a) * (radius + 0.6), 6 * S + 2.3, Math.sin(a) * (radius + 0.6) ])
    }
    nodes.push(fixedNode('rotunda', rot, ctx.at(cx, cz), Array.from({ length: pillars }, (_, i) =>
    {
        const a = i / pillars * Math.PI * 2 + Math.PI / 8
        return { shape: 'tube', position: [ Math.cos(a) * radius, 3 * S, Math.sin(a) * radius ], radius: 0.65, height: 6 * S }
    })))

    // colonnade arcs (north of the rotunda), columns wide apart
    const arcRadius = 11 * S
    const arcCenter = 6 * S
    for(const side of [ - 1, 1 ])
    {
        const col = new Model()
        const cols = []
        const steps = 6
        let prev = null
        for(let i = 0; i < steps; i++)
        {
            const a = side * (0.5 + i * 0.24)
            const x = Math.sin(a) * arcRadius, z = - Math.cos(a) * arcRadius + arcCenter
            col.cylinder(0.4, 0.45, 4.5 * S, C.salmon, [ x, 0, z ], 6)
            col.box([ 1, 0.6, 1 ], C.salmon, [ x, 4.5 * S, z ])
            cols.push({ shape: 'tube', position: [ x, 2.25 * S, z ], radius: 0.5, height: 4.5 * S })
            if(prev)
                col.beam([ prev[0], 4.5 * S + 0.8, prev[1] ], [ x, 4.5 * S + 0.8, z ], 0.9, C.blush)
            prev = [ x, z ]
        }
        nodes.push(fixedNode('colonnade', col, ctx.at(cx, cz), cols))
    }

    // swans in the lagoon
    for(let i = 0; i < 3; i++)
    {
        const swan = new Model()
        swan.sphere(0.35, C.snow, [ 0, 0, 0 ], 1, [ 1, 0.7, 1.4 ])
        swan.cylinder(0.08, 0.1, 0.6, C.snow, [ 0, 0.1, - 0.35 ], 5, [ - 0.3, 0, 0 ])
        swan.sphere(0.12, C.snow, [ 0, 0.68, - 0.55 ], 0)
        swan.cone(0.06, 0.2, C.orange, [ 0, 0.66, - 0.65 ], 4, [ - Math.PI / 2, 0, 0 ])
        nodes.push(meshNode('swan', swan, [ cx - 3 + i * 2.6 - ctx.cx, - 0.2 - ctx.y, - 20 + (i % 2) - ctx.cz ])) // water surface (-0.3 world) in design units
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
    deck.box([ halfWidth * 2 - 1, 0.62, length ], C.dark, [ 0, - 0.6, 0 ])
    // the rails stop a little before the north end, so the exit opens up into the bend toward Napa / Muir Woods
    const railCut = 2.5
    deck.box([ 0.3, 0.9, length - railCut ], C.bridge, [ - halfWidth, 0, railCut / 2 ])
    deck.box([ 0.3, 0.9, length - railCut ], C.bridge, [ halfWidth, 0, railCut / 2 ])
    for(let z = - length / 2; z < length / 2; z += 1.2)
        deck.cbox([ halfWidth * 2 - 1.2, 0.03, 0.4 ], C.snow, [ 0, 0.02, z ])
    // truss under the deck
    deck.box([ halfWidth * 2, 1.2, length ], C.bridge, [ 0, - 1.8, 0 ])
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
        const tower = new Model()
        for(const side of [ - 1, 1 ])
        {
            tower.box([ 1.2, towerHeight + 4, 1.6 ], C.bridge, [ side * (halfWidth + 0.5), - 4, 0 ])
            tower.box([ 1.0, towerHeight * 0.45, 1.3 ], C.bridge, [ side * (halfWidth + 0.6), towerHeight * 0.55, 0 ])
        }
        for(const h of [ 3.5, 8, 12.5, 17 ])
        {
            tower.box([ halfWidth * 2 + 2, 1.0, 1.2 ], C.bridge, [ 0, h, 0 ])
            tower.box([ halfWidth * 2 - 1, 0.6, 1.3 ], C.black, [ 0, h - 1.4, 0 ])
        }
        tower.box([ halfWidth * 2 + 2.2, 0.8, 1.6 ], C.bridge, [ 0, towerHeight, 0 ])
        // red aircraft lights
        tower.sphere(0.25, C.red, [ - halfWidth - 0.5, towerHeight + 0.9, 0 ], 0)
        tower.sphere(0.25, C.red, [ halfWidth + 0.5, towerHeight + 0.9, 0 ], 0)
        // pier in the water
        tower.box([ halfWidth * 2 + 4, 3.5, 4 ], C.stone, [ 0, - 6.5, 0 ])
        nodes.push(fixedNode('bridgeTower', tower, local(x, deckY, tz), [
            { position: [ - halfWidth - 0.5, towerHeight / 2 - 2, 0 ], size: [ 1.2, towerHeight + 4, 1.6 ] },
            { position: [ halfWidth + 0.5, towerHeight / 2 - 2, 0 ], size: [ 1.2, towerHeight + 4, 1.6 ] },
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
    field.box([ 24, 0.05, 11 ], C.moss)
    for(let i = 0; i <= 10; i++)
        field.box([ 0.12, 0.06, 11 ], C.snow, [ - 10 + i * 2, 0, 0 ])
    field.box([ 2, 0.055, 11 ], C.red, [ - 11, 0, 0 ])
    field.box([ 2, 0.055, 11 ], C.red, [ 11, 0, 0 ])
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

    // stands: four sides, gaps at the corners to drive in
    const standColor = [ C.red, C.stone ]
    const addStand = (name, px, pz, length, rotationY) =>
    {
        const s = new Model()
        for(let t = 0; t < 4; t++)
        {
            s.box([ length, 1 + t * 1.1, 1.3 ], standColor[t % 2], [ 0, 0, t * 1.3 ])
            // fans
            for(let k = 0; k < length / 1.4; k++)
                if((k + t) % 3 !== 0)
                    s.sphere(0.2, [ C.red, C.gold, C.snow, C.red ][(k + t) % 4], [ - length / 2 + 0.7 + k * 1.4, 1.25 + t * 1.1, t * 1.3 ], 0)
        }
        s.box([ length, 0.4, 5.6 ], C.slate, [ 0, 5.6, 2.2 ])
        nodes.push({ ...fixedNode(name, s, ctx.at(px, pz), [ { position: [ 0, 2.5, 2 ], size: [ length, 5, 5.2 ] } ]), rotation: [ 0, rotationY, 0 ] })
    }
    addStand('standNorth', cx, cz - 7.5, 22, Math.PI)
    addStand('standSouth', cx, cz + 7.5, 22, 0)
    addStand('standWest', cx - 15.5, cz, 9, - Math.PI / 2)
    addStand('standEast', cx + 15.5, cz, 9, Math.PI / 2)

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
        nodes.push(fixedNode('suiteTower', tower, ctx.at(cx, cz - 15), [ { position: [ 0, 4.7, 0 ], size: [ 24, 9.4, 3.6 ] } ]))
    }

    // giant video boards above both end zones, playing the 49ers
    for(const side of [ - 1, 1 ])
    {
        const b = new Model()
        for(const z of [ - 2.6, 2.6 ])
            b.box([ 0.5, 6.5, 0.5 ], C.dark, [ z, 0, 0 ])
        b.box([ 8.4, 3.4, 0.5 ], C.dark, [ 0, 6.2, 0 ])
        b.box([ 8, 3, 0.1 ], C.black, [ 0, 6.4, 0.25 ])
        b.box([ 8, 0.5, 0.11 ], C.red, [ 0, 6.4, 0.26 ])
        pixelText(b, '49ERS', C.gold, [ 0, 7.25, 0.33 ], 0.26, { depth: 0.06 })
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
    const colors = [ C.sky, C.blush, C.sage, C.lavender, C.cream, C.peach, C.pink ]
    const roofs = [ C.slate, C.salmon, C.slate, C.olive, C.slate, C.brick, C.slate ]
    for(let i = 0; i < 7; i++)
    {
        const z = 6.5 + i * 2.9
        const house = victorian(2.8, 3.6, 4, colors[i], C.snow, roofs[i], i + 12)
        nodes.push(fixedNode('lady', house, ctx.at(- 15, z), [ { position: [ 0, 1.8, 0 ], size: [ 4, 3.6, 2.8 ] } ]))
    }
    // bench and a dog on the Alamo Square lawn
    const dog = new Model()
    dog.box([ 0.8, 0.4, 0.35 ], C.gold, [ 0, 0.3, 0 ])
    dog.box([ 0.3, 0.3, 0.3 ], C.gold, [ 0.45, 0.6, 0 ])
    for(const [ x, z ] of [ [ - 0.3, - 0.12 ], [ 0.3, - 0.12 ], [ - 0.3, 0.12 ], [ 0.3, 0.12 ] ])
        dog.box([ 0.1, 0.3, 0.1 ], C.gold, [ x, 0, z ])
    nodes.push(dynamicNode('dog', dog, ctx.at(- 25, 12, 0.1), [ { position: [ 0, 0.4, 0 ], size: [ 0.9, 0.8, 0.4 ] } ], 0.3))
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

    /* Castle: crenellated curtain wall, four corner towers, a tall keep, gatehouse with a glowing arch */
    const castle = new Model()
    const stoneA = C.khaki, stoneB = C.cream, roofC = C.brick
    const crenels = (x0, z0, x1, z1, y) =>
    {
        const length = Math.hypot(x1 - x0, z1 - z0)
        const count = Math.floor(length / 0.9)
        for(let i = 0; i <= count; i++)
        {
            const t = i / count
            castle.box([ 0.5, 0.55, 0.5 ], stoneB, [ x0 + (x1 - x0) * t, y, z0 + (z1 - z0) * t ])
        }
    }
    // curtain walls (local: x = depth toward the gate is -x... front faces +x)
    const hw = 3.2, hd = 4.0 // half depth (x), half width (z)
    castle.box([ hw * 2, 4.4, hd * 2 ], stoneA)
    castle.box([ hw * 2 + 0.2, 0.3, hd * 2 + 0.2 ], stoneB, [ 0, 4.4, 0 ])
    crenels(hw, - hd, hw, hd, 4.7); crenels(- hw, - hd, - hw, hd, 4.7)
    crenels(- hw, - hd, hw, - hd, 4.7); crenels(- hw, hd, hw, hd, 4.7)
    // corner towers with tall conical roofs and pennants
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
        // arrow slit windows, lit at night
        for(const y of [ 2.4, 4.6 ])
            castle.cbox([ 0.1, 0.8, 0.3 ], C.gold, [ x + 1.36, y, z ])
    }
    // the keep, rising behind the wall
    castle.box([ 3.4, 9.5, 3.4 ], stoneB, [ - 1, 0, 0 ])
    castle.box([ 3.7, 0.3, 3.7 ], stoneA, [ - 1, 9.5, 0 ])
    crenels(0.75, - 1.75, 0.75, 1.75, 9.85); crenels(- 2.75, - 1.75, - 2.75, 1.75, 9.85)
    crenels(- 2.75, - 1.75, 0.75, - 1.75, 9.85); crenels(- 2.75, 1.75, 0.75, 1.75, 9.85)
    castle.cylinder(0.9, 1, 3, stoneA, [ - 1, 9.5, 0 ], 10)
    castle.cone(1.15, 3.2, roofC, [ - 1, 12.5, 0 ], 10)
    castle.cylinder(0.05, 0.05, 1.6, C.dark, [ - 1, 15.6, 0 ], 4)
    castle.cbox([ 0.06, 0.6, 1.2 ], C.gold, [ - 1, 16.8, 0.6 ])
    for(const z of [ - 1, 0, 1 ])
        castle.cbox([ 0.1, 1, 0.45 ], C.gold, [ 0.72, 6.5, z ])
    // gatehouse: two small towers around a tall arched door
    for(const z of [ - 1.6, 1.6 ])
    {
        castle.cylinder(0.8, 0.9, 6, stoneB, [ hw + 0.4, 0, z ], 10)
        castle.cone(1, 2.2, roofC, [ hw + 0.4, 6, z ], 10)
    }
    castle.box([ 0.8, 5.2, 2.4 ], stoneB, [ hw + 0.4, 0, 0 ])
    crenels(hw + 0.4, - 0.9, hw + 0.4, 0.9, 5.5)
    castle.cbox([ 0.1, 2.6, 1.6 ], C.wood, [ hw + 0.82, 1.3, 0 ])
    castle.cylinder(0.8, 0.8, 0.1, C.wood, [ hw + 0.82, 2.6, 0 ], 12, [ 0, 0, Math.PI / 2 ])
    castle.cbox([ 0.12, 0.3, 2 ], C.gold, [ hw + 0.85, 3.7, 0 ])               // name plate
    // rows of lit windows on the front wall
    for(const z of [ - 3.3, - 2.5, 2.5, 3.3 ])
        for(const y of [ 1.6, 3.2 ])
            castle.cbox([ 0.1, 0.7, 0.4 ], C.gold, [ hw + 0.02, y, z ])
    // stone steps up to the gate
    castle.box([ 1.6, 0.25, 3 ], stoneB, [ hw + 1.6, 0, 0 ])
    castle.box([ 1, 0.25, 3 ], stoneB, [ hw + 1.3, 0.25, 0 ])
    nodes.push({ ...fixedNode('castle', castle, ctx.at(castleX, driveZ), [
        { position: [ 0, 2.2, 0 ], size: [ hw * 2 + 0.6, 4.4, hd * 2 + 0.6 ] },
        { position: [ - 1, 6, 0 ], size: [ 3.4, 12, 3.4 ] },
        { position: [ hw + 0.4, 2.6, 0 ], size: [ 1.8, 5.2, 4.6 ] },
    ]) })

    // Aura: a warm halo on the ground and soft light beams rising from the towers
    nodes.push({ name: 'castleHalo', position: ctx.at(castleX + 1, driveZ, 0.06), mesh: { geometry: new THREE.CircleGeometry(7, 48).rotateX(- Math.PI / 2), material: 'auraHalo' } })
    for(const [ x, z, h, r ] of [ [ hw, hd, 14, 1.3 ], [ hw, - hd, 14, 1.3 ], [ - hw, hd, 14, 1.3 ], [ - hw, - hd, 14, 1.3 ], [ - 1, 0, 22, 1.6 ] ])
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

    // vine rows lining both sides of the driveway (rows run east-west, the car drives between them)
    for(const [ side, offset ] of [ [ - 1, 2.6 ], [ - 1, 4.3 ], [ 1, 2.6 ] ])
    {
        {
            const vines = new Model()
            for(let i = 0; i < 3; i++)
            {
                vines.cylinder(0.06, 0.06, 1.1, C.wood, [ i * 1.2 - 1.2, 0, 0 ], 4)
                vines.sphere(0.45, C.moss, [ i * 1.2 - 1.2, 1.1, 0 ], 1, [ 1.2, 0.8, 0.7 ])
                vines.sphere(0.16, C.purple, [ i * 1.2 - 1.0, 0.75, 0.3 ], 0)
                vines.sphere(0.16, C.purple, [ i * 1.2 - 1.4, 0.8, - 0.3 ], 0)
            }
            vines.beam([ - 1.4, 1.0, 0 ], [ 1.4, 1.0, 0 ], 0.04, C.dark)
            nodes.push(fixedNode('vines', vines, ctx.at(cx + 3.6, driveZ + side * offset), [ { position: [ 0, 0.6, 0 ], size: [ 3, 1.2, 0.6 ] } ]))
        }
    }

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
