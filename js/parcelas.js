/* ============================================================
   NuNa · parcelas.js — PARCELAS A VENCER
   Painel no Mes vs Mes (abaixo de Tendencia por Categoria) e
   chamada na Visao Geral. Junta:
   - parcelas futuras das faturas importadas (projetadas em categorias.js)
   - compras parceladas do ACABEI DE GASTAR ainda nao achadas na fatura
     (cartao, Pix parcelado, boleto...)
   Respeita o perfil: Conjunto mostra so as compras da casa; Ana e
   Manuela mostram as compras feitas por cada uma (individuais e as
   conjuntas que ela gerou, sinalizadas).
   ============================================================ */
var PC_ESTADO = { ordem: 'fim', fonte: '', aberto: false };

function pcMesNome(m) { return typeof mesNome === 'function' ? mesNome(m) : m; }
function pcMesCurto(m) {
  var p = String(m).split('/');
  return p[0].toLowerCase() + '/' + (p[1] || '26');
}
function pcVisivel(conj, perfil) {
  if (state.perfil === 'NuNa') return conj;
  return perfil === state.perfil;
}

/* compras parceladas em andamento, ja filtradas pelo perfil aberto */
function pcCompras() {
  var por = {};
  if (typeof MONTHS === 'undefined' || !DATA) return [];
  MONTHS.forEach(function (m) {
    (DATA.months[m].transactions || []).forEach(function (t) {
      if (!t.previsto || !t.parcGrupo) return;
      var c = por[t.parcGrupo];
      if (!c) c = por[t.parcGrupo] = {
        id: t.parcGrupo, nome: t.parcNome || t.desc, fonte: t.fonteLabel, perfil: t.perfil,
        conj: !!t.grupo, grupo: t.grupo || null, cat: t.grupo || t.plano, sub: t.sub || '',
        n: t.parcN, pagas: t.parcUlt, parcela: t.valor, meses: {}, origem: 'fatura', data: t.data
      };
      c.meses[m] = (c.meses[m] || 0) + t.valor;
    });
  });
  (typeof AG !== 'undefined' && AG.itens ? AG.itens : []).forEach(function (i) {
    if (agNumParcelas(i) < 2 || i.status === 'Conciliado') return;
    var pcs = agParcelasDe(i), resta = pcs.filter(function (p) { return !p.conciliada; });
    if (!resta.length) return;
    var c = por['AG|' + i.id] = {
      id: 'AG|' + i.id, nome: i.desc, obs: i.obs || '', fonte: i.fonte, perfil: i.perfil,
      conj: i.divisao === 'CONJUNTA', grupo: i.grupo || null, cat: i.categoria, sub: i.sub || '',
      n: pcs.length, pagas: pcs.length - resta.length, parcela: resta[resta.length - 1].valor,
      meses: {}, origem: 'manual', data: agBR(i.data)
    };
    resta.forEach(function (p) { c.meses[p.mes] = (c.meses[p.mes] || 0) + p.valor; });
  });
  return Object.keys(por).map(function (k) {
    var c = por[k], ms = Object.keys(c.meses).sort(function (a, b) { return mesOrdem(a) - mesOrdem(b); });
    c.restam = ms.length;
    c.falta = ms.reduce(function (s, m) { return s + c.meses[m]; }, 0);
    c.primeiro = ms[0]; c.ultimo = ms[ms.length - 1];
    c.pagas = Math.max(0, c.n - c.restam);
    return c;
  }).filter(function (c) { return c.restam > 0 && pcVisivel(c.conj, c.perfil); });
}

/* consolidado por mes */
function pcPorMes(lista) {
  var o = {};
  lista.forEach(function (c) { Object.keys(c.meses).forEach(function (m) { o[m] = (o[m] || 0) + c.meses[m]; }); });
  return Object.keys(o).sort(function (a, b) { return mesOrdem(a) - mesOrdem(b); }).map(function (m) { return { m: m, v: o[m] }; });
}
function pcRendaMedia() {
  var F = (CLOSED && CLOSED.length ? CLOSED : MONTHS).slice(-3);
  var r = F.map(function (m) { return rendaOf(m, state.perfil); });
  return r.length ? r.reduce(function (a, b) { return a + b; }, 0) / r.length : 0;
}

