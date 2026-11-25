import * as THREE from 'three/webgpu'
import { color } from 'three/tsl'
import { Howler } from 'howler'
import { Game } from '../Game.js'
import { MeshDefaultMaterial } from '../Materials/MeshDefaultMaterial.js'
import { dogs as dogsData, dogSpots } from '../../data/worldData.js'

const css = /* css */`
.dog-tag
{
    position: absolute;
    left: 0;
    top: 0;
    z-index: 5;
    padding: 2px 9px;
    border-radius: 999px;
    background: rgba(28, 22, 40, 0.7);
    color: #fff2e8;
    font-family: "LXGW WenKai TC", "Noto Sans TC", "PingFang TC", sans-serif;
    font-size: 14px;
    white-space: nowrap;
    pointer-events: none;
    transform: translate(-50%, -100%);
    transition: opacity 0.3s;
    will-change: transform;
}
.dog-tag.is-hidden { opacity: 0; }
.dog-house-tag { z-index: 4; border-radius: 8px; padding: 3px 10px; font-size: 15px; background: rgba(255, 248, 238, 0.92); color: #3a2a20; }
.dog-house-tag.is-xiaoke { border: 2px solid #2f7fe0; }
.dog-house-tag.is-dookie { border: 2px solid #ff6fae; }
html.input-filter-intro .dog-tag, html.input-filter-menu .dog-tag, html.input-filter-modal .dog-tag { opacity: 0; }
`

const materialsCache = new Map()
const flat = (hex) =>
{
    if(!materialsCache.has(hex))
        materialsCache.set(hex, new MeshDefaultMaterial({ colorNode: color(hex), hasCoreShadows: true, hasDropShadows: true }))
    return materialsCache.get(hex)
}

/** Things the dogs carry in their mouth */
function makeItem(type)
{
    const group = new THREE.Group()
    const add = (geometry, hex, position = [ 0, 0, 0 ], rotation = [ 0, 0, 0 ], scale = [ 1, 1, 1 ]) =>
    {
        const mesh = new THREE.Mesh(geometry, flat(hex))
        mesh.position.set(...position)
        mesh.rotation.set(...rotation)
        mesh.scale.set(...scale)
        mesh.castShadow = true
        group.add(mesh)
    }
    if(type === 'fish')
    {
        add(new THREE.IcosahedronGeometry(0.22, 1), '#8fb3c9', [ 0, 0, 0 ], [ 0, 0, 0 ], [ 2.2, 0.8, 0.5 ])
        add(new THREE.ConeGeometry(0.18, 0.25, 3), '#5f8aa3', [ - 0.55, 0, 0 ], [ 0, 0, Math.PI / 2 ], [ 1, 1, 0.4 ])
        add(new THREE.IcosahedronGeometry(0.04, 0), '#111111', [ 0.32, 0.06, 0.09 ])
    }
    else if(type === 'iceCream')
    {
        add(new THREE.ConeGeometry(0.13, 0.36, 7), '#d79a55', [ 0, - 0.1, 0 ], [ Math.PI, 0, 0 ])
        add(new THREE.IcosahedronGeometry(0.15, 1), '#ed719f', [ 0, 0.14, 0 ])
    }
    else if(type === 'bun')
    {
        add(new THREE.SphereGeometry(0.2, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), '#fff2e8', [ 0, - 0.05, 0 ], [ 0, 0, 0 ], [ 1, 0.8, 1 ])
        add(new THREE.CylinderGeometry(0.2, 0.2, 0.05, 8), '#f3e2c8', [ 0, - 0.06, 0 ])
    }
    else if(type === 'drumstick')
    {
        add(new THREE.IcosahedronGeometry(0.2, 1), '#a3532c', [ 0.1, 0, 0 ], [ 0, 0, 0 ], [ 1.5, 1, 1 ])
        add(new THREE.CylinderGeometry(0.05, 0.05, 0.3, 6), '#fff2e8', [ - 0.28, 0, 0 ], [ 0, 0, Math.PI / 2 ])
        add(new THREE.IcosahedronGeometry(0.07, 0), '#fff2e8', [ - 0.44, 0, 0 ])
    }
    else if(type === 'tennisBall')
    {
        add(new THREE.IcosahedronGeometry(0.16, 1), '#c8e04a')
    }
    return group
}

let riderDog = null       // only one dog rides on the car's roof at a time
const ROOF = new THREE.Vector3(- 0.15, 0.58, 0)     // on the car's roof, car local (forward is +x)

