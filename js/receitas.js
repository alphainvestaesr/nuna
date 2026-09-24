/* ============================================================
   NuNa · receitas.js — Receitas do mes (aba Dados)
   - Ana: anexa o PDF do contracheque; o site le vantagens,
     descontos e compensacoes, mostra para conferir e so grava
     depois da confirmacao. O mesmo contracheque nunca entra 2x.
   - Ana tambem lanca extras (Uber, 99, hora extra), que somam ao contracheque.
   - Manuela: informa valor + descricao; pode haver mais de uma
     receita no mes (o total do mes e a soma).
   - Meses novos (nov/2026 em diante) sao criados sozinhos.
   Grava na base (base_documento): months[m].receita,
   months[m].receitaItens, months[m].contracheques. Os descontos
   do contracheque entram como lancamentos importados.
   ============================================================ */
var RC_MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
var RC_FONTE_CC = 'Contracheque SDS-PE (Ana)';
var rcPendente = null;

/* ---------- rotulos de mes: 2026 = "Mar"; 2027 em diante = "Mar/27" ---------- */
function mesLabelDe(ano, n){ ano = +ano; n = +n; return ano === 2026 ? RC_MESES[n-1] : RC_MESES[n-1] + '/' + String(ano).slice(2); }
function mesLabelDeISO(iso){
  var p = String(iso || '').split('-'); if (p.length < 2) return null;
  var n = +p[1]; if (!(n >= 1 && n <= 12)) return null;
  return mesLabelDe(+p[0], n);
}
function mesOrdem(label){
  var p = String(label).split('/'); var i = RC_MESES.indexOf(p[0]);
  var ano = p[1] ? 2000 + (+p[1]) : 2026; return ano * 12 + i;
}
function mesNome(label){ return String(label).indexOf('/') > 0 ? String(label).replace('/', '/20') : label + '/2026'; }
/* ACABEI DE GASTAR passa a considerar o ano (marco/2027 nao cai em marco/2026) */
function agMesDe(iso){ return mesLabelDeISO(iso); }

