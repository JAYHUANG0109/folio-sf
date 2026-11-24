/**
 * Stadium announcer clips: turn raw recordings into game-ready audio.
 *
 *   recordings/announcer/<name>[-<take>].(m4a|mp3|wav|aac|caf|ogg)   ->   static/sounds/announcer/<name>-<take>.mp3
 *   + static/sounds/announcer/manifest.json  { touchdown: [ 'touchdown-1.mp3', ... ], ... }
 *
 * Names (see recordings/announcer/SCRIPT.md): touchdown, countdown, firstdown, catch, tackle, bighit, fieldgoal, missed,
 * interception, fumble, sack, thirddown, stop (several takes each are fine).
 * Processing (ffmpeg): trim silence at both ends, high-pass rumble, compress, loudness-normalize,
 * a short stadium PA slap-back echo. Run: npm run sf:announcer
 */
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..')
const input = path.join(root, 'recordings/announcer')
const output = path.join(root, 'static/sounds/announcer')
const NAMES = [ 'touchdown', 'countdown', 'firstdown', 'catch', 'tackle', 'bighit', 'fieldgoal', 'missed', 'interception', 'fumble', 'sack', 'thirddown', 'stop' ]

fs.mkdirSync(output, { recursive: true })
for(const old of fs.readdirSync(output).filter(f => f.endsWith('.mp3')))      // start clean: no stale takes
    fs.rmSync(path.join(output, old))
const files = fs.existsSync(input) ? fs.readdirSync(input).filter(f => /\.(m4a|mp3|wav|aac|caf|ogg|mp4|mov|aiff|aif)$/i.test(f)) : []
const manifest = {}
const takes = {}

for(const file of files.sort())
{
    const base = path.basename(file, path.extname(file)).toLowerCase().replace(/\s+/g, '')
    const name = NAMES.find(n => base === n || base.startsWith(n + '-') || base.startsWith(n + '_') || /^\d+$/.test(base.slice(n.length)) && base.startsWith(n))
    if(!name)
    {
        console.warn('skipped (unknown name):', file, '- use one of', NAMES.join(', '))
        continue
    }
    takes[name] = (takes[name] || 0) + 1
    const outName = `${name}-${takes[name]}.mp3`
    const filters = [
        'silenceremove=start_periods=1:start_threshold=-42dB:start_silence=0.05',
        'areverse',
        'silenceremove=start_periods=1:start_threshold=-42dB:start_silence=0.12',
        'areverse',
        'highpass=f=90',
        'acompressor=threshold=-20dB:ratio=4:attack=5:release=120:makeup=4',
        'loudnorm=I=-14:TP=-1.5:LRA=9',
        'aecho=0.85:0.6:70|140:0.22|0.1',          // the stadium PA bouncing off the stands
        'afade=t=out:st=0:d=0.01',
    ]
    execFileSync('ffmpeg', [ '-y', '-loglevel', 'error', '-i', path.join(input, file), '-ac', '1', '-ar', '44100', '-af', filters.filter(f => !f.startsWith('afade')).join(','), '-b:a', '128k', path.join(output, outName) ])
    ;(manifest[name] = manifest[name] || []).push(outName)
    console.log('announcer:', file, '->', outName)
}

fs.writeFileSync(path.join(output, 'manifest.json'), JSON.stringify(manifest, null, 2))
console.log('announcer clips:', Object.fromEntries(Object.entries(manifest).map(([ k, v ]) => [ k, v.length ])), files.length ? '' : '(no recordings yet: put them in recordings/announcer/)')
