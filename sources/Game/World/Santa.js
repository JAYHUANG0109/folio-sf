import * as THREE from 'three/webgpu'
import { color } from 'three/tsl'
import { Game } from '../Game.js'
import { MeshDefaultMaterial } from '../Materials/MeshDefaultMaterial.js'

/**
 * Winter only: Santa sits on top of the Golden Gate's south tower with two reindeer resting beside him,
 * munching hay. When the car comes near, he waves.
 */
export class Santa
{
    constructor()
    {
        this.game = Game.getInstance()
        this.mats = new Map()
        this.group = new THREE.Group()
        // the south tower's top, world units (x -62, tower at z -57.5, top of the crown ~ deck 3.2 + 20.4)
        this.group.position.set(- 62, 3.2 + 21.2, - 57.5)
        this.group.rotation.y = 0                       // face south, toward the city and the car coming onto the bridge
        this.group.visible = false
        this.game.scene.add(this.group)
        this.buildSanta()
        this.reindeer = [ this.buildReindeer(- 2.7, 0.35), this.buildReindeer(2.8, - 0.4) ]
        this.buildHay()
        this.time = 0
        this.wave = 0
        this.game.ticker.events.on('tick', () => this.update(), 13)
    }

    mat(hex)
    {
        if(!this.mats.has(hex))
            this.mats.set(hex, new MeshDefaultMaterial({ colorNode: color(hex), hasWater: false }))
        return this.mats.get(hex)
    }

    part(parent, geometry, hex, x, y, z, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0)
    {
        const m = new THREE.Mesh(geometry, this.mat(hex))
        m.position.set(x, y, z)
        m.scale.set(sx, sy, sz)
        m.rotation.set(rx, ry, rz)
        m.castShadow = true
        parent.add(m)
        return m
    }

