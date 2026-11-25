import * as THREE from 'three/webgpu'
import { color, float, time, sin } from 'three/tsl'
import { Game } from '../Game.js'
import { MeshDefaultMaterial } from '../Materials/MeshDefaultMaterial.js'

/**
 * Winter at SFO:
 *  - Santa rides the floating EVA plane (dressed as a reindeer, see landmarks.mjs evaPlane) like a horse, straddling the
 *    fuselage behind the antlers, reins in hand, bouncing along. When the car comes near he twists round toward it,
 *    wherever it is, and waves.
 *  - His two reindeer rest on the holiday deck on top of the control tower, legs tucked, looking around;
 *    Rudolph's nose glows at night.
 * Built from smooth shapes (lathes, capsules, tubes) for a soft, lifelike look.
 */
const DECK = { x: 75.5, y: 22.35, z: 84.5 }        // printed by `npm run sf:build` ("SFO tower deck")
const PLANE_SCALE = 1.5                              // the SFO site scale
const SEAT = new THREE.Vector3(0, 2.68, - 3.9).multiplyScalar(PLANE_SCALE)        // the saddle, plane local (design y0 + R, behind the harness)
const ANTLERS = [ - 1, 1 ].map(side => new THREE.Vector3(side * 0.35, 2.75, - 5.9).multiplyScalar(PLANE_SCALE))

const RED = '#c8202b', DEEP_RED = '#8e1420', FUR = '#fbf8f3', SKIN = '#f2c09e', CHEEK = '#ec8f86', BLACK = '#231c1e',
    GOLD = '#e6b43a', GLOVE = '#3b2f2c', BROWN = '#7a5236', BROWN_DARK = '#4e3424', BELLY = '#eadcc6', ANTLER = '#cfae84',
    HOOF = '#2b211c', HAY = '#d9b85a', GREEN = '#2f8a4c'

export class Santa
{
    constructor()
    {
        this.game = Game.getInstance()
        this.mats = new Map()
        this.sphere = new THREE.SphereGeometry(1, 24, 16)

        // Santa: a rider group that follows the plane every frame
        this.rider = new THREE.Group()
        this.rider.visible = false
        this.game.scene.add(this.rider)
        this.seat = new THREE.Group()
        this.seat.position.copy(SEAT)
        this.seat.rotation.y = Math.PI                   // he faces the nose (plane local -z)
        this.seat.scale.setScalar(1.55)
        this.rider.add(this.seat)
        this.buildSanta()
        this.reins = [ 0, 1 ].map(() => [ this.segment(), this.segment() ])

        // the reindeer on the tower deck
        this.deck = new THREE.Group()
        this.deck.position.set(DECK.x, DECK.y, DECK.z)
        this.deck.scale.setScalar(2.5)
        this.deck.visible = true
        this.game.scene.add(this.deck)
        this.reindeer = [ this.buildReindeer(- 0.95, 0.2, 0.9, false), this.buildReindeer(0.95, - 0.25, - 2.3, true) ]
        for(const [ x, z ] of [ [ 0, 0.9 ], [ 0.1, - 0.9 ] ])
            this.part(this.deck, this.sphere, HAY, [ x, 0.04, z ], [ 0.42, 0.14, 0.3 ])

        // snoring: little Z's drifting up from each sleeper (spring, summer, fall)
        this.zMat = new THREE.MeshBasicNodeMaterial()
        this.zMat.colorNode = color('#e8f0ff')
        this.snorers = [
            { head: this.head, size: 0.9, phase: 0, zs: [ 0, 1, 2 ].map(() => this.makeZ()) },
            ...this.reindeer.map((d, i) => ({ head: d.head, size: 0.75, phase: 0.4 + i * 0.3, zs: [ 0, 1, 2 ].map(() => this.makeZ()) })),
        ]

        this.time = 0
        this.wave = 0
        this.twist = 0
        this.awake = null
        this.tempA = new THREE.Vector3()
        this.tempB = new THREE.Vector3()
        this.car = new THREE.Vector3()
        this.game.ticker.events.on('tick', () => this.update(), 14)
    }

