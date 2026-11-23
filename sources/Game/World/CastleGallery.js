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

    /* ---------------- The great hall: a first person walk through the castle (3D) ---------------- */

    canvasTexture(w, h, draw, repeat = [ 1, 1 ])
    {
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        draw(canvas.getContext('2d'), w, h)
        const map = new THREE.CanvasTexture(canvas)
        map.colorSpace = THREE.SRGBColorSpace
        map.wrapS = map.wrapT = THREE.RepeatWrapping
        map.repeat.set(...repeat)
        map.anisotropy = 8
        return map
    }

    flat(map, hex = null)
    {
        const m = new THREE.MeshBasicNodeMaterial({ side: THREE.DoubleSide })
        if(map) m.colorNode = texture(map)
        else m.color = new THREE.Color(hex)
        m.fog = false
        return m
    }

    buildHall()
    {
        const hall = new THREE.Group()
        const W = 14, H = 9, Lh = 80                  // hall width (z), height, length (x)
        this.hallSize = { W, H, L: Lh }
        this.hallOrigin = new THREE.Vector3(this.center.x, - 160, this.center.z)
        hall.position.copy(this.hallOrigin)
        const add = (geometry, material, x, y, z, rx = 0, ry = 0) => { const m = new THREE.Mesh(geometry, material); m.position.set(x, y, z); m.rotation.set(rx, ry, 0); m.frustumCulled = false; hall.add(m); return m }

        // warm sandstone blocks with mortar lines and a soft vertical light falloff
        const stone = this.canvasTexture(512, 512, (c, w, h) =>
        {
            const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#6e4f3a'); g.addColorStop(1, '#a5815d')
            c.fillStyle = g; c.fillRect(0, 0, w, h)
            for(let row = 0; row < 8; row++)
                for(let col = 0; col < 4; col++)
                {
                    const x = col * 128 + (row % 2) * 64, y = row * 64
                    c.fillStyle = `rgba(${120 + Math.random() * 40},${90 + Math.random() * 30},${60 + Math.random() * 20},0.35)`
                    c.fillRect(x + 3, y + 3, 122, 58)
                }
            c.strokeStyle = 'rgba(40,25,15,0.55)'; c.lineWidth = 4
            for(let row = 0; row <= 8; row++) { c.beginPath(); c.moveTo(0, row * 64); c.lineTo(w, row * 64); c.stroke() }
            for(let row = 0; row < 8; row++) for(let col = 0; col <= 4; col++) { const x = col * 128 + (row % 2) * 64; c.beginPath(); c.moveTo(x, row * 64); c.lineTo(x, row * 64 + 64); c.stroke() }
        }, [ Lh / 8, 1.4 ])
        const floor = this.canvasTexture(256, 256, (c, w, h) =>
        {
            for(let i = 0; i < 2; i++) for(let j = 0; j < 2; j++) { c.fillStyle = (i + j) % 2 ? '#e8dcc6' : '#3b2c25'; c.fillRect(i * 128, j * 128, 128, 128) }
            c.strokeStyle = 'rgba(0,0,0,0.25)'; c.strokeRect(0, 0, w, h)
        }, [ Lh / 3, W / 3 ])
        const ceiling = this.canvasTexture(256, 256, (c, w, h) =>
        {
            c.fillStyle = '#3a2418'; c.fillRect(0, 0, w, h)
            c.fillStyle = '#5a3824'; for(let i = 0; i < 4; i++) c.fillRect(i * 64 + 6, 0, 40, h)
        }, [ Lh / 4, 1 ])
        const carpet = this.canvasTexture(64, 256, (c, w, h) =>
        {
            c.fillStyle = '#9c1027'; c.fillRect(0, 0, w, h)
            c.fillStyle = '#d4a63a'; c.fillRect(2, 0, 4, h); c.fillRect(w - 6, 0, 4, h)
        }, [ 1, Lh / 4 ])

        const plane = (w, h) => new THREE.PlaneGeometry(w, h)
        add(plane(Lh, W), this.flat(floor), 0, 0, 0, - Math.PI / 2)
        add(plane(Lh, W), this.flat(ceiling), 0, H, 0, Math.PI / 2)
        add(plane(Lh, H), this.flat(stone), 0, H / 2, - W / 2)
        add(plane(Lh, H), this.flat(stone), 0, H / 2, W / 2, 0, Math.PI)
        add(plane(W, H), this.flat(stone), - Lh / 2, H / 2, 0, 0, Math.PI / 2)
        add(plane(W, H), this.flat(stone), Lh / 2, H / 2, 0, 0, - Math.PI / 2)
        add(plane(Lh - 6, 3.2), this.flat(carpet), 1, 0.02, 0, - Math.PI / 2)

        // columns, arches between them, chandeliers, banners
        const gold = this.flat(null, '#d4a63a'), column = this.flat(null, '#cdb38f'), glow = this.flat(null, '#ffe39a'), banner = this.flat(null, '#7d0f22')
        for(let x = - Lh / 2 + 5; x <= Lh / 2 - 5; x += 10)
        {
            for(const z of [ - W / 2 + 0.6, W / 2 - 0.6 ])
            {
                add(new THREE.CylinderGeometry(0.45, 0.55, H, 14), column, x, H / 2, z)
                add(new THREE.BoxGeometry(1.4, 0.5, 1.4), gold, x, H - 0.25, z)
                add(new THREE.BoxGeometry(1.4, 0.4, 1.4), column, x, 0.2, z)
            }
            // chandelier: a gold ring of glowing candles
            add(new THREE.CylinderGeometry(0.03, 0.03, 1.6, 4), gold, x, H - 0.8, 0)
            add(new THREE.TorusGeometry(1.1, 0.07, 6, 24), gold, x, H - 1.6, 0, Math.PI / 2)
            for(let k = 0; k < 8; k++)
            {
                const a = k / 8 * Math.PI * 2
                add(new THREE.SphereGeometry(0.12, 8, 6), glow, x + Math.cos(a) * 1.1, H - 1.45, Math.sin(a) * 1.1)
            }
        }
        for(let x = - Lh / 2 + 10; x <= Lh / 2 - 10; x += 10)
            for(const z of [ - W / 2 + 0.05, W / 2 - 0.05 ])
                add(new THREE.PlaneGeometry(1.6, 3.2), banner, x, H - 2.1, z, 0, z < 0 ? 0 : Math.PI)
        // the entrance: open doors at the +x end, glowing outside
        add(new THREE.PlaneGeometry(4.5, 5.5), this.flat(null, '#ffd8a0'), Lh / 2 - 0.02, 2.75, 0, 0, - Math.PI / 2)

        this.game.scene.add(hall)
        hall.visible = false
        this.hall = hall
        this.hallAdd = add
    }

    /** Frames along both long walls (each fitted to its photo), the big video screen on the far wall */
    placeHallMedia()
    {
        const { W, H, L } = this.hallSize
        const items = this.theatre.items
        const photos = items.filter(i => i.type === 'photo')
        const perSide = Math.ceil(photos.length / 2)
        const spacing = Math.min(5, (L - 16) / Math.max(1, perSide))
        this.stops = [ { type: 'entrance', pos: new THREE.Vector3(L / 2 - 3, 1.7, 0), look: new THREE.Vector3(- L / 2, 2.6, 0) } ]
        const frameMat = this.flat(null, '#c9a227')
        photos.forEach((item, i) =>
        {
            const side = i % 2 ? 1 : - 1
            const x = L / 2 - 9 - Math.floor(i / 2) * spacing
            const z = side * (W / 2 - 0.08)
            const ry = side < 0 ? 0 : Math.PI
            const pic = new THREE.MeshBasicNodeMaterial({ side: THREE.DoubleSide })
            pic.fog = false
            const blank = new THREE.Texture()
            pic.colorNode = texture(blank)
            const frame = this.hallAdd(new THREE.BoxGeometry(1, 1, 0.12), frameMat, x, 3.6, z - side * 0.06, 0, ry)
            const mesh = this.hallAdd(new THREE.PlaneGeometry(1, 1), pic, x, 3.6, z - side * 0.14, 0, ry)
            const maxW = spacing - 0.8, maxH = 4.2
            const fit = (img) =>
            {
                const a = img.width / img.height
                let w = maxW, h = w / a
                if(h > maxH) { h = maxH; w = h * a }
                mesh.scale.set(w, h, 1)
                frame.scale.set(w + 0.35, h + 0.35, 1)
            }
            const setImage = (src) =>
            {
                const img = new Image()
                img.onload = () =>
                {
                    const t = new THREE.Texture(img)
                    t.colorSpace = THREE.SRGBColorSpace
                    t.anisotropy = 8
                    t.needsUpdate = true
                    pic.colorNode = texture(t)
                    pic.needsUpdate = true
                    fit(img)
                }
                img.src = src
            }
            setImage(item.thumb)
            this.stops.push({ type: 'photo', item, hd: false, upgrade: () => setImage(item.full), pos: new THREE.Vector3(x, 3.1, side * - 0.4), look: new THREE.Vector3(x, 3.5, z) })
        })
        // the video wall at the far end
        const videos = items.filter(i => i.type === 'video')
        if(videos.length)
        {
            const video = document.createElement('video')
            video.muted = true
            video.playsInline = true
            video.crossOrigin = 'anonymous'
            video.preload = 'auto'
            let index = 0
            const play = () => { video.src = videos[index].full; video.play().catch(() => {}) }
            video.addEventListener('ended', () => { index = (index + 1) % videos.length; play() })
            video.addEventListener('loadedmetadata', () =>
            {
                const a = video.videoWidth / video.videoHeight
                let h = H - 2.4, w = h * a
                if(w > W - 2) { w = W - 2; h = w / a }
                screen.scale.set(w, h, 1)
                screenFrame.scale.set(w + 0.5, h + 0.5, 1)
            })
            const map = new THREE.VideoTexture(video)
            map.colorSpace = THREE.SRGBColorSpace
            const mat = new THREE.MeshBasicNodeMaterial()
            mat.colorNode = texture(map)
            mat.fog = false
            const screenFrame = this.hallAdd(new THREE.BoxGeometry(1, 1, 0.15), frameMat, - L / 2 + 0.1, H / 2 + 0.2, 0, 0, Math.PI / 2)
            const screen = this.hallAdd(new THREE.PlaneGeometry(1, 1), mat, - L / 2 + 0.2, H / 2 + 0.2, 0, 0, Math.PI / 2)
            screen.scale.set(8, 4.5, 1)
            this.hallVideo = { video, play }
            this.stops.push({ type: 'video', pos: new THREE.Vector3(- L / 2 + 11, 2.4, 0), look: new THREE.Vector3(- L / 2, H / 2 + 0.2, 0) })
        }
    }

    setTheatre()
    {
        this.theatre = { open: false, cooldown: false, items: [] }
        const el = document.createElement('div')
        el.className = 'castle-theatre'
        el.innerHTML = `
            <div class="ct-vignette"></div>
            <div class="ct-title">Castello ♥ 我們的回憶</div>
            <div class="ct-count"></div>
            <button class="ct-nav ct-prev" aria-label="上一個">‹</button>
            <button class="ct-nav ct-next" aria-label="下一個">›</button>
            <div class="ct-controls">
                <button class="ct-play">❚❚ 暫停導覽</button>
                <button class="ct-sound">🔇 影片聲音</button>
                <button class="ct-exit">離開城堡 →</button>
            </div>`
        document.body.append(el)
        this.theatre.el = el
        this.camPos = new THREE.Vector3()
        this.camLook = new THREE.Vector3()
        this.override = { position: new THREE.Vector3(), quaternion: new THREE.Quaternion() }
        this.lookHelper = new THREE.PerspectiveCamera() // cameras look down -z (an Object3D would look away from the target)
        el.querySelector('.ct-prev').addEventListener('click', () => this.goTo(this.theatre.index - 1, true))
        el.querySelector('.ct-next').addEventListener('click', () => this.goTo(this.theatre.index + 1, true))
        el.querySelector('.ct-play').addEventListener('click', (e) =>
        {
            this.theatre.playing = !this.theatre.playing
            e.currentTarget.textContent = this.theatre.playing ? '❚❚ 暫停導覽' : '▶ 自動導覽'
            this.theatre.wait = 0
        })
        el.querySelector('.ct-sound').addEventListener('click', (e) =>
        {
            if(!this.hallVideo) return
            this.hallVideo.video.muted = !this.hallVideo.video.muted
            e.currentTarget.textContent = this.hallVideo.video.muted ? '🔇 影片聲音' : '🔊 影片聲音'
        })
        el.querySelector('.ct-exit').addEventListener('click', () => this.closeTheatre())
        addEventListener('keydown', (e) =>
        {
            if(!this.theatre.open) return
            if(e.key === 'Escape') this.closeTheatre()
            else if(e.key === 'ArrowRight' || e.key === 'ArrowUp') this.goTo(this.theatre.index + 1, true)
            else if(e.key === 'ArrowLeft' || e.key === 'ArrowDown') this.goTo(this.theatre.index - 1, true)
            e.stopPropagation()
        }, true)
    }

    goTo(i, manual = false)
    {
        const n = this.stops.length
        this.theatre.index = (i + n) % n
        this.theatre.wait = 0
        if(manual) this.theatre.playing = false, this.theatre.el.querySelector('.ct-play').textContent = '▶ 自動導覽'
        const stop = this.stops[this.theatre.index]
        if(stop.type === 'photo' && !stop.hd) { stop.hd = true; stop.upgrade() }   // sharp version when you look at it
        this.theatre.el.querySelector('.ct-count').textContent = stop.type === 'photo' ? `${this.theatre.index} / ${this.stops.length - (this.hallVideo ? 2 : 1)}` : stop.type === 'video' ? '影片' : ''
    }

    openTheatre()
    {
        if(!this.theatre.items.length)
            return
        if(!this.hall) { this.buildHall(); this.placeHallMedia() }
        this.theatre.open = true
        this.theatre.playing = true
        this.hall.visible = true
        this.savedFilters = [ ...this.game.inputs.filters ]
        this.game.inputs.filters.clear()
        this.game.inputs.filters.add('modal')
        this.theatre.el.classList.add('is-open')
        document.documentElement.classList.add('has-modal-open', 'is-in-castle')
        this.hallVideo?.play()
        // start just outside the hall doors, then walk in
        const o = this.hallOrigin
        this.camPos.set(o.x + this.hallSize.L / 2 + 4, o.y + 2, o.z)
        this.camLook.set(o.x, o.y + 2.6, o.z)
        this.game.view.cameraOverride = this.override
        // a person's field of view (the game camera is a narrow, far away lens)
        const camera = this.game.view.camera
        this.savedFov = camera.fov
        camera.fov = 58
        camera.updateProjectionMatrix()
        this.goTo(0)
    }

    closeTheatre()
    {
        if(!this.theatre.open)
            return
        this.theatre.open = false
        this.theatre.cooldown = true
        this.hall.visible = false
        this.hallVideo?.video.pause()
        this.game.view.cameraOverride = null
        const camera = this.game.view.camera
        camera.fov = this.savedFov || 25
        camera.updateProjectionMatrix()
        this.theatre.el.classList.remove('is-open')
        document.documentElement.classList.remove('has-modal-open', 'is-in-castle')
        this.game.inputs.filters.clear()
        for(const f of this.savedFilters?.length ? this.savedFilters : [ 'wandering' ])
            this.game.inputs.filters.add(f)
        const x = this.center.x + 3.2 * this.k + 3.5
        this.game.physicalVehicle.moveTo({ x, y: this.floor + 1.2, z: this.center.z }, 0)
    }

    updateTheatre()
    {
        const dt = Math.min(0.05, this.game.ticker.delta)
        const stop = this.stops[this.theatre.index]
        const o = this.hallOrigin
        const tPos = stop.pos.clone().add(o), tLook = stop.look.clone().add(o)
        const k = 1 - Math.exp(- dt * 1.6)
        this.camPos.lerp(tPos, k)
        this.camLook.lerp(tLook, k * 1.3)
        // a gentle breathing sway, like walking
        const t = this.game.ticker.elapsed ?? performance.now() / 1000
        this.override.position.copy(this.camPos).add(new THREE.Vector3(0, Math.sin(t * 1.3) * 0.04, 0))
        this.lookHelper.position.copy(this.override.position)
        this.lookHelper.lookAt(this.camLook)
        this.override.quaternion.copy(this.lookHelper.quaternion)
        if(this.theatre.playing)
        {
            this.theatre.wait += dt
            const hold = stop.type === 'video' ? 14 : stop.type === 'entrance' ? 3 : 5
            if(this.theatre.wait > hold)
                this.goTo(this.theatre.index + 1)
        }
    }

    update()
    {
        if(this.theatre?.open)
            this.updateTheatre()
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
