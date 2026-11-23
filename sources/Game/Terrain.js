import * as THREE from 'three/webgpu'
import { Game } from './Game.js'
import { WORLD_SCALE } from '../data/world.js'
import MeshGridMaterial, { MeshGridMaterialLine } from './Materials/MeshGridMaterial.js'
import { abs, color, float, Fn, max, mix, round, smoothstep, texture, uniform, uv, vec2, vec3 } from 'three/tsl'

export class Terrain
{
    constructor()
    {
        this.game = Game.getInstance()

        this.subdivision = 128
        this.size = 192 * WORLD_SCALE // must match scripts/sf/layout.mjs WORLD_SIZE
        this.maxHeight = 10 * WORLD_SCALE // must match scripts/sf/layout.mjs MAX_HEIGHT

        if(this.game.debug.active)
        {
            this.debugPanel = this.game.debug.panel.addFolder({
                title: '🏔️ Terrain Data',
                expanded: false,
            })
        }

        this.setGradient()
        this.setHeightSampler()
        this.setNodes()

        this.game.ticker.events.on('tick', () =>
        {
            this.update()
        }, 10)
    }

    setGradient()
    {
        const height = 16

        const canvas = document.createElement('canvas')
        canvas.width = 1
        canvas.height = height

        this.gradientTexture = new THREE.Texture(canvas)
        this.gradientTexture.colorSpace = THREE.SRGBColorSpace

        const context = canvas.getContext('2d')

        // SF: green land, a thin sandy beach, then the bay
        this.colors = [
            { stop: 0.02, value: '#7dbb4a' },
            { stop: 0.1, value: '#f3cf8f' },
            { stop: 0.3, value: '#5bc2b9' },
            { stop: 0.9, value: '#13375f' },
        ]

        const update = () =>
        {
            const gradient = context.createLinearGradient(0, 0, 0, height)
            for(const color of this.colors)
                gradient.addColorStop(color.stop, color.value)

            context.fillStyle = gradient
            context.fillRect(0, 0, 1, height)
            this.gradientTexture.needsUpdate = true
        }

        update()

        // // Debug
        // canvas.style.position = 'fixed'
        // canvas.style.zIndex = 999
        // canvas.style.top = 0
        // canvas.style.left = 0
        // canvas.style.width = '128px'
        // canvas.style.height = `256px`
        // document.body.append(canvas)
        
        if(this.game.debug.active)
        {
            for(const color of this.colors)
            {
                this.debugPanel.addBinding(color, 'stop', { min: 0, max: 1, step: 0.001 }).on('change', update)
                this.debugPanel.addBinding(color, 'value', { view: 'color' }).on('change', update)
            }
        }
    }

    setNodes()
    {
        this.grassColorUniform = uniform(color('#8cc63f'))
        this.tracksDelta = uniform(vec2(0))

        const worldPositionToUvNode = Fn(([position]) =>
        {
            return position.div(this.size).add(0.5)
        })

        this.worldPositionToUvNode = worldPositionToUvNode

        // 1 inside the map, 0 beyond its edge (out there it is open sea, like the physics: textures would only clamp their edge pixels)
        const insideNode = Fn(([textureUv]) =>
        {
            const edge = max(abs(textureUv.x.sub(0.5)), abs(textureUv.y.sub(0.5)))
            return float(1).sub(smoothstep(0.496, 0.5, edge))
        })
        this.insideNode = insideNode

        // Hills (world units), from the height texture
        this.heightNode = Fn(([position]) =>
        {
            const textureUv = worldPositionToUvNode(position)
            return texture(this.game.resources.terrainHeightTexture, textureUv).r.mul(this.maxHeight).mul(insideNode(textureUv))
        })

        // Approximate ground normal from height texture
        const normalStep = this.size / 512
        this.normalNode = Fn(([position]) =>
        {
            const hL = this.heightNode(position.sub(vec2(normalStep, 0)))
            const hR = this.heightNode(position.add(vec2(normalStep, 0)))
            const hD = this.heightNode(position.sub(vec2(0, normalStep)))
            const hU = this.heightNode(position.add(vec2(0, normalStep)))
            return vec3(hL.sub(hR), normalStep * 2, hD.sub(hU)).normalize()
        })

        this.terrainNode = Fn(([position]) =>
        {
            const textureUv = worldPositionToUvNode(position)
            const data = texture(this.game.resources.terrainTexture, textureUv)

            // Wheel tracks
            const groundDataColor = texture(
                this.game.tracks.renderTarget.texture,
                position.sub(- this.game.tracks.halfSize).sub(this.tracksDelta).div(this.game.tracks.size)
            )
            data.g.mulAssign(groundDataColor.r.oneMinus())

            // beyond the map edge: deep water, no paving, no grass
            const inside = insideNode(textureUv)
            data.r.mulAssign(inside)
            data.g.mulAssign(inside)
            data.b.assign(mix(1, data.b, inside))

            return data
        })
        
        this.colorNode = Fn(([terrainData]) =>
        {
            // Dirt and water
            const baseColor = texture(this.gradientTexture, vec2(0, terrainData.b.oneMinus()))

            // Grass
            baseColor.assign(mix(baseColor, this.grassColorUniform, terrainData.g))

            return baseColor.rgb
        })

        if(this.game.debug.active)
        {
            this.game.debug.addThreeColorBinding(this.debugPanel, this.grassColorUniform.value, 'grassColor')
        }
    }
    
