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
      kpiCard('Receitas', brl(renda), p==='Ana'?'contracheque + extras':'sal&aacute;rio + extras informados','green')+
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
  if(state.perfil!=='Manuela') base += 'Imposto de Renda e INSS/Funaprev j&aacute; saem no contracheque e <b>n&atilde;o</b> contam como dispon&iacute;vel para a Caixinha.';
  el('transfers-note').innerHTML = (saldo<=0 ? 'Este m&ecirc;s fechou no vermelho, ent&atilde;o n&atilde;o h&aacute; saldo para transferir. Primeiro alvo: zerar o d&eacute;ficit. ' : '') + base;
}
function renderSavingsTracker(){
  var l=txOf(state.mes,state.perfil).filter(function(t){ return state.perfil==='NuNa' || t.divisao!=='CONJUNTA'; });
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


/* ===== Layout compacto da Visao Geral ===== */
function nunaLayout(){
  var ov=el('panel-overview'), collab=el('collab-card'), donut=el('donut');
  if(!ov||!collab||!donut)return;
  var grid=donut.closest('#panel-overview > *');
  if(grid&&(collab.compareDocumentPosition(grid)&Node.DOCUMENT_POSITION_FOLLOWING))ov.insertBefore(grid,collab);
}
function collabCompacto(){
  var box=el('collab-card'); if(!box||state.perfil!=='NuNa')return;
  var det=box.querySelector(':scope > details.collab-det'), orig;
  if(det){ orig=det.querySelector(':scope > .collab-orig'); }
  else { orig=document.createElement('div'); orig.className='collab-orig'; orig.style.marginTop='10px'; while(box.firstChild)orig.appendChild(box.firstChild); }
  if(!orig||!orig.textContent.trim())return;
  var m=state.mes, tot=gastoOf(m,'NuNa'), c=contribOf(m)||{}, ca=+c.ana||0, cm=+c.manuela||0, paid=ca+cm, pa=paid?ca/paid*100:0;
  box.innerHTML=
    '<div style="display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:8px"><h3 style="margin:0">Divis&atilde;o do m&ecirc;s</h3>'+
    '<span style="font-size:12px;opacity:.7">combinado Ana 75% &middot; Manuela 25%</span></div>'+
    '<div style="position:relative;height:14px;border-radius:7px;overflow:hidden;background:rgba(127,127,127,.2);margin:12px 0 6px">'+
      '<div style="display:flex;height:100%"><div style="width:'+pa+'%;background:#4A6FA5"></div><div style="width:'+(paid?100-pa:0)+'%;background:#6F4E7C"></div></div>'+
      '<div style="position:absolute;top:0;bottom:0;left:75%;width:2px;background:#fff;opacity:.85"></div></div>'+
    '<div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:6px;font-size:13px">'+
      '<span><b style="color:#7ea3d9">Ana</b> pagou '+brl(ca)+' ('+Math.round(pa)+'%) &middot; parte dela '+brl(tot*.75)+'</span>'+
      '<span><b style="color:#a57fb3">Manuela</b> pagou '+brl(cm)+' ('+(paid?Math.round(100-pa):0)+'%) &middot; parte dela '+brl(tot*.25)+'</span></div>'+
    '<details class="collab-det" style="margin-top:8px"><summary style="cursor:pointer;font-size:12px;opacity:.75">Ver detalhes</summary></details>';
  box.querySelector('details.collab-det').appendChild(orig);
}
function rastreadorCompacto(){
  var pode=el('sv-pode'); if(!pode)return;
  var card=pode.closest('#panel-overview > *'); if(!card)return;
  var z=brl(0).replace(/\s/g,''), vazio=pode.textContent.replace(/\s/g,'')===z&&el('sv-canc').textContent.replace(/\s/g,'')===z;
  var split=card.querySelector('.split'), nota=el('sv-year'), dica=el('sv-vazio');
  if(!dica){
    dica=document.createElement('div'); dica.id='sv-vazio';
    dica.style.cssText='font-size:13px;opacity:.75;margin-top:6px';
    dica.innerHTML='Nada marcado ainda &mdash; use &ldquo;pode cancelar&rdquo; na aba Transa&ccedil;&otilde;es.';
    (split||nota).parentNode.insertBefore(dica,split||nota);
  }
  dica.style.display=vazio?'':'none';
  if(split)split.style.display=vazio?'none':'';
  if(nota)nota.style.display=vazio?'none':'';
}
(function(){
  var _st=renderSavingsTracker, _tr=renderTransfers, _co=renderCollab;
  renderSavingsTracker=function(){ var r=_st.apply(this,arguments); try{rastreadorCompacto();}catch(e){} return r; };
  renderCollab=function(){ var r=_co.apply(this,arguments); try{nunaLayout();collabCompacto();}catch(e){console.warn(e);} return r; };
  renderTransfers=function(){ var r=_tr.apply(this,arguments);
    try{ var n=el('transfers-note'); if(n&&/fechou no vermelho/.test(n.textContent)) n.innerHTML='M&ecirc;s no vermelho: sem saldo para guardar. Primeiro alvo: zerar o d&eacute;ficit.'; }catch(e){}
    return r; };
})();
window.addEventListener('load',function(){
  if(typeof atualizaPin!=='function')return;
  atualizaPin=function(){ var n=el('rev-pin'); if(!n)return;
    var p=allTx().filter(function(t){return t.revisar&&(typeof revVisivel!=='function'||revVisivel(t));}).length;
    n.textContent=p; n.dataset.zero=p===0?'1':'0'; };
  try{atualizaPin();}catch(e){}
});


/* ===== Cores fixas por categoria (azul/roxo reservados para Ana/Manuela) ===== */
var CORES_FIXAS={
  'Alimentação':'#8E5572','Casa & Utilidades':'#2A9D8F','Transporte':'#E0A64B','Moradia (Apto)':'#9C6644',
  'Manutenção do Apto':'#6C757D','Pets':'#7FB069','Lazer & Viagem':'#B5838D',
  'Descontos em folha':'#6C757D','Dívidas & Crédito':'#8E5572','Boletos 99Pay':'#E0A64B','Compras pessoais':'#2A9D8F',
  'Transferências':'#9C6644','Comer fora':'#E07A5F','Outros':'#A8A29E','Carro':'#588157','Saúde & Bem-estar':'#B5838D',
  'Assinaturas':'#D4B483','Casa da mamãe (Quilombo)':'#7FB069','Investimento/Gustavo':'#264653','Conta telefonica':'#D64F8F',
  'CRMV':'#06D6A0','Uber':'#E9C46A','Terreno':'#588157','Cravo & Canela':'#C77D43','Saúde':'#264653','Despesa conjunta':'#5C4033'
};
(function(){ var _c=colorOf; colorOf=function(c){ return CORES_FIXAS[c]||_c(c); }; })();


/* ===== Aba Dados: ordem da rotina, fechamento funcional com trava ===== */
function nunaSyncClosed(){
  if(typeof mesesFechados!=='function'||!window.DATA)return;
  var base=DATA.closedMonths||[], f=mesesFechados();
  CLOSED=MONTHS.filter(function(m){return base.indexOf(m)>=0||f.indexOf(m)>=0;});
}
function mesTravado(t){ return typeof mesEstaFechado==='function'&&!!t&&mesEstaFechado(t._m||t.mes); }
function avisoTravado(t){ flashToast((t._m||t.mes)+' está fechado. Reabra o mês na aba Dados para editar.'); }
function dadosLayout(){
  var p=el('panel-dados'); if(!p)return;
  var cards=[].slice.call(p.children);
  function acha(txt){ return cards.filter(function(c){var h=c.querySelector('h2,h3');return h&&h.textContent.indexOf(txt)>=0;})[0]; }
  var rc=el('rc-card'), imp=acha('Importar fatura'), fech=acha('Fechamento'), nuvem=acha('Seus dados na nuvem'),
      trava=el('trava-card'), ib=el('ib-card'), rodape=p.querySelector(':scope > footer');
  [rc,imp,fech,nuvem,trava,ib,rodape].forEach(function(c){ if(c)p.appendChild(c); });
  if(ib&&!ib.dataset.recolhido){
    ib.dataset.recolhido='1';
    var det=document.createElement('details');
    det.innerHTML='<summary style="cursor:pointer;font-weight:600">Avan&ccedil;ado &mdash; carga inicial da base <span style="font-weight:400;opacity:.7">(substitui a base inteira)</span></summary>';
    var box=document.createElement('div'); box.style.marginTop='12px';
    while(ib.firstChild)box.appendChild(ib.firstChild);
    det.appendChild(box); ib.appendChild(det);
  }
}
function fechamentoCompacto(){
  var box=el('dd-fech'); if(!box)return;
  var card=box.closest('#panel-dados > *'), nota=card&&card.querySelector('p.note');
  if(nota)nota.innerHTML='Feche o m&ecirc;s depois de importar as faturas e revisar os lan&ccedil;amentos. M&ecirc;s fechado entra nas m&eacute;dias e fica <b>travado para edi&ccedil;&atilde;o</b> &mdash; clique de novo para reabrir.';
  var f=mesesFechados();
  box.innerHTML='<div style="display:flex;flex-wrap:wrap;gap:8px">'+MONTHS.map(function(m){
    var fechado=f.indexOf(m)>=0;
    var pend=allTx().filter(function(t){return t.revisar&&(t._m||t.mes)===m&&(typeof revVisivel!=='function'||revVisivel(t));}).length;
    return '<button type="button" data-m="'+m+'" title="'+(fechado?'Fechado - clique para reabrir':'Aberto - clique para fechar')+'" style="font:inherit;font-size:13px;padding:6px 12px;border-radius:999px;cursor:pointer;'+
      (fechado?'background:#2e9d5b;border:1px solid #2e9d5b;color:#fff':'background:transparent;border:1px solid rgba(127,127,127,.45);color:inherit')+'">'+
      (fechado?'&#128274; ':'')+m+(!fechado&&pend?' <span style="opacity:.7;font-size:11px">&middot; '+pend+' p/ revisar</span>':'')+'</button>';
  }).join('')+'</div>';
  [].forEach.call(box.querySelectorAll('button[data-m]'),function(b){
    b.onclick=function(){
      var m=b.dataset.m, f=mesesFechados(), fechar=f.indexOf(m)<0;
      if(fechar){
        var pend=allTx().filter(function(t){return t.revisar&&(t._m||t.mes)===m&&(typeof revVisivel!=='function'||revVisivel(t));}).length;
        if(pend&&!confirm(m+' ainda tem '+pend+' lançamento(s) para revisar. Fechar mesmo assim?'))return;
        f.push(m);
      } else f=f.filter(function(x){return x!==m;});
      Store.set(K.FECHAMENTOS,f); renderFechamentos(); renderAll(true);
      flashToast(fechar?m+' fechado e travado.':m+' reaberto para edição.');
    };
  });
}
window.addEventListener('load',function(){
  if(typeof renderFechamentos==='function'){ var _rf=renderFechamentos; renderFechamentos=function(){ var r=_rf.apply(this,arguments); try{fechamentoCompacto();}catch(e){console.warn(e);} return r; }; }
  if(typeof renderDados==='function'){ var _rd=renderDados; renderDados=function(){ var r=_rd.apply(this,arguments); try{dadosLayout();}catch(e){console.warn(e);} return r; }; }
  if(typeof renderAll==='function'){ var _ra=renderAll; renderAll=function(){ try{nunaSyncClosed();}catch(e){} return _ra.apply(this,arguments); }; }
  if(typeof applyEdit==='function'){ var _ae=applyEdit; applyEdit=function(tr,target){
    var t=typeof findTx==='function'&&tr&&tr.dataset?findTx(tr.dataset.id):null;
    if(mesTravado(t)){ avisoTravado(t); try{renderAll(true);}catch(e){} return; }
    return _ae.apply(this,arguments); }; }
  if(typeof salvarOverride==='function'){ var _so=salvarOverride; salvarOverride=function(t){
    if(mesTravado(t)){ avisoTravado(t); return; } return _so.apply(this,arguments); }; }
  try{ nunaSyncClosed(); dadosLayout(); renderAll(true); }catch(e){}
});
(function(){
  var s=document.createElement('style');
  s.textContent='input[type=file]{color:inherit;font:inherit;font-size:13px;max-width:100%}'+
    'input[type=file]::file-selector-button{font:inherit;font-size:13px;padding:6px 12px;margin-right:10px;border-radius:999px;border:1px solid rgba(127,127,127,.45);background:transparent;color:inherit;cursor:pointer}';
  document.head.appendChild(s);
})();
function receitasCompacto(){
  var rc=el('rc-card'); if(!rc)return; var tb=rc.querySelector('tbody'); if(!tb)return;
  var rows=[].slice.call(tb.rows), aberto=rc.dataset.hist==='1', b=el('rc-mais');
  rows.forEach(function(r,i){ r.style.display=(!aberto&&i>=3)?'none':''; });
  if(rows.length<=3){ if(b)b.remove(); return; }
  if(!b){
    b=document.createElement('button'); b.id='rc-mais'; b.type='button';
    b.style.cssText='font:inherit;font-size:12px;margin-top:8px;padding:4px 12px;border-radius:999px;border:1px solid rgba(127,127,127,.45);background:transparent;color:inherit;cursor:pointer';
    b.onclick=function(){ rc.dataset.hist=rc.dataset.hist==='1'?'':'1'; receitasCompacto(); };
    tb.closest('table').after(b);
  }
  b.textContent=aberto?'Mostrar menos':'Ver meses anteriores ('+(rows.length-3)+')';
}
window.addEventListener('load',function(){
  if(typeof rcRenderLista==='function'){ var _rl=rcRenderLista; rcRenderLista=function(){ var r=_rl.apply(this,arguments); try{receitasCompacto();}catch(e){} return r; }; }
  try{receitasCompacto();}catch(e){}
});


/* ===== Aba Acabei de Gastar: fluxo simples, um agente so ===== */
var AG_FORA=['Descontos em folha','Despesa conjunta'];
function agLabel(e){ return e&&e.closest('label'); }
function agFillCat(){
  var cat=el('ag-cat'), div=el('ag-div'), grp=el('ag-grupo'), per=el('ag-perfil'); if(!cat||!div||!grp)return;
  var conj=div.value==='CONJUNTA', atual=cat.value;
  var lista=conj?[].map.call(grp.options,function(o){return o.value;})
                :((CATS[per?per.value:state.perfil])||[]).filter(function(c){return AG_FORA.indexOf(c)<0;});
  cat.innerHTML=lista.map(function(c){return '<option value="'+esc(c)+'">'+esc(c)+'</option>';}).join('');
  if(lista.indexOf(atual)>=0)cat.value=atual;
  if(conj)grp.value=cat.value;
  var lb=agLabel(cat), t=lb&&[].filter.call(lb.querySelectorAll('*'),function(e){return !e.children.length&&/categoria/i.test(e.textContent);})[0];
  if(t)t.textContent=conj?'Categoria (conjunta)':'Categoria (individual)';
}
function agFormFluxo(){
  var cat=el('ag-cat'), div=el('ag-div'), grp=el('ag-grupo'), per=el('ag-perfil'); if(!cat||!div||!grp)return;
  if(!div.dataset.fluxo){
    div.dataset.fluxo='1';
    agLabel(cat).parentNode.insertBefore(agLabel(div),agLabel(cat));
    agLabel(grp).style.display='none';
    div.addEventListener('change',agFillCat); if(per)per.addEventListener('change',agFillCat);
    cat.addEventListener('change',function(){ if(div.value==='CONJUNTA')grp.value=cat.value; });
  }
  agFillCat();
}
function agCompacto(){
  var p=el('panel-gastei'); if(!p)return;
  var k=el('ag-kpis');
  if(k)[].forEach.call(k.children,function(c){
    var lab=c.querySelector('.lab'); if(!lab)return; var t=lab.textContent.trim().toUpperCase();
    if(t==='ANA'||t==='MANUELA')c.style.display='none';
    if(t==='CONJUNTO'){ lab.textContent='Conjuntas geradas por mim'; var s=c.querySelector('.sub'); if(s)s.textContent='entram no NuNa como geradas por você'; }
  });
  [].forEach.call(p.children,function(c){
    var h=c.querySelector('h2,h3'); if(!h)return; var t=h.textContent.trim();
    if(/^(Hoje|Dias anteriores|Histórico|Por forma de pagamento)/.test(t)){
      var rows=c.querySelectorAll('tbody tr'), vazio=!rows.length||(rows.length===1&&rows[0].querySelector('td[colspan]'));
      c.style.display=vazio?'none':'';
    }
    if(/^Relatório do Agente/.test(t)){
      [].forEach.call(c.children,function(x){ if(x.id!=='ag-clareza')x.style.display='none'; });
      var box=el('ag-clareza'); if(!box){ box=document.createElement('div'); box.id='ag-clareza'; c.appendChild(box); }
      try{ renderAgente(); }catch(e){}
      var src=el('agente-nuna');
      if(src){ var cl=src.cloneNode(true); cl.removeAttribute('id'); cl.style.margin='0';
        var sb=cl.querySelector('#clareza-share'); if(sb)sb.remove();
        var d=cl.querySelector('#clareza-det'); if(d)d.removeAttribute('id');
        box.innerHTML=''; box.appendChild(cl); }
      c.style.padding='0'; c.style.border='none'; c.style.background='transparent'; c.style.boxShadow='none';
    }
  });
}
(function(){
  var s=document.createElement('style');
  s.textContent='#ag-fontes th:nth-child(2),#ag-fontes th:nth-child(3),#ag-fontes td:nth-child(2):not([colspan]),#ag-fontes td:nth-child(3){display:none}';
  document.head.appendChild(s);
})();
window.addEventListener('load',function(){
  if(typeof agRenderAll==='function'){ var _ag=agRenderAll; agRenderAll=function(){ var r=_ag.apply(this,arguments); try{agFormFluxo();agCompacto();}catch(e){console.warn(e);} return r; }; }
  try{ agFormFluxo(); agCompacto(); }catch(e){}
});
document.addEventListener('click',function(e){
  var t=e.target&&e.target.closest&&e.target.closest('[data-tab="gastei"],.prof');
  if(t)setTimeout(function(){ try{agFormFluxo();agCompacto();}catch(err){} },80);
});


/* ===== Mes vs Mes: sem mistura, meses abertos sinalizados; rodape fixo ===== */
function mesAberto(m){ return CLOSED.indexOf(m)<0; }
function rotulosMeses(){ return MONTHS.map(function(m){ return mesAberto(m)?m+' (aberto)':m; }); }
function eixoK(v){ return 'R$ '+((Math.abs(v)%1000)?(v/1000).toFixed(1):(v/1000).toFixed(0))+'k'; }
function nunaMonthVsMonth(){
  var ctx=el('bars'); if(!ctx||typeof Chart==='undefined')return;
  var p=state.perfil;
  var cor=function(c){ return MONTHS.map(function(m){ return mesAberto(m)?c+'55':c; }); };
  var ds=p==='NuNa'?[
      {label:'Renda do casal',stack:'r',data:MONTHS.map(function(m){return rendaOf(m,'NuNa');}),backgroundColor:cor('#1B4332'),borderRadius:4},
      {label:'Despesas conjuntas',stack:'g',data:MONTHS.map(function(m){return gastoOf(m,'NuNa');}),backgroundColor:cor('#BC4749'),borderRadius:4}
    ]:[
      {label:'Receitas',stack:'r',data:MONTHS.map(function(m){return rendaOf(m,p);}),backgroundColor:cor('#1B4332'),borderRadius:4},
      {label:'Gastos individuais',stack:'g',data:MONTHS.map(function(m){return splitOf(m,p).ind;}),backgroundColor:cor('#BC4749')},
      {label:'Contribuição nas conjuntas',stack:'g',data:MONTHS.map(function(m){return contribTotalOf(m,p);}),backgroundColor:cor('#D98A8B'),borderRadius:4}
    ];
  if(barChart)barChart.destroy();
  barChart=new Chart(ctx,{type:'bar',data:{labels:rotulosMeses(),datasets:ds},
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{position:'bottom',labels:{boxWidth:10,font:{size:11}}},
        tooltip:{callbacks:{label:function(c){return c.dataset.label+': '+brl(c.raw);},
          afterBody:function(it){var m=MONTHS[it[0].dataIndex];
            return (mesAberto(m)?'Mês em aberto — dados incompletos\n':'')+(p==='NuNa'?'':'Saldo: '+brl(saldoOf(m,p)));}}}},
      scales:{x:{stacked:true,grid:{display:false},ticks:{font:{size:11}}},
              y:{stacked:true,ticks:{callback:eixoK,font:{size:10}},grid:{color:'rgba(128,128,128,.15)'}}}}});
}
function nunaSaldos(){
  var ctx=el('saldos'); if(!ctx||typeof Chart==='undefined')return;
  var p=state.perfil;
  var mk=function(q,c){return {label:q,data:MONTHS.map(function(m){return saldoOf(m,q);}),borderColor:c,backgroundColor:c+'22',
    tension:.3,pointRadius:4,fill:false,
    pointBackgroundColor:MONTHS.map(function(m){return mesAberto(m)?'transparent':c;}),
    segment:{borderDash:function(s){return mesAberto(MONTHS[s.p1DataIndex])?[5,5]:undefined;}}};};
  var sets=p==='NuNa'?[mk('Ana','#4A6FA5'),mk('Manuela','#6F4E7C'),mk('NuNa','#1B4332')]:[mk(p,p==='Manuela'?'#6F4E7C':'#4A6FA5')];
  var card=ctx.closest('.card'), h=card&&card.querySelector('h2,h3');
  if(h)h.textContent=p==='NuNa'?'Saldo por mês — Ana, Manuela e NuNa':'Saldo por mês — '+p;
  if(saldoChart)saldoChart.destroy();
  saldoChart=new Chart(ctx,{type:'line',data:{labels:rotulosMeses(),datasets:sets},
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:p==='NuNa',position:'bottom',labels:{boxWidth:10,font:{size:11}}},
        tooltip:{callbacks:{label:function(c){return c.dataset.label+': '+brl(c.raw);},
          afterBody:function(it){return mesAberto(MONTHS[it[0].dataIndex])?'Mês em aberto — dados incompletos':'';}}}},
      scales:{x:{grid:{display:false},ticks:{font:{size:11}}},
              y:{ticks:{callback:eixoK,font:{size:10}},
                 grid:{color:function(c){return c.tick&&c.tick.value===0?'rgba(128,128,128,.6)':'rgba(128,128,128,.15)';}}}}}});
}
function nunaTrendAberto(){
  if(typeof trendChart==='undefined'||!trendChart||!trendChart.data)return;
  trendChart.data.labels=rotulosMeses();
  trendChart.data.datasets.forEach(function(d){ d.segment={borderDash:function(s){return mesAberto(MONTHS[s.p1DataIndex])?[5,5]:undefined;}}; });
  trendChart.update('none');
}
var RODAPE_TXT='“Os planos do diligente levam à fartura, mas o apressado sempre acaba na miséria.”';
var RODAPE_REF='Provérbios 21:5';
function rodapeFixo(){
  [].forEach.call(document.querySelectorAll('footer.insight-footer'),function(f){
    var t=f.querySelector('.insight-text'), m=f.querySelector('.insight-meta');
    if(t&&t.textContent!==RODAPE_TXT)t.textContent=RODAPE_TXT;
    if(m&&m.textContent!==RODAPE_REF)m.textContent=RODAPE_REF;
  });
}
window.addEventListener('load',function(){
  if(typeof renderMonthVsMonth==='function')renderMonthVsMonth=nunaMonthVsMonth;
  if(typeof renderSaldos==='function')renderSaldos=nunaSaldos;
  if(typeof renderCategoryTrend==='function'){ var _ct=renderCategoryTrend; renderCategoryTrend=function(){ var r=_ct.apply(this,arguments); try{nunaTrendAberto();}catch(e){} return r; }; }
  if(typeof renderAll==='function'){ var _ra2=renderAll; renderAll=function(){ var r=_ra2.apply(this,arguments); try{rodapeFixo();}catch(e){} return r; }; }
  try{ rodapeFixo(); renderAll(true); }catch(e){}
  if(window.MutationObserver){ var ob=new MutationObserver(function(){ rodapeFixo(); });
    [].forEach.call(document.querySelectorAll('footer.insight-footer'),function(f){ ob.observe(f,{childList:true,subtree:true,characterData:true}); }); }
});


