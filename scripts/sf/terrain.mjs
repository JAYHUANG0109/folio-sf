/**
 * Terrain rasterization.
 * Produces float rasters (0..1 masks + height in world units) at RES x RES covering -96..96.
 * Image row 0 = z -96 (north), column 0 = x -96 (west).
 */
import sharp from 'sharp'
import * as L from './layout.mjs'

export const RES = 512
const PX = RES / L.SIZE // pixels per world unit

const toPx = ([x, z]) => [ (x + L.HALF) * PX, (z + L.HALF) * PX ]

function shapeSvg(shape, fill = '#fff')
{
    if(Array.isArray(shape))
        return `<polygon points="${shape.map(p => toPx(p).join(',')).join(' ')}" fill="${fill}"/>`
    if(shape.ellipse)
    {
        const [ x, z, rx, rz ] = shape.ellipse
        const [ cx, cy ] = toPx([ x, z ])
        return `<ellipse cx="${cx}" cy="${cy}" rx="${rx * PX}" ry="${rz * PX}" fill="${fill}"/>`
    }
    if(shape.rect)
    {
        const [ x0, z0, x1, z1 ] = shape.rect
        const [ px0, pz0 ] = toPx([ x0, z0 ])
        return `<rect x="${px0}" y="${pz0}" width="${(x1 - x0) * PX}" height="${(z1 - z0) * PX}" rx="${2 * PX}" fill="${fill}"/>`
    }
    throw new Error('Unknown shape')
}

function lineSvg(points, width, stroke = '#fff')
{
    return `<polyline points="${points.map(p => toPx(p).join(',')).join(' ')}" fill="none" stroke="${stroke}" stroke-width="${width * PX}" stroke-linecap="round" stroke-linejoin="round"/>`
}

/**
 * Lombard crooked block centerline, densely sampled: Hyde St -> 8 hairpins -> Grant Ave.
 */
export function lombardPoints(step = 0.35)
{
    const { hydeX, firstLegX, hairpins, spacing, north, south } = L.lombard
    const r = spacing / 2
    const points = []
    const line = (ax, az, bx, bz) =>
    {
        const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / step))
        for(let i = points.length ? 1 : 0; i <= n; i++)
            points.push([ ax + (bx - ax) * i / n, az + (bz - az) * i / n ])
    }
    const arc = (cx, cz, from, to) =>
    {
        const n = Math.max(2, Math.ceil(Math.abs(to - from) * r / step))
        for(let i = 1; i <= n; i++)
        {
            const a = from + (to - from) * i / n
            points.push([ cx + r * Math.cos(a), cz + r * Math.sin(a) ])
        }
    }

    // from Hyde, east along the top, then a quarter turn down into the first leg
    line(hydeX, north - r, firstLegX - r, north - r)
    arc(firstLegX - r, north, - Math.PI / 2, 0)
    for(let i = 0; i <= hairpins; i++)
    {
        const x = firstLegX + i * spacing
        const goingSouth = i % 2 === 0
        line(x, goingSouth ? north : south, x, goingSouth ? south : north)
        if(i < hairpins)
            arc(x + r, goingSouth ? south : north, Math.PI, goingSouth ? 0 : Math.PI * 2)
    }
    // last leg ends going south: quarter turn east onto Grant Ave
    const lastX = firstLegX + hairpins * spacing
    arc(lastX + r, south, Math.PI, Math.PI / 2)
    line(lastX + r, south + r, lastX + r + 1.6, south + r)
    return points
}

/** Apex of every hairpin (in driving order) plus the bottom exit, for the checkpoints task */
export function lombardApexes()
{
    const { firstLegX, hairpins, spacing, north, south } = L.lombard
    const r = spacing / 2
    const apexes = []
    for(let k = 0; k < hairpins; k++)
        apexes.push([ firstLegX + k * spacing + r, k % 2 === 0 ? south + r : north - r ])
    apexes.push([ firstLegX + hairpins * spacing + r + 1, south + r ])
    return apexes
}

/** Ground height of the crooked block: a straight ramp from Hyde (top) to Grant (bottom), and its weight */
export function lombardRamp(x, z)
{
    const { hydeX, firstLegX, hairpins, spacing, north, south, lane, top, bottom } = L.lombard
    const r = spacing / 2
    const x0 = hydeX + 1, x1 = firstLegX + hairpins * spacing + r
    const t = Math.min(1, Math.max(0, (x - x0) / (x1 - x0)))
    const height = top + (bottom - top) * t
    const z0 = north - r - lane / 2 - 0.6, z1 = south + r + lane / 2 + 2
    const dx = Math.max(hydeX - 3 - x, x - (x1 + 2), 0)
    // north of the block Hyde St runs down to the bay: long linear falloff so the car can climb it
    const dzNorth = Math.max(z0 - z, 0) * 6 / 9.5
    const dz = Math.max(dzNorth, z - z1, 0)
    const d = Math.hypot(dx, dz)
    const weight = dzNorth > 0 && dx === 0 ? 1 - Math.min(1, d / 6) : 1 - smoothstep(0, 6, d)
    return { height, weight }
}

async function rasterize(body, blur, background = '#000')
{
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${RES}" height="${RES}"><rect width="100%" height="100%" fill="${background}"/>${body}</svg>`
    let image = sharp(Buffer.from(svg)).greyscale()
    if(blur > 0)
        image = image.blur(blur)
    const { data } = await image.raw().toBuffer({ resolveWithObject: true })
    // greyscale raw may still come with 1 channel
    const out = new Float32Array(RES * RES)
    const channels = data.length / (RES * RES)
    for(let i = 0; i < RES * RES; i++)
        out[i] = data[i * channels] / 255
    return out
}

