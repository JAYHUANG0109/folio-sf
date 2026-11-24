import * as THREE from 'three/webgpu'
import { texture, vec4 } from 'three/tsl'

/**
 * The two giant Levi's video boards: a live broadcast screen drawn on a canvas.
 *  - bottom: the scorebug (SF / SEA score, quarter, game clock, down & distance, ball on)
 *  - main: the live all-22 view of the play, player intro cards between plays, and big moments:
 *    TOUCHDOWN (then an INSTANT REPLAY of the scoring play), IT'S GOOD, INTERCEPTION, FUMBLE, SACK, FINAL.
 */
const W = 768, H = 288, BUG = 58
const NINERS = { name: '49ERS', short: 'SF', main: '#aa0000', accent: '#b3995d' }
const HAWKS = { name: 'SEAHAWKS', short: 'SEA', main: '#002244', accent: '#69be28' }
const INTROS = [
    [ 13, 'BROCK PURDY', 'QUARTERBACK' ], [ 23, 'CHRISTIAN McCAFFREY', 'RUNNING BACK' ], [ 85, 'GEORGE KITTLE', 'TIGHT END' ],
    [ 44, 'KYLE JUSZCZYK', 'FULLBACK' ], [ 71, 'TRENT WILLIAMS', 'LEFT TACKLE' ], [ 97, 'NICK BOSA', 'DEFENSIVE END' ], [ 54, 'FRED WARNER', 'LINEBACKER' ],
]
const NAMES = { 13: 'B. PURDY', 23: 'C. McCAFFREY', 85: 'G. KITTLE', 44: 'K. JUSZCZYK', 80: 'R. BELL', 19: 'J. JENNINGS', 9: 'K. WALKER III', 14: 'S. DARNOLD', 16: 'T. LOCKETT', 88: 'J. SMITH-NJIGBA' }

export class Jumbotron
{
    constructor(gameDay)
    {
        this.gameDay = gameDay
        this.game = gameDay.game
        this.canvas = document.createElement('canvas')
        this.canvas.width = W
        this.canvas.height = H
        this.ctx = this.canvas.getContext('2d')
        this.texture = new THREE.CanvasTexture(this.canvas)
        this.texture.colorSpace = THREE.SRGBColorSpace
        this.texture.anisotropy = 4

        const material = new THREE.MeshBasicNodeMaterial()
        material.outputNode = vec4(texture(this.texture).rgb.mul(1.25), 1)      // a little over-bright: it glows at night
        material.fog = false
        const k = gameDay.scale
        this.screens = [ - 1, 1 ].map(side =>
        {
            const mesh = new THREE.Mesh(new THREE.PlaneGeometry(8 * k, 3 * k), material)
            mesh.position.set(gameDay.center.x + side * (20.5 - 0.33) * k, gameDay.center.y + 7.9 * k, gameDay.center.z)
            mesh.rotation.y = - side * Math.PI / 2
            this.game.scene.add(mesh)
            return mesh
        })

        this.score = { sf: 0, sea: 0 }
        this.quarter = 1
        this.clock = 15 * 60
        this.final = 0
        this.moment = null               // { kind, time, ... } a big graphic on screen
        this.history = []                // last few seconds of the play, for the instant replay
        this.replay = null
        this.introIndex = 0
        this.introTimer = 6
        this.intro = null
        this.redraw = 0
        this.time = 0
    }

    setVisible(visible)
    {
        for(const s of this.screens)
            s.visible = visible
    }

    /* ---------- game events (from GameDay) ---------- */

    event(kind, data = {})
    {
        if(kind === 'touchdown')
        {
            this.score[data.team] += 7
            this.moment = { kind, time: 0, duration: 4, ...data }
            this.replayQueued = data.team === 'sf' && !data.user ? this.history.slice() : null
        }
        else if(kind === 'fieldgoal')
        {
            this.score[data.team] += 3
            this.moment = { kind, time: 0, duration: 3.5, ...data }
        }
        else
            this.moment = { kind, time: 0, duration: 3, ...data }
        this.intro = null
        this.redraw = 0
    }

    /* ---------- update ---------- */

