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
        // A Hogwarts-like great hall: long stone nave, pointed arches on clustered columns, a ribbed vaulted ceiling,
        // hundreds of floating candles, two long feast tables, banners, and a tall gothic window at the far end
        const hall = new THREE.Group()
        const W = 18, H = 16, Lh = 90
        this.hallSize = { W, H, L: Lh }
        this.hallOrigin = new THREE.Vector3(this.center.x, - 200, this.center.z)
        hall.position.copy(this.hallOrigin)
        const add = (geometry, material, x, y, z, rx = 0, ry = 0, rz = 0) => { const m = new THREE.Mesh(geometry, material); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.frustumCulled = false; hall.add(m); return m }
        const rnd = (() => { let a = 7; return () => (a = (a * 16807) % 2147483647) / 2147483647 })()

        const stone = this.canvasTexture(512, 512, (c, w, h) =>
        {
            c.fillStyle = '#3d3229'; c.fillRect(0, 0, w, h)
            for(let row = 0; row < 8; row++)
                for(let col = 0; col < 4; col++)
                {
                    const x = col * 128 + (row % 2) * 64, y = row * 64, v = 60 + rnd() * 40
                    c.fillStyle = `rgb(${v + 20},${v + 8},${v - 6})`
                    c.fillRect(x + 3, y + 3, 122, 58)
                    c.fillStyle = 'rgba(0,0,0,0.12)'; c.fillRect(x + 3, y + 46, 122, 15)
                }
        }, [ Lh / 6, H / 6 ])
        const floor = this.canvasTexture(256, 256, (c, w, h) =>
        {
            for(let i = 0; i < 2; i++) for(let j = 0; j < 2; j++) { const v = 70 + rnd() * 25; c.fillStyle = `rgb(${v},${v - 6},${v - 14})`; c.fillRect(i * 128 + 2, j * 128 + 2, 124, 124) }
        }, [ Lh / 4, W / 4 ])
        const dark = (hex) => { const m = this.flat(null, hex); return m }
        const plane = (w, h) => new THREE.PlaneGeometry(w, h)
        const stoneMat = this.flat(stone), wood = dark('#3b2416'), gold = dark('#c9a227'), candle = dark('#fff1c9'), flame = dark('#ffcf5a')
        add(plane(Lh, W), this.flat(floor), 0, 0, 0, - Math.PI / 2)
        add(plane(Lh, H), stoneMat, 0, H / 2, - W / 2)
        add(plane(Lh, H), stoneMat, 0, H / 2, W / 2, 0, Math.PI)
        add(plane(W, H), stoneMat, Lh / 2, H / 2, 0, 0, - Math.PI / 2)
        add(plane(W, H + 6), stoneMat, - Lh / 2, H / 2, 0, 0, Math.PI / 2)
        // ribbed pointed vault: two sloped ceiling planes and wooden ribs every bay
        const slope = Math.atan2(5, W / 2)
        for(const side of [ - 1, 1 ])
        {
            const roof = add(plane(Lh, Math.hypot(W / 2, 5)), dark('#2a1d14'), 0, H + 2.5, side * W / 4)
            roof.rotateX(side < 0 ? Math.PI / 2 - slope : Math.PI / 2 + slope)
        }
        for(let x = - Lh / 2 + 3; x <= Lh / 2 - 3; x += 6)
        {
            for(const side of [ - 1, 1 ])
            {
                add(new THREE.CylinderGeometry(0.55, 0.65, H, 10), dark('#5c4c3d'), x, H / 2, side * (W / 2 - 0.6))          // clustered column
                add(new THREE.CylinderGeometry(0.25, 0.25, H, 6), dark('#4a3c30'), x - 0.6, H / 2, side * (W / 2 - 0.4))
                add(new THREE.CylinderGeometry(0.25, 0.25, H, 6), dark('#4a3c30'), x + 0.6, H / 2, side * (W / 2 - 0.4))
                const rib = add(new THREE.BoxGeometry(0.35, Math.hypot(W / 2, 5) + 0.4, 0.4), wood, x, H + 2.45, side * W / 4)
                rib.rotateX(side < 0 ? - (Math.PI / 2 - slope) : (Math.PI / 2 - slope))
                // torch sconce on the column
                add(new THREE.BoxGeometry(0.2, 0.6, 0.2), dark('#222'), x, 6, side * (W / 2 - 1.3))
                add(new THREE.SphereGeometry(0.28, 8, 6), flame, x, 6.5, side * (W / 2 - 1.3))
            }
        }
        // pointed arches between columns along each wall (frame the portraits)
        for(let x = - Lh / 2 + 6; x <= Lh / 2 - 6; x += 6)
            for(const side of [ - 1, 1 ])
            {
                const arch = new THREE.Shape()
                arch.moveTo(- 2.6, 0); arch.lineTo(- 2.6, 9); arch.quadraticCurveTo(- 2.6, 12.5, 0, 14); arch.quadraticCurveTo(2.6, 12.5, 2.6, 9); arch.lineTo(2.6, 0)
                arch.lineTo(2.3, 0); arch.lineTo(2.3, 9); arch.quadraticCurveTo(2.3, 12.2, 0, 13.5); arch.quadraticCurveTo(- 2.3, 12.2, - 2.3, 9); arch.lineTo(- 2.3, 0)
                add(new THREE.ShapeGeometry(arch), dark('#5c4c3d'), x - 3, 0, side * (W / 2 - 0.05), 0, side < 0 ? 0 : Math.PI)
            }
        // two long feast tables with benches, gold plates and candlesticks
        for(const z of [ - 3.2, 3.2 ])
        {
            add(new THREE.BoxGeometry(Lh - 26, 0.2, 2.2), wood, - 2, 1.4, z)
            for(const dz of [ - 1.7, 1.7 ])
                add(new THREE.BoxGeometry(Lh - 26, 0.15, 0.7), wood, - 2, 0.8, z + dz)
            for(let x = - Lh / 2 + 16; x < Lh / 2 - 14; x += 1.6)
            {
                add(new THREE.CylinderGeometry(0.28, 0.28, 0.04, 12), gold, x, 1.53, z - 0.6)
                add(new THREE.CylinderGeometry(0.28, 0.28, 0.04, 12), gold, x, 1.53, z + 0.6)
                if(Math.round(x * 10) % 48 === 0)
                {
                    add(new THREE.CylinderGeometry(0.06, 0.1, 0.7, 6), gold, x, 1.85, z)
                    add(new THREE.SphereGeometry(0.1, 6, 4), flame, x, 2.3, z)
                }
            }
        }
        // hundreds of floating candles under the vault (they bob gently)
        const candleGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.5, 6)
        const flameGeo = new THREE.SphereGeometry(0.08, 6, 4).scale(1, 1.6, 1)
        const n = 260
        this.candles = { body: new THREE.InstancedMesh(candleGeo, candle, n), flame: new THREE.InstancedMesh(flameGeo, flame, n), base: [] }
        for(let i = 0; i < n; i++)
            this.candles.base.push([ (rnd() - 0.5) * (Lh - 8), 9 + rnd() * 5, (rnd() - 0.5) * (W - 5), rnd() * 6 ])
        for(const m of [ this.candles.body, this.candles.flame ]) { m.frustumCulled = false; hall.add(m) }
        // house banners hanging from the vault
        const colors = [ '#7d0f22', '#1f4a2c', '#1d3363', '#b8901f' ]
        let b = 0
        for(let x = - Lh / 2 + 9; x <= Lh / 2 - 9; x += 12)
            for(const side of [ - 1, 1 ])
            {
                add(plane(1.8, 4.5), dark(colors[b++ % 4]), x, H - 3, side * (W / 2 - 2.5), 0, Math.PI / 2)
                add(new THREE.CylinderGeometry(0.05, 0.05, 2.2, 4), gold, x, H - 0.7, side * (W / 2 - 2.5), 0, 0, Math.PI / 2)
            }
        // the far end: a dais and the tall gothic window (the video plays inside its arch)
        add(new THREE.BoxGeometry(6, 0.6, W - 1), dark('#4a3c30'), - Lh / 2 + 3, 0.3, 0)
        const win = new THREE.Shape()
        win.moveTo(- 6, 0); win.lineTo(- 6, 9); win.quadraticCurveTo(- 6, 15, 0, 18); win.quadraticCurveTo(6, 15, 6, 9); win.lineTo(6, 0); win.lineTo(- 6, 0)
        add(new THREE.ShapeGeometry(win), dark('#1a2440'), - Lh / 2 + 0.05, 2, 0, 0, Math.PI / 2)
        // entrance doors behind the start point, glowing outside light
        add(plane(5, 7), dark('#ffd8a0'), Lh / 2 - 0.05, 3.5, 0, 0, - Math.PI / 2)

        this.game.scene.add(hall)
        hall.visible = false
        this.hall = hall
        this.hallAdd = add
    }

    /** Portraits hung salon-style up both walls (big and small, at different heights, each in an ornate gold frame
     *  fitted to its photo), and the video in the great window */
    placeHallMedia()
    {
        const { W, H, L } = this.hallSize
        const photos = this.theatre.items.filter(i => i.type === 'photo')
        const frameColors = [ '#c9a227', '#a7791c', '#d8b54a', '#8a5a1c' ]
        // slots: every bay between columns gets a large portrait plus smaller ones above / beside it
        const slots = []
        for(let x = L / 2 - 9; x >= - L / 2 + 12; x -= 6)
            for(const side of [ - 1, 1 ])
            {
                slots.push({ x, y: 5.2, side, max: [ 3.6, 4.4 ] })
                slots.push({ x: x - 1.2, y: 10.2, side, max: [ 2.0, 2.4 ] })
                slots.push({ x: x + 1.3, y: 10.6, side, max: [ 1.6, 2.0 ] })
            }
        // order: big ones first so every photo gets a prominent spot before the small ones repeat
        const ordered = [ ...slots.filter(s => s.max[0] > 3), ...slots.filter(s => s.max[0] <= 3) ]
        const used = ordered.slice(0, Math.max(photos.length, Math.min(ordered.length, photos.length * 2)))
        used.forEach((slot, i) =>
        {
            const item = photos[i % photos.length]
            const z = slot.side * (W / 2 - 0.12)
            const ry = slot.side < 0 ? 0 : Math.PI
            const tilt = (Math.sin(i * 12.9) * 0.03)
            const frameMat = this.flat(null, frameColors[i % frameColors.length])
            const outer = this.hallAdd(new THREE.BoxGeometry(1, 1, 0.18), frameMat, slot.x, slot.y, z, 0, ry, tilt)
            const inner = this.hallAdd(new THREE.BoxGeometry(1, 1, 0.2), this.flat(null, '#5a3a14'), slot.x, slot.y, z - slot.side * 0.02, 0, ry, tilt)
            const pic = new THREE.MeshBasicNodeMaterial({ side: THREE.DoubleSide })
            pic.fog = false
            const mesh = this.hallAdd(new THREE.PlaneGeometry(1, 1), pic, slot.x, slot.y, z - slot.side * 0.13, 0, ry, tilt)
            mesh.visible = false
            const img = new Image()
            img.onload = () =>
            {
                const t = new THREE.Texture(img)
                t.colorSpace = THREE.SRGBColorSpace
                t.anisotropy = 8
                t.needsUpdate = true
                pic.colorNode = texture(t)
                pic.needsUpdate = true
                const a = img.width / img.height
                let w = slot.max[0], h = w / a
                if(h > slot.max[1]) { h = slot.max[1]; w = h * a }
                mesh.scale.set(w, h, 1)
                inner.scale.set(w + 0.18, h + 0.18, 1)
                outer.scale.set(w + 0.55, h + 0.55, 1)
                mesh.visible = true
            }
            img.src = slot.max[0] > 3 ? item.full : item.thumb      // big portraits in full quality
        })
        // video in the great window
        const videos = this.theatre.items.filter(i => i.type === 'video')
        if(videos.length)
        {
            const video = document.createElement('video')
            video.muted = true
            video.playsInline = true
            video.crossOrigin = 'anonymous'
            let index = 0
            const play = () => { video.src = videos[index].full; video.play().catch(() => {}) }
            video.addEventListener('ended', () => { index = (index + 1) % videos.length; play() })
            const map = new THREE.VideoTexture(video)
            map.colorSpace = THREE.SRGBColorSpace
            const mat = new THREE.MeshBasicNodeMaterial()
            mat.colorNode = texture(map)
            mat.fog = false
            const screen = this.hallAdd(new THREE.PlaneGeometry(1, 1), mat, - L / 2 + 0.2, 9, 0, 0, Math.PI / 2)
            const frame = this.hallAdd(new THREE.BoxGeometry(1, 1, 0.2), this.flat(null, '#c9a227'), - L / 2 + 0.1, 9, 0, 0, Math.PI / 2)
            const fit = () => { const a = video.videoWidth / video.videoHeight || 16 / 9; let h = 11, w = h * a; if(w > 11) { w = 11; h = w / a } screen.scale.set(w, h, 1); frame.scale.set(w + 0.6, h + 0.6, 1) }
            fit()
            video.addEventListener('loadedmetadata', fit)
            this.hallVideo = { video, play }
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
            <div class="ct-help">方向鍵 / WASD 走動 · 拖曳滑鼠或手指環顧四周</div>
            <div class="ct-controls">
                <button class="ct-sound">🔇 影片聲音</button>
                <button class="ct-exit">離開城堡 →</button>
            </div>`
        document.body.append(el)
        this.theatre.el = el
        this.walker = { pos: new THREE.Vector3(), yaw: 0, pitch: 0.12, keys: new Set(), idle: 0 }
        this.override = { position: new THREE.Vector3(), quaternion: new THREE.Quaternion() }
        el.querySelector('.ct-sound').addEventListener('click', (e) =>
        {
            if(!this.hallVideo) return
            this.hallVideo.video.muted = !this.hallVideo.video.muted
            e.currentTarget.textContent = this.hallVideo.video.muted ? '🔇 影片聲音' : '🔊 影片聲音'
        })
        el.querySelector('.ct-exit').addEventListener('click', () => this.closeTheatre())
        const keyName = (e) => ({ ArrowUp: 'f', KeyW: 'f', ArrowDown: 'b', KeyS: 'b', ArrowLeft: 'l', KeyA: 'l', ArrowRight: 'r', KeyD: 'r' })[e.code]
        addEventListener('keydown', (e) =>
        {
            if(!this.theatre.open) return
            if(e.key === 'Escape') this.closeTheatre()
            const k = keyName(e); if(k) this.walker.keys.add(k)
            e.stopPropagation(); e.preventDefault()
        }, true)
        addEventListener('keyup', (e) => { const k = keyName(e); if(k) this.walker.keys.delete(k) }, true)
        // look around by dragging (mouse or one finger); two fingers / long press walks forward on phones
        let last = null, touches = 0
        el.addEventListener('pointerdown', (e) => { if(e.target.closest('button')) return; last = [ e.clientX, e.clientY ]; touches++; if(touches >= 2) this.walker.keys.add('f'); el.setPointerCapture(e.pointerId) })
        el.addEventListener('pointermove', (e) =>
        {
            if(!last) return
            this.walker.yaw -= (e.clientX - last[0]) * 0.004
            this.walker.pitch = Math.max(- 0.6, Math.min(0.9, this.walker.pitch - (e.clientY - last[1]) * 0.004))
            last = [ e.clientX, e.clientY ]
            this.walker.idle = 0
        })
        const up = () => { last = null; touches = Math.max(0, touches - 1); if(touches < 2) this.walker.keys.delete('f') }
        el.addEventListener('pointerup', up)
        el.addEventListener('pointercancel', up)
    }

    openTheatre()
    {
        if(!this.theatre.items.length)
            return
        if(!this.hall) { this.buildHall(); this.placeHallMedia() }
        this.theatre.open = true
        this.hall.visible = true
        this.savedFilters = [ ...this.game.inputs.filters ]
        this.game.inputs.filters.clear()
        this.game.inputs.filters.add('modal')
        this.theatre.el.classList.add('is-open')
        document.documentElement.classList.add('has-modal-open', 'is-in-castle')
        this.hallVideo?.play()
        // stand just inside the doors, looking down the hall
        this.walker.pos.set(this.hallSize.L / 2 - 3, 1.8, 0)
        this.walker.yaw = Math.PI / 2
        this.walker.pitch = 0.12
        this.walker.idle = 0
        this.game.view.cameraOverride = this.override
        const camera = this.game.view.camera
        this.savedFov = camera.fov
        camera.fov = 62
        camera.updateProjectionMatrix()
    }

    closeTheatre()
    {
        if(!this.theatre.open)
            return
        this.theatre.open = false
        this.theatre.cooldown = true
        this.walker.keys.clear()
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
        const w = this.walker
        const t = performance.now() / 1000
        // walk: forward is where you look (flat), strafe sideways
        const fx = - Math.sin(w.yaw), fz = - Math.cos(w.yaw)
        let mx = 0, mz = 0
        if(w.keys.has('f')) { mx += fx; mz += fz }
        if(w.keys.has('b')) { mx -= fx; mz -= fz }
        if(w.keys.has('l')) { mx += fz; mz -= fx }
        if(w.keys.has('r')) { mx -= fz; mz += fx }
        const moving = mx || mz
        if(moving)
        {
            const len = Math.hypot(mx, mz)
            w.pos.x += mx / len * 6 * dt
            w.pos.z += mz / len * 6 * dt
            w.idle = 0
        }
        else
        {
            // left alone, drift slowly down the hall, gazing at the portraits
            w.idle += dt
            if(w.idle > 4)
            {
                w.pos.x -= 1.2 * dt
                w.yaw = Math.PI / 2 + Math.sin(t * 0.25) * 0.9
                if(w.pos.x < - this.hallSize.L / 2 + 14) w.pos.x = this.hallSize.L / 2 - 3
            }
        }
        const { W, L } = this.hallSize
        w.pos.x = Math.max(- L / 2 + 7, Math.min(L / 2 - 2, w.pos.x))
        w.pos.z = Math.max(- W / 2 + 2, Math.min(W / 2 - 2, w.pos.z))
        const bob = moving ? Math.sin(t * 9) * 0.05 : 0
        this.override.position.copy(w.pos).add(this.hallOrigin).add(new THREE.Vector3(0, bob, 0))
        this.override.quaternion.setFromEuler(new THREE.Euler(w.pitch, w.yaw, 0, 'YXZ'))
        // floating candles bob and flicker
        const c = this.candles, m = new THREE.Matrix4()
        c.base.forEach(([ x, y, z, ph ], i) =>
        {
            const yy = y + Math.sin(t * 0.8 + ph) * 0.15
            m.makeTranslation(x, yy, z)
            c.body.setMatrixAt(i, m)
            const s = 0.85 + Math.sin(t * 14 + ph * 3) * 0.15
            m.makeScale(s, s, s).setPosition(x, yy + 0.33, z)
            c.flame.setMatrixAt(i, m)
        })
        c.body.instanceMatrix.needsUpdate = true
        c.flame.instanceMatrix.needsUpdate = true
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
