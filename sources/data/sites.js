/**
 * How much bigger each stop's landmark is drawn (around the stop's position).
 * Random houses, trees and props stay their normal size.
 */
export const siteScale = {
    default: 1.5,
    mira: 1,               // modelled at world size (a slim tower in a tight spot between Market St and the Embarcadero)
    goldenGate: 1,         // the bridge spans the strait, already big
    palaceOfFineArts: 1,   // modelled at 1.5x directly
    lombard: 1,            // the zigzag is painted into the terrain
    levis: 1.25,           // fits the peninsula
    tennis: 1.85,          // a bit smaller, to fit Alamo Square park next to it
    napa: 2.2,             // castle, vineyard and lights at ~2x (fits west of the bridge)
    muirWoods: 1.2,
    unionSquare: 1.2,      // a little smaller so it never touches Chinatown or Dolores Park
    alcatraz: 2.25,        // the cellhouse 1.5x bigger than the other sites, on a 2x island
}

export const scaleOf = (id) => siteScale[id] ?? siteScale.default

/** Move a design point away from a site center by the site scale */
export const aboutSite = (site, x, z) =>
{
    const s = scaleOf(site.id)
    return [ site.position.x + (x - site.position.x) * s, site.position.z + (z - site.position.z) * s ]
}
