/* ============================================================
   NuNa · categorias.js
   - Catalogo de categorias por perfil (Ana, Manuela, Conjunto),
     com subcategorias ("Carro › Gasolina/Uber").
   - Nova categoria/subcategoria direto no seletor ("+ Nova categoria…"),
     so no perfil de quem cria, com cor automatica diferente das demais
     (azul e roxo ficam reservados para Ana e Manuela).
   - Cartao nao e categoria: o que estava em "Bradesco"/"Inter" vai para
     a categoria do que foi comprado; a fonte continua na coluna Fonte.
   - Parcelas futuras das faturas importadas entram nos seus meses,
     mesmo que o mes ainda nao exista no sistema.
   - Detalhe "o que comprou" do ACABEI DE GASTAR: aparece ao passar o
     mouse ou ao tocar na descricao.
   O catalogo personalizado fica gravado no banco, junto das edicoes
   (tabela overrides, chave __catalogo__), e aparece nos dois aparelhos.
   ============================================================ */
var CAT_UID = '__catalogo__';
var CAT_SEP = '||';

/* categorias que passam a existir para todas (alem das que ja vem da base) */
var CAT_GERAIS = ['Mercado', 'Casa & Utilidades', 'Pets', 'Lazer & Viagem', 'Educação',
  'Cuidados pessoais', 'Vestuário', 'Presentes & Doações', 'Tarifas & Impostos'];
var CAT_BASE_EXTRA = {
  Ana: { add: ['Carro'].concat(CAT_GERAIS), subs: {
    'Carro': ['Gasolina/Uber', 'Gasolina/Trabalho', 'Lava jato', 'Estacionamento', 'Manutenção',
              'IPVA & Licenciamento', 'Seguro', 'Multas', 'Pedágio'] } },
  Manuela: { add: CAT_GERAIS.slice(), subs: {} },
  NuNa: { add: [], subs: {
    'Transporte': ['Gasolina/Casal', 'Lava jato', 'Estacionamento', 'Manutenção', 'Uber/99'] } }
};
/* cartao usado como categoria (catch-all) -> categoria pelo tipo de gasto */
var CAT_CATCHALL = { 'Bradesco': 1, 'Inter': 1, 'Cartao Bradesco': 1, 'Cartão Bradesco': 1 };
var CAT_POR_TIPO = {
  'Supermercado': ['Mercado'], 'Kitanda': ['Mercado'], 'Água mineral (galão)': ['Mercado'],
  'Gasolina': ['Carro'], 'Estacionamento': ['Carro', 'Estacionamento'], 'Carro (seguro)': ['Carro', 'Seguro'],
  'Material de construcao': ['Casa & Utilidades'], 'Casa e moveis': ['Casa & Utilidades'], 'Lavanderia': ['Casa & Utilidades'],
  'Pets': ['Pets'], 'Streaming': ['Assinaturas'], 'Assinaturas': ['Assinaturas'], 'Gympass': ['Saúde & Bem-estar'],
  'Saude': ['Saúde & Bem-estar'], 'Alimentacao Fora': ['Comer fora'], 'Viagem': ['Lazer & Viagem'],
  'Compras': ['Compras pessoais'], 'Uber / transporte': ['Uber'], 'Boletos 99Pay': ['Boletos 99Pay'],
  'Divida (juros e encargos)': ['Dívidas & Crédito'], 'Transferencia a pessoas': ['Transferências'],
  'Conta telefonica': ['Conta telefonica'], 'Terreno': ['Terreno']
};

var CAT_SUBS = { Ana: {}, Manuela: {}, NuNa: {} };
var CAT_CORES = {};

function catParse(v) {
  v = String(v == null ? '' : v);
  var i = v.indexOf(CAT_SEP);
  return i < 0 ? { cat: v, sub: '' } : { cat: v.slice(0, i), sub: v.slice(i + CAT_SEP.length) };
}
function catLista(perfil) {
  if (perfil === 'NuNa') return GRUPOS;
  return CATS[perfil] || CATS.Ana || [];
}
function catSubs(perfil, cat) { return ((CAT_SUBS[perfil] || {})[cat]) || []; }
function catRotulo(cat, sub) { return sub ? cat + ' › ' + sub : cat; }

