/* NuNa - gastei-ui.js: interface do ACABEI DE GASTAR */
/* ============ ACABEI DE GASTAR — interface ============ */
function agCats(perfil){ return (perfil==='Manuela'?CATS.Manuela:CATS.Ana); }
function agFillSelect(sel, arr, val){
  sel.innerHTML=arr.map(function(o){return '<option value="'+esc(o)+'"'+(o===val?' selected':'')+'>'+o+'</option>'}).join('');
}
function agWire(){
  el('ag-data').value=agHojeISO();
  /* o formulario comeca no perfil de quem esta usando o dashboard */
  var perfilInicial = (state.perfil==='NuNa') ? ((Auth.sessao()||{}).perfil || 'Ana') : state.perfil;
  el('ag-perfil').value = perfilInicial;
  agFillSelect(el('ag-fonte'), AG_FONTES, AG_FONTES[0]);
  agFillSelect(el('ag-grupo'), GRUPOS, GRUPOS[0]);
  agFillSelect(el('ag-cat'), agCats(perfilInicial));
  el('ag-perfil').addEventListener('change',function(){
    agFillSelect(el('ag-cat'), agCats(el('ag-perfil').value)); agAutoSugerir();
  });
  el('ag-div').addEventListener('change',function(){
    el('ag-grupo').disabled = el('ag-div').value!=='CONJUNTA';
  });
  el('ag-desc').addEventListener('input', agAutoSugerir);
  el('ag-save').addEventListener('click', agSalvar);
  el('ag-clear').addEventListener('click', agLimpar);
  el('ag-open').addEventListener('click',function(){
    var b=el('tabs').querySelector('[data-tab="gastei"]'); if(b) b.click();
    setTimeout(function(){ el('ag-desc').focus() },60);
  });
  el('ag-hoje').addEventListener('change', agEditarLinha);
  el('ag-hoje').addEventListener('click',function(e){
    var b=e.target.closest('.link'); if(!b) return;
    var tr=e.target.closest('tr'); if(!tr) return;
    if(b.dataset.act==='del') agRemoverItem(tr.dataset.id);
  });
}
function agAutoSugerir(){
  var d=el('ag-desc').value, p=el('ag-perfil').value;
  var s=agSugerir(d,p);
  if(!s){
    if(d.length>2){ agFillSelect(el('ag-cat'), agCats(p), 'Outros');
      el('ag-sugestao').innerHTML='Sem correspond&ecirc;ncia clara no hist&oacute;rico &mdash; vai entrar como <b>Outros</b>, com status <b>Revisar</b>. Escolha a categoria certa se souber.'; }
    else el('ag-sugestao').innerHTML='';
    return; }
  agFillSelect(el('ag-cat'), agCats(p), s.plano);
  if(AG_FONTES.indexOf(s.fonte)>=0) el('ag-fonte').value=s.fonte;
  el('ag-div').value = s.grupo ? 'CONJUNTA' : 'INDIVIDUAL';
  el('ag-grupo').disabled = !s.grupo;
  if(s.grupo) el('ag-grupo').value=s.grupo;
  el('ag-sugestao').innerHTML='Sugest&atilde;o do N&uacute;cleo de Intelig&ecirc;ncia a partir de <b>'+esc(s.base)+'</b> ('+Math.round(s.score*100)+'% de semelhan&ccedil;a): '+
    esc(s.plano)+(s.grupo?' &middot; conjunta em '+esc(s.grupo):' &middot; individual')+'. Corrija se n&atilde;o for isso.';
}
function agLimpar(){
  el('ag-desc').value=''; el('ag-valor').value=''; el('ag-data').value=agHojeISO();
  el('ag-sugestao').innerHTML=''; el('ag-div').value='INDIVIDUAL'; el('ag-grupo').disabled=true;
}
function agSalvar(){
  var desc=el('ag-desc').value.trim();
  var valor=parseFloat(String(el('ag-valor').value).replace(/\./g,'').replace(',','.'));
  if(!desc){ flashToast('Escreva o que foi o gasto.'); el('ag-desc').focus(); return; }
  if(!(valor>0)){ flashToast('Informe um valor maior que zero.'); el('ag-valor').focus(); return; }
  var div=el('ag-div').value;
  var item={ id:'g'+Date.now().toString(36)+Math.random().toString(36).slice(2,7),
    data:el('ag-data').value||agHojeISO(), desc:desc, valor:Math.round(valor*100)/100,
    fonte:el('ag-fonte').value, perfil:el('ag-perfil').value, categoria:el('ag-cat').value,
    divisao:div, grupo: div==='CONJUNTA'? el('ag-grupo').value : null,
    criadoEm:new Date().toISOString(), origem:'ACABEI DE GASTAR' };
  var s=agSugerir(desc,item.perfil);
  var c=agConciliar(item);
  if(c.status==='Conciliado'){ item.status='Conciliado'; item.conciliadoCom=c.match.raw; item.conciliadoEm=new Date().toISOString(); }
  else if(c.status==='Revisar'){ item.status='Revisar'; item.possivelMatch=c.match.raw; }
  else item.status = s && s.score>=0.55 ? 'Confirmado' : (s?'Pendente':'Revisar');
  item.confianca = Math.round((s?s.score:0)*100);
  AG.itens = AG.itens.concat([item]);
  agSalvarItem(item).then(function(){
    agLimpar(); agRenderAll(); renderAll(true);
    flashToast(item.status==='Conciliado'
      ? 'Salvo e ja conciliado com a fatura - nao vai contar duas vezes.'
      : 'Gasto salvo como '+item.status+'.');
  });
}
function agEditarLinha(e){
  var tr=e.target.closest('tr'); if(!tr) return;
  var item=AG.itens.filter(function(x){return x.id===tr.dataset.id})[0]; if(!item) return;
  var cl=e.target.className;
  if(cl.indexOf('ag-c-cat')>=0) item.categoria=e.target.value;
  if(cl.indexOf('ag-c-fonte')>=0) item.fonte=e.target.value;
  if(cl.indexOf('ag-c-div')>=0){ item.divisao=e.target.value; item.grupo = item.divisao==='CONJUNTA' ? (item.grupo||GRUPO_PADRAO) : null; }
  if(cl.indexOf('ag-c-st')>=0) item.status=e.target.value;
  agSalvarItem(item).then(function(){ agRenderAll(); renderAll(true); });
}

