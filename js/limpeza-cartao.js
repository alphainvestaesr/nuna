/* ============================================================
   NuNa · limpeza-cartao.js — ajustes antigos com plano "Bradesco"/"Inter"
   Sao nomes provisorios da importacao (o cartao no lugar da categoria).
   Ao carregar, o app ja mostra esses lancamentos na categoria do tipo
   (CAT_CATCHALL / CAT_POR_TIPO em categorias.js). A limpeza so grava no
   ajuste a categoria que ja aparece hoje — nada muda na tela nem nas somas.
   Fluxo: a aba Dados lista os lancamentos afetados e espera o OK.
   Cada uma ve e limpa so os proprios lancamentos e os conjuntos.
   ============================================================ */
(function () {
  var CHAVE_LOCAL = 'nuna.v1.limpezaCartao';
  function eu() { return ((window.Auth && Auth.sessao && Auth.sessao()) || {}).perfil; }
  function visivel(t) { var p = eu(); return !p || t.perfil === p || !!t.grupo; }
  function porUid() {
    var o = {};
    MONTHS.forEach(function (m) { DATA.months[m].transactions.forEach(function (t) { if (!t.previsto && !o[t.uid]) o[t.uid] = { t: t, mes: m }; }); });
    return o;
  }
  function afetados() {
    var ov = Store.get(K.OVERRIDES, {}) || {}, tx = porUid(), out = [];
    Object.keys(ov).forEach(function (u) {
      var o = ov[u];
      if (!o || typeof o !== 'object' || !CAT_CATCHALL[o.plano]) return;
      var x = tx[u];
      out.push({ uid: u, guardado: o.plano, achado: !!x, mes: x && x.mes, t: x && x.t, visivel: !x || visivel(x.t) });
    });
    return out;
  }
  function somas() {
    var s = {};
    MONTHS.forEach(function (m) {
      mesTx(m).forEach(function (t) {
        var k = [m, t.perfil, t.plano, t.grupo || '', t.sub || '', t.tipo].join('|');
        s[k] = (s[k] || 0) + Math.round(t.valor * 100);
      });
      ['Ana', 'Manuela', 'NuNa'].forEach(function (p) { s[m + '|saldo|' + p] = Math.round(gastoOf(m, p) * 100) + '/' + Math.round(saldoOf(m, p) * 100); });
    });
    return s;
  }
  function lerLocal() { try { return JSON.parse(localStorage.getItem(CHAVE_LOCAL) || 'null'); } catch (e) { return null; } }
  function gravarLocal(v) { try { if (v) localStorage.setItem(CHAVE_LOCAL, JSON.stringify(v)); else localStorage.removeItem(CHAVE_LOCAL); } catch (e) {} }

  function montar() {
    var painel = document.getElementById('panel-dados');
    if (!painel || !DATA || !Store.base()) return;
    var card = document.getElementById('lc-card'), l = afetados(), feito = lerLocal();
    var meus = l.filter(function (x) { return x.visivel; }), outros = l.length - meus.length;
    if (!l.length && !feito) { if (card) card.remove(); return; }
    if (!card) {
      card = document.createElement('div'); card.className = 'card'; card.id = 'lc-card';
      var ref = document.getElementById('ib-card');
      painel.insertBefore(card, ref ? ref.nextSibling : painel.firstChild);
    }
    if (feito && !meus.filter(function (x) { return x.achado; }).length) { card.innerHTML = conferencia(feito, outros); ligarFechar(card); return; }
    var cont = {}; l.forEach(function (x) { cont[x.guardado] = (cont[x.guardado] || 0) + 1; });
    card.innerHTML = '<h2>Ajustes com &quot;Bradesco&quot; / &quot;Inter&quot; como categoria &mdash; aguardando OK</h2>' +
      '<p class="note">' + Object.keys(cont).map(function (k) { return esc(k) + ': <b>' + cont[k] + '</b>'; }).join(' &middot; ') +
      '. S&atilde;o nomes provis&oacute;rios da importa&ccedil;&atilde;o, n&atilde;o categorias. Hoje a tela j&aacute; mostra cada um na categoria do tipo (coluna &quot;Mostrado hoje&quot;); ' +
      'a limpeza grava essa categoria no ajuste, ent&atilde;o nada muda na tela nem nos totais.' +
      (outros ? ' <b>' + outros + '</b> s&atilde;o lan&ccedil;amentos individuais da outra pessoa: aparecem e s&atilde;o limpos quando ela entra no NuNa.' : '') + '</p>' +
      (meus.length ? '<div class="scroll"><table><thead><tr><th>id</th><th>M&ecirc;s</th><th>Data</th><th>Descri&ccedil;&atilde;o</th><th>Perfil</th><th>Tipo</th><th>Guardado</th><th>Mostrado hoje (fica)</th><th class="num">Valor</th></tr></thead><tbody>' +
        meus.map(function (x) {
          var t = x.t;
          return '<tr><td class="mono" style="font-size:11px">' + esc(x.uid) + '</td>' + (t
            ? '<td>' + esc(x.mes) + '</td><td>' + esc(t.data) + '</td><td>' + esc(t.desc) + '</td><td>' + esc(t.perfil) + (t.grupo ? ' &middot; conjunto' : '') + '</td><td>' + esc(t.tipo) + '</td>' +
              '<td>' + esc(x.guardado) + '</td><td><b>' + esc(t.plano + (t.sub && !t.grupo ? ' › ' + t.sub : '')) + '</b></td><td class="num">' + brl(t.valor) + '</td>'
            : '<td colspan="5">lan&ccedil;amento n&atilde;o encontrado na base &mdash; o ajuste fica como est&aacute;</td><td>' + esc(x.guardado) + '</td><td>&mdash;</td><td></td>') + '</tr>';
        }).join('') + '</tbody></table></div>' : '') +
      (meus.some(function (x) { return x.achado; }) ? '<button class="btn" id="lc-ok">Limpar os ajustes</button> <span class="note" id="lc-msg"></span>' : '');
    var b = document.getElementById('lc-ok'); if (b) b.onclick = aplicar;
  }
  function conferencia(f, outros) {
    var agora = somas(), dif = Object.keys(f.antes).filter(function (k) { return agora[k] !== f.antes[k]; })
      .concat(Object.keys(agora).filter(function (k) { return !(k in f.antes); }));
    return '<h2>Ajustes com &quot;Bradesco&quot; / &quot;Inter&quot; &mdash; limpeza aplicada</h2>' +
      '<p class="note">' + f.n + ' ajustes limpos. Totais por m&ecirc;s, perfil e categoria, e saldos, antes e depois: <b>' + (dif.length ? 'DIFERENTES (' + dif.length + ')' : 'id&ecirc;nticos') + '</b>.' +
      (outros ? ' Restam ' + outros + ' da outra pessoa, limpos quando ela entrar.' : '') + '</p><button class="pill" id="lc-fechar">Fechar</button>';
  }
  function ligarFechar(card) { var f = document.getElementById('lc-fechar'); if (f) f.onclick = function () { gravarLocal(null); card.remove(); }; }
  function aplicar() {
    var bt = document.getElementById('lc-ok'), msg = document.getElementById('lc-msg');
    var l = afetados().filter(function (x) { return x.visivel && x.achado; });
    var ov = JSON.parse(JSON.stringify(Store.get(K.OVERRIDES, {}) || {}));
    l.forEach(function (x) {
      var o = ov[x.uid], t = x.t;
      o.plano = t.plano;
      if (!o.grupo && !t.grupo) o.sub = t.sub || '';
    });
    bt.disabled = true; msg.textContent = 'Gravando...';
    gravarLocal({ antes: somas(), n: l.length });
    Store.set(K.OVERRIDES, ov);
    Promise.resolve(Store.sincronizar()).then(function () {
      msg.innerHTML = '&#10003; Gravado. Recarregando para conferir os totais...';
      setTimeout(function () { location.reload(); }, 900);
    });
  }
  if (typeof window.renderDados === 'function') {
    var _rd = window.renderDados;
    window.renderDados = function () { var x = _rd.apply(this, arguments); try { montar(); } catch (e) { console.warn('limpeza-cartao', e); } return x; };
  }
})();
