/**
 * Modeling kit: small helpers to author low poly palette models with three.js in Node.
 */
import * as THREE from 'three'
import { mergeParts, C } from './gltf.mjs'

export { C }

const euler = (r) => new THREE.Euler(r?.[0] || 0, r?.[1] || 0, r?.[2] || 0, 'YXZ')

export function matrix(position = [0, 0, 0], rotation = [0, 0, 0], scale = [1, 1, 1])
{
    const m = new THREE.Matrix4()
    m.compose(
        new THREE.Vector3(...position),
        new THREE.Quaternion().setFromEuler(euler(rotation)),
        typeof scale === 'number' ? new THREE.Vector3(scale, scale, scale) : new THREE.Vector3(...scale)
    )
    return m
}

/**
 * A model is a list of parts; parts share one merged mesh.
 */
export class Model
{
    constructor()
    {
        this.parts = []
    }

    add(geometry, color, position, rotation, scale)
    {
        this.parts.push({ geometry, color, matrix: matrix(position, rotation, scale) })
        return this
    }

    /** box with its base at position y */
    box(size, color, position = [0, 0, 0], rotation)
    {
        const [ w, h, d ] = size
        const g = new THREE.BoxGeometry(w, h, d)
        g.translate(0, h / 2, 0)
        return this.add(g, color, position, rotation)
    }

    /** centered box */
    cbox(size, color, position = [0, 0, 0], rotation)
    {
        return this.add(new THREE.BoxGeometry(...size), color, position, rotation)
    }

    cylinder(radiusTop, radiusBottom, height, color, position = [0, 0, 0], segments = 8, rotation)
    {
        const g = new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments)
        g.translate(0, height / 2, 0)
        return this.add(g, color, position, rotation)
    }

    cone(radius, height, color, position = [0, 0, 0], segments = 8, rotation)
    {
        const g = new THREE.ConeGeometry(radius, height, segments)
        g.translate(0, height / 2, 0)
        return this.add(g, color, position, rotation)
    }

    sphere(radius, color, position = [0, 0, 0], detail = 1, scale)
    {
        return this.add(new THREE.IcosahedronGeometry(radius, detail), color, position, undefined, scale)
    }

    dome(radius, color, position = [0, 0, 0], segments = 10)
    {
        const g = new THREE.SphereGeometry(radius, segments, Math.ceil(segments / 2), 0, Math.PI * 2, 0, Math.PI / 2)
        return this.add(g, color, position)
    }

    /** triangular prism roof, ridge along x */
    gable(width, depth, height, color, position = [0, 0, 0], rotation)
    {
        const shape = new THREE.Shape()
        shape.moveTo(- depth / 2, 0)
        shape.lineTo(depth / 2, 0)
        shape.lineTo(0, height)
        shape.closePath()
        const g = new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: false })
        g.translate(0, 0, - width / 2)
        g.rotateY(Math.PI / 2)
        return this.add(g, color, position, rotation)
    }

    /** a thin box between two points (cables, rails) */
    beam(a, b, thickness, color)
    {
        const va = new THREE.Vector3(...a)
        const vb = new THREE.Vector3(...b)
        const length = va.distanceTo(vb)
        const g = new THREE.BoxGeometry(thickness, thickness, length)
        const m = new THREE.Matrix4().lookAt(va, vb, new THREE.Vector3(0, 1, 0))
        const mid = va.clone().add(vb).multiplyScalar(0.5)
        m.setPosition(mid)
        // lookAt points -z toward target, box is symmetric so fine
        this.parts.push({ geometry: g, color, matrix: m })
        return this
    }

    /** merge another model in, with a transform */
    merge(model, position = [0, 0, 0], rotation = [0, 0, 0], scale = 1)
    {
        const m = matrix(position, rotation, scale)
        for(const part of model.parts)
            this.parts.push({ ...part, matrix: m.clone().multiply(part.matrix) })
        return this
    }

    get empty()
    {
        return this.parts.length === 0
    }

    geometry()
    {
        return mergeParts(this.parts)
    }
}

/**
 * Scene node helpers
 */
export function meshNode(name, model, position = [0, 0, 0], extra = {})
{
    return { name, position, mesh: { geometry: model.geometry(), material: extra.material || 'palette' }, ...extra }
}

/** Fixed physical object: visual model + cuboid colliders [{ position, size, rotation }] */
export function fixedNode(name, model, position, colliders, extras)
{
    return {
        name: `${name}PhysicalFixed`,
        position,
        mesh: model ? { geometry: model.geometry(), material: 'palette' } : undefined,
        extras,
        children: colliders.map((c, i) => colliderNode(c, i)),
    }
}

export function dynamicNode(name, model, position, colliders, mass = 1, rotation)
{
    return {
        name: `${name}PhysicalDynamic`,
        position,
        rotation,
        mesh: { geometry: model.geometry(), material: 'palette' },
        extras: { mass },
        children: colliders.map((c, i) => colliderNode(c, i)),
    }
}

export function kinematicNode(name, model, position, colliders, extras)
{
    return {
        name: `${name}PhysicalKinematicPositionBased`,
        position,
        mesh: { geometry: model.geometry(), material: 'palette' },
        extras,
        children: colliders.map((c, i) => colliderNode(c, i)),
    }
}

function colliderNode(c, i)
{
    const shape = c.shape || 'cuboid'
    const node = { name: `${shape}.${String(i).padStart(3, '0')}`, position: c.position || [0, 0, 0], rotation: c.rotation }
    if(shape === 'cuboid')
        node.scale = c.size
    else if(shape === 'ball')
        node.scale = [ c.radius * 2, c.radius * 2, c.radius * 2 ]
    else if(shape === 'tube')
        node.scale = [ c.radius * 2, c.height, c.radius * 2 ]
    if(c.friction !== undefined || c.restitution !== undefined)
        node.extras = { friction: c.friction, restitution: c.restitution }
    return node
}

/** Empty reference node */
export function refNode(name, position, extras, scale)
{
    return { name: `ref${name}`, position, extras, scale }
}

/** Deterministic random */
export function rng(seed = 1)
{
    let s = seed >>> 0
    return () =>
    {
        s = (s + 0x6D2B79F5) >>> 0
        let t = s
        t = Math.imul(t ^ (t >>> 15), t | 1)
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
}
