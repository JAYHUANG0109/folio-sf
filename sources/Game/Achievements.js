import { paints } from '../data/paints.js'
import { account } from './Account.js'
import { stops } from '../data/stops.js'
import * as THREE from 'three/webgpu'
import achievementsData from '../data/achievements.js'
import { Game } from './Game.js'
import { timeToReadableString } from './utilities/time.js'
import { uniform } from 'three/tsl'
import { Events } from './Events.js'

export class Achievements
{
    constructor()
    {
        this.game = Game.getInstance()

        this.events = new Events()

        this.setStorage()
        this.setMenu()
        this.setSounds()
        this.setGroups()
        this.setItems()
        this.setGlobalProgress()
        this.setRewards()
        this.setReset()

        const localAchievements = this.storage.get()

        for(const groupName in localAchievements)
        {
            const group = this.groups.get(groupName)

            if(group)
            {
                const progress = localAchievements[ groupName ]
                group.setProgress(progress, true)
            }
        }

        this.globalProgress.update()
        this.rewards.update()
    }

    setStorage()
    {
        this.storage = {}

        this.storage.save = () =>
        {
            const data = {}
            this.groups.forEach((group, name) =>
            {
                if(group.progress instanceof Set)
                {
                    if(group.progress.size)
                        data[name] = [ ...group.progress ]
                }
                else
                {
                    if(group.progress > 0)
                        data[name] = group.progress
                }
            })

            const encodedData = JSON.stringify(data)
            localStorage.setItem('achievements', encodedData)
        }

        this.storage.get = () =>
        {
            const localAchievements = localStorage.getItem('achievements')

            if(localAchievements)
                return JSON.parse(localAchievements)

            return {}
        }
    }

    setGlobalProgress()
    {
        this.globalProgress = {}
        
        this.globalProgress.element = this.menu.instance.contentElement.querySelector('.js-global-progress')
        this.globalProgress.currentElement = this.globalProgress.element.querySelector('.js-current')
        this.globalProgress.totalElement = this.globalProgress.element.querySelector('.js-total')
        this.globalProgress.timeElement = this.globalProgress.element.querySelector('.js-time')
        
        this.globalProgress.achieved = false
        this.globalProgress.achievedCount = 0
        this.globalProgress.totalCount = 0
        this.globalProgress.ratioUniform = uniform()

        this.globalProgress.timeStart = 0
        this.globalProgress.timeEnd = 0

        let localTimeStart = localStorage.getItem('achievementsTimeStart')
        if(localTimeStart)
        {
            localTimeStart = parseFloat(localTimeStart)

            if(!isNaN(localTimeStart))
                this.globalProgress.timeStart = localTimeStart
        }

        let localTimeEnd = localStorage.getItem('achievementsTimeEnd')
        if(localTimeEnd)
        {
            localTimeEnd = parseFloat(localTimeEnd)

            if(!isNaN(localTimeEnd))
                this.globalProgress.timeEnd = localTimeEnd
        }

        this.globalProgress.update = () =>
        {
            this.globalProgress.achievedCount = 0
            this.globalProgress.totalCount = 0
            this.groups.forEach(_group =>
            {
                for(const achievement of _group.items)
                {
                    this.globalProgress.achievedCount += achievement.achieved ? 1 : 0
                    this.globalProgress.totalCount++
                }
            })

            this.globalProgress.ratioUniform.value = this.globalProgress.achievedCount / this.globalProgress.totalCount
            
            this.globalProgress.totalElement.textContent = this.globalProgress.totalCount
            this.globalProgress.currentElement.textContent = this.globalProgress.achievedCount
            
            if(this.globalProgress.achievedCount === this.globalProgress.totalCount)
            {
                // Achieve
                if(!this.globalProgress.achieved)
                {
                    // Not already ended
                    if(!localStorage.getItem('achievementsTimeEnd'))
                    {
                        this.globalProgress.timeEnd = this.game.player.timePlayed.all
                        localStorage.setItem('achievementsTimeEnd', this.globalProgress.timeEnd)
                    }

                    this.globalProgress.timeElement.textContent = timeToReadableString(this.globalProgress.timeEnd - this.globalProgress.timeStart)

                    this.globalProgress.achieved = true
                    this.globalProgress.element.classList.add('is-achieved')
                }
            }
        }


        this.globalProgress.reset = () =>
        {
            this.globalProgress.achieved = false

            this.globalProgress.currentElement.textContent = 0

            this.globalProgress.timeStart = this.game.player.timePlayed.all
            this.globalProgress.timeEnd = 0
            localStorage.setItem('achievementsTimeStart', this.globalProgress.timeStart)
            localStorage.removeItem('achievementsTimeEnd')
            
            this.globalProgress.element.classList.remove('is-achieved')
        }

        this.globalProgress.update()
    }

