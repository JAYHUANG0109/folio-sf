import * as THREE from 'three/webgpu'
import { Area } from './Area.js'
import { InteractivePoints } from '../../InteractivePoints.js'
import { StopCard } from './StopCard.js'
import { StopTask } from './StopTask.js'
import { stops } from '../../../data/worldData.js'
import cableCarNetwork from '../../../data/cableCarNetwork.json'

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
        network.edges.forEach((edge, i) => edge.points.forEach(([ x, , z ]) => { const d = Math.hypot(x + 17, z + 30); if(d < best) { best = d; start = i } }))
        this.cableCar = {
            body: object.physical.body,
            network, adjacency,
            edge: start, forward: true,
            points: network.edges[start].points.map(p => new THREE.Vector3(...p)),
            index: 0, t: 0,
            speed: 4.2,
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

    updateCableCar()
    {
        const car = this.cableCar
        const delta = Math.min(this.game.ticker.deltaScaled, 0.1)
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
        const body = reference?.userData.object?.physical?.body
        if(!body)
            return
        const t = body.translation(), r = body.rotation()
        const plane = {
            body,
            base: new THREE.Vector3(t.x, t.y, t.z),
            quaternion: new THREE.Quaternion(r.x, r.y, r.z, r.w),
            position: new THREE.Vector3(),
            sway: new THREE.Quaternion(),
            euler: new THREE.Euler(0, 0, 0, 'YXZ'),
            time: 0,
        }
        this.game.world.evaPlane = plane
        this.game.ticker.events.on('tick', () =>
        {
            const delta = this.game.ticker.deltaScaled
            plane.time += delta
            const k = plane.time
            // winter only: it lifts off and floats like Santa's sleigh; the rest of the year it rests still at the gate
            const winter = this.game.environment?.seasonId() === 'winter' ? 1 : 0
            if(plane.lift === undefined)
                plane.lift = winter
            plane.lift += (winter - plane.lift) * Math.min(1, delta * 0.5)
            const f = plane.lift
            // lifted ~1.4 off the apron, bobbing 0.6 up and down over ~7 s, with a gentle roll and pitch
            plane.position.copy(plane.base)
            plane.position.y += (1.4 + Math.sin(k * 0.9) * 0.6) * f
            plane.euler.set(Math.sin(k * 0.9 + 1.2) * 0.025 * f, 0, Math.sin(k * 0.6) * 0.03 * f)
            plane.sway.setFromEuler(plane.euler)
            const q = plane.quaternion.clone().multiply(plane.sway)
            body.setNextKinematicTranslation(plane.position)
            body.setNextKinematicRotation(q)
            plane.current = q
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
                            gameDay.touchdownCall?.(20)
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