/* frases do Agente sobre as parcelas */
function pcAlertas(lista, meses) {
  var out = [];
  if (!meses.length) return out;
  /* maior alivio: mes em que a parcela mensal mais cai */
  var melhor = null;
  for (var i = 1; i < meses.length; i++) {
    var d = meses[i - 1].v - meses[i].v;
    if (d > 0.5 && (!melhor || d > melhor.d)) melhor = { m: meses[i].m, d: d, ant: meses[i - 1].m };
  }
  var fim = {};
  lista.forEach(function (c) { (fim[c.ultimo] = fim[c.ultimo] || []).push(c); });
  if (melhor) {
    var acabam = fim[melhor.ant] || [];
    out.push({ tipo: 'ok', txt: 'A partir de <b>' + pcMesNome(melhor.m) + '</b> sobram <b>' + brl(melhor.d) + '</b> por m&ecirc;s' +
      (acabam.length ? ': ' + (acabam.length > 1 ? 'terminam ' + acabam.length + ' compras' : 'termina ' + esc(acabam[0].nome)) + ' em ' + pcMesNome(melhor.ant) : '') + '.' });
  }
  var renda = pcRendaMedia(), prox = meses[0];
  if (renda > 0 && prox) {
    var pct = prox.v / renda;
    if (pct >= 0.3) out.push({ tipo: 'bad', txt: 'Em <b>' + pcMesNome(prox.m) + '</b> as parcelas levam <b>' + Math.round(pct * 100) + '%</b> da renda m&eacute;dia (' + brl(prox.v) + '). Evite parcelar mais at&eacute; esse peso cair.' });
    else if (pct >= 0.15) out.push({ tipo: 'warn', txt: 'Em <b>' + pcMesNome(prox.m) + '</b> as parcelas comprometem <b>' + Math.round(pct * 100) + '%</b> da renda m&eacute;dia (' + brl(prox.v) + ').' });
  }
  var quase = lista.filter(function (c) { return c.restam === 1; });
  if (quase.length) out.push({ tipo: 'ok', txt: '<b>' + quase.length + '</b> compra' + (quase.length > 1 ? 's est&atilde;o' : ' est&aacute;') + ' na &uacute;ltima parcela.' });
  return out;
}

