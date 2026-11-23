import * as THREE from 'three/webgpu'
import { texture } from 'three/tsl'
import gsap from 'gsap'
import { Game } from '../Game.js'
import { secrets } from '../../data/secrets.js'

/**
 * The great hall of the Napa castle: polaroid photos on the walls and a big looping video on the keep.
 * Drop photos in static/gallery/img and videos in static/gallery/vid; `npm run sf:build` (scripts/sf/gallery.mjs)
 * resizes them and writes static/gallery/gallery.json. 8 frames take turns showing all photos; the screen plays every video.
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
        this.setTheatre()
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
        const y = this.floor + 3.1
        // wall slots: [x, z, rotationY]
        const slots = [
            [ cx - 2.0 * k, zN, 0 ], [ cx - 0.2 * k, zN, 0 ], [ cx + 1.6 * k, zN, 0 ],
            [ cx - 2.0 * k, zS, Math.PI ], [ cx - 0.2 * k, zS, Math.PI ], [ cx + 1.6 * k, zS, Math.PI ],
            [ xBack, cz - 2.7 * k, Math.PI / 2 ], [ xBack, cz + 2.7 * k, Math.PI / 2 ],
            [ cx + 3.03 * k, cz - 2.7 * k, - Math.PI / 2 ], [ cx + 3.03 * k, cz + 2.7 * k, - Math.PI / 2 ],
        ]
        // a carousel: frame i shows photo (offset + i); every few seconds the offset moves on, in a wave around the hall.
        // Frames are never more than photos, so the same photo is never on two walls at once.
        this.theatre.items = [
            ...(manifest.photos || []).map(p => ({ type: 'photo', full: p.full || p.src, thumb: p.src })),
            ...(manifest.videos || []).map(v => ({ type: 'video', full: v.full || v.src, thumb: v.thumb || '' })),
        ]
        // mix the videos in among the photos
        if(manifest.videos?.length && manifest.photos?.length)
        {
            const photos = this.theatre.items.filter(i => i.type === 'photo'), videos = this.theatre.items.filter(i => i.type === 'video')
            const step = Math.max(1, Math.floor(photos.length / videos.length))
            const mixed = []
            photos.forEach((p, i) => { mixed.push(p); if((i + 1) % step === 0 && videos.length) mixed.push(videos.shift()) })
            this.theatre.items = [ ...mixed, ...videos ]
        }
        this.photos = manifest.photos?.length ? manifest.photos : placeholders
        const used = slots.slice(0, Math.min(slots.length, this.photos.length))
        this.frames = used.map(([ x, z, ry ], i) => this.addPolaroid(this.photos[i], x, y, z, ry, (i % 2 ? - 1 : 1) * 0.04))
        this.offset = 0
        this.swapTimer = 0
        // the big screen on the front face of the keep: plays every video one after the other
        const videos = manifest.videos?.length ? manifest.videos.map(v => v.src) : (manifest.video ? [ manifest.video ] : [])
        this.addScreen(videos, cx - 1.68 * k, this.floor + 2.9, cz, Math.PI / 2)
    }

    frame(width, height, x, y, z, ry, tilt, hex)
    {
        const back = new THREE.Mesh(new THREE.BoxGeometry(width + (width > 1.5 ? 0.25 : 0), height + (width > 1.5 ? 0.25 : 0), 0.08), new THREE.MeshBasicNodeMaterial({ color: hex }))
        back.position.set(x, y, z)
        back.rotation.set(0, ry, tilt)
        back.translateZ(0.06)
        this.group.add(back)
        return back
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

    addPolaroid(initial, x, y, z, ry, tilt)
    {
        let photo = initial
        let back = null, mesh = null
        const canvas = document.createElement('canvas')
        canvas.width = 512
        canvas.height = 512
        const ctx = canvas.getContext('2d')
        const map = new THREE.CanvasTexture(canvas)
        map.colorSpace = THREE.SRGBColorSpace
        const size = 3.4                                   // longest side of a frame, world units
        const draw = (image) =>
        {
            if(image)
            {
                // the frame takes the photo's own shape: nothing cut off, nothing stretched
                const aspect = image.width / image.height
                canvas.width = aspect >= 1 ? 768 : Math.round(768 * aspect)
                canvas.height = aspect >= 1 ? Math.round(768 / aspect) : 768
                ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
                const w = aspect >= 1 ? size : size * aspect, h = aspect >= 1 ? size / aspect : size
                mesh.scale.set(w, h, 1)
                back.scale.set(w + 0.22, h + 0.22, 1)
                map.dispose()
            }
            else
            {
                const g = ctx.createLinearGradient(0, 0, 0, 512)
                g.addColorStop(0, photo.colors?.[0] || '#ffd6a0')
                g.addColorStop(1, photo.colors?.[1] || '#ff8fa3')
                ctx.fillStyle = g
                ctx.fillRect(0, 0, 512, 512)
                ctx.fillStyle = 'rgba(255,255,255,0.9)'
                ctx.font = '160px sans-serif'
                ctx.textAlign = 'center'
                ctx.textBaseline = 'middle'
                ctx.fillText(photo.emoji || '♥', 256, 270)
            }
            map.needsUpdate = true
        }
        const show = (next) =>
        {
            photo = next
            draw(null)
            if(photo.src)
            {
                const image = new Image()
                image.onload = () => { if(photo === next) draw(image) }
                image.src = photo.src
            }
        }
        show(photo)
        back = this.frame(1, 1, x, y, z, ry, tilt, '#c9a227')
        mesh = this.picture(map, 1, 1, x, y, z, ry, tilt)
        mesh.scale.set(size * 0.75, size * 0.75, 1)
        back.scale.set(size * 0.75 + 0.22, size * 0.75 + 0.22, 1)
        return { show }
    }

    addScreen(sources, x, y, z, ry)
    {
        const width = 5.6, height = 3.15
        this.frame(width, height, x, y, z, ry, 0, '#c9a227')
        if(sources.length)
        {
            const video = document.createElement('video')
            let index = 0
            video.src = sources[0]
            video.muted = true
            video.loop = sources.length === 1
            video.addEventListener('ended', () =>
            {
                index = (index + 1) % sources.length
                video.src = sources[index]
                video.play().catch(() => {})
            })
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

    setTheatre()
    {
        this.theatre = { open: false, cooldown: false }
        const el = document.createElement('div')
        el.className = 'castle-theatre'
        el.innerHTML = `
            <div class="ct-curtain ct-left"></div><div class="ct-curtain ct-right"></div>
            <div class="ct-inner">
                <div class="ct-title">Castello ♥ 我們的回憶</div>
                <div class="ct-stage">
                    <div class="ct-main"><img class="ct-photo" alt=""><video class="ct-video" muted playsinline loop></video></div>
                    <button class="ct-nav ct-prev" aria-label="上一張">‹</button>
                    <button class="ct-nav ct-next" aria-label="下一張">›</button>
                </div>
                <div class="ct-strip"></div>
                <div class="ct-controls">
                    <button class="ct-play">❚❚ 暫停輪播</button>
                    <button class="ct-sound">🔇 影片聲音</button>
                    <button class="ct-exit">離開城堡 →</button>
                </div>
            </div>`
        document.body.append(el)
        this.theatre.el = el
        const items = () => this.theatre.items
        const photo = el.querySelector('.ct-photo'), video = el.querySelector('.ct-video'), strip = el.querySelector('.ct-strip')
        this.theatre.show = (i) =>
        {
            const list = items()
            if(!list.length)
                return
            this.theatre.index = (i + list.length) % list.length
            const item = list[this.theatre.index]
            el.classList.toggle('is-video', item.type === 'video')
            if(item.type === 'video')
            {
                photo.removeAttribute('src')
                video.src = item.full
                video.play().catch(() => {})
            }
            else
            {
                video.pause()
                video.removeAttribute('src')
                photo.src = item.full
            }
            strip.querySelectorAll('button').forEach((b, k) => b.classList.toggle('is-active', k === this.theatre.index))
            strip.children[this.theatre.index]?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
            clearTimeout(this.theatre.timer)
            // photos advance every 5s; videos when they finish
            if(this.theatre.playing && item.type !== 'video')
                this.theatre.timer = setTimeout(() => this.theatre.show(this.theatre.index + 1), 5000)
        }
        video.loop = false
        video.addEventListener('ended', () => { if(this.theatre.playing) this.theatre.show(this.theatre.index + 1); else video.play() })
        el.querySelector('.ct-prev').addEventListener('click', () => this.theatre.show(this.theatre.index - 1))
        el.querySelector('.ct-next').addEventListener('click', () => this.theatre.show(this.theatre.index + 1))
        el.querySelector('.ct-play').addEventListener('click', (e) =>
        {
            this.theatre.playing = !this.theatre.playing
            e.currentTarget.textContent = this.theatre.playing ? '❚❚ 暫停輪播' : '▶ 自動輪播'
            this.theatre.show(this.theatre.index)
        })
        el.querySelector('.ct-sound').addEventListener('click', (e) =>
        {
            video.muted = !video.muted
            e.currentTarget.textContent = video.muted ? '🔇 影片聲音' : '🔊 影片聲音'
            if(this.game.music) this.game.music.duck?.(!video.muted)
        })
        el.querySelector('.ct-exit').addEventListener('click', () => this.closeTheatre())
        addEventListener('keydown', (e) =>
        {
            if(!this.theatre.open) return
            if(e.key === 'Escape') this.closeTheatre()
            if(e.key === 'ArrowRight') this.theatre.show(this.theatre.index + 1)
            if(e.key === 'ArrowLeft') this.theatre.show(this.theatre.index - 1)
            e.stopPropagation()
        }, true)
        this.theatre.buildStrip = () =>
        {
            strip.innerHTML = ''
            items().forEach((item, k) =>
            {
                const b = document.createElement('button')
                b.innerHTML = item.type === 'video' ? `<img src="${item.thumb}" alt=""><span>▶</span>` : `<img src="${item.thumb}" alt="" loading="lazy">`
                b.addEventListener('click', () => this.theatre.show(k))
                strip.append(b)
            })
        }
    }

    openTheatre()
    {
        const list = this.theatre.items
        if(!list?.length)
            return
        this.theatre.open = true
        this.theatre.playing = true
        this.savedFilters = [ ...this.game.inputs.filters ]
        this.game.inputs.filters.clear()
        this.game.inputs.filters.add('modal')
        this.game.physicalVehicle.chassis?.physical?.body?.setLinvel({ x: 0, y: 0, z: 0 }, true)
        this.theatre.el.classList.add('is-open')
        document.documentElement.classList.add('has-modal-open')
        if(!this.theatre.built) { this.theatre.buildStrip(); this.theatre.built = true }
        this.theatre.show(this.theatre.index || 0)
    }

    closeTheatre()
    {
        if(!this.theatre.open)
            return
        this.theatre.open = false
        this.theatre.cooldown = true
        clearTimeout(this.theatre.timer)
        const video = this.theatre.el.querySelector('.ct-video')
        video.pause()
        this.theatre.el.classList.remove('is-open')
        document.documentElement.classList.remove('has-modal-open')
        this.game.inputs.filters.clear()
        for(const f of this.savedFilters?.length ? this.savedFilters : [ 'wandering' ])
            this.game.inputs.filters.add(f)
        // back out through the gate, facing the vineyard driveway
        const x = this.center.x + 3.2 * this.k + 3.5
        this.game.physicalVehicle.moveTo({ x, y: this.floor + 1.2, z: this.center.z }, 0)
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
        if(near && this.frames && this.photos.length > this.frames.length)
        {
            this.swapTimer += this.game.ticker.delta
            if(this.swapTimer > 6)
            {
                this.swapTimer = 0
                this.offset = (this.offset + 1) % this.photos.length
                const count = this.frames.length, total = this.photos.length
                // update from the last frame down to the first: the newest photo appears first, and a photo only
                // moves to the frame before it after that frame has let go of its own, so no duplicates mid-wave
                const wave = total > count
                for(let i = count - 1; i >= 0; i--)
                {
                    const photo = this.photos[(this.offset + i) % total]
                    const frame = this.frames[i]
                    if(wave)
                        setTimeout(() => frame.show(photo), (count - 1 - i) * 180)
                    else
                        frame.show(photo)
                }
            }
        }
        if(!this.upper)
            this.upper = this.game.scene.getObjectByName('castleUpper') || null
        // theatre mode: once the whole car is through the gate (its tail past the door), the hall fills the screen
        const doorX = this.center.x + 3.2 * this.k
        const fullyIn = p.x < doorX - 2.6 && Math.abs(dz) < this.half.z && Math.abs(dx) < this.half.x && p.y < this.floor + 4
        if(fullyIn && !this.theatre.open && !this.theatre.cooldown)
            this.openTheatre()
        if(!fullyIn && this.theatre.cooldown && p.x > doorX + 1)
            this.theatre.cooldown = false
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
