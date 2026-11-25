import * as THREE from 'three/webgpu'
import { color, uniform, attribute } from 'three/tsl'
import { Howler } from 'howler'
import { Area } from './Area.js'
import { InteractivePoints } from '../../InteractivePoints.js'
import { StopCard } from './StopCard.js'
import { StopTask } from './StopTask.js'
import { stops } from '../../../data/worldData.js'
import cableCarNetwork from '../../../data/cableCarNetwork.json'
import { spreadXZ } from '../../../data/worldWarp.js'

/**
 * One trip stop: a landmark area with a passport stamp, a card and a sign.
 * Landmark meshes come from static/areas/areas.glb (scripts/sf/landmarks.mjs).
 */
export class StopArea extends Area
{
    constructor(model, stop)
    {
        super(model)

        this.stop = stop

        this.setStamp()
        this.setSign()

        if(stop.id === 'lombard')
            this.setCableCar()

        if(stop.id === 'levis')
            this.setFootball()

        if(stop.id === 'sfo')
            this.setPlane()

        this.task = new StopTask(this)
    }

    getStampState()
    {
        const group = this.game.achievements.groups.get('stops')
        const done = group && group.progress instanceof Set ? group.progress : new Set()
        const doneIndices = new Set(stops.map((s, i) => done.has(s.id) ? i : -1).filter(i => i >= 0))
        const next = stops.find(s => !done.has(s.id) && s.order > this.stop.order) || stops.find(s => !done.has(s.id) && s.id !== this.stop.id) || null
        return { done, doneIndices, next }
    }

    showCard(isNew = false)
    {
        const { doneIndices, next } = this.getStampState()
        StopCard.get().show({ stop: this.stop, total: stops.length, done: doneIndices, next, isNew, task: this.task?.text })
    }

    setStamp()
    {
        this.events.on('boundingIn', () =>
        {
            const before = this.getStampState().done
            const isNew = !before.has(this.stop.id)

            this.game.achievements.setProgress('stops', this.stop.id)
            this.showCard(isNew)
            this.game.world.guide?.refresh()

            const { done } = this.getStampState()
            if(isNew && done.size === stops.length)
            {
                this.game.ticker.wait(6, () => this.game.world.finale?.play())
            }
            else if(isNew && this.game.world.confetti)
            {
                this.game.world.confetti.pop(this.game.player.position.clone())
            }
        })
    }

    setSign()
    {
        const position = new THREE.Vector3(this.stop.respawn.x, 0, this.stop.respawn.z)
        position.y = Math.max(0, this.game.terrain.getGroundElevation(position.x, position.z)) + 2

        this.game.interactivePoints.create(
            position,
            `${this.stop.label} ${this.stop.name}`,
            InteractivePoints.ALIGN_RIGHT,
            InteractivePoints.STATE_CONCEALED,
            () =>
            {
                this.showCard(false)
            },
            () =>
            {
                this.game.inputs.interactiveButtons.addItems(['interact'])
            },
            () =>
            {
                this.game.inputs.interactiveButtons.removeItems(['interact'])
            },
            () =>
            {
                this.game.inputs.interactiveButtons.removeItems(['interact'])
            }
        )
    }

