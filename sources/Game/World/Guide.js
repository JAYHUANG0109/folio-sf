import * as THREE from 'three/webgpu'
import { color, float, uv, vec4, Fn, time, sin, uniform } from 'three/tsl'
import { Game } from '../Game.js'
import { stops } from '../../data/worldData.js'
import { taskStore } from './Areas/StopTask.js'

const css = /* css */`
.trip-hud
{
    position: absolute;
    left: max(12px, env(safe-area-inset-left));
    top: max(12px, env(safe-area-inset-top));
    z-index: 8;
    max-width: min(320px, calc(100vw - 90px));
    padding: 9px 13px;
    border-radius: 14px;
    background: rgba(28, 22, 40, 0.72);
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
    color: #fff2e8;
    font-family: "Nunito", "Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif;
    font-size: 14px;
    line-height: 1.45;
    pointer-events: auto;
    cursor: pointer;
    user-select: none;
    display: none;
}
html.is-started .trip-hud { display: block; }
html.input-filter-intro .trip-hud, html.input-filter-menu .trip-hud, html.input-filter-modal .trip-hud { opacity: 0; pointer-events: none; }
.trip-hud .hud-next { display: flex; gap: 8px; align-items: baseline; }
.trip-hud .hud-label { font-family: "LXGW WenKai TC", "Noto Sans TC", sans-serif; background: #ec3f1c; color: #fff; border-radius: 999px; padding: 0 8px; font-size: 13px; white-space: nowrap; }
.trip-hud .hud-name { font-family: "LXGW WenKai TC", "Noto Sans TC", sans-serif; font-size: 17px; }
.trip-hud .hud-distance { opacity: 0.7; font-size: 13px; margin-left: auto; white-space: nowrap; }
.trip-hud .hud-task { margin-top: 4px; font-size: 13px; opacity: 0.9; }
.trip-hud .hud-task.is-done { color: #c9e0a8; }
.trip-hud .hud-progress { margin-top: 4px; font-size: 12px; opacity: 0.65; }
@media (max-width: 520px) { .trip-hud { font-size: 13px; padding: 7px 11px; } .trip-hud .hud-name { font-size: 15px; } }
`

/**
 * Points the way: an arrow around the car, a light beam on the next stop, and a small HUD.
 */
export class Guide
{
    constructor()
    {
        this.game = Game.getInstance()
        this.target = null
        this.current = null

        this.setHud()
        this.setArrow()
        this.setBeacon()
        this.refresh()

        this.game.ticker.events.on('tick', () => this.update(), 12)
    }

    getDone()
    {
        const group = this.game.achievements.groups.get('stops')
        return group && group.progress instanceof Set ? group.progress : new Set()
    }

    setHud()
    {
        const style = document.createElement('style')
        style.textContent = css
        document.head.append(style)

        this.hud = document.createElement('div')
        this.hud.className = 'trip-hud'
        this.hud.setAttribute('aria-live', 'polite')
        this.game.domElement.append(this.hud)

        this.hud.addEventListener('click', () => this.game.modals.open('map'))
        this.hud.addEventListener('pointerdown', (event) => event.stopPropagation())
    }

