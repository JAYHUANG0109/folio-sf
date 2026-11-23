import { initializeApp } from 'firebase/app'
import { getAuth, deleteUser, onAuthStateChanged, EmailAuthProvider, linkWithCredential, sendEmailVerification, GoogleAuthProvider, signInWithPopup, signInWithRedirect, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, signOut } from 'firebase/auth'
import { getFirestore, doc, getDoc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore'

/**
 * Accounts and cloud saves.
 * - Signed out: progress lives only for this visit (cleared on every load), nothing is saved.
 * - Signed in: progress is loaded from Firestore (users/{uid}) before the game starts, and every change is auto-saved.
 * Only progress keys are synced; preferences (sound, music) stay on the device.
 */
const firebaseConfig = {
    apiKey: 'AIzaSyAkhDs-bKJX2sY2ehAd_QgE_JK7dJJt2ts',
    authDomain: 'our-sf-trip.firebaseapp.com',
    projectId: 'our-sf-trip',
    storageBucket: 'our-sf-trip.firebasestorage.app',
    messagingSenderId: '147113451519',
    appId: '1:147113451519:web:fe48db7a0c62db7b1111ca',
}

export const PROGRESS_KEYS = [ 'achievements', 'achievementsReward', 'achievementsTimeStart', 'achievementsTimeEnd', 'distanceDriven', 'timePlayed', 'sf-trip-tasks-v1', 'sf-trip-secrets-v1' ]

class AccountService
{
    constructor()
    {
        this.user = null
        this.listeners = new Set()
        this.status = 'idle'      // idle | saving | saved | error
        this.ready = this.boot()
    }

    async boot()
    {
        try
        {
            this.app = initializeApp(firebaseConfig)
            this.auth = getAuth(this.app)
            this.db = getFirestore(this.app)
            this.user = await new Promise((resolve) =>
            {
                const timeout = setTimeout(() => resolve(null), 4000)
                const stop = onAuthStateChanged(this.auth, (user) => { clearTimeout(timeout); stop(); resolve(user) })
            })
        }
        catch(error)
        {
            console.warn('Account: offline', error)
            this.user = null
        }

        if(this.user)
        {
            try
            {
                const snapshot = await getDoc(doc(this.db, 'users', this.user.uid))
                const progress = snapshot.exists() ? snapshot.data().progress || {} : null
                if(progress)
                    this.writeLocal(progress)
                else
                    this.saveNow() // first sign in: keep what was played as a guest
            }
            catch(error)
            {
                console.warn('Account: could not load progress', error)
                this.status = 'error'
            }
            this.watchStorage()
        }
        else
        {
            // guests start fresh every visit
            for(const key of PROGRESS_KEYS)
                localStorage.removeItem(key)
        }

        // keep listening (sign in / out in another tab, token refresh)
        if(this.auth)
            onAuthStateChanged(this.auth, (user) =>
            {
                if((user?.uid || null) !== (this.user?.uid || null))
                    location.reload()
            })
        this.emit()
    }

    readLocal()
    {
        const progress = {}
        for(const key of PROGRESS_KEYS)
        {
            const value = localStorage.getItem(key)
            if(value !== null)
                progress[key] = value
        }
        return progress
    }

    writeLocal(progress)
    {
        for(const key of PROGRESS_KEYS)
        {
            if(progress[key] !== undefined)
                localStorage.setItem(key, progress[key])
            else
                localStorage.removeItem(key)
        }
    }

    watchStorage()
    {
        const original = { set: Storage.prototype.setItem, remove: Storage.prototype.removeItem }
        const service = this
        Storage.prototype.setItem = function(key, value)
        {
            original.set.call(this, key, value)
            if(this === localStorage && PROGRESS_KEYS.includes(key))
                service.scheduleSave()
        }
        Storage.prototype.removeItem = function(key)
        {
            original.remove.call(this, key)
            if(this === localStorage && PROGRESS_KEYS.includes(key))
                service.scheduleSave()
        }
        addEventListener('pagehide', () => this.saveNow())
        document.addEventListener('visibilitychange', () => { if(document.visibilityState === 'hidden') this.saveNow() })
    }

    scheduleSave()
    {
        clearTimeout(this.saveTimeout)
        this.saveTimeout = setTimeout(() => this.saveNow(), 1500)
    }

    async saveNow()
    {
        if(!this.user || !this.db)
            return
        clearTimeout(this.saveTimeout)
        this.status = 'saving'
        this.emit()
        try
        {
            await setDoc(doc(this.db, 'users', this.user.uid), { progress: this.readLocal(), email: this.user.email || null, updatedAt: serverTimestamp() }, { merge: true })
            this.status = 'saved'
        }
        catch(error)
        {
            console.warn('Account: save failed', error)
            this.status = 'error'
            // try again shortly (network blip, database just created...)
            clearTimeout(this.retryTimeout)
            this.retryTimeout = setTimeout(() => this.saveNow(), 5000)
        }
        this.emit()
    }

    async signInGoogle()
    {
        const provider = new GoogleAuthProvider()
        const pending = this.pendingLink
        if(pending)
            provider.setCustomParameters({ login_hint: pending.email })
        try
        {
            const result = await signInWithPopup(this.auth, provider)
            // same email typed with a password just before: attach that password to this account too,
            // so both "Google" and "email + password" open the same account (and the same progress)
            if(pending && result.user.email?.toLowerCase() === pending.email.toLowerCase())
            {
                try { await linkWithCredential(result.user, EmailAuthProvider.credential(pending.email, pending.password)) }
                catch(error) { if(!/provider-already-linked|credential-already-in-use|email-already-in-use/.test(error.code || '')) console.warn('Account: link failed', error) }
            }
            this.pendingLink = null
        }
        catch(error)
        {
            if(error.code === 'auth/popup-blocked' || error.code === 'auth/operation-not-supported-in-this-environment')
                await signInWithRedirect(this.auth, provider)
            else
                throw error
        }
        await this.afterSignIn()
    }

    async signInEmail(email, password, create = false)
    {
        this.pendingLink = null
        try
        {
            if(create)
            {
                const result = await createUserWithEmailAndPassword(this.auth, email, password)
                // a verified email keeps its password when the same address later signs in with Google
                await sendEmailVerification(result.user).catch(() => {})
            }
            else
                await signInWithEmailAndPassword(this.auth, email, password)
        }
        catch(error)
        {
            // the address probably belongs to a Google account: offer to sign in with Google and link this password to it
            if(/email-already-in-use|invalid-credential|wrong-password/.test(error.code || ''))
            {
                this.pendingLink = { email, password }
                const linkable = new Error(error.message)
                linkable.code = create ? 'link/google-exists' : 'link/maybe-google'
                throw linkable
            }
            throw error
        }
        await this.afterSignIn()
    }

    async afterSignIn()
    {
        // load (or create) the cloud save, then restart with it
        const user = this.auth.currentUser
        const snapshot = await getDoc(doc(this.db, 'users', user.uid))
        if(!snapshot.exists())
        {
            this.user = user
            await this.saveNow()
        }
        location.reload()
    }

    resetPassword(email)
    {
        return sendPasswordResetEmail(this.auth, email)
    }

    async signOut()
    {
        await this.saveNow()
        for(const key of PROGRESS_KEYS)
            localStorage.removeItem(key)
        await signOut(this.auth)
        location.reload()
    }

    /** Remove this account and its cloud save for good */
    async deleteAccount()
    {
        const user = this.auth.currentUser
        if(!user)
            return
        await deleteDoc(doc(this.db, 'users', user.uid))
        await deleteUser(user)
        for(const key of PROGRESS_KEYS)
            localStorage.removeItem(key)
    }

    on(listener)
    {
        this.listeners.add(listener)
        listener(this)
    }

    emit()
    {
        for(const listener of this.listeners)
            listener(this)
    }
}

export const account = new AccountService()
if(import.meta.env.VITE_GAME_PUBLIC)
    window.__account = account

export const authErrorText = (error) =>
{
    const code = error?.code || ''
    if(code === 'link/google-exists') return '這個 Email 已用 Google 註冊。請點「使用 Google 帳號登入」，這組密碼會自動連結到同一個帳號。'
    if(code === 'link/maybe-google') return 'Email 或密碼不正確。如果這個 Email 是用 Google 註冊的，請改用 Google 登入，密碼會自動連結上去。'
    if(code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found')) return 'Email 或密碼不正確'
    if(code.includes('email-already-in-use')) return '這個 Email 已經註冊過了，請直接登入'
    if(code.includes('weak-password')) return '密碼至少需要 6 個字元'
    if(code.includes('invalid-email')) return 'Email 格式不正確'
    if(code.includes('too-many-requests')) return '嘗試次數太多，請稍後再試'
    if(code.includes('popup-closed') || code.includes('cancelled-popup')) return '登入視窗已關閉'
    if(code.includes('operation-not-allowed') || code.includes('configuration-not-found')) return '這個登入方式尚未開放'
    if(code.includes('unauthorized-domain')) return '這個網址暫時無法使用 Google 登入'
    if(code.includes('network')) return '連線失敗，請檢查網路'
    return '登入失敗，請再試一次'
}
