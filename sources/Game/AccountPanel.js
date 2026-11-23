import { Game } from './Game.js'
import { account, authErrorText } from './Account.js'

/** The 帳號 tab in the menu: sign in with Google or email, see the save status, sign out */
export class AccountPanel
{
    constructor()
    {
        this.game = Game.getInstance()
        this.element = document.querySelector('.js-account')
        if(!this.element)
            return
        this.mode = 'signin'
        this.message = ''
        account.on(() => this.render())

        // gentle nudge for guests, once per visit
        if(!account.user)
            this.game.ticker.wait(600, () =>
                this.game.notifications?.show('<span>登入就能保存進度，換裝置也能接著玩。點這裡登入</span>', '', 6, () => this.game.menu.open('account'), 'account-nudge'))
    }

    render()
    {
        const user = account.user
        if(user)
        {
            const statusText = { saving: '儲存中…', saved: '已自動儲存 ✓', error: '暫時無法儲存，會自動重試', idle: '自動儲存已開啟' }[account.status]
            this.element.innerHTML = /* html */`
                <div class="account-card">
                    <div class="account-avatar">${user.photoURL ? `<img src="${user.photoURL}" referrerpolicy="no-referrer">` : (user.email || '?').charAt(0).toUpperCase()}</div>
                    <div class="account-who">
                        <div class="account-name">${escapeHtml(user.displayName || user.email || '已登入')}</div>
                        <div class="account-status is-${account.status}">${statusText}</div>
                    </div>
                </div>
                <p class="account-hint">印章、任務、成就、塗裝和秘密景點都存在這個帳號裡，換裝置登入就能接著玩。</p>
                <button class="button account-button js-account-signout">登出</button>`
            this.element.querySelector('.js-account-signout').addEventListener('click', () => account.signOut())
            return
        }

        const create = this.mode === 'signup'
        this.element.innerHTML = /* html */`
            <div class="account-intro">
                <div class="account-lead">登入後，進度會自動存到雲端</div>
                <p class="account-hint">印章、任務、成就和塗裝都會保留，換裝置也能接著玩。<br>未登入的話，關掉頁面後進度就會消失。</p>
            </div>
            <button class="account-google js-account-google">
                <svg viewBox="0 0 48 48" width="20" height="20"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>
                使用 Google 帳號登入
            </button>
            <div class="account-or"><span>或使用 Email</span></div>
            <form class="account-form js-account-form">
                <input class="js-account-email" type="email" placeholder="Email" autocomplete="email" required>
                <input class="js-account-password" type="password" placeholder="密碼（至少 6 個字元）" autocomplete="${create ? 'new-password' : 'current-password'}" minlength="6" required>
                <button class="button account-button" type="submit">${create ? '建立帳號' : '登入'}</button>
            </form>
            <div class="account-links">
                <button class="js-account-mode">${create ? '已經有帳號？登入' : '還沒有帳號？建立一個'}</button>
                ${create ? '' : '<button class="js-account-reset">忘記密碼？</button>'}
            </div>
            <div class="account-message">${escapeHtml(this.message)}</div>`

        // typing in the form must not drive the car
        for(const input of this.element.querySelectorAll('input'))
            input.addEventListener('keydown', (event) => event.stopPropagation())

        this.element.querySelector('.js-account-google').addEventListener('click', () => this.run(() => account.signInGoogle()))
        this.element.querySelector('.js-account-form').addEventListener('submit', (event) =>
        {
            event.preventDefault()
            const email = this.element.querySelector('.js-account-email').value.trim()
            const password = this.element.querySelector('.js-account-password').value
            this.run(() => account.signInEmail(email, password, create))
        })
        this.element.querySelector('.js-account-mode').addEventListener('click', () => { this.mode = create ? 'signin' : 'signup'; this.message = ''; this.render() })
        this.element.querySelector('.js-account-reset')?.addEventListener('click', () =>
        {
            const email = this.element.querySelector('.js-account-email').value.trim()
            if(!email)
                return this.say('請先輸入 Email，再按「忘記密碼？」')
            this.run(async () => { await account.resetPassword(email); this.say('已寄出重設密碼的信，請到信箱查看') })
        })
    }

    say(text)
    {
        this.message = text
        const element = this.element.querySelector('.account-message')
        if(element)
            element.textContent = text
    }

    async run(action)
    {
        this.say('處理中…')
        try
        {
            await action()
        }
        catch(error)
        {
            console.warn(error)
            this.say(authErrorText(error))
            // point at the Google button when linking is the way forward
            if(String(error.code).startsWith('link/'))
                this.element.querySelector('.js-account-google')?.classList.add('is-highlighted')
        }
    }
}

const escapeHtml = (text) => String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