    setRewards()
    {
        this.rewards = {}

        // Swatches: basic colors (always available) and premium finishes (unlocked by achievements)
        const rowsElement = this.menu.instance.contentElement.querySelector('.js-rewards-rows')
        const isLockable = (paint) => paint.stop || paint.allStops || paint.allAchievements
        const howToUnlock = (paint) =>
        {
            if(paint.stop)
            {
                const stop = stops.find(s => s.id === paint.stop)
                return `${stop ? `${stop.label} ${stop.name}` : ''}<br />蓋章解鎖`
            }
            if(paint.allStops)
                return '蓋滿 13 個章解鎖'
            return '完成全部成就解鎖'
        }
        const swatch = (paint) => /* html */`
            <button class="js-reward reward has-tooltip${isLockable(paint) ? ' is-locked' : ''}" data-name="${paint.name}"${paint.default ? ' data-default' : ''}>
                <div class="js-tooltip tooltip"><strong>${paint.label}</strong>${isLockable(paint) ? `<span class="how"><br />${howToUnlock(paint)}</span>` : ''}</div>
                ${paint.image
                    ? `<img class="picture" src="${paint.image}" loading="lazy">`
                    : `<span class="picture swatch" style="background: linear-gradient(160deg, ${paint.colors[0]}, ${paint.colors[1]})"></span>`}
                <div class="lock"><img class="lock-icon" src="ui/lock.svg" loading="lazy"></div>
            </button>`
        rowsElement.innerHTML = /* html */`
            <div class="rewards-row-title">基本色</div>
            <div class="rewards">${paints.filter(p => !isLockable(p)).map(swatch).join('')}</div>
            <div class="rewards-row-title">景點限定色 <span>每到一站蓋章，解鎖一個顏色</span></div>
            <div class="rewards">${paints.filter(p => p.stop).map(swatch).join('')}</div>
            <div class="rewards-row-title">終極塗裝</div>
            <div class="rewards">${paints.filter(p => p.allStops || p.allAchievements).map(swatch).join('')}</div>`

        this.rewards.elements = rowsElement.querySelectorAll('.js-reward')
        this.rewards.items = new Map()
        this.rewards.default = null
        // Items
        for(const rewardElement of this.rewards.elements)
        {
            const paint = paints.find(p => p.name === rewardElement.dataset.name)
            const item = {}
            item.name = rewardElement.dataset.name
            item.element = rewardElement
            item.label = paint?.label ?? item.name
            item.isUnlocked = () =>
            {
                if(!paint || !isLockable(paint))
                    return true
                const stamps = this.groups.get('stops')?.progress
                if(paint.stop)
                    return stamps instanceof Set && stamps.has(paint.stop)
                if(paint.allStops)
                    return stamps instanceof Set && stamps.size >= stops.length
                return this.globalProgress.achievedCount >= this.globalProgress.totalCount
            }
            item.locked = true
            item.wasEverUnlocked = null

            item.element.addEventListener('click', (event) =>
            {
                event.preventDefault()

                const changed = this.rewards.set(item.name)

                if(changed)
                {
                    this.game.menu.close()
                }
            })

            if(typeof rewardElement.dataset.default !== 'undefined')
                this.rewards.default = item

            this.rewards.items.set(item.name, item)

        }

        // Current
        this.rewards.current = this.rewards.default

        const localRewardName = localStorage.getItem('achievementsReward')
        if(localRewardName)
        {
            const item = this.rewards.items.get(localRewardName)
            if(item)
                this.rewards.current = item
        }
        this.rewards.current.element.classList.add('is-active')

        // Set method
        this.rewards.set = (itemName) =>
        {
            const item = this.rewards.items.get(itemName)

            if(item && !account.user && item !== this.rewards.default)
            {
                this.game.notifications.show('<span>登入後就能換車子的顏色。點這裡登入</span>', '', 4, () => this.game.menu.open('account'), 'paint-login')
                return false
            }
            if(item && !item.locked && item !== this.rewards.current)
            {
                if(this.rewards.current)
                {
                    this.rewards.current.element.classList.remove('is-active')
                }

                this.rewards.current = item
                this.rewards.current.element.classList.add('is-active')

                // Sound
                this.sounds.paint.play()

                // Event
                this.events.trigger('rewardActiveChange', [ this.rewards.current ])

                // Save
                localStorage.setItem('achievementsReward', item.name)

                return true
            }

            return false
        }

        // Update
        this.rewards.update = () =>
        {
            this.rewards.items.forEach(item =>
            {
                // Unlock
                if(item.isUnlocked())
                {
                    if(item.locked)
                    {
                        item.locked = false
                        item.element.classList.remove('is-locked')
                        // a new paint while playing (not on load): tell her
                        if(item.wasEverUnlocked === false)
                            this.game.notifications.show(`<span>🎨 解鎖新塗裝「${item.label}」！到選單的成就頁換上它</span>`, '', 5, () => this.game.menu.open('achievements'), `paint-${item.name}`)
                    }
                    item.wasEverUnlocked = true
                }
                // Lock
                else
                {
                    if(!item.locked)
                    {
                        item.locked = true
                        item.element.classList.add('is-locked')
                        item.element.classList.add('has-tooltip')

                        if(item === this.rewards.current)
                        {
                            this.rewards.set(this.rewards.default.name)
                        }
                    }
                    if(item.wasEverUnlocked === null)
                        item.wasEverUnlocked = false

                    // Current should be locked (shouldn't happen but you never know)
                    if(item === this.rewards.current)
                    {
                        this.rewards.set(this.rewards.default.name)
                    }
                }
            })
        }
    }

