/* NuNa - resgate.js: alerta "Modo Resgate" no topo da aba Insights.
   Diagnostico e plano de acao montados sozinhos, por perfil, com os dados
   dos ultimos 3 meses fechados - incluindo tudo o que for lancado a mao
   (ACABEI DE GASTAR, Pix, boleto, debito, dinheiro), porque tudo vem de
   txOf/gastoOf/splitOf. Cada item so aparece se o problema existir. */
var RG_TAXAS = { parcelamento: '12,5%', rotativo: '14,99%' };   /* fatura Bradesco set/2026 */
var RG_TETO_SUPERFLUO = 600;                                   /* por pessoa, por mes */
var RG_SUPERFLUOS = ['Compras', 'Alimentacao Fora', 'Transferencia a pessoas'];
var RG_FOLHA = /Funaprev|Imposto de Renda|consignado|Sinpol/i;

function rgCss(){
  if (document.getElementById('rg-css')) return;
  var st = document.createElement('style'); st.id = 'rg-css';
  st.textContent =
    '.rg{border:2px solid var(--neg);background:var(--negL);border-radius:14px;padding:18px 20px;margin-bottom:18px}' +
    '.rg.ok{border-color:var(--pos);background:var(--posL)}' +
    '.rg .flag{display:inline-block;background:var(--neg);color:#fff;font-weight:800;font-size:12px;letter-spacing:.08em;padding:4px 10px;border-radius:6px}' +
    '.rg.ok .flag{background:var(--pos)}' +
    '.rg .big{font-size:22px;font-weight:800;margin:12px 0 4px;line-height:1.25}' +
    '.rg .big .r{color:var(--neg)}.rg .big .g{color:var(--pos)}' +
    '.rg .lead{color:var(--tx2);margin:0 0 12px}' +
    '.rg h3{font-size:13px;text-transform:uppercase;letter-spacing:.05em;color:var(--tx2);margin:18px 0 8px}' +
    '.rg ul{margin:0;padding-left:20px}.rg li{margin:7px 0}' +
    '.rg .ac{display:grid;grid-template-columns:28px 1fr auto;gap:10px;align-items:start;padding:10px 0;border-top:1px solid var(--border)}' +
    '.rg .ac:first-of-type{border-top:0}' +
    '.rg .n{width:24px;height:24px;border-radius:50%;background:var(--neg);color:#fff;font-weight:800;font-size:12px;display:grid;place-items:center}' +
    '.rg .imp{font-weight:800;color:var(--pos);white-space:nowrap}' +
    '.rg .tot,.rg .proib{margin-top:12px;padding:10px 12px;border-radius:8px;background:var(--card);border:1px solid var(--border)}' +
    '.rg .proib{border-left:3px solid var(--neg)}' +
    '.rg .rxw{overflow-x:auto}.rg table{width:100%;border-collapse:collapse;font-size:13px;background:var(--card);border-radius:8px}' +
    '.rg th,.rg td{padding:7px 10px;border-bottom:1px solid var(--border);text-align:right;white-space:nowrap}' +
    '.rg th:first-child,.rg td:first-child{text-align:left;color:var(--tx2);white-space:normal}' +
    '.rg td.b{color:var(--neg);font-weight:700}.rg td.g{color:var(--pos);font-weight:700}' +
    '@media (max-width:520px){.rg .ac{grid-template-columns:24px 1fr}.rg .imp{grid-column:2}}';
  document.head.appendChild(st);
}
function rgR(v){ return brl(Math.round(v)).replace(/,00$/, ''); }
function rgCents(v){ return 'R$ ' + v.toFixed(2).replace('.', ','); }