/* ===== Transacoes: Valor e Status logo apos a descricao ===== */
var TX_ORDEM=[0,1,8,9,6,7,4,5,2,3,10];
function txReordena(){
  var p=el('panel-transactions'), tbl=p&&p.querySelector('table'); if(!tbl)return;
  [].forEach.call(tbl.rows,function(r){
    var cs=[].slice.call(r.cells);
    if(!r.dataset.reord&&cs.length===11){ TX_ORDEM.forEach(function(i){ r.appendChild(cs[i]); }); r.dataset.reord='1'; cs=[].slice.call(r.cells); }
    if(cs.length===11) cs[9].style.display=state.perfil==='NuNa'?'':'none';
  });
}
window.addEventListener('load',function(){
  if(typeof renderTxTable==='function'){ var _tt=renderTxTable; renderTxTable=function(){ var r=_tt.apply(this,arguments); try{txReordena();}catch(e){} return r; }; }
  try{txReordena();}catch(e){}
});


/* ===== Transacoes: mes atual, mais recentes primeiro, 50 por vez, total do filtro ===== */
var TX_PAG=50, txPagina=1, txAssin='';
function txEnxuga(){
  var p=el('panel-transactions'); if(!p)return;
  [].forEach.call(p.querySelectorAll('button'),function(b){ if(/overrides\.json/i.test(b.textContent))b.style.display='none'; });
  var tbl=p.querySelector('table'); if(!tbl)return;
  [].forEach.call(tbl.rows,function(r){ if(r.cells.length===11&&r.dataset.reord)r.cells[6].style.display='none'; });
  var th=tbl.tHead&&tbl.tHead.rows[0]; if(th&&th.cells.length===11&&th.dataset.reord)th.cells[7].textContent='Divisão';
  [].forEach.call(tbl.querySelectorAll('select.c-grupo option[value=""]'),function(o){ o.textContent='Individual'; });
  if(tbl.tBodies[0])[].forEach.call(tbl.tBodies[0].rows,function(r){ var g=r.querySelector('select.c-grupo'), pl=r.querySelector('select.c-plano'); if(g&&pl)pl.style.visibility=g.value?'hidden':''; });
  /* no Conjunto todos os lancamentos sao da casa: a coluna Categoria (plano individual) fica vazia, entao some inteira */
  (function(){ var esc=state.perfil==='NuNa'; [].forEach.call(tbl.rows,function(r){ if(r.cells.length>4&&!r.cells[0].hasAttribute('colspan')) r.cells[4].style.display=esc?'none':''; }); })();
  var lista=txFiltered(), tot=lista.reduce(function(s,t){return s+(+t.valor||0);},0);
  var assin=[state.txMes,el('tx-search').value,el('tx-status').value,el('tx-tipo').value,el('tx-rev').value,el('tx-fonte').value,state.perfil,state.sort.k,state.sort.dir].join('|');
  if(assin!==txAssin){ txAssin=assin; txPagina=1; }
  var wrap=tbl.parentElement;
  var resumo=el('tx-resumo');
  if(!resumo){ resumo=document.createElement('div'); resumo.id='tx-resumo'; resumo.style.cssText='font-size:13px;margin:4px 0 10px;opacity:.9'; wrap.parentNode.insertBefore(resumo,wrap); }
  resumo.innerHTML='<b>'+lista.length+'</b> lan&ccedil;amento'+(lista.length===1?'':'s')+' &middot; <b>'+brl(tot)+'</b>'+(state.txMes==='__all'?' &middot; todos os meses':' &middot; '+state.txMes);
  var rows=tbl.tBodies[0]?[].slice.call(tbl.tBodies[0].rows):[], lim=TX_PAG*txPagina;
  rows.forEach(function(r,i){ r.style.display=i<lim?'':'none'; });
  var mais=el('tx-mais');
  if(!mais){ mais=document.createElement('button'); mais.id='tx-mais'; mais.type='button';
    mais.style.cssText='font:inherit;font-size:13px;margin:12px auto 0;display:block;padding:6px 16px;border-radius:999px;border:1px solid rgba(127,127,127,.45);background:transparent;color:inherit;cursor:pointer';
    mais.onclick=function(){ txPagina++; txEnxuga(); };
    wrap.parentNode.insertBefore(mais,wrap.nextSibling); }
  var rest=rows.length-lim;
  mais.style.display=rest>0?'block':'none';
  mais.textContent='Mostrar mais ('+Math.min(rest,TX_PAG)+' de '+rest+' restantes)';
}
window.addEventListener('load',function(){
  if(state.txMes==='__all')state.txMes=state.mes;
  state.sort={k:'data',dir:-1};
  if(typeof renderTxTable==='function'){ var _tt2=renderTxTable; renderTxTable=function(){ var r=_tt2.apply(this,arguments); try{txEnxuga();}catch(e){console.warn(e);} return r; }; }
  try{ renderAll(true); }catch(e){}
});