    update(delta)
    {
        this.time += delta
        // game clock: runs fast (about 4 game seconds per second), stops for big moments
        if(!this.moment && !this.replay && !this.final)
        {
            this.clock -= delta * 4
            if(this.clock <= 0)
            {
                this.quarter++
                this.clock = 15 * 60
                if(this.quarter > 4)
                {
                    this.final = 12
                    this.quarter = 4
                    this.clock = 0
                }
            }
        }
        if(this.final)
        {
            this.final = Math.max(0, this.final - delta)
            if(!this.final)
            {
                this.score = { sf: 0, sea: 0 }
                this.quarter = 1
                this.clock = 15 * 60
            }
        }

        // remember the field: 10 snapshots a second, the last 7 seconds
        this.sampleTimer = (this.sampleTimer || 0) - delta
        if(this.sampleTimer <= 0)
        {
            this.sampleTimer = 0.1
            this.history.push(this.snapshot())
            if(this.history.length > 70)
                this.history.shift()
        }

        if(this.moment)
        {
            this.moment.time += delta
            if(this.moment.time > this.moment.duration)
            {
                this.moment = null
                if(this.replayQueued?.length > 10)
                    this.replay = { frames: this.replayQueued, t: 0 }
                this.replayQueued = null
            }
        }
        if(this.replay)
        {
            this.replay.t += delta * 0.55 * 10           // slow motion
            if(this.replay.t >= this.replay.frames.length - 1)
                this.replay = null
        }

        // player intros between plays, now and then
        this.introTimer -= delta
        if(this.introTimer <= 0 && !this.moment && !this.replay)
        {
            this.intro = { data: INTROS[this.introIndex++ % INTROS.length], time: 0 }
            this.introTimer = 22 + Math.random() * 10
        }
        if(this.intro)
        {
            this.intro.time += delta
            if(this.intro.time > 5)
                this.intro = null
        }

        this.redraw -= delta
        if(this.redraw <= 0)
        {
            this.redraw = 1 / 12
            this.draw()
            this.texture.needsUpdate = true
        }
    }

    snapshot()
    {
        const g = this.gameDay, k = g.scale
        const toField = (p) => [ (p.x - g.center.x) / k, (p.z - g.center.z) / k ]
        return {
            teams: g.teams.map(team => team.players.map(pl => toField(pl.root.position))),
            ball: toField(g.ball.position),
            ballY: (g.ball.position.y - g.center.y) / k,
        }
    }

    /* ---------- drawing ---------- */

    draw()
    {
        const c = this.ctx
        c.save()
        c.fillStyle = '#05070c'
        c.fillRect(0, 0, W, H)
        const main = { x: 0, y: 0, w: W, h: H - BUG }
        if(this.final)
            this.drawBanner(main, 'FINAL', `${NINERS.name} ${this.score.sf}  ·  ${HAWKS.name} ${this.score.sea}`, this.score.sf >= this.score.sea ? NINERS : HAWKS)
        else if(this.moment)
            this.drawMoment(main)
        else if(this.replay)
        {
            const i = Math.floor(this.replay.t)
            const f = this.replay.t - i
            this.drawField(main, this.lerpFrame(this.replay.frames[i], this.replay.frames[Math.min(i + 1, this.replay.frames.length - 1)], f))
            this.tag(main, '⟲ INSTANT REPLAY', '#e8b923')
        }
        else if(this.intro)
            this.drawIntro(main)
        else
        {
            this.drawField(main, this.history[this.history.length - 1] || this.snapshot())
            this.tag(main, '● LIVE', '#ff3b3b')
        }
        this.drawBug({ x: 0, y: H - BUG, w: W, h: BUG })
        // scanline sheen over everything, like a real LED board
        c.globalAlpha = 0.08
        c.fillStyle = '#000'
        for(let y = 0; y < H; y += 3)
            c.fillRect(0, y, W, 1)
        c.restore()
    }

    lerpFrame(a, b, f)
    {
        const mix = (p, q) => [ p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f ]
        return { teams: a.teams.map((team, t) => team.map((p, i) => mix(p, b.teams[t][i]))), ball: mix(a.ball, b.ball), ballY: a.ballY + (b.ballY - a.ballY) * f }
    }