    buildSanta()
    {
        const s = new THREE.Group()
        s.scale.setScalar(1.35)
        this.group.add(s)
        const sphere = new THREE.SphereGeometry(1, 20, 14), cyl = new THREE.CylinderGeometry(1, 1, 1, 18), torus = new THREE.TorusGeometry(1, 0.28, 10, 24)
        const RED = '#d6262e', WHITE = '#fbf7f2', SKIN = '#f3c2a2', BLACK = '#2a2224', GOLD = '#e6b43a', GLOVE = '#4a3c36'
        // round belly sitting on the tower crown, legs forward
        this.part(s, sphere, RED, 0, 0.75, 0, 0.62, 0.62, 0.55)
        this.part(s, torus, WHITE, 0, 0.42, 0, 0.6, 0.6, 0.6, Math.PI / 2)                         // fur hem
        this.part(s, cyl, BLACK, 0, 0.78, 0, 0.6, 0.13, 0.54)                                       // belt
        this.part(s, new THREE.BoxGeometry(0.22, 0.17, 0.05), GOLD, 0, 0.78, 0.54)                   // buckle
        this.part(s, new THREE.BoxGeometry(0.12, 0.08, 0.06), BLACK, 0, 0.78, 0.56)
        for(const side of [ - 1, 1 ])
        {
            this.part(s, cyl, RED, side * 0.22, 0.35, 0.45, 0.15, 0.55, 0.15, Math.PI / 2)           // thighs forward
            this.part(s, cyl, RED, side * 0.22, 0.02, 0.72, 0.13, 0.4, 0.13)                       // shins hanging over the edge
            this.part(s, sphere, BLACK, side * 0.22, - 0.2, 0.78, 0.15, 0.12, 0.2)                 // boots
            this.part(s, torus, WHITE, side * 0.22, 0.14, 0.72, 0.13, 0.13, 0.13, Math.PI / 2)
        }
        // head: face, rosy cheeks, nose, eyes, big white beard and moustache, hat with pompom
        this.part(s, sphere, SKIN, 0, 1.55, 0.05, 0.3, 0.32, 0.3)
        this.part(s, sphere, '#e98a8a', - 0.15, 1.5, 0.27, 0.07, 0.06, 0.04)
        this.part(s, sphere, '#e98a8a', 0.15, 1.5, 0.27, 0.07, 0.06, 0.04)
        this.part(s, sphere, '#e89a85', 0, 1.53, 0.33, 0.07, 0.07, 0.07)
        this.part(s, sphere, BLACK, - 0.1, 1.64, 0.3, 0.035, 0.045, 0.03)
        this.part(s, sphere, BLACK, 0.1, 1.64, 0.3, 0.035, 0.045, 0.03)
        this.part(s, sphere, WHITE, - 0.1, 1.72, 0.29, 0.08, 0.03, 0.03)                         // eyebrows
        this.part(s, sphere, WHITE, 0.1, 1.72, 0.29, 0.08, 0.03, 0.03)
        this.part(s, sphere, WHITE, 0, 1.25, 0.2, 0.3, 0.38, 0.2)                                // beard
        this.part(s, sphere, WHITE, - 0.1, 1.44, 0.31, 0.12, 0.05, 0.06, 0, 0, 0.3)              // moustache
        this.part(s, sphere, WHITE, 0.1, 1.44, 0.31, 0.12, 0.05, 0.06, 0, 0, - 0.3)
        this.part(s, cyl, WHITE, 0, 1.8, 0.02, 0.31, 0.1, 0.31)                                 // hat brim
        this.part(s, new THREE.ConeGeometry(0.29, 0.6, 16), RED, 0.05, 2.12, - 0.04, 1, 1, 1, - 0.35, 0, - 0.35)
        this.part(s, sphere, WHITE, 0.2, 2.32, - 0.18, 0.1, 0.1, 0.1)
        // left arm resting on the belly
        this.part(s, cyl, RED, - 0.5, 0.95, 0.15, 0.13, 0.5, 0.13, 0.6, 0, 0.5)
        this.part(s, sphere, GLOVE, - 0.32, 0.72, 0.38, 0.11, 0.11, 0.11)
        // right arm on a shoulder pivot: waves when the car comes by
        this.arm = new THREE.Group()
        this.arm.position.set(0.48, 1.12, 0.05)
        s.add(this.arm)
        this.part(this.arm, cyl, RED, 0.12, 0.25, 0, 0.13, 0.55, 0.13, 0, 0, - 0.45)
        this.part(this.arm, torus, WHITE, 0.25, 0.5, 0, 0.12, 0.12, 0.12, 0, 0, - 0.45)
        this.hand = this.part(this.arm, sphere, GLOVE, 0.28, 0.6, 0, 0.12, 0.13, 0.11)
        this.arm.rotation.z = - 0.9                     // resting: hand on the knee
        // sack of presents beside him
        this.part(s, sphere, '#9c7a52', - 0.95, 0.4, - 0.25, 0.42, 0.5, 0.4)
        for(const [ x, y, z, hex ] of [ [ - 1.0, 0.92, - 0.2, '#2f9a5a' ], [ - 0.82, 0.88, - 0.35, '#e0b93a' ], [ - 1.1, 0.85, - 0.4, '#3a6ad8' ] ])
        {
            this.part(s, new THREE.BoxGeometry(0.22, 0.22, 0.22), hex, x, y, z, 1, 1, 1, 0.2, 0.4, 0.1)
            this.part(s, new THREE.BoxGeometry(0.24, 0.05, 0.05), RED, x, y + 0.02, z, 1, 1, 1, 0.2, 0.4, 0.1)
        }
        this.santa = s
    }