    mat(hex, glow = false)
    {
        const key = hex + (glow ? '+glow' : '')
        if(!this.mats.has(key))
        {
            const params = { colorNode: color(hex), hasWater: false }
            if(glow)    // Rudolph's nose: glows and gently pulses after dark
                params.emissiveNode = color('#ff2a2a').mul(sin(time.mul(3)).mul(0.25).add(1.1)).mul(this.game.materials.nightUniform ?? float(0))
            this.mats.set(key, new MeshDefaultMaterial(params))
        }
        return this.mats.get(key)
    }

    part(parent, geometry, hex, [ x, y, z ] = [ 0, 0, 0 ], [ sx, sy, sz ] = [ 1, 1, 1 ], [ rx, ry, rz ] = [ 0, 0, 0 ], glow = false)
    {
        const m = new THREE.Mesh(geometry, this.mat(hex, glow))
        m.position.set(x, y, z)
        m.scale.set(sx, sy, sz)
        m.rotation.set(rx, ry, rz)
        m.castShadow = true
        parent.add(m)
        return m
    }

    tube(parent, points, radius, hex, segments = 20, radial = 8)
    {
        const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)))
        return this.part(parent, new THREE.TubeGeometry(curve, segments, radius, radial), hex)
    }

    /** capsule between two points */
    limb(parent, a, b, radius, hex)
    {
        const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b)
        const m = this.part(parent, new THREE.CapsuleGeometry(radius, va.distanceTo(vb), 6, 12), hex, [ (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2 ])
        m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize())
        return m
    }

    /** a rein segment (unit cylinder, stretched between two world points every frame) */
    segment()
    {
        const m = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 5), this.mat(BROWN_DARK))
        m.castShadow = true
        this.rider.parent.add(m)
        m.visible = false
        return m
    }

    stretch(mesh, a, b, radius)
    {
        mesh.position.copy(a).add(b).multiplyScalar(0.5)
        const d = this.tempB.copy(b).sub(a)
        mesh.scale.set(radius, d.length(), radius)
        mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize())
    }

    /** an arm on a shoulder pivot: upper arm, elbow pivot, forearm, fur cuff, mitten (rest pose hangs down -y) */
    arm(parent, side)
    {
        const shoulder = new THREE.Group()
        shoulder.position.set(side * 0.36, 0.64, 0.02)
        parent.add(shoulder)
        this.part(shoulder, this.sphere, RED, [ 0, 0, 0 ], [ 0.1, 0.1, 0.1 ])
        this.limb(shoulder, [ 0, 0, 0 ], [ 0, - 0.26, 0 ], 0.085, RED)
        const elbow = new THREE.Group()
        elbow.position.set(0, - 0.26, 0)
        shoulder.add(elbow)
        this.limb(elbow, [ 0, 0, 0 ], [ 0, - 0.24, 0 ], 0.075, RED)
        this.part(elbow, new THREE.TorusGeometry(0.07, 0.03, 8, 14), FUR, [ 0, - 0.24, 0 ], [ 1, 1, 1 ], [ Math.PI / 2, 0, 0 ])
        const hand = this.part(elbow, this.sphere, GLOVE, [ 0, - 0.32, 0 ], [ 0.07, 0.075, 0.06 ])
        this.part(elbow, this.sphere, GLOVE, [ - side * 0.05, - 0.3, 0.02 ], [ 0.025, 0.04, 0.025 ])
        return { shoulder, elbow, hand }
    }

    buildSanta()
    {
        const s = this.seat
        const sphere = this.sphere
        // lower body, straddling the fuselage (radius ~0.82 in these units, its center ~0.87 below the saddle)
        this.part(s, sphere, RED, [ 0, 0.1, 0 ], [ 0.36, 0.16, 0.3 ])
        for(const side of [ - 1, 1 ])
        {
            this.limb(s, [ side * 0.2, 0.08, 0.02 ], [ side * 0.74, - 0.3, 0.2 ], 0.125, RED)
            this.limb(s, [ side * 0.74, - 0.3, 0.2 ], [ side * 0.88, - 0.82, 0.08 ], 0.1, RED)
            this.part(s, new THREE.TorusGeometry(0.11, 0.04, 8, 16), FUR, [ side * 0.87, - 0.76, 0.09 ], [ 1, 1, 1 ], [ Math.PI / 2, 0, side * 0.25 ])
            this.part(s, sphere, BLACK, [ side * 0.9, - 0.92, 0.16 ], [ 0.11, 0.09, 0.19 ])
            this.part(s, new THREE.CylinderGeometry(0.06, 0.06, 0.04, 12), GOLD, [ side * 0.9, - 0.86, 0.02 ], [ 1, 1, 1 ], [ 0, 0, Math.PI / 2 ])  // spur
        }
        // upper body on a waist pivot: turns toward the car, leans into the ride
        const u = new THREE.Group()
        u.position.set(0, 0.12, 0)
        s.add(u)
        this.upper = u
        const coat = new THREE.LatheGeometry([ [ 0.0, 0 ], [ 0.36, 0.02 ], [ 0.44, 0.2 ], [ 0.43, 0.42 ], [ 0.36, 0.62 ], [ 0.24, 0.74 ], [ 0.12, 0.78 ] ].map(([ x, y ]) => new THREE.Vector2(x, y)), 28)
        this.part(u, coat, RED, [ 0, 0, 0 ], [ 1, 1, 0.92 ])
        this.part(u, new THREE.TorusGeometry(0.4, 0.06, 10, 28), FUR, [ 0, 0.06, 0 ], [ 1, 0.92, 1 ], [ Math.PI / 2, 0, 0 ])
        this.part(u, new THREE.CylinderGeometry(0.44, 0.44, 0.08, 28), BLACK, [ 0, 0.34, 0 ], [ 1, 1, 0.93 ])
        this.part(u, new THREE.BoxGeometry(0.16, 0.12, 0.04), GOLD, [ 0, 0.34, 0.41 ])
        this.part(u, new THREE.BoxGeometry(0.08, 0.06, 0.05), BLACK, [ 0, 0.34, 0.415 ])
        this.part(u, new THREE.BoxGeometry(0.1, 0.62, 0.04), FUR, [ 0, 0.4, 0.36 ], [ 1, 1, 1 ], [ - 0.22, 0, 0 ])
        this.part(u, new THREE.TorusGeometry(0.17, 0.05, 8, 20), FUR, [ 0, 0.76, 0 ], [ 1, 1, 1 ], [ Math.PI / 2, 0, 0 ])
        // head: face, rosy cheeks, button nose, eyes behind gold glasses, bushy brows, full curly beard and moustache
        const head = new THREE.Group()
        head.position.set(0, 0.98, 0.04)
        u.add(head)
        this.head = head
        this.santaLids = []
        this.part(head, sphere, SKIN, [ 0, 0, 0 ], [ 0.19, 0.21, 0.19 ])
        for(const side of [ - 1, 1 ])
        {
            this.part(head, sphere, CHEEK, [ side * 0.1, - 0.02, 0.13 ], [ 0.055, 0.045, 0.04 ])
            this.part(head, sphere, '#ffffff', [ side * 0.065, 0.05, 0.165 ], [ 0.028, 0.024, 0.012 ])
            this.part(head, sphere, BLACK, [ side * 0.065, 0.05, 0.175 ], [ 0.015, 0.017, 0.008 ])
            this.part(head, new THREE.TorusGeometry(0.036, 0.006, 6, 16), GOLD, [ side * 0.065, 0.05, 0.185 ])
            this.santaLids.push(this.part(head, sphere, SKIN, [ side * 0.065, 0.052, 0.17 ], [ 0.031, 0.027, 0.016 ]))       // closed eyelids (asleep)
            this.part(head, sphere, FUR, [ side * 0.07, 0.1, 0.16 ], [ 0.05, 0.02, 0.025 ], [ 0, 0, - side * 0.2 ])
            this.part(head, sphere, SKIN, [ side * 0.19, 0.01, 0 ], [ 0.03, 0.05, 0.03 ])
            this.part(head, sphere, FUR, [ side * 0.13, - 0.05, 0.17 ], [ 0.09, 0.035, 0.04 ], [ 0, - side * 0.3, - side * 0.35 ])
        }
        this.part(head, sphere, CHEEK, [ 0, 0.0, 0.195 ], [ 0.035, 0.032, 0.035 ])
        for(const [ x, y, z, r ] of [ [ 0, - 0.17, 0.1, 0.15 ], [ - 0.1, - 0.13, 0.08, 0.11 ], [ 0.1, - 0.13, 0.08, 0.11 ], [ 0, - 0.3, 0.08, 0.11 ], [ - 0.07, - 0.26, 0.1, 0.08 ], [ 0.07, - 0.26, 0.1, 0.08 ], [ - 0.16, - 0.04, 0.04, 0.07 ], [ 0.16, - 0.04, 0.04, 0.07 ], [ 0, - 0.4, 0.06, 0.06 ] ])
            this.part(head, sphere, FUR, [ x, y, z ], [ r, r, r * 0.85 ])
        this.part(head, new THREE.TorusGeometry(0.18, 0.05, 10, 24), FUR, [ 0, 0.15, 0 ], [ 1, 1, 1 ], [ Math.PI / 2 - 0.15, 0, 0 ])
        const hat = new THREE.LatheGeometry([ [ 0.18, 0 ], [ 0.16, 0.1 ], [ 0.11, 0.22 ], [ 0.06, 0.32 ], [ 0.02, 0.38 ] ].map(([ x, y ]) => new THREE.Vector2(x, y)), 20)
        this.hat = this.part(head, hat, RED, [ 0, 0.16, - 0.02 ], [ 1, 1, 1 ], [ - 0.5, 0, - 0.2 ])
        this.part(head, sphere, FUR, [ 0.06, 0.38, - 0.22 ], [ 0.055, 0.055, 0.055 ])
        // arms: left holds the reins, right holds them too while riding and waves at the car
        this.leftArm = this.arm(u, - 1)
        this.rightArm = this.arm(u, 1)
    }

    /** a reindeer lying down with its legs tucked, head up on a pivot */
    buildReindeer(x, z, yaw, rudolph)
    {
        const r = new THREE.Group()
        r.position.set(x, 0, z)
        r.rotation.y = yaw
        this.deck.add(r)
        const sphere = this.sphere
        // body resting on the deck, cream belly, rump patch and a short white tail
        this.part(r, new THREE.CapsuleGeometry(0.21, 0.55, 8, 18), BROWN, [ 0, 0.27, - 0.05 ], [ 1.05, 0.95, 1 ], [ Math.PI / 2, 0, 0 ])
        this.part(r, sphere, BROWN, [ 0, 0.33, 0.27 ], [ 0.23, 0.25, 0.23 ])
        this.part(r, sphere, BELLY, [ 0, 0.3, 0.42 ], [ 0.14, 0.17, 0.1 ])
        this.part(r, sphere, BELLY, [ 0, 0.32, - 0.43 ], [ 0.14, 0.15, 0.06 ])
        this.part(r, sphere, FUR, [ 0, 0.42, - 0.47 ], [ 0.05, 0.08, 0.04 ], [ 0.5, 0, 0 ])
        // folded legs: hind thighs bulging at the sides with the shanks tucked forward, front legs folded under the chest
        for(const side of [ - 1, 1 ])
        {
            this.part(r, sphere, BROWN, [ side * 0.19, 0.22, - 0.28 ], [ 0.12, 0.15, 0.2 ])
            this.limb(r, [ side * 0.24, 0.07, - 0.38 ], [ side * 0.22, 0.06, - 0.02 ], 0.035, BROWN)
            this.part(r, new THREE.CylinderGeometry(0.04, 0.05, 0.07, 10), HOOF, [ side * 0.22, 0.05, 0.02 ], [ 1, 1, 1 ], [ Math.PI / 2, 0, 0 ])
            this.limb(r, [ side * 0.12, 0.08, 0.35 ], [ side * 0.1, 0.05, 0.08 ], 0.04, BROWN)
            this.part(r, new THREE.CylinderGeometry(0.04, 0.05, 0.07, 10), HOOF, [ side * 0.1, 0.05, 0.05 ], [ 1, 1, 1 ], [ Math.PI / 2, 0, 0 ])
        }
        // red collar with gold jingle bells, a green blanket with gold trim
        this.part(r, new THREE.TorusGeometry(0.14, 0.03, 8, 20), RED, [ 0, 0.55, 0.38 ], [ 1, 1, 1 ], [ 1.0, 0, 0 ])
        for(let i = 0; i < 5; i++)
            this.part(r, sphere, GOLD, [ (i - 2) * 0.06, 0.46 - Math.abs(i - 2) * 0.02, 0.5 - Math.abs(i - 2) * 0.03 ], [ 0.03, 0.03, 0.03 ])
        this.part(r, new THREE.BoxGeometry(0.46, 0.03, 0.38), GREEN, [ 0, 0.49, - 0.1 ])
        this.part(r, new THREE.BoxGeometry(0.48, 0.035, 0.03), GOLD, [ 0, 0.485, 0.09 ])
        this.part(r, new THREE.BoxGeometry(0.48, 0.035, 0.03), GOLD, [ 0, 0.485, - 0.29 ])
        // neck and head
        this.limb(r, [ 0, 0.4, 0.3 ], [ 0, 0.72, 0.48 ], 0.11, BROWN)
        this.part(r, sphere, BELLY, [ 0, 0.52, 0.45 ], [ 0.08, 0.14, 0.07 ], [ - 0.6, 0, 0 ])
        const head = new THREE.Group()
        head.position.set(0, 0.76, 0.5)
        r.add(head)
        this.part(head, sphere, BROWN, [ 0, 0.02, 0.04 ], [ 0.11, 0.11, 0.14 ])
        this.part(head, new THREE.CapsuleGeometry(0.065, 0.14, 6, 12), BROWN, [ 0, - 0.02, 0.17 ], [ 1, 0.95, 1 ], [ Math.PI / 2 + 0.35, 0, 0 ])
        this.part(head, sphere, BROWN_DARK, [ 0, - 0.06, 0.26 ], [ 0.06, 0.05, 0.05 ])
        this.part(head, sphere, rudolph ? '#ff1f2a' : BLACK, [ 0, - 0.05, 0.3 ], rudolph ? [ 0.05, 0.05, 0.05 ] : [ 0.032, 0.025, 0.02 ], [ 0, 0, 0 ], rudolph)
        const ears = [], lids = []
        for(const side of [ - 1, 1 ])
        {
            this.part(head, sphere, '#ffffff', [ side * 0.075, 0.05, 0.11 ], [ 0.022, 0.026, 0.018 ])
            this.part(head, sphere, BLACK, [ side * 0.08, 0.05, 0.12 ], [ 0.014, 0.017, 0.012 ])
            lids.push(this.part(head, sphere, BROWN, [ side * 0.079, 0.051, 0.118 ], [ 0.026, 0.03, 0.022 ]))
            const ear = new THREE.Group()
            ear.position.set(side * 0.09, 0.09, 0)
            head.add(ear)
            this.part(ear, sphere, BROWN, [ side * 0.06, 0.01, 0 ], [ 0.07, 0.025, 0.035 ], [ 0, 0, side * 0.3 ])
            ears.push(ear)
            const a = (p) => [ side * p[0], p[1], p[2] ]
            this.tube(head, [ [ 0.05, 0.1, 0 ], [ 0.12, 0.3, - 0.05 ], [ 0.24, 0.48, - 0.04 ], [ 0.3, 0.66, 0.05 ], [ 0.26, 0.8, 0.14 ] ].map(a), 0.022, ANTLER, 24)
            for(const [ from, to ] of [ [ [ 0.1, 0.24, - 0.04 ], [ 0.08, 0.32, 0.12 ] ], [ [ 0.2, 0.42, - 0.05 ], [ 0.17, 0.56, 0.05 ] ], [ [ 0.28, 0.58, 0 ], [ 0.4, 0.72, 0.02 ] ], [ [ 0.29, 0.7, 0.08 ], [ 0.2, 0.84, 0.03 ] ] ])
            {
                const f = a(from), t = a(to)
                this.tube(head, [ f, [ (f[0] + t[0]) / 2, (f[1] + t[1]) / 2 + 0.02, (f[2] + t[2]) / 2 ], t ], 0.014, ANTLER, 8, 6)
            }
        }
        return { group: r, head, ears, lids, phase: rudolph ? 2.4 : 0 }
    }

    makeZ()
    {
        const g = new THREE.Group()
        const bar = new THREE.BoxGeometry(0.5, 0.1, 0.04)
        const top = new THREE.Mesh(bar, this.zMat), bottom = new THREE.Mesh(bar, this.zMat)
        top.position.y = 0.25
        bottom.position.y = - 0.25
        const diagonal = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.66, 0.04), this.zMat)
        diagonal.rotation.z = - 0.86
        g.add(top, bottom, diagonal)
        g.visible = false
        this.game.scene.add(g)
        return g
    }

    update()
    {
        const env = this.game.environment
        const winter = env ? env.seasonId() === 'winter' : false
        const plane = this.game.world?.evaPlane
        const dt = Math.min(0.05, this.game.ticker.delta)
        this.time += dt
        const t = this.time

        // awake in winter, asleep the rest of the year (eases between the two when the season changes)
        // (and still awake while he flies home after winter, until the plane is back at the gate)
        const awake = winter || !!plane?.flying
        if(this.awake === null)
            this.awake = awake ? 1 : 0
        this.awake += ((awake ? 1 : 0) - this.awake) * Math.min(1, dt * 0.8)
        const a = this.awake, sleep = 1 - a
        const asleep = a < 0.5

        const show = !!plane?.current
        if(this.rider.visible !== show)
        {
            this.rider.visible = show
            this.reins.flat().forEach(m => { m.visible = show })
        }
        this.santaLids.forEach(l => { l.visible = asleep })
        for(const d of this.reindeer)
            d.lids.forEach(l => { l.visible = asleep })

        // reindeer on the tower: awake they look around and flick their ears; asleep their heads rest low and they breathe slowly
        for(const d of this.reindeer)
        {
            const k = t + d.phase
            const awakeX = Math.sin(k * 0.5) * 0.12 + Math.max(0, Math.sin(k * 0.21) - 0.75) * 1.6
            d.head.rotation.x = awakeX * a + (0.95 + Math.sin(k * 0.9) * 0.03) * sleep
            d.head.rotation.y = Math.sin(k * 0.33) * 0.5 * a + 0.35 * sleep
            d.head.rotation.z = 0.25 * sleep
            d.ears.forEach((ear, i) => { ear.rotation.x = a > 0.5 ? Math.max(0, Math.sin(k * 5 + i * 2) - 0.85) * 2.5 : - 0.4 })
            d.group.scale.y = 1 + Math.sin(k * 1.1) * 0.025 * sleep
        }

        if(show)
        {
            // ride along with the plane
            this.rider.position.copy(plane.position)
            this.rider.quaternion.copy(plane.current)
            this.rider.updateMatrixWorld()

            // the car: near (and awake) -> turn toward it, wherever it is, and wave
            const p = this.game.player.position
            this.car.set(p.x, p.y + 1, p.z)
            const near = a > 0.5 && Math.hypot(p.x - plane.position.x, p.z - plane.position.z) < 32
            this.wave = Math.max(0, Math.min(1, this.wave + (near ? 1 : - 1) * dt * 1.6))
            const w = this.wave * this.wave * (3 - 2 * this.wave)
            const local = this.seat.worldToLocal(this.tempA.copy(this.car))
            const yaw = Math.atan2(local.x, local.z)                      // 0 = straight ahead (toward the nose)
            this.twist += ((near ? THREE.MathUtils.clamp(yaw, - 2.4, 2.4) : 0) - this.twist) * Math.min(1, dt * 3)
            const waist = THREE.MathUtils.clamp(this.twist * 0.7, - 1.5, 1.5)
            const neck = THREE.MathUtils.clamp(this.twist - waist, - 0.8, 0.8)

            // awake: bouncing in the saddle, leaning forward. Asleep: slumped over, head nodding on his chest, breathing
            const gallop = Math.sin(t * 5.5) * a
            const breath = Math.sin(t * 1.2)
            this.upper.position.y = 0.12 + Math.abs(gallop) * 0.05 * (1 - w * 0.6)
            this.upper.rotation.set((0.22 * (1 - w) + gallop * 0.03) * a + (0.5 + breath * 0.03) * sleep, waist, 0.08 * sleep, 'YXZ')
            this.upper.scale.set(1 + breath * 0.02 * sleep, 1, 1 + breath * 0.03 * sleep)
            this.head.rotation.set((- 0.1 * (1 - w) + Math.sin(t * 2.2) * 0.04) * a + (0.55 + breath * 0.05) * sleep, neck, Math.sin(t * 1.3) * 0.05 * a + 0.3 * sleep)
            this.hat.rotation.z = - 0.2 + gallop * 0.12 - 0.3 * sleep

            // arms: on the reins while riding, the right one waves at the car; asleep they hang loose
            const L = this.leftArm, R = this.rightArm
            L.shoulder.rotation.set((- 1.15 + gallop * 0.05) * a - 0.35 * sleep, 0, - 0.2 * a + 0.1 * sleep)
            L.elbow.rotation.set(- 0.35 * a - 0.6 * sleep, 0, 0)
            R.shoulder.rotation.set(THREE.MathUtils.lerp(- 1.15, - 0.2, w) * a - 0.35 * sleep + gallop * 0.05 * (1 - w), 0, THREE.MathUtils.lerp(0.2, 2.7, w) * a - 0.1 * sleep)
            R.elbow.rotation.set(THREE.MathUtils.lerp(- 0.35, 0, w) * a - 0.6 * sleep, 0, w > 0.8 ? Math.sin(t * 9) * 0.55 : 0)

            // reins: from the mittens to the antler bases, with a little sag (slack while he sleeps)
            const hands = [ L.hand, w > 0.4 ? L.hand : R.hand ]
            this.reins.forEach(([ ra, rb ], i) =>
            {
                const from = hands[i].getWorldPosition(new THREE.Vector3())
                const to = this.rider.localToWorld(ANTLERS[i].clone())
                const mid = from.clone().lerp(to, 0.5)
                mid.y -= 0.35 + sleep * 0.6
                this.stretch(ra, from, mid, 0.035)
                this.stretch(rb, mid, to, 0.035)
            })
        }

        // snoring Z's: rise from each sleeper's head, drift sideways, grow, then shrink away
        const camera = this.game.view.camera
        for(const snorer of this.snorers)
        {
            const head = snorer.head.getWorldPosition(this.tempA)
            snorer.zs.forEach((z, i) =>
            {
                z.visible = asleep && snorer.head.parent.visible !== false && (snorer.head === this.head ? show : true)
                if(!z.visible)
                    return
                const c = (t * 0.28 + i / 3 + snorer.phase) % 1
                const size = snorer.size * (0.35 + c * 0.75) * (c < 0.8 ? 1 : (1 - c) / 0.2)
                z.position.set(head.x + Math.sin(c * 5 + i) * 0.35 + c * 0.9, head.y + 0.9 + c * 2.6 * snorer.size, head.z)
                z.scale.setScalar(Math.max(0.001, size * sleep))
                z.quaternion.copy(camera.quaternion)
            })
        }
    }
}
