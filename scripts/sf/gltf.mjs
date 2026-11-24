/**
 * Tiny scene graph -> GLB writer on top of gltf-transform.
 * Geometry is authored with three.js primitives in Node, colored through the shared palette texture
 * (static/palette.png, 24 swatches of 4px on a 128px strip). Materials are matched by name in the game
 * (sources/Game/Materials.js getFromName), so the GLB only needs the material name and UVs.
 */
import * as THREE from 'three'
import { Document, NodeIO, VertexLayout } from '@gltf-transform/core'

/** Palette swatches, index -> hex (from static/palette.png row 0) */
export const PALETTE = [
    '#7c7691', '#ebd1a3', '#574e37', '#3dbbe7', '#c8c2c1', '#4a413c', '#575a5e', '#eec3af',
    '#e4a90c', '#91ad78', '#e49a78', '#988165', '#6fae3a', '#a49876', '#b36d45', '#e56202',
    '#ec3f1c', '#fde6e1', '#f8a658', '#c30e3a', '#c366ef', '#ed719f', '#1e0603', '#fff2e8',
    // food colors (beef noodle soup), added in the free slots of the strip
    '#8a4f1e', '#5e2a1c', '#eecb7c', '#78b043', '#3f9a35', '#f1ece4',
    // night lights: window glass and lamp globes (they glow after dark, see Materials palette)
    '#3b3a55', '#f3ead2',
]

/** Named colors for readability */
export const C = {
    lavender: 0, cream: 1, olive: 2, sky: 3, stone: 4, dark: 5, slate: 6, blush: 7,
    gold: 8, sage: 9, salmon: 10, wood: 11, moss: 12, khaki: 13, brick: 14, orange: 15,
    bridge: 16, white: 17, peach: 18, red: 19, purple: 20, pink: 21, black: 22, snow: 23,
    broth: 24, beef: 25, noodle: 26, leaf: 27, scallion: 28, porcelain: 29,
    window: 30, lamp: 31,
    fairy: 63,          // fairy light bulbs: cream by day, twinkling red / green / gold / blue at night
}

let fairyCounter = 0
export function paletteUv(index)
{
    // fairy lights (index 63) share the lamp swatch (31) but sit at one of four spots inside its 4px column:
    // the shader reads that spot as red / green / gold / blue. Plain swatches sample the column center.
    if(index === 63)
    {
        const spot = [ 0.4, 1.2, 2.8, 3.6 ][fairyCounter++ % 4]
        return [ (31 * 4 + spot) / 128, 0.5 ]
    }
    return [ (index * 4 + 2) / 128, 0.5 ]
}

/**
 * Prepare a three geometry for export: flat shaded (non indexed), UVs pointing at a palette swatch.
 */
export function paint(geometry, colorIndex, { flat = true } = {})
{
    let g = geometry.index && flat ? geometry.toNonIndexed() : geometry.clone()
    g.deleteAttribute('uv')
    g.deleteAttribute('uv1')
    if(flat)
        g.computeVertexNormals()
    const [ u, v ] = paletteUv(colorIndex)
    const uvs = new Float32Array(g.attributes.position.count * 2)
    for(let i = 0; i < uvs.length; i += 2)
    {
        uvs[i] = u
        uvs[i + 1] = v
    }
    g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
    return g
}

/**
 * Merge a list of { geometry, color, matrix } parts into one painted geometry.
 */
export function mergeParts(parts)
{
    const painted = parts.map(({ geometry, color, matrix, v }) =>
    {
        const g = paint(geometry, color)
        if(v !== undefined)          // a per-part value carried in uv.y (e.g. each fan's jump phase, see the 'crowd' material)
            for(let i = 1; i < g.attributes.uv.array.length; i += 2)
                g.attributes.uv.array[i] = v
        if(matrix)
            g.applyMatrix4(matrix)
        if(matrix && matrix.determinant() < 0)
            g.computeVertexNormals()
        return g
    })
    let count = 0
    for(const g of painted)
        count += g.attributes.position.count
    const position = new Float32Array(count * 3)
    const normal = new Float32Array(count * 3)
    const uv = new Float32Array(count * 2)
    let offset = 0
    for(const g of painted)
    {
        position.set(g.attributes.position.array, offset * 3)
        normal.set(g.attributes.normal.array, offset * 3)
        uv.set(g.attributes.uv.array, offset * 2)
        offset += g.attributes.position.count
    }
    const merged = new THREE.BufferGeometry()
    merged.setAttribute('position', new THREE.BufferAttribute(position, 3))
    merged.setAttribute('normal', new THREE.BufferAttribute(normal, 3))
    merged.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
    return merged
}

