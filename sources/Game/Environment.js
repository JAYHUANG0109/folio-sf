import * as THREE from 'three/webgpu'
import gsap from 'gsap'
import { Howler } from 'howler'
import { color } from 'three/tsl'
import { Game } from './Game.js'
import { account } from './Account.js'

const STORAGE_KEY = 'sf-trip-environment-v1'

export const TIMES = [
    { id: 'auto', label: '自動', icon: '🔄' },
    { id: 'day', label: '白天', icon: '☀️', progress: 0.06 },
    { id: 'dusk', label: '黃昏', icon: '🌇', progress: 0.24 },
    { id: 'night', label: '夜晚', icon: '🌙', progress: 0.47 },
]
export const WEATHERS = [
    { id: 'auto', label: '自動', icon: '🔄' },
    { id: 'sunny', label: '晴天', icon: '☀️', values: { clouds: - 0.7, rain: 0, wind: 0.25, electricField: 0, humidity: 0.4 } },
    { id: 'cloudy', label: '多雲', icon: '☁️', values: { clouds: 0.85, rain: 0, wind: 0.4, electricField: 0, humidity: 0.6 } },
    { id: 'rain', label: '下雨', icon: '🌧️', values: { clouds: 1, rain: 0.75, wind: 0.5, electricField: 0, humidity: 1 } },
    { id: 'windy', label: '起風', icon: '🌬️', values: { clouds: 0.3, rain: 0, wind: 1, electricField: 0, humidity: 0.5 } },
    { id: 'storm', label: '雷雨', icon: '⛈️', values: { clouds: 1, rain: 1, wind: 0.9, electricField: 1, humidity: 1 } },
]
export const SEASONS = [
    { id: 'auto', label: '自動', icon: '🔄' },
    { id: 'spring', label: '春', icon: '🌸', progress: 0.375, temperature: 15 },
    { id: 'summer', label: '夏', icon: '🌻', progress: 0.625, temperature: 26 },
    { id: 'fall', label: '秋', icon: '🍁', progress: 0.875, temperature: 14 },
    { id: 'winter', label: '冬', icon: '❄️', progress: 0.125, temperature: - 8 },
]

// what every plant looks like in each season [colorA, colorB]
const PALETTES = {
    spring: { birch: [ '#7fc34a', '#b8e36c' ], oak: [ '#6fb33c', '#a6d85a' ], cherry: [ '#f2a3c4', '#ffd6e6' ], redwood: [ '#2f6b33', '#5a9e45' ], bushes: [ '#6fa83a', '#b0d65a' ], grass: '#8cc63f', leaves: [ '#ffc2d9', '#fff0f5' ], showLeaves: true },
    summer: { birch: [ '#3f8f2e', '#6fb83d' ], oak: [ '#357a28', '#5ea83a' ], cherry: [ '#3c8a34', '#66b044' ], redwood: [ '#244f27', '#3f7d33' ], bushes: [ '#4c8a30', '#7fb045' ], grass: '#7cc444', leaves: [ '#3c8a34', '#66b044' ], showLeaves: false },
    fall: { birch: [ '#e8452c', '#ff8a3d' ], oak: [ '#e39b2d', '#f6c64a' ], cherry: [ '#c4232b', '#f0553a' ], redwood: [ '#2b5a2c', '#4c8a3a' ], bushes: [ '#a8782a', '#d9a441' ], grass: '#8ebd4a', leaves: [ '#c0392b', '#ffa62b' ], showLeaves: true },
    winter: { birch: [ '#cfdbe3', '#ffffff' ], oak: [ '#c7d4dd', '#f3f7fa' ], cherry: [ '#d3dee6', '#ffffff' ], redwood: [ '#3b5d47', '#e4eef2' ], bushes: [ '#c9d6de', '#f6f9fb' ], grass: '#e9eff3', leaves: [ '#ffffff', '#e8f0f6' ], showLeaves: false },
}

/**
 * Time of day, weather and season: each is either automatic (rotating like before) or locked to one choice.
 * Choices are a per-device preference (localStorage), applied with smooth transitions.
 */
