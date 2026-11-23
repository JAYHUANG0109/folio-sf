import { Howler } from 'howler'
import { Game } from './Game.js'

/**
 * Background music, generated live with WebAudio (no audio files, nothing to license):
 * a small band that plays endless variations in a few genres. Plays through Howler's master
 * gain, so the sound toggle mutes it too. The chosen genre is remembered per browser.
 */

const STORAGE_KEY = 'sf-trip-music-v1'
export const genres = [
    { id: 'jazz', name: '爵士', en: 'Jazz', icon: '🎷' },
    { id: 'bossa', name: '巴薩諾瓦', en: 'Bossa Nova', icon: '🌴' },
    { id: 'lofi', name: 'Lo-fi', en: 'Chill', icon: '☕' },
    { id: 'piano', name: '鋼琴', en: 'Piano', icon: '🎹' },
    { id: 'original', name: '原聲', en: 'Original songs', icon: '🎵' },
    { id: 'off', name: '關閉', en: 'Off', icon: '🔇' },
]

const QUALITY = {
    maj7: [ 0, 4, 7, 11 ], m7: [ 0, 3, 7, 10 ], 7: [ 0, 4, 7, 10 ], m7b5: [ 0, 3, 6, 10 ],
    maj9: [ 0, 4, 7, 11, 14 ], m9: [ 0, 3, 7, 10, 14 ], 9: [ 0, 4, 7, 10, 14 ], 6: [ 0, 4, 7, 9 ], 13: [ 0, 4, 10, 14, 21 ], add9: [ 0, 4, 7, 14 ], m: [ 0, 3, 7 ], maj: [ 0, 4, 7 ],
}
const NOTE = { C: 0, Db: 1, D: 2, Eb: 3, E: 4, F: 5, Gb: 6, G: 7, Ab: 8, A: 9, Bb: 10, B: 11 }
const chord = (name) =>
{
    const [ , root, quality ] = name.match(/^([A-G]b?)(.*)$/)
    return { root: NOTE[root], intervals: QUALITY[quality || 'maj'] }
}
const freq = (midi) => 440 * Math.pow(2, (midi - 69) / 12)
const pick = (list) => list[Math.floor(Math.random() * list.length)]

const progressions = {
    // ii-V-I turnarounds and a minor detour (one chord per bar, 4 beats)
    jazz: [ 'Gm7', 'C7', 'Fmaj7', 'D7', 'Gm7', 'C7', 'Am7', 'D7', 'Bbmaj7', 'Eb9', 'Am7', 'D7', 'Gm7', 'C7', 'Fmaj7', 'C7' ].map(chord),
    bossa: [ 'Fmaj7', 'Fmaj7', 'G9', 'G9', 'Gm7', 'C7', 'Fmaj7', 'C7', 'Dm7', 'G7', 'Em7', 'A7', 'Dm7', 'G9', 'Gm7', 'C7' ].map(chord),
    lofi: [ 'Fmaj9', 'Em7', 'Dm9', 'Cmaj7', 'Fmaj9', 'Em7', 'Am7', 'G9' ].map(chord),
    piano: [ 'C', 'Am', 'F', 'G', 'C', 'Em', 'F', 'G', 'Am', 'F', 'C', 'G', 'F', 'Am', 'Dm', 'G' ].map(c => chord(c.length === 1 ? `${c}add9` : `${c[0]}m`)),
}
const tempos = { jazz: 128, bossa: 132, lofi: 78, piano: 70 }

export class Music
{
    constructor()
    {
        this.game = Game.getInstance()

        let saved = null
        try { saved = localStorage.getItem(STORAGE_KEY) } catch(error) {}
        this.genre = genres.some(g => g.id === saved) ? saved : 'jazz'
        this.volume = 0.7
        try { const v = parseFloat(localStorage.getItem(STORAGE_KEY + '-volume')); if(!isNaN(v)) this.volume = v } catch(error) {}
        this.started = false
        this.listeners = []

        // Start on the first user gesture (browsers keep audio locked until then)
        const start = () =>
        {
            window.removeEventListener('pointerdown', start)
            window.removeEventListener('keydown', start)
            window.removeEventListener('touchstart', start)
            this.start()
        }
        window.addEventListener('pointerdown', start)
        window.addEventListener('keydown', start)
        window.addEventListener('touchstart', start, { passive: true })
    }

