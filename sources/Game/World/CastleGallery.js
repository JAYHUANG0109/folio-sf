import * as THREE from 'three/webgpu'
import { texture } from 'three/tsl'
import { Game } from '../Game.js'
import { secrets } from '../../data/secrets.js'

/**
 * The great hall of the Napa castle: polaroid photos on the walls and a big looping video on the keep.
 * Put files in static/gallery/ and list them in static/gallery/gallery.json:
 *   { "photos": [ { "src": "gallery/01.jpg", "caption": "第一次約會" } ], "video": "gallery/us.mp4" }
 * While the car is inside, the roof and upper walls ('castleUpper') hide so the hall is visible from the camera.
 */
export class CastleGallery
{
    constructor()
    {
        this.game = Game.getInstance()
        const napa = secrets.find(s => s.id === 'napa').position
        const k = 2.2
        this.k = k
        this.center = { x: napa.x - 3 * k, z: napa.z }                  // castle center (castleX = cx - 3 in the builder)
        this.floor = this.game.terrain.getHeight(this.center.x, this.center.z) + 0.07 * k
        this.half = { x: 3.05 * k, z: 3.85 * k }
        this.group = new THREE.Group()
        this.group.visible = false
        this.game.scene.add(this.group)
        this.upper = null
        this.inside = false
        this.near = false
        this.load()
        this.game.ticker.events.on('tick', () => this.update(), 12)
    }

    async load()
    {
        let manifest = { photos: [], video: null }
        try
        {
            const response = await fetch(`gallery/gallery.json?cb=${Date.now()}`)
            if(response.ok)
                manifest = await response.json()
        }
        catch(error) { /* no gallery yet: placeholders */ }

        const { x: cx, z: cz } = this.center
        const k = this.k
        const zN = cz - 3.83 * k, zS = cz + 3.83 * k, xBack = cx - 3.03 * k
        const y = this.floor + 2.5
        // wall slots: [x, z, rotationY]
        const slots = [
            [ cx - 2.0 * k, zN, 0 ], [ cx - 0.2 * k, zN, 0 ], [ cx + 1.6 * k, zN, 0 ],
            [ cx - 2.0 * k, zS, Math.PI ], [ cx - 0.2 * k, zS, Math.PI ], [ cx + 1.6 * k, zS, Math.PI ],
            [ xBack, cz - 2.7 * k, Math.PI / 2 ], [ xBack, cz + 2.7 * k, Math.PI / 2 ],
        ]
        const photos = manifest.photos?.length ? manifest.photos : placeholders
        slots.forEach(([ x, z, ry ], i) =>
        {
            const photo = photos[i % photos.length]
            this.addPolaroid(photo, x, y, z, ry, (i % 2 ? - 1 : 1) * 0.04)
        })
        // the big screen on the front face of the keep
        this.addScreen(manifest.video, cx - 1.68 * k, this.floor + 2.9, cz, Math.PI / 2)
    }

    frame(width, height, x, y, z, ry, tilt, hex)
    {
        const back = new THREE.Mesh(new THREE.BoxGeometry(width + 0.25, height + 0.25, 0.08), new THREE.MeshBasicNodeMaterial({ color: hex }))
        back.position.set(x, y, z)
        back.rotation.set(0, ry, tilt)
        back.translateZ(0.06)
        this.group.add(back)
    }

