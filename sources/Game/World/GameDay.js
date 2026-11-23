import * as THREE from 'three/webgpu'
import { Howler } from 'howler'
import { color, instanceColor } from 'three/tsl'
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
            this.hit()
            if(Math.abs(p.line) > 10)
            {
                this.cheer(1.2)
                this.launchVolley(6)
                this.announce(p.dir > 0 ? 'Touchdown, San Francisco Forty Niners!' : 'Touchdown Seahawks.')
                p.line = 0
                p.dir *= - 1
            }
            else if(Math.random() < 0.4)
            {
                this.cheer(0.5)
                if(Math.random() < 0.3) this.announce(['First down, Forty Niners!', 'What a catch!', 'And he breaks a tackle!', 'Third and long.'][Math.floor(Math.random() * 4)])
            }
            setTimeout(() => this.active && this.whistle(), 900)
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
        this.sparkMax = 1600
        const geometry = new THREE.SphereGeometry(0.11, 5, 4)
        const material = new THREE.MeshBasicNodeMaterial()
        material.colorNode = instanceColor ? instanceColor.mul(2.4) : color('#ffffff')   // bright enough to bloom
        material.fog = false
        this.sparks = new THREE.InstancedMesh(geometry, material, this.sparkMax)
        this.sparks.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(this.sparkMax * 3), 3)
        this.sparks.frustumCulled = false
        this.sparks.count = 0
        this.game.scene.add(this.sparks)
        this.particles = []
        this.rockets = []
        this.nextFirework = 2
        this.palettes = [ [ '#ffd34d', '#fff2b0' ], [ '#ff3b3b', '#ffb0a0' ], [ '#c8102e', '#b3995d' ], [ '#7fd3ff', '#ffffff' ], [ '#ff9ad5', '#ffd6ec' ], [ '#69be28', '#e8ffd0' ], [ '#b38bff', '#ffffff' ] ]
    }

    launch()
    {
        const x = this.center.x + (Math.random() - 0.5) * 34, z = this.center.z + (Math.random() - 0.5) * 18
        this.rockets.push({ p: new THREE.Vector3(x, this.center.y + 2, z), v: new THREE.Vector3((Math.random() - 0.5) * 2, 22 + Math.random() * 6, (Math.random() - 0.5) * 2), fuse: 1.0 + Math.random() * 0.35, palette: this.palettes[Math.floor(Math.random() * this.palettes.length)], kind: [ 'peony', 'peony', 'willow', 'ring', 'crossette' ][Math.floor(Math.random() * 5)] })
        this.whistleUp()
    }

    burst(rocket)
    {
        const [ a, b ] = rocket.palette.map(h => new THREE.Color(h))
        const n = rocket.kind === 'ring' ? 90 : rocket.kind === 'willow' ? 140 : 160
        const axis = new THREE.Vector3().randomDirection()
        for(let i = 0; i < n && this.particles.length < this.sparkMax - 50; i++)
        {
            let v
            if(rocket.kind === 'ring')
            {
                const t = i / n * Math.PI * 2
                v = new THREE.Vector3(Math.cos(t), 0, Math.sin(t)).applyAxisAngle(axis, 1).multiplyScalar(11)
            }
            else
                v = new THREE.Vector3().randomDirection().multiplyScalar((rocket.kind === 'willow' ? 7 : 10) * (0.85 + Math.random() * 0.3))
            this.particles.push({ p: rocket.p.clone(), v, life: rocket.kind === 'willow' ? 3.4 : 2.2 + Math.random() * 0.4, age: 0, c: a.clone().lerp(b, Math.random()), drag: rocket.kind === 'willow' ? 1.6 : 1.1, glitter: Math.random() < 0.35, split: rocket.kind === 'crossette' && i % 12 === 0 })
        }
        this.boom(rocket.p)
    }

    launchVolley(n)
    {
        for(let i = 0; i < n; i++)
            setTimeout(() => this.active && this.launch(), i * 220)
    }

    updateFireworks(delta)
    {
        this.nextFirework -= delta
        if(this.nextFirework < 0)
        {
            this.launch()
            if(Math.random() < 0.35) setTimeout(() => this.active && this.launch(), 300)
            this.nextFirework = 1.2 + Math.random() * 2.2
        }
        // rockets climb, leaving a short spark trail, then burst
        for(let i = this.rockets.length - 1; i >= 0; i--)
        {
            const r = this.rockets[i]
            r.fuse -= delta
            r.v.y -= 9 * delta
            r.p.addScaledVector(r.v, delta)
            if(this.particles.length < this.sparkMax - 5)
                this.particles.push({ p: r.p.clone(), v: new THREE.Vector3((Math.random() - 0.5), - 1, (Math.random() - 0.5)), life: 0.35, age: 0, c: new THREE.Color('#ffcf7a'), drag: 2, glitter: false })
            if(r.fuse <= 0)
            {
                this.burst(r)
                this.rockets.splice(i, 1)
            }
        }
        // sparks: gravity, drag, fade, glitter flicker; crossettes split again
        let count = 0
        const colors = this.sparks.instanceColor.array
        for(let i = this.particles.length - 1; i >= 0; i--)
        {
            const q = this.particles[i]
            q.age += delta
            if(q.age > q.life)
            {
                if(q.split)
                    for(let k = 0; k < 6; k++)
                        this.particles.push({ p: q.p.clone(), v: new THREE.Vector3().randomDirection().multiplyScalar(5), life: 0.9, age: 0, c: q.c, drag: 1.4, glitter: true })
                this.particles.splice(i, 1)
                continue
            }
            q.v.y -= 5.5 * delta
            q.v.multiplyScalar(1 - delta * q.drag)
            q.p.addScaledVector(q.v, delta)
        }
        for(const q of this.particles)
        {
            if(count >= this.sparkMax)
                break
            const t = q.age / q.life
            let fade = Math.pow(1 - t, 1.4)
            if(q.glitter && t > 0.4)
                fade *= Math.random() < 0.5 ? 1.6 : 0.1
            this.dummy.position.copy(q.p)
            this.dummy.rotation.set(0, 0, 0)
            this.dummy.scale.setScalar(Math.max(0.05, (1 - t * 0.6)))
            this.dummy.updateMatrix()
            this.sparks.setMatrixAt(count, this.dummy.matrix)
            colors[count * 3] = q.c.r * fade
            colors[count * 3 + 1] = q.c.g * fade
            colors[count * 3 + 2] = q.c.b * fade
            count++
        }
        this.dummy.scale.setScalar(1)
        this.sparks.count = count
        this.sparks.instanceMatrix.needsUpdate = true
        this.sparks.instanceColor.needsUpdate = true
    }

    setSound()
    {
        this.sound = null
        this.lastCall = 0
    }

    noiseBuffer(ctx, seconds, shape)
    {
        const length = Math.floor(ctx.sampleRate * seconds)
        const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
        const data = buffer.getChannelData(0)
        for(let i = 0; i < length; i++)
            data[i] = (Math.random() * 2 - 1) * shape(i / length)
        return buffer
    }

    ensureSound()
    {
        if(this.sound || !Howler.ctx || !Howler.masterGain)
            return this.sound
        const ctx = Howler.ctx
        const out = ctx.createGain()
        out.gain.value = 0
        out.connect(Howler.masterGain)
        // crowd: many voices = several band passed noise layers, each swelling on its own (a living murmur)
        const layers = []
        for(const [ f, q ] of [ [ 380, 0.8 ], [ 900, 1.1 ], [ 1700, 1.3 ], [ 2800, 1.6 ] ])
        {
            const src = ctx.createBufferSource()
            src.buffer = this.noiseBuffer(ctx, 5, () => 1)
            src.loop = true
            src.playbackRate.value = 0.9 + Math.random() * 0.2
            const band = ctx.createBiquadFilter()
            band.type = 'bandpass'
            band.frequency.value = f
            band.Q.value = q
            const g = ctx.createGain()
            g.gain.value = 0.25
            src.connect(band).connect(g).connect(out)
            src.start(0, Math.random() * 4)
            layers.push({ g, band, f, phase: Math.random() * 6 })
        }
        this.sound = { ctx, out, layers, cheer: 0 }
        return this.sound
    }

    cheer(amount)
    {
        if(this.sound)
            this.sound.cheer = Math.min(1.5, this.sound.cheer + amount)
    }

    /** a referee whistle at the snap */
    whistle()
    {
        const s = this.sound
        if(!s || this.volume <= 0) return
        const ctx = s.ctx, t = ctx.currentTime
        const o = ctx.createOscillator(), lfo = ctx.createOscillator(), lg = ctx.createGain(), g = ctx.createGain()
        o.type = 'sine'; o.frequency.value = 2900
        lfo.frequency.value = 38; lg.gain.value = 140
        lfo.connect(lg).connect(o.frequency)
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.12 * this.volume, t + 0.02); g.gain.setValueAtTime(0.12 * this.volume, t + 0.45); g.gain.linearRampToValueAtTime(0, t + 0.55)
        o.connect(g).connect(Howler.masterGain)
        o.start(t); lfo.start(t); o.stop(t + 0.6); lfo.stop(t + 0.6)
    }

    /** pads hitting at the tackle */
    hit()
    {
        const s = this.sound
        if(!s || this.volume <= 0) return
        const ctx = s.ctx
        const src = ctx.createBufferSource()
        src.buffer = this.noiseBuffer(ctx, 0.18, (x) => Math.pow(1 - x, 6))
        const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1200
        const g = ctx.createGain(); g.gain.value = 0.5 * this.volume
        src.connect(f).connect(g).connect(Howler.masterGain)
        src.start()
    }

    /** the stadium announcer (the browser's English voice), only when you're right there */
    announce(text)
    {
        if(this.volume < 0.5 || !('speechSynthesis' in window) || document.documentElement.classList.contains('is-audio-muted'))
            return
        if(performance.now() - this.lastCall < 6000)
            return
        this.lastCall = performance.now()
        const u = new SpeechSynthesisUtterance(text)
        u.lang = 'en-US'
        u.rate = 1.05
        u.pitch = 0.8
        u.volume = Math.min(1, this.volume) * 0.9
        speechSynthesis.cancel()
        speechSynthesis.speak(u)
    }

    whistleUp()
    {
        const s = this.sound
        if(!s || this.volume <= 0) return
        const ctx = s.ctx, t = ctx.currentTime
        const src = ctx.createBufferSource()
        src.buffer = this.noiseBuffer(ctx, 1.1, (x) => Math.sin(x * Math.PI) * 0.6)
        const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 8
        f.frequency.setValueAtTime(1200, t); f.frequency.exponentialRampToValueAtTime(4200, t + 1.05)
        const g = ctx.createGain(); g.gain.value = 0.12 * this.volume
        src.connect(f).connect(g).connect(Howler.masterGain)
        src.start(t)
    }

    /** a firework: deep thump, sharp crack, then crackling glitter */
    boom(position)
    {
        const s = this.sound
        if(!s || this.volume <= 0) return
        const ctx = s.ctx, t = ctx.currentTime + 0.15     // light first, sound a moment later
        const thump = ctx.createBufferSource()
        thump.buffer = this.noiseBuffer(ctx, 1.2, (x) => Math.pow(1 - x, 4))
        const lf = ctx.createBiquadFilter(); lf.type = 'lowpass'; lf.frequency.value = 180
        const lg = ctx.createGain(); lg.gain.value = 1.1 * this.volume
        thump.connect(lf).connect(lg).connect(Howler.masterGain)
        thump.start(t)
        const crack = ctx.createBufferSource()
        crack.buffer = this.noiseBuffer(ctx, 0.25, (x) => Math.pow(1 - x, 8))
        const hg = ctx.createGain(); hg.gain.value = 0.5 * this.volume
        crack.connect(hg).connect(Howler.masterGain)
        crack.start(t)
        const crackle = ctx.createBufferSource()
        crackle.buffer = this.noiseBuffer(ctx, 2, (x) => (Math.random() < 0.012 * (1 - x) ? 1 : 0))
        const cf = ctx.createBiquadFilter(); cf.type = 'highpass'; cf.frequency.value = 2000
        const cg = ctx.createGain(); cg.gain.value = 0.6 * this.volume
        crackle.connect(cf).connect(cg).connect(Howler.masterGain)
        crackle.start(t + 0.4)
    }

    update()
    {
        const delta = Math.min(0.05, this.game.ticker.delta)
        const player = this.game.player.position
        const distance = Math.hypot(player.x - this.center.x, player.z - this.center.z)
        const wasActive = this.active
        this.active = distance < 90
        this.volume = Math.max(0, Math.min(1, (34 - distance) / 12))   // only right next to the stadium

        for(const team of this.teams)
            team.b.visible = team.h.visible = this.active
        this.ball.visible = this.active
        if(!this.active)
        {
            if(wasActive)
            {
                this.particles.length = 0
                this.rockets.length = 0
                this.sparks.count = 0
            }
            if(this.sound)
                this.sound.out.gain.value = 0
            return
        }

        this.time += delta
        this.updatePlayers(delta)
        this.updateFireworks(delta)

        const sound = this.ensureSound()
        if(sound)
        {
            sound.cheer = Math.max(0, sound.cheer - delta * 0.3)
            sound.out.gain.value = this.volume * (0.5 + sound.cheer * 0.6)
            for(const l of sound.layers)
            {
                l.phase += delta * (0.4 + Math.random() * 0.3)
                l.g.gain.value = 0.18 + Math.sin(l.phase) * 0.06 + sound.cheer * 0.12
                l.band.frequency.value = l.f * (1 + sound.cheer * 0.25)
            }
        }
    }
}