export class Environment
{
    constructor()
    {
        this.game = Game.getInstance()
        this.state = { time: 'auto', weather: 'auto', season: 'auto' }
        try { Object.assign(this.state, JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')) } catch(e) {}
        this.currentSeason = null
        this.setLightning()
        this.apply(0)
        this.game.ticker.events.on('tick', () => this.update(), 13)
    }

    set(kind, id)
    {
        if(!account.user)
            return

        this.state[kind] = id
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state)) } catch(e) {}
        this.apply(2.5)
    }

    seasonId()
    {
        if(this.state.season !== 'auto')
            return this.state.season
        // automatic: the real season right now (the trip is in late November: fall)
        const month = new Date().getMonth()
        return [ 'winter', 'winter', 'spring', 'spring', 'spring', 'summer', 'summer', 'summer', 'fall', 'fall', 'fall', 'winter' ][month]
    }

    apply(duration = 2.5)
    {
        const { dayCycles, yearCycles, weather } = this.game

        // time of day
        const time = TIMES.find(t => t.id === this.state.time)
        if(time?.progress !== undefined)
            dayCycles.override.start({ progress: time.progress }, duration)
        else
            dayCycles.override.end(duration)

        // season (drives temperature, how leafy, the year cycle presets)
        const season = SEASONS.find(s => s.id === this.state.season)
        if(season?.progress !== undefined)
            yearCycles.override.start({ progress: season.progress }, duration)
        else
            yearCycles.override.end(duration)

        // weather: a preset, plus the season's temperature (rain in winter falls as snow, and winter always snows a little)
        const preset = WEATHERS.find(w => w.id === this.state.weather)
        const seasonId = this.seasonId()
        const values = { ...(preset?.values || {}) }
        if(this.state.season !== 'auto')
            values.temperature = season.temperature
        if(seasonId === 'winter' && this.state.season !== 'auto')
        {
            values.temperature = - 8
            if(values.rain === undefined || values.rain < 0.45)
                values.rain = 0.5
            if(values.clouds === undefined || values.clouds < 0.6)
                values.clouds = 0.7
        }
        if(seasonId === 'fall' && values.wind === undefined)
            values.wind = 0.6
        if(Object.keys(values).length)
            weather.override.start(values, duration)
        else
            weather.override.end(duration)

        this.applySeasonColors(seasonId, duration)
        this.applySeasonCover(seasonId, duration)
    }

    /* snow on the ground and on every roof in winter (melts away otherwise), fallen leaves on the tops in fall */
    applySeasonCover(seasonId, duration)
    {
        this.snowTarget = seasonId === 'winter' ? 0.15 : - 1
        const materials = this.game.materials
        if(!materials?.snowCover)
            return
        const snow = seasonId === 'winter' ? 1 : 0
        const leaves = seasonId === 'fall' ? 1 : 0
        gsap.to(materials.snowCover, { value: snow, duration: duration ? Math.max(duration, 4) : 0, overwrite: true })
        gsap.to(materials.leafCover, { value: leaves, duration: duration ? Math.max(duration, 4) : 0, overwrite: true })
    }

    applySeasonColors(seasonId, duration)
    {
        const world = this.game.world
        if(seasonId === this.currentSeason || !world?.oakTrees)
            return
        this.currentSeason = seasonId
        const palette = PALETTES[seasonId]
        const tween = (uniform, hex) =>
        {
            if(!uniform?.value)
                return
            const target = new THREE.Color(hex)
            if(duration === 0)
                uniform.value.copy(target)
            else
                gsap.to(uniform.value, { r: target.r, g: target.g, b: target.b, duration, ease: 'power1.inOut' })
        }
        for(const [ key, trees ] of [ [ 'birch', world.birchTrees ], [ 'oak', world.oakTrees ], [ 'cherry', world.cherryTrees ], [ 'redwood', world.redwoods ] ])
        {
            tween(trees?.leavesColorA, palette[key][0])
            tween(trees?.leavesColorB, palette[key][1])
        }
        tween(world.bushes?.colorANode, palette.bushes[0])
        tween(world.bushes?.colorBNode, palette.bushes[1])
        tween(this.game.terrain.grassColorUniform, palette.grass)
        tween(world.leaves?.colorA, palette.leaves[0])
        tween(world.leaves?.colorB, palette.leaves[1])
        if(world.leaves?.mesh)
            world.leaves.mesh.visible = palette.showLeaves
    }

    /* Thunderstorm: lightning bolts in the sky near the car, a white flash, rolling thunder */
    setLightning()
    {
        this.flash = document.createElement('div')
        this.flash.style.cssText = 'position:fixed;inset:0;background:#e8f0ff;opacity:0;pointer-events:none;z-index:5;mix-blend-mode:screen'
        document.body.append(this.flash)
        const empty = new THREE.BufferGeometry()
        empty.setAttribute('position', new THREE.Float32BufferAttribute([ 0, 0, 0, 0, 0, 0, 0, 0, 0 ], 3))
        this.bolt = new THREE.Mesh(empty, new THREE.MeshBasicNodeMaterial())
        this.bolt.material.colorNode = color('#f4f8ff')
        this.bolt.visible = false
        this.bolt.frustumCulled = false
        this.game.scene.add(this.bolt)
        this.nextStrike = 4
    }

    strike()
    {
        const p = this.game.player.position
        const x = p.x + (Math.random() - 0.5) * 50, z = p.z - 10 - Math.random() * 30
        // a jagged bolt made of thin quads
        const positions = []
        let cx = x, cy = 45, cz = z
        while(cy > 0)
        {
            const nx = cx + (Math.random() - 0.5) * 3, ny = cy - 2 - Math.random() * 3, nz = cz + (Math.random() - 0.5) * 3
            const w = 0.18
            positions.push(cx - w, cy, cz, cx + w, cy, cz, nx + w, ny, nz, cx - w, cy, cz, nx + w, ny, nz, nx - w, ny, nz)
            cx = nx; cy = ny; cz = nz
        }
        this.bolt.geometry.dispose()
        this.bolt.geometry = new THREE.BufferGeometry()
        this.bolt.geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
        this.bolt.material.side = THREE.DoubleSide
        this.bolt.visible = true
        gsap.killTweensOf(this.flash.style)
        gsap.fromTo(this.flash.style, { opacity: 0.55 }, { opacity: 0, duration: 0.6, ease: 'power2.out' })
        setTimeout(() => { this.bolt.visible = false }, 180)
        setTimeout(() => this.thunder(), 300 + Math.random() * 1200)
    }

    thunder()
    {
        const ctx = Howler.ctx
        if(!ctx || !Howler.masterGain)
            return
        const length = Math.floor(ctx.sampleRate * 3.5)
        const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
        const data = buffer.getChannelData(0)
        let last = 0
        for(let i = 0; i < length; i++)
        {
            last = last * 0.985 + (Math.random() * 2 - 1) * 0.15
            const t = i / length
            data[i] = last * (t < 0.03 ? t / 0.03 : Math.pow(1 - t, 1.6)) * (1 + 0.6 * Math.sin(t * 40) * Math.sin(t * 7))
        }
        const src = ctx.createBufferSource()
        src.buffer = buffer
        const low = ctx.createBiquadFilter()
        low.type = 'lowpass'
        low.frequency.value = 500
        const g = ctx.createGain()
        g.gain.value = 1.2
        src.connect(low).connect(g).connect(Howler.masterGain)
        src.start()
    }

    update()
    {
        // automatic season: follow the calendar (changes only across months)
        if(this.state.season === 'auto' && this.seasonId() !== this.currentSeason)
        {
            this.applySeasonColors(this.seasonId(), 3)
            this.applySeasonCover(this.seasonId(), 3)
        }
        if(this.currentSeason === null && this.game.world)
            this.applySeasonColors(this.seasonId(), 0)

        if(this.state.weather === 'storm')
        {
            this.nextStrike -= this.game.ticker.delta
            if(this.nextStrike < 0)
            {
                this.strike()
                this.nextStrike = 5 + Math.random() * 9
            }
        }
    }
}
