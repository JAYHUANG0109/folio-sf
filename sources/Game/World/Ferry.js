import * as THREE from 'three/webgpu'
import { Game } from '../Game.js'

/** The Alcatraz Cruises ferry: loops around Alcatraz and across the open bay in the top right of the map, with a foamy wake */
export class Ferry
{
    constructor()
    {
        this.game = Game.getInstance()
        const route = [ [ 20, - 74 ], [ 28, - 90 ], [ 50, - 90 ], [ 74, - 82 ], [ 86, - 62 ], [ 80, - 42 ], [ 64, - 42 ], [ 54, - 60 ], [ 44, - 72 ], [ 30, - 72 ] ]
        this.curve = new THREE.CatmullRomCurve3(route.map(([ x, z ]) => new THREE.Vector3(x, 0, z)), true, 'centripetal')
        this.length = this.curve.getLength()
        this.speed = 4.5
        this.distance = 0
        this.object = null
        const foam = new THREE.MeshBasicNodeMaterial({ color: '#f4fbff', transparent: true, opacity: 0.55, depthWrite: false })
        foam.fog = false
        this.wake = []
        for(let i = 0; i < 28; i++)
        {
            const m = new THREE.Mesh(new THREE.CircleGeometry(1, 10).rotateX(- Math.PI / 2), foam)
            m.frustumCulled = false
            this.game.scene.add(m)
            this.wake.push(m)
        }
        this.history = []
        this.game.ticker.events.on('tick', () => this.update(), 12)
    }

    update()
    {
        if(!this.object)
        {
            this.object = this.game.scene.getObjectByName('alcatrazFerry') || null
            if(!this.object)
                return
            this.game.scene.attach(this.object)            // out of the Alcatraz area, so it never gets culled with it
        }
        const delta = Math.min(0.05, this.game.ticker.delta)
        this.distance = (this.distance + this.speed * delta) % this.length
        const t = this.distance / this.length
        const p = this.curve.getPointAt(t), d = this.curve.getTangentAt(t)
        const y = this.game.water.surfaceElevation + 0.25 + Math.sin(performance.now() / 700) * 0.06
        this.object.position.set(p.x, y, p.z)
        this.object.rotation.set(Math.sin(performance.now() / 900) * 0.02, Math.atan2(- d.x, - d.z), 0)
        // wake: foam left behind, widening and fading
        this.history.unshift(new THREE.Vector3(p.x - d.x * 3, this.game.water.surfaceElevation + 0.03, p.z - d.z * 3))
        if(this.history.length > 120) this.history.pop()
        // two thin foam trails spreading out in a V behind the stern
        this.wake.forEach((m, i) =>
        {
            const k = Math.floor(i / 2), side = i % 2 ? 1 : - 1
            const idx = Math.min(this.history.length - 1, k * 6)
            const h = this.history[idx]
            const nx = - d.z, nz = d.x
            const spread = 0.3 + k * 0.28
            m.position.set(h.x + nx * side * spread, h.y, h.z + nz * side * spread)
            const s = 0.32 + k * 0.03
            m.scale.set(s, 1, s * 1.6)
            m.rotation.y = Math.atan2(d.x, d.z)
            m.visible = idx < this.history.length - 1
        })
    }
}