/* ---------- helpers ---------- */
function rcNum(s){ return parseFloat(String(s || '').replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.')); }
function rcArred(v){ return Math.round(v * 100) / 100; }
function rcBaseClone(){ return JSON.parse(JSON.stringify(Store.base())); }
function rcHash(s){ var h = 0x811c9dc5; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = (h * 0x01000193) >>> 0; } return ('00000000' + h.toString(16)).slice(-8); }
function rcEu(){ return (Auth.sessao() || {}).perfil || 'Ana'; }

/* cria o mes (e os que faltarem no meio) na base */
function rcGarantirMes(b, label){
  if (b.months[label]) return false;
  var ult = b.monthOrder[b.monthOrder.length - 1], k = mesOrdem(ult) + 1, fim = mesOrdem(label);
  if (fim < mesOrdem(b.monthOrder[0])) { b.months[label] = { receita: { Ana: 0, Manuela: 0 }, transactions: [] }; b.monthOrder.unshift(label); return true; }
  for (; k <= fim; k++) {
    var lab = mesLabelDe(Math.floor(k / 12), (k % 12) + 1);
    if (!b.months[lab]) { b.months[lab] = { receita: { Ana: 0, Manuela: 0 }, transactions: [] }; b.monthOrder.push(lab); }
  }
  b.monthOrder.sort(function(x, y){ return mesOrdem(x) - mesOrdem(y); });
  return true;
}
/* receita do mes = contracheques (Ana) + receitas informadas (extras / valores da Manuela) */
function rcRecalcular(mm, perfil){
  var itens = (mm.receitaItens || []).filter(function(i){ return i.perfil === perfil; });
  var soma = itens.reduce(function(s, i){ return s + i.valor; }, 0);
  var cc = perfil === 'Ana' ? (mm.contracheques || []).reduce(function(s, c){ return s + (c.receita != null ? c.receita : (c.vantagens - (c.compensacoes || 0))); }, 0) : 0;
  mm.receita[perfil] = rcArred(cc + soma);
}
function rcMesesDisponiveis(){
  var l = MONTHS.slice(), h = new Date(), cur = h.getFullYear() * 12 + h.getMonth();
  var ult = mesOrdem(l[l.length - 1]);
  for (var k = ult + 1; k <= cur + 1; k++) l.push(mesLabelDe(Math.floor(k / 12), (k % 12) + 1));
  return l;
}
function rcMesPadrao(){ var h = new Date(); return mesLabelDe(h.getFullYear(), h.getMonth() + 1); }
function rcGravar(b, msg){
  return Promise.resolve(Store.definirBase(b)).then(function(){ return Store.sincronizar ? Store.sincronizar() : true; })
    .then(function(){ flashToast(msg); setTimeout(function(){ location.reload(); }, 1600); });
}

/* ---------- tela ---------- */
function rcRender(){
  var p = el('panel-dados'); if (!p || !Store.base()) return;
  var host = el('rc-card');
  if (!host) {
    host = document.createElement('div'); host.className = 'card'; host.id = 'rc-card'; host.style.marginBottom = '16px';
    var first = p.querySelector('.card'); if (first) first.insertAdjacentElement('beforebegin', host); else p.appendChild(host);
  }
  var eu = rcEu(), pad = rcMesPadrao();
  var opt = rcMesesDisponiveis().map(function(m){ return '<option value="' + m + '"' + (m === pad ? ' selected' : '') + '>' + mesNome(m) + '</option>'; }).join('');
  var h = '<h3>Receitas do m&ecirc;s &mdash; ' + esc(eu) + '</h3>';
  var form = '<div class="agform">' +
      '<label>M&ecirc;s<select id="rc-mes">' + opt + '</select></label>' +
      '<label>Valor (R$)<input id="rc-valor" type="text" inputmode="decimal" placeholder="0,00"></label>' +
      '<label>Descri&ccedil;&atilde;o<input id="rc-desc" type="text" placeholder="' + (eu === 'Ana' ? 'Uber, 99, hora extra&hellip;' : 'Sal&aacute;rio, dividendos&hellip;') + '"></label>' +
      '</div><button class="pill" id="rc-add" style="margin-top:10px">Adicionar receita</button>';
  if (eu === 'Ana') {
    h += '<p class="note"><b>Contracheque:</b> anexe o PDF. O site l&ecirc; as vantagens, os descontos e as compensa&ccedil;&otilde;es, mostra tudo para voc&ecirc; conferir e s&oacute; grava quando voc&ecirc; confirmar. O mesmo contracheque nunca entra duas vezes.</p>' +
      '<input type="file" id="rc-pdf" accept="application/pdf,.pdf"><div id="rc-prev" style="margin-top:10px"></div>' +
      '<p class="note" style="margin-top:16px"><b>Extras:</b> Uber, 99, hora extra e qualquer outro valor fora do contracheque. Cada lan&ccedil;amento soma na receita do m&ecirc;s.</p>' + form;
  } else {
    h += '<p class="note">Informe quanto voc&ecirc; recebeu. D&aacute; para lan&ccedil;ar mais de uma receita no mesmo m&ecirc;s (sal&aacute;rio, dividendos&hellip;): o total do m&ecirc;s &eacute; a soma. M&ecirc;s novo &eacute; criado sozinho.</p>' + form;
  }
  h += '<div id="rc-lista" style="margin-top:14px"></div>';
  host.innerHTML = h;
  rcRenderLista(eu);
  if (eu === 'Ana') el('rc-pdf').addEventListener('change', rcLerPDF);
  el('rc-add').addEventListener('click', rcAdicionarManual);
}
function rcRenderLista(eu){
  var b = Store.base();
  var rows = b.monthOrder.slice().reverse().map(function(m){
    var mm = b.months[m], rec = (mm.receita || {})[eu] || 0;
    var itens = (mm.receitaItens || []).filter(function(i){ return i.perfil === eu; });
    var partes = [];
    if (eu === 'Ana') (mm.contracheques || []).forEach(function(c){
      partes.push('contracheque ' + esc(c.competencia) + ' &middot; ' + brl(c.receita != null ? c.receita : (c.vantagens - (c.compensacoes || 0))) + (c.compensacoes ? ' (vantagens ' + brl(c.vantagens) + ' &minus; compensa&ccedil;&otilde;es ' + brl(c.compensacoes) + ')' : ''));
    });
    itens.forEach(function(i){ partes.push(esc(i.desc) + ' &middot; ' + brl(i.valor) + ' <button class="link" data-rm="' + esc(m) + '|' + esc(i.id) + '">remover</button>'); });
    var det = partes.length ? partes.join('<br>') : (rec ? 'lan&ccedil;ado antes desta tela' : '&mdash;');
    return '<tr><td>' + mesNome(m) + '</td><td class="num"><b>' + brl(rec) + '</b></td><td>' + det + '</td></tr>';
  }).join('');
  el('rc-lista').innerHTML = '<div class="scroll"><table><thead><tr><th>M&ecirc;s</th><th class="num">Receita</th><th>Detalhe</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
  [].forEach.call(el('rc-lista').querySelectorAll('[data-rm]'), function(bt){
    bt.onclick = function(){ var p = bt.dataset.rm.split('|'); rcRemoverItem(p[0], p[1]); };
  });
}

/* ---------- Manuela: valor informado ---------- */
function rcAdicionarManual(){
  var eu = rcEu(), m = el('rc-mes').value, v = rcNum(el('rc-valor').value);
  var d = el('rc-desc').value.trim() || 'Receita informada';
  if (!(v > 0)) { flashToast('Informe um valor maior que zero.'); el('rc-valor').focus(); return; }
  var b = rcBaseClone(); rcGarantirMes(b, m);
  var mm = b.months[m]; mm.receitaItens = mm.receitaItens || [];
  var temItens = mm.receitaItens.some(function(i){ return i.perfil === eu; });
  var temCC = eu === 'Ana' && (mm.contracheques || []).length > 0;
  var antigo = (mm.receita || {})[eu] || 0;
  if (!temItens && !temCC && antigo > 0) {
    var substituir = confirm(mesNome(m) + ' já tem ' + brl(antigo) + ' registrado.\n\nOK = SUBSTITUIR esse valor por ' + brl(v) + '\nCancelar = SOMAR ' + brl(v) + ' ao que já existe');
    if (!substituir) mm.receitaItens.push({ id: 'r' + Date.now().toString(36) + 'a', perfil: eu, valor: antigo, desc: 'Valor já registrado antes', origem: 'anterior', criadoEm: new Date().toISOString() });
  }
  mm.receitaItens.push({ id: 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), perfil: eu, valor: rcArred(v), desc: d, origem: 'informado', criadoEm: new Date().toISOString() });
  rcRecalcular(mm, eu);
  rcGravar(b, 'Receita de ' + brl(v) + ' lançada em ' + mesNome(m) + '. Total do mês: ' + brl(mm.receita[eu]) + '.');
}
function rcRemoverItem(m, id){
  if (!confirm('Remover esta receita?')) return;
  var eu = rcEu(), b = rcBaseClone(), mm = b.months[m];
  mm.receitaItens = (mm.receitaItens || []).filter(function(i){ return i.id !== id; });
  rcRecalcular(mm, eu);
  rcGravar(b, 'Receita removida. Total de ' + mesNome(m) + ': ' + brl(mm.receita[eu]) + '.');
}

