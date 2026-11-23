import trip from './trip.js'

const text = `
╔═ ${trip.title} ═══════════════╗
║ 嘿，偷看程式碼的人你好。
║ 這是給 ${trip.partnerName} 的舊金山小旅行 (${trip.dates})。
║ 開著小車，一站一站把護照蓋滿吧。
╚═══════════════════════╝

╔═ Debug ═══════════════╗
║ 在網址最後加上 #debug 再重新整理，可以打開除錯模式。
║ 按 [V] 切換自由視角。
╚═══════════════════════╝

╔═ Credits ═════════════╗
║ ${trip.credit.text}
║ ${trip.credit.url}
╚═══════════════════════╝
`
let finalText = ''
let finalStyles = []
const stylesSet = {
    letter: 'color: #ffffff; font: 400 1em monospace;',
    pipe: 'color: #D66FFF; font: 400 1em monospace;',
}
let currentStyle = null
for(let i = 0; i < text.length; i++)
{
    const char = text[i]

    const style = char.match(/[╔║═╗╚╝╔╝]/) ? 'pipe' : 'letter'
    if(style !== currentStyle)
    {
        currentStyle = style
        finalText += '%c'

        finalStyles.push(stylesSet[currentStyle])
    }
    finalText += char
}

export default [ finalText, ...finalStyles ]
