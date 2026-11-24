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

    /** an original ink crest: a shield quartered with a Christmas tree, a cable car, a heart and a star, a ribbon below */
    crest()
    {
        const ink = '#3a2412'
        return `<svg class="ll-crest" viewBox="0 0 200 190" aria-hidden="true" fill="none" stroke="${ink}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round">
            <!-- mantling scrolls -->
            <path d="M44 34 C24 30 14 46 22 60 C14 52 8 64 16 72 M156 34 C176 30 186 46 178 60 C186 52 192 64 184 72" />
            <!-- holly crown -->
            <path d="M74 22 C82 10 94 14 100 6 C106 14 118 10 126 22" />
            <circle cx="92" cy="15" r="3.2" fill="#9b1b24" stroke="none"/><circle cx="100" cy="11" r="3.2" fill="#9b1b24" stroke="none"/><circle cx="108" cy="15" r="3.2" fill="#9b1b24" stroke="none"/>
            <!-- shield -->
            <path d="M46 30 H154 V92 C154 124 128 142 100 152 C72 142 46 124 46 92 Z" fill="rgba(255,245,220,0.25)" stroke-width="2.4"/>
            <path d="M52 36 H148 V92 C148 120 126 136 100 145 C74 136 52 120 52 92 Z" stroke-width="0.9"/>
            <path d="M100 36 V145 M52 88 H148" stroke-width="1.4"/>
            <!-- tree -->
            <path d="M76 44 L64 64 H70 L60 80 H92 L82 64 H88 Z" fill="rgba(58,36,18,0.12)"/>
            <path d="M76 39 l2 4 4 0.5 -3 2.6 1 4 -4-2.2 -4 2.2 1-4 -3-2.6 4-0.5z" fill="#b8892e" stroke="none"/>
            <!-- cable car -->
            <rect x="110" y="56" width="30" height="18" rx="2"/><path d="M110 62 H140 M117 56 V74 M125 56 V74 M133 56 V74 M108 74 H142 M125 56 V48 M114 48 H136"/>
            <circle cx="116" cy="77" r="2.4"/><circle cx="134" cy="77" r="2.4"/>
            <!-- heart -->
            <path d="M76 132 C60 120 58 106 68 102 C74 100 76 106 76 106 C76 106 78 100 84 102 C94 106 92 120 76 132 Z" fill="#9b1b24" stroke="#5e0e14"/>
            <!-- star -->
            <path d="M124 100 l4.5 9.5 10.5 1.2 -7.8 7 2.2 10.3 -9.4-5.3 -9.4 5.3 2.2-10.3 -7.8-7 10.5-1.2z" fill="#b8892e" stroke="#6b4b12"/>
            <!-- ribbon -->
            <path d="M28 150 C60 172 140 172 172 150 L180 166 C140 188 60 188 20 166 Z" fill="rgba(255,245,220,0.35)" stroke-width="1.6"/>
            <path d="M28 150 L14 148 L22 160 L16 170 L20 166 M172 150 L186 148 L178 160 L184 170 L180 166" stroke-width="1.4"/>
            <path id="ll-ribbon-path" d="M32 162 C64 181 136 181 168 162" stroke="none"/>
            <text font-family="Cinzel, serif" font-size="9" letter-spacing="1.4" fill="${ink}" stroke="none"><textPath href="#ll-ribbon-path" startOffset="50%" text-anchor="middle">AMOR · NIX · CIVITAS</textPath></text>
        </svg>`
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
            fonts.href = 'https://fonts.googleapis.com/css2?family=Cinzel:wght@500;700&family=IM+Fell+English:ital@0;1&family=Great+Vibes&family=Pinyon+Script&family=Noto+Serif+TC:wght@400;600&display=swap'
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
                    <span class="ll-address">
                        <em>To 朵婕</em>
                        <span>The Passenger Seat</span>
                        <span>The Little Blue Car</span>
                        <span>San Francisco, California</span>
                    </span>
                    <span class="ll-seal"><span>J</span></span>
                    ${this.holly('ll-holly-seal')}
                    <span class="ll-glare"></span>
                </button>
                <article class="ll-paper" aria-live="polite">
                    <span class="ll-stains"></span>
                    ${this.garland()}
                    ${this.crest()}
                    <h2 class="ll-office"><span>The Christmas Office</span><span class="ll-office-2"><small>of</small> San Francisco</span></h2>
                    <p class="ll-head">Head of Office: J</p>
                    <p class="ll-orders">(Order of the Cable Car, First Class, Keeper of the Snacks, Driver of the Little Blue Car, Supreme Hugger)</p>
                    <p class="ll-greeting"></p>
                    <div class="ll-body"></div>
                    <p class="ll-closing">Yours, always,</p>
                    <p class="ll-signature"></p>
                    <p class="ll-sigline">Head of the Christmas Office · 你的專屬司機</p>
                    ${this.holly('ll-holly-corner')}
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
        // hovering the card lifts it toward you and leans it toward the pointer, with a trail of gold dust
        const lift = { on: 0, target: 0, px: 0.5, py: 0.5 }
        for(const el of root.querySelectorAll('.ll-paper, .ll-envelope'))
        {
            el.addEventListener('pointerenter', () => { lift.target = 1 })
            el.addEventListener('pointerleave', () => { lift.target = 0 })
            el.addEventListener('pointermove', (event) =>
            {
                const r = el.getBoundingClientRect()
                lift.px = (event.clientX - r.left) / r.width
                lift.py = (event.clientY - r.top) / r.height
                el.style.setProperty('--lx', `${(lift.px * 100).toFixed(1)}%`)
                el.style.setProperty('--ly', `${(lift.py * 100).toFixed(1)}%`)
                if(Math.random() < 0.35)
                {
                    const dust = document.createElement('span')
                    dust.className = 'll-dust'
                    dust.style.left = `${event.clientX}px`
                    dust.style.top = `${event.clientY}px`
                    dust.style.setProperty('--dx', `${(Math.random() - 0.5) * 40}px`)
                    dust.style.setProperty('--dy', `${- 20 - Math.random() * 40}px`)
                    root.append(dust)
                    setTimeout(() => dust.remove(), 1200)
                }
            })
        }
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
            lift.on += (lift.target - lift.on) * 0.08
            // while hovered, lean toward the pointer on the card itself (pressing down where you point, lifting the rest)
            const hx = lift.on * (lift.px - 0.5) * 2, hy = lift.on * (lift.py - 0.5) * 2
            tilt.x += (tilt.tx * (1 - lift.on) + hx * 1.1 - tilt.x) * 0.07
            tilt.y += (tilt.ty * (1 - lift.on) + hy * 1.1 - tilt.y) * 0.07
            stage.style.setProperty('--lift', `${(lift.on * 34).toFixed(1)}px`)
            const paper = root.querySelector('.ll-paper')
            if(root.classList.contains('is-open') && paper)
            {
                const fit = Math.min(1, (window.innerHeight * 0.86) / paper.offsetHeight, (window.innerWidth * 0.94) / paper.offsetWidth)
                stage.style.setProperty('--fit', fit.toFixed(3))
            }
            stage.style.setProperty('--float', `${(Math.sin(now / 900) * 6 * (0.4 + lift.on)).toFixed(2)}px`)
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
            lift.target = 0
            burst()
            setTimeout(() => root.querySelector('.ll-close').focus({ preventScroll: true }), 1400)
        }
        const close = () =>
        {
            root.classList.remove('is-visible')
            setTimeout(() => root.remove(), 700)
        }
        // phones: the game's touch controls cancel the click that would follow a tap, so react to the tap itself,
        // and keep the letter's touches away from the game
        for(const type of [ 'touchstart', 'touchmove', 'touchend', 'pointerdown', 'mousedown' ])
            root.addEventListener(type, (event) => event.stopPropagation())
        root.querySelector('.ll-envelope').addEventListener('pointerup', open)
        root.querySelector('.ll-envelope').addEventListener('click', open)
        root.querySelector('.ll-close').addEventListener('click', close)
        root.querySelector('.ll-close').addEventListener('pointerup', () => { if(root.classList.contains('is-open')) close() })
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
