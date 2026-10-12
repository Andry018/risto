/*
 * Il Girasole — card per lo schermo posteriore (MAML/JsCanvas, importata con OuterView).
 * Dati: ContentProviderBinder content://it.risto.rear.state/scene -> HostVar rr.* -> data.rr
 * La card è volutamente "muta": testi e colore arrivano già pronti dalla PWA tramite l'app
 * Girasole Rear, così per cambiare cosa si vede basta aggiornare la PWA.
 */
(function (g) {
    'use strict';
    if (!g.document) return;
    var canvas = document.getElementById('c'), ctx = canvas.getContext('2d');
    var W = g.CANVAS_W || canvas.width || 904, H = g.CANVAS_H || canvas.height || 572;
    // Terzo sinistro riservato alla fotocamera; area utile 600x572 logici scalata nel resto.
    var camera = W / 3, scale = Math.min((W - camera) / 600, H / 572);
    var dx = camera + (W - camera - 600 * scale) / 2, dy = (H - 572 * scale) / 2;
    var queued = false;

    function scene() {
        var r = (g.data && g.data.rr) || {};
        if (!(Number(r.rows) >= 1)) {
            return { top: 'Girasole Rear', main: 'Non collegata', bottom: "Apri l'app Girasole Rear", accent: '#F59E0B' };
        }
        var accent = /^#[0-9a-fA-F]{6}$/.test(String(r.accent || '')) ? String(r.accent) : '#CFA055';
        return { top: String(r.top || ''), main: String(r.main || ''), bottom: String(r.bottom || ''), accent: accent };
    }

    function font(weight, size) { ctx.font = weight + ' ' + size + 'px sans-serif'; }

    function ellipsize(s, maxW) {
        if (ctx.measureText(s).width <= maxW) return s;
        var chars = Array.from(s);
        while (chars.length > 1 && ctx.measureText(chars.join('') + '…').width > maxW) chars.pop();
        return chars.join('') + '…';
    }

    function render() {
        queued = false;
        var s = scene();
        ctx.fillStyle = '#121212'; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, camera, H);
        ctx.save(); ctx.translate(dx, dy); ctx.scale(scale, scale);

        ctx.fillStyle = s.accent; ctx.fillRect(24, 40, 552, 8);
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';

        font('700', 40); ctx.fillStyle = s.accent;
        ctx.fillText(ellipsize(s.top.toUpperCase(), 552), 300, 112);

        var size = 120; font('800', size);
        while (size > 36 && ctx.measureText(s.main).width > 552) { size -= 4; font('800', size); }
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(ellipsize(s.main, 552), 300, 290);

        font('600', 38); ctx.fillStyle = '#9CA3AF';
        ctx.fillText(ellipsize(s.bottom, 552), 300, 470);

        ctx.restore();
    }

    function drawSoon() {
        if (queued) return; queued = true;
        if (typeof g.requestAnimationFrame === 'function') g.requestAnimationFrame(render); else render();
    }

    if (g.data && g.data.addEventListener) g.data.addEventListener('change', drawSoon);
    g.GirasoleRearRender = drawSoon;
    render();
})(typeof globalThis !== 'undefined' ? globalThis : this);
