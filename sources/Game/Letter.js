import { account } from './Account.js'

/**
 * A love letter from J to 朵婕: when she (or Jay) is signed in, a sealed envelope appears once per browser session;
 * tap it to open the letter. The emails are not in the code, only their SHA-256 hashes.
 */
const RECIPIENTS = new Set([
    'd06d12a0bf95e76182292869025bed15462c6f9f2823eef929901d874cf7e4bb',
    '27ee524ea51088a32f3873bceeee286653e6dd3e303e4f7ca37b2c04886e2bc3',
])
const SESSION_KEY = 'sf-trip-letter-shown'

const LETTER = {
    greeting: 'Dear 朵婕,',
    // stanzas of short lines (broken at the commas), set centered like a card
    paragraphs: [
        [ '你是我最愛的人，', '我想讓你一直開心。' ],
        [ '我覺得你好可愛，', '特別是睡覺的時候，', '跟笑起來的時候。' ],
        [ '我想要在 San Francisco', '跟你一起開心的過感恩節。' ],
        [ '謝謝你對我的好，我很感謝你。', '希望我們越來越好，', '我超級愛你的。' ],
    ],
    signature: '愛你的 J',
}

async function sha256(text)
{
    const bytes = new TextEncoder().encode(text)
    const digest = await crypto.subtle.digest('SHA-256', bytes)
    return [ ...new Uint8Array(digest) ].map(b => b.toString(16).padStart(2, '0')).join('')
}

export class Letter
{
    constructor()
    {
        this.check()
    }

    async check()
    {
        // local preview: http://localhost:4174/#skip&letter shows it right away (only on this computer)
        if(/localhost|127\.0\.0\.1/.test(location.hostname) && /letter/.test(location.hash))
        {
            setTimeout(() => this.show(), 2500)
            return
        }
        await account.ready
        const email = account.user?.email?.trim().toLowerCase()
        if(!email || !crypto?.subtle)
            return
        if(!RECIPIENTS.has(await sha256(email)))
            return
        try { if(sessionStorage.getItem(SESSION_KEY)) return } catch(e) {}
        // let the world appear first
        setTimeout(() => this.show(), 4500)
    }

