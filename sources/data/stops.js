/**
 * The 13 stops of the SF trip, in trip order.
 * Single source of truth for:
 *  - scripts/sf/build.mjs (terrain, landmark models, respawns, map)
 *  - sources/Game/World/Areas/StopArea.js (zones, stamps, cards)
 *
 * World coordinates: x = east, z = south, the map spans -96..96 on both axes.
 * Change a stop's position here, then run `npm run sf:build` to regenerate the world.
 */
export const stops = [
    {
        id: 'sfo',
        name: '舊金山國際機場',
        en: 'SFO',
        date: '11/24（二）',
        note: '飛了六個小時，終於到了。從這裡開始，一站一站開過去。',
        position: { x: 62, z: 68 },
        radius: 11,
        respawn: { x: 51, z: 60, rotation: Math.PI * 0.75 },   // clear of the SFO letters (they stand at about x 55-61, z 67)
        task: { type: 'letters', text: '把 SFO 大字母撞倒' },
    },
    {
        id: 'ferryBuilding',
        name: '渡輪大廈',
        en: 'Ferry Building',
        date: '11/24（二）',
        note: '鐘塔、市場、Hog Island 的生蠔和蛤蜊巧達湯，窗外就是海灣大橋。',
        position: { x: 59, z: -18 },
        radius: 10,
        respawn: { x: 48, z: -18, rotation: - Math.PI * 0.5 },
        task: { type: 'collect', text: '收集 3 顆生蠔', icon: 'oyster', points: [ [ 52, -13 ], [ 51, -23 ], [ 55, -29 ] ] },
    },
    {
        id: 'unionSquare',
        name: '聯合廣場',
        en: 'Union Square',
        date: '11/24（二）',
        note: '大聖誕樹下面溜冰，跌倒了要拉我一把。',
        position: { x: 34, z: 13 },
        radius: 10,
        respawn: { x: 40, z: 22, rotation: Math.PI * 0.75 },
        task: { type: 'ice', text: '在溜冰場上滑 3 秒', rink: { x: 30, z: 16.5, halfX: 6, halfZ: 4 }, seconds: 3 },
    },
    {
        id: 'chinatown',
        name: '中國城',
        en: 'Chinatown Dragon Gate',
        date: '11/24（二）',
        note: '穿過龍門，走進一整條掛滿燈籠的 Grant Ave。街上的牛肉麵攤，擺了一碗超大的牛肉麵。',
        position: { x: 24, z: -6 },
        radius: 7,
        respawn: { x: 24, z: 3, rotation: 0 },
        task: { type: 'knock', ref: 'beefNoodle', text: '把牛肉麵攤那碗超大牛肉麵撞翻' },
    },
    {
        id: 'alcatraz',
        name: '惡魔島',
        en: 'Alcatraz',
        date: '11/25（三）',
        note: '搭早班渡輪上島。開車的話，從 Embarcadero 走那條掛著燈串的木棧橋過去。',
        position: { x: 4, z: -82 },
        radius: 12,
        respawn: { x: 6, z: -76.5, rotation: 0 },   // flat ground on the summit, by Building 64
        task: { type: 'collect', text: '找到牢房的鑰匙', icon: 'key', points: [ [ -9, -75 ] ] },
    },
    {
        id: 'pier39',
        name: '39 號碼頭',
        en: 'Pier 39',
        date: '11/25（三）',
        note: '海獅在浮台上曬太陽。可以去撞撞看，牠們不會生氣。',
        position: { x: 36, z: -58 },
        radius: 9,
        respawn: { x: 36, z: -48, rotation: 0 },
        task: { type: 'seaLion', text: '把一隻海獅推下水' },
    },
    {
        id: 'lombard',
        name: '叮噹車＋九曲花街',
        en: 'Cable Car + Lombard St',
        date: '11/25（三）',
        note: '叮噹車把我們送上 Russian Hill，再從 Hyde St 沿著八個髮夾彎慢慢開下來。彎很急，慢慢開。',
        position: { x: 6, z: -36 },
        radius: 13,
        respawn: { x: -14.2, z: -40.7, rotation: 0 },   // at the top of the crooked street, facing down it, clear of the cable car on Hyde St
        // the apex of all 8 hairpins, then the bottom at Grant Ave (matches scripts/sf/terrain.mjs lombardApexes)
        task: { type: 'checkpoints', text: '從 Hyde St 開下九曲花街的八個彎', points: [ [ -9.4, -31.3 ], [ -5, -40.7 ], [ -0.6, -31.3 ], [ 3.8, -40.7 ], [ 8.2, -31.3 ], [ 12.6, -40.7 ], [ 17, -31.3 ], [ 21.4, -40.7 ], [ 26.8, -31.3 ] ] },
    },
    {
        id: 'doloresPark',
        name: '多洛雷斯公園',
        en: 'Mission Dolores Park',
        date: '11/25（三）',
        note: '坐在坡上等夕陽，整個天際線都在眼前。',
        position: { x: 10, z: 42 },
        radius: 10,
        respawn: { x: 18, z: 34, rotation: Math.PI * 0.75 },
        task: { type: 'collect', text: '收集 3 支 Bi-Rite 冰淇淋', icon: 'iceCream', points: [ [ 4, 40 ], [ 10, 47 ], [ 16, 38 ] ] },
    },
    {
        id: 'palaceOfFineArts',
        name: '藝術宮',
        en: 'Palace of Fine Arts',
        date: '11/26（四）',
        note: '感恩節的早上，圓頂倒映在池子裡。',
        position: { x: -40, z: -32 },
        radius: 12,
        respawn: { x: -40, z: -45, rotation: 0 },
        task: { type: 'checkpoints', text: '從圓頂底下開過去', points: [ [ -40, -32 ] ] },
    },
    {
        id: 'goldenGate',
        name: '金門大橋',
        en: 'Golden Gate Bridge',
        date: '11/26（四）',
        note: '一路開到北端的 Vista Point，回頭看大橋和整個舊金山。',
        position: { x: -62, z: -86 },
        radius: 8,
        respawn: { x: -62, z: -42, rotation: 0 },
        task: { type: 'checkpoints', text: '從南端一路開過金門大橋', points: [ [ -62, -50 ], [ -62, -63 ], [ -62, -77 ] ] },
    },
    {
        id: 'levis',
        name: "Levi's 球場",
        en: "49ers vs Seahawks",
        date: '11/29（日）',
        note: '49ers 對海鷹，13:25 開球。外套帶著，看台傍晚很冷。',
        position: { x: 12, z: 79 },
        radius: 13,
        respawn: { x: 30, z: 72, rotation: - Math.PI * 0.5 },
        task: { type: 'touchdown', text: '把球推進達陣區' },
    },
    {
        id: 'paintedLadies',
        name: '彩繪仕女屋',
        en: 'Painted Ladies',
        date: '11/30（一）',
        note: 'Alamo Square 坡上看一整排維多利亞式房子，後面是市中心。',
        position: { x: -23, z: 14 },
        radius: 9,
        respawn: { x: -23, z: 24, rotation: Math.PI },
        task: { type: 'honk', text: '按喇叭跟仕女屋打招呼' },
    },
    {
        id: 'tennis',
        name: '金門公園網球場',
        en: 'Goldman Tennis Center',
        date: '11/30（一）',
        note: '最後一站，一起打一場球。輸的人請晚餐。',
        position: { x: -58, z: 17 },
        radius: 10,
        respawn: { x: -50, z: 17, rotation: - Math.PI * 0.5 },
        task: { type: 'tennis', text: '把一顆網球推過網', netX: -58, z: 17, halfZ: 7.5 },
    },
]

stops.forEach((stop, index) =>
{
    stop.order = index + 1
    stop.label = index === stops.length - 1 ? '最後一站' : `第 ${index + 1} 站`
})

export const stopsById = Object.fromEntries(stops.map(stop => [ stop.id, stop ]))
