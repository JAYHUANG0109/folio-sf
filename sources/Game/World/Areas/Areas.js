import { Game } from '../../Game.js'
import { StopArea } from './StopArea.js'
import { SecretArea } from './SecretArea.js'
import { stops, secrets } from '../../../data/worldData.js'

export class Areas
{
    constructor()
    {
        this.game = Game.getInstance()
        this.list = []

        const model = [...this.game.resources.areasModel.scene.children]

        for(const child of model)
        {
            const stop = stops.find(s => s.id === child.name)
            if(stop)
            {
                this[stop.id] = new StopArea(child, stop)
                this.list.push(this[stop.id])
            }
            const secret = secrets.find(s => s.id === child.name)
            if(secret)
                this[secret.id] = new SecretArea(child, secret)
        }
    }
}
