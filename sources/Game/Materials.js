import * as THREE from 'three/webgpu'
import { positionLocal, varying, uv, max, positionWorld, float, Fn, uniform, color, mix, vec3, vec4, normalWorld, texture, vec2, time, smoothstep, luminance } from 'three/tsl'
import { Game } from './Game.js'
import gsap from 'gsap'
import { MeshDefaultMaterial } from './Materials/MeshDefaultMaterial.js'

export class Materials
{
    constructor()
    {
        this.game = Game.getInstance()
        this.list = new Map()

        if(this.game.debug.active)
        {
            this.debugPanel = this.game.debug.panel.addFolder({
                title: '🎨 Materials',
                expanded: false,
            })
        }

        this.setGradient()
        this.setLuminance()
        // this.setPreviews()

        this.createPalette()

        this.createEmissiveGradient('emissiveOrangeRadialGradient', '#ff8641', '#ff3e00', 1.7, true, this.debugPanel?.addFolder({ title: 'emissiveOrangeRadialGradient' }))
        this.createEmissiveGradient('emissivePurpleRadialGradient', '#454bbc', '#ff2eb4', 1.7, true, this.debugPanel?.addFolder({ title: 'emissivePurpleRadialGradient' }))
        this.createEmissiveGradient('emissiveBlueRadialGradient', '#91f0ff', '#128fff', 1.7, true, this.debugPanel?.addFolder({ title: 'emissiveBlueRadialGradient' }))
        this.createEmissiveGradient('emissiveGreenRadialGradient', '#f8ffa6', '#74ff00', 1.5, true, this.debugPanel?.addFolder({ title: 'emissiveGreenRadialGradient' }))
        this.createEmissiveGradient('emissiveWhiteRadialGradient', '#ffffff', '#666666', 2.7, false, this.debugPanel?.addFolder({ title: 'emissiveWhiteRadialGradient' }))
        
        this.createGradient('redGradient', '#ff3a3a', '#721551', this.debugPanel?.addFolder({ title: 'redGradient' }))

        this.createAuras()
    }