/* ---------- Ana: contracheque em PDF ---------- */
function rcCarregarPdfJs(){
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  return new Promise(function(ok, err){
    var s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js';
    s.onload = function(){ window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js'; ok(window.pdfjsLib); };
    s.onerror = function(){ err(new Error('Não consegui carregar o leitor de PDF. Verifique a internet e tente de novo.')); };
    document.head.appendChild(s);
  });
}
function rcTextoPDF(buf){
  return rcCarregarPdfJs().then(function(lib){ return lib.getDocument({ data: buf }).promise; }).then(function(pdf){
    var ps = []; for (var i = 1; i <= pdf.numPages; i++) ps.push(pdf.getPage(i).then(function(pg){ return pg.getTextContent(); }));
    return Promise.all(ps);
  }).then(function(conts){
    var linhas = [];
    conts.forEach(function(c){
      var ys = [], porY = {};
      c.items.forEach(function(it){
        if (!it.str || !it.str.trim()) return;
        var y = it.transform[5], k = null;
        for (var j = 0; j < ys.length; j++) if (Math.abs(ys[j] - y) <= 2.5) { k = ys[j]; break; }
        if (k === null) { k = y; ys.push(y); porY[k] = []; }
        porY[k].push({ x: it.transform[4], s: it.str.trim() });
      });
      ys.sort(function(a, b){ return b - a; }).forEach(function(y){
        linhas.push(porY[y].sort(function(a, b){ return a.x - b.x; }).map(function(o){ return o.s; }).join(' ').replace(/\s+/g, ' '));
      });
    });
    return linhas;
  });
}
function rcCategoria(nome){
  var n = String(nome).toUpperCase();
  if (/FUNAPREV/.test(n)) return { desc: 'FUNAPREV - Previdencia 14%', plano: 'Funaprev', tipo: 'Funaprev' };
  if (/IMPOSTO|IRRF/.test(n)) return { desc: 'Imposto de Renda retido na fonte', plano: 'Outros', tipo: 'Imposto de Renda' };
  if (/BRADESCO|CONSIG|EMPREST/.test(n)) return { desc: 'Emprestimo Consignado Bradesco', plano: 'Bradesco', tipo: 'Emprestimo consignado' };
  if (/SINPOL|APEMEPE|SINDIC/.test(n)) return { desc: 'SINPOL - Sindicato dos Policiais Civis PE (mensalidade)', plano: 'Sinpol / Apemepe', tipo: 'Sinpol / Apemepe' };
  return null;
}
function rcParseContracheque(linhas){
  var txt = linhas.join('\n');
  var comp = txt.match(/\b(JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)\/(20\d\d)\b/);
  var tot = txt.match(/VANTAGENS\s+DESCONTOS\s+L[IÍ]QUIDO\s+R\$\s*([\d.]+,\d{2})\s+R\$\s*([\d.]+,\d{2})\s+R\$\s*([\d.]+,\d{2})/i);
  var cod = txt.match(/autenticidade:\s*([A-Z0-9]{6,})/i);
  if (!comp || !tot) return { erro: 'Não reconheci este PDF como contracheque (não achei a competência ou os totais). Se for um contracheque, me mande no chat que eu lanço.' };
  var r = { competencia: comp[1] + '/' + comp[2], ano: +comp[2], mesN: RC_MESES.map(function(x){ return x.toUpperCase(); }).indexOf(comp[1]) + 1,
    vantagens: rcNum(tot[1]), descontos: rcNum(tot[2]), liquido: rcNum(tot[3]), codigo: cod ? cod[1] : '', rubricas: [] };
  var vistos = {};
  linhas.forEach(function(l){
    var m = l.match(/^(\d{2,5})\s*-\s*(.+?)\s+\d\s+.*?(\d{2}\/\d{2})\s+R\$\s*([\d.]+,\d{2})\s*$/);
    if (!m || vistos[l]) return; vistos[l] = 1;
    var c = +m[1];
    r.rubricas.push({ codigo: c, nome: m[2].trim(), valor: rcNum(m[4]), desconto: c >= 4000 });
  });
  var sv = 0, sd = 0; r.rubricas.forEach(function(x){ if (x.desconto) sd += x.valor; else sv += x.valor; });
  r.confere = Math.abs(sv - r.vantagens) < 0.02 && Math.abs(sd - r.descontos) < 0.02;
  return r;
}
function rcMontarPendente(r){
  var label = mesLabelDe(r.ano, r.mesN), b = Store.base(), mm = b.months[label];
  var data = '01/' + ('0' + r.mesN).slice(-2) + '/' + String(r.ano).slice(2);
  var compens = 0, lanc = [];
  function tx(desc, plano, tipo, valor, revisar){
    var key = [label, RC_FONTE_CC, data, desc.toUpperCase(), valor.toFixed(2)].join('|'), uid = 'cc-' + rcHash(key);
    return { mes: label, data: data, perfil: 'Ana', raw: desc, desc: desc, tipo: tipo, grupo: null, plano: plano, planoOrig: plano, grupoOrig: null,
      valor: rcArred(valor), fonte: 'Contracheque', cartao: '', fonteLabel: RC_FONTE_CC, fontePendente: false, revisar: !!revisar, status: '',
      divisao: 'INDIVIDUAL', contrib: false, possivelDup: false, id: uid, uid: uid, dedupKey: key, ordinal: 1, origem: 'contracheque',
      importadoEm: new Date().toISOString() };
  }
  if (r.confere) {
    r.rubricas.filter(function(x){ return x.desconto; }).forEach(function(x){
      if (/COMPENS|ESTORNO|DEVOLU/i.test(x.nome)) { compens += x.valor; return; }
      var c = rcCategoria(x.nome);
      lanc.push(c ? tx(c.desc, c.plano, c.tipo, x.valor, false) : tx(x.nome, 'Outros', 'Outros', x.valor, true));
    });
  } else {
    lanc.push(tx('Descontos do contracheque ' + r.competencia + ' (conferir)', 'Outros', 'Outros', r.descontos, true));
  }
  var receita = rcArred(r.vantagens - compens);
  var ja = !!(mm && (mm.contracheques || []).some(function(c){ return (r.codigo && c.codigo === r.codigo) || c.competencia === r.competencia; }));
  var imp = Store.get(K.IMPORTADOS, []);
  var temDescontos = !!(mm && mm.transactions.concat(imp.filter(function(t){ return t.mes === label; })).some(function(t){ return t.fonteLabel === RC_FONTE_CC; }));
  return { r: r, label: label, compens: rcArred(compens), receita: receita, lanc: lanc, ja: ja, temDescontos: temDescontos,
    receitaAtual: mm ? rcArred(((mm.receita || {}).Ana || 0) - (mm.receitaItens || []).filter(function(i){ return i.perfil === 'Ana' && i.origem !== 'anterior'; }).reduce(function(s, i){ return s + i.valor; }, 0)) : 0, mesNovo: !mm };
}
function rcLerPDF(e){
  var f = e.target.files && e.target.files[0]; if (!f) return;
  rcPendente = null;
  el('rc-prev').innerHTML = '<p class="note">Lendo o contracheque&hellip;</p>';
  f.arrayBuffer().then(rcTextoPDF).then(function(linhas){
    var r = rcParseContracheque(linhas);
    if (r.erro) { el('rc-prev').innerHTML = '<p class="note" style="color:var(--neg)">' + esc(r.erro) + '</p>'; return; }
    var P = rcMontarPendente(r); rcPendente = P;
    var avisos = [];
    if (!r.confere) avisos.push('As linhas do contracheque n&atilde;o fecharam com os totais. Vou lan&ccedil;ar a receita pelo total de vantagens e os descontos numa linha s&oacute;, marcada para revisar.');
    if (P.mesNovo) avisos.push('O m&ecirc;s ' + mesNome(P.label) + ' ainda n&atilde;o existe no site e ser&aacute; criado.');
    var acao = true;
    if (P.ja) { avisos.push('<b>Este contracheque j&aacute; foi lan&ccedil;ado.</b> Nada ser&aacute; gravado de novo.'); acao = false; }
    else if (P.temDescontos) {
      if (Math.abs(P.receitaAtual - P.receita) < 0.01) avisos.push('Este m&ecirc;s j&aacute; estava lan&ccedil;ado com os mesmos valores. Confirmar s&oacute; registra o contracheque, para ele nunca entrar em dobro.');
      else avisos.push('Este m&ecirc;s j&aacute; tem receita (' + brl(P.receitaAtual) + ') e descontos lan&ccedil;ados. Confirmar <b>substitui a receita</b> por ' + brl(P.receita) + '; os descontos que j&aacute; est&atilde;o l&aacute; s&atilde;o mantidos, sem duplicar.');
    }
    var linhasDesc = P.temDescontos ? '<tr><td colspan="2" style="color:var(--tx3)">descontos j&aacute; lan&ccedil;ados neste m&ecirc;s &mdash; n&atilde;o entram de novo</td></tr>'
      : P.lanc.map(function(t){ return '<tr><td>' + esc(t.desc) + (t.revisar ? ' <span class="badge b-warn">revisar</span>' : '') + '</td><td class="num">' + brl(t.valor) + '</td></tr>'; }).join('');
    el('rc-prev').innerHTML =
      '<div class="grid3" style="margin:8px 0">' +
      kpiCard('Compet&ecirc;ncia', esc(r.competencia), 'vai para ' + mesNome(P.label), '') +
      kpiCard('Receita que entra', brl(P.receita), 'vantagens ' + brl(r.vantagens) + (P.compens ? ' &minus; compensa&ccedil;&otilde;es ' + brl(P.compens) : ''), 'green') +
      kpiCard('L&iacute;quido do contracheque', brl(r.liquido), 'descontos ' + brl(r.descontos), '') +
      '</div>' +
      '<div class="scroll"><table><thead><tr><th>Desconto (vira despesa individual)</th><th class="num">Valor</th></tr></thead><tbody>' + linhasDesc + '</tbody></table></div>' +
      (avisos.length ? '<p class="note">' + avisos.join('<br>') + '</p>' : '') +
      (acao ? '<button class="pill" id="rc-ok" style="margin-top:8px">Confirmar e gravar</button> <button class="pill" id="rc-cancel" style="margin-top:8px">Cancelar</button>' : '');
    if (acao) {
      el('rc-ok').onclick = rcConfirmar;
      el('rc-cancel').onclick = function(){ rcPendente = null; el('rc-prev').innerHTML = ''; el('rc-pdf').value = ''; };
    }
  }).catch(function(err){ el('rc-prev').innerHTML = '<p class="note" style="color:var(--neg)">' + esc(err && err.message || String(err)) + '</p>'; });
}
function rcConfirmar(){
  var P = rcPendente; if (!P || P.ja) return;
  el('rc-ok').disabled = true;
  var b = rcBaseClone(); rcGarantirMes(b, P.label);
  var mm = b.months[P.label];
  mm.contracheques = (mm.contracheques || []).concat([{ competencia: P.r.competencia, codigo: P.r.codigo, vantagens: P.r.vantagens,
    descontos: P.r.descontos, liquido: P.r.liquido, compensacoes: P.compens, receita: P.receita, lidoEm: new Date().toISOString() }]);
  /* o contracheque substitui valor antigo lancado a mao; extras continuam somando */
  mm.receitaItens = (mm.receitaItens || []).filter(function(i){ return !(i.perfil === 'Ana' && i.origem === 'anterior'); });
  rcRecalcular(mm, 'Ana');
  if (P.compens > 0) mm.receitaNota = 'Contracheque ' + P.r.competencia + ': vantagens ' + brl(P.r.vantagens) + ' menos ' + brl(P.compens) + ' de compensações.';
  var novos = P.temDescontos ? [] : P.lanc;
  Promise.resolve(Store.definirBase(b)).then(function(){
    if (novos.length) {
      var g = Store.get(K.IMPORTADOS, []), vistos = {};
      g.forEach(function(t){ vistos[t.uid] = 1; });
      novos.forEach(function(t){ if (!vistos[t.uid]) g.push(t); });
      Store.set(K.IMPORTADOS, g);
    }
    return Store.sincronizar ? Store.sincronizar() : true;
  }).then(function(){
    flashToast('Contracheque ' + P.r.competencia + ' lançado: receita ' + brl(P.receita) + ', líquido ' + brl(P.r.liquido) + '.');
    setTimeout(function(){ location.reload(); }, 1600);
  });
}

/* ---------- liga a tela na aba Dados ---------- */
(function(){
  if (typeof renderDados !== 'function') return;
  var original = renderDados;
  renderDados = function(){ original.apply(this, arguments); try { rcRender(); } catch (e) { console.error('receitas', e); } };
})();
