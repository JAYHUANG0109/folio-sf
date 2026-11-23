import * as THREE from 'three/webgpu'
import { texture } from 'three/tsl'
import { Game } from '../Game.js'

/**
 * The real calligraphy on the Dragon Gate: 天下為公 on the blue board (read right to left),
 * 信義和平 and 忠孝仁愛 on the white plaques over the side passages. Drawn on canvases at runtime.
 */
export class GateSigns
{
    constructor()
    {
        this.game = Game.getInstance()
        const k = 1.5                                              // Chinatown site scale
        const gx = 24, gz = - 6 + 4 * k                            // the gate, world units
        const ground = this.game.terrain.getHeight(gx, gz)
        const make = (chars, w, h, bg, fg, frame) =>
        {
            const canvas = document.createElement('canvas')
            canvas.width = 512
            canvas.height = Math.round(512 * h / w)
            const c = canvas.getContext('2d')
            c.fillStyle = frame; c.fillRect(0, 0, canvas.width, canvas.height)
            c.fillStyle = bg; c.fillRect(10, 10, canvas.width - 20, canvas.height - 20)
            c.fillStyle = fg
            c.textAlign = 'center'
            c.textBaseline = 'middle'
            const size = Math.min(canvas.height * 0.72, (canvas.width - 40) / chars.length * 0.92)
            c.font = `700 ${size}px "Noto Serif TC", "Songti TC", "PMingLiU", "STSong", serif`
            // written right to left: the first character sits on the right
            ;[ ...chars ].forEach((ch, i) => c.fillText(ch, canvas.width - 20 - (i + 0.5) * (canvas.width - 40) / chars.length, canvas.height / 2 + size * 0.04))
            const map = new THREE.CanvasTexture(canvas)
            map.colorSpace = THREE.SRGBColorSpace
            map.anisotropy = 8
            const material = new THREE.MeshBasicNodeMaterial()
            material.colorNode = texture(map)
            return new THREE.Mesh(new THREE.PlaneGeometry(w, h), material)
        }
        for(const side of [ 1, - 1 ])                              // front (south, toward Union Square) and back
        {
            const face = (mesh, x, y) =>
            {
                mesh.position.set(gx + x * side, ground + y, gz + side * 0.85)
                mesh.rotation.y = side > 0 ? 0 : Math.PI
                this.game.scene.add(mesh)
            }
            face(make('天下為公', 2.15 * k, 0.78 * k, '#1f4aa8', '#f3d27a', '#c9a227'), 0, 3.9 * k)
            // seen from this side, 信義和平 hangs on the left passage and 忠孝仁愛 on the right
            face(make('信義和平', 1.3 * k, 0.4 * k, '#f4f1ea', '#1b1b1b', '#9a9a9a'), - 4.8 * k, 3.75 * k)
            face(make('忠孝仁愛', 1.3 * k, 0.4 * k, '#f4f1ea', '#1b1b1b', '#9a9a9a'), 4.8 * k, 3.75 * k)
        }
    }
}