    drawField(r, frame)
    {
        const c = this.ctx
        // the field, end zones and yard lines (field x -12..12 by z -5.5..5.5)
        const pad = 10
        const sx = (r.w - pad * 2) / 24, sz = (r.h - pad * 2) / 11
        const X = (x) => r.x + pad + (x + 12) * sx, Y = (z) => r.y + pad + (z + 5.5) * sz
        const grass = c.createLinearGradient(0, r.y, 0, r.y + r.h)
        grass.addColorStop(0, '#2f8a35')
        grass.addColorStop(1, '#246b2a')
        c.fillStyle = grass
        c.fillRect(X(- 12), Y(- 5.5), 24 * sx, 11 * sz)
        for(let i = 0; i < 10; i++)
        {
            c.fillStyle = i % 2 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.04)'
            c.fillRect(X(- 10 + i * 2), Y(- 5.5), 2 * sx, 11 * sz)
        }
        c.fillStyle = NINERS.main
        c.fillRect(X(10), Y(- 5.5), 2 * sx, 11 * sz)
        c.fillRect(X(- 12), Y(- 5.5), 2 * sx, 11 * sz)
        c.save()
        c.fillStyle = NINERS.accent
        c.font = '900 22px "Nunito", sans-serif'
        c.textAlign = 'center'
        c.textBaseline = 'middle'
        for(const side of [ - 1, 1 ])
        {
            c.save()
            c.translate(X(side * 11), Y(0))
            c.rotate(side * Math.PI / 2)
            c.fillText('49ERS', 0, 0)
            c.restore()
        }
        c.restore()
        c.strokeStyle = 'rgba(255,255,255,0.8)'
        c.lineWidth = 1.5
        for(let i = 0; i <= 10; i++)
        {
            c.beginPath()
            c.moveTo(X(- 10 + i * 2), Y(- 5.5))
            c.lineTo(X(- 10 + i * 2), Y(5.5))
            c.stroke()
        }
        c.fillStyle = 'rgba(255,255,255,0.7)'
        c.font = '700 11px "Nunito", sans-serif'
        c.textAlign = 'center'
        for(let i = 1; i < 10; i++)
            c.fillText(String(Math.min(i, 10 - i) * 10), X(- 10 + i * 2), Y(4.6))
        // line of scrimmage and the first down line
        const p = this.gameDay.play
        c.fillStyle = 'rgba(80,160,255,0.85)'
        c.fillRect(X(p.line) - 1.5, Y(- 5.5), 3, 11 * sz)
        c.fillStyle = 'rgba(255,220,0,0.9)'
        c.fillRect(X(p.line + p.dir * p.toGo) - 1.5, Y(- 5.5), 3, 11 * sz)
        // players: team colored dots with a light ring
        const teams = [ NINERS, HAWKS ]
        frame.teams.forEach((team, t) =>
        {
            for(const [ x, z ] of team)
            {
                c.beginPath()
                c.arc(X(x), Y(z), 6.5, 0, Math.PI * 2)
                c.fillStyle = teams[t].main
                c.fill()
                c.lineWidth = 2
                c.strokeStyle = teams[t].accent
                c.stroke()
            }
        })
        // the ball (bigger when it's in the air)
        const [ bx, bz ] = frame.ball
        const air = Math.max(0, frame.ballY - 1) * 0.6
        c.beginPath()
        c.ellipse(X(bx), Y(bz), 6 + air * 2, 4 + air * 1.4, 0, 0, Math.PI * 2)
        c.fillStyle = '#8b4a1c'
        c.fill()
        c.strokeStyle = '#fff'
        c.lineWidth = 1.5
        c.stroke()
    }

    tag(r, text, color)
    {
        const c = this.ctx
        c.font = '900 16px "Nunito", sans-serif'
        const w = c.measureText(text).width + 20
        c.fillStyle = 'rgba(0,0,0,0.65)'
        c.fillRect(r.x + 14, r.y + 14, w, 26)
        c.fillStyle = color
        c.textBaseline = 'middle'
        c.textAlign = 'left'
        if(text.startsWith('●') && Math.sin(this.time * 6) < 0)
            c.fillStyle = '#aa2222'
        c.fillText(text, r.x + 24, r.y + 28)
    }

    drawIntro(r)
    {
        const c = this.ctx
        const [ number, name, position ] = this.intro.data
        const t = this.intro.time
        const slide = Math.min(1, t * 3)
        const g = c.createLinearGradient(r.x, 0, r.x + r.w, 0)
        g.addColorStop(0, '#6d0000')
        g.addColorStop(0.55, NINERS.main)
        g.addColorStop(1, '#3a0000')
        c.fillStyle = g
        c.fillRect(r.x, r.y, r.w, r.h)
        // gold diagonal stripes
        c.save()
        c.globalAlpha = 0.18
        c.fillStyle = NINERS.accent
        for(let i = - 4; i < 14; i++)
        {
            c.beginPath()
            const x = i * 70 + (t * 40) % 70
            c.moveTo(x, r.y); c.lineTo(x + 30, r.y); c.lineTo(x - 50, r.y + r.h); c.lineTo(x - 80, r.y + r.h)
            c.fill()
        }
        c.restore()
        // big number on the left, name and position sliding in
        c.textBaseline = 'middle'
        c.textAlign = 'center'
        c.font = '900 150px "Nunito", sans-serif'
        c.lineWidth = 8
        c.strokeStyle = NINERS.accent
        c.strokeText(String(number), r.x + 150, r.y + r.h / 2 + 6)
        c.fillStyle = '#fff'
        c.fillText(String(number), r.x + 150, r.y + r.h / 2 + 6)
        c.textAlign = 'left'
        c.globalAlpha = slide
        c.fillStyle = NINERS.accent
        c.font = '800 20px "Nunito", sans-serif'
        c.fillText('STARTING LINEUP · SAN FRANCISCO', r.x + 290 + (1 - slide) * 80, r.y + 52)
        c.fillStyle = '#fff'
        c.font = `900 ${name.length > 14 ? 36 : 46}px "Nunito", sans-serif`
        c.fillText(name, r.x + 290 + (1 - slide) * 140, r.y + 110)
        c.fillStyle = 'rgba(255,255,255,0.85)'
        c.font = '800 24px "Nunito", sans-serif'
        c.fillText(position, r.x + 290 + (1 - slide) * 200, r.y + 160)
        c.globalAlpha = 1
    }

    drawBanner(r, big, small, team, flash = false)
    {
        const c = this.ctx
        const on = !flash || Math.sin(this.time * 14) > - 0.3
        c.fillStyle = on ? team.main : '#120000'
        c.fillRect(r.x, r.y, r.w, r.h)
        // light rays from the center
        c.save()
        c.translate(r.x + r.w / 2, r.y + r.h / 2)
        c.rotate(this.time * 0.6)
        c.fillStyle = 'rgba(255,255,255,0.07)'
        for(let i = 0; i < 12; i++)
        {
            c.rotate(Math.PI / 6)
            c.beginPath()
            c.moveTo(0, 0); c.lineTo(500, - 40); c.lineTo(500, 40)
            c.fill()
        }
        c.restore()
        const pop = Math.min(1, (this.moment?.time ?? 1) * 4)
        c.save()
        c.translate(r.x + r.w / 2, r.y + r.h / 2 - 14)
        c.scale(0.6 + pop * 0.4, 0.6 + pop * 0.4)
        c.textAlign = 'center'
        c.textBaseline = 'middle'
        c.font = `900 ${big.length > 11 ? 70 : 92}px "Nunito", sans-serif`
        c.lineWidth = 10
        c.strokeStyle = '#000'
        c.strokeText(big, 0, 0)
        c.fillStyle = team.accent === '#69be28' ? '#fff' : '#ffd24a'
        c.fillText(big, 0, 0)
        c.restore()
        c.textAlign = 'center'
        c.fillStyle = '#fff'
        c.font = '800 26px "Nunito", sans-serif'
        c.fillText(small, r.x + r.w / 2, r.y + r.h - 34)
    }

    drawMoment(r)
    {
        const m = this.moment
        const scorer = m.number ? `#${m.number} ${NAMES[m.number] || ''}`.trim() : ''
        if(m.kind === 'touchdown')
        {
            if(m.team === 'sf')
                this.drawBanner(r, 'TOUCHDOWN!', m.user ? '朵婕 SCORES! ♥  49ERS +7' : `${scorer}  ·  49ERS +7`, NINERS, true)
            else
                this.drawBanner(r, 'TOUCHDOWN', `${scorer}  ·  SEAHAWKS +7`, HAWKS)
        }
        else if(m.kind === 'fieldgoal')
            this.drawBanner(r, "IT'S GOOD!", `${m.team === 'sf' ? '49ERS' : 'SEAHAWKS'} +3`, m.team === 'sf' ? NINERS : HAWKS)
        else if(m.kind === 'missed')
            this.drawBanner(r, 'NO GOOD!', 'WIDE RIGHT', NINERS)
        else if(m.kind === 'interception')
            this.drawBanner(r, 'PICKED OFF!', '49ERS BALL', NINERS, true)
        else if(m.kind === 'fumble')
            this.drawBanner(r, 'FUMBLE!', 'RECOVERED BY SAN FRANCISCO', NINERS, true)
        else if(m.kind === 'sack')
            this.drawBanner(r, 'SACK!', 'THE 49ERS DEFENSE', NINERS)
        else if(m.kind === 'firstdown')
            this.drawBanner(r, 'FIRST DOWN', 'SAN FRANCISCO', NINERS)
        else if(m.kind === 'stop')
            this.drawBanner(r, 'DEFENSE!', 'TURNOVER ON DOWNS', NINERS)
    }

    drawBug(r)
    {
        const c = this.ctx
        const g = c.createLinearGradient(0, r.y, 0, r.y + r.h)
        g.addColorStop(0, '#1c2230')
        g.addColorStop(1, '#0b0e15')
        c.fillStyle = g
        c.fillRect(r.x, r.y, r.w, r.h)
        const p = this.gameDay.play
        const team = (x, t, score, has) =>
        {
            c.fillStyle = t.main
            c.fillRect(x, r.y + 6, 190, r.h - 12)
            c.fillStyle = t.accent
            c.fillRect(x, r.y + r.h - 10, 190, 4)
            c.textBaseline = 'middle'
            c.textAlign = 'left'
            c.fillStyle = '#fff'
            c.font = '900 26px "Nunito", sans-serif'
            c.fillText(t.short, x + 14, r.y + r.h / 2)
            if(has)
            {
                c.fillStyle = '#ffd24a'
                c.beginPath()
                c.ellipse(x + 82, r.y + r.h / 2, 9, 6, 0, 0, Math.PI * 2)
                c.fill()
            }
            c.textAlign = 'right'
            c.font = '900 36px "Nunito", sans-serif'
            c.fillStyle = '#fff'
            c.fillText(String(score), x + 178, r.y + r.h / 2 + 1)
        }
        team(r.x + 8, NINERS, this.score.sf, p.dir > 0)
        team(r.x + 204, HAWKS, this.score.sea, p.dir < 0)
        // quarter and clock
        const minutes = Math.floor(this.clock / 60), seconds = Math.floor(this.clock % 60)
        c.textAlign = 'center'
        c.fillStyle = '#fff'
        c.font = '800 22px "Nunito", sans-serif'
        c.fillText(this.final ? 'FINAL' : `Q${this.quarter}`, r.x + 450, r.y + r.h / 2)
        c.font = '900 28px "Nunito", sans-serif'
        c.fillText(this.final ? '' : `${minutes}:${String(seconds).padStart(2, '0')}`, r.x + 530, r.y + r.h / 2)
        // down & distance, ball on
        const ord = [ '', '1st', '2nd', '3rd', '4th' ][Math.min(4, p.down)] || '1st'
        const toGo = Math.max(1, Math.round(p.toGo * 5))
        const goal = (10 - p.dir * p.line) * 5 <= toGo
        c.fillStyle = '#ffd24a'
        c.font = '900 22px "Nunito", sans-serif'
        c.fillText(`${ord} & ${goal ? 'GOAL' : toGo}`, r.x + 670, r.y + r.h / 2)
    }
}