    onChange(callback)
    {
        this.listeners.push(callback)
        callback(this.genre)
    }

    setGenre(id, announce = true)
    {
        if(!genres.some(g => g.id === id))
            return
        this.genre = id
        try { localStorage.setItem(STORAGE_KEY, id) } catch(error) {}
        for(const callback of this.listeners)
            callback(id)

        if(!this.started)
            return
        this.applyGenre()

        if(announce && id !== 'off')
        {
            const g = genres.find(g => g.id === id)
            this.game.notifications?.show(`<div class="top"><div class="title">正在播放<br /><span class="song-name">${g.icon} ${g.name} · ${g.en}</span></div><div class="music-note-icon"></div></div>`, 'song', 4)
        }
    }

    setVolume(value)
    {
        this.volume = Math.min(1, Math.max(0, value))
        try { localStorage.setItem(STORAGE_KEY + '-volume', String(this.volume)) } catch(error) {}
        if(this.started)
            this.applyGenre()
        const howl = this.game.audio?.playlist?.current?.sound
        howl?.volume(0.2 * this.volume / 0.7)
    }

    start()
    {
        if(this.started)
            return
        const ctx = Howler.ctx
        if(!ctx)
            return
        if(ctx.state === 'suspended')
            ctx.resume()
        this.started = true
        this.ctx = ctx

        // band bus -> soft compressor -> Howler master (mute toggle applies)
        this.output = ctx.createGain()
        this.output.gain.value = 0
        this.compressor = ctx.createDynamicsCompressor()
        this.compressor.threshold.value = - 18
        this.compressor.ratio.value = 3
        this.output.connect(this.compressor)
        this.compressor.connect(Howler.masterGain || ctx.destination)

        // a little room
        this.reverb = ctx.createConvolver()
        this.reverb.buffer = this.makeImpulse(2.2)
        this.reverbSend = ctx.createGain()
        this.reverbSend.gain.value = 0.22
        this.reverbSend.connect(this.reverb)
        this.reverb.connect(this.output)

        this.noise = this.makeNoise()
        this.bar = 0
        this.beat = 0
        this.nextBeatTime = ctx.currentTime + 0.2
        this.timer = setInterval(() => this.schedule(), 40)

        this.applyGenre()
    }

    applyGenre()
    {
        const playlist = this.game.audio?.playlist
        const now = this.ctx.currentTime
        const band = [ 'jazz', 'bossa', 'lofi', 'piano' ].includes(this.genre)

        // Bruno's original songs
        if(this.genre === 'original')
        {
            if(playlist && !playlist.current?.sound.playing())
                playlist.play()
        }
        else if(playlist?.current)
        {
            playlist.current.sound.stop()
        }

        this.output.gain.cancelScheduledValues(now)
        this.output.gain.setTargetAtTime(band ? 0.8 * this.volume : 0, now, 0.4)
        if(band)
        {
            this.bar = 0
            this.beat = 0
            this.nextBeatTime = Math.max(this.nextBeatTime, now + 0.15)
            this.melody = { last: 72, rest: 0 }
        }
    }

    /* ---------- scheduler ---------- */

