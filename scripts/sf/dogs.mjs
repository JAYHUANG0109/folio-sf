/**
 * 小可 (chocolate poodle, teddy cut) and Dookie (giant bernese mountain dog).
 * Low poly, flat shaded, built from chunky "fur" clumps so they sit with the rest of the world.
 * Each dog is a rig of nodes animated in sources/Game/World/Dogs.js:
 *   <dog> > body, head (> earL, earR), tail, legFL, legFR, legBL, legBR
 * Pivots: legs at the hip/shoulder, head at the neck, tail at the base. Forward is +z.
 */
import * as THREE from 'three'
import { rng } from './kit.mjs'

const COLORS = {
    // 小可
    choco: '#5a3624',
    chocoLight: '#7a4a2f',
    chocoDark: '#3e2418',
    // Dookie
    bernBlack: '#1f1b1e',
    bernBlackLight: '#342d31',
    bernRust: '#b0602e',
    bernWhite: '#f3ede4',
    // shared
    nose: '#140c0a',
    eye: '#0f0908',
    glint: '#ffffff',
    tongue: '#ee7a8f',
    collarBlue: '#2f7fe0',   // 小可 is a boy
    collarPink: '#ff6fae',   // Dookie is a girl
    tag: '#e4a90c',
}

/** A part is a set of colored pieces merged per color into meshes */
class Part
{
    constructor(seed)
    {
        this.pieces = new Map()
        this.random = rng(seed)
    }

    add(geometry, colorName, position = [ 0, 0, 0 ], rotation = [ 0, 0, 0 ], scale = [ 1, 1, 1 ])
    {
        const g = geometry.index ? geometry.toNonIndexed() : geometry.clone()
        const m = new THREE.Matrix4().compose(
            new THREE.Vector3(...position),
            new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation, 'YXZ')),
            new THREE.Vector3(...(typeof scale === 'number' ? [ scale, scale, scale ] : scale))
        )
        g.applyMatrix4(m)
        g.deleteAttribute('uv')
        if(!this.pieces.has(colorName))
            this.pieces.set(colorName, [])
        this.pieces.get(colorName).push(g)
        return this
    }

    /** Curly fur clump: a jittered low poly ball */
    fluff(radius, colorName, position, scale = [ 1, 1, 1 ], jitter = 0.18)
    {
        const g = new THREE.IcosahedronGeometry(radius, 1)
        const p = g.attributes.position
        const seen = new Map()
        for(let i = 0; i < p.count; i++)
        {
            const key = `${p.getX(i).toFixed(3)}_${p.getY(i).toFixed(3)}_${p.getZ(i).toFixed(3)}`
            if(!seen.has(key))
                seen.set(key, 1 + (this.random() - 0.5) * jitter * 2)
            const f = seen.get(key)
            p.setXYZ(i, p.getX(i) * f, p.getY(i) * f, p.getZ(i) * f)
        }
        return this.add(g, colorName, position, [ this.random() * 3, this.random() * 3, 0 ], scale)
    }

    ball(radius, colorName, position, scale, detail = 1)
    {
        return this.add(new THREE.IcosahedronGeometry(radius, detail), colorName, position, [ 0, 0, 0 ], scale)
    }

    cylinder(rTop, rBottom, height, colorName, position, rotation, segments = 7)
    {
        return this.add(new THREE.CylinderGeometry(rTop, rBottom, height, segments), colorName, position, rotation)
    }

    box(size, colorName, position, rotation)
    {
        return this.add(new THREE.BoxGeometry(...size), colorName, position, rotation)
    }

    cone(radius, height, colorName, position, rotation, segments = 6)
    {
        return this.add(new THREE.ConeGeometry(radius, height, segments), colorName, position, rotation)
    }

    /** scene nodes: one mesh per color */
    nodes(prefix)
    {
        const out = []
        for(const [ colorName, geometries ] of this.pieces)
        {
            let count = 0
            for(const g of geometries) count += g.attributes.position.count
            const position = new Float32Array(count * 3)
            let offset = 0
            for(const g of geometries)
            {
                position.set(g.attributes.position.array, offset * 3)
                offset += g.attributes.position.count
            }
            const merged = new THREE.BufferGeometry()
            merged.setAttribute('position', new THREE.BufferAttribute(position, 3))
            merged.computeVertexNormals()
            out.push({ name: `${prefix}_${colorName}`, mesh: { geometry: merged, material: `dog_${colorName}`, color: COLORS[colorName] } })
        }
        return out
    }
}

