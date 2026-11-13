/* GREED · "Aperto adesso + I gusti di oggi" per gelateriagreed.it
   Si incolla in WordPress con due righe:
     <div id="greed-oggi"></div>
     <script src="https://greedgelateria.github.io/i-gusti/oggi.js" defer></script>
   Legge gli stessi dati di Admin Gusti (gusti accesi, vegan, allergeni, orari): niente da aggiornare a mano.
   Versione inglese: <div id="greed-oggi" data-lang="en"></div> */
(function () {
  'use strict';
  var BASE = 'https://firestore.googleapis.com/v1/projects/club-greed/databases/(default)/documents/config/';
  var ORDINA = 'https://greedgelateria.github.io/i-gusti/';
  var MAPPA = 'https://www.google.com/maps/search/?api=1&query=GREED+Gelateria+Naturale+Piazza+Roma+16+Frascati';
  var TEL = '+393476236679';
  var GIORNI = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
  // Orari di riserva, usati solo se quelli di Admin Gusti non si riescono a leggere
  var ORARI_RISERVA = { Lun: { chiuso: true }, Mar: { ap: '13:00', ch: '20:00' }, Mer: { ap: '13:00', ch: '20:00' }, Gio: { ap: '13:00', ch: '20:00' },
    Ven: { ap: '13:00', ch: '20:00' }, Sab: { ap: '11:00', ch: '20:00' }, Dom: { ap: '11:00', ch: '20:00' } };
  var TESTI = {
    it: { giorni: ['lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato', 'domenica'],
      aperto: function (h) { return 'Aperto adesso, fino alle ' + h; }, apreOggi: function (h) { return 'Apre oggi alle ' + h; },
      riapre: function (g, h) { return 'Chiuso adesso. Riapre ' + g + ' alle ' + h; }, domani: 'domani',
      titolo: 'I gusti di oggi',
      conta: function (n, v) { return n + (n === 1 ? ' gusto' : ' gusti') + ' al banco' + (v ? ', ' + v + ' vegan' : '') + '. Tutto senza glutine.'; },
      vegan: 'vegan', offerta: 'in offerta', contiene: 'Contiene: ',
      arriva: 'Come arrivare', ordina: 'Ordina online', chiama: 'Chiama', dove: 'Piazza Roma 16, Frascati',
      nota: 'Gli allergeni sono indicati sotto ogni gusto. Per qualsiasi dubbio chiedi al banco.',
      agg: function (d) { return 'Banco aggiornato ' + d; }, oggiAlle: function (h) { return 'oggi alle ' + h; }, il: function (d) { return 'il ' + d; },
      vuoto: 'I gusti di oggi li trovi nella pagina degli ordini.', vedi: 'Vedi i gusti',
      al: {} },
    en: { giorni: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
      aperto: function (h) { return 'Open now, until ' + h; }, apreOggi: function (h) { return 'Opens today at ' + h; },
      riapre: function (g, h) { return 'Closed now. Opens ' + g + ' at ' + h; }, domani: 'tomorrow',
      titolo: 'Today\u2019s flavours',
      conta: function (n, v) { return n + (n === 1 ? ' flavour' : ' flavours') + ' at the counter' + (v ? ', ' + v + ' vegan' : '') + '. Everything is gluten free.'; },
      vegan: 'vegan', offerta: 'on offer', contiene: 'Contains: ',
      arriva: 'Get directions', ordina: 'Order online', chiama: 'Call', dove: 'Piazza Roma 16, Frascati (Rome)',
      nota: 'Allergens are listed under each flavour. If in doubt, ask at the counter.',
      agg: function (d) { return 'Counter updated ' + d; }, oggiAlle: function (h) { return 'today at ' + h; }, il: function (d) { return 'on ' + d; },
      vuoto: 'You can find today\u2019s flavours on the ordering page.', vedi: 'See the flavours',
      al: { latte: 'milk', uova: 'eggs', 'frutta a guscio': 'tree nuts', soia: 'soy', arachidi: 'peanuts', sesamo: 'sesame', solfiti: 'sulphites', glutine: 'gluten', lupini: 'lupin', sedano: 'celery', senape: 'mustard', pesce: 'fish' } }
  };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  // ── Lettura dei documenti pubblici di Firestore (sola lettura, nessun accesso richiesto) ──
  function valore(v) {
    if (!v) return null;
    if ('stringValue' in v) return v.stringValue;
    if ('booleanValue' in v) return v.booleanValue;
    if ('integerValue' in v) return +v.integerValue;
    if ('doubleValue' in v) return v.doubleValue;
    if ('timestampValue' in v) return v.timestampValue;
    if ('arrayValue' in v) return (v.arrayValue.values || []).map(valore);
    if ('mapValue' in v) return campi(v.mapValue.fields || {});
    return null;
  }
  function campi(f) { var o = {}; Object.keys(f).forEach(function (k) { o[k] = valore(f[k]); }); return o; }
  function leggi(nome) {
    var ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var t = setTimeout(function () { if (ctl) ctl.abort(); }, 8000);
    return fetch(BASE + nome, ctl ? { signal: ctl.signal } : undefined).then(function (r) { clearTimeout(t); if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (j) { var d = campi(j.fields || {}); d.__agg = j.updateTime || null; return d; });
  }
  // ── Orario italiano, qualunque sia il fuso di chi guarda il sito ──
  function oraRoma(d) {
    var p = {}; new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Rome', weekday: 'short', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric', hourCycle: 'h23' })
      .formatToParts(d).forEach(function (x) { p[x.type] = x.value; });
    return { g: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(p.weekday), min: (+p.hour % 24) * 60 + +p.minute, data: p.year + '-' + p.month + '-' + p.day, hm: p.hour + ':' + p.minute, gm: p.day + '/' + p.month };
  }
  function minuti(s) { var m = /^(\d{1,2}):(\d{2})/.exec(s || ''); return m ? +m[1] * 60 + +m[2] : null; }
  function finestra(o) { if (!o || o.chiuso) return null; var a = minuti(o.ap), c = minuti(o.ch); if (a === null || c === null) return null; if (c <= a) c += 1440; return { a: a, c: c, ap: o.ap, ch: o.ch }; }
  function stato(orari, adesso, T) {
    var r = oraRoma(adesso), oggi = finestra(orari[GIORNI[r.g]]), ieri = finestra(orari[GIORNI[(r.g + 6) % 7]]);
    if (ieri && ieri.c > 1440 && r.min < ieri.c - 1440) return { tipo: 'aperto', testo: T.aperto(ieri.ch) };   // chiusura dopo mezzanotte
    if (oggi && r.min >= oggi.a && r.min < oggi.c) return { tipo: 'aperto', testo: T.aperto(oggi.ch) };
    if (oggi && r.min < oggi.a) return { tipo: 'presto', testo: T.apreOggi(oggi.ap) };
    for (var i = 1; i <= 7; i++) { var f = finestra(orari[GIORNI[(r.g + i) % 7]]); if (f) return { tipo: 'chiuso', testo: T.riapre(i === 1 ? T.domani : T.giorni[(r.g + i) % 7], f.ap) }; }
    return { tipo: 'chiuso', testo: '' };
  }
  var CSS = '.greed-oggi{--go-verde:#1f3a1a;--go-panna:#f6f1e6;--go-oro:#c8a34a;--go-tenue:rgba(246,241,230,.68);box-sizing:border-box;background:var(--go-verde);color:var(--go-panna);border-radius:18px;padding:clamp(22px,4.5vw,44px);font-family:inherit;line-height:1.45;text-align:left;max-width:1180px;margin:0 auto}' +
    '.greed-oggi *{box-sizing:border-box}' +
    '.greed-oggi .go-stato{display:inline-flex;align-items:center;gap:10px;font-size:16px;font-weight:600;margin:0 0 18px;color:var(--go-panna)}' +
    '.greed-oggi .go-punto{width:11px;height:11px;border-radius:50%;background:#8a8f84;flex:none}' +
    '.greed-oggi .go-aperto .go-punto{background:#7bd389;box-shadow:0 0 0 5px rgba(123,211,137,.22)}' +
    '.greed-oggi .go-presto .go-punto{background:#e9c46a}' +
    '.greed-oggi .go-chiuso .go-punto{background:#d98a7a}' +
    '.greed-oggi .go-titolo{font-family:inherit;color:var(--go-panna);font-size:clamp(30px,5.4vw,52px);line-height:1.04;font-weight:700;letter-spacing:-.01em;margin:0 0 8px;padding:0;text-transform:none}' +
    '.greed-oggi .go-conta{font-size:17px;color:var(--go-tenue);margin:0 0 26px}' +
    '.greed-oggi .go-lista{list-style:none;margin:0 0 26px;padding:22px 0 0;border-top:1px solid rgba(200,163,74,.45);columns:3 230px;column-gap:38px}' +
    '.greed-oggi .go-lista li{break-inside:avoid;margin:0 0 15px;padding:0;list-style:none}' +
    '.greed-oggi .go-nome{display:block;font-size:19px;font-weight:600;line-height:1.25;color:var(--go-panna)}' +
    '.greed-oggi .go-segno{display:inline-block;font-size:12px;font-weight:600;border-radius:999px;padding:1px 9px;margin-left:7px;vertical-align:2px;white-space:nowrap}' +
    '.greed-oggi .go-vegan{background:rgba(123,211,137,.16);color:#a9e5b6;box-shadow:inset 0 0 0 1px rgba(123,211,137,.5)}' +
    '.greed-oggi .go-offerta{background:var(--go-oro);color:#1f3a1a}' +
    '.greed-oggi .go-al{display:block;font-size:13.5px;color:var(--go-tenue);margin-top:2px}' +
    '.greed-oggi .go-azioni{display:flex;flex-wrap:wrap;gap:10px;align-items:center}' +
    '.greed-oggi a.go-btn{display:inline-block;font-size:16px;font-weight:700;text-decoration:none;border-radius:10px;padding:13px 22px;border:1.5px solid rgba(246,241,230,.5);color:var(--go-panna);background:transparent;line-height:1.2}' +
    '.greed-oggi a.go-btn:hover{border-color:var(--go-panna);background:rgba(246,241,230,.08)}' +
    '.greed-oggi a.go-btn.go-primo{background:var(--go-oro);border-color:var(--go-oro);color:#1f3a1a}' +
    '.greed-oggi a.go-btn.go-primo:hover{background:#d8b65e;border-color:#d8b65e}' +
    '.greed-oggi a.go-btn:focus-visible{outline:3px solid #fff;outline-offset:3px}' +
    '.greed-oggi .go-dove{font-size:15px;color:var(--go-tenue);margin-left:6px}' +
    '.greed-oggi .go-nota{font-size:13px;color:var(--go-tenue);margin:20px 0 0}' +
    '@media(max-width:560px){.greed-oggi{border-radius:14px}.greed-oggi a.go-btn{flex:1 1 100%;text-align:center}.greed-oggi .go-dove{margin:4px 0 0;flex-basis:100%}}';
  function avvia(el) {
    var lingua = (el.getAttribute('data-lang') || document.documentElement.lang || 'it').toLowerCase().indexOf('en') === 0 ? 'en' : 'it', T = TESTI[lingua];
    var orari = ORARI_RISERVA, gusti = null, aggiornato = null;
    if (!document.getElementById('greed-oggi-css')) { var st = document.createElement('style'); st.id = 'greed-oggi-css'; st.textContent = CSS; document.head.appendChild(st); }
    el.classList.add('greed-oggi');
    function adesso() { return window.__greedOra ? new Date(window.__greedOra) : new Date(); }
    function disegna() {
      var s = stato(orari, adesso(), T), h = '<p class="go-stato go-' + s.tipo + '" role="status"><span class="go-punto" aria-hidden="true"></span>' + esc(s.testo) + '</p>';
      h += '<h2 class="go-titolo">' + esc(T.titolo) + '</h2>';
      var attivi = (gusti || []).filter(function (g) { return g && (g.a || g.attivo) && g.n && String(g.n).trim(); });
      if (attivi.length) {
        h += '<p class="go-conta">' + esc(T.conta(attivi.length, attivi.filter(function (g) { return g.vegan; }).length)) + '</p><ul class="go-lista">';
        attivi.forEach(function (g) {
          var al = (g.al || []).map(function (a) { return T.al[String(a).toLowerCase()] || String(a).toLowerCase(); });
          h += '<li><span class="go-nome">' + (g.e ? esc(g.e) + ' ' : '') + esc(g.n) + (g.vegan ? '<span class="go-segno go-vegan">' + T.vegan + '</span>' : '') + (g.o || g.offerta ? '<span class="go-segno go-offerta">' + T.offerta + '</span>' : '') + '</span>' +
            (al.length ? '<span class="go-al">' + esc(T.contiene + al.join(', ')) + '</span>' : '') + '</li>';
        });
        h += '</ul>';
      } else if (gusti !== null) {
        h += '<p class="go-conta">' + esc(T.vuoto) + '</p>';
      }
      h += '<div class="go-azioni"><a class="go-btn go-primo" href="' + MAPPA + '" target="_blank" rel="noopener">' + esc(T.arriva) + '</a>' +
        '<a class="go-btn" href="' + ORDINA + '">' + esc(attivi.length ? T.ordina : T.vedi) + '</a>' +
        '<a class="go-btn" href="tel:' + TEL + '">' + esc(T.chiama) + '</a><span class="go-dove">' + esc(T.dove) + '</span></div>';
      if (attivi.length) {
        var quando = '';
        if (aggiornato) { var a = oraRoma(new Date(aggiornato)), o = oraRoma(adesso()); quando = ' ' + T.agg(a.data === o.data ? T.oggiAlle(a.hm) : T.il(a.gm)) + '.'; }
        h += '<p class="go-nota">' + esc(T.nota + quando) + '</p>';
      }
      el.innerHTML = h;
    }
    disegna();
    leggi('orari').then(function (d) { delete d.__agg; if (GIORNI.some(function (g) { return d[g]; })) { orari = d; disegna(); } }).catch(function () {});
    leggi('gusti').then(function (d) { gusti = d.lista || []; aggiornato = d.__agg; disegna(); }).catch(function () { gusti = []; disegna(); });
    setInterval(disegna, 60000);   // lo stato aperto/chiuso si aggiorna da solo
  }
  function parti() { var n = document.querySelectorAll('#greed-oggi,[data-greed-oggi]'); for (var i = 0; i < n.length; i++) if (!n[i].__greed) { n[i].__greed = 1; avvia(n[i]); } }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', parti); else parti();
})();
