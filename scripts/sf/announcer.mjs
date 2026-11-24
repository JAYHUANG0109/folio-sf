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
import { execFileSync, spawnSync } from 'node:child_process'

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..')
const input = path.join(root, 'recordings/announcer')
const output = path.join(root, 'static/sounds/announcer')
const PITCH = 0.84            // < 1 = deeper (0.84 is about 3 semitones down)
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
    // find where the speech starts and ends (gaps inside the line are kept), with a small cushion either side
    const source = path.join(input, file)
    const duration = parseFloat(execFileSync('ffprobe', [ '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', source ]).toString())
    const detect = spawnSync('ffmpeg', [ '-i', source, '-af', 'silencedetect=noise=-38dB:d=0.25', '-f', 'null', '-' ]).stderr.toString()
    const silences = [ ...detect.matchAll(/silence_start: ([0-9.]+)[\s\S]*?(?:silence_end: ([0-9.]+)|$)/g) ].map(m => [ parseFloat(m[1]), m[2] ? parseFloat(m[2]) : duration ])
    let start = 0, end = duration
    if(silences.length && silences[0][0] < 0.05)
        start = silences[0][1]
    const last = silences[silences.length - 1]
    if(last && last[1] >= duration - 0.05 && last[0] > start)
        end = last[0]
    start = Math.max(0, start - 0.25)
    end = Math.min(duration, end + 0.3)
    const filters = [
        `atrim=start=${start.toFixed(3)}:end=${end.toFixed(3)}`,
        'asetpts=PTS-STARTPTS',
        // a deeper, older voice: down ~3 semitones (pitch and formants), same speed, a warmer low end
        'aresample=44100',
        `asetrate=${Math.round(44100 * PITCH)}`,
        'aresample=44100',
        `atempo=${(1 / PITCH).toFixed(4)}`,
        'bass=g=4:f=140:w=0.8',
        'highpass=f=70',
        'acompressor=threshold=-20dB:ratio=4:attack=5:release=120:makeup=4',
        'aecho=0.9:0.7:70|140:0.22|0.1',          // the stadium PA bouncing off the stands
        'loudnorm=I=-14:TP=-1.5:LRA=9',
        'apad=pad_dur=0.25',                       // let the echo ring out
    ]
    execFileSync('ffmpeg', [ '-y', '-loglevel', 'error', '-i', source, '-ac', '1', '-ar', '44100', '-af', filters.join(','), '-b:a', '128k', path.join(output, outName) ])
    console.log('announcer:', file, '->', outName, `(speech ${start.toFixed(2)}s to ${end.toFixed(2)}s of ${duration.toFixed(2)}s)`)
    ;(manifest[name] = manifest[name] || []).push(outName)
}

fs.writeFileSync(path.join(output, 'manifest.json'), JSON.stringify(manifest, null, 2))
console.log('announcer clips:', Object.fromEntries(Object.entries(manifest).map(([ k, v ]) => [ k, v.length ])), files.length ? '' : '(no recordings yet: put them in recordings/announcer/)')
