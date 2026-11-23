/**
 * Achievements
 * Format: [ groupName, title, description, total, unique = false, requiredId = null ]
 *
 * - unique: the group progress is a Set of ids (setProgress(group, id) adds the id)
 * - requiredId: the achievement is completed when this specific id is in the group Set
 *
 * Passport stamps are triggered from the World with:
 * this.game.achievements.setProgress('stops', '<id>')
 */

import { stops } from './stops.js'

// Short stamp descriptions (titles come from stops.js)
const stampDescriptions = {
    sfo:              '落地舊金山，旅程開始囉。',
    ferryBuilding:    '在海灣邊吃點好吃的。',
    unionSquare:      '在大聖誕樹下溜冰。',
    chinatown:        '穿過龍門，逛逛燈籠街。',
    alcatraz:         '登島探險，平安回來。',
    pier39:           '去看海獅曬太陽。',
    lombard:          '搭叮噹車，再開過九個彎。',
    doloresPark:      '坐在草地上等夕陽。',
    palaceOfFineArts: '在圓頂下拍張照。',
    goldenGate:       '一起開過那座紅色的橋。',
    levis:            '49ers 對海鷹，一起加油！',
    paintedLadies:    '一排彩色的老房子。',
    tennis:           '最後一起打場網球。',
}

const stamps = stops.map(stop => [
    'stops',
    `${stop.label} ${stop.name} ${stop.en}`,
    stampDescriptions[stop.id] ?? `${stop.date}，到此一遊。`,
    1,
    true, // Unique
    stop.id // Required id
])

export default
[
    // Passport
    [
        'stops',
        '舊金山護照 Passport',
        `蓋滿 <strong>${stops.length}</strong> 個章，旅程完成！`,
        stops.length,
        true // Unique
    ],

    // Stamps (one per stop)
    ...stamps,

    // Driving
    [
        'distanceDriven',
        '出發囉',
        '開 1 公里。',
        1
    ],
    [
        'distanceDriven',
        '到了沒？',
        '開 10 公里。',
        10
    ],
    [
        'distanceDriven',
        '公路旅行',
        '開 50 公里。',
        50
    ],
    [
        'goHigh',
        '爬上山丘',
        '爬到 <strong>15 公尺</strong> 高。',
        15
    ],
    [
        'honk',
        '叭叭！',
        '按 10 次喇叭。',
        10
    ],
    [
        'suspensions',
        '跳跳車',
        '用用看車子的避震。',
        4
    ],
    [
        'upsideDown',
        '四腳朝天',
        '把車子翻過來。',
        1
    ],
    [
        'frontFlip',
        '前空翻',
        '前空翻，四輪落地。',
        1
    ],
    [
        'backFlip',
        '後空翻',
        '後空翻，四輪落地。',
        1
    ],
    [
        'sea',
        '跟海獅游泳',
        '把車開進海裡。',
        1
    ],

    // Weather
    [
        'fullDay',
        '從早玩到晚',
        '一口氣待滿一整天。',
        1
    ],
    [
        'weatherRain',
        '雨中漫步',
        '遇到下雨天。',
        1
    ],
    [
        'weatherSnow',
        '舊金山下雪了？',
        '遇到下雪天。',
        1
    ],
    [
        'lightning',
        '被雷打到',
        '被閃電打中。',
        1
    ],
    [
        'cataclysm',
        '龍捲風來了',
        '親眼看到龍捲風。',
        1
    ],

    // Misc
    [
        'reset',
        '收拾乾淨',
        '把東西都放回原位。',
        1
    ],
]