    picture(map, width, height, x, y, z, ry, tilt)
    {
        const material = new THREE.MeshBasicNodeMaterial()
        material.colorNode = texture(map)
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material)
        mesh.position.set(x, y, z)
        mesh.rotation.set(0, ry, tilt)
        mesh.translateZ(0.11)
        this.group.add(mesh)
        return mesh
    }

    addPolaroid(photo, x, y, z, ry, tilt)
    {
        const canvas = document.createElement('canvas')
        canvas.width = 512
        canvas.height = 600
        const ctx = canvas.getContext('2d')
        const map = new THREE.CanvasTexture(canvas)
        map.colorSpace = THREE.SRGBColorSpace
        const draw = (image) =>
        {
            ctx.fillStyle = '#fbf7ef'
            ctx.fillRect(0, 0, 512, 600)
            if(image)
            {
                // cover-fit into the square window
                const s = Math.max(464 / image.width, 464 / image.height)
                const w = image.width * s, h = image.height * s
                ctx.save()
                ctx.beginPath(); ctx.rect(24, 24, 464, 464); ctx.clip()
                ctx.drawImage(image, 24 + (464 - w) / 2, 24 + (464 - h) / 2, w, h)
                ctx.restore()
            }
            else
            {
                const g = ctx.createLinearGradient(0, 24, 0, 488)
                g.addColorStop(0, photo.colors?.[0] || '#ffd6a0')
                g.addColorStop(1, photo.colors?.[1] || '#ff8fa3')
                ctx.fillStyle = g
                ctx.fillRect(24, 24, 464, 464)
                ctx.fillStyle = 'rgba(255,255,255,0.9)'
                ctx.font = '120px sans-serif'
                ctx.textAlign = 'center'
                ctx.fillText(photo.emoji || '♥', 256, 300)
            }
            ctx.fillStyle = '#3a2a20'
            ctx.font = '40px "LXGW WenKai TC", "PingFang TC", "Noto Sans TC", sans-serif'
            ctx.textAlign = 'center'
            ctx.fillText(photo.caption || '', 256, 560)
            map.needsUpdate = true
        }
        draw(null)
        if(photo.src)
        {
            const image = new Image()
            image.onload = () => draw(image)
            image.src = photo.src
        }
        this.frame(2.2, 2.55, x, y, z, ry, tilt, '#6b4423')
        this.picture(map, 2.2, 2.58, x, y, z, ry, tilt)
    }

    addScreen(src, x, y, z, ry)
    {
        const width = 5.6, height = 3.15
        this.frame(width, height, x, y, z, ry, 0, '#c9a227')
        if(src)
        {
            const video = document.createElement('video')
            video.src = src
            video.muted = true
            video.loop = true
            video.playsInline = true
            video.crossOrigin = 'anonymous'
            video.preload = 'auto'
            this.video = video
            const map = new THREE.VideoTexture(video)
            map.colorSpace = THREE.SRGBColorSpace
            this.picture(map, width, height, x, y, z, ry, 0)
        }
        else
        {
            // no video yet: a title card
            const canvas = document.createElement('canvas')
            canvas.width = 1024
            canvas.height = 576
            const ctx = canvas.getContext('2d')
            const g = ctx.createLinearGradient(0, 0, 1024, 576)
            g.addColorStop(0, '#2b1a3a'); g.addColorStop(1, '#6b1f3a')
            ctx.fillStyle = g
            ctx.fillRect(0, 0, 1024, 576)
            ctx.fillStyle = '#ffd27a'
            ctx.textAlign = 'center'
            ctx.font = '72px "LXGW WenKai TC", "PingFang TC", sans-serif'
            ctx.fillText('朵婕 ♥ Jay', 512, 260)
            ctx.font = '40px "LXGW WenKai TC", "PingFang TC", sans-serif'
            ctx.fillStyle = '#fff2e8'
            ctx.fillText('舊金山 2026.11.24 – 12.01', 512, 350)
            const map = new THREE.CanvasTexture(canvas)
            map.colorSpace = THREE.SRGBColorSpace
            this.picture(map, width, height, x, y, z, ry, 0)
        }
    }

    update()
    {
        const p = this.game.player.position
        const dx = p.x - this.center.x, dz = p.z - this.center.z
        const near = Math.hypot(dx, dz) < 45
        if(near !== this.near)
        {
            this.near = near
            this.group.visible = near
            if(this.video)
                near ? this.video.play().catch(() => {}) : this.video.pause()
        }
        if(!this.upper)
            this.upper = this.game.scene.getObjectByName('castleUpper') || null
        const inside = Math.abs(dx) < this.half.x + 1.2 && Math.abs(dz) < this.half.z && p.y < this.floor + 4
        if(inside !== this.inside && this.upper)
        {
            this.inside = inside
            this.upper.visible = !inside
        }
    }
}

const placeholders = [
    { caption: '舊金山，我們來了', emoji: '✈️', colors: [ '#a9e8ff', '#3f86e0' ] },
    { caption: '金門大橋', emoji: '🌉', colors: [ '#ffb38a', '#e0503a' ] },
    { caption: '一起吃牛肉麵', emoji: '🍜', colors: [ '#ffe0a0', '#d98a3a' ] },
    { caption: '海獅好可愛', emoji: '🦭', colors: [ '#b8f0ea', '#3fa9a0' ] },
    { caption: 'Napa 的夕陽', emoji: '🍷', colors: [ '#ffcf9a', '#9b2a5a' ] },
    { caption: '小可 & Dookie', emoji: '🐶', colors: [ '#ffd6e8', '#ff6fae' ] },
    { caption: '49ers 加油', emoji: '🏈', colors: [ '#ffd27a', '#c8102e' ] },
    { caption: '最愛妳', emoji: '♥', colors: [ '#ffc4de', '#e0508c' ] },
]