    setGroups()
    {
        this.groups = new Map()
        
        for(const [ name, title, description, total, unique = false ] of achievementsData)
        {
            // Get if exists or create
            const group = this.groups.get(name) ?? this.createGroup(name)

            // One of the achievements is "unique" => Make prorgess as a Set
            if(unique && !(group.progress instanceof Set))
            {
                group.progress = new Set()
            }
        }
    }

    createGroup(name)
    {
        // Create
        const group = {
            progress: 0,
            items: []
        }

        // Set progress method
        group.setProgress = (_progress, _silent = false) =>
        {
            let oldProgress = group.progress instanceof Set ? group.progress.size : group.progress

            if(group.progress instanceof Set)
            {
                const ids = _progress instanceof Array ? _progress : [ _progress ]
                for(const id of ids)
                    group.progress.add(id)
            }
            else
            {
                if(_progress !== group.progress)
                    group.progress = _progress
            }

            const newProgress = group.progress instanceof Set ? group.progress.size : group.progress
            const progressDelta = newProgress - oldProgress
            if(progressDelta)
                group.updateItems(_silent)

            return progressDelta
        }

        // Add progress method
        group.addProgress = (_progress = 1) =>
        {
            return group.setProgress(group.progress + _progress)
        }

        // Update items of group
        group.updateItems = (_silent) =>
        {
            const groupProgress = group.progress instanceof Set ? group.progress.size : group.progress

            for(const achievement of group.items)
            {
                // Specific id required (ex: one passport stamp) => 1 if that id is in the Set
                const progress = achievement.requiredId !== null
                    ? (group.progress instanceof Set && group.progress.has(achievement.requiredId) ? 1 : 0)
                    : Math.min(groupProgress, achievement.total)

                // Nothing changed for this one
                if(achievement.requiredId !== null && progress === 0)
                    continue

                // Progress
                achievement.progressCurrentElement.textContent = progress

                // Bar
                achievement.barFillElement.style.transform = `scaleX(${progress / achievement.total})`

                // Achieved
                if(!achievement.achieved && progress === achievement.total)
                {
                    achievement.achieve(_silent)
                }
            }
        }

        // Reset
        group.reset = () =>
        {
            if(group.progress instanceof Set)
                group.progress = new Set()
            else
                group.progress = 0

            for(const achievement of group.items)
            {
                achievement.progressCurrentElement.textContent = 0
                achievement.barFillElement.style.transform = 'scaleX(0)'
                achievement.achieved = false
                achievement.itemElement.classList.remove('is-achieved')
            }
        }

        // Save
        this.groups.set(name, group)

        // Return
        return group
    }

