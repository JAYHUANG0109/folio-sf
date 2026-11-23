import * as THREE from 'three/webgpu'
import { color, time, sin } from 'three/tsl'
import { Game } from '../Game.js'
import { StopCard } from './Areas/StopCard.js'

/**
 * The ending, when the 13th stamp is collected:
 * a glowing heart rises above the car, confetti, both dogs run over, then the last card.
 */
export class Finale
{
    constructor()
    {
        this.game = Game.getInstance()
        this.playing = false

        const shape = new THREE.Shape()
        shape.moveTo(0, - 1.2)
        shape.bezierCurveTo(- 0.2, - 0.9, - 1.6, - 0.2, - 1.6, 0.6)
        shape.bezierCurveTo(- 1.6, 1.4, - 0.6, 1.7, 0, 1.0)
        shape.bezierCurveTo(0.6, 1.7, 1.6, 1.4, 1.6, 0.6)
        shape.bezierCurveTo(1.6, - 0.2, 0.2, - 0.9, 0, - 1.2)
        const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.5, bevelEnabled: true, bevelThickness: 0.15, bevelSize: 0.12, bevelSegments: 2, curveSegments: 10 })
        geometry.center()

        const material = new THREE.MeshBasicNodeMaterial()
        material.colorNode = color('#ff3d7f').mul(sin(time.mul(3)).mul(0.4).add(1.8))
        material.fog = false

        this.heart = new THREE.Mesh(geometry, material)
        this.heart.visible = false
        this.heart.scale.setScalar(0.01)
        this.game.scene.add(this.heart)

        this.game.ticker.events.on('tick', () => this.update(), 12)
    }

    play()
    {
        if(this.playing)
            return
        this.playing = true
        this.elapsed = 0
        this.anchor = this.game.player.position.clone()
        this.heart.visible = true

        // both dogs come running
        for(const dog of this.game.world.dogs?.items || [])
        {
            dog.chaseCooldown = - 1
            if(dog.state === 'sleep' || dog.state === 'goHome')
                dog.pickWander()
            dog.setState('chase')
        }

        // confetti fireworks
        const confetti = this.game.world.confetti
        if(confetti)
        {
            for(let i = 0; i < 8; i++)
            {
                this.game.ticker.wait(0.4 + i * 0.7, () =>
                {
                    const p = this.game.player.position.clone()
                    p.x += (Math.random() - 0.5) * 8
                    p.z += (Math.random() - 0.5) * 8
                    confetti.pop(p, 5, 9)
                })
            }
        }

        this.game.ticker.wait(2.5, () => StopCard.get().showFinale())
    }

    update()
    {
        if(!this.heart.visible)
            return
        const delta = this.game.ticker.delta
        this.elapsed += delta

        // rise and grow, then hover above where she finished
        const rise = Math.min(1, this.elapsed / 4)
        const eased = 1 - Math.pow(1 - rise, 3)
        this.heart.position.set(this.anchor.x, this.anchor.y + 2 + eased * 6, this.anchor.z)
        const beat = 1 + Math.max(0, Math.sin(this.elapsed * 5)) * 0.08
        this.heart.scale.setScalar(Math.max(0.01, eased * 2.6 * beat))

        // face the camera, spinning slowly
        const camera = this.game.view.camera
        this.heart.rotation.set(0, Math.atan2(camera.position.x - this.heart.position.x, camera.position.z - this.heart.position.z) + Math.sin(this.elapsed * 0.8) * 0.3, 0)
    }
}