const node = (name, position, part, children = []) => ({ name, position, children: [ ...(part ? part.nodes(name) : []), ...children ] })

/* ---------------- 小可: chocolate poodle, teddy bear cut ---------------- */
function xiaoke()
{
    const hip = 0.62

    // body: overlapping curly clumps
    const body = new Part(11)
    for(let i = 0; i < 7; i++)
    {
        const t = i / 6
        const z = - 0.36 + t * 0.72
        body.fluff(0.27, i % 3 === 0 ? 'chocoLight' : 'choco', [ 0, 0.08 + Math.sin(t * Math.PI) * 0.04, z ], [ 1.05, 0.95, 0.9 ])
        body.fluff(0.17, 'choco', [ 0.18, 0.02, z ], [ 1, 1, 1 ])
        body.fluff(0.17, 'choco', [ - 0.18, 0.02, z ], [ 1, 1, 1 ])
    }
    body.fluff(0.22, 'chocoLight', [ 0, 0.02, 0.42 ], [ 1, 1.1, 0.9 ]) // chest
    // collar with a little gold tag
    body.add(new THREE.TorusGeometry(0.2, 0.045, 5, 12), 'collarBlue', [ 0, 0.2, 0.42 ], [ Math.PI / 2 + 0.6, 0, 0 ])
    body.ball(0.05, 'tag', [ 0, 0.06, 0.58 ], [ 1, 1, 0.4 ], 0)

    // legs: fluffy columns with a pom at the paw
    const leg = (seed) =>
    {
        const p = new Part(seed)
        p.cylinder(0.09, 0.08, hip - 0.1, 'choco', [ 0, - (hip - 0.1) / 2, 0 ])
        p.fluff(0.12, 'choco', [ 0, - 0.12, 0 ], [ 1, 1.2, 1 ])
        p.fluff(0.11, 'chocoLight', [ 0, - 0.32, 0 ], [ 1, 1.1, 1 ])
        p.fluff(0.12, 'choco', [ 0, - hip + 0.08, 0.02 ], [ 1.1, 0.7, 1.2 ])
        return p
    }

    // head: round teddy head, topknot, short muzzle, long fluffy ears
    const head = new Part(21)
    head.fluff(0.24, 'choco', [ 0, 0.14, 0.06 ], [ 1.05, 1, 1 ])
    head.fluff(0.17, 'chocoLight', [ 0, 0.34, 0.0 ], [ 1.1, 0.9, 1 ])  // topknot
    head.fluff(0.12, 'choco', [ 0.13, 0.3, 0.06 ], [ 1, 1, 1 ])
    head.fluff(0.12, 'choco', [ - 0.13, 0.3, 0.06 ], [ 1, 1, 1 ])
    head.fluff(0.13, 'chocoLight', [ 0, 0.06, 0.3 ], [ 1, 0.85, 1.1 ], 0.1) // muzzle
    head.ball(0.05, 'nose', [ 0, 0.1, 0.43 ], [ 1.2, 0.9, 0.8 ], 0)
    head.ball(0.035, 'eye', [ 0.09, 0.2, 0.25 ], [ 1, 1, 0.7 ], 0)
    head.ball(0.035, 'eye', [ - 0.09, 0.2, 0.25 ], [ 1, 1, 0.7 ], 0)
    head.ball(0.012, 'glint', [ 0.1, 0.215, 0.275 ], [ 1, 1, 1 ], 0)
    head.ball(0.012, 'glint', [ - 0.08, 0.215, 0.275 ], [ 1, 1, 1 ], 0)
    head.box([ 0.07, 0.02, 0.08 ], 'tongue', [ 0, - 0.02, 0.38 ], [ 0.3, 0, 0 ])
    const ear = (side, seed) =>
    {
        const p = new Part(seed)
        p.fluff(0.1, 'chocoDark', [ 0, - 0.05, 0 ], [ 0.9, 1.3, 0.8 ])
        p.fluff(0.1, 'choco', [ 0, - 0.2, 0.01 ], [ 0.95, 1.3, 0.85 ])
        p.fluff(0.09, 'chocoDark', [ 0, - 0.33, 0.02 ], [ 1, 1, 0.9 ])
        return node(side > 0 ? 'earL' : 'earR', [ side * 0.2, 0.2, 0.04 ], p)
    }

    // tail: short and up with a pom-pom
    const tail = new Part(31)
    tail.cylinder(0.04, 0.05, 0.22, 'choco', [ 0, 0.1, 0 ], [ - 0.3, 0, 0 ])
    tail.fluff(0.13, 'chocoLight', [ 0, 0.26, - 0.05 ], [ 1, 1, 1 ])

    return node('xiaoke', [ 0, 0, 0 ], null, [
        node('body', [ 0, hip + 0.12, 0 ], body),
        node('head', [ 0, hip + 0.32, 0.46 ], head, [ ear(1, 22), ear(- 1, 23) ]),
        node('tail', [ 0, hip + 0.28, - 0.44 ], tail),
        node('legFL', [ 0.14, hip, 0.3 ], leg(41)),
        node('legFR', [ - 0.14, hip, 0.3 ], leg(42)),
        node('legBL', [ 0.15, hip, - 0.28 ], leg(43)),
        node('legBR', [ - 0.15, hip, - 0.28 ], leg(44)),
    ])
}