    schedule()
    {
        if(![ 'jazz', 'bossa', 'lofi', 'piano' ].includes(this.genre))
        {
            this.nextBeatTime = this.ctx.currentTime + 0.2
            return
        }
        const spb = 60 / tempos[this.genre]
        while(this.nextBeatTime < this.ctx.currentTime + 0.25)
        {
            const progression = progressions[this.genre]
            const current = progression[this.bar % progression.length]
            const next = progression[(this.bar + 1) % progression.length]
            this[this.genre](this.beat, this.nextBeatTime, spb, current, next)
            this.nextBeatTime += spb
            this.beat++
            if(this.beat >= 4)
            {
                this.beat = 0
                this.bar++
            }
        }
    }

    /* ---------- genres ---------- */

    jazz(beat, t, spb, c, next)
    {
        const swing = spb * 2 / 3
        // ride: ding, ding-da, ding, ding-da
        this.ride(t, 0.09)
        if(beat % 2 === 1)
            this.ride(t + swing, 0.06)
        // hi-hat foot on 2 and 4, soft brush on the snare
        if(beat % 2 === 1)
        {
            this.hat(t, 0.05, 0.03)
            this.brush(t, 0.05)
        }
        if(beat === 0 && Math.random() < 0.3)
            this.kick(t, 0.25)
        // walking bass: root, chord tones, chromatic approach to the next root
        const root = 36 + c.root
        let note
        if(beat === 0)
            note = root
        else if(beat === 3)
            note = 36 + next.root + (Math.random() < 0.5 ? 1 : - 1)
        else
            note = root + pick(c.intervals.slice(1, 4)) - (Math.random() < 0.3 ? 12 : 0)
        while(note < 31) note += 12
        this.bass(t, note, spb * 0.9, 0.5)
        // piano comping (Charleston: on 1 and the "and" of 2), rootless voicing
        const voicing = c.intervals.slice(1).map(i => 52 + ((c.root + i) % 12)).map(n => n < 52 ? n + 12 : n)
        if(beat === 0 && Math.random() < 0.8)
            this.keys(t + 0.01, voicing, spb * 0.6, 0.16)
        if(beat === 1 && Math.random() < 0.7)
            this.keys(t + swing, voicing, spb * 0.4, 0.13)
        if(beat === 3 && Math.random() < 0.3)
            this.keys(t + swing, voicing, spb * 0.3, 0.1)
        // a lazy improvised line on swung eighths
        this.improvise(t, spb, swing, c, 0.11)
    }

    bossa(beat, t, spb, c, next)
    {
        const e = spb / 2
        // shaker eighths, rim click pattern (2 bar clave feel)
        this.hat(t, 0.035, 0.02)
        this.hat(t + e, 0.025, 0.02)
        const clave = (this.bar % 2 === 0) ? [ [ 0, 0 ], [ 1, 1 ], [ 3, 0 ] ] : [ [ 0, 1 ], [ 2, 0 ], [ 3, 1 ] ]
        for(const [ b, half ] of clave)
            if(b === beat)
                this.rim(t + half * e, 0.07)
        // bass: root on 1, fifth on 3, pushes on the "and"
        const root = 36 + c.root
        if(beat === 0) this.bass(t, root, spb * 1.4, 0.5)
        if(beat === 1) this.bass(t + e, root + 7, spb * 0.4, 0.3)
        if(beat === 2) this.bass(t, root + 7, spb * 1.4, 0.45)
        if(beat === 3) this.bass(t + e, 36 + next.root, spb * 0.4, 0.3)
        if(beat % 2 === 0) this.kick(t, 0.2)
        // nylon guitar-ish chords: syncopated
        const voicing = c.intervals.slice(1).map(i => 55 + ((c.root + i) % 12))
        const comp = [ [ 0, 0 ], [ 1, 1 ], [ 2, 1 ], [ 3, 0 ] ]
        for(const [ b, half ] of comp)
            if(b === beat)
                this.pluck(t + half * e, voicing, spb * 0.5, 0.12)
        this.improvise(t, spb, e, c, 0.08, 0.35)
    }