/* numeros-base de um perfil nos ultimos meses fechados */
function rgBase(){
  var L = CLOSED.slice(-3); if (!L.length) return null;
  var av = function(f){ return L.reduce(function(s, m){ return s + (f(m) || 0); }, 0) / L.length; };
  var tipoInd = function(p, teste){ return av(function(m){ return txOf(m, p).filter(function(t){ return !t.grupo && teste(t.tipo || ''); }).reduce(function(s, t){ return s + t.valor; }, 0); }); };
  var pessoa = function(p){
    var o = {
      renda: av(function(m){ return rendaOf(m, p); }),
      rendaUlt: rendaOf(L[L.length - 1], p),
      ind: av(function(m){ return splitOf(m, p).ind; }),
      contr: av(function(m){ return contribTotalOf(m, p); }),
      saldo: av(function(m){ return saldoOf(m, p); }),
      folha: tipoInd(p, function(x){ return RG_FOLHA.test(x); }),
      p99: tipoInd(p, function(x){ return /99Pay/i.test(x); }),
      juros: tipoInd(p, function(x){ return /Divida/i.test(x); }),
      sup: tipoInd(p, function(x){ return RG_SUPERFLUOS.indexOf(x) >= 0; })
    };
    o.razao = o.renda ? (o.ind + o.contr) / o.renda : 0;
    return o;
  };
  var b = { L: L, Ana: pessoa('Ana'), Manuela: pessoa('Manuela') };
  b.conj = av(function(m){ return gastoOf(m, 'NuNa'); });
  var mediaTodos = CLOSED.reduce(function(s, m){ return s + gastoOf(m, 'NuNa'); }, 0) / CLOSED.length;
  b.conjVar = mediaTodos ? Math.round((b.conj / mediaTodos - 1) * 100) : 0;
  b.merc = av(function(m){ return txOf(m, 'NuNa').filter(function(t){ return t.tipo === 'Supermercado'; }).reduce(function(s, t){ return s + t.valor; }, 0); });
  var orc = (DATA.budgets && DATA.budgets.NuNa) || {};
  b.orc = orc;
  b.orcMerc = orc['Alimentação'] || 0;
  b.tetoMerc = b.orcMerc ? Math.max(b.orcMerc, Math.ceil(b.merc * 0.7 / 100) * 100) : Math.ceil(b.merc * 0.7 / 100) * 100;
  b.corteMerc = Math.max(0, b.merc - b.tetoMerc);
  b.casalRenda = b.Ana.renda + b.Manuela.renda;
  b.casalSaldo = av(function(m){ return caixaCasal(m); });
  b.casalGasto = b.casalRenda - b.casalSaldo;
  b.parte = { Ana: SPLIT.Ana * b.conj, Manuela: SPLIT.Manuela * b.conj };
  /* parcelas ainda por vir, estimadas pelas faturas importadas do ultimo mes */
  var ult = MONTHS[MONTHS.length - 1], parc = 0;
  (DATA.months[ult].transactions || []).forEach(function(t){
    var s = String(t.raw || t.desc || '');
    var m = s.match(/parcela\s*(\d{1,2})\s*de\s*(\d{1,2})/i) || s.match(/\(?\b(\d{1,2})\s*\/\s*(\d{1,2})\)?\s*$/);
    if (m && +m[2] >= 2 && +m[1] < +m[2]) parc += (+m[2] - +m[1]) * t.valor;
  });
  b.parcelas = parc;
  /* meses em aberto: grupos da casa acima do orcamento */
  b.abertos = MONTHS.filter(function(m){ return CLOSED.indexOf(m) < 0; }).map(function(m){
    var acima = Object.keys(orc).map(function(g){
      var v = txOf(m, 'NuNa').filter(function(t){ return t.grupo === g; }).reduce(function(s, t){ return s + t.valor; }, 0);
      return [g, v, orc[g]]; }).filter(function(x){ return x[2] > 0 && x[1] > x[2] * 1.05; })
      .sort(function(x, y){ return (y[1] / y[2]) - (x[1] / x[2]); });
    return { mes: m, acima: acima };
  }).filter(function(x){ return x.acima.length; });
  return b;
}

function rgAcoes(lista){
  return lista.map(function(a, i){
    return '<div class="ac"><span class="n">' + (i + 1) + '</span><div>' + a[0] + '</div><span class="imp">' + a[1] + '</span></div>';
  }).join('');
}
function rgProibido(){
  return '<div class="proib"><b>Proibido:</b> pagar s&oacute; o m&iacute;nimo ou parcelar a fatura. Na fatura, o parcelamento cobra <b>' + RG_TAXAS.parcelamento +
    ' ao m&ecirc;s</b> e o rotativo <b>' + RG_TAXAS.rotativo + ' ao m&ecirc;s</b>. &Eacute; a forma mais cara de dinheiro que existe.</div>';
}
function rgPeriodo(b){ return b.L[0] + ' a ' + b.L[b.L.length - 1]; }