/* ===== Orcamento: cabe na renda, status do mes, fixas, meta, total ===== */
var ORC_FIXAS={'Descontos em folha':1,'Moradia (Apto)':1,'Terreno':1,'Casa da mamãe (Quilombo)':1,'Conta telefonica':1,'CRMV':1};
var ORC_METAS={'Investimento/Gustavo':1};
var ORC_FORA={'Despesa conjunta':1,'Cravo & Canela':1};
function orcBadge(txt,cor){ return '<span style="display:inline-block;font-size:11px;padding:2px 8px;border-radius:999px;border:1px solid '+cor+';color:'+cor+';white-space:nowrap">'+txt+'</span>'; }
function orcMedia(arr){ return arr.length?arr.reduce(function(a,b){return a+b;},0)/arr.length:0; }
function orcMelhora(){
  var tbl=el('bd-table'); if(!tbl||!tbl.tBodies[0]||!tbl.tHead)return;
  var p=state.perfil, mes=state.mes, B=(DATA.budgets&&DATA.budgets[p])||{}, frac=agtFrac(mes);
  var C={ok:'#2e9d5b',warn:'#d49a1e',bad:'#d64545',neu:'#8D99AE'};
  var TM={}; MONTHS.forEach(function(m){ TM[m]=agtTotais(m,p); });
  var tot=TM[mes]||{}, cont={ok:0,warn:0,bad:0};
  var ini=2, fim=2+MONTHS.length;
  var hr=tbl.tHead.rows[0];
  [].forEach.call(hr.cells,function(c,i){ if(i>=ini&&i<fim){ var m=MONTHS[i-ini]; c.style.opacity=mesAberto(m)?'.5':''; c.title=mesAberto(m)?'mês em aberto':''; } });
  hr.cells[hr.cells.length-1].textContent='Status ('+mes+')';
  var old=el('bd-total'); if(old)old.remove();
  var somaB=0, somaMes={}, somaMed=0;
  [].forEach.call(tbl.tBodies[0].rows,function(r){
    var cat=r.cells[0].textContent.trim(), b=+B[cat]||0, g=tot[cat]||0;
    r.style.display=(p!=='NuNa'&&ORC_FORA[cat])?'none':'';
    [].forEach.call(r.cells,function(c,i){ if(i>=ini&&i<fim)c.style.opacity=mesAberto(MONTHS[i-ini])?'.5':''; });
    var tem=MONTHS.some(function(m){ return (TM[m][cat]||0)>0; }), st;
    if(ORC_METAS[cat]){ st=g>=b&&b?orcBadge('meta atingida',C.ok):orcBadge('guardado '+brl(g)+' de '+brl(b),C.warn); }
    else if(!tem){ st=orcBadge('sem lançamentos',C.neu); }
    else if(ORC_FIXAS[cat]){ st=orcBadge('fixa',C.neu); }
    else {
      var pct=b?g/b:(g?9:0);
      if(pct>1){ st=orcBadge('estourou',C.bad); cont.bad++; }
      else if(pct>=0.9||(frac!==null&&frac<1&&pct>frac+0.15)){ st=orcBadge('atenção',C.warn); cont.warn++; }
      else { st=orcBadge('no alvo',C.ok); cont.ok++; }
    }
    r.cells[r.cells.length-1].innerHTML=st;
    if(!ORC_METAS[cat]&&!ORC_FORA[cat]){
      somaB+=b; MONTHS.forEach(function(m){ somaMes[m]=(somaMes[m]||0)+(TM[m][cat]||0); });
      somaMed+=orcMedia(CLOSED.map(function(m){return TM[m][cat]||0;}));
    }
  });
  var tr=document.createElement('tr'); tr.id='bd-total'; tr.style.fontWeight='700'; tr.style.borderTop='2px solid rgba(127,127,127,.35)';
  var h='<td>Total</td><td class="num">'+brl(somaB)+'</td>';
  MONTHS.forEach(function(m){ h+='<td class="num" style="opacity:'+(mesAberto(m)?'.5':'1')+'">'+(somaMes[m]?brl(somaMes[m]).replace('R$','').trim():'—')+'</td>'; });
  h+='<td class="num">'+brl(somaMed).replace('R$','').trim()+'</td><td></td>';
  tr.innerHTML=h; tbl.tBodies[0].appendChild(tr);
  var cards=el('bd-cards');
  if(cards){ var v=cards.querySelectorAll('.val'), s=cards.querySelectorAll('.sub');
    if(v[0])v[0].textContent=cont.ok; if(v[1])v[1].textContent=cont.warn; if(v[2])v[2].textContent=cont.bad;
    if(s[0])s[0].textContent='dentro do orçamento em '+mes; if(s[1])s[1].textContent='perto do limite em '+mes; if(s[2])s[2].textContent='acima do orçamento em '+mes; }
  orcCabe(TM,B,somaB);
}
function orcCabe(TM,B,somaB){
  var cards=el('bd-cards'); if(!cards)return;
  var box=el('orc-renda');
  if(!box){ box=document.createElement('div'); box.id='orc-renda'; box.style.cssText='border:1px solid rgba(127,127,127,.28);border-radius:12px;padding:12px 14px;margin:0 0 14px'; cards.parentNode.insertBefore(box,cards); }
  var p=state.perfil, F=CLOSED;
  var renda=orcMedia(F.map(function(m){return rendaOf(m,p);}));
  var linha=function(l,v,neg){ return '<div style="display:flex;justify-content:space-between;gap:8px;font-size:13px;margin:3px 0"><span>'+l+'</span><span>'+(neg?'− ':'')+brl(v)+'</span></div>'; };
  var cor=function(v){ return v>=0?'#2e9d5b':'#d64545'; };
  var h='<div style="font-weight:700;letter-spacing:.04em;font-size:13px;margin-bottom:6px">CABE NA RENDA? <span style="font-weight:400;opacity:.65;letter-spacing:0">média de '+F[0]+' a '+F[F.length-1]+'</span></div>';
  if(p==='NuNa'){
    var gasto=orcMedia(F.map(function(m){return gastoOf(m,'NuNa');}));
    h+=linha('Renda do casal',renda)+linha('Custo conjunto real',gasto,true)+linha('Custo conjunto orçado',somaB,true);
    h+='<div style="font-size:13px;margin-top:6px">O custo conjunto consome <b>'+(renda?Math.round(gasto/renda*100):0)+'%</b> da renda do casal.</div>';
  } else {
    var desc=orcMedia(F.map(function(m){return TM[m]['Descontos em folha']||0;}));
    var contr=orcMedia(F.map(function(m){return contribTotalOf(m,p);}));
    var sobra=renda-desc-contr, orcInd=somaB-(+B['Descontos em folha']||0), dif=sobra-orcInd;
    h+=linha('Receita',renda)+linha('Descontos em folha',desc,true)+linha('Contribuição nas conjuntas',contr,true);
    h+='<div style="display:flex;justify-content:space-between;gap:8px;font-size:14px;margin:6px 0 2px;padding-top:6px;border-top:1px solid rgba(127,127,127,.25)"><b>Sobra para gastos individuais</b><b style="color:'+cor(sobra)+'">'+brl(sobra)+'</b></div>';
    h+='<div style="display:flex;justify-content:space-between;gap:8px;font-size:13px;margin:3px 0"><span>Orçado para gastos individuais</span><span>'+brl(orcInd)+'</span></div>';
    h+='<div style="font-size:13px;margin-top:6px;color:'+cor(dif)+'">'+(dif>=0?'O orçamento cabe, com folga de <b>'+brl(dif)+'</b>.':'O orçamento passa em <b>'+brl(-dif)+'</b> do que sobra da renda.')+'</div>';
  }
  box.innerHTML=h;
}
window.addEventListener('load',function(){
  if(typeof renderBudgetTable==='function'){ var _bt=renderBudgetTable; renderBudgetTable=function(){ var r=_bt.apply(this,arguments); try{orcMelhora();}catch(e){console.warn(e);} return r; }; }
});