    lofi(beat, t, spb, c, next)
    {
        const e = spb / 2
        const swing = e * 1.12
        // boom-bap: kick on 1 and the "and" of 3, snare on 2 and 4, lazy hats
        if(beat === 0) this.kick(t, 0.5)
        if(beat === 2) this.kick(t + e, 0.4)
        if(beat % 2 === 1) this.snare(t, 0.2)
        this.hat(t, 0.04, 0.03)
        this.hat(t + swing, 0.025, 0.03)
        // vinyl crackle
        for(let i = 0; i < 3; i++)
            if(Math.random() < 0.4)
                this.crackle(t + Math.random() * spb)
        // long warm chords and a round bass
        if(beat === 0)
        {
            const voicing = c.intervals.map(i => 53 + ((c.root + i) % 12))
            this.keys(t, voicing, spb * 3.6, 0.13, 900)
            this.bass(t, 36 + c.root, spb * 1.8, 0.55)
        }
        if(beat === 2)
            this.bass(t + e, 36 + c.root + (Math.random() < 0.5 ? 7 : 12), spb * 1.2, 0.4)
        this.improvise(t, spb, e, c, 0.07, 0.25, 900)
    }

    piano(beat, t, spb, c, next)
    {
        // gentle arpeggios with a slow melody on top
        const notes = c.intervals.map(i => 48 + ((c.root + i) % 12))
        const arpeggio = [ notes[0] - 12, notes[1] + 12 - 12, notes[2], notes[1] + 12, notes[3] ?? notes[0] + 12, notes[2], notes[1] + 12, notes[0] + 12 ]
        for(let k = 0; k < 2; k++)
            this.keys(t + k * spb / 2, [ arpeggio[(beat * 2 + k) % arpeggio.length] ], spb * 1.4, 0.13, 3200)
        if(beat === 0 || (beat === 2 && Math.random() < 0.6))
        {
            const top = c.intervals.map(i => 72 + ((c.root + i) % 12))
            this.keys(t + 0.01, [ pick(top) ], spb * 1.8, 0.14, 3800)
        }
    }

    improvise(t, spb, offbeat, c, volume, density = 0.5, cutoff = 3000)
    {
        const m = this.melody
        if(m.rest > 0)
        {
            m.rest--
            return
        }
        if(Math.random() < 0.18)
        {
            m.rest = 2 + Math.floor(Math.random() * 4) // breathe
            return
        }
        const scale = [ ...new Set([ ...c.intervals, 2, 9 ].map(i => (c.root + i) % 12)) ]
        const step = () =>
        {
            let candidate = m.last + pick([ - 3, - 2, - 1, 1, 2, 3, 4 ])
            for(let k = 0; k < 6 && !scale.includes(((candidate % 12) + 12) % 12); k++)
                candidate += 1
            if(candidate > 82) candidate -= 12
            if(candidate < 64) candidate += 12
            m.last = candidate
            return candidate
        }
        this.lead(t, step(), spb * 0.45, volume, cutoff)
        if(Math.random() < density)
            this.lead(t + offbeat, step(), spb * 0.35, volume * 0.8, cutoff)
    }

    /* ---------- instruments ---------- */

    voice(destinationGain = 1)
    {
        const gain = this.ctx.createGain()
        gain.connect(this.output)
        const send = this.ctx.createGain()
        send.gain.value = destinationGain
        gain.connect(send)
        send.connect(this.reverbSend)
        return gain
    }