/**
 * Scene description node:
 * { name, position:[x,y,z], rotation:[x,y,z] (euler YXZ), scale:[x,y,z] | number, mesh: { geometry, material }, extras, children: [] }
 */
/**
 * worldScale: uniform scale applied to the whole scene at export (positions, meshes, collider sizes,
 * reference radii and extras.path). Authoring stays in design units.
 */
export async function writeGlb(path, rootNodes, { worldScale = 1 } = {})
{
    const doc = new Document()
    const buffer = doc.createBuffer()
    const scene = doc.createScene('Scene')
    const materials = new Map()

    const getMaterial = (name, hex = null) =>
    {
        if(!materials.has(name))
        {
            const material = doc.createMaterial(name).setDoubleSided(false)
            if(hex)
            {
                // three's Color converts the sRGB hex to linear, which is what glTF stores
                const c = new THREE.Color(hex)
                material.setBaseColorFactor([ c.r, c.g, c.b, 1 ]).setRoughnessFactor(1).setMetallicFactor(0)
            }
            materials.set(name, material)
        }
        return materials.get(name)
    }

    const accessor = (array, type) => doc.createAccessor().setArray(array).setType(type).setBuffer(buffer)

    // Unique names the Blender way (name, name.001, ...). three's GLTFLoader would otherwise
    // rename duplicates to name_1, which breaks the ref<Name><digits> convention in References.js
    const usedNames = new Map()
    const uniqueName = (name) =>
    {
        if(!name)
            return ''
        const count = usedNames.get(name) || 0
        usedNames.set(name, count + 1)
        return count === 0 ? name : `${name}.${String(count).padStart(3, '0')}`
    }

    const build = (desc) =>
    {
        const node = doc.createNode(uniqueName(desc.name))
        if(desc.position)
            node.setTranslation(desc.position.map(v => Number(v) * worldScale))
        if(desc.rotation)
        {
            const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(desc.rotation[0], desc.rotation[1], desc.rotation[2], 'YXZ'))
            node.setRotation([ q.x, q.y, q.z, q.w ])
        }
        if(desc.quaternion)
            node.setRotation(desc.quaternion)
        if(desc.scale !== undefined)
        {
            const scale = typeof desc.scale === 'number' ? [ desc.scale, desc.scale, desc.scale ] : desc.scale
            // meshes get scaled in their vertices; empty nodes (colliders, zones) carry the size in their scale
            node.setScale(desc.mesh ? scale : scale.map(v => v * worldScale))
        }
        if(desc.extras)
            node.setExtras(desc.extras.path ? { ...desc.extras, path: desc.extras.path.map(p => p.map(v => v * worldScale)) } : desc.extras)
        if(desc.mesh)
        {
            let g = desc.mesh.geometry
            if(worldScale !== 1)
            {
                g = g.clone()
                g.scale(worldScale, worldScale, worldScale)
            }
            const prim = doc.createPrimitive()
                .setAttribute('POSITION', accessor(new Float32Array(g.attributes.position.array), 'VEC3'))
            if(g.attributes.normal)
                prim.setAttribute('NORMAL', accessor(new Float32Array(g.attributes.normal.array), 'VEC3'))
            if(g.attributes.uv)
                prim.setAttribute('TEXCOORD_0', accessor(new Float32Array(g.attributes.uv.array), 'VEC2'))
            if(g.index)
                prim.setIndices(accessor(new Uint32Array(g.index.array), 'SCALAR'))
            prim.setMaterial(getMaterial(desc.mesh.material || 'palette', desc.mesh.color || null))
            node.setMesh(doc.createMesh(desc.name || '').addPrimitive(prim))
        }
        for(const child of desc.children || [])
            node.addChild(build(child))
        return node
    }

    for(const desc of rootNodes)
        scene.addChild(build(desc))

    await new NodeIO().setVertexLayout(VertexLayout.SEPARATE).write(path, doc)
}

/** A collider-only unit cube child (Objects.js reads its scale as full extents) */
export function cuboid(name, position, size, rotation = null)
{
    // geometry so three keeps it as a Mesh, Objects.js removes it from the visual
    return { name, position, scale: size, rotation: rotation || undefined }
}
