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
    paragraphs: [
        '你是我最愛的人，我想讓你一直開心。',
        '我覺得你好可愛，特別是睡覺的時候跟笑起來的時候。',
        '我想要在 San Francisco 跟你一起開心的過感恩節。',
        '謝謝你對我的好，我很感謝你。希望我們越來越好，我超級愛你的。',
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

    show()
    {
        try { sessionStorage.setItem(SESSION_KEY, '1') } catch(e) {}

        const root = document.createElement('div')
        root.className = 'love-letter'
        root.innerHTML = `
            <div class="ll-backdrop"></div>
            <button class="ll-envelope" type="button" aria-label="打開信">
                <span class="ll-flap"></span>
                <span class="ll-pocket"></span>
                <span class="ll-seal">♥</span>
                <span class="ll-to">To 朵婕</span>
                <span class="ll-hint">點一下打開</span>
            </button>
            <article class="ll-paper" aria-live="polite">
                <p class="ll-greeting"></p>
                <div class="ll-body"></div>
                <p class="ll-signature"></p>
                <button class="ll-close" type="button">收到了 ♥</button>
            </article>
        `
        root.querySelector('.ll-greeting').textContent = LETTER.greeting
        const body = root.querySelector('.ll-body')
        for(const text of LETTER.paragraphs)
        {
            const p = document.createElement('p')
            p.textContent = text
            body.append(p)
        }
        root.querySelector('.ll-signature').textContent = LETTER.signature
        // a few hearts floating up behind the letter
        for(let i = 0; i < 14; i++)
        {
            const heart = document.createElement('span')
            heart.className = 'll-heart'
            heart.textContent = '♥'
            heart.style.left = `${5 + Math.random() * 90}%`
            heart.style.animationDelay = `${Math.random() * 6}s`
            heart.style.fontSize = `${14 + Math.random() * 18}px`
            root.append(heart)
        }
        document.body.append(root)
        requestAnimationFrame(() => root.classList.add('is-visible'))

        const open = () =>
        {
            if(root.classList.contains('is-open'))
                return
            root.classList.add('is-open')
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