class Dog
{
    constructor(data, template)
    {
        this.game = Game.getInstance()
        this.data = data
        this.isBig = data.id === 'dookie'

        this.state = 'wander'
        this.stateTime = 0
        this.target = new THREE.Vector3()
        this.facing = data.home.rotation || 0
        this.walkPhase = Math.random() * 10
        this.wag = 0
        this.item = null
        this.itemType = null
        this.chaseCooldown = 0
        this.bumpCooldown = 0
        this.lineCooldown = 0
        this.stuckTime = 0
        this.lastPosition = new THREE.Vector3()
        this.sleepBlend = 0
        this.currentSpeed = 0
        this.turnRate = 0
        this.pause = null          // { type: 'sniff' | 'look' | 'sit', time }
        this.seed = Math.random() * 100
        this.sleepPosition = null
        this.gallop = 0
        // the door of the dog house (houses are rotated, the door is on their local -z side)
        const r = data.home.rotation || 0
        this.doorDirection = { x: - Math.sin(r), z: - Math.cos(r) }
        this.houseDepth = this.isBig ? 4.4 : 2.2

        this.setVisual(template)
        this.setPhysical()
        this.setTag()
        this.pickWander()
    }

    setVisual(template)
    {
        this.visual = template.clone(true)
        this.game.materials.updateObject(this.visual)
        this.visual.traverse((child) =>
        {
            if(child.isMesh)
            {
                child.castShadow = true
                child.receiveShadow = true
            }
        })
        this.parts = {}
        for(const name of [ 'body', 'head', 'tail', 'legFL', 'legFR', 'legBL', 'legBR', 'earL', 'earR' ])
        {
            const pattern = new RegExp(`^${name}(\\d{3})?$`)
            let part = null
            this.visual.traverse((child) => { if(!part && pattern.test(child.name)) part = child })
            if(part)
            {
                part.rotation.reorder('YXZ')
                this.parts[name] = { object: part, base: part.position.clone() }
            }
        }
        this.mouth = new THREE.Object3D()
        this.mouth.position.set(0, this.isBig ? - 0.12 : 0.0, this.isBig ? 0.98 : 0.46)
        this.parts.head?.object.add(this.mouth)

        this.game.scene.add(this.visual)
    }

    setPhysical()
    {
        const half = this.isBig ? { x: 0.75, y: 1.2, z: 1.7 } : { x: 0.3, y: 0.5, z: 0.6 }
        this.half = half
        const { x, z } = this.data.home
        const y = Math.max(0, this.game.terrain.getGroundElevation(x, z)) + 0.3

        this.physical = this.game.physics.getPhysical({
            type: 'dynamic',
            position: { x: x + 2, y, z: z - 3 },
            friction: 0.4,
            restitution: 0.4,
            canSleep: false,
            settle: false,
            linearDamping: 0.6,
            angularDamping: 2,
            mass: this.data.mass,
            colliders: [ { shape: 'cuboid', parameters: [ half.x, half.y, half.z ], position: { x: 0, y: half.y, z: 0 }, category: 'object' } ],
        })
        this.body = this.physical.body
        this.body.lockRotations(true, true)
        this.upright = true
    }

    setTag()
    {
        this.tag = document.createElement('div')
        this.tag.className = 'dog-tag is-hidden'
        this.tag.textContent = this.data.name
        this.game.domElement.append(this.tag)
        this.tagText = this.data.name

        // label over the dog house
        this.houseTag = document.createElement('div')
        this.houseTag.className = `dog-tag dog-house-tag is-${this.data.id} is-hidden`
        this.houseTag.textContent = `🏠 ${this.data.name}${this.isBig ? ' 的家' : '的家'}`
        this.game.domElement.append(this.houseTag)
        const { x, z } = this.data.home
        this.housePosition = new THREE.Vector3(x, Math.max(0, this.game.terrain.getGroundElevation(x, z)) + (this.isBig ? 6.6 : 3.6), z)
    }

