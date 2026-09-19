/* NuNa - charts.js: graficos mes a mes, saldos, contribuicao e orcamento */
var barChart=null,saldoChart=null,contribChart=null,trendChart=null;
function renderMonthVsMonth(){
  var ctx=el('bars'); if(!ctx||typeof Chart==='undefined')return;
  var renda=MONTHS.map(function(m){return rendaOf(m,state.perfil)});
  var gasto=MONTHS.map(function(m){return gastoOf(m,state.perfil)});
  if(barChart)barChart.destroy();
  barChart=new Chart(ctx,{type:'bar',
    data:{labels:MONTHS,datasets:[{label:state.perfil==='NuNa'?'Renda do casal':'Receitas',data:renda,backgroundColor:'#1B4332',borderRadius:4},
      {label:state.perfil==='NuNa'?'Despesas conjuntas':'Gastos',data:gasto,backgroundColor:'#BC4749',borderRadius:4}]},
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{position:'bottom',labels:{boxWidth:10,font:{size:11}}},
        tooltip:{callbacks:{label:function(c){return c.dataset.label+': '+brl(c.raw)},
          afterBody:function(it){var i=it[0].dataIndex;return 'Saldo: '+brl(saldoOf(MONTHS[i],state.perfil))}}}},
      scales:{y:{ticks:{callback:function(v){return 'R$ '+(v/1000).toFixed(0)+'k'},font:{size:10}},grid:{color:'rgba(128,128,128,.15)'}},
              x:{grid:{display:false},ticks:{font:{size:11}}}}}});
}
function renderSaldos(){
  var ctx=el('saldos'); if(!ctx||typeof Chart==='undefined')return;
  var mk=function(p,c){return {label:p,data:MONTHS.map(function(m){return saldoOf(m,p)}),borderColor:c,backgroundColor:c+'22',tension:.3,pointRadius:4,fill:false}};
  if(saldoChart)saldoChart.destroy();
  saldoChart=new Chart(ctx,{type:'line',
    data:{labels:MONTHS,datasets:[mk('Ana','#4A6FA5'),mk('Manuela','#6F4E7C'),mk('NuNa','#1B4332')]},
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{position:'bottom',labels:{boxWidth:10,font:{size:11}}},
        tooltip:{callbacks:{label:function(c){return c.dataset.label+': '+brl(c.raw)}}}},
      scales:{y:{ticks:{callback:function(v){return 'R$ '+(v/1000).toFixed(0)+'k'},font:{size:10}},grid:{color:'rgba(128,128,128,.15)'}},x:{grid:{display:false}}}}});
}
function renderContrib(){
  var card=el('contrib-card'); if(!card)return;
  if(state.perfil!=='NuNa'){card.hidden=true;return;}
  card.hidden=false;
  var cs=MONTHS.map(function(m){return contribOf(m)});
  var ana=cs.map(function(c){return c.ana}), man=cs.map(function(c){return c.manu}), tr=cs.map(function(c){return c.tr});
  var th=el('contrib-table').querySelector('thead'), tb=el('contrib-table').querySelector('tbody');
  th.innerHTML='<tr><th>Quem</th>'+MONTHS.map(function(m){return '<th class="num">'+m+'</th>'}).join('')+'<th class="num">Total</th><th class="num">Share</th></tr>';
  var ta=ana.reduce(function(a,b){return a+b},0), tm=man.reduce(function(a,b){return a+b},0), tt=ta+tm;
  var row=function(nm,arr,tot,cls){return '<tr'+(cls||'')+'><td>'+nm+'</td>'+arr.map(function(v){return '<td class="num">'+(v?brl(v).replace('R$ ',''):'&mdash;')+'</td>'}).join('')+
    '<td class="num"><b>'+brl(tot).replace('R$ ','')+'</b></td><td class="num">'+(tt?Math.round(tot/tt*100):0)+'%</td></tr>';};
  tb.innerHTML=row('Ana',ana,ta)+row('Manuela',man,tm)+
    (tr.some(function(v){return v>0})?'<tr style="color:var(--tx3)"><td>&nbsp;&nbsp;<i>dos quais, contribui&ccedil;&otilde;es pontuais da Manuela</i></td>'+
      tr.map(function(v){return '<td class="num">'+(v?brl(v).replace('R$ ',''):'&mdash;')+'</td>'}).join('')+
      '<td class="num">'+brl(tr.reduce(function(a,b){return a+b},0)).replace('R$ ','')+'</td><td></td></tr>':'')+
    '<tr class="tot"><td>Total NuNa</td>'+MONTHS.map(function(m,i){return '<td class="num">'+brl(ana[i]+man[i]).replace('R$ ','')+'</td>'}).join('')+
    '<td class="num">'+brl(tt).replace('R$ ','')+'</td><td class="num">100%</td></tr>';
  var ctx=el('contrib'); if(!ctx||typeof Chart==='undefined')return;
  if(contribChart)contribChart.destroy();
  contribChart=new Chart(ctx,{type:'bar',
    data:{labels:MONTHS,datasets:[{label:'Ana',data:ana,backgroundColor:'#4A6FA5',borderRadius:4},
      {label:'Manuela',data:man,backgroundColor:'#6F4E7C',borderRadius:4}]},
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{position:'bottom',labels:{boxWidth:10,font:{size:11}}},
        tooltip:{callbacks:{label:function(c){return c.dataset.label+': '+brl(c.raw)},
          afterBody:function(it){var i=it[0].dataIndex,t=ana[i]+man[i];
            return t?['Ana '+Math.round(ana[i]/t*100)+'% | Manuela '+Math.round(man[i]/t*100)+'%','Diferenca: '+brl(Math.abs(ana[i]-man[i]))]:''}}}},
      scales:{x:{stacked:true,grid:{display:false}},
              y:{stacked:true,ticks:{callback:function(v){return 'R$ '+(v/1000).toFixed(1)+'k'},font:{size:10}},grid:{color:'rgba(128,128,128,.15)'}}}}});
}
function renderCategoryTrend(){
  var tot={};MONTHS.forEach(function(m){var t=catTotals(txOf(m,state.perfil));Object.keys(t).forEach(function(k){tot[k]=(tot[k]||0)+t[k]})});
  var cats=Object.keys(tot).sort(function(a,b){return tot[b]-tot[a]}).slice(0,8);
  if(!cats.length){el('trend-cats').innerHTML='';return;}
  if(cats.indexOf(state.trendCat)<0)state.trendCat=cats[0];
  el('trend-cats').innerHTML=cats.map(function(c){return '<button class="pill'+(c===state.trendCat?' on':'')+'" data-c="'+esc(c)+'">'+c+'</button>'}).join('');
  [].forEach.call(el('trend-cats').children,function(b){b.onclick=function(){state.trendCat=b.dataset.c;renderCategoryTrend()}});
  var ctx=el('trend'); if(!ctx||typeof Chart==='undefined')return;
  var series=MONTHS.map(function(m){return txOf(m,state.perfil).filter(function(t){return catKey(t)===state.trendCat}).reduce(function(s,t){return s+t.valor},0)});
  if(trendChart)trendChart.destroy();
  trendChart=new Chart(ctx,{type:'line',
    data:{labels:MONTHS,datasets:[{label:state.trendCat,data:series,borderColor:colorOf(state.trendCat),backgroundColor:colorOf(state.trendCat)+'22',fill:true,tension:.3,pointRadius:4}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:function(c){return brl(c.raw)}}}},
      scales:{y:{ticks:{callback:function(v){return brl(v)},font:{size:10}},grid:{color:'rgba(128,128,128,.15)'}},x:{grid:{display:false}}}}});
}
function renderMvMInsight(){
  var l=CLOSED.map(function(m){return [m,saldoOf(m,state.perfil)]}).sort(function(a,b){return a[1]-b[1]});
  var mag=l[0],gor=l[l.length-1];
  el('ins-mvm').textContent='"Seu mes mais magro foi '+mag[0]+' ('+brl(mag[1])+'). O mais gordo, '+gor[0]+' ('+brl(gor[1])+'). Diferenca: '+brl(gor[1]-mag[1])+'."';
}

