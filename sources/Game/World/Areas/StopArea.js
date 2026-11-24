import * as THREE from 'three/webgpu'
import { Area } from './Area.js'
import { InteractivePoints } from '../../InteractivePoints.js'
import { StopCard } from './StopCard.js'
import { StopTask } from './StopTask.js'
import { stops } from '../../../data/worldData.js'

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
        if(!reference || !reference.userData.object?.physical)
            return

        const path = (reference.userData.path || []).map(([ x, y, z ]) => new THREE.Vector3(x, y, z))
        if(path.length < 2)
            return

        const lengths = [ 0 ]
        for(let i = 1; i < path.length; i++)
            lengths.push(lengths[i - 1] + path[i].distanceTo(path[i - 1]))

        this.cableCar = {
            body: reference.userData.object.physical.body,
            path,
            lengths,
            total: lengths[lengths.length - 1],
            distance: 0,
            direction: 1,
            speed: 3.6,
            pause: 3,
            pauseTimer: 2,
            position: new THREE.Vector3(),
            quaternion: new THREE.Quaternion(),
            euler: new THREE.Euler(0, 0, 0, 'YXZ'),
        }

        // keep it moving even when the area is off screen
        this.game.ticker.events.on('tick', () => this.updateCableCar(), 10)
    }

    updateCableCar()
    {
        const car = this.cableCar
        const delta = this.game.ticker.deltaScaled

        if(car.pauseTimer > 0)
        {
            car.pauseTimer -= delta
            return
        }

        car.distance += car.direction * car.speed * delta
        if(car.distance >= car.total || car.distance <= 0)
        {
            car.distance = THREE.MathUtils.clamp(car.distance, 0, car.total)
            car.direction *= -1
            car.pauseTimer = car.pause
        }

        // locate segment
        let i = 1
        while(i < car.lengths.length - 1 && car.lengths[i] < car.distance)
            i++
        const a = car.path[i - 1]
        const b = car.path[i]
        const t = (car.distance - car.lengths[i - 1]) / Math.max(0.0001, car.lengths[i] - car.lengths[i - 1])
        car.position.lerpVectors(a, b, t)

        const dz = b.z - a.z
        const dy = b.y - a.y
        car.euler.set(Math.atan2(dy, Math.abs(dz)) * Math.sign(dz) * -1, 0, 0)
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