    setItems()
    {
        const itemsElement = this.menu.instance.contentElement.querySelector('.js-items')

        for(const [ name, title, description, total, unique = false, requiredId = null ] of achievementsData)
        {
            const achievement = {
                total,
                requiredId,
                achieved: false
            }
            const group = this.groups.get(name)
            group.items.push(achievement)

            // HTML
            const html = /* html */`
                <div class="title">${title}</div>
                <div class="description">
                    <div class="text">${description}</div>
                    <div class="progress">
                        <div class="check-icon"></div>
                        <span class="check"></span>
                        <span class="current">${0}</span> / <span>${total}</span>
                    </div>
                </div>
                <div class="bar">
                    <div class="fill"></div>
                </div>
            `

            achievement.itemElement = document.createElement('div')
            achievement.itemElement.classList.add('achievement')
            achievement.itemElement.innerHTML = html

            achievement.progressCurrentElement = achievement.itemElement.querySelector('.current')
            achievement.barFillElement = achievement.itemElement.querySelector('.bar .fill')
            
            itemsElement.append(achievement.itemElement)

            // Achieve
            achievement.achieve = (_silent = true) =>
            {
                achievement.achieved = true
                achievement.itemElement.classList.add('is-achieved')

                if(!_silent)
                {
                    this.globalProgress.update()
                    this.rewards.update()

                    // Confetti
                    if(this.game.world.confetti)
                    {
                        this.game.world.confetti.pop(this.game.player.position.clone())
                        this.game.world.confetti.pop(this.game.player.position.clone().add(new THREE.Vector3(1, -1, 1.5)))
                        this.game.world.confetti.pop(this.game.player.position.clone().add(new THREE.Vector3(1, -1, -1.5)))
                    }

                    // Sound
                    this.sounds.achieve.play()

                    // Notification
                    const html = /* html */`
                        <div class="top">
                            <div class="title">${title}</div>
                            <div class="progress">
                                <div class="check-icon"></div>
                                <span class="check"></span>
                                <span class="current">${total}</span> / <span>${total}</span>
                            </div>
                        </div>
                        <div class="bottom">
                            <div class="description">${description}</div>
                            <div class="open-icon"></div>
                        </div>
                    `

                    this.game.notifications.show(
                        html,
                        'achievement',
                        4,
                        () => {
                            this.game.inputs.interactiveButtons.clearItems()
                            this.game.menu.open('achievements')
                        }
                    )
                }
            }
        }
    }

    setMenu()
    {
        this.menu = {}
        this.menu.instance = this.game.menu.items.get('achievements')
    }

    setSounds()
    {
        this.sounds = {}
        
        this.sounds.achieve = this.game.audio.register({
            path: 'sounds/achievements/Money Reward 2.mp3',
            autoplay: false,
            loop: false,
            volume: 0.4,
            antiSpam: 0.5
        })

        this.sounds.paint = this.game.audio.register({
            path: 'sounds/vehicle/paint/Spray Paint 14.mp3',
            autoplay: false,
            loop: false,
            volume: 0.4,
            antiSpam: 0.5
        })
    }

    setReset()
    {
        const button = this.menu.instance.contentElement.querySelector('.js-button-reset')

        let clickCount = 0

        button.addEventListener('click', (event) =>
        {
            event.preventDefault()
            clickCount++

            if(clickCount === 1)
            {
                button.textContent = '確定嗎？'
            }

            else if(clickCount === 2)
            {
                button.textContent = '真的要重來？'
            }

            else if(clickCount === 3)
            {
                button.textContent = '已重設'
                clickCount = 0
                this.reset()
            }
        })

        button.addEventListener('mouseleave', (event) =>
        {
            event.preventDefault()
            clickCount = 0

            button.textContent = '重設成就'
        })
    }

    setProgress(name, progress)
    {
        const group = this.groups.get(name)

        if(!group)
            return

        const progressDelta = group.setProgress(progress)

        if(progressDelta)
        {
            this.storage.save()
        }
    }

    addProgress(name)
    {
        const group = this.groups.get(name)

        if(!group)
            return
            
        const progressDelta = group.addProgress()

        if(progressDelta)
        {
            this.storage.save()
        }
    }

    reset()
    {
        this.game.player.distanceDriven.reset()

        this.groups.forEach(group =>
        {
            group.reset()
        })

        this.globalProgress.reset()
        this.storage.save()

        // Stop tasks (sources/Game/World/Areas/StopTask.js)
        import('./World/Areas/StopTask.js').then(({ taskStore }) =>
        {
            taskStore.reset()
            location.reload()
        })
        this.globalProgress.update()
        this.rewards.update()

        const landingLeaveAchievement = this.groups.get('landingLeave')
        if(landingLeaveAchievement && this.game.world.areas.landing)
        {
            if(!this.game.world.areas.landing.isIn)
                landingLeaveAchievement.setProgress(1)
        }

        const debugAchievement = this.groups.get('debug')
        if(debugAchievement && this.game.debug.active)
        {
            debugAchievement.setProgress(1)
        }

        if(this.game.tornado)
            this.game.tornado.achievementAchieved = false

        if(this.game.world.rainLines)
            this.game.world.rainLines.achievementAchieved = false

        if(this.game.world.snow)
            this.game.world.snow.achievementAchieved = false
    }

    // achieveAll()
    // {
    //     this.groups.forEach((group) =>
    //     {
    //         if(group.progress instanceof Set)
    //         {
    //             const ids = Array.from({ length: 99 }, (_, i) => i);
    //             group.setProgress(ids)
    //         }
    //         else
    //         {
    //             group.setProgress(999999)
    //         }
    //     })
    // }
}