    /** an SVG pine garland across the top of the card, with baubles, holly berries and a string of fairy lights */
    garland()
    {
        const W = 520, rnd = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647 })()
        const y = (x) => 26 + Math.sin(x / W * Math.PI) * 30            // the swag
        let needles = '', lights = '', extras = ''
        for(let i = 0; i < 260; i++)
        {
            const x = rnd() * W, cy = y(x) + (rnd() - 0.5) * 22
            const a = (rnd() - 0.5) * 140, l = 9 + rnd() * 9
            const tone = [ '#1f4d2b', '#2b6236', '#163d22', '#3a7444' ][Math.floor(rnd() * 4)]
            needles += `<line x1="${x.toFixed(1)}" y1="${cy.toFixed(1)}" x2="${(x + Math.cos(a * Math.PI / 180) * l).toFixed(1)}" y2="${(cy + Math.sin(a * Math.PI / 180) * l).toFixed(1)}" stroke="${tone}" stroke-width="2.2" stroke-linecap="round"/>`
        }
        for(let i = 0; i < 7; i++)                                              // baubles hanging from the swag
        {
            const x = 40 + i * 73 + (rnd() - 0.5) * 10, cy = y(x) + 18
            const c = [ '#b3122b', '#c9a24a', '#7d0f1e', '#d8b25a' ][i % 4]
            extras += `<line x1="${x}" y1="${cy - 12}" x2="${x}" y2="${cy - 2}" stroke="#a98a3c" stroke-width="1"/>`
            extras += `<circle cx="${x}" cy="${cy + 6}" r="${7 + (i % 2) * 2}" fill="url(#bauble-${i % 4})"/>`
        }
        for(let i = 0; i < 9; i++)                                              // holly berries
        {
            const x = 25 + i * 60 + rnd() * 20, cy = y(x) - 4
            extras += `<circle cx="${x}" cy="${cy}" r="3.2" fill="#c4122f"/><circle cx="${x + 5}" cy="${cy + 2}" r="3" fill="#a80e26"/>`
        }
        // the fairy light wire, sagging a little more than the garland, with glowing bulbs
        let wire = 'M0,' + (y(0) + 8)
        for(let x = 10; x <= W; x += 10)
            wire += ` L${x},${(y(x) + 8 + Math.sin(x / 26) * 3).toFixed(1)}`
        const colors = [ '#ffd56b', '#ff5a6a', '#7fe0a0', '#7fb8ff', '#fff2c4' ]
        for(let i = 0; i < 24; i++)
        {
            const x = 12 + i * (W - 24) / 23, cy = y(x) + 8 + Math.sin(x / 26) * 3 + 5
            lights += `<g class="ll-bulb" style="--d:${(rnd() * 2.4).toFixed(2)}s;--c:${colors[i % colors.length]}"><rect x="${x - 1.6}" y="${cy - 6}" width="3.2" height="3" rx="0.8" fill="#4a3a1a"/><ellipse cx="${x}" cy="${cy}" rx="3" ry="4.2" fill="${colors[i % colors.length]}"/></g>`
        }
        const gradients = [ [ '#e8435a', '#7d0f1e' ], [ '#f6dc8a', '#9c7424' ], [ '#c22a40', '#4e0812' ], [ '#ffe9a8', '#b08a34' ] ]
            .map(([ a, b ], i) => `<radialGradient id="bauble-${i}" cx="35%" cy="30%" r="70%"><stop offset="0" stop-color="#fff" stop-opacity="0.9"/><stop offset="0.18" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></radialGradient>`).join('')
        return `<svg class="ll-garland" viewBox="0 0 ${W} 90" preserveAspectRatio="none" aria-hidden="true"><defs>${gradients}</defs>${needles}<path d="${wire}" fill="none" stroke="#3b3320" stroke-width="1.2"/>${extras}${lights}</svg>`
    }

    holly(cls)
    {
        return `<svg class="ll-holly ${cls}" viewBox="0 0 80 60" aria-hidden="true">
            <path d="M40 30 C30 18 18 22 8 14 C12 22 6 26 10 32 C16 30 22 36 26 34 C30 36 36 34 40 30Z" fill="#2b6236" stroke="#163d22" stroke-width="1.2"/>
            <path d="M40 30 C50 18 62 22 72 14 C68 22 74 26 70 32 C64 30 58 36 54 34 C50 36 44 34 40 30Z" fill="#1f4d2b" stroke="#163d22" stroke-width="1.2"/>
            <circle cx="36" cy="34" r="5" fill="#c4122f"/><circle cx="44" cy="35" r="5" fill="#a80e26"/><circle cx="40" cy="28" r="5" fill="#d61a38"/>
            <circle cx="38.5" cy="26.5" r="1.4" fill="#fff" opacity="0.7"/></svg>`
    }

    show()
    {
        try { sessionStorage.setItem(SESSION_KEY, '1') } catch(e) {}
        if(!document.querySelector('link[data-letter-fonts]'))
        {
            const fonts = document.createElement('link')
            fonts.rel = 'stylesheet'
            fonts.dataset.letterFonts = ''
            fonts.href = 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;1,500;1,600&family=Great+Vibes&family=Noto+Serif+TC:wght@400;600&display=swap'
            document.head.append(fonts)
        }

        const root = document.createElement('div')
        root.className = 'love-letter'
        root.innerHTML = `
            <div class="ll-backdrop"></div>
            <div class="ll-bokeh" aria-hidden="true"></div>
            <div class="ll-snow" aria-hidden="true"></div>
            <div class="ll-stage">
                <button class="ll-envelope" type="button" aria-label="打開信">
                    <span class="ll-back"></span>
                    <span class="ll-pocket"></span>
                    <span class="ll-flap"></span>
                    <span class="ll-seal"><span>J</span></span>
                    ${this.holly('ll-holly-seal')}
                    <span class="ll-to"><em>To</em> 朵婕</span>
                    <span class="ll-glare"></span>
                </button>
                <article class="ll-paper" aria-live="polite">
                    ${this.garland()}
                    ${this.holly('ll-holly-corner')}
                    <p class="ll-eyebrow">Merry Christmas</p>
                    <p class="ll-greeting"></p>
                    <div class="ll-body"></div>
                    <p class="ll-signature"></p>
                    <button class="ll-close" type="button">收到了</button>
                    <span class="ll-glare"></span>
                </article>
                <div class="ll-sparkles" aria-hidden="true"></div>
            </div>
            <span class="ll-hint">輕點，打開這封信</span>
        `
        root.querySelector('.ll-greeting').textContent = LETTER.greeting
        const body = root.querySelector('.ll-body')
        for(const stanza of LETTER.paragraphs)
        {
            const p = document.createElement('p')
            for(const line of stanza)
            {
                const span = document.createElement('span')
                span.textContent = line
                p.append(span)
            }
            body.append(p)
        }
        root.querySelector('.ll-signature').textContent = LETTER.signature
        // soft snow drifting down, and warm out-of-focus lights behind
        const snow = root.querySelector('.ll-snow')
        for(let i = 0; i < 46; i++)
        {
            const flake = document.createElement('span')
            flake.style.left = `${Math.random() * 100}%`
            flake.style.animationDuration = `${7 + Math.random() * 9}s`
            flake.style.animationDelay = `${- Math.random() * 14}s`
            flake.style.setProperty('--s', `${2 + Math.random() * 4}px`)
            flake.style.setProperty('--x', `${(Math.random() - 0.5) * 120}px`)
            flake.style.opacity = 0.35 + Math.random() * 0.5
            snow.append(flake)
        }
        const bokeh = root.querySelector('.ll-bokeh')
        for(let i = 0; i < 16; i++)
        {
            const dot = document.createElement('span')
            dot.style.left = `${Math.random() * 100}%`
            dot.style.top = `${Math.random() * 100}%`
            dot.style.setProperty('--s', `${40 + Math.random() * 120}px`)
            dot.style.setProperty('--c', [ '#ffcf7a', '#ff6b6b', '#ffe6a8', '#8fd6a2' ][i % 4])
            dot.style.animationDelay = `${- Math.random() * 8}s`
            bokeh.append(dot)
        }
        document.body.append(root)
        requestAnimationFrame(() => root.classList.add('is-visible'))

        // 3D tilt: follows the pointer (eased); with no pointer around it sways gently by itself
        const stage = root.querySelector('.ll-stage')
        const tilt = { x: 0, y: 0, tx: 0, ty: 0, last: 0, gx: 50, gy: 30 }
        root.addEventListener('pointermove', (event) =>
        {
            const rect = stage.getBoundingClientRect()
            const nx = (event.clientX - (rect.left + rect.width / 2)) / (window.innerWidth / 2)
            const ny = (event.clientY - (rect.top + rect.height / 2)) / (window.innerHeight / 2)
            tilt.tx = Math.max(- 1, Math.min(1, nx))
            tilt.ty = Math.max(- 1, Math.min(1, ny))
            tilt.last = performance.now()
        })
        const animate = (now) =>
        {
            if(!root.isConnected)
                return
            if(now - tilt.last > 2500)
            {
                tilt.tx = Math.sin(now / 2600) * 0.55
                tilt.ty = Math.sin(now / 3400 + 1) * 0.35
            }
            tilt.x += (tilt.tx - tilt.x) * 0.06
            tilt.y += (tilt.ty - tilt.y) * 0.06
            stage.style.setProperty('--ry', `${(tilt.x * 16).toFixed(2)}deg`)
            stage.style.setProperty('--rx', `${(- tilt.y * 12).toFixed(2)}deg`)
            stage.style.setProperty('--gx', `${(50 + tilt.x * 45).toFixed(1)}%`)
            stage.style.setProperty('--gy', `${(35 + tilt.y * 40).toFixed(1)}%`)
            requestAnimationFrame(animate)
        }
        requestAnimationFrame(animate)

        // a burst of gold sparkles from the seal when it opens
        const burst = () =>
        {
            const box = root.querySelector('.ll-sparkles')
            for(let i = 0; i < 70; i++)
            {
                const spark = document.createElement('span')
                const a = Math.random() * Math.PI * 2, d = 90 + Math.random() * 220
                spark.style.setProperty('--dx', `${Math.cos(a) * d}px`)
                spark.style.setProperty('--dy', `${Math.sin(a) * d - 60}px`)
                spark.style.setProperty('--z', `${40 + Math.random() * 120}px`)
                spark.style.setProperty('--s', `${4 + Math.random() * 8}px`)
                spark.style.animationDelay = `${Math.random() * 0.25}s`
                spark.style.background = [ '#ffe7a3', '#f4c95d', '#fff6d8', '#ff8a8a' ][i % 4]
                box.append(spark)
            }
            setTimeout(() => box.replaceChildren(), 2600)
        }

        const open = () =>
        {
            if(root.classList.contains('is-open'))
                return
            root.classList.add('is-open')
            burst()
            setTimeout(() => root.querySelector('.ll-close').focus({ preventScroll: true }), 1400)
        }
        const close = () =>
        {
            root.classList.remove('is-visible')
            setTimeout(() => root.remove(), 700)
        }
        root.querySelector('.ll-envelope').addEventListener('click', open)
        root.querySelector('.ll-close').addEventListener('click', close)
        // keep game keys (and the car) out of it while it's up
        root.addEventListener('keydown', (event) =>
        {
            event.stopPropagation()
            if(event.key === 'Escape' && root.classList.contains('is-open'))
                close()
            if((event.key === 'Enter' || event.key === ' ') && !root.classList.contains('is-open'))
            {
                event.preventDefault()
                open()
            }
        })
        root.querySelector('.ll-envelope').focus({ preventScroll: true })
    }
}
