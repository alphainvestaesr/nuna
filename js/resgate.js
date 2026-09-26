/* NuNa - resgate.js: alerta "Modo Resgate" no topo da aba Insights.
   Diagnostico e plano de acao MENSAIS (mes escolhido nos botoes do alerta,
   que abre no mes da Visao Geral); os 3 ultimos meses fechados aparecem so
   como sinal de tendencia - incluindo tudo o que for lancado a mao
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
    '.rg .rgm{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 10px}' +
    '.rg .tend{margin:10px 0 4px;padding:8px 12px;border-radius:8px;background:var(--card);border:1px solid var(--border);font-size:13px;color:var(--tx2)}' +
    '.rg .tend b{color:var(--tx)}.rg .tend .r{color:var(--neg);font-weight:700}.rg .tend .g{color:var(--pos);font-weight:700}' +
    '.rg .aviso{font-size:12.5px;color:var(--tx2);margin:0 0 8px}' +
    '@media (max-width:520px){.rg .ac{grid-template-columns:24px 1fr}.rg .imp{grid-column:2}}';
  document.head.appendChild(st);
}
function rgR(v){ return brl(Math.round(v)).replace(/,00$/, ''); }
function rgCents(v){ return 'R$ ' + v.toFixed(2).replace('.', ','); }

/* ---------- numeros de UM mes ---------- */
function rgMesNome(m){ return typeof mesNome === 'function' ? mesNome(m) : m; }
/* ultimo mes fechado, ate m, em que a pessoa tem renda lancada */
function rgRendaRef(m, p){
  var i = MONTHS.indexOf(m);
  for (var k = i; k >= 0; k--){ var r = rendaOf(MONTHS[k], p) || 0; if (r > 0 && CLOSED.indexOf(MONTHS[k]) >= 0) return { v: r, mes: MONTHS[k] }; }
  for (k = i; k >= 0; k--){ r = rendaOf(MONTHS[k], p) || 0; if (r > 0) return { v: r, mes: MONTHS[k] }; }
  return { v: 0, mes: null };
}
function rgBaseMes(m){
  if (MONTHS.indexOf(m) < 0) return null;
  var soma = function(lista){ return lista.reduce(function(s, t){ return s + t.valor; }, 0); };
  var tipoInd = function(p, teste){ return soma(txOf(m, p).filter(function(t){ return !t.grupo && teste(t.tipo || ''); })); };
  var pessoa = function(p){
    var r = rendaOf(m, p) || 0, ref = null;
    if (r <= 0) { ref = rgRendaRef(m, p); r = ref.v; }
    var o = {
      renda: r, rendaEstimada: !!(ref && ref.mes && ref.mes !== m), rendaRefMes: ref ? ref.mes : m,
      ind: splitOf(m, p).ind,
      contr: contribTotalOf(m, p),
      folha: tipoInd(p, function(x){ return RG_FOLHA.test(x); }),
      p99: tipoInd(p, function(x){ return /99Pay/i.test(x); }),
      juros: tipoInd(p, function(x){ return /Divida/i.test(x); }),
      sup: tipoInd(p, function(x){ return RG_SUPERFLUOS.indexOf(x) >= 0; })
    };
    o.saldo = o.renda - o.ind - o.contr;
    o.razao = o.renda ? (o.ind + o.contr) / o.renda : 0;
    var i = MONTHS.indexOf(m), prev = i > 0 ? (rendaOf(MONTHS[i - 1], p) || 0) : 0;
    o.subiu = prev > 0 && (rendaOf(m, p) || 0) > prev * 1.1;
    return o;
  };
  var b = { mes: m, aberto: CLOSED.indexOf(m) < 0, Ana: pessoa('Ana'), Manuela: pessoa('Manuela') };
  b.conj = gastoOf(m, 'NuNa');
  var mediaTodos = CLOSED.length ? CLOSED.reduce(function(s, x){ return s + gastoOf(x, 'NuNa'); }, 0) / CLOSED.length : 0;
  b.conjVar = mediaTodos ? Math.round((b.conj / mediaTodos - 1) * 100) : 0;
  b.merc = soma(txOf(m, 'NuNa').filter(function(t){ return t.tipo === 'Supermercado'; }));
  var orc = (DATA.budgets && DATA.budgets.NuNa) || {};
  b.orcMerc = orc['Alimentação'] || 0;
  b.tetoMerc = b.orcMerc ? Math.max(b.orcMerc, Math.ceil(b.merc * 0.7 / 100) * 100) : Math.ceil(b.merc * 0.7 / 100) * 100;
  b.corteMerc = Math.max(0, b.merc - b.tetoMerc);
  b.casalRenda = b.Ana.renda + b.Manuela.renda;
  b.casalGasto = b.Ana.ind + b.Manuela.ind + b.conj;
  b.casalSaldo = b.casalRenda - b.casalGasto;
  b.S = splitDoMes(m);
  b.parte = { Ana: b.S.Ana * b.conj, Manuela: b.S.Manuela * b.conj };
  var parc = 0;
  (DATA.months[m].transactions || []).forEach(function(t){
    var s = String(t.raw || t.desc || '');
    var x = s.match(/parcela\s*(\d{1,2})\s*de\s*(\d{1,2})/i) || s.match(/\(?\b(\d{1,2})\s*\/\s*(\d{1,2})\)?\s*$/);
    if (x && +x[2] >= 2 && +x[1] < +x[2]) parc += (+x[2] - +x[1]) * t.valor;
  });
  b.parcelas = parc;
  b.acima = Object.keys(orc).map(function(g){
    return [g, soma(txOf(m, 'NuNa').filter(function(t){ return t.grupo === g; })), orc[g]]; })
    .filter(function(x){ return x[2] > 0 && x[1] > x[2] * 1.05; })
    .sort(function(x, y){ return (y[1] / y[2]) - (x[1] / x[2]); });
  return b;
}