    /**
     * Bark (synthesized): 小可 yips, light and high; Dookie gives a deep chesty WOOF. Louder when the car is close.
     */
    bark(times = this.isBig ? 1 + Math.round(Math.random()) : 2 + Math.round(Math.random()))
    {
        const ctx = Howler.ctx
        if(!ctx || !Howler.masterGain || ctx.state !== 'running' || document.documentElement.classList.contains('is-audio-muted'))
            return
        const p = this.body.translation()
        const player = this.game.player.position
        const distance = Math.hypot(p.x - player.x, p.z - player.z)
        const volume = Math.max(0, Math.min(1, (28 - distance) / 18))
        if(volume <= 0)
            return
        const big = this.isBig
        let t = ctx.currentTime + 0.02
        for(let i = 0; i < times; i++)
        {
            const length = big ? 0.26 + Math.random() * 0.06 : 0.1 + Math.random() * 0.04
            const pitch = big ? 175 + Math.random() * 30 : 820 + Math.random() * 160
            // the voice: a buzzy tone that pops up then drops, through a mouth-like formant
            const voice = ctx.createOscillator()
            voice.type = 'sawtooth'
            voice.frequency.setValueAtTime(pitch * 0.8, t)
            voice.frequency.linearRampToValueAtTime(pitch * (big ? 1.15 : 1.3), t + length * 0.2)
            voice.frequency.exponentialRampToValueAtTime(pitch * (big ? 0.62 : 0.7), t + length)
            const formant = ctx.createBiquadFilter()
            formant.type = 'bandpass'
            formant.frequency.setValueAtTime(big ? 480 : 1900, t)
            formant.frequency.linearRampToValueAtTime(big ? 330 : 1400, t + length)
            formant.Q.value = big ? 2.2 : 3
            const body = ctx.createBiquadFilter()
            body.type = 'lowpass'
            body.frequency.value = big ? 1300 : 5200
            // breath: a puff of filtered noise at the start
            const noise = ctx.createBufferSource()
            const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * length), ctx.sampleRate)
            const data = buffer.getChannelData(0)
            for(let k = 0; k < data.length; k++)
                data[k] = (Math.random() * 2 - 1) * Math.pow(1 - k / data.length, 3)
            noise.buffer = buffer
            const breath = ctx.createBiquadFilter()
            breath.type = 'bandpass'
            breath.frequency.value = big ? 700 : 2600
            breath.Q.value = 0.8
            const gain = ctx.createGain()
            const peak = (big ? 0.55 : 0.32) * volume
            gain.gain.setValueAtTime(0.0001, t)
            gain.gain.exponentialRampToValueAtTime(peak, t + 0.012)
            gain.gain.exponentialRampToValueAtTime(peak * 0.5, t + length * 0.5)
            gain.gain.exponentialRampToValueAtTime(0.0001, t + length)
            const noiseGain = ctx.createGain()
            noiseGain.gain.value = big ? 0.35 : 0.25
            voice.connect(formant).connect(body).connect(gain)
            noise.connect(breath).connect(noiseGain).connect(gain)
            gain.connect(Howler.masterGain)
            voice.start(t)
            voice.stop(t + length + 0.02)
            noise.start(t)
            // open the mouth with each bark
            setTimeout(() => { this.barkOpen = length }, Math.max(0, (t - ctx.currentTime) * 1000))
            t += length + (big ? 0.18 + Math.random() * 0.1 : 0.07 + Math.random() * 0.05)
        }
    }

    say(key)
    {
        if(key === 'chase' || key === 'bump')
            this.bark()
        const line = this.data.lines[key]
        if(!line || this.lineCooldown > 0)
            return
        const p = this.body.translation()
        const player = this.game.player.position
        if(Math.hypot(p.x - player.x, p.z - player.z) > 30)
            return
        this.lineCooldown = 12
        this.game.notifications.show(`<span>${line}</span>`, '', 3, null, `dog-${this.data.id}-${key}`)
    }

    /* ---------- targets ---------- */

    isLand(x, z)
    {
        const edge = this.game.terrain.size / 2 - 10
        return Math.abs(x) < edge && Math.abs(z) < edge && this.game.terrain.getGroundElevation(x, z) > - 0.05
    }

    pickWander()
    {
        const p = this.body.translation()
        for(let i = 0; i < 20; i++)
        {
            const angle = Math.random() * Math.PI * 2
            const distance = 8 + Math.random() * 22
            const x = p.x + Math.cos(angle) * distance
            const z = p.z + Math.sin(angle) * distance
            if(this.isLand(x, z))
            {
                this.target.set(x, 0, z)
                break
            }
        }
        this.setState('wander')
    }

    pickErrand()
    {
        const name = this.data.favorites[Math.floor(Math.random() * this.data.favorites.length)]
        const spot = dogSpots[name]
        if(!spot)
            return this.pickWander()
        this.errand = { name, spot }
        this.target.set(spot.x + (Math.random() - 0.5) * 3, 0, spot.z + (Math.random() - 0.5) * 3)
        this.setState('errand')
    }

    setState(state)
    {
        this.state = state
        this.stateTime = 0
        this.updateTagText()
    }

    updateTagText()
    {
        const icons = { fish: '🐟', iceCream: '🍦', bun: '🥟', drumstick: '🍗', tennisBall: '🎾' }
        let text = this.data.name
        if(this.state === 'sleep')
            text += ' 💤'
        else if(this.state === 'chase')
            text += ' 💨'
        else if(this.itemType)
            text += ` ${icons[this.itemType] || ''}`
        if(text !== this.tagText)
        {
            this.tagText = text
            this.tag.textContent = text
        }
    }

    giveItem(type)
    {
        if(this.item)
        {
            this.mouth.remove(this.item)
            this.item = null
        }
        this.itemType = type
        if(type)
        {
            this.item = makeItem(type)
            this.item.scale.setScalar(this.isBig ? 1.6 : 0.9)
            this.mouth.add(this.item)
        }
        this.updateTagText()
    }

    /* ---------- brain (before physics) ---------- */

    isSleepTime()
    {
        const progress = this.game.dayCycles.progress
        return progress > 0.36 && progress < 0.62
    }

    think(delta)
    {
        this.stateTime += delta
        this.chaseCooldown -= delta
        this.bumpCooldown -= delta
        this.lineCooldown -= delta
        // now and then, a bark when the car is around (not while asleep)
        this.barkCooldown = (this.barkCooldown ?? 4 + Math.random() * 6) - delta
        if(this.barkCooldown < 0)
        {
            this.barkCooldown = 7 + Math.random() * 10
            const q = this.body.translation(), c = this.game.player.position
            if(this.state !== 'sleep' && Math.hypot(q.x - c.x, q.z - c.z) < 20)
                this.bark()
        }
        if(this.barkOpen > 0)
            this.barkOpen -= delta

        // Riding on the car's roof: stay up there for a while, hop off when it's over (or the car crashes / flips)
        if(this.state === 'ride')
        {
            this.ride.time += delta
            const vehicle = this.game.physicalVehicle
            const tooRough = vehicle.upsideDown?.active || vehicle.position.y < - 1
            if(this.ride.time > this.ride.duration || tooRough || this.isSleepTime())
                this.hopOff(tooRough)
            return
        }

        const p = this.body.translation()
        const player = this.game.player.position
        const playerDistance = Math.hypot(p.x - player.x, p.z - player.z)
        const playerSpeed = this.game.physicalVehicle.speed || 0

        // Close to the car while chasing it and the car is slow: jump up on the roof (one dog at a time)
        if(this.state === 'chase' && !riderDog && (this.rideCooldown || 0) <= 0 && playerDistance < (this.isBig ? 3.6 : 3) && Math.abs(playerSpeed) < 6 && !this.game.physicalVehicle.upsideDown?.active)
        {
            this.jumpOn()
            return
        }
        this.rideCooldown = (this.rideCooldown || 0) - delta

        // Fell in the water or off the map: go home
        if(this.state !== 'sleep' && (p.y < - 3 || Math.abs(p.x) > this.game.terrain.size / 2 || Math.abs(p.z) > this.game.terrain.size / 2))
        {
            this.teleportHome()
            return
        }

        // Knocked by the car: let physics play, then get back up
        if(this.state === 'bounced')
        {
            const v = this.body.linvel()
            if(this.stateTime > 1.4 && Math.hypot(v.x, v.y, v.z) < 1.5)
            {
                this.standUp()
                this.say('bump')
                this.chaseCooldown = - 1
                this.pickWander()
            }
            return
        }

        // The car bumps into the dog
        if(this.state !== 'sleep' && this.bumpCooldown <= 0 && playerSpeed > 3 && playerDistance < (this.isBig ? 2.8 : 2.0) && p.y - player.y < 1.5)
        {
            this.bounce(player, playerSpeed)
            return
        }

        // Sleep at night
        if(this.isSleepTime())
        {
            if(this.state !== 'goHome' && this.state !== 'sleep')
            {
                this.giveItem(null)
                const out = this.houseDepth / 2 + this.half.z + 0.8
                this.target.set(this.data.home.x + this.doorDirection.x * out, 0, this.data.home.z + this.doorDirection.z * out)
                this.setState('goHome')
            }
        }
        else if(this.state === 'sleep' || this.state === 'goHome')
        {
            this.wakeUp()
        }

        // Asleep in the dog house: nothing else to do
        if(this.state === 'sleep')
        {
            this.speed = 0
            return
        }
        // Taking too long to get home (blocked somewhere): just appear in bed
        if(this.state === 'goHome' && this.stateTime > 45)
        {
            this.goToBed()
            return
        }

        // Chase the car when it comes close
        if(this.state !== 'sleep' && this.state !== 'goHome' && this.state !== 'chase' && this.chaseCooldown <= 0 && playerDistance < (this.isBig ? 20 : 23))
        {
            this.setState('chase')
            this.say('chase')
        }

        if(this.state === 'chase')
        {
            this.target.set(player.x, 0, player.z)
            if(this.stateTime > 28 || playerDistance > 38)
            {
                this.chaseCooldown = 6
                Math.random() < 0.5 ? this.pickErrand() : this.pickWander()
            }
        }

        // Arrival
        const toTarget = Math.hypot(this.target.x - p.x, this.target.z - p.z)
        const arriveDistance = this.state === 'chase' ? (this.isBig ? 4 : 3) : 1.6
        if(toTarget < arriveDistance)
        {
            if(this.state === 'wander' && !this.pause)
            {
                if(this.stateTime > 1)
                {
                    const roll = Math.random()
                    if(roll < 0.45)
                        this.pause = { type: roll < 0.2 ? 'sniff' : roll < 0.35 ? 'look' : 'sit', time: 1.5 + Math.random() * 3.5 }
                    else
                        Math.random() < 0.45 ? this.pickErrand() : this.pickWander()
                }
            }
            else if(this.state === 'errand')
            {
                this.setState('busy')
            }
            else if(this.state === 'goHome')
            {
                this.goToBed()
                this.say('sleep')
            }
        }

        // Busy at a spot: sniff, eat, fetch
        if(this.state === 'busy' && this.stateTime > 3.5)
        {
            const { name, spot } = this.errand
            if(spot.item)
                this.giveItem(spot.item)
            this.say(name)
            // eat it after a while
            this.game.ticker.wait(25, () => { if(this.itemType === spot.item) this.giveItem(null) })
            this.pickWander()
        }

        // Stuck against something: hop and pick somewhere else
        const moved = Math.hypot(p.x - this.lastPosition.x, p.z - this.lastPosition.z)
        this.lastPosition.set(p.x, p.y, p.z)
        const wantsToMove = [ 'wander', 'errand', 'chase', 'goHome' ].includes(this.state) && toTarget > arriveDistance
        if(wantsToMove && !this.pause && moved < 0.5 * delta)
            this.stuckTime += delta
        else
            this.stuckTime = 0
        if(this.stuckTime > 1.6)
        {
            this.stuckTime = 0
            this.body.applyImpulse({ x: 0, y: this.data.mass * 5, z: 0 }, true)
            if(this.state === 'wander')
                this.pickWander()
        }

        // Short pauses on the way: sniff the ground, look around, sit for a moment
        if(this.pause)
        {
            this.pause.time -= delta
            if(this.state !== 'wander' || this.pause.time <= 0)
            {
                const wasWandering = this.state === 'wander' && this.pause.time <= 0
                this.pause = null
                if(wasWandering)
                    Math.random() < 0.45 ? this.pickErrand() : this.pickWander()
            }
        }
        else if(this.state === 'wander' && Math.random() < delta * 0.06)
        {
            this.pause = { type: Math.random() < 0.6 ? 'sniff' : 'look', time: 1 + Math.random() * 2.5 }
        }

        // Desired speed: dogs accelerate and slow down gradually, and ease in when arriving
        let desired = 0
        if(wantsToMove && !this.pause)
        {
            desired = this.state === 'chase' ? this.data.speed.run : this.state === 'goHome' ? this.data.speed.walk * 1.3 : this.data.speed.walk
            // a little trot now and then while wandering
            if(this.state === 'wander' || this.state === 'errand')
                desired *= 1 + Math.max(0, Math.sin(this.stateTime * 0.5 + this.seed)) * 0.6
            desired *= Math.min(1, 0.35 + (toTarget - arriveDistance) / 4)
        }
        const accel = desired > this.currentSpeed ? (this.isBig ? 5 : 9) : 10
        this.currentSpeed += Math.sign(desired - this.currentSpeed) * Math.min(Math.abs(desired - this.currentSpeed), accel * delta)

        // Steering: turn toward the target at a limited rate (wider arcs when running), with a lazy meander when wandering
        let targetFacing = this.facing
        if(desired > 0 || this.currentSpeed > 0.3)
        {
            targetFacing = Math.atan2(this.target.x - p.x, this.target.z - p.z)
            if(this.state === 'wander' || this.state === 'errand')
                targetFacing += Math.sin(this.stateTime * 0.8 + this.seed) * 0.35
        }
        else if(this.state === 'chase' || this.state === 'busy')
        {
            const lookAt = this.state === 'chase' ? player : this.target
            targetFacing = Math.atan2(lookAt.x - p.x, lookAt.z - p.z)
        }
        else if(this.pause && this.pause.type === 'look')
        {
            targetFacing = this.facing + Math.sin(this.stateTime * 1.3 + this.seed) * 0.6
        }
        let diff = targetFacing - this.facing
        diff = Math.atan2(Math.sin(diff), Math.cos(diff))
        const maxTurn = (this.currentSpeed > this.data.speed.walk * 1.5 ? 3.2 : 5) * delta
        const turn = Math.max(- maxTurn, Math.min(maxTurn, diff * Math.min(1, delta * 6)))
        this.facing += turn
        this.turnRate += (turn / Math.max(delta, 0.001) - this.turnRate) * Math.min(1, delta * 6)

        // move along where the dog is facing (so paths curve naturally)
        const v = this.body.linvel()
        const vx = Math.sin(this.facing) * this.currentSpeed
        const vz = Math.cos(this.facing) * this.currentSpeed
        const blend = Math.min(1, delta * 8)
        this.body.setLinvel({ x: v.x + (vx - v.x) * blend, y: v.y, z: v.z + (vz - v.z) * blend }, true)
        this.speed = Math.hypot(v.x, v.z)
    }

    jumpOn()
    {
        riderDog = this
        const p = this.body.translation()
        this.ride = { time: 0, duration: 20 + Math.random() * 25, from: new THREE.Vector3(p.x, p.y, p.z), jump: 0.55 }
        this.currentSpeed = 0
        this.pause = null
        this.body.setLinvel({ x: 0, y: 0, z: 0 }, true)
        this.body.setEnabled(false)
        this.setState('ride')
        this.bark(this.isBig ? 1 : 2)
        this.lineCooldown = 0
        this.game.notifications.show(`<span>${this.data.name} 跳上車頂了！</span>`, '', 3, null, `dog-${this.data.id}-ride`)
    }

    hopOff(thrown = false)
    {
        if(riderDog === this)
            riderDog = null
        const vehicle = this.game.physicalVehicle
        // land beside the car (to its right), on the ground
        const side = new THREE.Vector3(0, 0, 1).applyQuaternion(vehicle.quaternion)
        side.y = 0
        side.normalize().multiplyScalar(this.isBig ? 3 : 2.4)
        const x = vehicle.position.x + side.x, z = vehicle.position.z + side.z
        this.body.setEnabled(true)
        this.body.setTranslation({ x, y: Math.max(vehicle.position.y, this.game.terrain.getGroundElevation(x, z)) + 0.6, z }, true)
        this.body.setLinvel({ x: side.x * (thrown ? 3 : 1), y: 2, z: side.z * (thrown ? 3 : 1) }, true)
        this.standUp()
        this.rideCooldown = 25
        this.chaseCooldown = 8
        this.ride = null
        this.pickWander()
    }

    goToBed()
    {
        // curl up on the doorstep, right in front of the door (in plain view, so you can find them asleep)
        const inset = this.houseDepth / 2 + this.half.z + 0.25
        const { x, z } = this.data.home
        this.sleepPosition = new THREE.Vector3(
            x + this.doorDirection.x * inset,
            Math.max(0, this.game.terrain.getGroundElevation(x, z)) + 0.05,
            z + this.doorDirection.z * inset
        )
        this.facing = Math.atan2(this.doorDirection.x, this.doorDirection.z)
        this.currentSpeed = 0
        this.pause = null
        this.body.setLinvel({ x: 0, y: 0, z: 0 }, true)
        this.body.setEnabled(false)
        this.giveItem(null)
        this.setState('sleep')
    }

    wakeUp()
    {
        if(this.sleepPosition)
        {
            // step out of the door
            const out = this.houseDepth / 2 + this.half.z + 0.8
            const { x, z } = this.data.home
            this.body.setEnabled(true)
            this.body.setTranslation({ x: x + this.doorDirection.x * out, y: Math.max(0, this.game.terrain.getGroundElevation(x, z)) + 0.3, z: z + this.doorDirection.z * out }, true)
            this.body.setLinvel({ x: 0, y: 0, z: 0 }, true)
            this.sleepPosition = null
        }
        this.pickWander()
    }

    bounce(from, speed)
    {
        const p = this.body.translation()
        const dx = p.x - from.x, dz = p.z - from.z
        const d = Math.max(0.001, Math.hypot(dx, dz))
        const strength = Math.min(speed, 14) * this.data.mass * (this.isBig ? 0.5 : 0.8)
        this.body.lockRotations(false, true)
        this.upright = false
        this.body.applyImpulse({ x: dx / d * strength, y: this.data.mass * (this.isBig ? 6 : 7), z: dz / d * strength }, true)
        this.body.applyTorqueImpulse({ x: (Math.random() - 0.5) * this.data.mass * 2, y: (Math.random() - 0.5) * this.data.mass, z: (Math.random() - 0.5) * this.data.mass * 2 }, true)
        this.bumpCooldown = 2.5
        this.setState('bounced')
    }

    standUp()
    {
        const p = this.body.translation()
        this.body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true)
        this.body.setAngvel({ x: 0, y: 0, z: 0 }, true)
        this.body.setTranslation({ x: p.x, y: Math.max(p.y, this.game.terrain.getGroundElevation(p.x, p.z)) + 0.2, z: p.z }, true)
        this.body.lockRotations(true, true)
        this.upright = true
    }

    teleportHome()
    {
        const { x, z } = this.data.home
        this.body.setTranslation({ x: x + 2, y: Math.max(0, this.game.terrain.getGroundElevation(x, z)) + 1, z: z - 3 }, true)
        this.body.setLinvel({ x: 0, y: 0, z: 0 }, true)
        this.standUp()
        if(this.isSleepTime())
            this.goToBed()
        else
            this.pickWander()
    }

    /* ---------- visuals (after physics) ---------- */

    animate(delta, time)
    {
        if(this.state === 'ride' && this.ride)
        {
            // on the roof, facing forward with the car; the first moment is a leap up in an arc
            const vehicle = this.game.physicalVehicle
            const roof = ROOF.clone().applyQuaternion(vehicle.quaternion).add(vehicle.position)
            const k = Math.min(1, this.ride.time / this.ride.jump)
            const e = k * k * (3 - 2 * k)
            this.visual.position.lerpVectors(this.ride.from, roof, e)
            this.visual.position.y += Math.sin(k * Math.PI) * 1.6 + Math.abs(Math.sin(time * 7)) * 0.03 * k     // the leap, then a happy bob
            const facing = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 2, 0))
            this.visual.quaternion.copy(vehicle.quaternion).multiply(facing)
            this.speed = 0
            this.wag = 1
            this.ridePose = true
        }
        else
            this.ridePose = false
        const p = this.body.translation()
        if(this.ridePose) { /* placed above */ }
        else if(this.sleepPosition)
            this.visual.position.copy(this.sleepPosition)
        else
            this.visual.position.set(p.x, p.y, p.z)

        const speed = this.sleepPosition ? 0 : (this.speed || 0)
        const run = this.data.speed.run, walk = this.data.speed.walk
        // gait blend: walk/trot -> gallop
        this.gallop += (Math.min(1, Math.max(0, (speed - walk * 1.4) / (run - walk * 1.4))) - this.gallop) * Math.min(1, delta * 4)
        const g = this.gallop

        if(this.ridePose) {}
        else if(this.upright)
        {
            // lean into turns, pitch with the gallop
            const lean = Math.max(- 0.25, Math.min(0.25, - this.turnRate * speed * 0.025))
            const pitch = Math.sin(this.walkPhase) * 0.07 * g
            this.visual.quaternion.setFromEuler(new THREE.Euler(pitch, this.facing, lean, 'YXZ'))
        }
        else
        {
            const r = this.body.rotation()
            const bodyQ = new THREE.Quaternion(r.x, r.y, r.z, r.w)
            this.visual.quaternion.copy(bodyQ).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.facing))
            // collider center is above the feet
            const offset = new THREE.Vector3(0, this.half.y, 0).applyQuaternion(bodyQ)
            this.visual.position.set(p.x + offset.x, p.y + offset.y - this.half.y, p.z + offset.z)
        }

        const sleeping = this.state === 'sleep'
        this.sleepBlend += ((sleeping ? 1 : 0) - this.sleepBlend) * Math.min(1, delta * 2)
        const s = this.sleepBlend
        const sitting = this.pause?.type === 'sit' ? 1 : 0
        this.sitBlend = (this.sitBlend || 0) + (sitting - (this.sitBlend || 0)) * Math.min(1, delta * 4)
        const sit = this.sitBlend * (1 - s)
        const sniffing = this.pause?.type === 'sniff' || this.state === 'busy' ? 1 : 0
        this.sniffBlend = (this.sniffBlend || 0) + (sniffing - (this.sniffBlend || 0)) * Math.min(1, delta * 5)
        const sniff = this.sniffBlend

        // legs: diagonal trot at walking speeds, front pair / back pair bounding in a gallop
        const stride = Math.min(1, speed / (walk * 1.1))
        this.walkPhase += delta * (this.isBig ? 5.5 : 9) * Math.min(2.2, speed / walk + 0.001) * (1 - g * 0.25)
        const phase = this.walkPhase
        const amplitude = (0.55 + g * 0.35) * stride
        const legs = this.parts
        const legDrop = this.isBig ? 1.0 : 0.5
        const trot = { FL: Math.sin(phase), BR: Math.sin(phase), FR: - Math.sin(phase), BL: - Math.sin(phase) }
        const bound = { FL: Math.sin(phase), FR: Math.sin(phase - 0.35), BL: Math.sin(phase + Math.PI), BR: Math.sin(phase + Math.PI - 0.35) }
        for(const leg of [ 'FL', 'FR', 'BL', 'BR' ])
        {
            const part = legs[`leg${leg}`]
            if(!part)
                continue
            const swing = (trot[leg] * (1 - g) + bound[leg] * g) * amplitude
            const front = leg[0] === 'F'
            const lie = front ? - 1.45 : 1.45
            // sitting: back legs folded forward, front legs straight
            const sitAngle = front ? 0 : - 1.2
            part.object.rotation.x = swing * (1 - s) * (1 - sit) + s * lie + sit * sitAngle
            part.object.position.y = part.base.y - s * legDrop * 0.85 - (front ? 0 : sit * legDrop * 0.35)
        }

        // body bob, lie down, sit back
        const bob = Math.abs(Math.sin(phase)) * (0.05 + g * 0.08) * stride * (this.isBig ? 1.6 : 1)
        if(legs.body)
        {
            legs.body.object.position.y = legs.body.base.y + bob - s * legDrop - sit * legDrop * 0.25
            legs.body.object.rotation.x = - sit * 0.45
        }
        if(legs.head)
        {
            const lookAtCar = this.state === 'wander' && !this.pause && Math.hypot(this.game.player.position.x - this.visual.position.x, this.game.player.position.z - this.visual.position.z) < 12
            legs.head.object.position.y = legs.head.base.y + bob * 0.6 - s * legDrop * 1.15 - sniff * legDrop * 0.35 + sit * legDrop * 0.1
            legs.head.object.rotation.x = - s * 0.35 + sniff * (0.55 + Math.sin(time * 9) * 0.12) + (this.state === 'chase' ? - 0.15 : 0) - g * 0.1 - (this.barkOpen > 0 ? Math.max(0, Math.sin(this.barkOpen * 30)) * 0.22 : 0)   // head jerks up with each bark
            const lookAround = this.pause?.type === 'look' ? Math.sin(time * 1.2 + this.seed) * 0.6 : 0
            const curious = lookAtCar ? Math.max(- 0.8, Math.min(0.8, Math.atan2(this.game.player.position.x - this.visual.position.x, this.game.player.position.z - this.visual.position.z) - this.facing)) : 0
            legs.head.object.rotation.y = (lookAround + Math.atan2(Math.sin(curious), Math.cos(curious)) * 0.7 + Math.sin(time * 0.4 + this.seed) * 0.1) * (1 - s)
            legs.head.object.rotation.z = this.pause?.type === 'look' ? Math.sin(time * 0.9) * 0.15 : 0 // head tilt
        }

        // tail: fast wide wag when happy, slow sway otherwise, tucked when asleep
        const happy = this.state === 'chase' || this.itemType ? 1 : this.pause ? 0.6 : 0.4
        this.wag += delta * (happy > 0.7 ? 16 : 6 + happy * 4)
        if(legs.tail)
        {
            legs.tail.object.position.y = legs.tail.base.y - s * legDrop - sit * legDrop * 0.35
            legs.tail.object.rotation.y = Math.sin(this.wag) * (0.25 + 0.5 * happy) * (1 - s) + s * 0.6
            legs.tail.object.rotation.x = (this.isBig ? 0.2 : - 0.3 + happy * 0.2) - s * 0.6 + g * 0.35
        }
        // floppy ears bounce with each step, flap back when running
        for(const [ ear, side ] of [ [ 'earL', 1 ], [ 'earR', - 1 ] ])
            if(legs[ear])
            {
                legs[ear].object.rotation.z = side * (Math.sin(phase * 2) * 0.15 * stride + g * 0.4 - s * 0.2)
                legs[ear].object.rotation.x = g * 0.3
            }

        // breathing (panting after running, slow while asleep)
        if(legs.body)
            legs.body.object.scale.setScalar(1 + Math.sin(time * (sleeping ? 1.6 : this.state === 'chase' && speed < 1 ? 9 : 3)) * (sleeping ? 0.02 : 0.008))
    }

    updateTag(camera, width, height)
    {
        const head = this.parts.head?.object || this.visual
        const position = new THREE.Vector3()
        head.getWorldPosition(position)
        position.y += this.isBig ? 1.3 : 0.75
        const distance = position.distanceTo(camera.position)
        position.project(camera)
        const visible = position.z < 1 && Math.abs(position.x) < 1.1 && Math.abs(position.y) < 1.1 && distance < 70
        this.tag.classList.toggle('is-hidden', !visible)
        if(visible)
        {
            const x = (position.x * 0.5 + 0.5) * width
            const y = (- position.y * 0.5 + 0.5) * height
            this.tag.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`
        }

        const house = this.housePosition.clone()
        const houseDistance = house.distanceTo(camera.position)
        house.project(camera)
        const houseVisible = house.z < 1 && Math.abs(house.x) < 1.1 && Math.abs(house.y) < 1.1 && houseDistance < 90
        this.houseTag.classList.toggle('is-hidden', !houseVisible)
        if(houseVisible)
        {
            const x = (house.x * 0.5 + 0.5) * width
            const y = (- house.y * 0.5 + 0.5) * height
            this.houseTag.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`
        }
    }
}

/**
 * 小可 and Dookie: they wander the city, run errands to the stops, chase the car and sleep at night.
 */
export class Dogs
{
    constructor()
    {
        this.game = Game.getInstance()

        const style = document.createElement('style')
        style.textContent = css
        document.head.append(style)

        const model = this.game.resources.dogsModel?.scene
        if(!model)
            return

        this.items = dogsData.map((data) =>
        {
            const template = model.getObjectByName(data.id)
            return template ? new Dog(data, template) : null
        }).filter(Boolean)

        // brain before the physics step, visuals after
        this.game.ticker.events.on('tick', () =>
        {
            const delta = Math.min(this.game.ticker.deltaScaled, 0.1)
            for(const dog of this.items)
                dog.think(delta)
        }, 2)

        this.game.ticker.events.on('tick', () =>
        {
            const delta = Math.min(this.game.ticker.deltaScaled, 0.1)
            const time = this.game.ticker.elapsed
            const camera = this.game.view.camera
            const width = this.game.viewport.width
            const height = this.game.viewport.height
            for(const dog of this.items)
            {
                dog.animate(delta, time)
                dog.updateTag(camera, width, height)
            }
        }, 9)
    }
}
