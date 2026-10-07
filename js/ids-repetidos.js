/* ============================================================
   NuNa · ids-repetidos.js — separa os lancamentos "real-" que
   ficaram com o mesmo id (ex.: 4 lavanderias iguais no mesmo dia).
   Correcao de uso unico, so depois do OK da usuaria:
   1. a aba Dados mostra a lista (id antigo, ids novos, mes, descricao, valor);
   2. no OK, o 1o lancamento de cada grupo fica com o id antigo e os demais
      ganham id novo (CSV.corrigirIdsRepetidos); os ajustes guardados pelo id
      antigo (categoria, Conferido/revisar, status) sao copiados para os ids
      novos e passam a ser independentes;
   3. as somas por mes, perfil e categoria sao comparadas antes e depois —
      se mudar qualquer centavo, nada e gravado.
   ============================================================ */
var IdsRepetidos = (function () {
  function clone(v) { return JSON.parse(JSON.stringify(v)); }

  /* mesma aplicacao de overrides que o aplicarBase faz */
  function comAjuste(t, ov) {
    var o = (ov || {})[t.uid], r = {};
    ['plano', 'tipo', 'grupo', 'divisao', 'status', 'revisar', 'sub'].forEach(function (k) {
      r[k] = (o && o[k] !== undefined) ? o[k] : t[k];
    });
    return r;
  }
  /* soma e quantidade por mes|perfil|categoria|grupo|subtipo|tipo|divisao|status|revisar */
  function somas(base, ov) {
    var s = {};
    (base.monthOrder || []).forEach(function (m) {
      ((base.months[m] || {}).transactions || []).forEach(function (t) {
        var a = comAjuste(t, ov);
        var k = [m, t.perfil, a.plano, a.grupo || '', a.sub || '', a.tipo, a.divisao, a.status || '', a.revisar ? 1 : 0].join('|');
        var x = s[k] || (s[k] = { n: 0, c: 0 });
        x.n++; x.c += Math.round(Number(t.valor) * 100);
      });
    });
    return s;
  }
  function iguais(a, b) {
    var ka = Object.keys(a), kb = Object.keys(b);
    if (ka.length !== kb.length) return false;
    return ka.every(function (k) { return b[k] && b[k].n === a[k].n && b[k].c === a[k].c; });
  }

  /* calcula tudo sem gravar nada */
  function planejar(base, idsImportados, overrides, revisados) {
    var nova = clone(base), ov = clone(overrides || {}), rv = clone(revisados || {});
    var trocas = CSV.corrigirIdsRepetidos(nova, idsImportados || []);
    var porNovo = {};
    (nova.monthOrder || []).forEach(function (m) {
      ((nova.months[m] || {}).transactions || []).forEach(function (t) { porNovo[m + '|' + t.uid] = t; });
    });
    trocas.forEach(function (x) {
      var t = porNovo[x.mes + '|' + x.novo];
      x.desc = t.desc; x.data = t.data; x.valor = t.valor; x.fonte = t.fonteLabel; x.perfil = t.perfil;
      if (ov[x.antigo] && !ov[x.novo]) ov[x.novo] = clone(ov[x.antigo]);
      if (rv[x.antigo] && !rv[x.novo]) rv[x.novo] = rv[x.antigo];
    });
    var antes = somas(base, overrides), depois = somas(nova, ov);
    var n0 = 0, n1 = 0;
    Object.keys(antes).forEach(function (k) { n0 += antes[k].n; });
    Object.keys(depois).forEach(function (k) { n1 += depois[k].n; });
    return { base: nova, overrides: ov, revisados: rv, trocas: trocas,
             somasIguais: iguais(antes, depois) && n0 === n1, total: n1 };
  }

  /* ---------- aba Dados ---------- */
  function plano() {
    var b = Store.base(); if (!b) return null;
    var imp = Store.get(K.IMPORTADOS, []).map(function (t) { return t.uid; }).filter(Boolean);
    return planejar(b, imp, Store.get(K.OVERRIDES, {}), Store.get('revisados', null));
  }
  function tabela(trocas) {
    var grupos = {}, ordem = [];
    trocas.forEach(function (x) { if (!grupos[x.antigo]) { grupos[x.antigo] = []; ordem.push(x.antigo); } grupos[x.antigo].push(x); });
    return '<div class="scroll"><table><thead><tr><th>Id antigo (fica no 1&ordm;)</th><th>Ids novos</th><th>M&ecirc;s</th><th>Data</th><th>Descri&ccedil;&atilde;o</th><th>Cart&atilde;o</th><th class="num">Valor</th></tr></thead><tbody>' +
      ordem.map(function (a) {
        return grupos[a].map(function (x, i) {
          return '<tr>' + (i ? '' : '<td rowspan="' + grupos[a].length + '" class="mono">' + esc(a) + '</td>') +
            '<td class="mono">' + esc(x.novo) + '</td><td>' + esc(x.mes) + '</td><td>' + esc(x.data || '') + '</td>' +
            '<td>' + esc(x.desc || '') + '</td><td>' + esc(x.fonte || '') + '</td><td class="num">' + brl(x.valor) + '</td></tr>';
        }).join('');
      }).join('') + '</tbody></table></div>';
  }
  function montar() {
    var painel = document.getElementById('panel-dados');
    if (!painel || !Store.base()) return;
    var p = plano();
    var card = document.getElementById('idr-card');
    if (!p || !p.trocas.length) { if (card) card.remove(); return; }
    if (!card) {
      card = document.createElement('div'); card.className = 'card'; card.id = 'idr-card';
      var ib = document.getElementById('ib-card');
      painel.insertBefore(card, ib ? ib.nextSibling : painel.firstChild);
    }
    var grupos = {}; p.trocas.forEach(function (x) { grupos[x.antigo] = 1; });
    card.innerHTML = '<h2>Lan&ccedil;amentos iguais com o mesmo id</h2>' +
      '<p class="note">' + Object.keys(grupos).length + ' ids aparecem em mais de um lan&ccedil;amento (' +
      (p.trocas.length + Object.keys(grupos).length) + ' lan&ccedil;amentos). Por isso editar ou conferir um deles muda os iguais. ' +
      'A corre&ccedil;&atilde;o mant&eacute;m o id antigo no 1&ordm; lan&ccedil;amento de cada grupo e d&aacute; id novo aos demais; ' +
      'os ajustes de hoje (categoria, Conferido, status) s&atilde;o copiados para os novos. Nenhum lan&ccedil;amento &eacute; removido ou juntado.</p>' +
      tabela(p.trocas) +
      '<p class="note" style="margin-top:10px">Somas por m&ecirc;s, perfil e categoria antes e depois: <b>' +
      (p.somasIguais ? 'id&ecirc;nticas' : 'DIFERENTES &mdash; a corre&ccedil;&atilde;o est&aacute; bloqueada') + '</b> (' + p.total + ' lan&ccedil;amentos).</p>' +
      '<button class="btn" id="idr-ok"' + (p.somasIguais ? '' : ' disabled') + '>Aplicar a corre&ccedil;&atilde;o</button> ' +
      '<span class="note" id="idr-msg"></span>';
    document.getElementById('idr-ok').addEventListener('click', aplicar);
  }
  function aplicar() {
    var p = plano(), msg = document.getElementById('idr-msg'), bt = document.getElementById('idr-ok');
    if (!p || !p.trocas.length) { montar(); return; }
    if (!p.somasIguais) { msg.textContent = 'As somas mudariam; nada foi gravado.'; return; }
    bt.disabled = true; msg.textContent = 'Gravando...';
    Store.set(K.OVERRIDES, p.overrides);
    if (Store.get('revisados', null)) Store.set('revisados', p.revisados);
    Promise.resolve(Store.definirBase(p.base)).then(function () {
      console.info('[NuNa] ids repetidos corrigidos', p.trocas);
      msg.innerHTML = '&#10003; ' + p.trocas.length + ' ids novos gravados. Recarregando...';
      setTimeout(function () { location.reload(); }, 900);
    }).catch(function (e) { msg.textContent = 'Nao consegui gravar: ' + (e && e.message || e); bt.disabled = false; });
  }

  if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', function () {
    [1000, 2500, 5000].forEach(function (t) { setTimeout(montar, t); });
  });
  return { planejar: planejar, somas: somas, montar: montar };
})();
