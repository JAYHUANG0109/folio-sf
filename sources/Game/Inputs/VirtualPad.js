import { Game } from '../Game.js'

/**
 * On screen gamepad for phones: a thumb joystick on the left (drive + steer),
 * PlayStation style face buttons on the right (△ boost, ✕ jump, ○ horn, □ brake).
 */
export class VirtualPad
{
    constructor()
    {
        this.game = Game.getInstance()
        this.stick = { active: false, x: 0, y: 0 }

        const coarse = window.matchMedia?.('(pointer: coarse)').matches || 'ontouchstart' in window
        if(coarse)
            document.documentElement.classList.add('has-virtual-pad')

        this.element = document.createElement('div')
        this.element.className = 'virtual-pad'
        this.element.innerHTML = /* html */`
            <div class="vp-stick js-vp-stick"><div class="vp-ring"></div><div class="vp-knob js-vp-knob"></div></div>
            <div class="vp-buttons">
                <button class="vp-button triangle" data-key="triangle" aria-label="加速"><svg viewBox="0 0 24 24"><path d="M12 4.5 L20 18.5 H4 Z"/></svg><span>加速</span></button>
                <button class="vp-button square" data-key="square" aria-label="煞車"><svg viewBox="0 0 24 24"><rect x="5" y="5" width="14" height="14" rx="1"/></svg><span>煞車</span></button>
                <button class="vp-button circle" data-key="circle" aria-label="喇叭"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="7.5"/></svg><span>喇叭</span></button>
                <button class="vp-button cross" data-key="cross" aria-label="跳"><svg viewBox="0 0 24 24"><path d="M5.5 5.5 L18.5 18.5 M18.5 5.5 L5.5 18.5"/></svg><span>跳</span></button>
            </div>`
        this.game.domElement.append(this.element)

        this.setStick()
        this.setButtons()

        // out of the way while a menu or the map is open
        this.game.modals?.events.on('open', () => document.documentElement.classList.add('has-modal-open'))
        this.game.modals?.events.on('close', () => document.documentElement.classList.remove('has-modal-open'))
    }

    setStick()
    {
        const base = this.element.querySelector('.js-vp-stick')
        const knob = this.element.querySelector('.js-vp-knob')
        let pointerId = null

        const move = (event) =>
        {
            const rect = base.getBoundingClientRect()
            const radius = rect.width / 2
            let dx = (event.clientX - (rect.left + radius)) / radius
            let dy = (event.clientY - (rect.top + radius)) / radius
            const length = Math.hypot(dx, dy)
            if(length > 1) { dx /= length; dy /= length }
            this.stick.x = dx
            this.stick.y = dy
            knob.style.transform = `translate(${dx * radius * 0.62}px, ${dy * radius * 0.62}px)`
        }
        const release = () =>
        {
            pointerId = null
            this.stick.active = false
            this.stick.x = 0
            this.stick.y = 0
            knob.style.transform = ''
            base.classList.remove('is-active')
        }

        base.addEventListener('pointerdown', (event) =>
        {
            event.preventDefault()
            event.stopPropagation()
            pointerId = event.pointerId
            base.setPointerCapture(pointerId)
            this.stick.active = true
            base.classList.add('is-active')
            this.game.view.focusPoint.isTracking = true
            move(event)
        })
        base.addEventListener('pointermove', (event) => { if(event.pointerId === pointerId) move(event) })
        base.addEventListener('pointerup', (event) => { if(event.pointerId === pointerId) release() })
        base.addEventListener('pointercancel', release)
        base.addEventListener('lostpointercapture', release)
    }

    setButtons()
    {
        for(const button of this.element.querySelectorAll('.vp-button'))
        {
            const key = `Virtual.${button.dataset.key}`
            const down = (event) =>
            {
                event.preventDefault()
                event.stopPropagation()
                button.classList.add('is-pressed')
                this.game.inputs.start(key)
                navigator.vibrate?.(8)
            }
            const up = (event) =>
            {
                event.preventDefault()
                button.classList.remove('is-pressed')
                this.game.inputs.end(key)
            }
            button.addEventListener('pointerdown', down)
            button.addEventListener('pointerup', up)
            button.addEventListener('pointercancel', up)
            button.addEventListener('pointerleave', up)
            button.addEventListener('contextmenu', (event) => event.preventDefault())
        }
    }
}