    /**
     * Cable car going up and down Hyde St (kinematic body following a path baked by the build script)
     */
    setCableCar()
    {
        const reference = this.references.items.get('cableCar')?.[0]
        const object = reference?.userData.object
        if(!object?.physical)
            return
        // it roams the whole city, so it must not hide with the Lombard area
        const visual = object.visual?.object3D
        if(visual && this.objects?.hideable)
            this.objects.hideable = this.objects.hideable.filter(o => o !== visual)

        const network = cableCarNetwork
        const adjacency = network.nodes.map(() => [])
        network.edges.forEach((edge, i) => { adjacency[edge.a].push(i); adjacency[edge.b].push(i) })
        // start on Hyde St (the edge closest to the top of Lombard)
        let start = 0, best = Infinity
        const [ hx, hz ] = spreadXZ(- 17, - 30)
        network.edges.forEach((edge, i) => edge.points.forEach(([ x, , z ]) => { const d = Math.hypot(x - hx, z - hz); if(d < best) { best = d; start = i } }))
        this.cableCar = {
            body: object.physical.body,
            visual: object.visual?.object3D,
            knocked: null, cooldown: 0,
            network, adjacency,
            edge: start, forward: true,
            points: network.edges[start].points.map(p => new THREE.Vector3(...p)),
            index: 0, t: 0,
            speed: 2.6,              // game time runs at 2x: about 5 units a second, an easy cable car pace
            pauseTimer: 2,
            position: new THREE.Vector3(),
            quaternion: new THREE.Quaternion(),
            euler: new THREE.Euler(0, 0, 0, 'YXZ'),
            yaw: null, pitch: 0,
        }
        // keep it moving even when the area is off screen
        this.game.ticker.events.on('tick', () => this.updateCableCar(), 10)
    }

    /** at the end of a street piece: pick the next one at random (straight on is likelier, U-turns only at dead ends) */
    nextCableCarEdge()
    {
        const car = this.cableCar
        const edge = car.network.edges[car.edge]
        const node = car.forward ? edge.b : edge.a
        const here = car.points[car.points.length - 1]
        const before = car.points[Math.max(0, car.points.length - 4)]
        const heading = new THREE.Vector2(here.x - before.x, here.z - before.z).normalize()
        const options = car.adjacency[node].filter(i => i !== car.edge)
        let choice = car.edge
        if(options.length)
        {
            const weights = options.map(i =>
            {
                const e = car.network.edges[i]
                const pts = e.a === node ? e.points : [ ...e.points ].reverse()
                const ahead = pts[Math.min(4, pts.length - 1)]
                const dir = new THREE.Vector2(ahead[0] - pts[0][0], ahead[2] - pts[0][2]).normalize()
                return 0.35 + Math.max(0, heading.dot(dir)) * 1.6
            })
            let roll = Math.random() * weights.reduce((a, b) => a + b, 0)
            choice = options[weights.findIndex(w => (roll -= w) <= 0)] ?? options[0]
        }
        const next = car.network.edges[choice]
        car.forward = next.a === node
        car.edge = choice
        const pts = (car.forward ? next.points : [ ...next.points ].reverse()).map(p => new THREE.Vector3(...p))
        // carry on smoothly from where it is now
        car.points = [ car.position.clone(), ...pts ]
        car.index = 0
        car.t = 0
        if(!options.length)
            car.pauseTimer = 3              // end of the line: a pause, then back the other way
    }

