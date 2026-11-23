/**
 * Car paints. Basic colors are always available; every site has its own color, unlocked by stamping that stop;
 * flames unlock with all 13 stamps, abyssal (stars) with every achievement.
 * `name` is what gets saved (localStorage 'achievementsReward'), 'red' is the historical slot of the light blue default.
 */
export const paints = [
    // basic
    { name: 'red',     label: '天空藍', colors: [ '#a9e8ff', '#3f86e0' ], default: true },
    { name: 'crimson', label: '櫻桃紅', colors: [ '#ff6a6a', '#9b1030' ] },
    { name: 'white',   label: '珍珠白', colors: [ '#ffffff', '#b5b5b5' ] },
    { name: 'black',   label: '曜石黑', colors: [ '#626262', '#262526' ] },
    { name: 'sunny',   label: '檸檬黃', colors: [ '#ffe27a', '#e58a00' ] },
    { name: 'mint',    label: '薄荷綠', colors: [ '#a6f2c0', '#2c9a68' ] },
    { name: 'pink',    label: '草莓粉', colors: [ '#ffc4de', '#e0508c' ] },
    { name: 'violet',  label: '葡萄紫', colors: [ '#d9b8ff', '#6a3fd0' ] },
    // one color per site: stamp that stop to unlock it
    { name: 'sfo',          stop: 'sfo',              label: '跑道夜燈',   colors: [ '#7df9ff', '#1b3a8a' ] },
    { name: 'ferry',        stop: 'ferryBuilding',    label: '鐘樓砂岩',   colors: [ '#fff4d6', '#c9a66b' ] },
    { name: 'xmas',         stop: 'unionSquare',      label: '聖誕紅綠',   colors: [ '#3fd182', '#c4142d' ] },
    { name: 'lantern',      stop: 'chinatown',        label: '燈籠紅金',   colors: [ '#ffd23f', '#e0201b' ] },
    { name: 'prison',       stop: 'alcatraz',         label: '監獄霧藍',   colors: [ '#c3d3e2', '#2c3e50' ] },
    { name: 'seal',         stop: 'pier39',           label: '海獅藍綠',   colors: [ '#5ee7df', '#0f6e8c' ] },
    { name: 'hydrangea',    stop: 'lombard',          label: '繡球花',     colors: [ '#f7a8d8', '#7b5cd6' ] },
    { name: 'picnic',       stop: 'doloresPark',      label: '草地野餐',   colors: [ '#e2fb8a', '#3a9a3a' ] },
    { name: 'rotunda',      stop: 'palaceOfFineArts', label: '圓頂玫瑰',   colors: [ '#ffd9c2', '#b5654a' ] },
    { name: 'international', stop: 'goldenGate',      label: '國際橘',     colors: [ '#ff8a4a', '#b8301f' ] },
    { name: 'niners',       stop: 'levis',            label: '49 人金紅',  colors: [ '#f2d37a', '#aa0000' ] },
    { name: 'victorian',    stop: 'paintedLadies',    label: '維多利亞',   colors: [ '#b9e6ff', '#f3a6c8' ] },
    { name: 'tennisBall',   stop: 'tennis',           label: '網球螢光',   colors: [ '#f1ff4d', '#4fbf3a' ] },
    // finale finishes
    { name: 'flames',  allStops: true, label: '火焰', image: 'ui/achievements/rewards/flames.webp' },
    { name: 'abyssal', allAchievements: true, label: '星空', image: 'ui/achievements/rewards/abyssal.webp' },
]
