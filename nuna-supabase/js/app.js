/* NuNa - app.js: insights e inicializacao do dashboard */
function renderInsights(){
  var sal=CLOSED.map(function(m){return saldoOf(m,state.perfil)});
  var tot=sal.reduce(function(a,b){return a+b},0);
  var rend=CLOSED.map(function(m){return rendaOf(m,state.perfil)}).reduce(function(a,b){return a+b},0);
  var taxa=rend?Math.round(tot/rend*100):0;
  var pares=CLOSED.map(function(m,i){return [m,sal[i]]}).sort(function(a,b){return b[1]-a[1]});
  el('in-cards').innerHTML=
    kpiCard('Saldo em '+CLOSED.length+' meses',brl(tot),'mar a ago/2026',tot>=0?'green':'red')+
    kpiCard('Taxa de poupan&ccedil;a real',taxa+'%','saldo / receitas',taxa>=0?'green':'red')+
    kpiCard('Melhor m&ecirc;s',pares[0][0],brl(pares[0][1]),'green')+
    kpiCard('Pior m&ecirc;s',pares[pares.length-1][0],brl(pares[pares.length-1][1]),'red');

  var seen={};CLOSED.forEach(function(m){Object.keys(catTotals(txOf(m,state.perfil))).forEach(function(c){seen[c]=1})});
  var anom=[];
  Object.keys(seen).forEach(function(c){
    var v=CLOSED.map(function(m){return txOf(m,state.perfil).filter(function(t){return catKey(t)===c}).reduce(function(s,t){return s+t.valor},0)});
    var avg=v.reduce(function(a,b){return a+b},0)/v.length; if(avg<80)return;
    v.forEach(function(x,i){if(x>avg*1.6)anom.push([c,CLOSED[i],Math.round((x/avg-1)*100),x])});});
  anom.sort(function(a,b){return b[3]-a[3]});
  el('in-anom').innerHTML=anom.slice(0,8).map(function(a){return '<li><b>'+a[0]+'</b> em '+a[1]+': '+brl(a[3])+' &mdash; '+a[2]+'% acima da m&eacute;dia.</li>'}).join('')||'<li>Nenhum pico relevante nos meses fechados.</li>';

  var est=[];
  Object.keys(seen).forEach(function(c){
    var v=CLOSED.map(function(m){return txOf(m,state.perfil).filter(function(t){return catKey(t)===c}).reduce(function(s,t){return s+t.valor},0)});
    var avg=v.reduce(function(a,b){return a+b},0)/v.length; if(avg<50)return;
    if(v.some(function(x){return x===0}))return;
    var sd=Math.sqrt(v.reduce(function(s,x){return s+(x-avg)*(x-avg)},0)/v.length);
    est.push([c,avg,sd/avg]);});
  est.sort(function(a,b){return a[2]-b[2]});
  el('in-stable').innerHTML=est.slice(0,6).map(function(e){return '<li><b>'+e[0]+'</b>: ~'+brl(e[1])+'/m&ecirc;s (varia&ccedil;&atilde;o de '+Math.round(e[2]*100)+'%). Linha confi&aacute;vel pra planejar.</li>'}).join('')||'<li>Ainda sem categoria est&aacute;vel o bastante neste perfil.</li>';

  var tt={};CLOSED.forEach(function(m){txOf(m,state.perfil).forEach(function(t){tt[t.tipo]=(tt[t.tipo]||0)+t.valor})});
  var naoEss=['Compras','Alimentacao Fora','Viagem','Assinaturas','Streaming','Outros','Transferencia a pessoas'];
  var alvo=Object.keys(tt).filter(function(c){return naoEss.indexOf(c)>=0}).sort(function(a,b){return tt[b]-tt[a]})[0];
  var wins=[];
  if(alvo)wins.push('Cortando 10% de <b>'+alvo+'</b> (hoje '+brl(tt[alvo]/CLOSED.length)+'/m&ecirc;s), voc&ecirc; guarda <b>'+brl(tt[alvo]/CLOSED.length*0.1*12)+'</b> por ano.');
  var marc=allTx().filter(function(t){return inView(t,state.perfil)&&t.status==='pode cancelar'});
  if(marc.length)wins.push('Voc&ecirc; marcou '+marc.length+' lan&ccedil;amentos como &ldquo;pode cancelar&rdquo; &mdash; somam '+brl(marc.reduce(function(s,t){return s+t.valor},0))+' no per&iacute;odo.');
  if(state.perfil==='NuNa'){
    var ta=0,tm=0;CLOSED.forEach(function(m){var c=contribOf(m);ta+=c.ana;tm+=c.manu});
    var tt=ta+tm, dv=ta-(tt*SPLIT.Ana), d=Math.abs(dv);
    wins.push('Nos meses fechados, a propor&ccedil;&atilde;o acordada ('+SPLIT_LAB+') daria '+brl(tt*SPLIT.Ana)+' para Ana e '+brl(tt*SPLIT.Manuela)+' para Manuela. <b>'+(dv>0?'Ana':'Manuela')+'</b> contribuiu '+brl(d)+' acima da parte dela no acumulado.');
  }
  var varr=Object.keys(seen).map(function(c){
    var v=CLOSED.map(function(m){return txOf(m,state.perfil).filter(function(t){return catKey(t)===c}).reduce(function(s,t){return s+t.valor},0)});
    var avg=v.reduce(function(a,b){return a+b},0)/v.length;
    var sd=Math.sqrt(v.reduce(function(s,x){return s+(x-avg)*(x-avg)},0)/v.length);
    return [c,avg?sd/avg:0,avg];}).filter(function(x){return x[2]>150}).sort(function(a,b){return b[1]-a[1]});
  if(varr.length)wins.push('Maior varia&ccedil;&atilde;o m&ecirc;s a m&ecirc;s: <b>'+varr[0][0]+'</b> ('+Math.round(varr[0][1]*100)+'%). &Eacute; onde um teto mensal rende mais.');
  el('in-wins').innerHTML=wins.map(function(w){return '<li>'+w+'</li>'}).join('');

  var dups=allTx().filter(function(t){return t.possivelDup});
  var byKey={}; dups.forEach(function(t){(byKey[t.dedupKey]=byKey[t.dedupKey]||[]).push(t)});
  var grupos=Object.keys(byKey);
  el('in-dup').innerHTML=[
    '<b>Chave de deduplica&ccedil;&atilde;o</b>: m&ecirc;s + fonte + cart&atilde;o + data + descri&ccedil;&atilde;o + valor, mais um ordinal que separa repeti&ccedil;&otilde;es leg&iacute;timas no mesmo dia. Cada lan&ccedil;amento tem um <code>uid</code> est&aacute;vel derivado dessa chave &mdash; reimportar o mesmo CSV reconhece o mesmo <code>uid</code> e n&atilde;o cria uma segunda transa&ccedil;&atilde;o.',
    '<b>Fontes</b> t&ecirc;m identidade fixa (cart&atilde;o + final + titular), ent&atilde;o o mesmo cart&atilde;o vindo de arquivos diferentes &eacute; sempre a mesma fonte.',
    '<b>Parcelas n&atilde;o s&atilde;o duplicidade</b>: a mesma compra aparece em v&aacute;rios meses de fatura com a data original. Como o m&ecirc;s entra na chave, elas convivem sem conflito. Exemplo real: R M Tintas de 12/03 aparece de abril a outubro porque &eacute; 10x.',
    grupos.length
      ? '<b>'+grupos.length+' grupos ('+dups.length+' lan&ccedil;amentos)</b> repetem a chave inteira dentro do mesmo m&ecirc;s. Quase sempre s&atilde;o compras distintas de verdade (seis abastecimentos de R$ 100, quatro lavanderias de R$ 16,95). Est&atilde;o <b>marcados para revis&atilde;o</b>, n&atilde;o removidos &mdash; filtre por &ldquo;poss&iacute;veis duplicidades&rdquo; na aba Transa&ccedil;&otilde;es para conferir.'
      : 'Nenhuma chave repetida dentro do mesmo m&ecirc;s nos dados atuais.',
    '<b>Na d&uacute;vida, marca para revis&atilde;o</b> &mdash; nunca descarta nem cria transa&ccedil;&atilde;o nova por conta pr&oacute;pria.'
  ].map(function(s){return '<li>'+s+'</li>'}).join('');

  el('in-limit').innerHTML=[
    'A an&aacute;lise vem <b>s&oacute;</b> das faturas de cart&atilde;o e dos contracheques dispon&iacute;veis. Despesa paga por <b>boleto, d&eacute;bito, Pix ou dinheiro</b> n&atilde;o aparece aqui.',
    'Por isso, <b>energia, internet, g&aacute;s e &aacute;gua</b> do Nosso Lar est&atilde;o zerados &mdash; n&atilde;o significa que n&atilde;o existem, s&oacute; que est&atilde;o fora das fontes integradas.',
    '<b>Aluguel+&Aacute;gua, Terreno e telefone da Manuela</b> entram como premissa informada por voc&ecirc;, n&atilde;o como lan&ccedil;amento comprovado.',
    'A renda da Manuela &eacute; <b>informada, sem contracheque</b> &mdash; R$ 2.000/m&ecirc;s de mar&ccedil;o a julho e R$ 4.280/m&ecirc;s de agosto em diante.',
    'De <b>mar&ccedil;o a julho</b>, o perfil da Manuela segue a regra fechada: terreno (R$ 860) + telefone (R$ 35) + contribui&ccedil;&atilde;o NuNa do m&ecirc;s, e todo o restante da renda cai em <b>Outros</b>. Por isso o saldo dela fecha exatamente em zero nesses meses. De agosto em diante valem os lan&ccedil;amentos reais.',
    'O cart&atilde;o Bradesco da Manuela s&oacute; aparece nos dados <b>a partir de jun/2026</b>.',
    '<b>Set e Out/2026</b> s&atilde;o meses em aberto: Set ainda n&atilde;o tem contracheque da Ana e Out &eacute; a fatura ainda aberta.'
  ].map(function(s){return '<li>'+s+'</li>'}).join('');

  el('in-assum').innerHTML=[
    '<b>Duas leituras de categoria</b>: &ldquo;Categoria do plano&rdquo; segue a sua lista (com Bradesco e Inter como catch-all do cart&atilde;o); &ldquo;Tipo de gasto&rdquo; abre o que h&aacute; dentro desses catch-all &mdash; supermercado, compras, farm&aacute;cia, restaurante. Alterne no bot&atilde;o acima do gr&aacute;fico.',
    '<b>Saldo</b> = receitas &minus; despesas individuais &minus; despesas conjuntas pagas pela pessoa. Pode ficar negativo, e fica.',
    '<b>Renda da Ana</b> = vantagens brutas do contracheque. Funaprev, IR, consignado e Sinpol aparecem como gastos, para ficarem vis&iacute;veis.',
    '<b>Parcelamento Bradesco</b>: o principal do PARC.F&Aacute;CIL ficou de fora (s&atilde;o compras j&aacute; contadas antes, s&oacute; refinanciadas). Juros e encargos entram como gasto.',
    '<b>Contribui&ccedil;&otilde;es pontuais da Manuela</b> (R$ 797,96 em 04/03 e R$ 400,00 em 10/06) s&atilde;o lan&ccedil;amentos <b>CONJUNTOS pagos por ela</b> &mdash; exatamente o mesmo tratamento das contas que a Ana paga. Descontam da receita da Manuela, aparecem no hist&oacute;rico individual dela e entram na consolida&ccedil;&atilde;o NuNa, contados <b>uma vez s&oacute;</b>.',
    '<b>Divis&atilde;o</b> tem duas op&ccedil;&otilde;es: INDIVIDUAL ou CONJUNTA. Marcar CONJUNTA leva o lan&ccedil;amento para o Perfil Conjunto e libera a escolha do grupo; marcar INDIVIDUAL o tira de l&aacute;. A corre&ccedil;&atilde;o altera o pr&oacute;prio lan&ccedil;amento &mdash; nunca cria um segundo.',
    '<b>Fonte</b> vem automaticamente do arquivo importado (cart&atilde;o + final + titular). Quando n&atilde;o d&aacute; para identificar, fica marcada em laranja e entra na fila de revis&atilde;o &mdash; n&atilde;o &eacute; preenchida na m&atilde;o por padr&atilde;o.',
    '<b>Caixinha</b> = Reserva de Emerg&ecirc;ncia (10%) + Investimentos (15%). Imposto de Renda e INSS/Funaprev n&atilde;o entram como dispon&iacute;vel, porque j&aacute; saem no contracheque.',
    '<b>Regra temporal</b>: de mar a ago/2026 a Ana pagou praticamente tudo, e os dados preservam isso.',
    '<b>Pereir&atilde;o</b> continua como grupo conjunto pr&oacute;prio para material de constru&ccedil;&atilde;o e tintas, como voc&ecirc; pediu.',
    '<b>ACABEI DE GASTAR</b>: lan&ccedil;amento r&aacute;pido no dia, dispon&iacute;vel nos perfis Ana e Manuela. O N&uacute;cleo de Intelig&ecirc;ncia sugere categoria, fonte e divis&atilde;o a partir do hist&oacute;rico, e o gasto entra direto na aba Transa&ccedil;&otilde;es. Quando a fatura chega, o lan&ccedil;amento manual &eacute; conciliado com o oficial e vira <b>uma transa&ccedil;&atilde;o s&oacute;</b> &mdash; um gasto com status Conciliado sai dos totais para a vers&atilde;o da fatura n&atilde;o contar duas vezes.',
    '<b>Conjunto n&atilde;o duplica</b>: conjunto pago pela Ana + conjunto pago pela Manuela = total NuNa do m&ecirc;s, ao centavo, em todos os oito meses. A confer&ecirc;ncia aparece no bloco &ldquo;De onde vem este total&rdquo; da Vis&atilde;o Geral do perfil NuNa.',
    '<b>Aten&ccedil;&atilde;o</b>: as contribui&ccedil;&otilde;es pontuais da Manuela entram como despesa conjunta <i>adicional</i>. Se o dinheiro tiver sido um repasse para a Ana pagar contas que j&aacute; est&atilde;o nas faturas dela, me avise &mdash; nesse caso o valor precisa sair do total do casal para n&atilde;o contar duas vezes.'
  ].map(function(s){return '<li>'+s+'</li>'}).join('');
}
function renderInsightsFooter(){
  var n=allTx().filter(function(t){return inView(t,state.perfil)}).length;
  var c={};allTx().forEach(function(t){if(inView(t,state.perfil))c[catKey(t)||'-']=1});
  el('ins-in').textContent='"Dados de '+MONTHS[0]+' a '+MONTHS[MONTHS.length-1]+'/2026. Total processado: '+n+' lancamentos em '+Object.keys(c).length+' categorias."';
}
/* RENDER SOB DEMANDA: desenhar as sete abas de uma vez travava a thread
   principal (tabelas grandes + cinco graficos). Agora cada aba e desenhada
   apenas quando esta visivel, em fatias, devolvendo a thread ao navegador
   entre cada funcao. */
