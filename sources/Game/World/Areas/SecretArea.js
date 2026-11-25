import { Area } from './Area.js'
import { StopCard } from './StopCard.js'

const STORAGE_KEY = 'sf-trip-secrets-v1'

export const secretStore = {
    found: new Set(),
    load()
    {
        try { this.found = new Set(JSON.parse(localStorage.getItem(STORAGE_KEY)) || []) }
        catch(error) { this.found = new Set() }
    },
    save()
    {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify([ ...this.found ])) }
        catch(error) { /* keep in memory */ }
    },
}
secretStore.load()

/**
 * Hidden places north of the Golden Gate (Napa, Muir Woods). Not part of the 14 stops.
 */
export class SecretArea extends Area
{
    constructor(model, secret)
    {
        super(model)
        this.secret = secret

        this.events.on('boundingIn', () =>
        {
            const isNew = !secretStore.found.has(secret.id)
            secretStore.found.add(secret.id)
            secretStore.save()
            StopCard.get().showSecret(secret, isNew, secretStore.found.size)
            if(isNew && this.game.world.confetti)
                this.game.world.confetti.pop(this.game.player.position.clone())
            this.game.world.guide?.refresh()
        })
    }
}