/* ---------- painel no Mes vs Mes ---------- */
function pcHost() {
  var p = el('panel-mvm'); if (!p) return null;
  var h = el('pc-painel');
  if (!h) {
    h = document.createElement('div'); h.id = 'pc-painel'; h.className = 'card pc-card';
    var trend = el('trend'), cardTrend = trend && trend.closest('.card');
    if (cardTrend && cardTrend.parentNode === p) p.insertBefore(h, cardTrend.nextSibling);
    else p.insertBefore(h, p.querySelector('footer'));
    h.addEventListener('click', pcClique);
    h.addEventListener('change', function (e) {
      if (e.target.id === 'pc-fonte') { PC_ESTADO.fonte = e.target.value; renderParcelas(); }
    });
  }
  return h;
}
function pcClique(e) {
  var b = e.target.closest('[data-pc-ordem]');
  if (b) { PC_ESTADO.ordem = b.dataset.pcOrdem; renderParcelas(); return; }
  if (e.target.closest('#pc-todas')) { PC_ESTADO.aberto = !PC_ESTADO.aberto; renderParcelas(); }
}
function renderParcelas() {
  var h = pcHost(); if (!h) return;
  var todas = pcCompras();
  var fontes = []; todas.forEach(function (c) { if (fontes.indexOf(c.fonte) < 0) fontes.push(c.fonte); });
  if (PC_ESTADO.fonte && fontes.indexOf(PC_ESTADO.fonte) < 0) PC_ESTADO.fonte = '';
  var lista = todas.filter(function (c) { return !PC_ESTADO.fonte || c.fonte === PC_ESTADO.fonte; });
  var meses = pcPorMes(lista);
  var total = lista.reduce(function (s, c) { return s + c.falta; }, 0);
  var nParc = lista.reduce(function (s, c) { return s + c.restam; }, 0);
  var ultimo = meses.length ? meses[meses.length - 1].m : null;
  var quem = state.perfil === 'NuNa' ? 'da casa' : (state.perfil === 'Ana' ? 'suas' : 'da Manuela');

  if (!todas.length) {
    h.innerHTML = '<div class="pc-top"><span class="pc-tag">Parcelas a vencer</span></div>' +
      '<p class="note" style="margin:6px 0 0">Nenhuma compra parcelada ' + quem + ' em andamento. Quando uma fatura trouxer "(03/10)" ou voc&ecirc; lan&ccedil;ar uma compra parcelada no ACABEI DE GASTAR, ela aparece aqui.</p>';
    return;
  }

  var conjV = lista.filter(function (c) { return c.conj; }).reduce(function (s, c) { return s + c.falta; }, 0);
  var sub = lista.length + ' compra' + (lista.length > 1 ? 's' : '') + ' &middot; ' + nParc + ' parcela' + (nParc > 1 ? 's' : '') +
    (ultimo ? ' &middot; livre em <b>' + pcMesNome(ultimo) + '</b>' : '');
  if (state.perfil !== 'NuNa' && conjV > 0) sub += '<br><span class="pc-mini">' + brl(total - conjV) + ' individuais &middot; ' + brl(conjV) + ' conjuntas (entram no NuNa)</span>';

  /* linha do tempo */
  var max = meses.reduce(function (m, x) { return Math.max(m, x.v); }, 0) || 1;
  var alivio = null;
  for (var i = 1; i < meses.length; i++) { var d = meses[i - 1].v - meses[i].v; if (d > 0.5 && (!alivio || d > alivio.d)) alivio = { m: meses[i].m, d: d }; }
  var barras = meses.map(function (x) {
    var alt = Math.max(4, Math.round(x.v / max * 100));
    var cls = alivio && alivio.m === x.m ? ' pc-alivio' : '';
    return '<div class="pc-col' + cls + '" title="' + esc(pcMesNome(x.m)) + ': ' + brl(x.v) + '">' +
      '<span class="pc-val">' + (x.v >= 1000 ? (x.v / 1000).toFixed(1).replace('.', ',') + 'k' : Math.round(x.v)) + '</span>' +
      '<span class="pc-bar" style="height:' + alt + '%"></span><span class="pc-mes">' + pcMesCurto(x.m) + '</span></div>';
  }).join('');

  /* alertas */
  var al = pcAlertas(lista, meses).map(function (a) { return '<li class="pc-al pc-al-' + a.tipo + '">' + a.txt + '</li>'; }).join('');

  /* lista de compras */
  var ord = lista.slice().sort(PC_ESTADO.ordem === 'saldo'
    ? function (a, b) { return b.falta - a.falta; }
    : function (a, b) { return mesOrdem(a.ultimo) - mesOrdem(b.ultimo) || b.falta - a.falta; });
  var lim = PC_ESTADO.aberto ? ord.length : Math.min(ord.length, 6);
  var itens = ord.slice(0, lim).map(function (c) {
    var pct = c.n ? Math.round(c.pagas / c.n * 100) : 0;
    var nome = c.obs ? '<span class="tem-obs" data-obs="' + esc(c.obs) + '" title="' + esc(c.obs) + '">' + esc(c.nome) + '</span>' : esc(c.nome);
    var cat = c.sub ? c.cat + ' › ' + c.sub : c.cat;
    return '<div class="pc-item">' +
      '<div class="pc-i1"><span class="pc-dot" style="background:' + colorOf(c.cat) + '"></span><b>' + nome + '</b>' +
        (c.restam === 1 ? ' <span class="pc-badge pc-b-ok">&uacute;ltima</span>' : '') +
        (state.perfil !== 'NuNa' && c.conj ? ' <span class="pc-badge">conjunta</span>' : '') +
        (c.origem === 'manual' ? ' <span class="pc-badge">lan&ccedil;ada &agrave; m&atilde;o</span>' : '') + '</div>' +
      '<div class="pc-i2">' + esc(cat || '') + ' &middot; ' + esc(c.fonte || '') + (state.perfil === 'NuNa' ? ' &middot; ' + c.perfil : '') + '</div>' +
      '<div class="pc-prog"><span style="width:' + pct + '%"></span></div>' +
      '<div class="pc-i3"><span><b>' + c.pagas + '</b> de ' + c.n + ' pagas &middot; ' + brl(c.parcela) + '/m&ecirc;s</span>' +
        '<span>falta <b>' + brl(c.falta) + '</b> &middot; at&eacute; ' + pcMesCurto(c.ultimo) + '</span></div>' +
      '</div>';
  }).join('');

  var selFonte = fontes.length > 1 ? '<select id="pc-fonte" class="pc-sel"><option value="">Todos os cart&otilde;es e formas</option>' +
    fontes.map(function (f) { return '<option' + (f === PC_ESTADO.fonte ? ' selected' : '') + '>' + esc(f) + '</option>'; }).join('') + '</select>' : '';

  h.innerHTML =
    '<div class="pc-top"><span class="pc-tag">Parcelas a vencer</span>' + selFonte + '</div>' +
    '<div class="pc-hero"><div class="pc-big">' + brl(total) + '</div><div class="pc-hsub">ainda a pagar em compras parceladas ' + quem + '<br>' + sub + '</div></div>' +
    (al ? '<ul class="pc-als">' + al + '</ul>' : '') +
    '<div class="pc-h3">Quanto das pr&oacute;ximas faturas j&aacute; est&aacute; comprometido</div>' +
    '<div class="pc-time">' + barras + '</div>' +
    '<div class="pc-h3 pc-h3-row"><span>Compras em andamento</span><span class="pc-ords">' +
      '<button type="button" class="pill' + (PC_ESTADO.ordem === 'fim' ? ' on' : '') + '" data-pc-ordem="fim">Acaba antes</button>' +
      '<button type="button" class="pill' + (PC_ESTADO.ordem === 'saldo' ? ' on' : '') + '" data-pc-ordem="saldo">Maior saldo</button></span></div>' +
    '<div class="pc-lista">' + itens + '</div>' +
    (ord.length > 6 ? '<button type="button" id="pc-todas" class="pc-mais">' + (PC_ESTADO.aberto ? 'Mostrar menos' : 'Ver todas as ' + ord.length + ' compras') + '</button>' : '') +
    '<p class="note" style="margin:12px 0 0">Parcelas futuras sa&iacute;das das faturas importadas e das compras parceladas do ACABEI DE GASTAR. Cada parcela sai daqui sozinha quando a fatura do m&ecirc;s dela &eacute; importada.</p>';
}

