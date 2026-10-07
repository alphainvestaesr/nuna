/* ============================================================
   NuNa · categorias-fluxo.js — organizacao das categorias (aprovada)
   C1  Ana: "Casa da mamãe (Quilombo)" passa a ser Mamãe › Casa (Quilombo)
   C2  Ana e Manuela: "Vestuário" passa a ser Compras pessoais › Vestuário
   D2  Carro (Ana) e Transporte (Conjunto) com a mesma lista de subtipos
   T1  lista de Tipo agrupada por familia (so exibicao)
   S1  categoria e subtipo em dois campos: o subtipo mostra so os da
       categoria escolhida, com "+ Novo subtipo…"
   D1  lancamento conjunto nao pede categoria individual
   Seguranca:
   - a troca de nomes (C1/C2) e feita so na memoria do aparelho, ao carregar,
     e so nos lancamentos do proprio perfil; nada e regravado em lote no banco.
   - subtipo novo entra so no catalogo do perfil daquele lancamento.
   - nada sai do aparelho alem do que o app ja grava.
   ============================================================ */
(function () {
  'use strict';
  var REMAP = {
    Ana: { 'Casa da mamãe (Quilombo)': ['Mamãe', 'Casa (Quilombo)'], 'Vestuário': ['Compras pessoais', 'Vestuário'] },
    Manuela: { 'Vestuário': ['Compras pessoais', 'Vestuário'] }
  };
  var SUBS_NOVOS = {
    Ana: { 'Mamãe': ['Casa (Quilombo)', 'Cartão da mamãe', 'Outros'], 'Compras pessoais': ['Vestuário'], 'Carro': ['Uber/99'] },
    Manuela: { 'Compras pessoais': ['Vestuário'] },
    NuNa: { 'Transporte': ['IPVA & Licenciamento', 'Seguro', 'Multas', 'Pedágio'] }
  };
  function remapDe(perfil, cat) { var r = REMAP[perfil]; return r && r[cat]; }
  window.catRemapDe = remapDe;

  function ajustarCatalogo() {
    ['Ana', 'Manuela', 'NuNa'].forEach(function (p) {
      var lista = catLista(p); if (!lista) return;
      var r = REMAP[p] || {};
      Object.keys(r).forEach(function (velha) {
        var i = lista.indexOf(velha); if (i >= 0) lista.splice(i, 1);
        var nova = r[velha][0];
        if (lista.indexOf(nova) < 0) { var o = lista.indexOf('Outros'); if (o >= 0) lista.splice(o, 0, nova); else lista.push(nova); }
      });
      var sn = SUBS_NOVOS[p] || {};
      Object.keys(sn).forEach(function (c) {
        if (lista.indexOf(c) < 0) return; /* so onde a categoria existe */
        var a = CAT_SUBS[p][c] = CAT_SUBS[p][c] || [];
        sn[c].forEach(function (s) { if (a.indexOf(s) < 0) a.push(s); });
      });
    });
  }
  function ajustarLancamentos() {
    if (!DATA || !MONTHS) return;
    MONTHS.forEach(function (m) {
      ((DATA.months[m] || {}).transactions || []).forEach(function (t) {
        var r = remapDe(t.perfil, t.plano); if (!r) return;
        t.plano = r[0]; if (!t.grupo && !t.sub) t.sub = r[1];
      });
    });
    /* meta do orcamento: a antiga soma na nova e fica zerada (nao conta duas vezes ao salvar) */
    Object.keys(REMAP).forEach(function (p) {
      var B = DATA.budgets && DATA.budgets[p]; if (!B) return;
      Object.keys(REMAP[p]).forEach(function (velha) {
        var v = +B[velha] || 0; if (!v) return;
        var nova = REMAP[p][velha][0];
        B[nova] = (+B[nova] || 0) + v; B[velha] = 0;
      });
    });
  }
  if (typeof window.catAplicar === 'function') {
    var _ca = window.catAplicar;
    window.catAplicar = function () {
      var r = _ca.apply(this, arguments);
      try { ajustarCatalogo(); ajustarLancamentos(); ajustarGastos(); } catch (e) { console.warn('categorias/fluxo', e); }
      return r;
    };
  }
  /* gastos do ACABEI DE GASTAR: a categoria antiga passa a valer como a nova
     em toda a tela (relatorio do Agente, tabela Hoje, parcelas futuras).
     So na memoria e so os individuais de cada perfil; o conjunto nao muda. */
  function ajustarGastos() {
    if (typeof AG === 'undefined' || !AG.itens) return;
    AG.itens.forEach(function (i) {
      if (i.divisao === 'CONJUNTA') return;
      var r = remapDe(i.perfil, i.categoria); if (!r) return;
      i.categoria = r[0]; if (!i.sub) i.sub = r[1];
    });
  }
  window.catAjustarGastos = ajustarGastos;
  ['agInit', 'agRenderAll', 'parcProjetar'].forEach(function (nome) {
    var f = window[nome]; if (typeof f !== 'function') return;
    window[nome] = function () { try { ajustarGastos(); } catch (e) {} var r = f.apply(this, arguments); try { ajustarGastos(); } catch (e) {} return r; };
  });
  /* gastos do ACABEI DE GASTAR com categoria antiga aparecem com a nova */
  if (typeof window.agTxDeItem === 'function') {
    var _tx = window.agTxDeItem;
    window.agTxDeItem = function () {
      var t = _tx.apply(this, arguments);
      try { var r = !t.grupo && remapDe(t.perfil, t.plano); if (r) { t.plano = t.tipo = r[0]; if (!t.sub) t.sub = r[1]; } } catch (e) {}
      return t;
    };
  }

  /* ---------- T1: Tipo agrupado ---------- */
  function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim(); }
  var FAMILIAS = [
    ['Moradia e contas da casa', ['aluguel+agua', 'aluguel + agua', 'energia', 'saae', 'agua mineral', 'casa e moveis', 'material de construcao', 'terreno', 'lavanderia']],
    ['Alimentação', ['supermercado', 'alimentacao fora', 'kitanda']],
    ['Transporte', ['gasolina', 'estacionamento', 'uber', 'carro (seguro)']],
    ['Saúde e bem-estar', ['saude', 'gympass']],
    ['Pets', ['pets']],
    ['Assinaturas e serviços', ['assinaturas', 'streaming', 'conta telefonica']],
    ['Compras e viagem', ['compras', 'viagem']],
    ['Dívidas e encargos', ['divida', 'emprestimo consignado', 'boletos 99pay', 'imposto de renda']],
    ['Previdência e entidades', ['funaprev', 'sinpol']],
    ['Família e transferências', ['cartao de mamae', 'transferencia a pessoas', 'contribuicao nuna']]
  ];
  function familia(t) {
    var n = norm(t);
    for (var i = 0; i < FAMILIAS.length; i++) {
      if (FAMILIAS[i][1].some(function (k) { return n === k || n.indexOf(k) === 0; })) return FAMILIAS[i][0];
    }
    return 'Outros';
  }
  window.tipoOpts = function (sel) {
    var l = TIPOS.indexOf(sel) < 0 && sel ? TIPOS.concat([sel]) : TIPOS.slice(), g = {}, ordem = FAMILIAS.map(function (f) { return f[0]; }).concat(['Outros']);
    l.forEach(function (c) { var f = familia(c); (g[f] = g[f] || []).push(c); });
    return ordem.filter(function (f) { return g[f]; }).map(function (f) {
      return '<optgroup label="' + esc(f) + '">' + g[f].map(function (c) {
        return '<option value="' + esc(c) + '"' + (c === sel ? ' selected' : '') + '>' + esc(c) + '</option>';
      }).join('') + '</optgroup>';
    }).join('');
  };

  /* ---------- S1 + D1: categoria e subtipo em dois campos ---------- */
  var ALVO = 'select.c-plano, select.c-grupo, select#ag-cat';
  function perfilDe(o) { return o.dataset.perfil || (o.classList.contains('c-grupo') ? 'NuNa' : (state.perfil === 'NuNa' ? 'NuNa' : state.perfil)); }
  function linhaConjunta(o) {
    if (!o.classList.contains('c-plano')) return false;
    var row = o.closest('tr, .mr-it'), dv = row && row.querySelector('.c-dv');
    return !!(dv && dv.value === 'CONJUNTA');
  }
  function assinatura(o) { return o.options.length + '|' + o.value + '|' + o.disabled + '|' + linhaConjunta(o); }
  function opcoes(o) {
    var cats = [], subs = {}, vazio = null;
    [].forEach.call(o.options, function (op) {
      var v = op.value;
      if (v === '__novo__') return;
      if (v === '') { vazio = op.textContent; return; }
      var cp = catParse(v);
      if (cats.indexOf(cp.cat) < 0) cats.push(cp.cat);
      if (cp.sub) (subs[cp.cat] = subs[cp.cat] || []).push(cp.sub);
    });
    return { cats: cats, subs: subs, vazio: vazio };
  }
  function definir(o, valor) {
    if (![].some.call(o.options, function (op) { return op.value === valor; })) {
      var op = document.createElement('option'); op.value = valor; op.textContent = valor; o.appendChild(op);
    }
    o.value = valor;
    o.dispatchEvent(new Event('change', { bubbles: true }));
  }
  function montarPar(o) {
    var par = o.nextElementSibling && o.nextElementSibling.classList.contains('cpar') ? o.nextElementSibling : null;
    if (!par) {
      par = document.createElement('span'); par.className = 'cpar';
      par.innerHTML = '<select class="cpar-cat" aria-label="Categoria"></select><select class="cpar-sub" aria-label="Subtipo"></select><span class="cpar-cj">Despesa conjunta (automático)</span>';
      o.after(par); o.classList.add('cpar-orig');
      par.querySelector('.cpar-cat').addEventListener('change', function () {
        var v = this.value;
        if (v === '__novoCat') { definir(o, '__novo__'); return; }
        definir(o, v);
      });
      par.querySelector('.cpar-sub').addEventListener('change', function () {
        var cat = catParse(o.value).cat, v = this.value;
        if (v === '__novoSub') {
          var nome = window.prompt('Novo subtipo em "' + cat + '" (só no perfil ' + (perfilDe(o) === 'NuNa' ? 'Conjunto' : perfilDe(o)) + '):', '');
          var r = nome ? catAdicionar(perfilDe(o), cat + ' > ' + nome) : null;
          if (!r) { atualizar(o, true); return; }
          if (o.id === 'ag-cat' && typeof agFillCat === 'function') agFillCat(r.cat, r.sub);
          else o.innerHTML = catOptsHTML(perfilDe(o), r.cat, r.sub, { novo: true, vazio: o.dataset.vazio === '1' });
          if (typeof flashToast === 'function') flashToast('Subtipo criado: ' + r.cat + ' › ' + r.sub);
          definir(o, r.cat + CAT_SEP + r.sub);
          return;
        }
        definir(o, v ? cat + CAT_SEP + v : cat);
      });
    }
    return par;
  }
  function atualizar(o, forcar) {
    var sig = assinatura(o);
    if (!forcar && o.dataset.cparSig === sig) return;
    o.dataset.cparSig = sig;
    var par = montarPar(o), sc = par.querySelector('.cpar-cat'), ss = par.querySelector('.cpar-sub');
    var d = opcoes(o), cp = catParse(o.value), conj = linhaConjunta(o);
    sc.innerHTML = (d.vazio !== null ? '<option value="">' + esc(d.vazio) + '</option>' : '') +
      d.cats.map(function (c) { return '<option value="' + esc(c) + '"' + (c === cp.cat ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('') +
      ([].some.call(o.options, function (op) { return op.value === '__novo__'; }) ? '<option value="__novoCat">+ Nova categoria…</option>' : '');
    sc.value = cp.cat || '';
    var subs = d.subs[cp.cat] || [];
    ss.innerHTML = '<option value="">' + 'sem subtipo' + '</option>' +
      subs.map(function (s) { return '<option value="' + esc(s) + '"' + (s === cp.sub ? ' selected' : '') + '>' + esc(s) + '</option>'; }).join('') +
      '<option value="__novoSub">+ Novo subtipo…</option>';
    ss.value = cp.sub || '';
    sc.disabled = ss.disabled = o.disabled;
    par.classList.toggle('cpar-semsub', !cp.cat || o.disabled);
    par.classList.toggle('cpar-conj', conj);
  }
  var agendado = false;
  function varrer() {
    agendado = false;
    [].forEach.call(document.querySelectorAll(ALVO), function (o) { try { atualizar(o); } catch (e) { console.warn('cpar', e); } });
  }
  function agendar() { if (!agendado) { agendado = true; requestAnimationFrame(varrer); } }
  function ligar() {
    varrer();
    if (window.MutationObserver) new MutationObserver(agendar).observe(document.body, { childList: true, subtree: true });
    document.addEventListener('change', function (e) { if (e.target.matches && (e.target.matches(ALVO) || e.target.classList.contains('c-dv') || e.target.id === 'ag-div')) agendar(); }, true);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ligar); else ligar();

  var st = document.createElement('style');
  st.textContent =
    'select.cpar-orig{display:none!important}' +
    '.cpar{display:flex;flex-direction:column;gap:4px;min-width:0}' +
    '.cpar select{width:100%;min-width:0}' +
    '.cpar.cpar-semsub .cpar-sub{display:none}' +
    '.cpar .cpar-cj{display:none;font-size:12px;color:var(--tx3);font-style:italic}' +
    '.cpar.cpar-conj select{display:none}.cpar.cpar-conj .cpar-cj{display:block}' +
    '#tx-table .cpar select,#rev-table .cpar select{min-width:150px}';
  document.head.appendChild(st);
})();