    buildReindeer(x, z)
    {
        const r = new THREE.Group()
        r.position.set(x, 0, z)
        r.rotation.y = x < 0 ? 0.5 : - 0.6
        r.scale.setScalar(1.25)
        this.group.add(r)
        const sphere = new THREE.SphereGeometry(1, 18, 12), cyl = new THREE.CylinderGeometry(1, 1, 1, 12)
        const FUR = '#8a6448', BELLY = '#efe4d4', DARK = '#3a2a22', ANTLER = '#c9a882'
        // lying down, legs tucked, chest up
        this.part(r, sphere, FUR, 0, 0.42, - 0.1, 0.42, 0.36, 0.7)
        this.part(r, sphere, BELLY, 0, 0.5, 0.42, 0.3, 0.3, 0.22)
        for(const side of [ - 1, 1 ])
        {
            this.part(r, cyl, FUR, side * 0.3, 0.12, 0.35, 0.08, 0.5, 0.08, Math.PI / 2)
            this.part(r, sphere, DARK, side * 0.3, 0.1, 0.62, 0.09, 0.07, 0.11)                  // hooves
            this.part(r, sphere, FUR, side * 0.33, 0.2, - 0.6, 0.18, 0.12, 0.25)
        }
        this.part(r, sphere, BELLY, 0, 0.55, - 0.78, 0.1, 0.12, 0.08)                            // tail
        // harness with a little gold bell
        this.part(r, new THREE.TorusGeometry(0.3, 0.05, 6, 18), '#b0283a', 0, 0.72, 0.3, 1, 1, 1, 0.4)
        this.part(r, sphere, '#e6b43a', 0, 0.58, 0.55, 0.06, 0.06, 0.06)
        // neck and head on a pivot so it can bob down to the hay and chew
        const head = new THREE.Group()
        head.position.set(0, 0.85, 0.45)
        r.add(head)
        this.part(head, cyl, FUR, 0, 0.2, 0.05, 0.14, 0.45, 0.14, 0.35)
        this.part(head, sphere, FUR, 0, 0.45, 0.22, 0.17, 0.17, 0.25)
        this.part(head, sphere, BELLY, 0, 0.38, 0.42, 0.11, 0.09, 0.12)                          // muzzle
        const jaw = this.part(head, sphere, BELLY, 0, 0.3, 0.38, 0.09, 0.05, 0.1)
        this.part(head, sphere, DARK, 0, 0.42, 0.53, 0.05, 0.04, 0.03)                           // nose
        for(const side of [ - 1, 1 ])
        {
            this.part(head, sphere, DARK, side * 0.12, 0.52, 0.32, 0.03, 0.035, 0.03)              // eyes
            this.part(head, sphere, FUR, side * 0.17, 0.6, 0.12, 0.09, 0.04, 0.05, 0, 0, side * 0.6)  // ears
            // antlers: a curved beam with tines
            const a = new THREE.Group()
            a.position.set(side * 0.08, 0.6, 0.15)
            a.rotation.set(- 0.3, 0, side * 0.45)
            head.add(a)
            this.part(a, cyl, ANTLER, 0, 0.25, 0, 0.03, 0.5, 0.03)
            this.part(a, cyl, ANTLER, side * 0.05, 0.42, 0.08, 0.025, 0.25, 0.025, 0.9)
            this.part(a, cyl, ANTLER, side * 0.02, 0.5, - 0.08, 0.025, 0.22, 0.025, - 0.7, 0, side * - 0.3)
            this.part(a, cyl, ANTLER, side * 0.04, 0.2, 0.1, 0.02, 0.18, 0.02, 1.0)
        }
        return { head, jaw, phase: Math.random() * 6 }
    }

    buildHay()
    {
        const hay = new THREE.SphereGeometry(1, 10, 6)
        for(const [ x, z ] of [ [ - 2.2, 1.1 ], [ 2.2, 0.6 ] ])
            this.part(this.group, hay, '#d9b85a', x, 0.05, z, 0.45, 0.16, 0.35)
    }

    update()
    {
        const env = this.game.environment
        const winter = env ? env.seasonId() === 'winter' : false
        if(this.group.visible !== winter)
            this.group.visible = winter
        if(!winter)
            return
        const dt = Math.min(0.05, this.game.ticker.delta)
        this.time += dt
        const t = this.time
        const p = this.game.player.position
        const near = Math.hypot(p.x - this.group.position.x, p.z - this.group.position.z) < 26
        // the waving arm eases up, waves side to side, and eases back down
        this.wave += (near ? 1 : - 1) * dt * 2
        this.wave = Math.max(0, Math.min(1, this.wave))
        const raised = - 0.9 + this.wave * 3.0
        this.arm.rotation.z = raised + (this.wave > 0.9 ? Math.sin(t * 9) * 0.35 : 0)
        this.santa.rotation.y = this.wave * 0.25 * Math.sin(t * 0.8)
        this.santa.position.y = Math.sin(t * 1.4) * 0.02                     // breathing
        // reindeer: bow down to the hay, chew, look up again
        for(const d of this.reindeer)
        {
            const cycle = (t * 0.25 + d.phase) % 1
            const eating = cycle < 0.6
            const target = eating ? 1.1 : 0.05
            d.head.rotation.x += (target - d.head.rotation.x) * Math.min(1, dt * 2.5)
            d.jaw.position.y = 0.3 - (eating ? Math.abs(Math.sin(t * 7 + d.phase)) * 0.04 : 0)
            d.head.rotation.y = eating ? 0 : Math.sin(t * 0.7 + d.phase) * 0.35
        }
    }
}