/* ---------- chamada na Visao Geral ---------- */
function renderParcelasCard() {
  var k = el('ov-kpis'); if (!k) return;
  var b = el('pc-banner');
  if (!b) {
    b = document.createElement('button'); b.type = 'button'; b.id = 'pc-banner'; b.className = 'pc-banner';
    b.addEventListener('click', pcAbrirPainel);
  }
  /* depois do bloco do grafico Gastos por Categoria (o impacto do grafico vem antes) */
  /* ordem: grafico Gastos por Categoria -> Divisao do mes (so no Conjunto) -> Parcelas a vencer */
  var dn = el('donut'), anchor = dn && dn.closest('#panel-overview > *'), cb = el('collab-card');
  if (cb && !cb.hidden && anchor && (anchor.compareDocumentPosition(cb) & Node.DOCUMENT_POSITION_FOLLOWING)) anchor = cb;
  if (!anchor) anchor = el('agente-nuna') || k;
  if (b.previousElementSibling !== anchor) anchor.parentNode.insertBefore(b, anchor.nextSibling);
  var lista = pcCompras();
  if (!lista.length) { b.hidden = true; return; }
  b.hidden = false;
  var meses = pcPorMes(lista), total = lista.reduce(function (s, c) { return s + c.falta; }, 0);
  var prox = meses[0], ultimo = meses[meses.length - 1];
  var acaba = lista.slice().sort(function (a, c) { return mesOrdem(a.ultimo) - mesOrdem(c.ultimo); })[0];
  b.innerHTML =
    '<span class="pc-b-ico" aria-hidden="true"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/></svg></span>' +
    '<span class="pc-b-txt"><span class="pc-b-lab">Parcelas a vencer</span>' +
      '<span class="pc-b-val">' + brl(total) + '</span>' +
      '<span class="pc-b-sub">' + lista.length + ' compra' + (lista.length > 1 ? 's' : '') +
        (prox ? ' &middot; ' + brl(prox.v) + ' em ' + pcMesCurto(prox.m) : '') +
        (acaba ? ' &middot; pr&oacute;xima a acabar: ' + esc(acaba.nome) + ' (' + pcMesCurto(acaba.ultimo) + ')' : '') +
        (ultimo ? ' &middot; livre em ' + pcMesCurto(ultimo.m) : '') + '</span></span>' +
    '<span class="pc-b-go">Ver painel &rarr;</span>';
}
function pcAbrirPainel() {
  var t = el('tabs') && el('tabs').querySelector('[data-tab="mvm"]'); if (t) t.click();
  var tenta = 0;
  (function vai() {
    var p = el('pc-painel');
    if (p && p.offsetParent) { p.scrollIntoView({ behavior: 'smooth', block: 'start' }); p.classList.add('pc-flash'); setTimeout(function () { p.classList.remove('pc-flash'); }, 1600); return; }
    if (++tenta < 30) setTimeout(vai, 80);
  })();
}

