import * as THREE from 'three/webgpu'
import { color } from 'three/tsl'
import { MeshDefaultMaterial } from '../../Materials/MeshDefaultMaterial.js'

const STORAGE_KEY = 'sf-trip-tasks-v1'

/** Completed task ids, persisted in the browser */
export const taskStore = {
    done: new Set(),
    load()
    {
        try { this.done = new Set(JSON.parse(localStorage.getItem(STORAGE_KEY)) || []) }
        catch(error) { this.done = new Set() }
    },
    save()
    {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify([ ...this.done ])) }
        catch(error) { /* private mode, keep in memory */ }
    },
    reset()
    {
        this.done.clear()
        this.save()
    },
}
taskStore.load()

const materialsCache = new Map()
function material(hex)
{
    if(!materialsCache.has(hex))
        materialsCache.set(hex, new MeshDefaultMaterial({ colorNode: color(hex), hasCoreShadows: true, hasDropShadows: false }))
    return materialsCache.get(hex)
}

function makeToken(icon)
{
    const group = new THREE.Group()
    const add = (geometry, hex, position = [ 0, 0, 0 ], rotation = [ 0, 0, 0 ], scale = [ 1, 1, 1 ]) =>
    {
        const mesh = new THREE.Mesh(geometry, material(hex))
        mesh.position.set(...position)
        mesh.rotation.set(...rotation)
        mesh.scale.set(...scale)
        mesh.castShadow = true
        group.add(mesh)
    }

    if(icon === 'oyster')
    {
        add(new THREE.IcosahedronGeometry(0.5, 1), '#c8c2c1', [ 0, 0, 0 ], [ 0, 0, 0 ], [ 1, 0.35, 0.8 ])
        add(new THREE.IcosahedronGeometry(0.18, 1), '#fff2e8', [ 0, 0.2, 0 ])
    }
    else if(icon === 'cookie')
    {
        add(new THREE.TorusGeometry(0.35, 0.16, 6, 10, Math.PI * 1.3), '#e4a90c', [ 0, 0, 0 ], [ 0, 0, 0.3 ])
    }
    else if(icon === 'key')
    {
        add(new THREE.TorusGeometry(0.25, 0.08, 6, 12), '#e4a90c', [ 0, 0.45, 0 ])
        add(new THREE.BoxGeometry(0.12, 0.8, 0.08), '#e4a90c', [ 0, - 0.1, 0 ])
        add(new THREE.BoxGeometry(0.25, 0.1, 0.08), '#e4a90c', [ 0.12, - 0.35, 0 ])
    }
    else if(icon === 'iceCream')
    {
        add(new THREE.ConeGeometry(0.25, 0.7, 8), '#b36d45', [ 0, - 0.3, 0 ], [ Math.PI, 0, 0 ])
        add(new THREE.IcosahedronGeometry(0.3, 1), '#ed719f', [ 0, 0.15, 0 ])
    }
    else
    {
        // checkpoint ring
        add(new THREE.TorusGeometry(1.6, 0.14, 6, 24), '#ec3f1c', [ 0, 0.6, 0 ])
    }
    return group
}

/**
 * The small thing to do at each stop.
 */
export class StopTask
{
    constructor(area)
    {
        this.area = area
        this.game = area.game
        this.stop = area.stop
        this.config = this.stop.task
        this.done = taskStore.done.has(this.stop.id)
        this.progress = 0
        this.total = 1
        this.tokens = []

        const setup = {
            collect: () => this.setCollect(),
            checkpoints: () => this.setCheckpoints(),
            letters: () => this.setBodies('letters'),
            seaLion: () => this.setBodies('seaLion'),
            tennis: () => this.setBodies('tennisBall'),
            knock: () => this.setBodies(this.config.ref),
            ice: () => { this.total = this.config.seconds; this.iceTime = 0 },
            honk: () => this.setHonk(),
            touchdown: () => {},
        }
        setup[this.config.type]?.()

        if(this.done)
            this.progress = this.total

        this.game.ticker.events.on('tick', () => this.update(), 11)
    }

    get text()
    {
        const status = this.done ? '✓' : this.total > 1 ? `${Math.floor(this.progress)} / ${this.total}` : ''
        return { text: this.config.text, status, done: this.done }
    }

    groundAt(x, z)
    {
        return Math.max(this.game.water.surfaceElevation, this.game.terrain.getGroundElevation(x, z))
    }

    playerNear(x, z, radius)
    {
        const p = this.game.player.position
        return Math.hypot(p.x - x, p.z - z) < radius
    }

    setCollect()
    {
        this.total = this.config.points.length
        this.config.points.forEach(([ x, z ], index) =>
        {
            const token = makeToken(this.config.icon)
            token.position.set(x, this.groundAt(x, z) + 1.3, z)
            token.userData.baseY = token.position.y
            token.userData.phase = index
            token.visible = !this.done
            this.game.scene.add(token)
            this.tokens.push({ object: token, x, z, taken: this.done })
        })
    }

    setCheckpoints()
    {
        this.total = this.config.points.length
        this.config.points.forEach(([ x, z ], index) =>
        {
            const token = makeToken('ring')
            token.position.set(x, this.groundAt(x, z), z)
            token.userData.baseY = token.position.y
            token.userData.phase = index
            token.visible = false
            this.game.scene.add(token)
            this.tokens.push({ object: token, x, z, taken: this.done })
        })
    }