var PANEL_FNS={
  overview:['renderOverviewMonths','renderKPI','renderDonut','renderTransfers','renderSavingsTracker','renderOverviewInsight'],
  transactions:['renderTxMonthPills','renderTxTable','renderTxInsight'],
  mvm:['renderMonthVsMonth','renderSaldos','renderContrib','renderCategoryTrend','renderMvMInsight'],
  budget:['renderBudgetTable','renderBudgetInsight'],
  gastei:[],
  review:['renderReview'],
  insights:['renderInsights','renderInsightsFooter'],
  dados:['renderDados']
};
function sincronizaPerfil(){ [].forEach.call(document.querySelectorAll('.prof'),
  function(x){x.classList.toggle('on', x.dataset.p===state.perfil)}); }
function atualizaPin(){ var n=el('rev-pin'); if(!n) return;
  var p=allTx().filter(function(t){return t.revisar}).length;
  n.textContent=p; n.dataset.zero=p===0?'1':'0'; }
function aplicaTemaNosCharts(){ atualizarCharts(temaEfetivo()); }
function rodarRender(nome){ var fn=window[nome];
  if(typeof fn!=='function'){ console.warn('render ausente: '+nome); return; }
  try{ fn() }catch(e){ console.error('Erro em '+nome+':',e) } }