    /** Soft additive glows (Napa castle aura): a ground halo fading from the center, and vertical light beams fading upward */
    createAuras()
    {
        const pulse = time.mul(1.4).sin().mul(0.15).add(0.85)

        const halo = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })
        const haloStrength = float(1).sub(uv().sub(0.5).length().mul(2)).clamp(0, 1).pow(1.6)
        halo.outputNode = vec4(color('#ffd27a').mul(haloStrength.mul(pulse).mul(0.9)), 1)
        halo.fog = false
        this.save('auraHalo', halo)

        const beam = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })
        const beamStrength = float(1).sub(uv().y).clamp(0, 1).pow(1.5)
        beam.outputNode = vec4(color('#ffe4a8').mul(beamStrength.mul(pulse).mul(0.55)), 1)
        beam.fog = false
        this.save('auraBeam', beam)
    }

    createPalette()
    {
        // night: 0 by day, 1 at night (tweened in update below). Window glass and lamp globes light up.
        this.nightUniform = uniform(0)
        const slot = uv().x.mul(32).floor()
        // fairy lights: each bulb picks a color from its position and twinkles
        const bulbHash = positionWorld.x.mul(12.9898).add(positionWorld.z.mul(78.233)).add(positionWorld.y.mul(37.719)).sin().mul(43758.5453).fract()
        const fairyColor = bulbHash.lessThan(0.25).select(color('#ff3040'), bulbHash.lessThan(0.5).select(color('#38ff6a'), bulbHash.lessThan(0.75).select(color('#ffd24a'), color('#5ab0ff'))))
        const twinkle = time.mul(2.2).add(bulbHash.mul(30)).sin().mul(0.35).add(0.85)
        const fairy = uv().y.lessThan(0.3).and(slot.equal(31))
        const glow = fairy.select(fairyColor.mul(3.2).mul(twinkle), slot.equal(30).select(color('#ffcf7a').mul(1.45), slot.equal(31).select(color('#fff1c4').mul(2.4), vec3(0))))
        const material = new MeshDefaultMaterial({
            colorNode: texture(this.game.resources.paletteTexture).rgb,
            emissiveNode: glow.mul(this.nightUniform)
        })
        const toggle = (night) => gsap.to(this.nightUniform, { value: night ? 1 : 0, duration: 3, overwrite: true })
        this.game.dayCycles.events.on('night', toggle)
        toggle(this.game.dayCycles.intervalEvents.get('night').inInterval)

        // warm pools of light on the ground under the street lamps
        const pool = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })
        const fall = float(1).sub(uv().sub(0.5).length().mul(2)).clamp(0, 1).pow(1.8)
        pool.outputNode = vec4(color('#ffb85c').mul(fall.mul(0.75).mul(this.nightUniform)), 1)
        pool.fog = false
        this.save('lampPool', pool)
        
        this.save('palette', material)

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

        const colors = [
            { stop: 0, value: '#ffb646' },
            { stop: 0.5, value: '#ff347e' },
            { stop: 1, value: '#01005f' },
        ]

        const update = () =>
        {
            const gradient = context.createLinearGradient(0, 0, 0, height)
            for(const color of colors)
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
            const debugPanel = this.debugPanel.addFolder({ title: 'gradient' })

            for(const color of colors)
            {
                debugPanel.addBinding(color, 'stop', { min: 0, max: 1, step: 0.001 }).on('change', update)
                debugPanel.addBinding(color, 'value', { view: 'color' }).on('change', update)
            }
        }
    }


    setLuminance()
    {
        this.luminance = {}
        this.luminance.coefficients = new THREE.Vector3()
        THREE.ColorManagement.getLuminanceCoefficients(this.luminance.coefficients)

        this.luminance.get = (color) =>
        {
            return color.r * this.luminance.coefficients.x + color.g * this.luminance.coefficients.y + color.b * this.luminance.coefficients.z
        }
    }

    // Create materials functions
    createEmissive(_name = 'material', _color = '#ffffff', _intensity = 3, debugPanel = null)
    {
        const baseColor = uniform(color(_color))
        const intensity = uniform(_intensity)

        const material = new THREE.MeshBasicNodeMaterial({ transparent: true })
        material.colorNode = baseColor.div(luminance(baseColor)).mul(intensity)
        material.fog = false
        this.save(_name, material)
  
        if(this.game.debug.active && debugPanel)
        {
            this.game.debug.addThreeColorBinding(debugPanel, baseColor.value, 'color')
            debugPanel.addBinding(intensity, 'value', { min: 0, max: 10, step: 0.01 })
        }

        return material
    }

    createEmissiveGradient(_name = 'material', _colorA = '#ffffff', _colorB = '#ff0000', _intensity = 3, normalize = true, debugPanel = null)
    {
        const colorA = uniform(color(_colorA))
        const colorB = uniform(color(_colorB))
        const intensity = uniform(_intensity)

        const material = new THREE.MeshBasicNodeMaterial({ transparent: true })
        let mixedColor = mix(colorA, colorB, uv().sub(0.5).length().mul(2))

        if(normalize)
            mixedColor = mixedColor.div(luminance(mixedColor))

        const outputNode = Fn(() =>
        {
            const outputColor = vec4(mixedColor.mul(intensity), 1)
            outputColor.assign(MeshDefaultMaterial.revealDiscardNodeBuilder(this.game, outputColor))

            return outputColor
        })

        material.outputNode = outputNode()
        material.fog = false
        this.save(_name, material)

        if(this.game.debug.active && debugPanel)
        {
            this.game.debug.addThreeColorBinding(debugPanel, colorA.value, 'colorA')
            this.game.debug.addThreeColorBinding(debugPanel, colorB.value, 'colorB')
            debugPanel.addBinding(intensity, 'value', { min: 0, max: 10, step: 0.01 })
        }
        
        // const update = () =>
        // {
        //     material.color.set(dummy.color)
        //     material.color.multiplyScalar(dummy.intensity / this.luminance.get(material.color))
        // }

        // update()

        // if(this.game.debug.active && debugPanel)
        // {
        //     debugPanel.addBinding(dummy, 'intensity', { min: 0, max: 10, step: 0.01 }).on('change', update)
        //     debugPanel.addBinding(dummy, 'color', { view: 'color' }).on('change', update)
        // }

        return material
    }

    createGradient(_name = 'material', _colorA = 'red', _colorB = 'blue', debugPanel = null)
    {
        const colorA = uniform(new THREE.Color(_colorA))
        const colorB = uniform(new THREE.Color(_colorB))
        const baseColor = mix(colorA, colorB, uv().y)

        const material = new MeshDefaultMaterial({
            colorNode: baseColor
        })
        // material.shadowSide = THREE.BackSide
        
        this.save(_name, material)

        if(this.game.debug.active && debugPanel)
        {
            this.game.debug.addThreeColorBinding(debugPanel, colorA.value, 'colorA')
            this.game.debug.addThreeColorBinding(debugPanel, colorB.value, 'colorB')
        }

        return material
    }

    setPreviews()
    {
        this.previews = {}
        this.previews.list = new Map()
        this.previews.sphereGeometry = new THREE.IcosahedronGeometry(1, 3)
        this.previews.boxGeometry = new THREE.BoxGeometry(1.5, 1.5, 1.5)
        this.previews.group = new THREE.Group()
        this.previews.group.visible = false
        this.previews.group.userData.preventPreRender = true
        this.game.scene.add(this.previews.group)
        
        this.previews.update = () =>
        {
            this.list.forEach((material, name) =>
            {
                if(!this.previews.list.has(name))
                {
                    const test = {}

                    // Pure
                    const pureColor = material.color.clone()
                    const maxLength = Math.max(pureColor.r, Math.max(pureColor.g, pureColor.b))
                    if(maxLength > 1)
                        pureColor.set(pureColor.r / maxLength, pureColor.g / maxLength, pureColor.b / maxLength)
                    
                    const boxPure = new THREE.Mesh(this.previews.boxGeometry, new THREE.MeshBasicMaterial({ color: pureColor }))
                    boxPure.position.y = 0.75
                    boxPure.position.x = this.list.size * 3
                    boxPure.position.z = 0
                    boxPure.castShadow = true
                    boxPure.receiveShadow = true
                    this.previews.group.add(boxPure)
                
                    // Box
                    const box = new THREE.Mesh(this.previews.boxGeometry, material)
                    box.position.y = 0.75
                    box.position.x = this.list.size * 3
                    box.position.z = 3
                    box.castShadow = true
                    box.receiveShadow = true
                    this.previews.group.add(box)

                    // Sphere
                    const sphere = new THREE.Mesh(this.previews.sphereGeometry, material)
                    sphere.position.z = 6
                    sphere.position.y = 0.75
                    sphere.position.x = this.list.size * 3
                    sphere.castShadow = true
                    sphere.receiveShadow = true
                    this.previews.group.add(sphere)

                    this.previews.list.set(name, test)
                }
            })
        }
        
        // Debug
        if(this.game.debug.active)
        {
            this.debugPanel.addBinding(this.previews.group, 'visible', { label: 'previewsVisibile' })
        }
    }

    save(name, material)
    {
        this.list.set(name, material)

        if(this.previews)
            this.previews.update()
    }

    getFromName(name, baseMaterial)
    {
        // Return existing material
        if(this.list.has(name))
            return this.list.get(name)

        // Create new
        const material = this.createFromMaterial(baseMaterial)

        // Save
        this.save(name, material)
        return material
    }

    createFromMaterial(baseMaterial)
    {
        if(baseMaterial.isMeshLambertNodeMaterial || baseMaterial.isMeshStandardMaterial)
        {
            // Shadow
            // material.shadowSide = THREE.BackSide

            // Color
            let baseColor = null
            
            if(baseMaterial.map)
                baseColor = texture(baseMaterial.map).rgb
            else
                baseColor = color(baseMaterial.color)
            
            // Alpha
            let alphaNode = null
            
            if(baseMaterial.alphaMap)
                alphaNode = texture(baseMaterial.alphaMap)
            else
                alphaNode = float(baseMaterial.opacity)

            // Transparent
            let transparent = baseMaterial.transparent

            // Premultiplied alpha
            let premultipliedAlpha = false

            // Exceptions
            if(
                baseMaterial.name === 'projectsLabels' ||
                baseMaterial.name === 'blackboardLabels'
            )
            {
                premultipliedAlpha = true
                transparent = true
                alphaNode = texture(baseMaterial.map).r
            }

            // Material
            const material = new MeshDefaultMaterial({
                colorNode: baseColor,
                alphaNode: alphaNode,
                hasCoreShadows: true,
                hasDropShadows: true,
                transparent: transparent
            })
            material.premultipliedAlpha = premultipliedAlpha
            material.map = baseMaterial.map
            
            return material
        }

        return baseMaterial

    }

    copy(baseMaterial, targetMaterial)
    {
        const properties = [ 'name', 'color', 'transparent' ]

        for(const property of properties)
        {
            if(typeof baseMaterial[property] !== 'undefined' && typeof targetMaterial[property] !== 'undefined')
                targetMaterial[property] = baseMaterial[property]
        }
    }

    updateObject(mesh)
    {
        mesh.traverse((child) =>
        {
            if(child.isMesh)
            {
                if(typeof child.material.userData.prevent === 'undefined' || !child.material.userData.prevent)
                    child.material = this.getFromName(child.material.name, child.material)
            }
        })
    }
}