/* ---------------- Dookie: giant bernese mountain dog ---------------- */
function dookie()
{
    const hip = 1.25

    // body: long black coat with shaggy sides, white chest bib
    const body = new Part(51)
    body.ball(0.72, 'bernBlack', [ 0, 0.05, 0 ], [ 1, 0.95, 1.85 ], 1)
    for(let i = 0; i < 6; i++)
    {
        const z = - 1.0 + i * 0.4
        for(const side of [ - 1, 1 ])
            body.fluff(0.3, i % 2 ? 'bernBlackLight' : 'bernBlack', [ side * 0.55, - 0.18, z ], [ 0.8, 1.1, 1 ], 0.25)
        body.fluff(0.28, 'bernBlack', [ 0, 0.55, z ], [ 1.4, 0.7, 1 ], 0.2) // back ridge
    }
    body.fluff(0.5, 'bernWhite', [ 0, - 0.12, 1.1 ], [ 0.95, 1.2, 0.7 ], 0.12) // chest bib
    body.fluff(0.3, 'bernWhite', [ 0, - 0.55, 1.0 ], [ 1, 0.8, 0.8 ], 0.15)
    body.fluff(0.24, 'bernRust', [ 0.42, 0.0, 1.05 ], [ 0.7, 1, 0.8 ], 0.15)
    body.fluff(0.24, 'bernRust', [ - 0.42, 0.0, 1.05 ], [ 0.7, 1, 0.8 ], 0.15)
    // red collar with a big tag
    body.add(new THREE.TorusGeometry(0.5, 0.07, 5, 14), 'collarPink', [ 0, 0.45, 1.15 ], [ Math.PI / 2 + 0.7, 0, 0 ])
    body.ball(0.1, 'tag', [ 0, 0.14, 1.52 ], [ 1, 1, 0.4 ], 0)

    // legs: black upper, rust lower, white paws
    const leg = (seed, front) =>
    {
        const p = new Part(seed)
        p.fluff(0.3, 'bernBlack', [ 0, - 0.2, 0 ], [ 0.9, 1.2, 1 ], 0.2)
        p.cylinder(0.19, 0.17, 0.55, 'bernBlack', [ 0, - 0.45, 0 ])
        p.cylinder(0.17, 0.16, 0.45, 'bernRust', [ 0, - 0.85, 0 ])
        if(!front)
            p.fluff(0.2, 'bernBlack', [ 0, - 0.55, - 0.12 ], [ 0.8, 1.1, 0.8 ], 0.25) // feathering
        p.ball(0.2, 'bernWhite', [ 0, - hip + 0.1, 0.06 ], [ 1.05, 0.6, 1.35 ], 1)
        return p
    }

    // head: black skull, white blaze and muzzle, rust cheeks and eyebrows, floppy ears
    const head = new Part(61)
    head.ball(0.5, 'bernBlack', [ 0, 0.25, 0.05 ], [ 1.05, 0.95, 1.05 ], 1)
    head.ball(0.34, 'bernWhite', [ 0, 0.0, 0.52 ], [ 1, 0.8, 1.1 ], 1)          // muzzle
    head.box([ 0.16, 0.5, 0.12 ], 'bernWhite', [ 0, 0.42, 0.44 ], [ - 0.5, 0, 0 ]) // blaze
    head.ball(0.12, 'bernWhite', [ 0, 0.66, 0.3 ], [ 1, 0.6, 1 ], 0)
    head.ball(0.17, 'bernRust', [ 0.3, 0.02, 0.38 ], [ 1, 0.8, 1 ], 1)          // cheeks
    head.ball(0.17, 'bernRust', [ - 0.3, 0.02, 0.38 ], [ 1, 0.8, 1 ], 1)
    head.ball(0.07, 'bernRust', [ 0.17, 0.48, 0.44 ], [ 1.2, 0.8, 0.6 ], 0)      // eyebrow dots
    head.ball(0.07, 'bernRust', [ - 0.17, 0.48, 0.44 ], [ 1.2, 0.8, 0.6 ], 0)
    head.ball(0.06, 'eye', [ 0.18, 0.35, 0.5 ], [ 1, 1, 0.6 ], 0)
    head.ball(0.06, 'eye', [ - 0.18, 0.35, 0.5 ], [ 1, 1, 0.6 ], 0)
    head.ball(0.02, 'glint', [ 0.2, 0.37, 0.54 ], [ 1, 1, 1 ], 0)
    head.ball(0.02, 'glint', [ - 0.16, 0.37, 0.54 ], [ 1, 1, 1 ], 0)
    head.ball(0.1, 'nose', [ 0, 0.12, 0.88 ], [ 1.3, 0.85, 0.9 ], 0)
    head.box([ 0.16, 0.04, 0.22 ], 'tongue', [ 0, - 0.2, 0.74 ], [ 0.5, 0, 0 ])   // happy tongue
    const ear = (side, seed) =>
    {
        const p = new Part(seed)
        p.add(new THREE.ConeGeometry(0.22, 0.5, 3), 'bernBlack', [ 0, - 0.18, 0 ], [ 0, 0, Math.PI ], [ 1, 1, 0.4 ])
        p.fluff(0.12, 'bernBlackLight', [ 0, - 0.08, 0.02 ], [ 1, 1, 0.6 ], 0.2)
        return node(side > 0 ? 'earL' : 'earR', [ side * 0.42, 0.42, 0.05 ], p)
    }

    // tail: long bushy plume, white tip
    const tail = new Part(71)
    for(let i = 0; i < 5; i++)
    {
        const t = i / 4
        tail.fluff(0.2 + Math.sin(t * Math.PI) * 0.08, i === 4 ? 'bernWhite' : 'bernBlack', [ 0, - t * 0.9, - 0.1 - Math.sin(t * 1.3) * 0.45 ], [ 1, 1.1, 1 ], 0.25)
    }

    return node('dookie', [ 0, 0, 0 ], null, [
        node('body', [ 0, hip + 0.35, 0 ], body),
        node('head', [ 0, hip + 0.95, 1.35 ], head, [ ear(1, 62), ear(- 1, 63) ]),
        node('tail', [ 0, hip + 0.6, - 1.25 ], tail),
        node('legFL', [ 0.4, hip, 0.85 ], leg(81, true)),
        node('legFR', [ - 0.4, hip, 0.85 ], leg(82, true)),
        node('legBL', [ 0.42, hip, - 0.85 ], leg(83, false)),
        node('legBR', [ - 0.42, hip, - 0.85 ], leg(84, false)),
    ])
}

export function dogNodes()
{
    return [ xiaoke(), dookie() ]
}
