/**
 * Map spread: the world is authored in design units (-96..96) and exported SPREAD times bigger, without making
 * anything bigger. Every site (a stop, a secret place, the turkey, the dog houses...) is an "anchor": a set of
 * boxes and discs that moves out rigidly (translated by (SPREAD - 1) * its center), so nothing inside it changes.
 * Everything between the anchors (land, water, roads, hills, parks, houses, trees) is stretched, as smoothly as
 * possible (a harmonic field, see solveField), to SPREAD at the map's edge. Houses, trees and props keep their size
 * and just move apart; roads get longer but keep their width (the build narrows them before the stretch).
 *
 * forward(x, z): design -> world. inverse(x, z): world -> design (Newton, for resampling the terrain and map).
 * The anchors are computed by scripts/sf/build.mjs and saved in sources/data/spreadAnchors.json.
 */
export const SPREAD = 1.35


/** Convex hull (counter-clockwise) of a list of [x, z] points */
export function convexHull(points)
{
    const pts = points.map(([ x, z ]) => [ x, z ]).sort((a, b) => a[0] - b[0] || a[1] - b[1])
    if(pts.length < 3)
        return pts
    const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
    const lower = [], upper = []
    for(const p of pts)
    {
        while(lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop()
        lower.push(p)
    }
    for(let i = pts.length - 1; i >= 0; i--)
    {
        const p = pts[i]
        while(upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop()
        upper.push(p)
    }
    upper.pop()
    lower.pop()
    return lower.concat(upper)
}

/** Distance from a point to a convex polygon (0 inside) */
export function hullDistance(hull, x, z)
{
    let inside = true, d = Infinity
    for(let i = 0; i < hull.length; i++)
    {
        const [ ax, az ] = hull[i], [ bx, bz ] = hull[(i + 1) % hull.length]
        const ex = bx - ax, ez = bz - az
        if(ex * (z - az) - ez * (x - ax) < 0)
            inside = false
        const t = Math.max(0, Math.min(1, ((x - ax) * ex + (z - az) * ez) / (ex * ex + ez * ez || 1)))
        d = Math.min(d, Math.hypot(x - ax - ex * t, z - az - ez * t))
    }
    return inside ? 0 : d
}

/**
 * The stretch between the anchors: a field u(x, z) on a grid, solved so it's as smooth as possible (Laplace):
 * u = the anchor's center inside each anchor (so it moves rigidly), u = (x, z) on the map's outer edge (stretched by
 * SPREAD), and harmonic in between. The world position is p + (SPREAD - 1) * u(p).
 */
export const GRID = { min: - 106, step: 2, n: 107 }
export function solveField(anchors, grid = GRID)
{
    const { min, step, n } = grid
    const ux = new Float32Array(n * n), uz = new Float32Array(n * n), fixed = new Uint8Array(n * n)
    for(let j = 0; j < n; j++)
        for(let i = 0; i < n; i++)
        {
            const x = min + i * step, z = min + j * step, k = j * n + i
            ux[k] = x
            uz[k] = z
            if(i === 0 || j === 0 || i === n - 1 || j === n - 1)
            {
                fixed[k] = 1
                continue
            }
            // grid points inside an anchor, and around its edge (so every cell touching the edge carries exactly the
            // anchor's translation: no seam between the exact inside and the grid outside); nearest anchor wins
            let best = null, bestDistance = step * 1.5
            for(const a of anchors)
            {
                const d = hullDistance(a.hull, x, z)
                if(d < bestDistance)
                {
                    best = a
                    bestDistance = d
                }
            }
            if(best)
            {
                ux[k] = best.c[0]
                uz[k] = best.c[1]
                fixed[k] = 1
            }
        }
    // successive over-relaxation
    for(let it = 0; it < 6000; it++)
    {
        let change = 0
        for(let j = 1; j < n - 1; j++)
            for(let i = 1; i < n - 1; i++)
            {
                const k = j * n + i
                if(fixed[k])
                    continue
                const tx = (ux[k - 1] + ux[k + 1] + ux[k - n] + ux[k + n]) / 4
                const tz = (uz[k - 1] + uz[k + 1] + uz[k - n] + uz[k + n]) / 4
                const dx = (tx - ux[k]) * 1.9, dz = (tz - uz[k]) * 1.9
                ux[k] += dx
                uz[k] += dz
                change = Math.max(change, Math.abs(dx), Math.abs(dz))
            }
        if(change < 1e-4)
            break
    }
    return { ...grid, ux: Array.from(ux, v => Math.round(v * 1000) / 1000), uz: Array.from(uz, v => Math.round(v * 1000) / 1000) }
}

/**
 * anchors: [{ id, c: [x, z], hull: [[x, z], ...] }], field: from solveField
 */
export function makeWarp(anchors, S = SPREAD, field)
{
    const list = anchors.map((a) =>
    {
        let bx = 0, bz = 0
        a.hull.forEach(([ x, z ]) => { bx += x; bz += z })
        bx /= a.hull.length
        bz /= a.hull.length
        let br = 0
        a.hull.forEach(([ x, z ]) => { br = Math.max(br, Math.hypot(x - bx, z - bz)) })
        return { ...a, bx, bz, br }
    })
    const { min, step, n, ux, uz } = field
    const forward = (x, z) =>
    {
        // inside an anchor: exactly its translation
        for(const a of list)
            if(Math.hypot(x - a.bx, z - a.bz) <= a.br && hullDistance(a.hull, x, z) === 0)
                return [ x + (S - 1) * a.c[0], z + (S - 1) * a.c[1] ]
        const fx = (x - min) / step, fz = (z - min) / step
        if(fx < 0 || fz < 0 || fx > n - 1 || fz > n - 1)
            return [ x * S, z * S ]
        const i = Math.min(n - 2, Math.floor(fx)), j = Math.min(n - 2, Math.floor(fz))
        const tx = fx - i, tz = fz - j, k = j * n + i
        const lerp = (f) => (f[k] * (1 - tx) + f[k + 1] * tx) * (1 - tz) + (f[k + n] * (1 - tx) + f[k + n + 1] * tx) * tz
        return [ x + (S - 1) * lerp(ux), z + (S - 1) * lerp(uz) ]
    }

    const inverse = (qx, qz, guess = null) =>
    {
        let x = guess ? guess[0] : qx / S, z = guess ? guess[1] : qz / S
        const h = 0.01
        for(let it = 0; it < 30; it++)
        {
            const [ fx, fz ] = forward(x, z)
            const ex = fx - qx, ez = fz - qz
            if(Math.abs(ex) + Math.abs(ez) < 1e-5)
                break
            const [ ax, az ] = forward(x + h, z)
            const [ cx, cz ] = forward(x, z + h)
            const j11 = (ax - fx) / h, j21 = (az - fz) / h, j12 = (cx - fx) / h, j22 = (cz - fz) / h
            const det = j11 * j22 - j12 * j21
            let sx, sz
            if(Math.abs(det) < 1e-6)
            {
                sx = ex / S
                sz = ez / S
            }
            else
            {
                sx = (j22 * ex - j12 * ez) / det
                sz = (- j21 * ex + j11 * ez) / det
            }
            const len = Math.hypot(sx, sz)
            if(len > 4)
            {
                sx *= 4 / len
                sz *= 4 / len
            }
            x -= sx
            z -= sz
        }
        return [ x, z ]
    }

    /** The translation a site (by id) moves by: everything belonging to it moves exactly with it */
    const shiftOf = (id) =>
    {
        const a = list.find(a => a.id.split('+').includes(id))
        return a ? [ (S - 1) * a.c[0], (S - 1) * a.c[1] ] : null
    }

    return { S, forward, inverse, shiftOf, anchors: list }
}
