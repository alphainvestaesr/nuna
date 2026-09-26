/* NuNa - overview.js: Visao Geral, KPIs, colaboracao, donut e Caixinha */
function kpiCard(lab,val,sub,cls){return '<div class="kpi"><div class="lab">'+lab+'</div><div class="val '+(cls||'')+'">'+val+'</div><div class="sub">'+sub+'</div></div>';}

function renderKPI(){
  esconderContribSeConjunto();
  var p=state.perfil, renda=rendaOf(state.mes,p), gasto=gastoOf(state.mes,p), sp=splitOf(state.mes,p);
  var saldo=saldoOf(state.mes,p);
  var liq=Math.max(0,saldo);
  var transf=liq*GOALS.reserva + liq*GOALS.investimentos;
  var aberto=CLOSED.indexOf(state.mes)<0;
  if(p==='NuNa'){
    el('ov-kpis').innerHTML=
      kpiCard('Despesas conjuntas', brl(gasto), 'custo da vida em comum no m&ecirc;s','red')+
      kpiCard('Contribui&ccedil;&atilde;o de Ana', brl(contribOf(state.mes).ana), 'registrada por ela no m&ecirc;s','')+
      kpiCard('Contribui&ccedil;&atilde;o de Manuela', brl(contribOf(state.mes).manu), 'registrada por ela no m&ecirc;s','')+
      kpiCard('Renda do casal', brl(renda), 'Ana + Manuela'+(aberto&&DATA.months[state.mes].receita.Ana===0?' &mdash; sem contracheque da Ana':''),'green');
  } else {
    el('ov-kpis').innerHTML=
      kpiCard('Receitas', brl(renda), p==='Ana'?'contracheque + extras':'sal&aacute;rio + dividendos informados','green')+
      kpiCard('Despesas individuais', brl(sp.ind), 'consumo s&oacute; dela','red')+
      kpiCard('Conjuntas pagas por ela', brl(contribManualOf(state.mes,p)), 'contribui&ccedil;&atilde;o registrada no m&ecirc;s','orange')+
      kpiCard('Conjuntas geradas por ela', brl(sp.conj), 'informativo &mdash; n&atilde;o entra no saldo','')+
      kpiCard('Saldo', brl(saldo), 'receitas &minus; (individuais + contribui&ccedil;&atilde;o)', saldo>=0?'green':'red')+
(p==='Ana' ? kpiCard('Cravo &amp; Canela', brl(lojaOf(state.mes,p)), '&agrave; parte &mdash; loja, fora dos seus gastos e do saldo','') : '');
  }
  renderCollab(); renderContribBox();
}
function esconderContribSeConjunto(){
  var row=el('contrib-row'); if(!row) return;
  if(state.perfil==='NuNa'){ row.hidden=true; var pn=el('ca-painel'); if(pn) pn.hidden=true; }
}
function caParseValor(v){ return parseFloat(String(v||'').replace(/\./g,'').replace(',','.')); }
function renderContribBox(){
  var row=el('contrib-row'); if(!row) return;
  var p=state.perfil;
  row.hidden = (p==='NuNa');
  if(p==='NuNa') return;
  var lista=contribDoMes(state.mes,p);
  var man=lista.reduce(function(s,c){return s+c.valor},0);
  el('ca-nota').innerHTML='Quanto <b>'+esc(p)+'</b> contribuiu em <b>'+esc(state.mes)+'</b>. '+
    '&Eacute; o pagamento real dela nas contas conjuntas: entra apenas no c&aacute;lculo do saldo.';
  var tb=el('ca-lista').querySelector('tbody');
  tb.innerHTML = lista.length
    ? lista.map(function(c){
        return '<tr><td>'+esc(c.desc)+'</td><td class="num">'+brl(c.valor)+
          '</td><td class="num"><button class="pill" data-rm="'+esc(c.id)+'">remover</button></td></tr>';
      }).join('') + '<tr class="tot"><td>Informado em '+esc(state.mes)+'</td><td class="num">'+brl(man)+'</td><td></td></tr>'
    : '<tr><td colspan="3" style="color:var(--tx3)">Nada informado em '+esc(state.mes)+'.</td></tr>';
  renderSaldoForm();
}
function renderSaldoForm(){
  var box=el('saldo-form'); if(!box) return;
  var p=state.perfil, r=rendaOf(state.mes,p), ind=splitOf(state.mes,p).ind;
  var conj=splitOf(state.mes,p).conj, man=contribManualOf(state.mes,p), ct=man;
  var saldo=r-ind-ct;
  box.innerHTML='<h3>Como o saldo se forma</h3><table><tbody>'+
    '<tr><td>Receitas</td><td class="num">'+brl(r)+'</td></tr>'+
    '<tr><td>&minus; Despesas <b>individuais</b></td><td class="num">'+brl(ind)+'</td></tr>'+
    '<tr><td>&minus; <b>Contribui&ccedil;&atilde;o</b>'+
      '<br><span style="font-size:11px;color:var(--tx3)">registrada no bot&atilde;o CONTRIBUI&Ccedil;&Atilde;O'+
      (conj?' &middot; contas conjuntas lan&ccedil;adas no m&ecirc;s ('+brl(conj)+') s&atilde;o informativas e n&atilde;o entram aqui':'')+'</span></td><td class="num">'+brl(ct)+'</td></tr>'+
    '<tr class="tot"><td>= Saldo</td><td class="num '+(saldo>=0?'green':'red')+'">'+brl(saldo)+'</td></tr>'+
    '</tbody></table>'+
    '<p class="note">RECEITAS &minus; (DESPESAS INDIVIDUAIS + CONTRIBUI&Ccedil;&Atilde;O) = SALDO. '+
    'S&oacute; a contribui&ccedil;&atilde;o registrada conta como conjunta paga por ela &mdash; o total das contas conjuntas do m&ecirc;s &eacute; informativo e nunca entra automaticamente no saldo.</p>';
}
function caParseValor(v){ return parseFloat(String(v||'').replace(/\./g,'').replace(',','.')); }
function contribAdicionar(){
  var p=state.perfil; if(p==='NuNa') return;
  var valor=caParseValor(el('ca-valor').value);
  if(!(valor>0)){ flashToast('Informe um valor maior que zero.'); el('ca-valor').focus(); return; }
  var hoje=new Date();
  var item={ id:'c'+Date.now().toString(36)+Math.random().toString(36).slice(2,7),
    perfil:p, mes:state.mes, valor:Math.round(valor*100)/100,
    desc:(el('ca-desc').value.trim() || 'Contribuicao de '+p+' em '+state.mes),
    criadoEm:hoje.toISOString() };
  contribSave(contribList().concat([item]));
  el('ca-valor').value=''; el('ca-desc').value='';
  renderAll(true);
  flashToast('Contribuicao de '+brl(item.valor)+' registrada em '+state.mes+'.');
}
function wireContribAdd(){
  var ab=el('ca-abrir'), pn=el('ca-painel');
  if(ab&&pn) ab.addEventListener('click', function(){
    var ov=el('tabs').querySelector('[data-tab="overview"]');
    if(ov && !el('panel-overview').classList.contains('active')) ov.click();
    pn.hidden=!pn.hidden; if(!pn.hidden) el('ca-valor').focus();
  });
  var b=el('ca-add'); if(b) b.addEventListener('click', contribAdicionar);
  var v=el('ca-valor'); if(v) v.addEventListener('keydown', function(e){ if(e.key==='Enter') contribAdicionar(); });
  var t=el('ca-lista'); if(t) t.addEventListener('click', function(e){
    var btn=e.target.closest('[data-rm]'); if(!btn) return;
    contribSave(contribList().filter(function(c){return c.id!==btn.dataset.rm}));
    renderAll(true); flashToast('Contribuicao removida.');
  });
}
/* proporcao acordada de divisao das contas conjuntas */
var SPLIT={Ana:0.75,Manuela:0.25};
var SPLIT_LAB='Ana 75% / Manuela 25%';
function renderCollab(){
  var card=el('collab-card'); if(!card) return;
  if(state.perfil!=='NuNa'){card.hidden=true;return;}
  card.hidden=false;
  var c=contribOf(state.mes), tot=c.ana+c.manu;
  var pa=tot?c.ana/tot*100:0, pm=tot?c.manu/tot*100:0;
  /* PARTE DE CADA UMA: informativo, calculado sobre o total automatico de
     despesas conjuntas do mes (nao sobre o que foi lancado a mao). */
  var totConj=gastoOf(state.mes,'NuNa');
  var alvoA=totConj*SPLIT.Ana, alvoM=totConj*SPLIT.Manuela;
  var desvio=c.ana-tot*SPLIT.Ana, dif=Math.abs(desvio);
  var quem = desvio>0.005 ? 'Ana' : (desvio<-0.005 ? 'Manuela' : null);
  /* FORA DA PROPORCAO: compara a proporcao real das contribuicoes lancadas
     com a acordada. Dourado quando batem; laranja em qualquer desvio. */
  var pctAcA=SPLIT.Ana*100, pctAcM=SPLIT.Manuela*100;
  var bate = tot>0 && Math.abs(pa-pctAcA)<0.05 && Math.abs(pm-pctAcM)<0.05;
  var propVal = tot>0
    ? 'Ana '+pa.toFixed(1).replace('.',',')+'% &middot; Manuela '+pm.toFixed(1).replace('.',',')+'%'
    : '&mdash;';
  var propSub = tot>0
    ? 'acordado: '+SPLIT_LAB+(bate?' &mdash; em linha':' &mdash; fora da propor&ccedil;&atilde;o')
    : 'nenhuma contribui&ccedil;&atilde;o lan&ccedil;ada em '+state.mes;
  el('collab-kpis').innerHTML=
    kpiCard('Total conjunto', brl(tot), 'contribui&ccedil;&otilde;es lan&ccedil;adas em '+state.mes,'')+
    kpiCard('Parte de cada uma', brl(alvoA)+' / '+brl(alvoM),
      SPLIT_LAB+' de '+brl(totConj)+' &mdash; refer&ecirc;ncia informativa','')+
    kpiCard('Propor&ccedil;&atilde;o real', propVal, propSub, (tot>0 && !bate)?'amber':'orange');
  el('collab-bar').innerHTML=
    '<div class="cbar">'+
    '<span style="width:'+pa.toFixed(1)+'%;background:#4A6FA5">'+(pa>=12?'Ana '+Math.round(pa)+'%':'')+'</span>'+
    '<span style="width:'+pm.toFixed(1)+'%;background:#6F4E7C">'+(pm>=12?'Manuela '+Math.round(pm)+'%':'')+'</span>'+
    '<i style="position:absolute;top:0;bottom:0;left:calc('+(SPLIT.Ana*100)+'% - 1px);width:2px;background:var(--tx);opacity:.65"></i></div>'+
    '<div style="display:flex;justify-content:space-between;font-size:11.5px;color:var(--tx3)"><span>Ana '+brl(c.ana)+' &middot; '+pa.toFixed(1)+'%</span><span>Manuela '+brl(c.manu)+' &middot; '+pm.toFixed(1)+'%</span></div>';
  el('collab-note').innerHTML =
    '<b>Refer&ecirc;ncia:</b> pela propor&ccedil;&atilde;o '+SPLIT_LAB+', as contas conjuntas de '+esc(state.mes)+' ('+brl(totConj)+') dariam '+brl(alvoA)+' para Ana e '+brl(alvoM)+' para Manuela. '+
    '<b>Lan&ccedil;ado:</b> Ana '+brl(c.ana)+' e Manuela '+brl(c.manu)+'. '+
    (tot>0
      ? (bate ? 'A propor&ccedil;&atilde;o das contribui&ccedil;&otilde;es est&aacute; em linha com o acordado.'
              : 'A propor&ccedil;&atilde;o das contribui&ccedil;&otilde;es est&aacute; fora do acordado &mdash; '+quem+' respondeu por '+brl(dif)+' acima da parte dela no que foi lan&ccedil;ado.')
      : 'Ainda sem contribui&ccedil;&atilde;o lan&ccedil;ada neste m&ecirc;s.')+
    ' Estes indicadores s&atilde;o informativos: n&atilde;o alteram saldo, contribui&ccedil;&atilde;o nem despesas.';
}
var donutChart=null;
function renderDonut(){
  var tot=catTotals(txOf(state.mes,state.perfil).filter(function(t){ return state.perfil==='NuNa' || t.divisao!=='CONJUNTA'; })); // perfil individual: so gastos individuais (conjuntas geradas ficam no card proprio e no perfil NuNa)
  var arr=Object.keys(tot).map(function(k){return [k,tot[k]]}).sort(function(a,b){return b[1]-a[1]});
  var soma=arr.reduce(function(s,a){return s+a[1]},0);
  el('donut-legend').innerHTML=arr.map(function(a){
    return '<li><span class="sw" style="background:'+colorOf(a[0])+'"></span><span class="nm">'+a[0]+'</span><span class="vv">'+brl(a[1])+' &middot; '+(soma?Math.round(a[1]/soma*100):0)+'%</span></li>';}).join('');
  var ctx=el('donut'); if(!ctx||typeof Chart==='undefined')return;
  if(donutChart)donutChart.destroy();
  donutChart=new Chart(ctx,{type:'doughnut',
    data:{labels:arr.map(function(a){return a[0]}),datasets:[{data:arr.map(function(a){return a[1]}),backgroundColor:arr.map(function(a){return colorOf(a[0])}),borderWidth:0}]},
    options:{responsive:true,maintainAspectRatio:false,cutout:'58%',plugins:{legend:{display:false},
      tooltip:{callbacks:{label:function(c){return c.label+': '+brl(c.raw)}}}}}});
}
function caixaCasal(mes){
  return rendaOf(mes,'Ana')+rendaOf(mes,'Manuela') - gastoOf(mes,'Ana') - gastoOf(mes,'Manuela');
}
function renderTransfers(){
  var saldo = state.perfil==='NuNa' ? caixaCasal(state.mes) : saldoOf(state.mes,state.perfil);
  var liq=Math.max(0,saldo), renda=rendaOf(state.mes,state.perfil);
  var items=[['Reserva de Emerg&ecirc;ncia',liq*GOALS.reserva,'10% do saldo dispon&iacute;vel'],
             ['Investimentos',liq*GOALS.investimentos,'15% do saldo dispon&iacute;vel']];
  el('caixinha-total').innerHTML = brl(liq*GOALS.reserva + liq*GOALS.investimentos);
  el('transfers').innerHTML=items.map(function(it,i){
    var key=state.perfil+'.'+state.mes+'.'+i, tr=Store.get(K.TRANSF,{}), on=!!tr[key];
    return '<label class="chk"><input type="checkbox" data-k="'+key+'"'+(on?' checked':'')+'><span class="n">'+it[0]+'<br><span style="font-size:11px;color:var(--tx3)">'+it[2]+'</span></span><span class="v">'+brl(it[1])+'</span></label>';}).join('');
  [].forEach.call(el('transfers').querySelectorAll('input'),function(c){c.onchange=function(){
    var tr=Store.get(K.TRANSF,{}); if(c.checked) tr[c.dataset.k]=1; else delete tr[c.dataset.k]; Store.set(K.TRANSF,tr); }});
  var base = state.perfil==='NuNa' ? 'Base: o caixa do casal no m&ecirc;s (renda das duas menos <b>todos</b> os gastos das duas, individuais inclusive) &mdash; '+brl(saldo)+'. ' : '';
  base += 'Imposto de Renda e INSS/Funaprev j&aacute; saem no contracheque e <b>n&atilde;o</b> contam como dispon&iacute;vel para a Caixinha.';
  el('transfers-note').innerHTML = (saldo<=0 ? 'Este m&ecirc;s fechou no vermelho, ent&atilde;o n&atilde;o h&aacute; saldo para transferir. Primeiro alvo: zerar o d&eacute;ficit. ' : '') + base;
}
function renderSavingsTracker(){
  var l=txOf(state.mes,state.perfil);
  var pode=l.filter(function(t){return t.status==='pode cancelar'}).reduce(function(s,t){return s+t.valor},0);
  var canc=l.filter(function(t){return t.status==='cancelado'}).reduce(function(s,t){return s+t.valor},0);
  el('sv-pode').textContent=brl(pode); el('sv-canc').textContent=brl(canc);
  el('sv-year').innerHTML = pode>0 ? 'Se cancelar tudo da coluna &ldquo;pode cancelar&rdquo;, voc&ecirc; economiza <b>'+brl(pode*12)+'</b> por ano.'
    : 'Nada marcado ainda. Abra a aba Transa&ccedil;&otilde;es e use a coluna Status para marcar o que d&aacute; pra cortar.';
}
function renderOverviewInsight(){
  var med=CLOSED.map(function(m){return saldoOf(m,state.perfil)}).reduce(function(a,b){return a+b},0)/CLOSED.length;
  el('ins-ov').textContent = state.perfil==='NuNa'
    ? '"Em '+CLOSED.length+' meses fechados, a vida em comum custou em media '+brl(-med)+'/mes."'
    : '"Em '+CLOSED.length+' meses fechados, o saldo de '+state.perfil+' ficou em media '+brl(med)+'/mes."';
}