/* entra na fila de desenho das abas */
(function () {
  if (typeof PANEL_FNS === 'undefined') return;
  if (PANEL_FNS.mvm.indexOf('renderParcelas') < 0) PANEL_FNS.mvm.push('renderParcelas');
  if (PANEL_FNS.overview.indexOf('renderParcelasCard') < 0) PANEL_FNS.overview.push('renderParcelasCard');
})();

/* ---------- estilos ---------- */
(function () {
  var st = document.createElement('style');
  st.textContent = [
    '.pc-card{position:relative;border:1.5px solid var(--acc);background:linear-gradient(180deg,var(--accL) 0,var(--card) 150px);overflow:hidden}',
    '.pc-card::before{content:"";position:absolute;left:0;top:0;right:0;height:4px;background:linear-gradient(90deg,var(--acc),var(--amb),var(--neg))}',
    '.pc-top{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:8px}',
    '.pc-tag{font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--amb)}',
    '.pc-sel{font:inherit;font-size:12px;padding:5px 8px;border-radius:8px;border:1px solid var(--border);background:var(--card);color:var(--tx);max-width:100%}',
    '.pc-hero{display:flex;align-items:flex-end;gap:16px;flex-wrap:wrap;margin:2px 0 12px}',
    '.pc-big{font-size:clamp(30px,6vw,44px);font-weight:800;letter-spacing:-.02em;line-height:1;color:var(--neg);font-variant-numeric:tabular-nums}',
    '.pc-hsub{font-size:13px;color:var(--tx2);line-height:1.45}',
    '.pc-mini{font-size:12px;color:var(--tx3)}',
    '.pc-als{list-style:none;margin:0 0 14px;padding:0;display:grid;gap:6px}',
    '.pc-al{font-size:13px;padding:8px 12px;border-radius:8px;border-left:3px solid var(--tx3);background:var(--card)}',
    '.pc-al-ok{border-left-color:var(--pos);background:var(--posL)}',
    '.pc-al-warn{border-left-color:var(--amb);background:var(--accL)}',
    '.pc-al-bad{border-left-color:var(--neg);background:var(--negL)}',
    '.pc-h3{font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--tx3);margin:14px 0 8px}',
    '.pc-h3-row{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap}',
    '.pc-ords{display:flex;gap:6px;text-transform:none;letter-spacing:0}',
    '.pc-ords .pill{padding:4px 10px;font-size:12px}',
    '.pc-time{display:flex;align-items:flex-end;gap:6px;height:150px;padding:4px 2px 0;overflow-x:auto}',
    '.pc-col{flex:1 0 34px;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%;gap:4px}',
    '.pc-bar{width:100%;max-width:46px;border-radius:6px 6px 2px 2px;background:linear-gradient(180deg,var(--amb),var(--acc));min-height:4px}',
    '.pc-alivio .pc-bar{background:linear-gradient(180deg,var(--pos),var(--pos));opacity:.85}',
    '.pc-val{font-size:11px;font-weight:700;color:var(--tx2);font-variant-numeric:tabular-nums}',
    '.pc-mes{font-size:11px;color:var(--tx3);white-space:nowrap}',
    '.pc-lista{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px}',
    '.pc-item{border:1px solid var(--border);border-radius:10px;padding:10px 12px;background:var(--card)}',
    '.pc-i1{font-size:14px;display:flex;align-items:center;gap:6px;flex-wrap:wrap}',
    '.pc-dot{width:9px;height:9px;border-radius:50%;flex:0 0 9px}',
    '.pc-i2{font-size:12px;color:var(--tx3);margin:2px 0 8px}',
    '.pc-prog{height:7px;border-radius:99px;background:var(--border2);overflow:hidden}',
    '.pc-prog span{display:block;height:100%;border-radius:99px;background:linear-gradient(90deg,var(--acc),var(--pos))}',
    '.pc-i3{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;font-size:12px;color:var(--tx2);margin-top:6px;font-variant-numeric:tabular-nums}',
    '.pc-badge{font-size:10px;font-weight:700;padding:1px 7px;border-radius:99px;border:1px solid var(--border);color:var(--tx2);text-transform:uppercase;letter-spacing:.04em}',
    '.pc-b-ok{border-color:var(--pos);color:var(--pos)}',
    '.pc-mais{font:inherit;font-size:13px;margin:12px auto 0;display:block;padding:6px 16px;border-radius:999px;border:1px solid var(--border);background:transparent;color:inherit;cursor:pointer}',
    '.pc-flash{animation:pcFlash 1.6s ease}',
    '@keyframes pcFlash{0%,100%{box-shadow:0 0 0 0 transparent}30%{box-shadow:0 0 0 4px var(--acc)}}',
    '.pc-banner{display:flex;align-items:center;gap:14px;width:100%;text-align:left;font:inherit;color:inherit;cursor:pointer;margin:16px 0;padding:12px 16px;border-radius:12px;border:1.5px solid var(--acc);background:linear-gradient(90deg,var(--accL),var(--card));position:relative;overflow:hidden}',
    '.pc-banner::before{content:"";position:absolute;left:0;top:0;bottom:0;width:4px;background:linear-gradient(180deg,var(--acc),var(--neg))}',
    '.pc-banner:hover{border-color:var(--amb)}',
    '.pc-b-ico{color:var(--amb);flex:0 0 auto;display:flex}',
    '.pc-b-txt{display:flex;flex-direction:column;flex:1;min-width:0}',
    '.pc-b-lab{font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--amb)}',
    '.pc-b-val{font-size:22px;font-weight:800;color:var(--neg);line-height:1.2;font-variant-numeric:tabular-nums}',
    '.pc-b-sub{font-size:12px;color:var(--tx2);overflow:hidden;text-overflow:ellipsis}',
    '.pc-b-go{font-size:13px;font-weight:700;color:var(--acc);white-space:nowrap}',
    '@media (max-width:560px){.pc-b-go{display:none}.pc-lista{grid-template-columns:1fr}}'
  ].join('');
  document.head.appendChild(st);
})();

