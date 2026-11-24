import { clamp } from 'three/src/math/MathUtils.js'
import { Game } from './Game.js'
import { stops, dogs as dogsData, turkey } from '../data/worldData.js'
import { paints } from '../data/paints.js'

const dogMarkerCss = /* css */`
.map-dog { position: absolute; left: 0; top: 0; pointer-events: none; z-index: 2000; transition: left 0.25s linear, top 0.25s linear; }
.map-dog .map-dog-pin { position: absolute; width: 34px; height: 34px; left: -17px; top: -17px; border-radius: 50%; border: 3px solid var(--ring); background: #fff8ee; box-shadow: 0 2px 8px rgba(0,0,0,0.45); overflow: hidden; }
.map-dog .map-dog-arrow { position: absolute; left: -7px; top: -29px; width: 0; height: 0; border-left: 7px solid transparent; border-right: 7px solid transparent; border-bottom: 11px solid var(--ring); transform-origin: 7px 29px; }
.map-dog .map-dog-name { position: absolute; left: 0; top: 18px; transform: translateX(-50%); padding: 1px 8px; border-radius: 999px; background: var(--fill); color: #fff; border: 2px solid var(--ring); font-size: 13px; white-space: nowrap; font-family: "LXGW WenKai TC", "Noto Sans TC", "PingFang TC", sans-serif; }
.map-dog.is-home .map-dog-pin { opacity: 0.85; }
.map-cablecar .map-dog-pin { display: grid; place-items: center; font-size: 19px; line-height: 1; }
.map-dog-house { position: absolute; transform: translate(-50%, -135%); padding: 1px 8px; border-radius: 6px; background: rgba(255, 248, 238, 0.92); color: #3a2a20; border: 2px solid var(--ring); font-size: 12px; white-space: nowrap; pointer-events: none; font-family: "LXGW WenKai TC", "Noto Sans TC", "PingFang TC", sans-serif; }
@media only screen and (max-width: 600px) { .map-dog .map-dog-pin { width: 22px; height: 22px; left: -11px; top: -11px; font-size: 12px; } .map-dog .map-dog-name, .map-dog-house { font-size: 10px; } }
`

/** Map colors of the two dogs (fur + collar) */
export const dogColors = {
    // 小可: chocolate toy poodle (boy, blue). Dookie: bernese mountain dog (girl, pink)
    xiaoke: { fill: '#6b3f26', ring: '#2f7fe0', house: '小可的家', icon: `<svg viewBox="0 0 32 32" width="100%" height="100%"><circle cx="7" cy="15" r="5.5" fill="#5a331e"/><circle cx="25" cy="15" r="5.5" fill="#5a331e"/><circle cx="16" cy="9" r="6" fill="#7a4a2c"/><circle cx="16" cy="17" r="9" fill="#7b4a2e"/><ellipse cx="16" cy="21.5" rx="4.6" ry="3.6" fill="#94603c"/><circle cx="12.3" cy="15.5" r="1.5" fill="#140c0a"/><circle cx="19.7" cy="15.5" r="1.5" fill="#140c0a"/><ellipse cx="16" cy="20" rx="1.9" ry="1.4" fill="#140c0a"/><rect x="10" y="26" width="12" height="2.6" rx="1.3" fill="#2f7fe0"/></svg>` },
    dookie: { fill: '#1d1717', ring: '#ff6fae', house: 'Dookie 的家', icon: `<svg viewBox="0 0 32 32" width="100%" height="100%"><path d="M4 11 Q3 22 9 24 L11 12 Z" fill="#141010"/><path d="M28 11 Q29 22 23 24 L21 12 Z" fill="#141010"/><circle cx="16" cy="16" r="10" fill="#1d1717"/><path d="M14.4 6.5 H17.6 L18.6 17 H13.4 Z" fill="#f3ede4"/><ellipse cx="16" cy="21.5" rx="5.6" ry="4.4" fill="#f3ede4"/><circle cx="10.8" cy="18" r="2.1" fill="#b5602c"/><circle cx="21.2" cy="18" r="2.1" fill="#b5602c"/><circle cx="11.8" cy="13.6" r="1.1" fill="#b5602c"/><circle cx="20.2" cy="13.6" r="1.1" fill="#b5602c"/><circle cx="12" cy="15.4" r="1.4" fill="#0f0908"/><circle cx="20" cy="15.4" r="1.4" fill="#0f0908"/><ellipse cx="16" cy="19.6" rx="2" ry="1.4" fill="#140c0a"/><path d="M22 4 L26 2 L26 7 Z M22 4 L18.5 2.5 L19 7 Z" fill="#ff6fae"/><circle cx="22" cy="4.6" r="1.2" fill="#ff6fae"/></svg>` },
}

export class Map
{
    constructor()
    {
        this.game = Game.getInstance()

        this.initiated = false
        this.modal = this.game.modals.items.get('map')
        this.element = this.modal.element.querySelector('.js-map-container')

        this.setTrigger()
        this.setInputs()
        for(const src of [ 'ui/map/map-day.webp', 'ui/map/map-night.webp' ])
            new Image().src = src

        this.modal.events.on('open', () =>
        {
            if(!this.initiated)
                this.init()

            this.texture.update()
            this.updateLocationStates()
        })
    }

