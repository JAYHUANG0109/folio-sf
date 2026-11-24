import * as THREE from 'three/webgpu'
import { Howl, Howler } from 'howler'
import { color, instanceColor } from 'three/tsl'
import { Game } from '../Game.js'
import { MeshDefaultMaterial } from '../Materials/MeshDefaultMaterial.js'
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
        this.setAnnouncerClips()
        this.setFireworks()
        this.setSound()

        this.game.ticker.events.on('tick', () => this.update(), 12)
    }

    material(hex)
    {
        this.mats = this.mats || new Map()
        if(!this.mats.has(hex))
            this.mats.set(hex, new MeshDefaultMaterial({ colorNode: color(hex), hasWater: false }))
        return this.mats.get(hex)
    }

    /** a jersey number painted on a little canvas (front and back of each player) */
    numberTexture(number, ink, outline)
    {
        const canvas = document.createElement('canvas')
        canvas.width = canvas.height = 64
        const c = canvas.getContext('2d')
        c.font = '900 46px "Nunito", "Arial Black", sans-serif'
        c.textAlign = 'center'
        c.textBaseline = 'middle'
        c.lineWidth = 6
        c.strokeStyle = outline
        c.strokeText(String(number), 32, 35)
        c.fillStyle = ink
        c.fillText(String(number), 32, 35)
        const texture = new THREE.CanvasTexture(canvas)
        texture.colorSpace = THREE.SRGBColorSpace
        return texture
    }

    setPlayers()
    {
        // real-looking players (about 1.4 units tall): helmet with a stripe and facemask, shoulder pads under the
        // jersey, numbers front and back, team pants and socks, cleats; legs and arms swing as they run
        const g = {
            sphere: new THREE.SphereGeometry(1, 16, 12),
            capsule: new THREE.CapsuleGeometry(1, 1, 4, 10),
            box: new THREE.BoxGeometry(1, 1, 1),
            mask: new THREE.TorusGeometry(0.13, 0.012, 4, 12, Math.PI),
            plane: new THREE.PlaneGeometry(1, 1),
        }
        const kits = [
            // 49ers: scarlet jersey, gold pants, gold helmet with a red-white-red stripe
            { jersey: '#c8102e', trim: '#ffffff', pants: '#b3995d', socks: '#c8102e', helmet: '#b3995d', stripe: '#c8102e', mask: '#c8102e', ink: '#ffffff', outline: '#b3995d', numbers: [ 13, 80, 85, 44, 23, 19, 74, 71, 60, 64, 9 ] },
            // Seahawks: navy jersey, navy pants, navy helmet with action green, grey mask
            { jersey: '#002244', trim: '#69be28', pants: '#a5acaf', socks: '#002244', helmet: '#002244', stripe: '#69be28', mask: '#a5acaf', ink: '#ffffff', outline: '#69be28', numbers: [ 14, 3, 16, 88, 61, 79, 76, 51, 9, 33, 42 ] },
        ]
        const SKIN = [ '#8d5a3b', '#c68a62', '#f0c3a0', '#5e3a28', '#e0a984' ]
        this.playersGroup = new THREE.Group()
        this.game.scene.add(this.playersGroup)
        this.teams = kits.map((kit, team) =>
        {
            const players = []
            for(let i = 0; i < 11; i++)
            {
                const root = new THREE.Group()
                root.scale.setScalar(1.45)
                this.playersGroup.add(root)
                const part = (parent, geometry, hex, [ x, y, z ], [ sx, sy, sz ], rotation) =>
                {
                    const m = new THREE.Mesh(geometry, typeof hex === 'string' ? this.material(hex) : hex)
                    m.position.set(x, y, z)
                    m.scale.set(sx, sy, sz)
                    if(rotation) m.rotation.set(...rotation)
                    m.castShadow = true
                    parent.add(m)
                    return m
                }
                const skin = SKIN[(i * 7 + team * 3) % SKIN.length]
                // legs on hip pivots: thigh (pants), sock, cleat
                const legs = [ - 1, 1 ].map(side =>
                {
                    const hip = new THREE.Group()
                    hip.position.set(side * 0.07, 0.42, 0)
                    root.add(hip)
                    part(hip, g.capsule, kit.pants, [ 0, - 0.1, 0 ], [ 0.058, 0.1, 0.058 ])
                    part(hip, g.capsule, kit.socks, [ 0, - 0.27, 0 ], [ 0.045, 0.09, 0.045 ])
                    part(hip, g.box, '#151515', [ 0, - 0.38, 0.03 ], [ 0.08, 0.05, 0.15 ])
                    return hip
                })
                // torso: jersey over shoulder pads, a belt, sleeves with a trim stripe
                part(root, g.capsule, kit.jersey, [ 0, 0.6, 0 ], [ 0.13, 0.08, 0.1 ])
                part(root, g.box, kit.jersey, [ 0, 0.77, 0 ], [ 0.38, 0.1, 0.24 ])           // shoulder pads
                part(root, g.box, kit.trim, [ 0, 0.775, 0 ], [ 0.385, 0.025, 0.245 ])
                part(root, g.box, '#222222', [ 0, 0.45, 0 ], [ 0.25, 0.04, 0.19 ])
                const arms = [ - 1, 1 ].map(side =>
                {
                    const shoulder = new THREE.Group()
                    shoulder.position.set(side * 0.2, 0.76, 0)
                    root.add(shoulder)
                    part(shoulder, g.capsule, kit.jersey, [ 0, - 0.06, 0 ], [ 0.05, 0.05, 0.05 ])
                    part(shoulder, g.box, kit.trim, [ 0, - 0.1, 0 ], [ 0.105, 0.02, 0.105 ])
                    part(shoulder, g.capsule, skin, [ 0, - 0.2, 0 ], [ 0.04, 0.07, 0.04 ])
                    part(shoulder, g.sphere, '#ffffff', [ 0, - 0.3, 0 ], [ 0.045, 0.045, 0.045 ])   // gloves
                    return shoulder
                })
                // head and helmet: shell, a center stripe, ear holes, the facemask bars
                part(root, g.capsule, skin, [ 0, 0.86, 0 ], [ 0.05, 0.03, 0.05 ])
                part(root, g.sphere, kit.helmet, [ 0, 0.98, - 0.01 ], [ 0.125, 0.12, 0.14 ])
                part(root, g.box, kit.stripe, [ 0, 1.03, - 0.02 ], [ 0.03, 0.1, 0.26 ], [ 0.2, 0, 0 ])
                part(root, g.sphere, skin, [ 0, 0.95, 0.09 ], [ 0.08, 0.08, 0.05 ])
                for(const y of [ 0.93, 0.97 ])
                    part(root, g.mask, kit.mask, [ 0, y, 0.105 ], [ 0.85, 0.85, 0.85 ], [ Math.PI / 2, 0, 0 ])
                part(root, g.box, kit.mask, [ 0, 0.94, 0.15 ], [ 0.015, 0.09, 0.015 ])
                // numbers front and back
                const numberMat = new THREE.MeshBasicNodeMaterial({ transparent: true })
                const texture = this.numberTexture(kit.numbers[i], kit.ink, kit.outline)
                numberMat.colorNode = texture ? undefined : color('#ffffff')
                numberMat.map = texture
                numberMat.alphaTest = 0.4
                part(root, g.plane, numberMat, [ 0, 0.6, 0.106 ], [ 0.2, 0.2, 1 ])
                part(root, g.plane, numberMat, [ 0, 0.62, - 0.106 ], [ 0.22, 0.22, 1 ], [ 0, Math.PI, 0 ])
                players.push({ root, legs, arms, last: new THREE.Vector3(), heading: 0, stride: Math.random() * 6 })
            }
            return { players }
        })
        this.ball = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8).scale(1, 1, 1.6), this.material('#6b3a1e'))
        this.game.scene.add(this.ball)
        this.dummy = new THREE.Object3D()
        this.play = { t: 0, duration: 6, line: 0, dir: 1, down: 1, toGo: 2, kind: 'run', gain: 1 }
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
            p.t = 0
            this.resolvePlay()
            this.nextPlay()
            setTimeout(() => this.active && this.whistle(), 900)
        }
        const snap = 1.2
        const run = Math.max(0, p.t - snap) / (p.duration - snap)
        const eased = run * run * (3 - 2 * run)
        // the ball carrier's path this play (the QB drops back on a sack; nobody runs on a kick)
        const kick = p.kind === 'fieldgoal' || p.kind === 'punt'
        const carry = kick ? p.line - p.dir * 1.2 : p.line + p.dir * p.gain * eased
        for(let team = 0; team < 2; team++)
        {
            const offense = team === (p.dir > 0 ? 0 : 1)
            this.teams[team].players.forEach((pl, i) =>
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
                const [ wx, wy, wz ] = this.toWorld(x, z)
                const dx = wx - pl.last.x, dz = wz - pl.last.z
                const speed = Math.hypot(dx, dz) / Math.max(delta, 0.001)
                pl.last.set(wx, wy, wz)
                // face where they're running (or the line of scrimmage while set), swing legs and arms with speed
                const set = offense === (p.dir > 0) ? Math.PI / 2 : - Math.PI / 2
                const target = speed > 0.4 && speed < 40 ? Math.atan2(dx, dz) : set
                let diff = target - pl.heading
                diff = Math.atan2(Math.sin(diff), Math.cos(diff))
                pl.heading += diff * Math.min(1, delta * 8)
                const moving = Math.min(1, speed / 3)
                pl.stride += delta * (4 + speed * 2.2)
                const swing = Math.sin(pl.stride) * 0.9 * moving
                pl.legs[0].rotation.x = swing
                pl.legs[1].rotation.x = - swing
                pl.arms[0].rotation.x = - swing * 0.8
                pl.arms[1].rotation.x = swing * 0.8
                const crouch = p.t < snap ? 0.25 : 0.12 * moving               // set in a stance before the snap
                pl.root.rotation.set(crouch, pl.heading, 0, 'YXZ')
                pl.root.position.set(wx, wy + Math.abs(Math.sin(pl.stride)) * 0.05 * moving, wz)
            })
        }
        if(kick && p.t > snap + 0.3)
        {
            // the kick: the ball sails toward (or through) the uprights
            const k = Math.min(1, (p.t - snap - 0.3) / 2.2)
            const target = p.kind === 'fieldgoal' ? p.dir * 12.6 : p.line + p.dir * 8
            const [ bx, by, bz ] = this.toWorld(p.line + (target - p.line) * k, p.kind === 'fieldgoal' && !p.good ? k * 1.8 : 0, 0.3 + Math.sin(k * Math.PI) * (p.kind === 'punt' ? 7 : 4.5) + (p.kind === 'fieldgoal' ? k * 1.2 : 0))
            this.ball.position.set(bx, by, bz)
        }
        else
        {
            const [ bx, by, bz ] = this.toWorld(carry + p.dir * 0.2, Math.sin(run * 4) * 1.2, p.t > snap ? 0.85 : 0.12)
            this.ball.position.set(bx, by, bz)
        }
    }

    /** the big call: counting down the yard lines, then TOUCHDOWN! */
    /**
     * A real-ish drive: field x runs -12..12 (end zones beyond ±10), 1 unit = 5 yards, 10 yards to make a first down.
     * The 49ers (team 0) attack +x (dir 1), the Seahawks attack -x.
     */
    nextPlay()
    {
        const p = this.play
        const yardsToGoal = (10 - p.dir * p.line) * 5
        const r = Math.random()
        let yards
        if(p.down === 4 && p.toGo > 0.3)
            p.kind = yardsToGoal <= 37 ? 'fieldgoal' : 'punt'
        else if(r < 0.04) p.kind = 'interception'
        else if(r < 0.07) p.kind = 'fumble'
        else if(r < 0.13) p.kind = 'sack'
        else if(r < 0.27) p.kind = 'bigplay'
        else p.kind = Math.random() < 0.5 ? 'run' : 'pass'
        if(p.kind === 'sack') yards = - (4 + Math.random() * 6)
        else if(p.kind === 'bigplay') yards = 16 + Math.random() * 30
        else if(p.kind === 'interception' || p.kind === 'fumble') yards = 2 + Math.random() * 6
        else if(p.kind === 'run' || p.kind === 'pass') yards = (p.dir > 0 ? 0 : - 2) + Math.random() * (p.dir > 0 ? 16 : 13)   // the home team moves the ball a bit better
        else yards = 0
        p.gain = Math.min(yards / 5, 10 - p.dir * p.line + 1.2)          // never run past the back of the end zone
        p.good = Math.random() < 0.85
        p.duration = p.kind === 'fieldgoal' || p.kind === 'punt' ? 4.5 : 6
        // the call before the snap: third down for the Seahawks, the crowd gets loud
        if(p.down === 3 && p.dir < 0 && Math.random() < 0.6)
        {
            this.cheer(0.6)
            this.call('thirddown', [ { text: 'Third down! Listen to this crowd!' } ])
        }
    }

    resolvePlay()
    {
        const p = this.play
        const niners = p.dir > 0
        const turnover = () => { p.dir *= - 1; p.down = 1; p.toGo = 2 }
        this.hit()
        if(p.kind === 'fieldgoal')
        {
            if(p.good)
            {
                this.cheer(niners ? 1 : 0.1)
                if(niners) { this.launchVolley(3); this.call('fieldgoal', [ { text: 'The kick is up...', rate: 1 }, { text: 'and it is GOOD!', pitch: 1.35 } ]) }
            }
            else if(!niners)
            {
                this.cheer(1)
                this.call('missed', [ { text: 'NO GOOD! Wide right!', pitch: 1.3 } ])
            }
            p.line = 0
            turnover()
            return
        }
        if(p.kind === 'punt')
        {
            p.line = Math.max(- 9, Math.min(9, p.line + p.dir * 8))
            turnover()
            return
        }
        const newLine = p.line + p.dir * p.gain
        if(p.kind === 'interception' || p.kind === 'fumble')
        {
            p.line = Math.max(- 9.5, Math.min(9.5, newLine))
            if(!niners)
            {
                this.cheer(1.1)
                this.call(p.kind, p.kind === 'interception'
                    ? [ { text: 'PICKED OFF!', pitch: 1.4, rate: 1.1 }, { text: 'Interception, San Francisco!' } ]
                    : [ { text: 'FUMBLE!', pitch: 1.4 }, { text: 'And the Niners recover!' } ])
            }
            turnover()
            return
        }
        if(p.dir * newLine > 10)
        {
            // touchdown: 49ers -> the big call, fireworks, the whole stadium jumps; Seahawks -> quiet
            if(niners)
            {
                this.cheer(1.3)
                this.launchVolley(6)
                this.touchdownCall(p.kind === 'bigplay' ? 3 : 9)
            }
            else if(!Object.keys(this.clips || {}).length)
                this.announce([ { text: 'Seahawks score.', pitch: 0.85, rate: 0.95 } ])
            p.line = 0
            turnover()
            return
        }
        p.line = newLine
        if(p.kind === 'sack' && !niners)
        {
            this.cheer(0.9)
            this.call('sack', [ { text: 'SACKED! Bosa gets there!', pitch: 1.3 } ])
        }
        const gainedYards = p.gain
        if(gainedYards >= p.toGo)
        {
            p.down = 1
            p.toGo = 2
            if(niners)
            {
                this.cheer(p.kind === 'bigplay' ? 0.9 : 0.5)
                if(p.kind === 'bigplay')
                    this.call(this.clips?.tackle?.length && Math.random() < 0.5 ? 'tackle' : 'catch', [ { text: 'OH what a CATCH!' }, { text: 'Look at him go!' } ])
                else
                    this.call('firstdown', [ { text: 'FIRST DOWN, Forty Niners!' } ])
            }
        }
        else
        {
            p.toGo -= Math.max(gainedYards, - 1)
            p.down++
            if(p.down > 4)
            {
                if(niners === false) { this.cheer(1); this.call('stop', [ { text: 'STOPPED! Turnover on downs!', pitch: 1.3 } ]) }
                turnover()
            }
            else if(Math.random() < 0.25 && !niners)
                this.call('bighit', [ { text: 'BIG hit!', rate: 1.2 } ])
            else if(niners && p.kind === 'pass' && gainedYards >= 1 && Math.random() < 0.35)
            {
                this.cheer(0.4)
                this.call('catch', [ { text: 'Nice grab!' } ])
            }
        }
    }

    /** recorded announcer clips (static/sounds/announcer, made by `npm run sf:announcer` from Jay's recordings) */
    setAnnouncerClips()
    {
        this.clips = {}
        fetch('sounds/announcer/manifest.json', { cache: 'no-cache' })
            .then(r => r.ok ? r.json() : {})
            .then(manifest =>
            {
                for(const [ name, files ] of Object.entries(manifest || {}))
                    this.clips[name] = files.map(file => ({ file, howl: null }))
            })
            .catch(() => {})
    }

    /** play a random take of a recorded clip; returns its Howl (or null when there's no recording) */
    playClip(name, force = false, onEnd = null)
    {
        const takes = this.clips?.[name]
        if(!takes?.length || document.documentElement.classList.contains('is-audio-muted'))
            return null
        if(!force && (this.volume < 0.35 || performance.now() - this.lastCall < 3000))
            return null
        this.lastCall = performance.now()
        const take = takes[Math.floor(Math.random() * takes.length)]
        take.howl = take.howl || new Howl({ src: [ `sounds/announcer/${take.file}` ], volume: 1 })
        take.howl.volume(Math.min(1, Math.max(this.volume, force ? 0.85 : 0)))
        if(onEnd)
            take.howl.once('end', onEnd)
        take.howl.play()
        return take.howl
    }

    /** a call: the recording if there is one, otherwise the browser voice */
    call(name, lines, force = false)
    {
        if(this.playClip(name, force))
            return
        // once Jay's recordings are in, moments without a recording stay quiet (no robot voice mixed with his)
        if(Object.keys(this.clips || {}).length)
            return
        this.announce(lines, force)
    }

    touchdownCall(from = 6)
    {
        this.crowdJumpTimer = 7          // the whole stadium jumps for a few seconds
        if(this.clips?.touchdown?.length)
        {
            // recorded: the yard-line countdown (if any) straight into TOUCHDOWN 49ERS!!!
            if(from < 8 && this.clips.countdown?.length && this.playClip('countdown', true, () => this.playClip('touchdown', true)))
                return
            if(this.playClip('touchdown', true))
                return
        }
        const lines = []
        if(from < 8)
            lines.push({ text: 'He\'s at the thirty!', rate: 1.25, pitch: 1.15 }, { text: 'the twenty!', rate: 1.3, pitch: 1.2 }, { text: 'the ten!', rate: 1.35, pitch: 1.3 })
        lines.push(
            { text: 'TOUCHDOWN!', rate: 0.72, pitch: 1.45, volume: 1 },
            { text: 'TOUCHDOWN FORTY NINERS!!!', rate: 0.95, pitch: 1.35, volume: 1 },
            { text: 'Oh, what a play! Levi\'s Stadium is ROCKING!', rate: 1.15, pitch: 1.2 },
        )
        this.announce(lines, true)
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

    /** the stadium announcer: an excited male English voice, a sequence of lines, only when you're right there */
    announce(lines, force = false)
    {
        if(!('speechSynthesis' in window) || document.documentElement.classList.contains('is-audio-muted'))
            return
        if(!force && this.volume < 0.5)
            return
        if(!force && performance.now() - this.lastCall < 6000)
            return
        this.lastCall = performance.now()
        if(typeof lines === 'string')
            lines = [ { text: lines } ]
        const voices = speechSynthesis.getVoices().filter(v => /^en/i.test(v.lang))
        const voice = [ /Google US English/i, /Aaron|Fred|Daniel|Alex|Rocko|Ralph|Eddy|Reed|Guy|David|Mark|Male/i ].reduce((found, re) => found || voices.find(v => re.test(v.name)), null) || voices[0]
        speechSynthesis.cancel()
        for(const line of lines)
        {
            const u = new SpeechSynthesisUtterance(line.text)
            u.lang = 'en-US'
            if(voice) u.voice = voice
            u.rate = line.rate ?? 1.15
            u.pitch = line.pitch ?? 1.15
            u.volume = line.volume ?? Math.min(1, Math.max(this.volume, force ? 0.8 : 0)) * 0.95
            speechSynthesis.speak(u)
        }
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

        this.playersGroup.visible = this.active
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
        const jump = this.game.materials.crowdJump
        if(jump)
        {
            this.crowdJumpTimer = Math.max(0, (this.crowdJumpTimer || 0) - delta)
            const target = this.crowdJumpTimer > 1 ? 1 : this.crowdJumpTimer
            jump.value += (target - jump.value) * Math.min(1, delta * 6)
        }
        this.updatePlayers(delta)
        this.updateFireworks(delta)

        const sound = this.ensureSound()
        if(sound)
        {
            sound.cheer = Math.max(0, sound.cheer - delta * 0.3)
            // no constant murmur: the crowd is only heard when it cheers (big plays, scores)
            sound.out.gain.value = this.volume * Math.min(1, sound.cheer) * 0.75
            for(const l of sound.layers)
            {
                l.phase += delta * (0.4 + Math.random() * 0.3)
                l.g.gain.value = 0.18 + Math.sin(l.phase) * 0.06 + sound.cheer * 0.12
                l.band.frequency.value = l.f * (1 + sound.cheer * 0.25)
            }
        }
    }
}
