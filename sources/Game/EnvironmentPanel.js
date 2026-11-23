import { Game } from './Game.js'
import { TIMES, WEATHERS, SEASONS } from './Environment.js'

/** The 天氣與時間 tab: time of day, weather, season. 自動 rotates, any other choice locks it. */
export class EnvironmentPanel
{
    constructor()
    {
        this.game = Game.getInstance()
        this.element = document.querySelector('.js-environment')
        if(!this.element)
            return
        this.render()
    }

    render()
    {
        const state = this.game.environment.state
        const section = (kind, title, options) => /* html */`
            <div class="environment-section">
                <div class="environment-label">${title}<span class="environment-lock">${state[kind] === 'auto' ? '自動輪替' : '🔒 已固定'}</span></div>
                <div class="environment-options">
                    ${options.map(o => `<button class="environment-option${state[kind] === o.id ? ' is-active' : ''}${o.id === 'auto' ? ' is-auto' : ''}" data-kind="${kind}" data-id="${o.id}"><span class="icon">${o.icon}</span><span class="label">${o.label}</span></button>`).join('')}
                </div>
            </div>`
        this.element.innerHTML = section('time', '時間', TIMES) + section('weather', '天氣', WEATHERS) + section('season', '季節', SEASONS)
        for(const button of this.element.querySelectorAll('.environment-option'))
            button.addEventListener('click', () =>
            {
                this.game.environment.set(button.dataset.kind, button.dataset.id)
                this.render()
            })
    }
}