/* cede a thread entre fatias em velocidade de tarefa (nao de frame):
   requestAnimationFrame fica estrangulado em iframes/abas em segundo plano. */
var proximaFatia = (function(){
  if (typeof MessageChannel === 'function'){
    var ch=new MessageChannel(), fila=[];
    ch.port1.onmessage=function(){ var cb=fila.shift(); if(cb) cb(); };
    return function(cb){ fila.push(cb); ch.port2.postMessage(0); };
  }
  return function(cb){ setTimeout(cb,0) };
})();
var fatiaEmCurso=0;
function renderPanel(tab){
  var lista=PANEL_FNS[tab]; if(!lista) return;
  var meu=++fatiaEmCurso, i=0;
  (function passo(){
    if(meu!==fatiaEmCurso) return;          // outro render comecou: abandona este
    if(i>=lista.length){ rodarRender('aplicaTemaNosCharts'); return; }
    rodarRender(lista[i++]);
    proximaFatia(passo);
  })();
}
function abaAtiva(){ var b=el('tabs').querySelector('button.active'); return b?b.dataset.tab:'overview'; }
function renderAll(){
  if(!DATA) return;
  ['sincronizaPerfil','agRenderCTA','atualizaPin'].forEach(rodarRender);
  renderPanel(abaAtiva());
}

