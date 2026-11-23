import trip from '../../../data/trip.js'

const css = /* css */`
.stop-card
{
    position: fixed;
    left: 50%;
    top: max(16px, env(safe-area-inset-top));
    z-index: 20;
    width: min(420px, calc(100vw - 32px));
    padding: 16px 18px 14px;
    border-radius: 18px;
    background: rgba(28, 22, 40, 0.86);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    color: #fff2e8;
    font-family: "Nunito", "Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
    transform: translate(-50%, -20px);
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.35s, transform 0.35s;
    cursor: pointer;
}
.stop-card.is-visible { opacity: 1; transform: translate(-50%, 0); pointer-events: auto; }
.stop-card .stop-card-top { display: flex; align-items: baseline; gap: 10px; }
.stop-card .stop-card-label
{
    font-family: "LXGW WenKai TC", "Noto Sans TC", sans-serif;
    font-size: 15px;
    padding: 2px 10px;
    border-radius: 999px;
    background: #ec3f1c;
    color: #fff;
    white-space: nowrap;
}
.stop-card .stop-card-date { font-size: 13px; opacity: 0.7; }
.stop-card .stop-card-name { font-family: "LXGW WenKai TC", "Noto Sans TC", sans-serif; font-size: 26px; line-height: 1.2; margin-top: 8px; }
.stop-card .stop-card-en { font-size: 14px; opacity: 0.7; }
.stop-card .stop-card-note { font-size: 15px; line-height: 1.55; margin-top: 8px; }
.stop-card .stop-card-foot { display: flex; justify-content: space-between; gap: 8px; margin-top: 10px; font-size: 13px; opacity: 0.75; }
.stop-card .stop-card-task { margin-top: 10px; padding: 7px 10px; border-radius: 10px; background: rgba(236, 63, 28, 0.25); font-size: 14px; }
.stop-card .stop-card-task.is-done { background: rgba(145, 173, 120, 0.3); }
.stop-card .stop-card-stamps { display: flex; gap: 4px; margin-top: 10px; }
.stop-card .stop-card-stamps i { flex: 1; height: 5px; border-radius: 3px; background: rgba(255, 255, 255, 0.18); }
.stop-card .stop-card-stamps i.is-done { background: #e4a90c; }
.stop-card.is-finale { background: rgba(195, 14, 58, 0.9); }
`

export class StopCard
{
    static instance = null

    static get()
    {
        if(!StopCard.instance)
            StopCard.instance = new StopCard()
        return StopCard.instance
    }

    constructor()
    {
        const style = document.createElement('style')
        style.textContent = css
        document.head.append(style)

        this.element = document.createElement('div')
        this.element.className = 'stop-card'
        this.element.setAttribute('role', 'status')
        this.element.setAttribute('aria-live', 'polite')
        document.body.append(this.element)

        this.element.addEventListener('click', () => this.hide())
        this.timeout = null
    }

    show({ stop, total, done, next, isNew, task })
    {
        const taskHtml = task ? `<div class="stop-card-task${task.done ? ' is-done' : ''}">${task.done ? '✓ ' : '任務：'}${task.text}${!task.done && task.status ? `（${task.status}）` : ''}</div>` : ''
        const stamps = Array.from({ length: total }, (_, i) => `<i class="${done.has(i) ? 'is-done' : ''}"></i>`).join('')
        const foot = next
            ? `<span>下一站：${next.label} ${next.name}</span><span>${isNew ? '蓋章了 ✓' : `${done.size} / ${total}`}</span>`
            : `<span>${done.size === total ? '全部的站都到了' : '還有站沒去喔'}</span><span>${done.size} / ${total}</span>`

        this.element.classList.remove('is-finale')
        this.element.innerHTML = /* html */`
            <div class="stop-card-top"><span class="stop-card-label">${stop.label}</span><span class="stop-card-date">${stop.date}</span></div>
            <div class="stop-card-name">${stop.name}</div>
            <div class="stop-card-en">${stop.en}</div>
            <div class="stop-card-note">${stop.note}</div>
            ${taskHtml}
            <div class="stop-card-stamps">${stamps}</div>
            <div class="stop-card-foot">${foot}</div>
        `
        this.open(isNew ? 9 : 5)
    }

    showSecret(secret, isNew, foundCount)
    {
        this.element.classList.remove('is-finale')
        this.element.innerHTML = /* html */`
            <div class="stop-card-top"><span class="stop-card-label" style="background:#7d4aa8">秘密景點</span><span class="stop-card-date">${secret.date}</span></div>
            <div class="stop-card-name">${secret.name}</div>
            <div class="stop-card-en">${secret.en}</div>
            <div class="stop-card-note">${secret.note}</div>
            <div class="stop-card-foot"><span>${isNew ? '找到了！' : '又來了'}</span><span>秘密 ${foundCount} / 2</span></div>
        `
        this.open(isNew ? 9 : 5)
    }

    showFinale()
    {
        this.element.classList.add('is-finale')
        this.element.innerHTML = /* html */`
            <div class="stop-card-top"><span class="stop-card-label">13 / 13</span><span class="stop-card-date">${trip.dates}</span></div>
            <div class="stop-card-name">給 ${trip.partnerName}</div>
            <div class="stop-card-note">十三站，一站都沒少。<br>從機場到網球場，這是我們的舊金山，先開過一遍了。<br>小可跟 Dookie 也來送行。<br>11/24，真的舊金山見。</div>
            <div class="stop-card-foot"><span>♥ ${trip.authorName}</span><span>金門大橋北邊還藏著兩個秘密景點</span></div>
        `
        this.open(20)
    }

    open(duration)
    {
        this.element.classList.add('is-visible')
        clearTimeout(this.timeout)
        this.timeout = setTimeout(() => this.hide(), duration * 1000)
    }

    hide()
    {
        clearTimeout(this.timeout)
        this.element.classList.remove('is-visible')
    }
}