/* ============ MESES DE PREVISAO ============
   Mes que ainda nao comecou e so existe por causa das parcelas futuras.
   - receita estimada pela media dos 3 ultimos meses fechados
   - Clareza e Orcamento nao acusam "estourado" nesses meses
   - fica fora do fechamento e dos alertas de mes em aberto
   Deixa de ser previsao assim que tiver lancamento real ou receita. */
function mesPrevisao(m) {
  var mm = DATA && DATA.months && DATA.months[m];
  if (!mm || !mm._previsao) return false;
  if ((mm.receitaItens && mm.receitaItens.length) || (mm.contracheques && mm.contracheques.length)) return false;
  return !(mm.transactions || []).some(function (t) { return !t.previsto; });
}
function pcRendaEstimada(p) {
  var F = (CLOSED || []).slice(-3);
  if (!F.length) return 0;
  var r = function (q) { return F.reduce(function (s, m) { return s + (DATA.months[m].receita[q] || 0); }, 0) / F.length; };
  return p === 'Ana' ? r('Ana') : p === 'Manuela' ? r('Manuela') : r('Ana') + r('Manuela');
}
(function () {
  var _r = rendaOf;
  rendaOf = function (mes, p) { return mesPrevisao(mes) ? pcRendaEstimada(p) : _r.apply(this, arguments); };
})();
function pcAvisoPrevisao() {
  var k = el('ov-kpis'); if (!k) return;
  var av = el('pc-prev-aviso');
  if (!mesPrevisao(state.mes)) { if (av) av.remove(); return; }
  if (!av) { av = document.createElement('div'); av.id = 'pc-prev-aviso'; }
  if (av.nextElementSibling !== k) k.parentNode.insertBefore(av, k);
  var F = (CLOSED || []).slice(-3);
  av.innerHTML = '<b>' + esc(pcMesNome(state.mes)) + ' &eacute; previs&atilde;o.</b> O m&ecirc;s ainda n&atilde;o come&ccedil;ou: os gastos s&atilde;o s&oacute; as parcelas j&aacute; comprometidas e a receita &eacute; estimada pela m&eacute;dia de ' +
    (F.length ? F[0] + '&ndash;' + F[F.length - 1] : 'meses fechados') + '. Nada aqui conta como estouro de or&ccedil;amento.';
}
/* Clareza: no mes de previsao mostra o peso das parcelas, sem "estourado" */
window.addEventListener('load', function () {
  if (typeof renderAgente === 'function') {
    var _ag = renderAgente;
    renderAgente = function () {
      var r = _ag.apply(this, arguments);
      try {
        var host = el('agente-nuna');
        if (host && mesPrevisao(state.mes)) {
          var g = gastoOf(state.mes, state.perfil), renda = rendaOf(state.mes, state.perfil);
          host.innerHTML = '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:var(--acc)"></span>' +
            '<span style="font-weight:700;letter-spacing:.04em;font-size:13px">CLAREZA &middot; PREVIS&Atilde;O</span>' +
            '<span style="font-size:13px;opacity:.9">' + brl(g) + ' j&aacute; comprometidos em parcelas' + (renda ? ' &middot; ' + Math.round(g / renda * 100) + '% da receita estimada (' + brl(renda) + ')' : '') + '</span></div>';
        }
      } catch (e) { console.warn(e); }
      return r;
    };
  }
  if (typeof renderKPI === 'function') {
    var _k = renderKPI;
    renderKPI = function () { var r = _k.apply(this, arguments); try { pcAvisoPrevisao(); } catch (e) {} return r; };
  }
  if (typeof orcMelhora === 'function') {
    var _o = orcMelhora;
    orcMelhora = function () {
      var r = _o.apply(this, arguments);
      try {
        if (!mesPrevisao(state.mes)) return r;
        var tb = el('bd-table') && el('bd-table').tBodies[0];
        if (tb) [].forEach.call(tb.rows, function (row) {
          if (row.id === 'bd-total') return;
          row.style.background = '';
          row.cells[row.cells.length - 1].innerHTML = '<span style="display:inline-block;font-size:11px;padding:2px 8px;border-radius:999px;border:1px dashed var(--tx3);color:var(--tx3)">previs&atilde;o</span>';
        });
        var cards = el('bd-cards');
        if (cards) { var v = cards.querySelectorAll('.val'), s = cards.querySelectorAll('.sub');
          [].forEach.call(v, function (x) { x.textContent = '—'; });
          [].forEach.call(s, function (x) { x.textContent = state.mes + ' é previsão'; }); }
      } catch (e) { console.warn(e); }
      return r;
    };
  }
});
(function () {
  var st = document.createElement('style');
  st.textContent = '.pill-prev{border-style:dashed!important;font-style:italic}' +
    '.pill-prev.on{font-style:normal}' +
    '#pc-prev-aviso{font-size:13px;margin:0 0 12px;padding:10px 14px;border-radius:10px;border:1px dashed var(--acc);background:var(--accL);color:var(--tx)}';
  document.head.appendChild(st);
})();
