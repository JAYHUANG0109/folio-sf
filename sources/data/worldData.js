/**
 * World-scaled copies of the design-unit data, for the game code.
 * (scripts/sf/* keep using the design-unit files directly.)
 */
import { WORLD_SCALE as S } from './world.js'
import { spreadXZ, siteXZ } from './worldWarp.js'
import { scaleOf, aboutSite } from './sites.js'
import { stops as designStops } from './stops.js'
import { secrets as designSecrets } from './secrets.js'
import { dogs as designDogs, dogSpots as designSpots, turkey as designTurkey } from './dogs.js'

// design -> world: the map spread moves every place out (sites rigidly), see spread.js
const xz = (p) => { if(!p) return p; const [ x, z ] = spreadXZ(p.x, p.z); return { ...p, x, z } }
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
    // (the respawn is where the car really appears: scripts/sf/build.mjs places it as authored, no site scale)
    return { ...place, radius: place.radius * k, task }
}

const scalePlace = (designPlace) =>
{
    const place = scaleSite(designPlace)
    // everything belonging to the site moves exactly with it in the map spread
    const own = (p) => { if(!p) return p; const [ x, z ] = siteXZ(place.id, p.x, p.z); return { ...p, x, z } }
    const task = place.task ? { ...place.task } : undefined
    if(task?.points) task.points = task.points.map(([ x, z ]) => siteXZ(place.id, x, z))
    if(task?.rink) task.rink = { ...task.rink, ...own(task.rink) }
    if(task?.netX !== undefined) { const [ x, z ] = siteXZ(place.id, task.netX, task.z); task.netX = x; task.z = z }
    return {
        ...place,
        position: own(place.position),
        respawn: own(place.respawn),
        radius: place.radius * S,
        task,
    }
}

export const stops = designStops.map(scalePlace)
export const stopsById = Object.fromEntries(stops.map(stop => [ stop.id, stop ]))
export const secrets = designSecrets.map(scalePlace)
const ofSite = (id, p) => { const [ x, z ] = siteXZ(id, p.x, p.z); return { ...p, x, z } }
export const dogs = designDogs.map(dog => ({ ...dog, home: ofSite(`home-${dog.id}`, dog.home) }))
// the dogs' favorite spots belong to the sites they're at
const spotSites = { fish: 'pier39', iceCream: 'doloresPark', chinatown: 'chinatown', turkey: 'turkey', tennis: 'tennis', pier39: 'pier39', goldenGate: 'goldenGate' }
export const dogSpots = Object.fromEntries(Object.entries(designSpots).map(([ k, v ]) => [ k, spotSites[k] ? ofSite(spotSites[k], v) : xz(v) ]))
export const turkey = { ...ofSite('turkey', designTurkey), radius: designTurkey.radius * S }
export const WORLD_SCALE = S