    setBodies(referenceName)
    {
        this.bodies = [ ...this.area.references.getStartingWith(referenceName).values() ].flat()
            .map(reference => reference.userData.object?.physical?.body)
            .filter(Boolean)
        this.bodiesStart = this.bodies.map(body => ({ ...body.translation() }))
    }

    setHonk()
    {
        this.game.inputs.events.on('honk', (action) =>
        {
            if(action.active && !this.done && this.area.isIn)
                this.complete()
        })
    }

    complete()
    {
        if(this.done)
            return
        this.done = true
        this.progress = this.total
        taskStore.done.add(this.stop.id)
        taskStore.save()

        const position = this.game.player.position.clone()
        if(this.game.world.confetti)
        {
            this.game.world.confetti.pop(position)
            this.game.world.confetti.pop(position.clone().add(new THREE.Vector3(2, 0, 2)))
        }
        this.game.notifications.show(`<span>${this.stop.label} 任務完成：${this.config.text} ✓</span>`, '', 4, null, `task-${this.stop.id}`)
        this.game.world.guide?.refresh()
    }

    /** called by StopArea when a touchdown happens */
    touchdown()
    {
        if(this.config.type === 'touchdown')
            this.complete()
    }

    update()
    {
        const time = this.game.ticker.elapsed ?? performance.now() / 1000

        // Animate visible tokens
        for(const token of this.tokens)
        {
            if(!token.object.visible)
                continue
            token.object.rotation.y = time * 1.6 + token.object.userData.phase
            token.object.position.y = token.object.userData.baseY + Math.sin(time * 2.4 + token.object.userData.phase) * 0.15
        }

        if(this.done)
            return

        const type = this.config.type

        if(type === 'collect')
        {
            for(const token of this.tokens)
            {
                if(!token.taken && this.playerNear(token.x, token.z, 2.8))
                {
                    token.taken = true
                    token.object.visible = false
                    this.progress++
                    this.game.audio.groups.get('click')?.play?.()
                    this.game.world.guide?.refresh()
                    if(this.progress >= this.total)
                        this.complete()
                }
            }
        }
        else if(type === 'checkpoints')
        {
            const next = this.tokens[this.progress]
            // Only show the next ring once the player is around
            const around = this.area.frustum ? this.area.frustum.isIn : true
            this.tokens.forEach((token, i) => { token.object.visible = around && i === this.progress })
            if(next)
            {
                // face the ring toward the following checkpoint
                const following = this.tokens[this.progress + 1] || this.tokens[this.progress - 1]
                if(following)
                    next.object.rotation.y = Math.atan2(following.x - next.x, following.z - next.z)

                if(this.playerNear(next.x, next.z, 3.6))
                {
                    this.progress++
                    this.game.world.guide?.refresh()
                    if(this.progress >= this.total)
                    {
                        this.tokens.forEach(token => { token.object.visible = false })
                        this.complete()
                    }
                }
            }
        }
        else if(type === 'letters')
        {
            const up = new THREE.Vector3()
            for(const body of this.bodies || [])
            {
                if(body.isSleeping())
                    continue
                const r = body.rotation()
                up.set(0, 1, 0).applyQuaternion(new THREE.Quaternion(r.x, r.y, r.z, r.w))
                if(up.y < 0.5)
                {
                    this.complete()
                    break
                }
            }
        }
        else if(type === 'knock')
        {
            // knocked over (tipped past ~40 degrees) or shoved far enough
            this.bodies?.forEach((body, i) =>
            {
                if(this.done)
                    return
                const q = body.rotation()
                const upY = 1 - 2 * (q.x * q.x + q.z * q.z)
                const p = body.translation(), start = this.bodiesStart[i]
                if(upY < 0.77 || Math.hypot(p.x - start.x, p.z - start.z) > 2.5)
                    this.complete()
            })
        }
        else if(type === 'seaLion')
        {
            for(const body of this.bodies || [])
            {
                const p = body.translation()
                const depth = this.game.terrain.getGroundElevation(p.x, p.z)
                if(p.y < - 0.5 && depth < - 0.3)
                {
                    this.complete()
                    break
                }
            }
        }
        else if(type === 'tennis')
        {
            const { netX, z, halfZ } = this.config
            for(let i = 0; i < (this.bodies || []).length; i++)
            {
                const p = this.bodies[i].translation()
                const start = this.bodiesStart[i]
                const crossed = Math.sign(p.x - netX) !== Math.sign(start.x - netX) && Math.abs(p.x - netX) > 0.6
                if(crossed && Math.abs(p.z - z) < halfZ)
                {
                    this.complete()
                    break
                }
            }
        }
        else if(type === 'ice')
        {
            const { rink } = this.config
            const p = this.game.player.position
            if(Math.abs(p.x - rink.x) < rink.halfX && Math.abs(p.z - rink.z) < rink.halfZ)
            {
                this.iceTime += this.game.ticker.deltaScaled
                const progress = Math.min(this.total, this.iceTime)
                if(Math.floor(progress) !== Math.floor(this.progress))
                    this.game.world.guide?.refresh()
                this.progress = progress
                if(this.iceTime >= this.total)
                    this.complete()
            }
        }
    }
}