    init()
    {
        this.initiated = true
        
        this.setLocations()
        this.setPlayer()
        this.setTexture()

        this.game.ticker.events.on('tick', () =>
        {
            this.update()
        }, 14)
    }

    setLocations()
    {
        this.locations = {}
        this.locations.items = stops.map((stop) => ({
            name: `${stop.label}<br />${stop.name}`,
            stop,
            respawnName: stop.id,
            position: stop.position,
            offset: { x: 0, y: 0 },
        }))
        // the giant Thanksgiving turkey is a teleport point too
        this.locations.items.push({
            name: '感恩節火雞',
            stop: null,
            icon: '🦃',
            respawnName: 'turkey',
            position: { x: turkey.x, z: turkey.z },
            offset: { x: 0, y: 0 },
        })

        for(const item of this.locations.items)
        {
            const mapPosition = this.worldToMap(item.position)

            // HTML
            const html = /* html */`
                <div class="pin is-numbered${item.stop ? '' : ' is-extra'}"><span>${item.stop ? item.stop.order : item.icon}</span></div>
                <div class="name-container">
                    <div class="name">${item.name}</div>
                </div>
            `

            const element = document.createElement('div')
            element.classList.add('location')
            element.innerHTML = html
            element.style.left = `${(mapPosition.x + item.offset.x)* 100}%`
            element.style.top = `${(mapPosition.y + item.offset.y)* 100}%`
            element.style.zIndex = Math.round(mapPosition.y * 1000)
            
            this.element.append(element)
            item.element = element

            element.addEventListener('click', () =>
            {
                this.game.player.respawn(item.respawnName, () =>
                {
                    this.game.view.focusPoint.isTracking = true
                })
                this.game.modals.close()
            })
        }
    }
    
    updateLocationStates()
    {
        const group = this.game.achievements.groups.get('stops')
        const done = group && group.progress instanceof Set ? group.progress : new Set()
        const next = this.game.world.guide?.target
        for(const item of this.locations.items)
        {
            if(!item.stop)
                continue
            item.element.classList.toggle('is-done', done.has(item.stop.id))
            item.element.classList.toggle('is-next', next?.id === item.stop.id)
        }
    }

    setPlayer()
    {
        this.player = {}
        this.player.element = this.element.querySelector('.js-player')
        this.player.roundedPosition = { x: 0, y: 0 }

        // the car icon (drawn light blue) follows the paint picked in the achievements tab
        const hsl = (hex) =>
        {
            const n = parseInt(hex.slice(1), 16)
            const r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255
            const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min
            if(d === 0) return { h: 0, s: 0, l }
            const s = d / (1 - Math.abs(2 * l - 1))
            const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
            return { h: (h * 60 + 360) % 360, s, l }
        }
        const base = hsl('#3f86e0')
        const tint = (rewardName) =>
        {
            const paint = paints.find(p => p.name === rewardName)
            let filter = ''
            if(paint?.colors)
            {
                const c = hsl(paint.colors[1])
                if(c.s < 0.12)
                    filter = `grayscale(1) brightness(${(0.55 + c.l * 1.4).toFixed(2)})`
                else
                    filter = `hue-rotate(${Math.round(c.h - base.h)}deg) saturate(${(c.s / base.s).toFixed(2)})`
            }
            else if(rewardName === 'flames')
                filter = 'hue-rotate(170deg) saturate(1.6)'
            else if(rewardName === 'abyssal')
                filter = 'hue-rotate(40deg) brightness(0.7)'
            this.player.element.style.filter = filter
        }
        tint(this.game.achievements.rewards.current?.name)
        this.game.achievements.events.on('rewardActiveChange', (reward) => tint(reward.name))

        // live markers for 小可 and Dookie, and labels on their houses
        const style = document.createElement('style')
        style.textContent = dogMarkerCss
        document.head.append(style)
        this.dogMarkers = dogsData.map((data) =>
        {
            const colors = dogColors[data.id] || dogColors.xiaoke
            const element = document.createElement('div')
            element.className = 'map-dog'
            element.style.setProperty('--fill', colors.fill)
            element.style.setProperty('--ring', colors.ring)
            element.innerHTML = `<div class="map-dog-arrow"></div><div class="map-dog-pin">${colors.icon}</div><div class="map-dog-name">${data.name}</div>`
            this.element.append(element)

            const house = document.createElement('div')
            house.className = 'map-dog-house'
            house.style.setProperty('--ring', colors.ring)
            house.textContent = `🏠 ${colors.house}`
            const housePosition = this.worldToMap(data.home)
            house.style.left = `${housePosition.x * 100}%`
            house.style.top = `${housePosition.y * 100}%`
            this.element.append(house)

            return { id: data.id, element, arrow: element.querySelector('.map-dog-arrow') }
        })

        // the cable car's live position (it roams every mainland street)
        const car = document.createElement('div')
        car.className = 'map-dog map-cablecar'
        car.style.setProperty('--fill', '#b3122b')
        car.style.setProperty('--ring', '#f1c84a')
        car.innerHTML = `<div class="map-dog-arrow"></div><div class="map-dog-pin">🚋</div><div class="map-dog-name">叮噹車</div>`
        this.element.append(car)
        this.cableCarMarker = { element: car, arrow: car.querySelector('.map-dog-arrow') }
    }