/* ---------- inicializacao ---------- */
function mostrarTela(nome){
  var n=el('tela-app'); if(n) n.hidden = (nome!=='app');
  document.body.dataset.tela = nome;
}
/* A base vive no banco (tabela base_documento), carregada pelo Store no boot.
   Enquanto ninguem importou a base, o dashboard abre com data/exemplo.json,
   um arquivo de valores ficticios apenas para nao mostrar tela vazia. */
var USANDO_EXEMPLO = false;
function carregarBase(){
  var b = Store.base();
  if (b) { USANDO_EXEMPLO = false; return Promise.resolve(JSON.parse(JSON.stringify(b))); }
  USANDO_EXEMPLO = true;
  return fetch('data/exemplo.json', {cache:'no-cache'})
    .then(function(r){ if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); });
}
function iniciarDashboard(){
  return carregarBase()
    .then(function(base){
      aplicarBase(base);
      var s=Auth.sessao(); if(s && s.perfil && !Store.get(K.PREFS,{}).perfil) state.perfil=s.perfil;
      try{ var tm=Store.get(K.TEMA,null);
        if(tm==='claro'||tm==='escuro'||tm==='auto'){ TEMA.modo=tm; aplicarTema();
          var seg=el('theme-sel'); if(seg) [].forEach.call(seg.querySelectorAll('button'), function(b){ b.classList.toggle('on', b.dataset.t===tm) });
        } }catch(e){}
      [wireProfile,wireTabs,wireAxis,wireTxControls,wireReview,wireRefreshButton,agWire,wireDados,wireContribAdd]
        .forEach(function(f){ try{f()}catch(e){console.error(f.name,e)} });
      renderAll();
      try{ agInit() }catch(e){ console.error('agInit',e) }
      el('boot').hidden=true;
      return true;
    })
    .catch(function(err){
      el('boot').innerHTML='<div class="boot-erro"><b>Nao consegui carregar os dados.</b><br>'+
        'Este site precisa ser servido por um servidor web (GitHub Pages ou <code>python3 -m http.server</code>) '+
        'e a chave publica precisa estar preenchida em <code>js/supabase-config.js</code>.<br>'+
        '<span class="mono">'+esc(String(err && err.message || err))+'</span></div>';
      console.error(err);
    });
}
var dashboardPronto=false;
function abrirDashboard(){
  mostrarTela('app');
  if(dashboardPronto){ renderAll(); return; }
  dashboardPronto=true; iniciarDashboard();
}
function sairDaConta(){
  Promise.resolve(Store.sincronizar()).then(function(){ return Auth.sair(); })
    .then(function(){ location.replace(Auth.porta); });
}

