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
    var cats = [], subs = {}, vazio = null, grupoDe = {};
    [].forEach.call(o.options, function (op) {
      var v = op.value;
      if (v === '__novo__') return;
      if (v === '') { vazio = op.textContent; return; }
      var cp = catParse(v);
      if (cats.indexOf(cp.cat) < 0) cats.push(cp.cat);
      if (op.parentNode && op.parentNode.tagName === 'OPTGROUP') grupoDe[cp.cat] = op.parentNode.label;
      if (cp.sub) (subs[cp.cat] = subs[cp.cat] || []).push(cp.sub);
    });
    return { cats: cats, subs: subs, vazio: vazio, grupoDe: grupoDe };
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
    var opt = function (c) { return '<option value="' + esc(c) + '"' + (c === cp.cat ? ' selected' : '') + '>' + esc(c) + '</option>'; };
    sc.innerHTML = (d.vazio !== null ? '<option value="">' + esc(d.vazio) + '</option>' : '') +
      d.cats.filter(function (c) { return !d.grupoDe[c]; }).map(opt).join('') +
      Object.keys(d.cats.reduce(function (g, c) { if (d.grupoDe[c]) g[d.grupoDe[c]] = 1; return g; }, {})).map(function (lab) {
        return '<optgroup label="' + esc(lab) + '">' + d.cats.filter(function (c) { return d.grupoDe[c] === lab; }).map(opt).join('') + '</optgroup>';
      }).join('') +
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

/* ============================================================
   Ajustes de categoria (2a rodada)
   1  "Despesa conjunta" nao aparece em lista de categoria individual
      (Ana e Manuela); continua so como rotulo automatico do conjunto.
      Se alguem passar um lancamento para INDIVIDUAL e ele estiver com
      "Despesa conjunta", volta para a categoria original (ou Outros) e
      vai para Revisar — so esse lancamento, so quando editado.
   2  Subtipos de transporte na mesma ordem e com os mesmos nomes em
      Carro (Ana) e Transporte (Conjunto); as categorias nao mudam de nome.
   3  Manuela: so a PREVIA da migracao (Uber -> Transporte › Uber/99,
      Terreno deixa de ser categoria). Nada e aplicado ate a aprovacao.
   4  Cravo & Canela no fim da lista, separada ("Negócio"); lancamentos iguais.
   5  Cada lista mostra so as categorias do proprio perfil.
   Tudo vale igual para Ana e Manuela.
   ============================================================ */
