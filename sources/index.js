import './threejs-override.js'
import { Game } from './Game/Game.js'
import { account } from './Game/Account.js'
import consoleLog from './data/consoleLog.js'

if(import.meta.env.VITE_LOG)
    console.log(
        ...consoleLog
    )

// load the account (and its cloud save) before the game reads any progress
account.ready.finally(() =>
{
    if(import.meta.env.VITE_GAME_PUBLIC)
        window.game = new Game()
    else
        new Game()
})