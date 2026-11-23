/**
 * Castle gallery: put photos in static/gallery/img and videos in static/gallery/vid, then build.
 * Photos are resized to 1024px JPGs and videos re-encoded to small H.264 MP4s (static/gallery/web),
 * and static/gallery/gallery.json is written for the game. File names become captions:
 * "03-第一次約會.jpg" -> "第一次約會" (a leading number only sets the order).
 */
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import sharp from 'sharp'

const root = path.resolve('static/gallery')
const imgDir = path.join(root, 'img'), vidDir = path.join(root, 'vid'), webDir = path.join(root, 'web')
fs.mkdirSync(webDir, { recursive: true })
const list = (dir, exts) => fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => exts.includes(path.extname(f).toLowerCase())).sort((a, b) => a.localeCompare(b, 'zh-Hant', { numeric: true })) : []
const caption = (file) => path.basename(file, path.extname(file)).replace(/^\d+[\s._-]*/, '').replace(/[_]/g, ' ').trim()
const slug = (file, i, ext) => `${String(i + 1).padStart(2, '0')}${ext}`
const fresh = (src, out) => fs.existsSync(out) && fs.statSync(out).mtimeMs >= fs.statSync(src).mtimeMs

const photos = []
for(const [ i, file ] of list(imgDir, [ '.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif' ]).entries())
{
    const src = path.join(imgDir, file), out = path.join(webDir, 'p' + slug(file, i, '.jpg'))
    try
    {
        if(!fresh(src, out))
        {
            if([ '.heic', '.heif' ].includes(path.extname(file).toLowerCase()))
                execFileSync('sips', [ '-s', 'format', 'jpeg', '-Z', '1024', src, '--out', out ], { stdio: 'ignore' }) // macOS converts iPhone HEIC
            else
                await sharp(src).rotate().resize(1024, 1024, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 82 }).toFile(out)
        }
        photos.push({ src: `gallery/web/${path.basename(out)}`, caption: caption(file) })
    }
    catch(error) { console.warn('gallery: skipped', file, error.message) }
}

const videos = []
for(const [ i, file ] of list(vidDir, [ '.mp4', '.mov', '.m4v', '.webm' ]).entries())
{
    const src = path.join(vidDir, file), out = path.join(webDir, 'v' + slug(file, i, '.mp4'))
    try
    {
        if(!fresh(src, out))
            execFileSync('ffmpeg', [ '-y', '-i', src, '-vf', 'scale=-2:720', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '28', '-an', '-movflags', '+faststart', out ], { stdio: 'ignore' })
        videos.push({ src: `gallery/web/${path.basename(out)}`, caption: caption(file) })
    }
    catch(error) { console.warn('gallery: skipped', file, error.message) }
}

fs.writeFileSync(path.join(root, 'gallery.json'), JSON.stringify({ photos, videos }, null, 4))
console.log(`gallery: ${photos.length} photos, ${videos.length} videos`)