/* ---------- ORCAMENTO ---------- */
function budgetOf(c){var b=DATA.budgets[state.perfil]||{};return b[c]!==undefined?b[c]:0;}
function renderBudgetTable(){
  var base = state.perfil==='NuNa'?CATS.NuNa:(state.perfil==='Manuela'?CATS.Manuela:CATS.Ana);
  var seen={};MONTHS.forEach(function(m){Object.keys(catTotals(txOf(m,state.perfil))).forEach(function(c){seen[c]=1})});
  var list=base.slice(); Object.keys(seen).forEach(function(c){if(list.indexOf(c)<0)list.push(c)});
  if(state.axis==='tipo'&&state.perfil!=='NuNa') list=Object.keys(seen).sort();
  var th=el('bd-table').querySelector('thead'),tb=el('bd-table').querySelector('tbody');
  th.innerHTML='<tr><th>Categoria</th><th class="num">Or&ccedil;amento/m&ecirc;s</th>'+MONTHS.map(function(m){return '<th class="num">'+m+'</th>'}).join('')+'<th class="num">M&eacute;dia</th><th>Status</th></tr>';
  var counts={ok:0,warn:0,bad:0};
  tb.innerHTML=list.map(function(c){
    var vals=MONTHS.map(function(m){return txOf(m,state.perfil).filter(function(t){return catKey(t)===c}).reduce(function(s,t){return s+t.valor},0)});
    var cv=CLOSED.map(function(m){return txOf(m,state.perfil).filter(function(t){return catKey(t)===c}).reduce(function(s,t){return s+t.valor},0)});
    var med=cv.reduce(function(a,b){return a+b},0)/cv.length, b=budgetOf(c), r=b?med/b:0, cls,lab;
    if(!b){cls='b-ind';lab='sem meta';}
    else if(r>1.05){cls='b-bad';lab='estourou';counts.bad++;}
    else if(r>=0.9){cls='b-warn';lab='aten&ccedil;&atilde;o';counts.warn++;}
    else{cls='b-ok';lab='no alvo';counts.ok++;}
    return '<tr'+(cls==='b-bad'?' style="background:var(--negL)"':'')+'><td>'+c+'</td>'+
      '<td class="num"><input type="text" class="bd-in" data-c="'+esc(c)+'" value="'+b.toFixed(2).replace('.',',')+'" style="width:92px;text-align:right"></td>'+
      vals.map(function(v){return '<td class="num">'+(v?brl(v).replace('R$ ',''):'&mdash;')+'</td>'}).join('')+
      '<td class="num"><b>'+brl(med).replace('R$ ','')+'</b></td><td><span class="badge '+cls+'">'+lab+'</span></td></tr>';}).join('');
  el('bd-cards').innerHTML=kpiCard('No alvo / abaixo',counts.ok,'categorias dentro da meta','green')+
    kpiCard('Aten&ccedil;&atilde;o',counts.warn,'&ge; 90% do or&ccedil;amento','orange')+kpiCard('Estourou',counts.bad,'acima da meta na m&eacute;dia','red');
  [].forEach.call(tb.querySelectorAll('.bd-in'),function(i){i.onchange=function(){
    DATA.budgets[state.perfil][i.dataset.c]=parseFloat(i.value.replace(/\./g,'').replace(',','.'))||0;
    salvarOrcamentos(); renderBudgetTable();renderBudgetInsight();};});
}
function renderBudgetInsight(){
  var seen={};CLOSED.forEach(function(m){Object.keys(catTotals(txOf(m,state.perfil))).forEach(function(c){seen[c]=1})});
  var worst=null,n0=0;
  Object.keys(seen).forEach(function(c){var b=budgetOf(c);if(!b)return;
    var n=CLOSED.filter(function(m){return txOf(m,state.perfil).filter(function(t){return catKey(t)===c}).reduce(function(s,t){return s+t.valor},0)>b*1.05}).length;
    if(n>n0){n0=n;worst=c;}});
  el('ins-bd').textContent=worst?'"'+worst+' estourou o orcamento em '+n0+' dos '+CLOSED.length+' meses fechados. Considere ajustar a meta ou o habito."'
    :'"Tudo dentro do orcamento nos meses fechados - parabens."';
}