/* <option>s de um seletor de categoria. opts: novo, vazio, excluir[], semExtra */
function catOptsHTML(perfil, sel, sub, opts) {
  opts = opts || {}; sub = sub || '';
  var ex = opts.excluir || [];
  var lista = catLista(perfil).filter(function (c) { return ex.indexOf(c) < 0; });
  if (sel && lista.indexOf(sel) < 0 && !opts.semExtra) lista = lista.concat([sel]);
  var h = opts.vazio ? '<option value="">&mdash; individual</option>' : '';
  lista.forEach(function (c) {
    h += '<option value="' + esc(c) + '"' + (c === sel && !sub ? ' selected' : '') + '>' + esc(c) + '</option>';
    var subs = catSubs(perfil, c).slice();
    if (c === sel && sub && subs.indexOf(sub) < 0) subs.push(sub);
    subs.forEach(function (s) {
      h += '<option value="' + esc(c + CAT_SEP + s) + '"' + (c === sel && s === sub ? ' selected' : '') + '>' + esc(catRotulo(c, s)) + '</option>';
    });
  });
  if (opts.novo) h += '<option value="__novo__">+ Nova categoria&hellip;</option>';
  return h;
}

/* ---------- cores automaticas ---------- */
function catHex(h, s, l) {
  s /= 100; l /= 100;
  var k = function (n) { return (n + h / 30) % 12; }, a = s * Math.min(l, 1 - l);
  var f = function (n) { return Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))))); };
  return '#' + [f(0), f(8), f(4)].map(function (x) { return ('0' + x.toString(16)).slice(-2); }).join('');
}
function catRGB(hex) { var n = parseInt(String(hex).slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function catDist(a, b) {
  var x = catRGB(a), y = catRGB(b), r = (x[0] + y[0]) / 2;
  var dr = x[0] - y[0], dg = x[1] - y[1], db = x[2] - y[2];
  return Math.sqrt((2 + r / 256) * dr * dr + 4 * dg * dg + (2 + (255 - r) / 256) * db * db);
}
function catCoresUsadas() {
  var u = [];
  if (typeof CORES_FIXAS !== 'undefined') Object.keys(CORES_FIXAS).forEach(function (k) { u.push(CORES_FIXAS[k]); });
  Object.keys(CAT_CORES).forEach(function (k) { u.push(CAT_CORES[k]); });
  u.push('#3F6296', '#6F4E7C'); /* azul da Ana e roxo da Manuela */
  return u;
}
/* escolhe o tom mais distante de todas as cores ja usadas, fora do azul/roxo */
function catCorNova() {
  var usadas = catCoresUsadas(), melhor = null, dist = -1;
  var tons = [[48, 44], [42, 34], [50, 56], [36, 28]];
  for (var h = 0; h < 360; h += 4) {
    if (h >= 190 && h <= 325) continue;
    tons.forEach(function (sl) {
      var c = catHex(h, sl[0], sl[1]);
      var d = usadas.reduce(function (m, u) { return Math.min(m, catDist(c, u)); }, 1e9);
      if (d > dist) { dist = d; melhor = c; }
    });
  }
  return melhor || '#A8A29E';
}
function catTemCor(c) {
  return !!CAT_CORES[c] || (typeof CORES_FIXAS !== 'undefined' && !!CORES_FIXAS[c]);
}

/* ---------- catalogo gravado ---------- */
function catGravado() {
  var ov = Store.get(K.OVERRIDES, {}) || {}, g = ov[CAT_UID];
  if (!g || typeof g !== 'object') g = {};
  return { cats: g.cats || {}, subs: g.subs || {}, cores: g.cores || {} };
}
function catGravar(g) {
  var ov = Store.get(K.OVERRIDES, {}) || {};
  ov[CAT_UID] = { cats: g.cats, subs: g.subs, cores: g.cores, atualizadoEm: new Date().toISOString() };
  Store.set(K.OVERRIDES, ov);
}

/* monta o catalogo em memoria: base + extras padrao + o que cada uma criou */
function catAplicar() {
  var g = catGravado();
  CAT_SUBS = { Ana: {}, Manuela: {}, NuNa: {} };
  CAT_CORES = {};
  ['Ana', 'Manuela', 'NuNa'].forEach(function (p) {
    var lista = catLista(p), extra = CAT_BASE_EXTRA[p] || { add: [], subs: {} };
    /* cartao nao e categoria */
    for (var x = lista.length - 1; x >= 0; x--) if (CAT_CATCHALL[lista[x]]) lista.splice(x, 1);
    var outros = lista.indexOf('Outros');
    extra.add.concat(g.cats[p] || []).forEach(function (c) {
      if (lista.indexOf(c) >= 0) return;
      if (outros >= 0) { lista.splice(outros, 0, c); outros++; } else lista.push(c);
    });
    [extra.subs, g.subs[p] || {}].forEach(function (src) {
      Object.keys(src).forEach(function (c) {
        var a = CAT_SUBS[p][c] = CAT_SUBS[p][c] || [];
        src[c].forEach(function (s) { if (a.indexOf(s) < 0) a.push(s); });
      });
    });
  });
  if (CATS.NuNa && CATS.NuNa !== GRUPOS) GRUPOS.forEach(function (c) { if (CATS.NuNa.indexOf(c) < 0) CATS.NuNa.push(c); });
  /* cor automatica, sempre na mesma ordem: primeiro as categorias padrao,
     depois as cores gravadas das que cada uma criou */
  var criadas = {};
  Object.keys(g.cats).forEach(function (p) { (g.cats[p] || []).forEach(function (c) { criadas[c] = 1; }); });
  ['Ana', 'Manuela', 'NuNa'].forEach(function (p) {
    catLista(p).forEach(function (c) { if (!criadas[c] && !catTemCor(c)) CAT_CORES[c] = catCorNova(); });
  });
  Object.keys(g.cores).forEach(function (c) { CAT_CORES[c] = g.cores[c]; });
  ['Ana', 'Manuela', 'NuNa'].forEach(function (p) {
    catLista(p).forEach(function (c) { if (!catTemCor(c)) CAT_CORES[c] = catCorNova(); });
  });
  /* cartao usado como categoria: passa para a categoria do que foi comprado */
  MONTHS.forEach(function (m) {
    DATA.months[m].transactions.forEach(function (t) {
      if (!CAT_CATCHALL[t.plano]) return;
      var alvo = CAT_POR_TIPO[t.tipo] || ['Outros'], lista = catLista(t.perfil);
      if (lista.indexOf(alvo[0]) < 0) alvo = ['Outros'];
      t.plano = alvo[0];
      if (!t.grupo && !t.sub && alvo[1]) t.sub = alvo[1];
    });
  });
}

/* cria categoria ("Pedágio") ou subcategoria ("Carro › Pedágio") no perfil */
function catAdicionar(perfil, texto) {
  texto = String(texto || '').replace(/\s+/g, ' ').trim();
  if (!texto) return null;
  var partes = texto.split(/\s*(?:›|>)\s*/), cat = partes[0], sub = (partes[1] || '').trim();
  if (!cat) return null;
  var lista = catLista(perfil), achada = lista.filter(function (c) { return c.toLowerCase() === cat.toLowerCase(); })[0];
  var g = catGravado(), mudou = false;
  if (achada) cat = achada;
  else {
    g.cats[perfil] = (g.cats[perfil] || []).concat([cat]);
    var outros = lista.indexOf('Outros');
    if (outros >= 0) lista.splice(outros, 0, cat); else lista.push(cat);
    if (perfil === 'NuNa' && CATS.NuNa && CATS.NuNa !== GRUPOS && CATS.NuNa.indexOf(cat) < 0) CATS.NuNa.push(cat);
    mudou = true;
  }
  if (!catTemCor(cat)) { CAT_CORES[cat] = catCorNova(); g.cores[cat] = CAT_CORES[cat]; mudou = true; }
  if (sub) {
    var atuais = catSubs(perfil, cat), ja = atuais.filter(function (s) { return s.toLowerCase() === sub.toLowerCase(); })[0];
    if (ja) sub = ja;
    else {
      g.subs[perfil] = g.subs[perfil] || {};
      g.subs[perfil][cat] = (g.subs[perfil][cat] || []).concat([sub]);
      (CAT_SUBS[perfil][cat] = CAT_SUBS[perfil][cat] || []).push(sub);
      mudou = true;
    }
  }
  if (mudou) catGravar(g);
  return { cat: cat, sub: sub };
}

/* "+ Nova categoria…" em qualquer seletor de categoria */
document.addEventListener('change', function (e) {
  var sel = e.target;
  if (!sel || sel.tagName !== 'SELECT' || sel.value !== '__novo__') return;
  e.stopImmediatePropagation();
  var perfil = sel.dataset.perfil || (state.perfil === 'NuNa' ? 'NuNa' : state.perfil);
  var quem = perfil === 'NuNa' ? 'no Conjunto' : 'no perfil de ' + perfil;
  var nome = window.prompt('Nova categoria ' + quem + '.\n\nPara subcategoria, escreva Categoria › Sub (ou Categoria > Sub).\nEx.: Carro > Pedágio', '');
  var r = nome ? catAdicionar(perfil, nome) : null;
  var anterior = sel.dataset.anterior || '';
  var val = r ? (r.sub ? r.cat + CAT_SEP + r.sub : r.cat) : anterior;
  var cp = catParse(val);
  if (sel.id === 'ag-cat' && typeof agFillCat === 'function') agFillCat(cp.cat, cp.sub);
  else sel.innerHTML = catOptsHTML(perfil, cp.cat, cp.sub, { novo: true, vazio: sel.dataset.vazio === '1' });
  sel.value = val;
  if (r) {
    flashToast('Categoria criada: ' + catRotulo(r.cat, r.sub) + (perfil === 'NuNa' ? ' (Conjunto)' : ' (' + perfil + ')'));
    sel.dispatchEvent(new Event('change', { bubbles: true }));
  }
}, true);
/* guarda o valor antes da troca, para voltar se a criacao for cancelada */
['focusin', 'pointerdown'].forEach(function (ev) {
  document.addEventListener(ev, function (e) {
    var s = e.target && e.target.closest && e.target.closest('select');
    if (s && s.value !== '__novo__') s.dataset.anterior = s.value;
  }, true);
});

/* cor da categoria: catalogo primeiro, depois as cores fixas */
(function () { var _c = colorOf; colorOf = function (c) { return CAT_CORES[c] || _c(c); }; })();

/* ============ PARCELAS FUTURAS ============
   Uma compra "(05/10)" na fatura de setembro gera as parcelas 06 a 10 nos
   meses seguintes, criando o mes se ainda nao existir. A parcela prevista
   sai sozinha quando a fatura daquele mes e daquele cartao e importada. */
function parcBase(s) {
  return String(s || '').replace(/parcela\s*\d{1,2}\s*de\s*\d{1,2}/i, '')
    .replace(/\s*\(?\b\d{1,2}\s*\/\s*\d{1,2}\)?\s*$/, '').replace(/\s+/g, ' ').trim();
}
function parcDois(n) { return (n < 10 ? '0' : '') + n; }
function parcLabel(o) { return mesLabelDe(Math.floor(o / 12), (o % 12) + 1); }
function parcGarantirMes(label) {
  if (DATA.months[label]) return;
  var antes = {}; MONTHS.forEach(function (m) { antes[m] = 1; });
  rcGarantirMes(DATA, label);
  /* mes criado so para receber parcelas futuras: e um mes de PREVISAO */
  MONTHS.forEach(function (m) { if (!antes[m]) DATA.months[m]._previsao = true; });
}
function parcProjetar() {
  if (!DATA || !DATA.months || typeof agParcelaDaDesc !== 'function' || typeof rcGarantirMes !== 'function') return;
  var grupos = {}, vistos = {}, fontesMes = {}, ultimaFatura = {};
  MONTHS.slice().forEach(function (m) {
    DATA.months[m].transactions = DATA.months[m].transactions.filter(function (t) { return !t.previsto; });
    DATA.months[m].transactions.forEach(function (t) {
      fontesMes[m + '|' + t.fonteLabel] = 1;
      if (!t.manual) ultimaFatura[t.fonteLabel] = Math.max(ultimaFatura[t.fonteLabel] || 0, mesOrdem(m));
      if (t.contrib || t.manual) return;
      var pd = agParcelaDaDesc(t.raw || t.desc); if (!pd) return;
      var chave = [t.fonteLabel, t.data, parcBase(t.raw || t.desc).toUpperCase(), Number(t.valor).toFixed(2), pd.n].join('|');
      vistos[chave + '#' + pd.k] = 1;
      var g = grupos[chave];
      if (!g || pd.k > g.k) grupos[chave] = { t: t, k: pd.k, n: pd.n, o: mesOrdem(m) };
    });
  });
  var ov = Store.get(K.OVERRIDES, {}) || {};
  Object.keys(grupos).forEach(function (chave) {
    var g = grupos[chave];
    /* ja existe fatura mais nova desse cartao sem esta compra: foi quitada/antecipada */
    if ((ultimaFatura[g.t.fonteLabel] || 0) > g.o) return;
    for (var j = g.k + 1; j <= g.n; j++) {
      if (vistos[chave + '#' + j]) continue;
      var lab = parcLabel(g.o + (j - g.k));
      if (DATA.months[lab] && fontesMes[lab + '|' + g.t.fonteLabel]) continue; /* fatura deste mes ja importada */
      parcGarantirMes(lab);
      var uid = 'prev-' + CSV_hash(chave + '#' + j), suf = ' (' + parcDois(j) + '/' + parcDois(g.n) + ')';
      var v = Object.assign({}, g.t, {
        mes: lab, raw: parcBase(g.t.raw || g.t.desc) + suf, desc: parcBase(g.t.desc) + suf,
        previsto: true, revisar: false, possivelDup: false, status: '',
        uid: uid, id: uid, dedupKey: 'PREV|' + chave + '#' + j, ordinal: 1,
        parcGrupo: chave, parcK: j, parcN: g.n, parcUlt: g.k, parcNome: parcBase(g.t.desc)
      });
      delete v._m;
      var o = ov[uid];
      if (o) ['plano', 'sub', 'tipo', 'grupo', 'divisao', 'status'].forEach(function (k) { if (o[k] !== undefined) v[k] = o[k]; });
      DATA.months[lab].transactions.push(v);
    }
  });
  /* meses em que caem parcelas do ACABEI DE GASTAR */
  (Store.get(K.GASTEI, []) || []).forEach(function (i) {
    if (i.status === 'Conciliado' || agNumParcelas(i) < 2) return;
    agParcelasDe(i).forEach(function (pc) { if (!pc.conciliada) parcGarantirMes(pc.mes); });
  });
}
function CSV_hash(s) {
  var h = 0x811c9dc5;
  for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = (h * 0x01000193) >>> 0; }
  return ('00000000' + h.toString(16)).slice(-8);
}
/* importou fatura: tira as parcelas previstas daquele mes/cartao e reprojeta */
(function () {
  if (typeof CSV === 'undefined' || !CSV.aplicar) return;
  var _ap = CSV.aplicar;
  CSV.aplicar = function (novos) {
    var r = _ap.apply(this, arguments);
    try { parcProjetar(); } catch (e) { console.error('parcProjetar', e); }
    return r;
  };
})();
/* compra parcelada nova no ACABEI DE GASTAR: cria os meses das parcelas */
(function () {
  if (typeof agSalvarItem !== 'function') return;
  var _s = agSalvarItem;
  agSalvarItem = function (item) {
    try {
      if (item && agNumParcelas(item) > 1) agParcelasDe(item).forEach(function (pc) { parcGarantirMes(pc.mes); });
    } catch (e) { console.error(e); }
    return _s.apply(this, arguments);
  };
})();

/* ============ detalhe "o que comprou": toque mostra, mouse mostra no title ============ */
document.addEventListener('click', function (e) {
  var s = e.target && e.target.closest && e.target.closest('.tem-obs'); if (!s) return;
  var nx = s.nextElementSibling;
  if (nx && nx.classList.contains('obs-linha')) { nx.remove(); return; }
  var d = document.createElement('span'); d.className = 'obs-linha'; d.textContent = s.dataset.obs || '';
  s.parentNode.insertBefore(d, s.nextSibling);
});

/* ============ estilos ============ */
(function () {
  var st = document.createElement('style');
  st.textContent =
    '.rev-back{border:0;background:none;padding:2px 6px;border-radius:6px;cursor:pointer;font:inherit;font-weight:700;color:var(--pos);line-height:1}' +
    '.rev-back::before{content:"\\2713"}' +
    '.rev-back:hover,.rev-back:focus-visible{background:rgba(127,127,127,.12);color:var(--tx2,inherit)}' +
    '.rev-back:hover::before,.rev-back:focus-visible::before{content:"\\21BA"}' +
    '.tem-obs{text-decoration:underline dotted;text-underline-offset:3px;cursor:help}' +
    '.obs-linha{display:block;font-size:11px;color:var(--tx3);margin-top:2px}';
  document.head.appendChild(st);
})();