function renderResgate(){
  var box = el('in-resgate'); if (!box) return;
  rgCss();
  var b = rgBase(); if (!b) { box.innerHTML = ''; return; }
  var p = state.perfil, html = '';
  var A = b.Ana, M = b.Manuela;
  var pctAna = b.conj ? Math.round(A.contr / b.conj * 100) : 0, pctManu = b.conj ? Math.round(M.contr / b.conj * 100) : 0;
  var splitFora = M.contr < b.parte.Manuela * 0.8 && b.conj > 0;
  var ganhoSplit = Math.max(0, b.parte.Manuela - M.contr);
  var labSplit = Math.round(SPLIT.Ana * 100) + '/' + Math.round(SPLIT.Manuela * 100);

  if (p === 'Ana' || p === 'Manuela') {
    var eu = b[p], outra = p === 'Ana' ? M : A, nomeOutra = p === 'Ana' ? 'Manuela' : 'Ana';
    var vermelho = eu.saldo < 0, casaVermelha = b.casalSaldo < 0;
    if (!vermelho && !casaVermelha) {
      box.innerHTML = '<div class="rg ok"><span class="flag">MANTER O RUMO</span><div class="big">Voc&ecirc; gasta <span class="g">' + rgCents(eu.razao) +
        '</span> para cada R$ 1 que recebe.</div><p class="lead">Os &uacute;ltimos meses fecharam no azul, e a casa tamb&eacute;m. Segure os tetos e continue lan&ccedil;ando tudo no NuNa.</p></div>';
      return;
    }
    var pq = [], ac = [], proj = eu.saldo;
    if (p === 'Ana') {
      html += '<div class="big">Voc&ecirc; gasta <span class="r">' + rgCents(eu.razao) + '</span> para cada R$ 1 que recebe.</div>';
      html += '<p class="lead">' + (vermelho
        ? 'Nos &uacute;ltimos 3 meses (' + rgPeriodo(b) + ') faltaram <b>' + rgR(-eu.saldo) + ' por m&ecirc;s</b>. Esse dinheiro n&atilde;o existe: est&aacute; saindo do cart&atilde;o, e o cart&atilde;o cobra de volta com juros. Do jeito que est&aacute;, n&atilde;o fecha. N&atilde;o &eacute; quest&atilde;o de apertar um pouco, &eacute; mudar a estrutura.'
        : 'Voc&ecirc; fecha no azul, mas a casa est&aacute; no vermelho.') + '</p>';
    } else {
      html += '<div class="big">' + (vermelho
        ? 'Voc&ecirc; gasta <span class="r">' + rgCents(eu.razao) + '</span> para cada R$ 1 que recebe.'
        : 'Voc&ecirc; fecha o m&ecirc;s no azul (<span class="g">+' + rgR(eu.saldo) + '</span>), mas a casa est&aacute; no vermelho.') + '</div>';
      html += '<p class="lead">Voc&ecirc; gasta ' + rgCents(eu.razao) + ' para cada R$ 1 que recebe. A ' + nomeOutra + ' gasta ' + rgCents(outra.razao) +
        '. A conta da casa n&atilde;o fecha enquanto quase tudo sai de uma pessoa s&oacute;.</p>';
    }
    /* por que */
    if (splitFora) {
      if (p === 'Ana') {
        pq.push('<b>Voc&ecirc; banca a casa praticamente sozinha.</b> Coloca ' + rgR(A.contr) + '/m&ecirc;s nas contas conjuntas (' + pctAna + '%).' +
          (A.folha > 0 ? ' Depois dos descontos em folha (' + rgR(A.folha) + '), sobram cerca de ' + rgR(A.renda - A.folha) + ' da sua renda' +
            (A.renda - A.folha < A.contr ? ', <b>menos do que voc&ecirc; p&otilde;e s&oacute; na casa</b>' : '') + '.' : ''));
        pq.push('<b>O acordo ' + labSplit + ' n&atilde;o est&aacute; sendo cumprido.</b> A parte da Manuela seria ~' + rgR(b.parte.Manuela) + '/m&ecirc;s. Entraram ' + rgR(M.contr) + '/m&ecirc;s.');
      } else {
        pq.push('<b>O acordo ' + labSplit + ' n&atilde;o est&aacute; sendo cumprido.</b> Sua parte das contas conjuntas seria ~' + rgR(b.parte.Manuela) + '/m&ecirc;s. Entraram ' + rgR(M.contr) + '/m&ecirc;s. A Ana cobre ' + pctAna + '%.');
        if (M.rendaUlt > M.renda * 1.1) pq.push('<b>Sua renda subiu para ' + rgR(M.rendaUlt) + '</b> no &uacute;ltimo m&ecirc;s fechado, e a contribui&ccedil;&atilde;o n&atilde;o acompanhou.');
      }
    }
    if (eu.p99 > 100) pq.push('<b>Boletos pagos no cart&atilde;o via 99Pay: ' + rgR(eu.p99) + '/m&ecirc;s.</b> Isso n&atilde;o paga a conta, s&oacute; joga para a pr&oacute;xima fatura.');
    if (eu.sup > RG_TETO_SUPERFLUO) pq.push('<b>Compras, comer fora e transfer&ecirc;ncias: ' + rgR(eu.sup) + '/m&ecirc;s.</b>');
    if (b.corteMerc > 0) pq.push('<b>Supermercado da casa: ' + rgR(b.merc) + '/m&ecirc;s</b>' + (b.orcMerc ? ', contra um or&ccedil;amento de ' + rgR(b.orcMerc) : '') + '.');
    if (eu.juros > 50 || b.parcelas > 2000) pq.push((eu.juros > 50 ? '<b>Juros e encargos: ' + rgR(eu.juros) + '/m&ecirc;s</b>' : '') +
      (eu.juros > 50 && b.parcelas > 2000 ? ', e ' : '') + (b.parcelas > 2000 ? (eu.juros > 50 ? 'as' : 'As') + ' pr&oacute;ximas faturas j&aacute; t&ecirc;m <b>~' + rgR(b.parcelas) + ' em parcelas</b> comprometidas' : '') + '.');
    /* o que fazer */
    if (splitFora) {
      if (p === 'Ana') { ac.push(['<b>Cobrar o ' + labSplit + ' a partir deste m&ecirc;s.</b> A parte da Manuela &eacute; ~' + rgR(b.parte.Manuela) + '.', '+' + rgR(ganhoSplit) + '/m&ecirc;s']); proj += ganhoSplit; }
      else ac.push(['<b>Contribuir com ~' + rgR(b.parte.Manuela) + ' todo m&ecirc;s</b> e registrar no bot&atilde;o CONTRIBUI&Ccedil;&Atilde;O. &Eacute; a a&ccedil;&atilde;o n&uacute;mero 1 do plano da casa.', '+' + rgR(ganhoSplit) + '/m&ecirc;s para a casa']);
    }
    if (eu.p99 > 100) ac.push(['<b>Parar de pagar boleto com cart&atilde;o pelo 99Pay.</b> Listar o que s&atilde;o esses ' + rgR(eu.p99) + ' e cortar o que n&atilde;o &eacute; essencial.', 'corta taxa e juros']);
    if (eu.sup > RG_TETO_SUPERFLUO) { ac.push(['<b>Teto de ' + rgR(RG_TETO_SUPERFLUO) + ' para compras, comer fora e transfer&ecirc;ncias a pessoas.</b>', '&minus;' + rgR(eu.sup - RG_TETO_SUPERFLUO) + '/m&ecirc;s']); proj += eu.sup - RG_TETO_SUPERFLUO; }
    if (b.corteMerc > 0) {
      var minha = b.corteMerc * SPLIT[p];
      ac.push(['<b>' + (p === 'Ana' ? 'Teto de ' : 'Ajudar a segurar o teto de ') + rgR(b.tetoMerc) + ' no supermercado da casa.</b> Lista fechada e compra grande quinzenal. A casa economiza ' + rgR(b.corteMerc) + '; a sua parte cai ' + rgR(minha) + '.', '&minus;' + rgR(minha) + '/m&ecirc;s']);
      if (p === 'Ana') proj += minha;
    }
    if (b.parcelas > 2000) ac.push(['<b>Zero parcelamento novo</b>' + (p === 'Manuela' ? ' no seu cart&atilde;o' : '') + ' at&eacute; as parcelas comprometidas ca&iacute;rem abaixo de R$ 2.000.', 'trava a bola de neve']);
    if (p === 'Ana' && vermelho) ac.push(['<b>Lan&ccedil;ar toda renda extra (Uber, 99, hora extra) no NuNa</b> e direcionar para quitar o cart&atilde;o.', 'reduz o rombo']);
    if (pq.length) html += '<h3>Por que est&aacute; assim</h3><ul>' + pq.map(function(x){ return '<li>' + x + '</li>'; }).join('') + '</ul>';
    if (ac.length) html += '<h3>O que fazer, em ordem</h3>' + rgAcoes(ac);
    if (p === 'Ana' && vermelho && proj > eu.saldo)
      html += '<div class="tot">Com essas a&ccedil;&otilde;es, o seu rombo cai de <b>' + rgR(-eu.saldo) + '</b> para cerca de <b>' + rgR(Math.max(0, -proj)) + '/m&ecirc;s</b>' +
        (proj < 0 ? '. O resto sai do corte nos boletos e de renda extra lan&ccedil;ada no NuNa.' : '.') + '</div>';
    if (vermelho) html += rgProibido();
    box.innerHTML = '<div class="rg"><span class="flag">ALERTA &middot; MODO RESGATE</span>' + html + '</div>';
    return;
  }

  /* ---------- perfil conjunto: fala com "voces" ---------- */
  if (b.casalSaldo >= 0) {
    box.innerHTML = '<div class="rg ok"><span class="flag">MANTER O RUMO</span><div class="big">Voc&ecirc;s gastam <span class="g">' + rgCents(b.casalGasto / b.casalRenda) +
      '</span> para cada R$ 1 que recebem.</div><p class="lead">A casa fechou os &uacute;ltimos meses no azul. Mantenham o ' + labSplit + ', os tetos e o registro de tudo no NuNa.</p></div>';
    return;
  }
  html += '<div class="big">Voc&ecirc;s gastam <span class="r">' + rgCents(b.casalGasto / b.casalRenda) + '</span> para cada R$ 1 que recebem.</div>';
  html += '<p class="lead">Somando as duas, faltaram <b>' + rgR(-b.casalSaldo) + ' por m&ecirc;s</b> nos &uacute;ltimos 3 meses (' + rgPeriodo(b) + ').' +
    (A.saldo < 0 && M.saldo >= 0 ? ' Esse buraco est&aacute; sendo coberto pelo cart&atilde;o da Ana, com juros. Do jeito que est&aacute;, n&atilde;o fecha, e o peso est&aacute; todo em uma pessoa.' : ' Do jeito que est&aacute;, n&atilde;o fecha.') + '</p>';
  /* raio-x */
  var c = function(v, cls){ return '<td' + (cls ? ' class="' + cls + '"' : '') + '>' + v + '</td>'; };
  var sinal = function(v){ return (v < 0 ? '&minus;' : '+') + rgR(Math.abs(v)); };
  html += '<h3>Raio-X das duas (m&eacute;dia por m&ecirc;s)</h3><div class="rxw"><table><thead><tr><th></th><th>Ana</th><th>Manuela</th><th>Casa</th></tr></thead><tbody>' +
    '<tr><td>Renda</td>' + c(rgR(A.renda)) + c(rgR(M.renda) + (M.rendaUlt > M.renda * 1.1 ? ' <small>(' + rgR(M.rendaUlt) + ' no &uacute;ltimo m&ecirc;s)</small>' : '')) + c(rgR(b.casalRenda)) + '</tr>' +
    (A.folha > 0 || M.folha > 0 ? '<tr><td>Descontos em folha</td>' + c(A.folha > 0 ? rgR(A.folha) : '&mdash;') + c(M.folha > 0 ? rgR(M.folha) : '&mdash;') + c('') + '</tr>' : '') +
    '<tr><td>Gastos individuais</td>' + c(rgR(A.ind)) + c(rgR(M.ind)) + c(rgR(A.ind + M.ind)) + '</tr>' +
    '<tr><td>Contas da casa</td>' + c('') + c('') + c(rgR(b.conj)) + '</tr>' +
    '<tr><td>Parte pelo acordo ' + labSplit + '</td>' + c(rgR(b.parte.Ana)) + c(rgR(b.parte.Manuela)) + c('') + '</tr>' +
    '<tr><td>Quanto cada uma colocou</td>' + c(rgR(A.contr) + ' (' + pctAna + '%)', splitFora ? 'b' : '') + c(rgR(M.contr) + ' (' + pctManu + '%)', splitFora ? 'b' : '') + c(rgR(A.contr + M.contr)) + '</tr>' +
    '<tr><td>Saldo</td>' + c(sinal(A.saldo), A.saldo < 0 ? 'b' : 'g') + c(sinal(M.saldo), M.saldo < 0 ? 'b' : 'g') + c(sinal(b.casalSaldo), b.casalSaldo < 0 ? 'b' : 'g') + '</tr>' +
    '</tbody></table></div>';
  /* por que */
  var pqc = [], supTot = A.sup + M.sup, p99Tot = A.p99 + M.p99, jurTot = A.juros + M.juros;
  if (splitFora) pqc.push('<b>Voc&ecirc;s combinaram ' + labSplit + ', mas na pr&aacute;tica est&aacute; ' + pctAna + '/' + pctManu + '.</b> A Ana coloca ' + rgR(Math.max(0, A.contr - b.parte.Ana)) +
    '/m&ecirc;s a mais do que a parte dela, e a Manuela ' + rgR(ganhoSplit) + '/m&ecirc;s a menos.' + (A.saldo < 0 && M.saldo >= 0 ? ' A Ana paga a diferen&ccedil;a no cart&atilde;o enquanto a Manuela fecha o m&ecirc;s no azul.' : ''));
  pqc.push('<b>A casa custa ' + rgR(b.conj) + '/m&ecirc;s</b>, ' + Math.round(b.conj / b.casalRenda * 100) + '% de tudo que voc&ecirc;s recebem' +
    (b.conjVar > 5 ? ', e est&aacute; ' + b.conjVar + '% acima da m&eacute;dia do per&iacute;odo' : '') + '.');
  if (b.corteMerc > 0) pqc.push('<b>Supermercado: ' + rgR(b.merc) + '/m&ecirc;s</b>' + (b.orcMerc ? ', contra um or&ccedil;amento de ' + rgR(b.orcMerc) : '') + '.');
  if (supTot > RG_TETO_SUPERFLUO) pqc.push('<b>Compras, comer fora e transfer&ecirc;ncias: ' + rgR(supTot) + '/m&ecirc;s</b> somando as duas (Ana ' + rgR(A.sup) + ', Manuela ' + rgR(M.sup) + ').');
  if (p99Tot > 100 || jurTot > 50) pqc.push((p99Tot > 100 ? '<b>' + rgR(p99Tot) + '/m&ecirc;s em boletos v&atilde;o para o cart&atilde;o pelo 99Pay</b>' : '') +
    (p99Tot > 100 && jurTot > 50 ? ', e mais ' : '') + (jurTot > 50 ? '<b>' + rgR(jurTot) + '/m&ecirc;s em juros e encargos</b>' : '') + '.');
  if (b.parcelas > 2000) pqc.push('<b>~' + rgR(b.parcelas) + ' em parcelas j&aacute; est&atilde;o comprometidos</b> nas pr&oacute;ximas faturas.');
  if (A.folha > 0 && A.renda) pqc.push('<b>Descontos em folha da Ana (' + rgR(A.folha) + ')</b> comem ' + Math.round(A.folha / A.renda * 100) + '% da renda dela antes de qualquer gasto. Isso &eacute; fixo; o ajuste tem que vir do resto.');
  html += '<h3>Por que est&aacute; assim</h3><ul>' + pqc.map(function(x){ return '<li>' + x + '</li>'; }).join('') + '</ul>';
  if (b.abertos.length) html += '<h3>Meses em aberto x or&ccedil;amento</h3><ul>' + b.abertos.map(function(x){
    return '<li><b>' + (typeof mesNome === 'function' ? mesNome(x.mes) : x.mes) + ': ' + x.acima.length + ' grupo' + (x.acima.length === 1 ? '' : 's') + ' acima do or&ccedil;amento.</b> ' +
      x.acima.map(function(g){ return esc(g[0]) + ' ' + rgR(g[1]) + ' (or&ccedil;amento ' + rgR(g[2]) + ')'; }).join(' &middot; ') + '</li>'; }).join('') + '</ul>';
  /* o que fazer */
  var acc = [], projC = b.casalSaldo + Math.max(0, M.rendaUlt - M.renda) + Math.max(0, A.rendaUlt - A.renda);
  if (splitFora) acc.push(['<b>Cumprir o ' + labSplit + ' a partir deste m&ecirc;s.</b> Manuela contribui ~' + rgR(b.parte.Manuela) + ' e registra no bot&atilde;o CONTRIBUI&Ccedil;&Atilde;O.', 'tira ' + rgR(ganhoSplit) + '/m&ecirc;s do cart&atilde;o da Ana']);
  if (p99Tot > 100) acc.push(['<b>Parar de pagar boleto com cart&atilde;o.</b> Sentar juntas, listar o que s&atilde;o esses ' + rgR(p99Tot) + ' e cortar o que n&atilde;o &eacute; essencial. O que for essencial passa a ser pago &agrave; vista.', 'corta taxa e juros']);
  if (b.corteMerc > 0) { acc.push(['<b>Teto de ' + rgR(b.tetoMerc) + ' no supermercado.</b> Lista fechada e compra grande quinzenal, nada de ir ao mercado todo dia.', '&minus;' + rgR(b.corteMerc) + '/m&ecirc;s']); projC += b.corteMerc; }
  var corteSup = Math.max(0, A.sup - RG_TETO_SUPERFLUO) + Math.max(0, M.sup - RG_TETO_SUPERFLUO);
  if (corteSup > 0) { acc.push(['<b>Teto de ' + rgR(RG_TETO_SUPERFLUO) + ' por pessoa para compras, comer fora e transfer&ecirc;ncias</b> (hoje ' + rgR(supTot) + ' somando as duas).', '&minus;' + rgR(corteSup) + '/m&ecirc;s']); projC += corteSup; }
  var ultAberto = b.abertos.length ? b.abertos[b.abertos.length - 1] : null;
  var foraMerc = ultAberto ? ultAberto.acima.filter(function(g){ return g[0] !== 'Alimentação'; })[0] : null;
  if (foraMerc && foraMerc[1] > foraMerc[2] * 1.5) acc.push(['<b>' + esc(foraMerc[0]) + ' dentro dos ' + rgR(foraMerc[2]) + '</b> at&eacute; a casa sair do vermelho. ' + ultAberto.mes + ' j&aacute; est&aacute; em ' + rgR(foraMerc[1]) + '.', 'segura o m&ecirc;s aberto']);
  if (b.parcelas > 2000) acc.push(['<b>Nenhuma compra parcelada nova</b>, em nenhum dos cart&otilde;es, at&eacute; as parcelas comprometidas ca&iacute;rem abaixo de R$ 2.000.', 'trava a bola de neve']);
  acc.push(['<b>Lan&ccedil;ar toda renda extra (Uber, 99, hora extra) no NuNa</b> e direcionar para quitar o cart&atilde;o.', 'reduz o rombo']);
  html += '<h3>O que voc&ecirc;s precisam fazer, em ordem</h3>' + rgAcoes(acc);
  if (projC > b.casalSaldo)
    html += '<div class="tot">' + (M.rendaUlt > M.renda * 1.1 ? 'Com a renda nova da Manuela (' + rgR(M.rendaUlt) + ') e os tetos acima' : 'Com os tetos acima') +
      ', o rombo da casa cai de <b>' + rgR(-b.casalSaldo) + '</b> para cerca de <b>' + rgR(Math.max(0, -projC)) + '/m&ecirc;s</b>' +
      (projC < 0 ? '. O resto sai do corte nos boletos e da renda extra.' : '.') + '</div>';
  html += rgProibido();
  box.innerHTML = '<div class="rg"><span class="flag">ALERTA &middot; MODO RESGATE</span>' + html + '</div>';
}
