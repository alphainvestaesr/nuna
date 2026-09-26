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


/* ===== Agente NuNa: semaforo do orcamento, alertas e dicas ===== */
var AGT_MESES=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
function agtTotais(mes,p){
  var o={};
  txOf(mes,p).forEach(function(t){
    if(p!=='NuNa'&&t.divisao==='CONJUNTA')return;
    var k=p==='NuNa'?t.grupo:t.plano; if(!k)return;
    o[k]=(o[k]||0)+(+t.valor||0);
  });
  return o;
}
function agtFrac(mes){
  if(CLOSED.indexOf(mes)>=0)return 1;
  var h=new Date();
  if(AGT_MESES[h.getMonth()]!==mes)return null;
  var dias=new Date(h.getFullYear(),h.getMonth()+1,0).getDate();
  return h.getDate()/dias;
}
function agtMedia(p){
  var soma={};
  CLOSED.forEach(function(m){var t=agtTotais(m,p);Object.keys(t).forEach(function(c){soma[c]=(soma[c]||0)+t[c];});});
  Object.keys(soma).forEach(function(c){soma[c]=soma[c]/(CLOSED.length||1);});
  return soma;
}
function renderAgente(){
  var host=el('agente-nuna'), k=el('ov-kpis'); if(!k)return;
  if(!host){
    host=document.createElement('div'); host.id='agente-nuna';
    host.style.cssText='border:1px solid rgba(127,127,127,.28);border-radius:12px;padding:12px 14px;margin:14px 0 18px';
  }
  if(host.previousElementSibling!==k) k.parentNode.insertBefore(host,k.nextSibling);
  var p=state.perfil, mes=state.mes, B=(DATA.budgets&&DATA.budgets[p])||{};
  var FIXAS={'Descontos em folha':1,'Moradia (Apto)':1,'Investimento/Gustavo':1,'Terreno':1,'Casa da mamãe (Quilombo)':1,'Conta telefonica':1,'CRMV':1};
  var tot=agtTotais(mes,p), frac=agtFrac(mes), med=agtMedia(p);
  var COR={red:'#d64545',amber:'#d49a1e',green:'#2e9d5b'};
  var linhas=[], cats={};
  Object.keys(B).forEach(function(c){cats[c]=1;}); Object.keys(tot).forEach(function(c){cats[c]=1;});
  Object.keys(cats).forEach(function(c){
    var b=+B[c]||0, g=tot[c]||0; if(!b&&!g)return;
    var pct=b?g/b:1.01, cor='green';
    if(!FIXAS[c]){
      if(pct>1)cor='red';
      else if(pct>=0.8||(frac!==null&&frac<1&&pct>frac+0.15))cor='amber';
    }
    linhas.push({c:c,b:b,g:g,pct:pct,cor:cor});
  });
  var ordem={red:0,amber:1,green:2};
  linhas.sort(function(a,b){return ordem[a.cor]-ordem[b.cor]||b.pct-a.pct;});
  var alerta=linhas.filter(function(l){return l.cor!=='green';}), ok=linhas.length-alerta.length;
  var estour=linhas.filter(function(l){return l.cor==='red';});
  var resumo=[], nivel=estour.length?'red':(alerta.length?'amber':'green');
  if(p!=='NuNa'){
    var renda=rendaOf(mes,p), saldo=saldoOf(mes,p);
    if(!renda){resumo.push('receitas de '+mes+' n&atilde;o lan&ccedil;adas'); if(nivel==='green')nivel='amber';}
    else if(frac&&frac<1){
      var proj=renda-splitOf(mes,p).ind/frac-contribTotalOf(mes,p);
      resumo.push('no ritmo atual fecha em <b>'+brl(proj)+'</b>'); if(proj<0)nivel='red';
    } else { resumo.push('saldo <b>'+brl(saldo)+'</b>'); if(saldo<0)nivel='red'; }
  }
  resumo.push(estour.length?estour.length+' categoria'+(estour.length>1?'s':'')+' estourada'+(estour.length>1?'s':''):(alerta.length?alerta.length+' em aten&ccedil;&atilde;o':'or&ccedil;amento em dia'));
  function dot(c){return '<span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:'+COR[c]+';margin-right:7px;flex:none"></span>';}
  var chips=alerta.slice(0,4).map(function(l){
    return '<span style="display:inline-flex;align-items:center;border:1px solid '+COR[l.cor]+';border-radius:999px;padding:2px 10px;font-size:12px;margin:6px 6px 0 0;white-space:nowrap">'+
      esc(l.c)+'&nbsp;<b>'+(l.b?Math.round(l.pct*100)+'%':'s/ or&ccedil;.')+'</b></span>';
  }).join('')+(alerta.length>4?'<span style="font-size:12px;opacity:.7;margin-top:6px;display:inline-block">+'+(alerta.length-4)+'</span>':'');
  var dicas=[];
  estour.slice(0,2).forEach(function(l){
    dicas.push(l.b?'<b>'+esc(l.c)+'</b> passou '+brl(l.g-l.b)+' do or&ccedil;amento. Segure novos gastos aqui at&eacute; o fim do m&ecirc;s.'
                 :'<b>'+esc(l.c)+'</b> teve '+brl(l.g)+' sem or&ccedil;amento definido.');
  });
  Object.keys(tot).map(function(c){return [c,tot[c]-(med[c]||0)];})
    .filter(function(x){return !FIXAS[x[0]]&&med[x[0]]>50&&x[1]>med[x[0]]*0.3;})
    .sort(function(a,b){return b[1]-a[1];})
    .forEach(function(x){ if(dicas.length<3&&!estour.some(function(l){return l.c===x[0];}))
      dicas.push('<b>'+esc(x[0])+'</b> est&aacute; '+brl(x[1])+' acima da sua m&eacute;dia ('+brl(med[x[0]])+').'); });
  var barras=alerta.map(function(l){
    var w=Math.min(100,Math.round(l.pct*100));
    return '<div><div style="display:flex;justify-content:space-between;gap:8px;font-size:12px"><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(l.c)+'</span>'+
      '<span style="opacity:.8;white-space:nowrap">'+brl(l.g)+(l.b?' / '+brl(l.b):'')+'</span></div>'+
      '<div style="height:4px;border-radius:2px;background:rgba(127,127,127,.18);margin-top:4px"><div style="height:4px;border-radius:2px;width:'+w+'%;background:'+COR[l.cor]+'"></div></div></div>';
  }).join('');
  var aberto=false; try{aberto=localStorage.getItem('clarezaAberto')==='1';}catch(e){}
  host.innerHTML=
    '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">'+
      '<div style="display:flex;align-items:center;min-width:0">'+dot(nivel)+'<span style="font-weight:700;letter-spacing:.04em;font-size:13px;margin-right:10px">CLAREZA &middot; ALERTA</span>'+
      '<span style="font-size:13px;opacity:.9">'+resumo.join(' &middot; ')+'</span></div>'+
      '<span style="display:flex;align-items:center;gap:10px"><span style="font-size:11px;opacity:.6">'+(p==='NuNa'?'conjunto':esc(p))+' &middot; '+mes+'</span>'+
      '<button id="clareza-share" type="button" style="font:inherit;font-size:12px;padding:3px 10px;border-radius:999px;border:1px solid rgba(127,127,127,.4);background:transparent;color:inherit;cursor:pointer">Enviar resumo</button></span></div>'+
    (chips?'<div>'+chips+'</div>':'')+
    '<details id="clareza-det"'+(aberto?' open':'')+' style="margin-top:8px"><summary style="cursor:pointer;font-size:12px;opacity:.75">Detalhes e dicas</summary>'+
      (barras?'<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px 18px;margin-top:10px">'+barras+'</div>':'')+
      (ok?'<div style="font-size:12px;opacity:.7;margin-top:8px">'+dot('green')+ok+' categoria'+(ok>1?'s':'')+' dentro do or&ccedil;amento ou fixas</div>':'')+
      (dicas.length?'<ul style="margin:8px 0 0;padding-left:18px;font-size:13px">'+dicas.map(function(d){return '<li style="margin:3px 0">'+d+'</li>';}).join('')+'</ul>':'')+
    '</details>';
  var strip=function(h){var x=document.createElement('div');x.innerHTML=h;return x.textContent;};
  var txt=['NuNa - Clareza: '+(p==='NuNa'?'Conjunto':p)+' - '+mes,(nivel==='red'?'[VERMELHO]':nivel==='amber'?'[ATENCAO]':'[OK]')+' '+strip(resumo.join(' &middot; '))];
  if(alerta.length)txt.push('Em alerta: '+alerta.slice(0,6).map(function(l){return l.c+' '+(l.b?Math.round(l.pct*100)+'%':'sem orc.');}).join(', '));
  dicas.forEach(function(x){txt.push('- '+strip(x));});
  var sb=el('clareza-share'); if(sb)sb.addEventListener('click',function(){clarezaCompartilhar(txt.join('\n'));});
  var det=el('clareza-det'); if(det)det.addEventListener('toggle',function(){try{localStorage.setItem('clarezaAberto',det.open?'1':'0');}catch(e){}});
}
function clarezaCompartilhar(t){
  if(navigator.share){navigator.share({text:t}).catch(function(){});return;}
  window.open('https://wa.me/?text='+encodeURIComponent(t),'_blank');
}
(function(){
  var _kpi=renderKPI;
  renderKPI=function(){ var r=_kpi.apply(this,arguments); try{renderAgente();}catch(e){console.warn('Agente NuNa',e);} return r; };
})();
document.addEventListener('click',function(e){
  if(!e.target||!e.target.closest||!e.target.closest('#ag-save'))return;
  try{
    var v=parseFloat(String(el('ag-valor').value).replace(/\./g,'').replace(',','.')); if(!(v>0))return;
    var conj=el('ag-div').value==='CONJUNTA';
    var p=conj?'NuNa':el('ag-perfil').value, c=conj?el('ag-grupo').value:el('ag-cat').value;
    var b=+(((DATA.budgets||{})[p]||{})[c])||0; if(!b)return;
    var g=(agtTotais(state.mes,p)[c]||0)+v, msg='';
    if(g>b)msg='Atenção: com esse gasto, '+c+' passa do orçamento em '+brl(g-b)+'.';
    else if(g>=0.8*b)msg='Aviso: '+c+' chegou a '+Math.round(g/b*100)+'% do orçamento (restam '+brl(b-g)+').';
    if(msg)setTimeout(function(){flashToast(msg);},900);
  }catch(err){}
},true);