export function analyticHeight(x, z)
{
    let h = 0
    for(const [ hx, hz, height, sigma ] of L.hills)
    {
        const d2 = (x - hx) ** 2 + (z - hz) ** 2
        h += height * Math.exp(- d2 / (2 * sigma * sigma))
    }

    for(const [ px, pz, inner, outer, target ] of L.pads)
    {
        const d = Math.hypot(x - px, z - pz)
        if(d >= outer)
            continue
        const t = d <= inner ? 1 : 1 - smoothstep(inner, outer, d)
        let goal = target
        if(goal === null)
        {
            goal = 0
            for(const [ hx, hz, height, sigma ] of L.hills)
                goal += height * Math.exp(- ((px - hx) ** 2 + (pz - hz) ** 2) / (2 * sigma * sigma))
        }
        h = h + (goal - h) * t
    }

    const ramp = lombardRamp(x, z)
    if(ramp.weight > 0)
        h = h + (ramp.height - h) * ramp.weight
    return h
}

export function smoothstep(a, b, x)
{
    const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)
}

export async function buildRasters()
{
    // Water depth (B): 1 = deep water, 0 = land
    const landBody =
        shapeSvg(L.land.city, '#000') +
        shapeSvg(L.land.marin, '#000') +
        shapeSvg(L.land.alcatraz, '#000') +
        L.ponds.map(p => { const v = Math.round((p.depth ?? 1) * 255); return shapeSvg(p, `rgb(${v},${v},${v})`) }).join('') +
        L.sandbars.map(s => lineSvg(s.points, s.width, `rgb(${Math.round(s.depth * 255)},${Math.round(s.depth * 255)},${Math.round(s.depth * 255)})`)).join('')
    const depth = await rasterize(landBody, 3.2, '#fff')

    // Paving (R)
    const pavingBody =
        L.streets.map(s => lineSvg(s.points, s.width)).join('') +
        lineSvg(lombardPoints(), L.lombard.lane + 0.6) +
        L.plazas.map(p => shapeSvg(p)).join('')
    const paving = await rasterize(pavingBody, 1.6)
    // without the streets: the build paints those again straight in the spread world (so they keep their width)
    const pavingBase = await rasterize(lineSvg(lombardPoints(), L.lombard.lane + 0.6) + L.plazas.map(p => shapeSvg(p)).join(''), 1.6)

    // Grass (G)
    const grassBody = L.parks.map(p => shapeSvg(p)).join('')
    const grassRaw = await rasterize(grassBody, 4)
    const grass = new Float32Array(RES * RES)
    for(let i = 0; i < grass.length; i++)
        grass[i] = Math.max(0, Math.max(grassRaw[i] * 0.78, 0.5) - paving[i] * 1.2 - depth[i] * 3)

    // Height (world units)
    const height = new Float32Array(RES * RES)
    for(let row = 0; row < RES; row++)
    {
        for(let col = 0; col < RES; col++)
        {
            const x = (col + 0.5) / PX - L.HALF
            const z = (row + 0.5) / PX - L.HALF
            const i = row * RES + col
            const landFactor = 1 - smoothstep(0.05, 0.6, depth[i])
            height[i] = analyticHeight(x, z) * L.W * landFactor // world units
        }
    }

    return { depth, paving, grass, height, parks: grassRaw, pavingBase }
}

/** Bilinear sample of a raster at world position */
export function sample(raster, x, z)
{
    const fx = (x + L.HALF) * PX - 0.5
    const fz = (z + L.HALF) * PX - 0.5
    const x0 = Math.max(0, Math.min(RES - 1, Math.floor(fx)))
    const z0 = Math.max(0, Math.min(RES - 1, Math.floor(fz)))
    const x1 = Math.min(RES - 1, x0 + 1)
    const z1 = Math.min(RES - 1, z0 + 1)
    const tx = Math.max(0, Math.min(1, fx - x0))
    const tz = Math.max(0, Math.min(1, fz - z0))
    const a = raster[z0 * RES + x0] * (1 - tx) + raster[z0 * RES + x1] * tx
    const b = raster[z1 * RES + x0] * (1 - tx) + raster[z1 * RES + x1] * tx
    return a * (1 - tz) + b * tz
}

/** Quantize like the 8 bit textures the game will read */
export function quantize(rasters)
{
    const q = (v) => Math.round(Math.min(1, Math.max(0, v)) * 255) / 255
    const out = {}
    for(const key of [ 'depth', 'paving', 'grass', 'parks' ])
        out[key] = rasters[key].map(q)
    out.height = rasters.height.map(v => q(v / L.MAX_HEIGHT) * L.MAX_HEIGHT)
    return out
}

/** Ground elevation the car actually drives on */
export function groundY(rasters, x, z)
{
    return sample(rasters.height, x, z) - sample(rasters.depth, x, z) * 1.5
}

export async function writeTerrainTextures(rasters, maskPath, heightPath, res = RES)
{
    const rgba = Buffer.alloc(res * res * 4)
    const h = Buffer.alloc(res * res)
    for(let i = 0; i < res * res; i++)
    {
        rgba[i * 4 + 0] = Math.round(rasters.paving[i] * 255)
        rgba[i * 4 + 1] = Math.round(rasters.grass[i] * 255)
        rgba[i * 4 + 2] = Math.round(rasters.depth[i] * 255)
        rgba[i * 4 + 3] = 255
        h[i] = Math.round(Math.min(1, rasters.height[i] / L.MAX_HEIGHT) * 255)
    }
    await sharp(rgba, { raw: { width: res, height: res, channels: 4 } }).png().toFile(maskPath)
    await sharp(h, { raw: { width: res, height: res, channels: 1 } }).png().toFile(heightPath)
}