    envelope(gain, t, attack, peak, decay)
    {
        gain.gain.setValueAtTime(0.0001, t)
        gain.gain.exponentialRampToValueAtTime(peak, t + attack)
        gain.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay)
    }

    tone(t, frequency, type, duration, peak, cutoff = 2500, attack = 0.008, reverb = 1)
    {
        const osc = this.ctx.createOscillator()
        osc.type = type
        osc.frequency.value = frequency
        const filter = this.ctx.createBiquadFilter()
        filter.type = 'lowpass'
        filter.frequency.value = cutoff
        const gain = this.voice(reverb)
        osc.connect(filter)
        filter.connect(gain)
        this.envelope(gain, t, attack, peak, duration)
        osc.start(t)
        osc.stop(t + attack + duration + 0.05)
    }

    // electric piano: sine body + bell partial
    keys(t, notes, duration, volume, cutoff = 2400)
    {
        for(const n of notes)
        {
            const v = volume / Math.sqrt(notes.length)
            this.tone(t, freq(n), 'sine', duration, v, cutoff)
            this.tone(t, freq(n) * 2, 'triangle', duration * 0.35, v * 0.25, cutoff)
            this.tone(t, freq(n) * 3.01, 'sine', duration * 0.15, v * 0.08, cutoff * 2)
        }
    }

    pluck(t, notes, duration, volume)
    {
        notes.forEach((n, i) => this.tone(t + i * 0.012, freq(n), 'triangle', duration, volume / notes.length * 1.6, 1800, 0.004))
    }

    lead(t, note, duration, volume, cutoff = 3000)
    {
        this.tone(t, freq(note), 'triangle', duration, volume, cutoff, 0.02)
        this.tone(t, freq(note), 'sine', duration * 1.2, volume * 0.6, cutoff, 0.03)
    }

    bass(t, note, duration, volume)
    {
        this.tone(t, freq(note), 'triangle', duration, volume * 0.6, 700, 0.01, 0.1)
        this.tone(t, freq(note), 'sine', duration, volume * 0.5, 400, 0.01, 0)
    }

    noiseHit(t, duration, volume, type, frequency, q = 1)
    {
        const source = this.ctx.createBufferSource()
        source.buffer = this.noise
        const filter = this.ctx.createBiquadFilter()
        filter.type = type
        filter.frequency.value = frequency
        filter.Q.value = q
        const gain = this.voice(0.3)
        source.connect(filter)
        filter.connect(gain)
        this.envelope(gain, t, 0.002, volume, duration)
        source.start(t, Math.random() * 1.5)
        source.stop(t + duration + 0.05)
    }

    ride(t, volume) { this.noiseHit(t, 0.35, volume, 'highpass', 6500); this.tone(t, 5200, 'square', 0.25, volume * 0.04, 9000, 0.002, 0.3) }
    hat(t, volume, duration) { this.noiseHit(t, duration, volume, 'highpass', 8000) }
    brush(t, volume) { this.noiseHit(t, 0.18, volume, 'bandpass', 2500, 0.6) }
    snare(t, volume) { this.noiseHit(t, 0.16, volume, 'bandpass', 1800, 0.8); this.tone(t, 190, 'triangle', 0.08, volume * 0.5, 1200, 0.002, 0.2) }
    rim(t, volume) { this.tone(t, 1700, 'square', 0.03, volume, 3000, 0.001, 0.4) }
    crackle(t) { this.noiseHit(t, 0.012, 0.03 + Math.random() * 0.04, 'highpass', 3000) }

    kick(t, volume)
    {
        const osc = this.ctx.createOscillator()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(110, t)
        osc.frequency.exponentialRampToValueAtTime(42, t + 0.12)
        const gain = this.voice(0)
        osc.connect(gain)
        this.envelope(gain, t, 0.003, volume, 0.28)
        osc.start(t)
        osc.stop(t + 0.35)
    }

    /* ---------- buffers ---------- */

    makeNoise()
    {
        const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 2, this.ctx.sampleRate)
        const data = buffer.getChannelData(0)
        for(let i = 0; i < data.length; i++)
            data[i] = Math.random() * 2 - 1
        return buffer
    }

    makeImpulse(seconds)
    {
        const length = Math.floor(this.ctx.sampleRate * seconds)
        const buffer = this.ctx.createBuffer(2, length, this.ctx.sampleRate)
        for(let channel = 0; channel < 2; channel++)
        {
            const data = buffer.getChannelData(channel)
            for(let i = 0; i < length; i++)
                data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 3)
        }
        return buffer
    }
}
