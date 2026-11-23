/**
 * The two dogs living in the SF map.
 * Used by scripts/sf/build.mjs (dog houses) and sources/Game/World/Dogs.js (behaviour).
 * World coordinates: x = east, z = south.
 */
export const dogs = [
    {
        id: 'xiaoke',
        name: '小可',
        breed: '巧克力色貴賓狗',
        // mid to small chocolate poodle
        size: 0.55,
        speed: { walk: 3.2, run: 9.5 },
        mass: 0.25,
        home: { x: -75, z: 58, rotation: Math.PI * 0.25 },
        favorites: [ 'iceCream', 'chinatown', 'turkey', 'tennis' ],
        lines: {
            chase: '小可在追你！',
            fish: '小可叼了一條魚',
            iceCream: '小可偷舔了一口冰淇淋',
            chinatown: '小可在中國城拿到一顆包子',
            turkey: '小可偷吃火雞腿',
            tennis: '小可撿到一顆網球',
            sleep: '小可回家睡覺了 Zzz',
            bump: '小可彈開了，還想再玩',
        },
    },
    {
        id: 'dookie',
        name: 'Dookie',
        breed: '伯恩山犬',
        // giant bernese mountain dog
        size: 1.6,
        speed: { walk: 2.6, run: 7.5 },
        mass: 2.2,
        home: { x: -29, z: 58, rotation: - Math.PI * 0.25 },
        favorites: [ 'fish', 'turkey', 'pier39', 'goldenGate' ],
        lines: {
            chase: 'Dookie 跑過來了！',
            fish: 'Dookie 在海邊抓到一條魚',
            iceCream: 'Dookie 把冰淇淋一口吃掉',
            chinatown: 'Dookie 聞到中國城的燒肉香',
            turkey: 'Dookie 守著感恩節火雞',
            pier39: 'Dookie 跟海獅打招呼',
            goldenGate: 'Dookie 在橋上吹風',
            tennis: 'Dookie 叼走了網球',
            sleep: 'Dookie 回小木屋睡覺了 Zzz',
            bump: 'Dookie 被撞得滾了一圈，尾巴還在搖',
        },
    },
]

/**
 * Places the dogs like to visit. `item` is what they carry back.
 */
export const dogSpots = {
    fish:       { x: 18, z: -52, item: 'fish' },       // shore next to Pier 39
    iceCream:   { x: 12, z: 40, item: 'iceCream' },    // Dolores Park
    chinatown:  { x: 24, z: -18, item: 'bun' },        // Grant Ave
    turkey:     { x: -46, z: 66, item: 'drumstick' },  // the giant Thanksgiving dish
    tennis:     { x: -52, z: 17, item: 'tennisBall' }, // Goldman Tennis Center
    pier39:     { x: 30, z: -50, item: null },
    goldenGate: { x: -62, z: -44, item: null },
}

/** The giant Thanksgiving turkey dish (bottom left of the map) */
export const turkey = { x: -52, z: 72, radius: 9.5 }