    updateCableCar()
    {
        const car = this.game.world?.areas?.lombard?.cableCar
        const marker = this.cableCarMarker
        if(!marker)
            return
        marker.element.style.display = car ? '' : 'none'
        if(!car)
            return
        const position = this.worldToMap({ x: car.position.x, z: car.position.z })
        marker.element.style.left = `${(position.x * 100).toFixed(2)}%`
        marker.element.style.top = `${(position.y * 100).toFixed(2)}%`
        marker.arrow.style.transform = `rotate(${(Math.PI - (car.yaw ?? 0)).toFixed(3)}rad)`
    }

    updateDogs()
    {
        const dogs = this.game.world?.dogs?.items
        if(!dogs || !this.dogMarkers)
            return
        for(const marker of this.dogMarkers)
        {
            const dog = dogs.find(d => d.data.id === marker.id)
            if(!dog)
                continue
            const p = dog.body.translation()
            const position = this.worldToMap({ x: dog.sleepPosition ? dog.sleepPosition.x : p.x, z: dog.sleepPosition ? dog.sleepPosition.z : p.z })
            marker.element.style.left = `${(position.x * 100).toFixed(2)}%`
            marker.element.style.top = `${(position.y * 100).toFixed(2)}%`
            marker.arrow.style.transform = `rotate(${(Math.PI - dog.facing).toFixed(3)}rad)`
            marker.element.classList.toggle('is-home', dog.state === 'sleep')
        }
    }
    
    setTexture()
    {
        this.texture = {}
        this.texture.element = this.element.querySelector('.js-texture')
        this.texture.previousUrl = null

        // warm both maps up front so opening the map is instant
        for(const src of [ 'ui/map/map-day.webp', 'ui/map/map-night.webp' ])
            new Image().src = src
        this.texture.element.addEventListener('load', () =>
        {
            this.texture.element.classList.add('is-visible')
        })
        
        this.texture.update = () =>
        {
            const url = this.game.dayCycles.intervalEvents.get('night').inInterval ? 'ui/map/map-night.webp' : 'ui/map/map-day.webp'

            if(url !== this.texture.previousUrl)
            {
                this.texture.element.classList.remove('is-visible')
                this.texture.previousUrl = url
                this.texture.element.src = url
            }
            // already loaded (cached) images may not fire 'load' again
            if(this.texture.element.complete && this.texture.element.naturalWidth > 0)
                this.texture.element.classList.add('is-visible')
        }
    }

    setTrigger()
    {
        const element = this.game.domElement.querySelector('.js-map-trigger')
        
        element.addEventListener('click', (event) =>
        {
            this.game.modals.open('map')
        })
        element.addEventListener('keydown', (event) =>
        {
            event.preventDefault()
        })
    }

    setInputs()
    {
        // Inputs keyboard
        this.game.inputs.addActions([
            { name: 'map', categories: [ 'modal', 'menu', 'wandering' ], keys: [ 'Keyboard.m', 'Keyboard.KeyM' ] },
        ])
        this.game.inputs.events.on('map', (action) =>
        {
            if(action.active)
            {
                if(!this.modal.isOpen)
                    this.game.modals.open('map')
                else
                    this.game.modals.close()
            }
        })
    }

    worldToMap(coordinates)
    {
        let x = coordinates.x
        let y = typeof coordinates.z !== 'undefined' ? coordinates.z : coordinates.y

        x /= this.game.terrain.size
        y /= this.game.terrain.size

        x += 0.5
        y += 0.5

        x = clamp(x, 0, 1)
        y = clamp(y, 0, 1)

        return { x, y }
    }

    update()
    {
        if(!this.modal.isOpen)
            return

        this.updateDogs()
        this.updateCableCar()

        const playerRoundedX = Math.round(this.game.player.position.x)
        const playerRoundedY = Math.round(this.game.player.position.z)

        if(playerRoundedX !== this.player.roundedPosition.x || playerRoundedY !== this.player.roundedPosition.y)
        {
            this.player.roundedPosition.x = playerRoundedX
            this.player.roundedPosition.y = playerRoundedY

            const playerCoordinates = this.worldToMap(this.player.roundedPosition)
            const x = Math.round(playerCoordinates.x * 1000) / 10
            const y = Math.round(playerCoordinates.y * 1000) / 10

            this.player.element.style.left = `${x}%`
            this.player.element.style.top = `${y}%`
            this.player.element.style.transform = `rotate(${-this.game.physicalVehicle.yRotation}rad)`
        }
    }
}