    setHeightSampler()
    {
        // CPU copy of the height and depth textures, to place things on the ground at runtime
        const read = (resource) =>
        {
            const image = resource.image
            const canvas = document.createElement('canvas')
            canvas.width = image.width
            canvas.height = image.height
            const context = canvas.getContext('2d', { willReadFrequently: true })
            context.drawImage(image, 0, 0)
            return { width: image.width, height: image.height, data: context.getImageData(0, 0, image.width, image.height).data }
        }

        let heightData = null
        let maskData = null
        try
        {
            heightData = read(this.game.resources.terrainHeightTexture)
            maskData = read(this.game.resources.terrainTexture)
        }
        catch(error)
        {
            console.warn('Terrain: could not read height data', error)
        }

        const sampleChannel = (data, channel, x, z) =>
        {
            const fx = (x / this.size + 0.5) * data.width - 0.5
            const fz = (z / this.size + 0.5) * data.height - 0.5
            const x0 = Math.max(0, Math.min(data.width - 1, Math.floor(fx)))
            const z0 = Math.max(0, Math.min(data.height - 1, Math.floor(fz)))
            const x1 = Math.min(data.width - 1, x0 + 1)
            const z1 = Math.min(data.height - 1, z0 + 1)
            const tx = Math.max(0, Math.min(1, fx - x0))
            const tz = Math.max(0, Math.min(1, fz - z0))
            const get = (px, pz) => data.data[(pz * data.width + px) * 4 + channel] / 255
            const a = get(x0, z0) * (1 - tx) + get(x1, z0) * tx
            const b = get(x0, z1) * (1 - tx) + get(x1, z1) * tx
            return a * (1 - tz) + b * tz
        }

        // beyond the map edge there is only sea
        const outside = (x, z) => Math.abs(x) > this.size / 2 || Math.abs(z) > this.size / 2

        /** Hill height at world x/z */
        this.getHeight = (x, z) => heightData && !outside(x, z) ? sampleChannel(heightData, 0, x, z) * this.maxHeight : 0

        /** Mask channels at world x/z: paving (streets, plazas), grass, depth (water) */
        this.getMask = (x, z) => outside(x, z)
            ? { paving: 0, grass: 0, depth: 1 }
            : maskData
                ? { paving: sampleChannel(maskData, 0, x, z), grass: sampleChannel(maskData, 1, x, z), depth: sampleChannel(maskData, 2, x, z) }
                : { paving: 0, grass: 1, depth: 0 }

        /** Elevation the vehicle drives on (hills minus water depth) */
        this.getGroundElevation = (x, z) => outside(x, z) ? - 1.5 : this.getHeight(x, z) - (maskData ? sampleChannel(maskData, 2, x, z) * 1.5 : 0)
    }

    update()
    {
        // Tracks delta
        this.tracksDelta.value.set(
            this.game.tracks.focusPoint.x,
            this.game.tracks.focusPoint.y
        )
    }
}