    setArrow()
    {
        const shape = new THREE.Shape()
        shape.moveTo(0, 0.9)
        shape.lineTo(0.75, - 0.2)
        shape.lineTo(0.28, - 0.2)
        shape.lineTo(0.28, - 0.8)
        shape.lineTo(- 0.28, - 0.8)
        shape.lineTo(- 0.28, - 0.2)
        shape.lineTo(- 0.75, - 0.2)
        shape.closePath()
        const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.18, bevelEnabled: false })
        geometry.rotateX(- Math.PI / 2) // lie flat, tip toward -z
        geometry.rotateY(Math.PI)       // tip toward +z

        // The arrow changes color with the ground under it so it never blends in
        this.arrowColors = {
            grass: new THREE.Color('#ff2e88'),
            road: new THREE.Color('#ffd23d'),
            water: new THREE.Color('#ff7a2e'),
        }
        this.arrowColor = uniform(this.arrowColors.grass.clone())
        const material = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false })
        material.colorNode = this.arrowColor.mul(1.6)
        material.opacityNode = float(0.9)
        material.fog = false

        this.arrow = new THREE.Mesh(geometry, material)
        this.arrow.renderOrder = 5
        this.arrow.visible = false
        this.game.scene.add(this.arrow)
    }

    setBeacon()
    {
        const height = 45
        const geometry = new THREE.CylinderGeometry(0.9, 1.4, height, 16, 1, true)
        geometry.translate(0, height / 2, 0)

        const material = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide })
        material.colorNode = color('#ffb35c').mul(1.5)
        material.opacityNode = Fn(() =>
        {
            const fade = uv().y.oneMinus().pow(1.6)
            const pulse = sin(time.mul(2.5)).mul(0.15).add(0.85)
            return fade.mul(0.55).mul(pulse)
        })()
        material.fog = false

        this.beacon = new THREE.Mesh(geometry, material)
        this.beacon.renderOrder = 4
        this.beacon.visible = false
        this.game.scene.add(this.beacon)
    }

    /** Recompute target and HUD text (called when stamps or tasks change) */
    refresh()
    {
        const done = this.getDone()
        this.target = stops.find(stop => !done.has(stop.id)) || null

        if(this.target)
        {
            const { x, z } = this.target.position
            this.beacon.position.set(x, Math.max(0, this.game.terrain.getGroundElevation(x, z)), z)
            this.beacon.visible = true
        }
        else
        {
            this.beacon.visible = false
        }
        this.renderHud(true)
    }

    renderHud(force = false)
    {
        const p = this.game.player.position
        let current = null
        let best = Infinity
        for(const stop of stops)
        {
            const d = Math.hypot(p.x - stop.position.x, p.z - stop.position.z)
            if(d < stop.radius + 4 && d - stop.radius < best)
            {
                best = d - stop.radius
                current = stop
            }
        }
        const distance = this.target ? Math.round(Math.hypot(p.x - this.target.position.x, p.z - this.target.position.z) * 10 / 10) * 10 : 0
        const area = current ? this.game.world.areas?.[current.id] : null
        const task = area?.task?.text
        const key = `${this.target?.id}|${current?.id}|${distance}|${task?.status}|${task?.done}`
        if(!force && key === this.hudKey)
            return
        this.hudKey = key

        const done = this.getDone()
        const tasksDone = taskStore.done.size
        const next = this.target
            ? `<div class="hud-next"><span class="hud-label">下一站 · ${this.target.label}</span><span class="hud-name">${this.target.name}</span><span class="hud-distance">${distance} m</span></div>`
            : `<div class="hud-next"><span class="hud-label">完成</span><span class="hud-name">14 站都到了 ♥</span></div>`
        const taskLine = current && task
            ? `<div class="hud-task${task.done ? ' is-done' : ''}">${current.label} ${task.done ? '✓ ' : '任務：'}${task.text}${!task.done && task.status ? `（${task.status}）` : ''}</div>`
            : ''
        this.hud.innerHTML = `${next}${taskLine}<div class="hud-progress">印章 ${done.size} / ${stops.length} · 任務 ${tasksDone} / ${stops.length}</div>`
    }

    update()
    {
        const player = this.game.player
        if(!player || !this.target)
        {
            this.arrow.visible = false
            this.renderHud()
            return
        }

        const dx = this.target.position.x - player.position.x
        const dz = this.target.position.z - player.position.z
        const distance = Math.hypot(dx, dz)

        // Arrow circles the car, pointing at the next stop. Hidden once you're there.
        this.arrow.visible = distance > this.target.radius
        if(this.arrow.visible)
        {
            const angle = Math.atan2(dx, dz)
            const radius = 3.4
            const time = this.game.ticker.elapsed ?? performance.now() / 1000
            this.arrow.position.set(
                player.position.x + Math.sin(angle) * radius,
                player.position.y + 0.1 + Math.sin(time * 4) * 0.08,
                player.position.z + Math.cos(angle) * radius
            )
            this.arrow.rotation.set(0, angle, 0)

            // pick a contrasting color for the ground below
            const mask = this.game.terrain.getMask(this.arrow.position.x, this.arrow.position.z)
            const goal = mask.depth > 0.3 ? this.arrowColors.water : mask.paving > 0.35 ? this.arrowColors.road : this.arrowColors.grass
            this.arrowColor.value.lerp(goal, Math.min(1, this.game.ticker.delta * 8))
        }

        this.renderHud()
    }
}