/* ---------- sinal dos 3 ultimos meses fechados (ate o mes escolhido) ---------- */
function rgTendencia(m, p){
  var i = MONTHS.indexOf(m);
  var L = CLOSED.filter(function(x){ return MONTHS.indexOf(x) <= i; }).slice(-3);
  if (L.length < 2) L = CLOSED.slice(-3);
  if (!L.length) return '';
  var val = function(x){ return p === 'NuNa' ? caixaCasal(x) : saldoOf(x, p); };
  var v = L.map(val), med = v.reduce(function(a, c){ return a + c; }, 0) / v.length;
  var ini = v[0], fim = v[v.length - 1], dir;
  if (Math.abs(fim - ini) < Math.max(150, Math.abs(ini) * 0.05)) dir = 'est&aacute;vel';
  else dir = fim > ini ? 'melhorando' : 'piorando';
  var sinal = function(x){ return (x < 0 ? '&minus;' : '+') + rgR(Math.abs(x)).replace('R$ ', ''); };
  return '<div class="tend"><b>' + (p === 'NuNa' ? 'Casa nos' : '&Uacute;ltimos') + ' ' + L.length + ' meses fechados:</b> ' +
    (med < 0 ? 'rombo m&eacute;dio de <span class="r">' + rgR(-med) + '/m&ecirc;s</span>' : 'sobra m&eacute;dia de <span class="g">' + rgR(med) + '/m&ecirc;s</span>') +
    ' &middot; <b>' + dir + '</b> &middot; ' + L.map(function(x, k){ return x + ' <span class="' + (v[k] < 0 ? 'r' : 'g') + '">' + sinal(v[k]) + '</span>'; }).join(' &middot; ') + '</div>';
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

function renderResgate(){
  var box = el('in-resgate'); if (!box) return;
  rgCss();
  if (!state.rgMes || MONTHS.indexOf(state.rgMes) < 0) state.rgMes = (MONTHS.indexOf(state.mes) >= 0 ? state.mes : MONTHS[MONTHS.length - 1]);
  var m = state.rgMes, b = rgBaseMes(m); if (!b) { box.innerHTML = ''; return; }
  var p = state.perfil, html = '', N = rgMesNome(m);
  var A = b.Ana, M = b.Manuela;
  var pctAna = b.conj ? Math.round(A.contr / b.conj * 100) : 0, pctManu = b.conj ? Math.round(M.contr / b.conj * 100) : 0;
  var splitFora = b.conj > 0 && M.contr < b.parte.Manuela * 0.8;
  var ganhoSplit = Math.max(0, b.parte.Manuela - M.contr);
  var labSplit = splitCurto(b.S);
  var justa = 'divis&atilde;o justa pela renda l&iacute;quida (' + labSplit + ')';
  var sobraManu = M.renda - M.ind - b.parte.Manuela;
  var avisoAberto = function(pessoas){
    var est = pessoas.filter(function(x){ return x.o.rendaEstimada; });
    return (b.aberto ? '<p class="aviso">' + N + ' ainda est&aacute; em aberto: os gastos podem crescer at&eacute; o fechamento.' +
      (est.length ? ' Renda ' + (est.length === 1 && pessoas.length > 1 ? 'da ' + est[0].nome : '') + ' ainda n&atilde;o lan&ccedil;ada: usei a de ' + est[0].o.rendaRefMes + ' como refer&ecirc;ncia.' : '') + '</p>'
      : (est.length ? '<p class="aviso">Renda ' + (pessoas.length > 1 ? 'da ' + est[0].nome + ' ' : '') + 'n&atilde;o lan&ccedil;ada em ' + N + ': usei a de ' + est[0].o.rendaRefMes + '.</p>' : ''));
  };
  var montar = function(cls, flag, corpo){
    box.innerHTML = '<div class="rg' + cls + '"><div class="rgm" id="rg-meses"></div><span class="flag">' + flag + '</span>' + corpo + '</div>';
    monthPills(el('rg-meses'), m, function(x){ state.rgMes = x; renderResgate(); }, false);
  };

  if (p === 'Ana' || p === 'Manuela') {
    var eu = b[p], outra = p === 'Ana' ? M : A, nomeOutra = p === 'Ana' ? 'Manuela' : 'Ana';
    var vermelho = eu.saldo < 0, casaVermelha = b.casalSaldo < 0;
    var aviso = avisoAberto([{ o: eu, nome: p }]), tend = rgTendencia(m, p);
    if (!vermelho && !casaVermelha) {
      montar(' ok', 'MANTER O RUMO &middot; ' + N, '<div class="big">Em ' + N + ' voc&ecirc; gastou <span class="g">' + rgCents(eu.razao) +
        '</span> para cada R$ 1 que recebeu.</div>' + aviso + tend + '<p class="lead">O m&ecirc;s fechou no azul, e a casa tamb&eacute;m. Segure os tetos e continue lan&ccedil;ando tudo no NuNa.</p>');
      return;
    }
    var pq = [], ac = [], proj = eu.saldo;
    if (p === 'Ana' || vermelho) {
      html += '<div class="big">Em ' + N + ' voc&ecirc; gastou <span class="' + (vermelho ? 'r' : 'g') + '">' + rgCents(eu.razao) + '</span> para cada R$ 1 que recebeu.</div>' + aviso + tend;
      html += '<p class="lead">' + (vermelho
        ? 'Em ' + N + ' faltaram <b>' + rgR(-eu.saldo) + '</b>. Esse dinheiro n&atilde;o existe: sai do cart&atilde;o, e o cart&atilde;o cobra de volta com juros. Do jeito que est&aacute;, n&atilde;o fecha. N&atilde;o &eacute; quest&atilde;o de apertar um pouco, &eacute; mudar a estrutura.'
        : 'Voc&ecirc; fechou ' + N + ' no azul, mas a casa ficou no vermelho.') + '</p>';
    } else {
      html += '<div class="big">Em ' + N + ' voc&ecirc; fechou no azul (<span class="g">+' + rgR(eu.saldo) + '</span>), mas a casa ficou no vermelho.</div>' + aviso + tend;
      html += '<p class="lead">Voc&ecirc; gastou ' + rgCents(eu.razao) + ' para cada R$ 1 que recebeu. A ' + nomeOutra + ' gastou ' + rgCents(outra.razao) +
        '. A conta da casa n&atilde;o fecha enquanto quase tudo sai de uma pessoa s&oacute;.</p>';
    }
    /* por que */
    if (splitFora) {
      if (p === 'Ana') {
        pq.push('<b>Voc&ecirc; bancou a casa praticamente sozinha.</b> Colocou ' + rgR(A.contr) + ' nas contas conjuntas (' + pctAna + '%).' +
          (A.folha > 0 ? ' Depois dos descontos em folha (' + rgR(A.folha) + '), sobraram cerca de ' + rgR(A.renda - A.folha) + ' da sua renda' +
            (A.renda - A.folha < A.contr ? ', <b>menos do que voc&ecirc; p&ocirc;s s&oacute; na casa</b>' : '') + '.' : ''));
        pq.push('<b>A ' + justa + ' n&atilde;o foi cumprida.</b> Em ' + N + ' a parte da Manuela era ~' + rgR(b.parte.Manuela) + '. Entraram ' + rgR(M.contr) + '.');
      } else {
        pq.push('<b>A ' + justa + ' n&atilde;o foi cumprida.</b> Em ' + N + ' sua parte das contas conjuntas era ~' + rgR(b.parte.Manuela) + '. Entraram ' + rgR(M.contr) + '. A Ana cobriu ' + pctAna + '%.');
        if (sobraManu < 0) pq.push('<b>Mesmo pagando a sua parte justa, voc&ecirc; fecharia ' + N + ' com &minus;' + rgR(-sobraManu) + '.</b> A casa custa mais do que as duas rendas l&iacute;quidas aguentam: cortar nas contas da casa n&atilde;o &eacute; opcional.');
        if (M.subiu) pq.push('<b>Sua renda subiu para ' + rgR(M.renda) + '</b> em ' + N + ', e a contribui&ccedil;&atilde;o n&atilde;o acompanhou.');
      }
    }
    if (eu.p99 > 100) pq.push('<b>Boletos pagos no cart&atilde;o via 99Pay: ' + rgR(eu.p99) + '.</b> Isso n&atilde;o paga a conta, s&oacute; joga para a pr&oacute;xima fatura.');
    if (eu.sup > RG_TETO_SUPERFLUO) pq.push('<b>Compras, comer fora e transfer&ecirc;ncias: ' + rgR(eu.sup) + '.</b>');
    if (b.corteMerc > 0) pq.push('<b>Supermercado da casa: ' + rgR(b.merc) + '</b>' + (b.orcMerc ? ', contra um or&ccedil;amento de ' + rgR(b.orcMerc) : '') + '.');
    if (eu.juros > 50 || b.parcelas > 2000) pq.push((eu.juros > 50 ? '<b>Juros e encargos: ' + rgR(eu.juros) + '</b>' : '') +
      (eu.juros > 50 && b.parcelas > 2000 ? ', e ' : '') + (b.parcelas > 2000 ? (eu.juros > 50 ? 'as' : 'As') + ' faturas seguintes j&aacute; t&ecirc;m <b>~' + rgR(b.parcelas) + ' em parcelas</b> comprometidas' : '') + '.');
    /* o que fazer */
    if (splitFora) {
      if (p === 'Ana') { ac.push(['<b>Aplicar a ' + justa + '.</b> Em ' + N + ' a parte da Manuela era ~' + rgR(b.parte.Manuela) + ' e a sua ~' + rgR(b.parte.Ana) + '.', '+' + rgR(ganhoSplit)]); proj += ganhoSplit; }
      else ac.push(['<b>Contribuir com ~' + rgR(b.parte.Manuela) + '</b> (' + Math.round(b.S.Manuela * 100) + '% da casa, proporcional &agrave; sua renda l&iacute;quida) e registrar no bot&atilde;o CONTRIBUI&Ccedil;&Atilde;O. &Eacute; a a&ccedil;&atilde;o n&uacute;mero 1 do plano da casa.', '+' + rgR(ganhoSplit) + ' para a casa']);
    }
    if (eu.p99 > 100) ac.push(['<b>Parar de pagar boleto com cart&atilde;o pelo 99Pay.</b> Listar o que s&atilde;o esses ' + rgR(eu.p99) + ' e cortar o que n&atilde;o &eacute; essencial.', 'corta taxa e juros']);
    if (eu.sup > RG_TETO_SUPERFLUO) { ac.push(['<b>Teto de ' + rgR(RG_TETO_SUPERFLUO) + ' no m&ecirc;s para compras, comer fora e transfer&ecirc;ncias a pessoas.</b>', '&minus;' + rgR(eu.sup - RG_TETO_SUPERFLUO)]); proj += eu.sup - RG_TETO_SUPERFLUO; }
    if (b.corteMerc > 0) {
      var minha = b.corteMerc * b.S[p];
      ac.push(['<b>' + (p === 'Ana' ? 'Teto de ' : 'Ajudar a segurar o teto de ') + rgR(b.tetoMerc) + ' no supermercado da casa.</b> Lista fechada e compra grande quinzenal. A casa economizaria ' + rgR(b.corteMerc) + '; a sua parte cairia ' + rgR(minha) + '.', '&minus;' + rgR(minha)]);
      if (p === 'Ana') proj += minha;
    }
    if (b.parcelas > 2000) ac.push(['<b>Zero parcelamento novo</b>' + (p === 'Manuela' ? ' no seu cart&atilde;o' : '') + ' at&eacute; as parcelas comprometidas ca&iacute;rem abaixo de R$ 2.000.', 'trava a bola de neve']);
    if (p === 'Ana' && vermelho) ac.push(['<b>Lan&ccedil;ar toda renda extra (Uber, 99, hora extra) no NuNa</b> e direcionar para quitar o cart&atilde;o.', 'reduz o rombo']);
    if (pq.length) html += '<h3>Por que ' + N + ' ficou assim</h3><ul>' + pq.map(function(x){ return '<li>' + x + '</li>'; }).join('') + '</ul>';
    if (ac.length) html += '<h3>O que fazer, em ordem</h3>' + rgAcoes(ac);
    if (p === 'Ana' && vermelho && proj > eu.saldo)
      html += '<div class="tot">Com essas a&ccedil;&otilde;es, o rombo de ' + N + ' cairia de <b>' + rgR(-eu.saldo) + '</b> para cerca de <b>' + rgR(Math.max(0, -proj)) + '</b>' +
        (proj < 0 ? '. O resto sai do corte nos boletos e de renda extra lan&ccedil;ada no NuNa.' : '.') + '</div>';
    if (vermelho) html += rgProibido();
    montar('', 'ALERTA &middot; MODO RESGATE &middot; ' + N, html);
    return;
  }

  /* ---------- perfil conjunto: fala com "voces" ---------- */
  var avisoC = avisoAberto([{ o: A, nome: 'Ana' }, { o: M, nome: 'Manuela' }]), tendC = rgTendencia(m, 'NuNa');
  if (b.casalSaldo >= 0) {
    montar(' ok', 'MANTER O RUMO &middot; ' + N, '<div class="big">Em ' + N + ' voc&ecirc;s gastaram <span class="g">' + rgCents(b.casalRenda ? b.casalGasto / b.casalRenda : 0) +
      '</span> para cada R$ 1 que receberam.</div>' + avisoC + tendC + '<p class="lead">A casa fechou o m&ecirc;s no azul. Mantenham a ' + justa + ', os tetos e o registro de tudo no NuNa.</p>');
    return;
  }
  html += '<div class="big">Em ' + N + ' voc&ecirc;s gastaram <span class="r">' + rgCents(b.casalRenda ? b.casalGasto / b.casalRenda : 0) + '</span> para cada R$ 1 que receberam.</div>' + avisoC + tendC;
  html += '<p class="lead">Somando as duas, faltaram <b>' + rgR(-b.casalSaldo) + '</b> em ' + N + '.' +
    (A.saldo < 0 && M.saldo >= 0 ? ' Esse buraco foi coberto pelo cart&atilde;o da Ana, com juros. Do jeito que est&aacute;, n&atilde;o fecha, e o peso est&aacute; todo em uma pessoa.' : ' Do jeito que est&aacute;, n&atilde;o fecha.') + '</p>';
  var c = function(v, cls){ return '<td' + (cls ? ' class="' + cls + '"' : '') + '>' + v + '</td>'; };
  var sinal = function(v){ return (v < 0 ? '&minus;' : '+') + rgR(Math.abs(v)); };
  html += '<h3>Raio-X das duas em ' + N + '</h3><div class="rxw"><table><thead><tr><th></th><th>Ana</th><th>Manuela</th><th>Casa</th></tr></thead><tbody>' +
    '<tr><td>Renda' + (A.rendaEstimada || M.rendaEstimada ? ' <small>(*refer&ecirc;ncia)</small>' : '') + '</td>' + c(rgR(A.renda) + (A.rendaEstimada ? '*' : '')) + c(rgR(M.renda) + (M.rendaEstimada ? '*' : '')) + c(rgR(b.casalRenda)) + '</tr>' +
    (A.folha > 0 || M.folha > 0 ? '<tr><td>Descontos em folha</td>' + c(A.folha > 0 ? rgR(A.folha) : '&mdash;') + c(M.folha > 0 ? rgR(M.folha) : '&mdash;') + c('') + '</tr>' : '') +
    '<tr><td>Renda l&iacute;quida' + (b.S.mes && b.S.mes !== m ? ' (' + b.S.mes + ')' : '') + '</td>' + c(rgR(b.S.liqAna)) + c(rgR(b.S.liqManu)) + c(rgR(b.S.liqAna + b.S.liqManu)) + '</tr>' +
    '<tr><td>Gastos individuais</td>' + c(rgR(A.ind)) + c(rgR(M.ind)) + c(rgR(A.ind + M.ind)) + '</tr>' +
    '<tr><td>Contas da casa</td>' + c('') + c('') + c(rgR(b.conj)) + '</tr>' +
    '<tr><td>Parte justa pelo l&iacute;quido (' + labSplit + ')</td>' + c(rgR(b.parte.Ana)) + c(rgR(b.parte.Manuela)) + c('') + '</tr>' +
    '<tr><td>Quanto cada uma colocou</td>' + c(rgR(A.contr) + ' (' + pctAna + '%)', splitFora ? 'b' : '') + c(rgR(M.contr) + ' (' + pctManu + '%)', splitFora ? 'b' : '') + c(rgR(A.contr + M.contr)) + '</tr>' +
    '<tr><td>Saldo</td>' + c(sinal(A.saldo), A.saldo < 0 ? 'b' : 'g') + c(sinal(M.saldo), M.saldo < 0 ? 'b' : 'g') + c(sinal(b.casalSaldo), b.casalSaldo < 0 ? 'b' : 'g') + '</tr>' +
    '</tbody></table></div>';
  var pqc = [], supTot = A.sup + M.sup, p99Tot = A.p99 + M.p99, jurTot = A.juros + M.juros;
  if (splitFora) pqc.push('<b>A divis&atilde;o justa pela renda l&iacute;quida era ' + labSplit + ', mas na pr&aacute;tica foi ' + pctAna + '/' + pctManu + '.</b> A Ana colocou ' + rgR(Math.max(0, A.contr - b.parte.Ana)) +
    ' a mais do que a parte justa dela, e a Manuela ' + rgR(ganhoSplit) + ' a menos.' + (A.saldo < 0 && M.saldo >= 0 ? ' A Ana pagou a diferen&ccedil;a no cart&atilde;o enquanto a Manuela fechou o m&ecirc;s no azul.' : ''));
  if (splitFora && sobraManu < 0) pqc.push('<b>Mesmo com a divis&atilde;o justa, a Manuela fecharia ' + N + ' com &minus;' + rgR(-sobraManu) + '.</b> A casa custa mais do que as duas rendas l&iacute;quidas aguentam.');
  pqc.push('<b>A casa custou ' + rgR(b.conj) + '</b>' + (b.casalRenda ? ', ' + Math.round(b.conj / b.casalRenda * 100) + '% de tudo que voc&ecirc;s receberam' : '') +
    (b.conjVar > 5 ? ', ' + b.conjVar + '% acima da m&eacute;dia dos meses fechados' : (b.conjVar < -5 ? ', ' + (-b.conjVar) + '% abaixo da m&eacute;dia dos meses fechados' : '')) + '.');
  if (b.corteMerc > 0) pqc.push('<b>Supermercado: ' + rgR(b.merc) + '</b>' + (b.orcMerc ? ', contra um or&ccedil;amento de ' + rgR(b.orcMerc) : '') + '.');
  if (supTot > RG_TETO_SUPERFLUO) pqc.push('<b>Compras, comer fora e transfer&ecirc;ncias: ' + rgR(supTot) + '</b> somando as duas (Ana ' + rgR(A.sup) + ', Manuela ' + rgR(M.sup) + ').');
  if (p99Tot > 100 || jurTot > 50) pqc.push((p99Tot > 100 ? '<b>' + rgR(p99Tot) + ' em boletos foram para o cart&atilde;o pelo 99Pay</b>' : '') +
    (p99Tot > 100 && jurTot > 50 ? ', e mais ' : '') + (jurTot > 50 ? '<b>' + rgR(jurTot) + ' em juros e encargos</b>' : '') + '.');
  if (b.parcelas > 2000) pqc.push('<b>~' + rgR(b.parcelas) + ' em parcelas j&aacute; est&atilde;o comprometidos</b> nas faturas seguintes.');
  if (A.folha > 0 && A.renda) pqc.push('<b>Descontos em folha da Ana (' + rgR(A.folha) + ')</b> comeram ' + Math.round(A.folha / A.renda * 100) + '% da renda dela antes de qualquer gasto. Isso &eacute; fixo; o ajuste tem que vir do resto.');
  html += '<h3>Por que ' + N + ' ficou assim</h3><ul>' + pqc.map(function(x){ return '<li>' + x + '</li>'; }).join('') + '</ul>';
  if (b.acima.length) html += '<h3>Or&ccedil;amento da casa em ' + N + '</h3><ul><li><b>' + b.acima.length + ' grupo' + (b.acima.length === 1 ? '' : 's') + ' acima do or&ccedil;amento:</b> ' +
    b.acima.map(function(g){ return esc(g[0]) + ' ' + rgR(g[1]) + ' (or&ccedil;amento ' + rgR(g[2]) + ')'; }).join(' &middot; ') + '</li></ul>';
  var acc = [], projC = b.casalSaldo;
  if (splitFora) acc.push(['<b>Aplicar a ' + justa + '.</b> Em ' + N + ': Ana ~' + rgR(b.parte.Ana) + ' e Manuela ~' + rgR(b.parte.Manuela) + ', registradas no bot&atilde;o CONTRIBUI&Ccedil;&Atilde;O.' + (sobraManu < 0 ? ' Mesmo assim a Manuela fecharia com &minus;' + rgR(-sobraManu) + ': por isso os cortes abaixo s&atilde;o obrigat&oacute;rios.' : ''), 'tira ' + rgR(ganhoSplit) + ' do cart&atilde;o da Ana']);
  if (p99Tot > 100) acc.push(['<b>Parar de pagar boleto com cart&atilde;o.</b> Sentar juntas, listar o que s&atilde;o esses ' + rgR(p99Tot) + ' e cortar o que n&atilde;o &eacute; essencial. O que for essencial passa a ser pago &agrave; vista.', 'corta taxa e juros']);
  if (b.corteMerc > 0) { acc.push(['<b>Teto de ' + rgR(b.tetoMerc) + ' no supermercado.</b> Lista fechada e compra grande quinzenal, nada de ir ao mercado todo dia.', '&minus;' + rgR(b.corteMerc)]); projC += b.corteMerc; }
  var corteSup = Math.max(0, A.sup - RG_TETO_SUPERFLUO) + Math.max(0, M.sup - RG_TETO_SUPERFLUO);
  if (corteSup > 0) { acc.push(['<b>Teto de ' + rgR(RG_TETO_SUPERFLUO) + ' por pessoa para compras, comer fora e transfer&ecirc;ncias</b> (em ' + N + ': ' + rgR(supTot) + ' somando as duas).', '&minus;' + rgR(corteSup)]); projC += corteSup; }
  var foraMerc = b.acima.filter(function(g){ return g[0] !== 'Alimentação'; })[0];
  if (foraMerc && foraMerc[1] > foraMerc[2] * 1.5) acc.push(['<b>' + esc(foraMerc[0]) + ' dentro dos ' + rgR(foraMerc[2]) + '</b>. Em ' + N + ' foi ' + rgR(foraMerc[1]) + '.', 'segura o m&ecirc;s']);
  if (b.parcelas > 2000) acc.push(['<b>Nenhuma compra parcelada nova</b>, em nenhum dos cart&otilde;es, at&eacute; as parcelas comprometidas ca&iacute;rem abaixo de R$ 2.000.', 'trava a bola de neve']);
  acc.push(['<b>Lan&ccedil;ar toda renda extra (Uber, 99, hora extra) no NuNa</b> e direcionar para quitar o cart&atilde;o.', 'reduz o rombo']);
  html += '<h3>O que voc&ecirc;s precisam fazer, em ordem</h3>' + rgAcoes(acc);
  if (projC > b.casalSaldo)
    html += '<div class="tot">Com os tetos acima, o rombo da casa em ' + N + ' cairia de <b>' + rgR(-b.casalSaldo) + '</b> para cerca de <b>' + rgR(Math.max(0, -projC)) + '</b>' +
      (projC < 0 ? '. O resto sai do corte nos boletos e da renda extra.' : '.') + '</div>';
  html += rgProibido();
  montar('', 'ALERTA &middot; MODO RESGATE &middot; ' + N, html);
}