/* Quando a outra usuaria grava algo, o Store recarrega e avisa aqui. */
function recarregarDoBanco(){
  if(!dashboardPronto) return;
  carregarBase().then(function(base){ aplicarBase(base); renderAll(true); }).catch(function(e){ console.error(e) });
}

(function boot(){
  preAplicarTema();
  document.addEventListener('DOMContentLoaded', function(){
    try{ wireTema() }catch(e){ console.error('wireTema',e) }
    var bootEl = el('boot');
    if(bootEl) bootEl.innerHTML = '<div class="spin"></div>Conectando&hellip;';
    Auth.iniciar()
      .then(function(sessao){
        if(!sessao){ location.replace(Auth.porta); return null; }   // sem sessao: volta para o acesso
        var bSair=el('top-sair'); if(bSair) bSair.addEventListener('click', sairDaConta);
        return Store.iniciar(sessao).then(function(){
          Store.aoAtualizar(recarregarDoBanco);
          abrirDashboard();
        });
      })
      .catch(function(err){
        console.error(err);
        if(bootEl) bootEl.innerHTML='<div class="boot-erro"><b>Nao consegui conectar ao banco.</b><br>'+
          'Confira a chave publica em <code>js/supabase-config.js</code> e se o <code>schema.sql</code> ja foi executado.<br>'+
          '<span class="mono">'+esc(String(err && err.message || err))+'</span></div>';
      });
  });
})();