    /** the player's car always wins: the cable car flies off, smokes and flashes red, then hops back onto its track */
    setCableCarEffects()
    {
        const car = this.cableCar
        // red warning flash: a glowing red shell over the car
        const flashMaterial = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false })
        flashMaterial.colorNode = color('#ff2a1a')
        flashMaterial.opacityNode = uniform(0)
        car.flashOpacity = flashMaterial.opacityNode
        car.flash = new THREE.Mesh(new THREE.BoxGeometry(2.35, 3.05, 5.25).translate(0, 1.5, 0), flashMaterial)
        car.flash.visible = false
        car.visual?.add(car.flash)
        // smoke puffs: a small pool reused forever
        const smokeMaterial = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false })
        smokeMaterial.colorNode = color('#5a5a5f')
        smokeMaterial.opacityNode = attribute('instanceOpacity', 'float')
        car.puffs = Array.from({ length: 60 }, () => ({ life: 0, max: 1, p: new THREE.Vector3(), v: new THREE.Vector3(), s: 0 }))
        car.smoke = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), smokeMaterial, car.puffs.length)
        car.smokeOpacity = new THREE.InstancedBufferAttribute(new Float32Array(car.puffs.length), 1)
        car.smoke.geometry.setAttribute('instanceOpacity', car.smokeOpacity)
        car.smoke.frustumCulled = false
        car.smoke.count = car.puffs.length
        this.game.scene.add(car.smoke)
        car.smokeDummy = new THREE.Object3D()
        car.vents = [ [ 0, 2.9, 1.8 ], [ 0, 2.9, - 1.8 ], [ 0.9, 1.8, 2.3 ], [ - 0.9, 1.2, - 2.3 ], [ 1.05, 2.2, 0 ], [ - 1.05, 0.8, 0.6 ] ].map(v => new THREE.Vector3(...v))
        car.nextPuff = 0
    }

    knockCableCar(player, playerSpeed)
    {
        const car = this.cableCar
        const RAPIER = this.game.RAPIER
        const vehicle = this.game.physicalVehicle
        // fly away from the player's car, in the direction it was driving
        const away = new THREE.Vector3(car.position.x - player.x, 0, car.position.z - player.z).normalize()
        const forward = new THREE.Vector3(1, 0, 0).applyQuaternion(vehicle.quaternion).setY(0).normalize()
        const dir = away.multiplyScalar(0.5).add(forward.multiplyScalar(0.5)).normalize()
        const push = 6 + Math.min(Math.abs(playerSpeed), 16) * 0.9
        car.body.setBodyType(RAPIER.RigidBodyType.Dynamic, true)
        car.body.setLinvel({ x: dir.x * push, y: 6 + Math.random() * 3, z: dir.z * push }, true)
        car.body.setAngvel({ x: (Math.random() - 0.5) * 5, y: (Math.random() - 0.5) * 3, z: (Math.random() - 0.5) * 6 }, true)
        car.knocked = { time: 0, down: 4 + Math.random() * 1.5, recover: 0 }
        this.boing(1)
        if(car.flash) car.flash.visible = true
    }

    /** a cartoon "boing": a springy pitch bend with a wobble, no explosion */
    boing(strength = 1)
    {
        const ctx = Howler.ctx
        if(!ctx || !Howler.masterGain || ctx.state !== 'running' || document.documentElement.classList.contains('is-audio-muted'))
            return
        const player = this.game.player.position, car = this.cableCar.position
        const volume = Math.max(0, Math.min(1, (40 - Math.hypot(player.x - car.x, player.z - car.z)) / 25)) * 0.45 * strength
        if(volume <= 0)
            return
        const t = ctx.currentTime + 0.01
        const o = ctx.createOscillator()
        o.type = 'triangle'
        o.frequency.setValueAtTime(140, t)
        o.frequency.exponentialRampToValueAtTime(520, t + 0.12)
        o.frequency.exponentialRampToValueAtTime(180, t + 0.55)
        const wobble = ctx.createOscillator()
        wobble.frequency.setValueAtTime(18, t)
        wobble.frequency.linearRampToValueAtTime(7, t + 0.55)
        const depth = ctx.createGain()
        depth.gain.value = 45
        wobble.connect(depth).connect(o.frequency)
        const g = ctx.createGain()
        g.gain.setValueAtTime(0.0001, t)
        g.gain.exponentialRampToValueAtTime(volume, t + 0.02)
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6)
        o.connect(g).connect(Howler.masterGain)
        o.start(t); wobble.start(t)
        o.stop(t + 0.65); wobble.stop(t + 0.65)
    }

    updateCableCarKnock(delta)
    {
        const car = this.cableCar
        const k = car.knocked
        k.time += delta
        const t = this.game.ticker.elapsed
        // red flashing, faster and stronger the longer it lies there
        const urgency = Math.min(1, k.time / k.down)
        if(car.flashOpacity)
            car.flashOpacity.value = (0.12 + urgency * 0.25) * (0.5 + 0.5 * Math.sin(t * (6 + urgency * 10)))
        if(k.time < k.down)
            return false
        // wait while the player's car sits where it would land (it never lands on, or shoves, the player)
        if(!k.recover)
        {
            const player = this.game.player.position
            if(Math.hypot(player.x - car.position.x, player.z - car.position.z) < 6.5)
            {
                k.waited = (k.waited || 0) + 0.5
                k.down = k.time + 0.5
                // waited long enough: come back a bit further along the track instead, clear of the player
                if(k.waited > 8)
                {
                    for(let step = 0; step < 40 && Math.hypot(player.x - car.position.x, player.z - car.position.z) < 9; step++)
                    {
                        if(car.index >= car.points.length - 2)
                            this.nextCableCarEdge()
                        car.index = Math.min(car.index + 1, car.points.length - 1)
                        car.t = 0
                        car.position.copy(car.points[car.index])
                    }
                    car.pauseTimer = 0
                    k.waited = 0
                }
                return false
            }
            this.boing(0.7)
        }
        // pop back up: rise from where it fell, turning upright, then drop onto the track and carry on
        if(!k.recover)
        {
            const RAPIER = this.game.RAPIER
            const p = car.body.translation(), r = car.body.rotation()
            k.from = new THREE.Vector3(p.x, p.y, p.z)
            k.fromQ = new THREE.Quaternion(r.x, r.y, r.z, r.w)
            car.body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased, true)
            k.recover = 0.0001
        }
        k.recover += delta / 0.9
        const e = Math.min(1, k.recover)
        const ease = e * e * (3 - 2 * e)
        const pos = k.from.clone().lerp(car.position, ease)
        pos.y += Math.sin(e * Math.PI) * 2.5
        const q = k.fromQ.clone().slerp(car.quaternion, ease)
        car.body.setNextKinematicTranslation(pos)
        car.body.setNextKinematicRotation(q)
        if(e >= 1)
        {
            car.knocked = null
            car.cooldown = 2.5
            if(car.flash) car.flash.visible = false
        }
        return true
    }

    updateCableCarSmoke(delta)
    {
        const car = this.cableCar
        if(!car.smoke)
            return
        // new puffs from the vents while it's knocked over
        if(car.knocked && car.knocked.time < car.knocked.down + 0.6 && car.visual)
        {
            car.nextPuff -= delta
            while(car.nextPuff <= 0)
            {
                car.nextPuff += 0.05
                const puff = car.puffs.find(pf => pf.life <= 0)
                if(!puff) break
                const vent = car.vents[Math.floor(Math.random() * car.vents.length)]
                puff.p.copy(vent).applyMatrix4(car.visual.matrixWorld)
                puff.v.set((Math.random() - 0.5) * 0.8, 1.6 + Math.random() * 1.4, (Math.random() - 0.5) * 0.8)
                puff.max = puff.life = 1.4 + Math.random() * 1.2
                puff.s = 0.25 + Math.random() * 0.25
            }
        }
        car.puffs.forEach((puff, i) =>
        {
            const d = car.smokeDummy
            if(puff.life > 0)
            {
                puff.life -= delta
                puff.p.addScaledVector(puff.v, delta)
                puff.v.multiplyScalar(1 - delta * 0.6)
                const age = 1 - Math.max(0, puff.life) / puff.max
                d.position.copy(puff.p)
                d.scale.setScalar(puff.s * (1 + age * 3.2))
                car.smokeOpacity.array[i] = Math.max(0, 0.55 * (1 - age)) * Math.min(1, age * 8)
            }
            else
            {
                d.scale.setScalar(0.0001)
                car.smokeOpacity.array[i] = 0
            }
            d.updateMatrix()
            car.smoke.setMatrixAt(i, d.matrix)
        })
        car.smoke.instanceMatrix.needsUpdate = true
        car.smokeOpacity.needsUpdate = true
    }

    updateCableCar()
    {
        const car = this.cableCar
        const delta = Math.min(this.game.ticker.deltaScaled, 0.1)
        if(!car.smoke)
            this.setCableCarEffects()
        this.updateCableCarSmoke(delta)
        if(car.knocked)
        {
            this.updateCableCarKnock(delta)
            return
        }
        car.cooldown = Math.max(0, car.cooldown - delta)
        if(car.cooldown > 0)
        {
            const player = this.game.player.position
            if(Math.hypot(player.x - car.position.x, player.z - car.position.z) < 6)
                return                          // just back on the track: wait for the player to drive off first
        }
        // the player's car touches it: the cable car is the one that goes flying (never the other way round)
        const player = this.game.player.position
        const ox = player.x - car.position.x, oz = player.z - car.position.z
        const along = Math.abs(ox * Math.sin(car.yaw ?? 0) + oz * Math.cos(car.yaw ?? 0))
        const across = Math.abs(ox * Math.cos(car.yaw ?? 0) - oz * Math.sin(car.yaw ?? 0))
        if(car.cooldown <= 0 && along < 4.2 && across < 2.9 && Math.abs(player.y - car.position.y) < 3)
        {
            this.knockCableCar(player, this.game.physicalVehicle.speed || 0)
            return
        }
        if(car.pauseTimer > 0)
        {
            car.pauseTimer -= delta
            return
        }
        // travel along the points
        let travel = car.speed * delta
        while(travel > 0)
        {
            if(car.index >= car.points.length - 1)
            {
                this.nextCableCarEdge()
                if(car.pauseTimer > 0)
                    break
                continue
            }
            const a = car.points[car.index], b = car.points[car.index + 1]
            const length = Math.max(0.0001, a.distanceTo(b))
            const left = (1 - car.t) * length
            if(travel < left)
            {
                car.t += travel / length
                travel = 0
            }
            else
            {
                travel -= left
                car.index++
                car.t = 0
            }
        }
        const a = car.points[Math.min(car.index, car.points.length - 1)]
        const b = car.points[Math.min(car.index + 1, car.points.length - 1)]
        car.position.lerpVectors(a, b, car.t)
        // face along the road (its long side is the z axis), easing round the corners, tilting with the slope
        const ahead = car.points[Math.min(car.index + 2, car.points.length - 1)]
        const dx = ahead.x - car.position.x, dz = ahead.z - car.position.z, dy = ahead.y - car.position.y
        if(Math.hypot(dx, dz) > 0.05)
        {
            const yaw = Math.atan2(dx, dz)
            if(car.yaw === null) car.yaw = yaw
            let diff = Math.atan2(Math.sin(yaw - car.yaw), Math.cos(yaw - car.yaw))
            car.yaw += diff * Math.min(1, delta * 4)
            car.pitch += (- Math.atan2(dy, Math.hypot(dx, dz)) - car.pitch) * Math.min(1, delta * 4)
        }
        car.euler.set(car.pitch, car.yaw ?? 0, 0)
        car.quaternion.setFromEuler(car.euler)
        car.body.setNextKinematicTranslation(car.position)
        car.body.setNextKinematicRotation(car.quaternion)
    }

    /**
     * The EVA plane dressed as a reindeer floats slowly up and down above the apron like Santa's sleigh
     * (a kinematic body, so its collider follows). Santa.js reads world.evaPlane to ride on it.
     */
    setPlane()
    {
        let reference = null
        this.references.items.forEach((value, name) => { if(!reference && name.startsWith('evaPlane')) reference = value[0] })
        const object = reference?.userData.object
        const body = object?.physical?.body
        if(!body)
            return
        // it flies all over the map in winter, so it must not hide with the SFO area
        const visual = object.visual?.object3D
        if(visual && this.objects?.hideable)
            this.objects.hideable = this.objects.hideable.filter(o => o !== visual)

        const t = body.translation(), r = body.rotation()
        const baseQuaternion = new THREE.Quaternion(r.x, r.y, r.z, r.w)
        const baseYaw = new THREE.Euler().setFromQuaternion(baseQuaternion, 'YXZ').y
        // Santa's winter tour: a loop round the whole map, starting and ending at the gate (counterclockwise:
        // up the bay past the Ferry Building, along the north waterfront past Pier 39 and Alcatraz, round the
        // Presidio, down Ocean Beach, over the turkey hill, past Levi's and home to SFO)
        const route = [
            [ t.x, t.z ], ...[
            [ 66, 80 ], [ 76, 66 ], [ 80, 48 ], [ 76, 28 ], [ 70, 10 ], [ 66, - 6 ], [ 76, - 20 ], [ 70, - 42 ],
            [ 54, - 60 ], [ 34, - 68 ], [ 14, - 64 ], [ - 10, - 62 ], [ - 36, - 60 ], [ - 50, - 52 ], [ - 58, - 32 ], [ - 76, - 20 ],
            [ - 78, 10 ], [ - 74, 40 ], [ - 62, 58 ], [ - 40, 72 ], [ - 16, 58 ], [ 10, 54 ], [ 34, 58 ], [ 46, 70 ],
            ].map(([ x, z ]) => spreadXZ(x, z)),       // design spots, moved out with the map spread
        ]
        const curve = new THREE.CatmullRomCurve3(route.map(([ x, z ]) => new THREE.Vector3(x, 0, z)), true, 'centripetal')
        const plane = {
            body,
            base: new THREE.Vector3(t.x, t.y, t.z),
            quaternion: baseQuaternion,
            position: new THREE.Vector3(),
            euler: new THREE.Euler(0, 0, 0, 'YXZ'),
            current: baseQuaternion.clone(),
            time: 0,
            curve,
            length: curve.getLength(),
            distance: 0,              // along the route, 0 = parked at the gate
            speed: 0,
            yaw: baseYaw,
            roll: 0,
            pitch: 0,
            altitude: t.y + 9.2,
            clearance: - Infinity,
            flying: false,
        }
        this.game.world.evaPlane = plane

        // what's under the route just ahead (buildings, towers, hills, trees): the plane climbs over anything tall
        const RAPIER = this.game.RAPIER
        const ray = new RAPIER.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: - 1, z: 0 })
        const FLAGS = RAPIER.QueryFilterFlags.EXCLUDE_KINEMATIC | RAPIER.QueryFilterFlags.EXCLUDE_SENSORS
        const topAt = (x, z) =>
        {
            ray.origin.x = x
            ray.origin.y = 90
            ray.origin.z = z
            const hit = this.game.physics.world.castRay(ray, 90, true, FLAGS)
            return hit ? 90 - hit.timeOfImpact : - Infinity
        }
        const point = new THREE.Vector3(), tangent = new THREE.Vector3()
        let frame = 0
        const CRUISE = 9
        const FLOAT = 9.2            // above the terminal roof (~8.5) and below the tower's deck (~22, the reindeer)

        this.game.ticker.events.on('tick', () =>
        {
            const delta = Math.min(0.05, this.game.ticker.deltaScaled)
            plane.time += delta
            const k = plane.time
            // winter: lift off at the gate, then fly the tour round the map, again and again.
            // Any other season: finish the loop home to the gate, settle down and rest there (Santa goes to sleep)
            const winter = this.game.environment?.seasonId() === 'winter'
            const home = plane.distance === 0 && plane.speed < 0.01
            if(plane.lift === undefined)
                plane.lift = winter ? 1 : 0
            plane.lift += ((winter || !home ? 1 : 0) - plane.lift) * Math.min(1, delta * 0.35)

            let targetSpeed = 0
            if(winter)
                targetSpeed = plane.lift > 0.96 ? CRUISE : 0
            else if(!home)
                targetSpeed = Math.min(CRUISE * 1.4, Math.max(1.2, (plane.length - plane.distance) * 0.45))     // slows into the gate
            plane.speed += (targetSpeed - plane.speed) * Math.min(1, delta * 0.6)
            if(plane.speed > 0.01 || plane.distance > 0)
            {
                plane.distance += plane.speed * delta
                if(plane.distance >= plane.length - (winter ? 0 : 0.05))
                {
                    if(winter)
                        plane.distance -= plane.length
                    else
                    {
                        plane.distance = 0
                        plane.speed = 0
                    }
                }
            }
            plane.flying = plane.distance > 0 || plane.speed > 0.01

            const u = plane.distance / plane.length
            curve.getPointAt(u, point)
            curve.getTangentAt(u, tangent)

            // altitude: the float height, or higher to clear whatever is under the next stretch of the route
            if(plane.flying && frame++ % 3 === 0)
            {
                let top = - Infinity
                const nx = - tangent.z, nz = tangent.x
                for(const ahead of [ 0, 8, 16, 26 ])
                {
                    const a = curve.getPointAt(((plane.distance + ahead) % plane.length) / plane.length)
                    for(const side of [ - 8, 0, 8 ])
                        top = Math.max(top, topAt(a.x + nx * side, a.z + nz * side))
                }
                plane.clearance = top
            }
            if(!plane.flying)
                plane.clearance = - Infinity
            const targetAltitude = Math.max(plane.base.y + FLOAT, plane.clearance + 2.4)
            const previousAltitude = plane.altitude
            plane.altitude += (targetAltitude - plane.altitude) * Math.min(1, delta * (targetAltitude > plane.altitude ? 1.6 : 0.5))
            const climb = delta > 0 ? (plane.altitude - previousAltitude) / delta : 0

            // heading along the route (parked: the gate's heading), banking into the turns, nose up when climbing
            const targetYaw = plane.flying ? Math.atan2(- tangent.x, - tangent.z) : baseYaw
            let turn = targetYaw - plane.yaw
            turn = Math.atan2(Math.sin(turn), Math.cos(turn))
            const yawStep = turn * Math.min(1, delta * 2.2)
            plane.yaw += yawStep
            const yawRate = delta > 0 ? yawStep / delta : 0
            plane.roll += (THREE.MathUtils.clamp(yawRate * 0.55, - 0.4, 0.4) - plane.roll) * Math.min(1, delta * 2)
            plane.pitch += (THREE.MathUtils.clamp(climb * 0.06, - 0.15, 0.25) - plane.pitch) * Math.min(1, delta * 2)

            const f = plane.lift
            const bob = Math.sin(k * 0.9) * 0.6
            plane.position.set(point.x, plane.base.y + (plane.altitude - plane.base.y + bob) * f, point.z)
            plane.euler.set(
                (Math.sin(k * 0.9 + 1.2) * 0.025 + plane.pitch) * f,
                plane.yaw,
                (Math.sin(k * 0.6) * 0.03 + plane.roll) * f
            )
            plane.current.setFromEuler(plane.euler)
            body.setNextKinematicTranslation(plane.position)
            body.setNextKinematicRotation(plane.current)
        }, 10)
    }

    /**
     * Football: push it into an end zone for a touchdown
     */
    setFootball()
    {
        const ball = this.references.items.get('football')?.[0]?.userData.object
        const zones = [ 'endZoneEast', 'endZoneWest' ].map(name => this.references.items.get(name)?.[0]).filter(Boolean)
        if(!ball?.physical || !zones.length)
            return

        this.football = { object: ball, zones, cooldown: 0 }
    }

    update()
    {
        if(this.football)
        {
            const football = this.football
            football.cooldown -= this.game.ticker.deltaScaled
            if(football.cooldown <= 0)
            {
                const position = football.object.physical.body.translation()
                for(const zone of football.zones)
                {
                    if(Math.abs(position.x - zone.position.x) < zone.scale.x * 0.5 && Math.abs(position.z - zone.position.z) < zone.scale.z * 0.5)
                    {
                        football.cooldown = 6
                        if(this.game.world.confetti)
                        {
                            this.game.world.confetti.pop(new THREE.Vector3(position.x, position.y, position.z))
                            this.game.world.confetti.pop(new THREE.Vector3(position.x, position.y, position.z + 3))
                        }
                        this.game.notifications.show('<span>TOUCHDOWN 49ERS!!! 🏈</span>', '', 3, null, 'touchdown')
                        const gameDay = this.game.world.gameDay
                        if(gameDay)
                        {
                            gameDay.cheer?.(1.4)
                            gameDay.launchVolley?.(8)
                            gameDay.touchdownCall?.(20, null, true)
                            gameDay.jumbotron?.event('touchdown', { team: 'sf', user: true })
                        }
                        this.task?.touchdown()
                        this.game.ticker.wait(3, () => this.game.objects.resetObject(football.object))
                        break
                    }
                }
            }
        }
    }
}
