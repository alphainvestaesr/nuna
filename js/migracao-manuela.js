/* ============================================================
   NuNa · migracao-manuela.js — categorias da Manuela (aprovada pela Ana)
   a) "Uber"    -> "Transporte › Uber/99"  (tipo continua "Uber / transporte")
   b) "Terreno" -> "Patrimônio"            (tipo "Terreno" continua existindo)
   Fluxo: a aba Dados mostra a lista (id, mes, plano atual, plano novo, valor);
   nada e gravado ate o OK. No OK grava a base, os importados, os ajustes,
   o orcamento e o Acabei de Gastar; depois de recarregar, compara a soma de
   cada mes da Manuela com a de antes.
   "Patrimônio" e "Transporte" entram so na lista individual da Manuela.
   ============================================================ */
var MigManuela = (function () {
  var P = 'Manuela';
  var REGRA = { 'Uber': { cat: 'Transporte', sub: 'Uber/99' }, 'Terreno': { cat: 'Patrimônio', sub: '' } };
  var VELHAS = Object.keys(REGRA);
  var CHAVE_LOCAL = 'nuna.v1.migManuela';
  function clone(v) { return v == null ? v : JSON.parse(JSON.stringify(v)); }
  function rotulo(c, s) { return s ? c + ' › ' + s : c; }
  /* sub novo: Uber ganha Uber/99; em lancamento conjunto o sub e do grupo e nao muda */
  function subNovo(velha, grupo, subAtual) { return grupo ? subAtual : (REGRA[velha].sub || subAtual || ''); }

  /* insere antes de "Outros", como o resto do catalogo */
  function inserir(lista, c) {
    if (lista.indexOf(c) >= 0) return;
    var o = lista.indexOf('Outros'); if (o >= 0) lista.splice(o, 0, c); else lista.push(c);
  }
  function tirar(lista, c) { var i = lista.indexOf(c); if (i >= 0) lista.splice(i, 1); }

  /* migra a meta: a velha soma na nova e sai da lista */
  function migrarMetas(B) {
    var out = [];
    if (!B) return out;
    VELHAS.forEach(function (v) {
      if (!(v in B)) return;
      var nova = REGRA[v].cat, val = +B[v] || 0;
      out.push({ velha: v, nova: nova, valor: val, antesNova: +B[nova] || 0 });
      B[nova] = (+B[nova] || 0) + val;
      delete B[v];
    });
    return out;
  }

  /* ---------- o que muda (lido dos dados ja carregados) ---------- */
  function lancamentos(dados) {
    var out = [];
    dados.monthOrder.forEach(function (m) {
      ((dados.months[m] || {}).transactions || []).forEach(function (t) {
        if (t.perfil !== P || t.previsto || t.manual || !REGRA[t.plano]) return;
        var r = REGRA[t.plano];
        out.push({ uid: t.uid, mes: m, data: t.data, desc: t.desc, valor: t.valor, tipo: t.tipo, status: t.status || '',
                   grupo: t.grupo || null, atual: rotulo(t.plano, t.grupo ? '' : t.sub), velha: t.plano,
                   novaCat: r.cat, novaSub: subNovo(t.plano, t.grupo, t.sub), origem: 'fatura' });
      });
    });
    return out;
  }
  function gastos(itens) {
    return (itens || []).filter(function (i) { return i.perfil === P && i.divisao !== 'CONJUNTA' && REGRA[i.categoria]; })
      .map(function (i) {
        return { uid: i.id, mes: i.data, data: i.data, desc: i.desc, valor: i.valor, tipo: '', status: i.status || '',
                 atual: rotulo(i.categoria, i.sub), velha: i.categoria, novaCat: REGRA[i.categoria].cat,
                 novaSub: REGRA[i.categoria].sub || i.sub || '', origem: 'Acabei de gastar' };
      });
  }

  /* ---------- aplica nas copias guardadas (puro: devolve copias novas) ---------- */
  function aplicarEm(g, lista) {
    var por = {}; lista.forEach(function (x) { if (x.origem === 'fatura') por[x.uid] = x; });
    var r = { base: clone(g.base), importados: clone(g.importados || []), overrides: clone(g.overrides || {}),
              orcamentos: clone(g.orcamentos), gastei: clone(g.gastei || []), metas: [] };
    function ajusta(t) {
      var x = por[t.uid]; if (!x || t.perfil !== P) return 0;
      t.plano = x.novaCat; if (!t.grupo) t.sub = x.novaSub;
      return 1;
    }
    var n = 0;
    r.base.monthOrder.forEach(function (m) { ((r.base.months[m] || {}).transactions || []).forEach(function (t) { n += ajusta(t); }); });
    r.importados.forEach(function (t) { n += ajusta(t); });
    /* ajustes guardados por id */
    Object.keys(por).forEach(function (u) {
      var o = r.overrides[u]; if (!o || o.plano === undefined) return;
      o.plano = por[u].novaCat; if (!o.grupo) o.sub = por[u].novaSub;
    });
    /* qualquer outro ajuste da Manuela que ainda aponte para o plano velho */
    var donos = {};
    r.base.monthOrder.forEach(function (m) { ((r.base.months[m] || {}).transactions || []).forEach(function (t) { donos[t.uid] = t.perfil; }); });
    r.importados.forEach(function (t) { donos[t.uid] = t.perfil; });
    Object.keys(r.overrides).forEach(function (u) {
      var o = r.overrides[u]; if (donos[u] !== P || !o || !REGRA[o.plano]) return;
      var v = o.plano; o.plano = REGRA[v].cat; if (!o.grupo) o.sub = REGRA[v].sub || o.sub || '';
    });
    /* catalogo: Transporte e Patrimonio so na lista da Manuela; Uber e Terreno saem */
    var cats = r.base.catsPlano && r.base.catsPlano[P];
    if (cats) { VELHAS.forEach(function (v) { tirar(cats, v); }); inserir(cats, 'Transporte'); inserir(cats, 'Patrimônio'); }
    var cat = r.overrides[CAT_UID_MIG] = r.overrides[CAT_UID_MIG] || { cats: {}, subs: {}, cores: {} };
    cat.cats = cat.cats || {}; cat.subs = cat.subs || {};
    if (cat.cats[P]) cat.cats[P] = cat.cats[P].filter(function (c) { return !REGRA[c]; });
    var subs = cat.subs[P] = cat.subs[P] || {};
    subs.Transporte = (subs.Transporte || []).concat(subs.Uber || []);
    if (subs.Transporte.indexOf('Uber/99') < 0) subs.Transporte.push('Uber/99');
    if (subs.Terreno && subs.Terreno.length) subs['Patrimônio'] = (subs['Patrimônio'] || []).concat(subs.Terreno);
    delete subs.Uber; delete subs.Terreno;
    /* orcamento: base e o que foi gravado pela tela */
    if (r.base.budgets) r.metas = migrarMetas(r.base.budgets[P]);
    if (r.orcamentos && r.orcamentos[P]) { var m2 = migrarMetas(r.orcamentos[P]); if (m2.length) r.metas = m2; }
    /* Acabei de Gastar */
    r.gastei.forEach(function (i) {
      if (i.perfil !== P || i.divisao === 'CONJUNTA' || !REGRA[i.categoria]) return;
      var v = i.categoria; i.categoria = REGRA[v].cat; i.sub = REGRA[v].sub || i.sub || '';
    });
    r.registros = n;
    return r;
  }
  var CAT_UID_MIG = '__catalogo__';

  /* ---------- somas por mes (para conferir depois) ---------- */
  function somasMes() {
    var o = {};
    MONTHS.forEach(function (m) {
      o[m] = ['Manuela', 'Ana', 'NuNa'].map(function (p) { return Math.round(gastoOf(m, p) * 100) + '/' + Math.round(saldoOf(m, p) * 100); }).join('|');
    });
    return o;
  }
  function lerLocal() { try { return JSON.parse(localStorage.getItem(CHAVE_LOCAL) || 'null'); } catch (e) { return null; } }
  function gravarLocal(v) { try { if (v) localStorage.setItem(CHAVE_LOCAL, JSON.stringify(v)); else localStorage.removeItem(CHAVE_LOCAL); } catch (e) {} }

  /* ---------- aba Dados ---------- */
  function listaAtual() {
    return lancamentos(DATA).concat(gastos(Store.get(K.GASTEI, [])));
  }
  function pendente() {
    if (!DATA || !Store.base()) return false;
    var cats = (Store.base().catsPlano || {})[P] || [];
    return listaAtual().length > 0 || VELHAS.some(function (v) { return cats.indexOf(v) >= 0; });
  }
  function tabela(l) {
    return '<div class="scroll"><table><thead><tr><th>id</th><th>M&ecirc;s</th><th>Data</th><th>Descri&ccedil;&atilde;o</th><th>Plano atual</th><th>Plano novo</th><th>Tipo (n&atilde;o muda)</th><th class="num">Valor</th></tr></thead><tbody>' +
      l.map(function (x) {
        return '<tr><td class="mono" style="font-size:11px">' + esc(x.uid) + '</td><td>' + esc(x.mes) + '</td><td>' + esc(x.data || '') + '</td>' +
          '<td>' + esc(x.desc || '') + (x.origem !== 'fatura' ? ' <span class="badge b-cj">' + esc(x.origem) + '</span>' : '') + (x.grupo ? ' <span class="badge b-cj">conjunto</span>' : '') + '</td>' +
          '<td>' + esc(x.atual) + '</td><td><b>' + esc(rotulo(x.novaCat, x.novaSub)) + '</b></td><td>' + esc(x.tipo || '—') + '</td><td class="num">' + brl(+x.valor || 0) + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }
  function montar() {
    var painel = document.getElementById('panel-dados');
    if (!painel || !DATA || !Store.base()) return;
    var card = document.getElementById('mm-card'), feito = lerLocal();
    if (!pendente() && !feito) { if (card) card.remove(); return; }
    if (!card) {
      card = document.createElement('div'); card.className = 'card'; card.id = 'mm-card';
      var ref = document.getElementById('ib-card');
      painel.insertBefore(card, ref ? ref.nextSibling : painel.firstChild);
    }
    if (feito && !pendente()) { card.innerHTML = conferencia(feito); var f = document.getElementById('mm-fechar'); if (f) f.onclick = function () { gravarLocal(null); card.remove(); }; return; }
    var l = listaAtual(), cont = {};
    l.forEach(function (x) { cont[x.velha] = (cont[x.velha] || 0) + 1; });
    /* cada uma ve so os proprios lancamentos: a lista e o OK ficam com a Manuela */
    var eu = ((window.Auth && Auth.sessao && Auth.sessao()) || {}).perfil;
    if (eu !== P) {
      card.innerHTML = '<h2>Categorias da Manuela &mdash; migra&ccedil;&atilde;o aguardando a Manuela</h2>' +
        '<p class="note">Uber &rarr; Transporte &rsaquo; Uber/99 (' + (cont.Uber || 0) + ' lan&ccedil;amentos) &middot; Terreno &rarr; Patrim&ocirc;nio (' + (cont.Terreno || 0) + '). ' +
        'A lista com os lan&ccedil;amentos e o bot&atilde;o de aplicar aparecem quando <b>a Manuela</b> entra no NuNa &mdash; cada uma v&ecirc; s&oacute; os pr&oacute;prios lan&ccedil;amentos.</p>';
      return;
    }
    var B = (DATA.budgets || {})[P] || {};
    var metas = VELHAS.filter(function (v) { return +B[v]; }).map(function (v) {
      return esc(v) + ' ' + brl(+B[v]) + ' &rarr; ' + esc(REGRA[v].cat) + (+B[REGRA[v].cat] ? ' (somado aos ' + brl(+B[REGRA[v].cat]) + ' que ' + esc(REGRA[v].cat) + ' j&aacute; tem)' : '');
    });
    card.innerHTML = '<h2>Categorias da Manuela &mdash; migra&ccedil;&atilde;o aguardando OK</h2>' +
      '<p class="note">Uber &rarr; <b>Transporte &rsaquo; Uber/99</b> (' + (cont.Uber || 0) + ') &middot; Terreno &rarr; <b>Patrim&ocirc;nio</b> (' + (cont.Terreno || 0) + '). ' +
      'Valor, data, tipo e status n&atilde;o mudam. &quot;Transporte&quot; e &quot;Patrim&ocirc;nio&quot; entram s&oacute; na lista da Manuela; &quot;Uber&quot; e &quot;Terreno&quot; saem da lista de categorias dela (o tipo &quot;Terreno&quot; continua).</p>' +
      tabela(l) +
      '<p class="note" style="margin-top:10px"><b>Or&ccedil;amento da Manuela:</b> ' + (metas.length ? metas.join(' &middot; ') : 'nenhuma meta em Uber ou Terreno') + '.</p>' +
      '<button class="btn" id="mm-ok">Aplicar a migra&ccedil;&atilde;o</button> <span class="note" id="mm-msg"></span>';
    document.getElementById('mm-ok').onclick = aplicar;
  }
  function conferencia(f) {
    var agora = somasMes(), ok = true, linhas = Object.keys(f.antes).map(function (m) {
      var a = f.antes[m].split('|')[0].split('/'), d = (agora[m] || '').split('|')[0].split('/');
      var igual = agora[m] === f.antes[m]; if (!igual) ok = false;
      return '<tr><td>' + esc(m) + '</td><td class="num">' + brl(a[0] / 100) + '</td><td class="num">' + (d[0] ? brl(d[0] / 100) : '—') + '</td><td>' + (igual ? '&#10003;' : '<b>diferente</b>') + '</td></tr>';
    }).join('');
    var sobrou = listaAtual().length;
    return '<h2>Categorias da Manuela &mdash; migra&ccedil;&atilde;o aplicada</h2>' +
      '<p class="note">' + f.n + ' lan&ccedil;amentos migrados. Soma por m&ecirc;s da Manuela antes e depois' +
      ' (gasto e saldo de Manuela, Ana e conjunto conferidos): <b>' + (ok && !sobrou ? 'id&ecirc;nticas' : 'CONFERIR') + '</b>' +
      (sobrou ? ' &middot; ainda h&aacute; ' + sobrou + ' lan&ccedil;amento(s) em Uber/Terreno' : '') + '.</p>' +
      '<div class="scroll"><table><thead><tr><th>M&ecirc;s</th><th class="num">Manuela antes</th><th class="num">Manuela depois</th><th></th></tr></thead><tbody>' + linhas + '</tbody></table></div>' +
      '<button class="pill" id="mm-fechar">Fechar</button>';
  }
  function aplicar() {
    var msg = document.getElementById('mm-msg'), bt = document.getElementById('mm-ok');
    var l = listaAtual(); bt.disabled = true; msg.textContent = 'Gravando...';
    var r = aplicarEm({ base: Store.base(), importados: Store.get(K.IMPORTADOS, []), overrides: Store.get(K.OVERRIDES, {}),
                        orcamentos: Store.get(K.ORCAMENTOS, null), gastei: Store.get(K.GASTEI, []) }, l);
    gravarLocal({ antes: somasMes(), n: l.length, em: new Date().toISOString() });
    Store.set(K.IMPORTADOS, r.importados);
    Store.set(K.OVERRIDES, r.overrides);
    if (r.orcamentos) Store.set(K.ORCAMENTOS, r.orcamentos);
    Store.set(K.GASTEI, r.gastei);
    Promise.resolve(Store.definirBase(r.base)).then(function () {
      msg.innerHTML = '&#10003; Gravado. Recarregando para conferir as somas...';
      setTimeout(function () { location.reload(); }, 900);
    }).catch(function (e) { gravarLocal(null); msg.textContent = 'Nao consegui gravar: ' + (e && e.message || e); bt.disabled = false; });
  }

  if (typeof document !== 'undefined' && typeof window !== 'undefined' && typeof window.renderDados === 'function') {
    var _rd = window.renderDados;
    window.renderDados = function () { var x = _rd.apply(this, arguments); try { montar(); } catch (e) { console.warn('migracao-manuela', e); } return x; };
  }
  return { REGRA: REGRA, lancamentos: lancamentos, gastos: gastos, aplicarEm: aplicarEm, montar: montar };
})();
