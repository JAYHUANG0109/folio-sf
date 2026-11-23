/**
 * World-scaled copies of the design-unit data, for the game code.
 * (scripts/sf/* keep using the design-unit files directly.)
 */
import { WORLD_SCALE as S } from './world.js'
import { scaleOf, aboutSite } from './sites.js'
import { stops as designStops } from './stops.js'
import { secrets as designSecrets } from './secrets.js'
import { dogs as designDogs, dogSpots as designSpots, turkey as designTurkey } from './dogs.js'

const xz = (p) => p ? { ...p, x: p.x * S, z: p.z * S } : p
const points = (list) => list?.map(([ x, z ]) => [ x * S, z * S ])

const scaleTask = (task) =>
{
    if(!task)
        return task
    const t = { ...task }
    if(t.points) t.points = points(t.points)
    if(t.rink) t.rink = { x: t.rink.x * S, z: t.rink.z * S, halfX: t.rink.halfX * S, halfZ: t.rink.halfZ * S }
    if(t.netX !== undefined) t.netX *= S
    if(t.z !== undefined) t.z *= S
    if(t.halfZ !== undefined) t.halfZ *= S
    return t
}

/** Bigger sites: task spots, respawn and radius move out with the landmark (see sites.js) */
const scaleSite = (place) =>
{
    const k = scaleOf(place.id)
    const about = ([ x, z ]) => aboutSite(place, x, z)
    const task = place.task ? { ...place.task } : undefined
    if(task?.points) task.points = task.points.map(about)
    if(task?.rink)
    {
        const [ x, z ] = about([ task.rink.x, task.rink.z ])
        task.rink = { x, z, halfX: task.rink.halfX * k, halfZ: task.rink.halfZ * k }
    }
    if(task?.netX !== undefined)
    {
        const [ x, z ] = about([ task.netX, task.z ])
        task.netX = x
        task.z = z
        task.halfZ *= k
    }
    const respawn = place.respawn ? (() => { const [ x, z ] = about([ place.respawn.x, place.respawn.z ]); return { ...place.respawn, x, z } })() : undefined
    return { ...place, radius: place.radius * k, respawn, task }
}

const scalePlace = (designPlace) =>
{
    const place = scaleSite(designPlace)
    return {
        ...place,
        position: xz(place.position),
        respawn: place.respawn ? xz(place.respawn) : undefined,
        radius: place.radius * S,
        task: scaleTask(place.task),
    }
}

export const stops = designStops.map(scalePlace)
export const stopsById = Object.fromEntries(stops.map(stop => [ stop.id, stop ]))
export const secrets = designSecrets.map(scalePlace)
export const dogs = designDogs.map(dog => ({ ...dog, home: xz(dog.home) }))
export const dogSpots = Object.fromEntries(Object.entries(designSpots).map(([ k, v ]) => [ k, xz(v) ]))
export const turkey = { ...xz(designTurkey), radius: designTurkey.radius * S }
export const WORLD_SCALE = S
