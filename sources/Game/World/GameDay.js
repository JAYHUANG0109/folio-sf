import * as THREE from 'three/webgpu'
import { Howler } from 'howler'
import { color } from 'three/tsl'
import { Game } from '../Game.js'
import { stopsById } from '../../data/worldData.js'

/**
 * Levi's Stadium on game day: 49ers vs Seahawks, playing right now.
 * Players line up and run plays on the field, the crowd roars (louder after big plays),
 * fireworks go off over the stadium. Everything sleeps when the car is far away.
 */
export class GameDay
{
    constructor()
    {
        this.game = Game.getInstance()
        const stop = stopsById.levis
        this.center = new THREE.Vector3(stop.position.x, 0, stop.position.z)
        this.center.y = Math.max(0, this.game.terrain.getHeight(this.center.x, this.center.z))
        this.scale = 1.25
        this.time = 0
        this.active = false

        this.setPlayers()
        this.setFireworks()
        this.setSound()

        this.game.ticker.events.on('tick', () => this.update(), 12)
    }

    material(hex)
    {
        const m = new THREE.MeshBasicNodeMaterial()
        m.colorNode = color(hex)
        return m
    }

    setPlayers()
    {
        const body = new THREE.BoxGeometry(0.32, 0.55, 0.26).translate(0, 0.42, 0)
        const helmet = new THREE.SphereGeometry(0.15, 8, 6).translate(0, 0.82, 0)
        const make = (bodyHex, helmetHex) =>
        {
            const b = new THREE.InstancedMesh(body, this.material(bodyHex), 11)
            const h = new THREE.InstancedMesh(helmet, this.material(helmetHex), 11)
            b.frustumCulled = h.frustumCulled = false
            this.game.scene.add(b, h)
            return { b, h }
        }
        this.teams = [ make('#c8102e', '#b3995d'), make('#002244', '#69be28') ]   // 49ers red / gold, Seahawks navy / green
        this.ball = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6).scale(1, 1, 1.6), this.material('#6b3a1e'))
        this.game.scene.add(this.ball)
        this.dummy = new THREE.Object3D()
        this.play = { t: 0, duration: 6, line: 0, dir: 1 }
    }

    // field coordinates: x along the field (-12..12), z across (-5..5), in design units around the stadium center
    toWorld(x, z, y = 0)
    {
        return [ this.center.x + x * this.scale, this.center.y + 0.07 + y, this.center.z + z * this.scale ]
    }

    updatePlayers(delta)
    {
        const p = this.play
        p.t += delta
        if(p.t > p.duration)
        {
            // next play: the line moves; touchdown => big cheer + fireworks
            p.t = 0
            p.line += p.dir * (3 + Math.random() * 6)
            if(Math.abs(p.line) > 10)
            {
                this.cheer(1)
                this.launchVolley(5)
                p.line = 0
                p.dir *= - 1
            }
            else if(Math.random() < 0.4)
                this.cheer(0.5)
        }
        const snap = 1.2
        const run = Math.max(0, p.t - snap) / (p.duration - snap)
        const carry = p.line + p.dir * run * 5
        for(let team = 0; team < 2; team++)
        {
            const { b, h } = this.teams[team]
            const offense = team === (p.dir > 0 ? 0 : 1)
            for(let i = 0; i < 11; i++)
            {
                const lane = (i - 5) * 0.85
                let x = p.line - (offense ? 1 : - 1) * p.dir * (0.6 + (i % 3 === 0 ? 1.4 : 0))
                let z = lane
                if(p.t > snap)
                {
                    // the ball carrier (offense #5) runs, everyone else converges on him
                    if(offense && i === 5)
                    {
                        x = carry
                        z = Math.sin(run * 4) * 1.2
                    }
                    else
                    {
                        const k = Math.min(1, run * (offense ? 0.8 : 1.2))
                        x += (carry - x) * k * 0.8
                        z += (Math.sin(run * 4) * 1.2 - z) * k * 0.6
                    }
                }
                const bob = p.t > snap ? Math.abs(Math.sin((this.time + i) * 12)) * 0.06 : 0
                const [ wx, wy, wz ] = this.toWorld(x, z, bob)
                this.dummy.position.set(wx, wy, wz)
                this.dummy.rotation.set(0, offense === (p.dir > 0) ? Math.PI / 2 : - Math.PI / 2, 0)
                this.dummy.updateMatrix()
                b.setMatrixAt(i, this.dummy.matrix)
                h.setMatrixAt(i, this.dummy.matrix)
            }
            b.instanceMatrix.needsUpdate = h.instanceMatrix.needsUpdate = true
        }
        const [ bx, by, bz ] = this.toWorld(carry + p.dir * 0.2, Math.sin(run * 4) * 1.2, p.t > snap ? 0.55 : 0.12)
        this.ball.position.set(bx, by, bz)
    }

    setFireworks()
    {
        this.sparkCount = 90
        this.bursts = []
        const geometry = new THREE.SphereGeometry(0.16, 6, 4)
        for(const hex of [ '#ffd34d', '#ff3b3b', '#ffffff', '#ff9ad5', '#7fd3ff' ])
        {
            const mesh = new THREE.InstancedMesh(geometry, this.material(hex), this.sparkCount)
            mesh.frustumCulled = false
            mesh.count = 0
            this.game.scene.add(mesh)
            this.bursts.push({ mesh, sparks: [], life: 0 })
        }
        this.nextFirework = 2
    }

    launch()
    {
        const burst = this.bursts.find(b => b.life <= 0) || this.bursts[Math.floor(Math.random() * this.bursts.length)]
        const origin = new THREE.Vector3(this.center.x + (Math.random() - 0.5) * 30, this.center.y + 16 + Math.random() * 8, this.center.z + (Math.random() - 0.5) * 14)
        burst.life = 2.2
        burst.sparks = []
        for(let i = 0; i < this.sparkCount; i++)
        {
            const v = new THREE.Vector3().randomDirection().multiplyScalar(5 + Math.random() * 3)
            burst.sparks.push({ p: origin.clone(), v })
        }
        burst.mesh.count = this.sparkCount
        this.boom()
    }

    launchVolley(n)
    {
        for(let i = 0; i < n; i++)
            setTimeout(() => this.active && this.launch(), i * 280)
    }

    updateFireworks(delta)
    {
        this.nextFirework -= delta
        if(this.nextFirework < 0)
        {
            this.launch()
            this.nextFirework = 1.5 + Math.random() * 3
        }
        for(const burst of this.bursts)
        {
            if(burst.life <= 0)
            {
                burst.mesh.count = 0
                continue
            }
            burst.life -= delta
            const s = Math.max(0.01, burst.life / 2.2)
            burst.sparks.forEach((spark, i) =>
            {
                spark.v.y -= 4 * delta
                spark.v.multiplyScalar(1 - delta * 1.2)
                spark.p.addScaledVector(spark.v, delta)
                this.dummy.position.copy(spark.p)
                this.dummy.rotation.set(0, 0, 0)
                this.dummy.scale.setScalar(s)
                this.dummy.updateMatrix()
                burst.mesh.setMatrixAt(i, this.dummy.matrix)
            })
            this.dummy.scale.setScalar(1)
            burst.mesh.instanceMatrix.needsUpdate = true
        }
    }

    setSound()
    {
        this.sound = null
    }

    ensureSound()
    {
        if(this.sound || !Howler.ctx || !Howler.masterGain)
            return this.sound
        const ctx = Howler.ctx
        // crowd: bright, airy noise (many voices far away), no low end so it never rumbles
        const length = ctx.sampleRate * 4
        const buffer = ctx.createBuffer(2, length, ctx.sampleRate)
        for(let c = 0; c < 2; c++)
        {
            const data = buffer.getChannelData(c)
            let swell = 0.5
            for(let i = 0; i < length; i++)
            {
                if(i % 2400 === 0) swell = 0.6 + Math.random() * 0.4          // voices coming and going
                data[i] = (Math.random() * 2 - 1) * swell * 0.5
            }
        }
        const source = ctx.createBufferSource()
        source.buffer = buffer
        source.loop = true
        const high = ctx.createBiquadFilter()
        high.type = 'highpass'
        high.frequency.value = 450
        const band = ctx.createBiquadFilter()
        band.type = 'bandpass'
        band.frequency.value = 1300
        band.Q.value = 0.9
        const gain = ctx.createGain()
        gain.gain.value = 0
        source.connect(high).connect(band).connect(gain).connect(Howler.masterGain)
        source.start()
        this.sound = { ctx, gain, band, cheer: 0 }
        return this.sound
    }

    cheer(amount)
    {
        if(this.sound)
            this.sound.cheer = Math.min(1.5, this.sound.cheer + amount)
    }

    boom()
    {
        // a firework: a short bright pop, then a sparkly crackle (no deep boom)
        const sound = this.sound
        if(!sound || !this.active || this.volume <= 0)
            return
        const ctx = sound.ctx
        const length = Math.floor(ctx.sampleRate * 1.2)
        const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
        const data = buffer.getChannelData(0)
        const pop = ctx.sampleRate * 0.06
        for(let i = 0; i < length; i++)
        {
            if(i < pop)
                data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / pop, 2)
            else if(Math.random() < 0.004 * (1 - i / length))
                data[i] = (Math.random() * 2 - 1) * 0.6                     // crackle
        }
        const src = ctx.createBufferSource()
        src.buffer = buffer
        const band = ctx.createBiquadFilter()
        band.type = 'highpass'
        band.frequency.value = 700
        const g = ctx.createGain()
        g.gain.value = this.volume * 0.35
        src.connect(band).connect(g).connect(Howler.masterGain)
        src.start()
    }

    update()
    {
        const delta = Math.min(0.05, this.game.ticker.delta)
        const player = this.game.player.position
        const distance = Math.hypot(player.x - this.center.x, player.z - this.center.z)
        const wasActive = this.active
        this.active = distance < 90
        this.volume = Math.max(0, Math.min(1, (48 - distance) / 30))   // only near the stadium

        for(const team of this.teams)
            team.b.visible = team.h.visible = this.active
        this.ball.visible = this.active
        if(!this.active)
        {
            if(wasActive)
                for(const burst of this.bursts) { burst.life = 0; burst.mesh.count = 0 }
            if(this.sound)
                this.sound.gain.gain.value = 0
            return
        }

        this.time += delta
        this.updatePlayers(delta)
        this.updateFireworks(delta)

        const sound = this.ensureSound()
        if(sound)
        {
            sound.cheer = Math.max(0, sound.cheer - delta * 0.35)
            const roar = 0.16 + Math.sin(this.time * 0.7) * 0.03 + sound.cheer * 0.3
            sound.gain.gain.value = roar * this.volume * 0.45
            sound.band.frequency.value = 1300 + sound.cheer * 600
        }
    }
}