(function () {
  'use strict';
  var DC = 'Despesa conjunta', LOJA = (typeof CAT_LOJA !== 'undefined' ? CAT_LOJA : 'Cravo & Canela');
  var IND = ['Ana', 'Manuela'];
  var TRANSP = ['Uber/99', 'Estacionamento', 'Lava jato', 'Manutenção', 'IPVA & Licenciamento', 'Seguro', 'Multas', 'Pedágio'];

  /* 2: Gasolina* primeiro, depois a lista comum na mesma ordem, depois o que cada uma criou */
  function ordenarTransp(a) {
    if (!a || !a.length) return a;
    var gas = a.filter(function (x) { return /^gasolina/i.test(x); });
    var com = TRANSP.filter(function (x) { return a.indexOf(x) >= 0; });
    var resto = a.filter(function (x) { return gas.indexOf(x) < 0 && com.indexOf(x) < 0; });
    return gas.concat(com, resto);
  }
  function ajustar() {
    IND.forEach(function (p) {
      var l = catLista(p); if (!l) return;
      var i = l.indexOf(DC); if (i >= 0) l.splice(i, 1);                 /* 1 */
      var j = l.indexOf(LOJA); if (j >= 0) { l.splice(j, 1); l.push(LOJA); } /* 4: sempre no fim */
    });
    [['Ana', 'Carro'], ['Manuela', 'Carro'], ['NuNa', 'Transporte'], ['Manuela', 'Transporte']].forEach(function (x) {
      var s = CAT_SUBS[x[0]] && CAT_SUBS[x[0]][x[1]]; if (s) CAT_SUBS[x[0]][x[1]] = ordenarTransp(s);
    });
  }
  if (typeof window.catAplicar === 'function') {
    var _ca = window.catAplicar;
    window.catAplicar = function () { var r = _ca.apply(this, arguments); try { ajustar(); } catch (e) { console.warn('categorias/ajuste', e); } return r; };
  }

  /* 1 + 4 + 5: lista de cada perfil, sem "Despesa conjunta" e com Cravo & Canela separada no fim */
  if (typeof window.catOptsHTML === 'function') {
    var _opts = window.catOptsHTML;
    window.catOptsHTML = function (perfil, sel, sub, opts) {
      opts = opts || {};
      if (IND.indexOf(perfil) < 0) return _opts.apply(this, arguments);
      var exOrig = opts.excluir || [], ehLoja = sel === LOJA;
      var o2 = {}; for (var k in opts) o2[k] = opts[k];
      o2.excluir = exOrig.concat([DC, LOJA]);
      if (ehLoja) o2.semExtra = true;
      var h = _opts.call(this, perfil, sel, sub, o2);
      var temLoja = catLista(perfil).indexOf(LOJA) >= 0 || ehLoja;
      if (temLoja && exOrig.indexOf(LOJA) < 0) {
        var subs = catSubs(perfil, LOJA).slice(); if (ehLoja && sub && subs.indexOf(sub) < 0) subs.push(sub);
        var g = '<optgroup label="Negócio">' +
          '<option value="' + esc(LOJA) + '"' + (ehLoja && !sub ? ' selected' : '') + '>' + esc(LOJA) + '</option>' +
          subs.map(function (s) { return '<option value="' + esc(LOJA + CAT_SEP + s) + '"' + (ehLoja && s === sub ? ' selected' : '') + '>' + esc(catRotulo(LOJA, s)) + '</option>'; }).join('') +
          '</optgroup>';
        var n = h.indexOf('<option value="__novo__"');
        h = n >= 0 ? h.slice(0, n) + g + h.slice(n) : h + g;
      }
      return h;
    };
  }

  /* 1: lancamento que vira INDIVIDUAL nao fica com "Despesa conjunta" */
  if (typeof window.applyEdit === 'function') {
    var _ae = window.applyEdit;
    window.applyEdit = function (tr, target) {
      var r = _ae.apply(this, arguments);
      try {
        var t = tr && tr.dataset && findTx(tr.dataset.id);
        if (t && t.divisao === 'INDIVIDUAL' && t.plano === DC) {
          t.plano = (t.planoOrig && t.planoOrig !== DC) ? t.planoOrig : 'Outros'; t.sub = ''; t.revisar = true;
          salvarOverride(t);
          if (typeof flashToast === 'function') flashToast('Individual não usa "Despesa conjunta": ficou em ' + t.plano + ' e foi para Revisar.');
        }
      } catch (e) { console.warn('categorias/dc', e); }
      return r;
    };
  }

  /* 3: PREVIA da migracao da Manuela (so leitura). Cada uma ve so os proprios lancamentos. */
  var MIGRA = { Manuela: { 'Uber': 'Transporte › Uber/99', 'Terreno': '(a definir — tipo Terreno)' } };
  function linhasMigracao(perfil) {
    var regra = MIGRA[perfil] || {}, out = [];
    MONTHS.forEach(function (m) {
      ((DATA.months[m] || {}).transactions || []).forEach(function (t) {
        if (t.perfil !== perfil || t.grupo || !regra[t.plano]) return;
        out.push({ id: t.uid || t.id, mes: m, data: t.data, desc: t.desc, valor: t.valor, atual: t.plano, nova: regra[t.plano], origem: 'fatura' });
      });
    });
    ((typeof AG !== 'undefined' && AG.itens) || []).forEach(function (i) {
      if (i.perfil !== perfil || i.divisao === 'CONJUNTA' || !regra[i.categoria]) return;
      out.push({ id: i.id, mes: (typeof agMesNoDash === 'function' ? agMesNoDash(i.data) : ''), data: i.data, desc: i.desc, valor: i.valor, atual: i.categoria, nova: regra[i.categoria], origem: 'Acabei de gastar' });
    });
    return out;
  }
  function dcIndividuais(perfil) {
    var out = [];
    MONTHS.forEach(function (m) { ((DATA.months[m] || {}).transactions || []).forEach(function (t) {
      if (t.perfil === perfil && t.divisao === 'INDIVIDUAL' && !t.grupo && t.plano === DC) out.push({ id: t.uid || t.id, mes: m, desc: t.desc, valor: t.valor });
    }); });
    return out;
  }
  window.catPreviaMigracao = linhasMigracao;
  function renderPrevia() {
    var pn = document.getElementById('panel-dados'); if (!pn || !DATA) return;
    var box = document.getElementById('cat-previa');
    if (!box) { box = document.createElement('div'); box.id = 'cat-previa'; box.className = 'card'; pn.insertBefore(box, pn.firstChild); }
    var eu = ((window.Auth && Auth.sessao && Auth.sessao()) || {}).perfil;
    var h = '<h2>Categorias — prévia, nada foi aplicado</h2>';
    if (eu !== 'Manuela') {
      h += '<p class="note" style="margin:0 0 10px">A lista de migração da Manuela (Uber → Transporte › Uber/99 e Terreno) só aparece quando <b>a Manuela</b> entra no NuNa — cada uma vê só os próprios lançamentos.</p>';
    } else {
      var l = linhasMigracao('Manuela');
      h += '<p class="note" style="margin:0 0 10px"><b>' + l.length + '</b> lançamentos seriam migrados. Nada muda até a aprovação.</p>' +
        '<div class="scroll"><table><thead><tr><th>id</th><th>Mês</th><th>Data</th><th>Descrição</th><th class="num">Valor</th><th>Categoria atual</th><th>Categoria nova</th><th>Origem</th></tr></thead><tbody>' +
        l.map(function (x) { return '<tr><td style="font-size:11px">' + esc(x.id) + '</td><td>' + esc(x.mes) + '</td><td>' + esc(x.data) + '</td><td>' + esc(x.desc) + '</td><td class="num">' + brl(+x.valor || 0) + '</td><td>' + esc(x.atual) + '</td><td>' + esc(x.nova) + '</td><td>' + esc(x.origem) + '</td></tr>'; }).join('') +
        '</tbody></table></div><button class="pill" id="cat-previa-copiar" style="margin-top:10px">Copiar lista</button>';
    }
    if (eu) {
      var dc = dcIndividuais(eu);
      h += '<p class="note" style="margin:12px 0 0">Verificação: <b>' + dc.length + '</b> lançamento(s) individual(is) de ' + esc(eu) + ' com "Despesa conjunta"' +
        (dc.length ? ': ' + dc.map(function (x) { return esc(x.mes + ' · ' + x.desc + ' · ' + brl(+x.valor || 0)); }).join('; ') + '. Corrija pelo Revisar ou Transações.' : ' ✓') + '</p>';
    }
    box.innerHTML = h;
    var b = document.getElementById('cat-previa-copiar');
    if (b) b.onclick = function () {
      var txt = ['id\tmês\tdata\tdescrição\tvalor\tcategoria atual\tcategoria nova\torigem'].concat(linhasMigracao('Manuela').map(function (x) {
        return [x.id, x.mes, x.data, x.desc, String(x.valor).replace('.', ','), x.atual, x.nova, x.origem].join('\t'); })).join('\n');
      (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(function () { flashToast('Lista copiada.'); }, function () { flashToast('Não consegui copiar; tire um print.'); });
    };
  }
  if (typeof window.renderDados === 'function') {
    var _rd = window.renderDados;
    window.renderDados = function () { var r = _rd.apply(this, arguments); try { renderPrevia(); } catch (e) { console.warn('categorias/previa', e); } return r; };
  }
})();
