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

// two versions of everything: a small one for the frames on the castle walls, and a sharp one (1440p) for theatre mode
const photos = []
for(const [ i, file ] of list(imgDir, [ '.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif' ]).entries())
{
    const src = path.join(imgDir, file)
    const small = path.join(webDir, 'p' + slug(file, i, '.jpg')), full = path.join(webDir, 'hd-p' + slug(file, i, '.jpg'))
    try
    {
        let input = src
        if([ '.heic', '.heif' ].includes(path.extname(file).toLowerCase()))
        {
            input = path.join(webDir, `tmp-${i}.jpg`)
            if(!fresh(src, full))
                execFileSync('sips', [ '-s', 'format', 'jpeg', src, '--out', input ], { stdio: 'ignore' }) // macOS converts iPhone HEIC
        }
        if(!fresh(src, small))
            await sharp(input).rotate().resize(1024, 1024, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 82 }).toFile(small)
        if(!fresh(src, full))
            await sharp(input).rotate().resize(2560, 2560, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 90, mozjpeg: true }).toFile(full)
        if(input !== src) fs.rmSync(input, { force: true })
        photos.push({ src: `gallery/web/${path.basename(small)}`, full: `gallery/web/${path.basename(full)}` })
    }
    catch(error) { console.warn('gallery: skipped', file, error.message) }
}

const videos = []
for(const [ i, file ] of list(vidDir, [ '.mp4', '.mov', '.m4v', '.webm' ]).entries())
{
    const src = path.join(vidDir, file)
    const small = path.join(webDir, 'v' + slug(file, i, '.mp4')), full = path.join(webDir, 'hd-v' + slug(file, i, '.mp4')), thumb = path.join(webDir, 't' + slug(file, i, '.jpg'))
    try
    {
        if(!fresh(src, small))
            execFileSync('ffmpeg', [ '-y', '-i', src, '-vf', 'scale=-2:720', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '28', '-an', '-movflags', '+faststart', small ], { stdio: 'ignore' })
        if(!fresh(src, full)) // 1440p (never upscaled), with sound, for theatre mode
            execFileSync('ffmpeg', [ '-y', '-i', src, '-vf', "scale='if(gt(ih,iw),-2,min(2560,iw))':'if(gt(ih,iw),min(2560,ih),-2)'", '-c:v', 'libx264', '-preset', 'medium', '-crf', '21', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', full ], { stdio: 'ignore' })
        if(!fresh(src, thumb))
            execFileSync('ffmpeg', [ '-y', '-ss', '0.5', '-i', src, '-frames:v', '1', '-vf', 'scale=320:-2', thumb ], { stdio: 'ignore' })
        videos.push({ src: `gallery/web/${path.basename(small)}`, full: `gallery/web/${path.basename(full)}`, thumb: `gallery/web/${path.basename(thumb)}` })
    }
    catch(error) { console.warn('gallery: skipped', file, error.message) }
}

fs.writeFileSync(path.join(root, 'gallery.json'), JSON.stringify({ photos, videos }, null, 4))
console.log(`gallery: ${photos.length} photos, ${videos.length} videos`)