function agStatusBadge(s){
  var m={'Pendente':'st-pend','Confirmado':'st-conf','Conciliado':'st-conc','Revisar':'st-rev'};
  return '<span class="st '+(m[s]||'st-pend')+'">'+s+'</span>';
}
function agRenderCTA(){
  var ind=state.perfil!=='NuNa';
  if(ind && el('ag-perfil') && el('ag-perfil').value!==state.perfil && !el('ag-desc').value){
    el('ag-perfil').value=state.perfil; agFillSelect(el('ag-cat'), agCats(state.perfil));
  }
  el('ag-cta').hidden=!ind; el('tab-gastei').hidden=!ind;
  if(!ind && el('panel-gastei').classList.contains('active')){
    el('tabs').querySelector('[data-tab="overview"]').click();
  }
  var pend=AG.itens.filter(function(i){return i.status==='Pendente'||i.status==='Revisar'}).length;
  el('ag-pin').textContent=pend; el('ag-pin').dataset.zero = pend===0?'1':'0';
}
function agRenderKPIs(){
  var hoje=agHojeISO(), mes=agMesDe(hoje);
  var doMes=AG.itens.filter(function(i){return agMesDe(i.data)===mes});
  var cont=doMes.filter(function(i){return i.status!=='Conciliado'});
  var soma=function(a){return a.reduce(function(s,i){return s+i.valor},0)};
  var deHoje=doMes.filter(function(i){return i.data===hoje});
  el('ag-kpis').innerHTML=
    kpiCard('Gasto hoje', brl(soma(deHoje)), deHoje.length+' lan&ccedil;amento'+(deHoje.length===1?'':'s'),'red')+
    kpiCard('Gasto no m&ecirc;s', brl(soma(cont)), doMes.length+' lan&ccedil;amentos registrados','red')+
    kpiCard('Individual', brl(soma(cont.filter(function(i){return i.divisao==='INDIVIDUAL'}))), 'so de quem lan&ccedil;ou','')+
    kpiCard('Conjunto', brl(soma(cont.filter(function(i){return i.divisao==='CONJUNTA'}))), 'entra no perfil NuNa','orange')+
    kpiCard('Ana', brl(soma(cont.filter(function(i){return i.perfil==='Ana'}))), 'no m&ecirc;s','')+
    kpiCard('Manuela', brl(soma(cont.filter(function(i){return i.perfil==='Manuela'}))), 'no m&ecirc;s','');
  el('ag-status-db').innerHTML = AG.modo==='local'
    ? '&#10003; Salvo neste navegador. Os lan&ccedil;amentos ficam gravados mesmo se voc&ecirc; fechar a aba ou o navegador. Use <b>Backup</b> no rodap&eacute; para levar os dados para outro aparelho.'
    : '<b>Aten&ccedil;&atilde;o:</b> o armazenamento do navegador est&aacute; bloqueado. Os lan&ccedil;amentos valem s&oacute; enquanto esta aba estiver aberta.';
}
function agRenderHoje(){
  var hoje=agHojeISO();
  var l=AG.itens.filter(function(i){return i.data===hoje}).sort(function(a,b){return (b.criadoEm||'').localeCompare(a.criadoEm||'')});
  var tb=el('ag-hoje').querySelector('tbody');
  tb.innerHTML=l.map(function(i){
    return '<tr data-id="'+i.id+'">'+
      '<td>'+esc(i.desc)+(i.conciliadoCom?'<br><span style="font-size:11px;color:var(--tx3)">conciliado com: '+esc(i.conciliadoCom)+'</span>':'')+
        (i.possivelMatch?'<br><span style="font-size:11px;color:var(--neg)">parecido com: '+esc(i.possivelMatch)+'</span>':'')+'</td>'+
      '<td><select class="ag-c-fonte">'+AG_FONTES.map(function(f){return '<option'+(f===i.fonte?' selected':'')+'>'+f+'</option>'}).join('')+'</select></td>'+
      '<td><span class="badge b-ind">'+i.perfil+'</span></td>'+
      '<td><select class="ag-c-cat">'+agCats(i.perfil).map(function(c){return '<option'+(c===i.categoria?' selected':'')+'>'+c+'</option>'}).join('')+'</select></td>'+
      '<td><select class="ag-c-div"><option'+(i.divisao==='INDIVIDUAL'?' selected':'')+'>INDIVIDUAL</option><option'+(i.divisao==='CONJUNTA'?' selected':'')+'>CONJUNTA</option></select>'+
        (i.grupo?'<br><span style="font-size:11px;color:var(--tx3)">'+esc(i.grupo)+'</span>':'')+'</td>'+
      '<td class="num">'+brl(i.valor)+'</td>'+
      '<td><select class="ag-c-st">'+AG_STATUS.map(function(s){return '<option'+(s===i.status?' selected':'')+'>'+s+'</option>'}).join('')+'</select></td>'+
      '<td><button class="link" data-act="del">apagar</button></td></tr>';
  }).join('');
  el('ag-hoje-vazio').innerHTML = l.length ? '' : 'Nenhum gasto lan&ccedil;ado hoje ainda. Use o formul&aacute;rio acima &mdash; leva uns dez segundos.';
}
function agRenderDias(){
  var hoje=agHojeISO(), mes=agMesDe(hoje);
  var por={};
  AG.itens.forEach(function(i){
    if(agMesDe(i.data)!==mes || i.data===hoje) return;
    var d=por[i.data]=por[i.data]||{n:0,t:0,ind:0,cj:0,conc:0};
    d.n++;
    if(i.status==='Conciliado') d.conc+=i.valor;
    else { d.t+=i.valor; if(i.divisao==='CONJUNTA') d.cj+=i.valor; else d.ind+=i.valor; }
  });
  var dias=Object.keys(por).sort().reverse();
  el('ag-dias').querySelector('tbody').innerHTML = dias.length
    ? dias.map(function(d){var x=por[d];
        return '<tr><td>'+agBR(d)+'</td><td class="num">'+x.n+'</td><td class="num"><b>'+brl(x.t)+'</b></td><td class="num">'+brl(x.ind)+'</td><td class="num">'+brl(x.cj)+'</td>'+
          '<td class="num" style="color:var(--tx3)" title="Ja encontrado na fatura importada - nao soma de novo">'+(x.conc?brl(x.conc):'&mdash;')+'</td></tr>';}).join('')
    : '<tr><td colspan="6" style="color:var(--tx3)">Nenhum gasto registrado em dias anteriores deste m&ecirc;s.</td></tr>';
}
function agRenderFontes(){
  var por={};
  agContabilizaveis().forEach(function(i){
    var f=por[i.fonte]=por[i.fonte]||{ana:0,man:0,ind:0,cj:0,tot:0};
    f[i.perfil==='Ana'?'ana':'man']+=i.valor;
    f[i.divisao==='CONJUNTA'?'cj':'ind']+=i.valor; f.tot+=i.valor;
  });
  var ks=Object.keys(por).sort(function(a,b){return por[b].tot-por[a].tot});
  el('ag-fontes').querySelector('tbody').innerHTML = ks.length
    ? ks.map(function(k){var v=por[k];
        return '<tr><td>'+esc(k)+'</td><td class="num">'+brl(v.ana)+'</td><td class="num">'+brl(v.man)+'</td><td class="num">'+brl(v.ind)+'</td><td class="num">'+brl(v.cj)+'</td><td class="num"><b>'+brl(v.tot)+'</b></td></tr>';}).join('')
    : '<tr><td colspan="6" style="color:var(--tx3)">Sem lan&ccedil;amentos ainda.</td></tr>';
}
