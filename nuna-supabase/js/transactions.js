/* NuNa - transactions.js: tabela de Transacoes, aba Revisar e exportacao */
/* ---------- TRANSACOES ---------- */
function planoOpts(perfil,sel){
  var list = perfil==='Manuela'?CATS.Manuela:CATS.Ana;
  if(list.indexOf(sel)<0) list=list.concat([sel]);
  return list.map(function(c){return '<option value="'+esc(c)+'"'+(c===sel?' selected':'')+'>'+c+'</option>'}).join('');
}
function grupoOpts(sel){
  return '<option value="">&mdash; individual</option>'+GRUPOS.map(function(g){return '<option value="'+esc(g)+'"'+(g===sel?' selected':'')+'>'+g+'</option>'}).join('');
}
function tipoOpts(sel){
  var l=TIPOS.indexOf(sel)<0?TIPOS.concat([sel]):TIPOS;
  return l.map(function(c){return '<option value="'+esc(c)+'"'+(c===sel?' selected':'')+'>'+c+'</option>'}).join('');
}
function txFiltered(){
  var q=(el('tx-search').value||'').toLowerCase(), st=el('tx-status').value, tp=el('tx-tipo').value, rv=el('tx-rev').value, fo=el('tx-fonte').value;
  var ms=state.txMes==='__all'?MONTHS:[state.txMes], out=[];
  ms.forEach(function(m){mesTx(m).forEach(function(t){
    if(!inView(t,state.perfil))return;
    if(q&&(t.desc+' '+t.raw).toLowerCase().indexOf(q)<0)return;
    if(st==='__none'){if(t.status)return;}else if(st&&t.status!==st)return;
    if(tp==='cj'&&!t.grupo)return; if(tp==='ind'&&t.grupo)return;
    if(rv==='sim'&&!t.revisar)return; if(rv==='nao'&&t.revisar)return; if(rv==='dup'&&!t.possivelDup)return;
    if(fo&&t.fonteLabel!==fo)return;
    t._m=m; out.push(t);});});
  var k=state.sort.k,d=state.sort.dir;
  out.sort(function(a,b){
    if(k==='data'){var kk=function(t){var p=t.data.split('/');return (2000+ +p[2])*10000+(+p[1])*100+(+p[0])};return (kk(a)-kk(b))*d;}
    if(k==='valor')return (a.valor-b.valor)*d;
    return String(a[k]||'').localeCompare(String(b[k]||''),'pt-BR')*d;});
  return out;
}
function renderTxTable(){
  var list=txFiltered(), tb=el('tx-table').querySelector('tbody');
  tb.innerHTML=list.map(function(t){
    return '<tr data-id="'+t._m+'|'+t.id+'">'+
      '<td style="white-space:nowrap">'+t.data+'</td>'+
      '<td title="'+esc(t.raw)+'">'+esc(t.desc)+(t.possivelDup?' <span class="badge b-warn" title="Mesma fonte, data, descricao e valor aparecem mais de uma vez neste mes. Confira se sao compras distintas.">poss. dup.</span>':'')+
        (t.manual?' <span class="badge b-cj" title="Lancado no ACABEI DE GASTAR - edite por la">ao vivo</span>':'')+'</td>'+
      '<td><span class="badge '+(t.fontePendente?'b-warn':'b-ind')+'">'+esc(t.fonteLabel)+'</span></td>'+
      '<td><span class="badge b-ind">'+t.perfil+'</span></td>'+
      '<td><select class="c-dv"'+(t.manual?' disabled':'')+'><option value="INDIVIDUAL"'+(t.divisao==='INDIVIDUAL'?' selected':'')+'>INDIVIDUAL</option><option value="CONJUNTA"'+(t.divisao==='CONJUNTA'?' selected':'')+'>CONJUNTA</option></select></td>'+
      '<td><select class="c-grupo"'+(t.divisao==='CONJUNTA'&&!t.manual?'':' disabled')+'>'+grupoOpts(t.grupo)+'</select></td>'+
      '<td><select class="c-plano"'+(t.manual?' disabled':'')+'>'+planoOpts(t.perfil,t.plano)+'</select></td>'+
      '<td><select class="c-tipo"'+(t.manual?' disabled':'')+'>'+tipoOpts(t.tipo)+'</select></td>'+
      '<td class="num">'+brl(t.valor)+'</td>'+
      '<td>'+(t.manual? agStatusBadge(t.agStatus) : '<select class="c-st"><option value="">&mdash;</option>'+
        ['pode cancelar','cancelado'].map(function(o){return '<option value="'+o+'"'+(t.status===o?' selected':'')+'>'+o+'</option>'}).join('')+'</select>')+'</td>'+
      '<td>'+(t.revisar?'<span class="badge b-warn">revisar</span>':'<span class="rev-ok">&#10003;</span>')+'</td></tr>';}).join('');
  el('tx-count').innerHTML='<b>'+list.length+'</b> lan&ccedil;amentos &middot; total '+brl(list.reduce(function(s,t){return s+t.valor},0))+
    ' &middot; passe o mouse na descri&ccedil;&atilde;o para ver o texto original do banco.';
}
function findTx(key){var p=key.split('|');return DATA.months[p[0]].transactions.filter(function(t){return t.id===p[1]})[0];}
function ehManual(key){var p=key.split('|');return !findTx(key) && AG.itens.some(function(i){return i.id===p[1]});}
function applyEdit(tr,target){
  var t=findTx(tr.dataset.id); if(!t)return;
  if(target.classList.contains('c-plano'))t.plano=target.value;
  if(target.classList.contains('c-tipo'))t.tipo=target.value;
  if(target.classList.contains('c-grupo')){t.grupo=target.value||null; t.divisao=t.grupo?'CONJUNTA':'INDIVIDUAL';}
  if(target.classList.contains('c-st'))t.status=target.value;
  if(target.classList.contains('c-dv')){
    t.divisao=target.value;
    if(t.divisao==='CONJUNTA'){ if(!t.grupo) t.grupo=GRUPO_PADRAO; }
    else t.grupo=null;
  }
  salvarOverride(t);
}
function wireTxControls(){
  var fs=el('tx-fonte'); FONTES.forEach(function(f){var o=document.createElement('option');o.value=f;o.textContent=f;fs.appendChild(o)});
  ['tx-search','tx-status','tx-tipo','tx-rev','tx-fonte'].forEach(function(id){
    el(id).addEventListener('input',function(){renderTxTable()});
    el(id).addEventListener('change',function(){renderTxTable()});});
  el('tx-table').addEventListener('change',function(e){
    var tr=e.target.closest('tr'); if(!tr)return;
    if(ehManual(tr.dataset.id)){ flashToast('Este lancamento veio do ACABEI DE GASTAR - edite por la.'); renderTxTable(); return; }
    applyEdit(tr,e.target);
    var estrutural=e.target.classList.contains('c-dv')||e.target.classList.contains('c-grupo');
    renderAll(true); if(estrutural) renderTxTable();});
  el('tx-table').querySelector('thead').addEventListener('click',function(e){
    var th=e.target.closest('th'); if(!th||!th.dataset.s)return;
    if(state.sort.k===th.dataset.s)state.sort.dir*=-1;else{state.sort.k=th.dataset.s;state.sort.dir=1;}
    renderTxTable();});
}
function renderTxInsight(){
  var l=state.txMes==='__all'?allTx().filter(function(t){return inView(t,state.perfil)}):txOf(state.txMes,state.perfil);
  var ass=l.filter(function(t){return t.tipo==='Assinaturas'||t.tipo==='Streaming'||t.tipo==='Gympass'});
  el('ins-tx').textContent='"'+ass.length+' assinaturas detectadas no recorte atual, somando '+brl(ass.reduce(function(s,t){return s+t.valor},0))+'. Marque o que nao usa para ver a economia."';
}

/* ---------- REVISAR ---------- */
function revList(){
  var q=(el('rev-search').value||'').toLowerCase(), pf=el('rev-perfil').value, out=[];
  MONTHS.forEach(function(m){DATA.months[m].transactions.forEach(function(t){
    if(!t.revisar)return;
    if(pf&&t.perfil!==pf)return;
    if(q&&(t.desc+' '+t.raw).toLowerCase().indexOf(q)<0)return;
    t._m=m; out.push(t);});});
  out.sort(function(a,b){return b.valor-a.valor});
  return out;
}
function renderReview(){
  var list=revList(), tb=el('rev-table').querySelector('tbody');
  var total=allTx().length, pend=allTx().filter(function(t){return t.revisar}).length;
  el('rev-pin').textContent=pend; el('rev-pin').dataset.zero = pend===0?'1':'0';
  el('rev-head').innerHTML='Cerca de <b>'+Math.round(pend/total*100)+'%</b> dos lan&ccedil;amentos ('+pend+' de '+total+') foram categorizados automaticamente e ainda esperam sua confer&ecirc;ncia. Corrija a categoria se estiver errada e marque <b>Conferido</b> &mdash; a marca&ccedil;&atilde;o vai junto no <code>overrides.json</code> e os pr&oacute;ximos meses j&aacute; aprendem com ela.';
  tb.innerHTML=list.slice(0,400).map(function(t){
    return '<tr data-id="'+t._m+'|'+t.id+'">'+
      '<td style="white-space:nowrap">'+t.data+'</td>'+
      '<td title="'+esc(t.raw)+'">'+esc(t.desc)+(t.possivelDup?' <span class="badge b-warn">poss. dup.</span>':'')+'</td>'+
      '<td><span class="badge '+(t.fontePendente?'b-warn':'b-ind')+'">'+esc(t.fonteLabel)+'</span></td>'+
      '<td><span class="badge b-ind">'+t.perfil+'</span></td>'+
      '<td><select class="c-dv"><option value="INDIVIDUAL"'+(t.divisao==='INDIVIDUAL'?' selected':'')+'>INDIVIDUAL</option><option value="CONJUNTA"'+(t.divisao==='CONJUNTA'?' selected':'')+'>CONJUNTA</option></select></td>'+
      '<td><select class="c-grupo"'+(t.divisao==='CONJUNTA'?'':' disabled')+'>'+grupoOpts(t.grupo)+'</select></td>'+
      '<td><select class="c-plano">'+planoOpts(t.perfil,t.plano)+'</select></td>'+
      '<td><select class="c-tipo">'+tipoOpts(t.tipo)+'</select></td>'+
      '<td class="num">'+brl(t.valor)+'</td>'+
      '<td style="text-align:center"><input type="checkbox" class="c-rev" style="width:17px;height:17px;accent-color:var(--pos)"></td></tr>';}).join('');
  el('rev-count').innerHTML='<b>'+list.length+'</b> lan&ccedil;amentos aguardando confer&ecirc;ncia'+(list.length>400?' (mostrando os 400 maiores)':'')+
    ' &middot; total '+brl(list.reduce(function(s,t){return s+t.valor},0));
  el('ins-rev').textContent = pend===0
    ? '"Tudo conferido. Cada correcao sua vira regra para os proximos meses."'
    : '"'+pend+' lancamentos ainda no automatico. Os 10 maiores somam '+brl(list.slice(0,10).reduce(function(s,t){return s+t.valor},0))+' - comece por eles."';
}
function wireReview(){
  ['rev-search','rev-perfil'].forEach(function(id){
    el(id).addEventListener('input',function(){renderReview()});
    el(id).addEventListener('change',function(){renderReview()});});
  el('rev-table').addEventListener('change',function(e){
    var tr=e.target.closest('tr'); if(!tr)return; var t=findTx(tr.dataset.id); if(!t)return;
    applyEdit(tr,e.target);
    if(e.target.classList.contains('c-rev')&&e.target.checked){t.revisar=false;salvarOverride(t);renderReview();renderAll(true);return;}
    renderAll(true); renderReview();});
  el('rev-all').addEventListener('click',function(){
    var l=revList(); l.forEach(function(t){t.revisar=false; salvarOverride(t)});
    flashToast(l.length+' lancamentos marcados como conferidos.'); renderReview(); renderAll(true);});
}

/* ---------- EXPORT ---------- */
function wireRefreshButton(){
  el('refresh-btn').addEventListener('click',function(){
    var statusMarks=[],categoryOverrides=[],divisoes=[],revisados=[];
    MONTHS.forEach(function(m){DATA.months[m].transactions.forEach(function(t){
      var base={uid:t.uid,dedupKey:t.dedupKey,year:2026,month:m,fonte:t.fonteLabel,description:t.raw,amount:Number(t.valor.toFixed(2))};
      if(t.status)statusMarks.push(Object.assign({},base,{status:t.status}));
      if(t.plano!==t.planoOrig)categoryOverrides.push(Object.assign({},base,{perfil:t.perfil,categoria:t.plano,tipo:t.tipo}));
      if(t.grupo!==t.grupoOrig)divisoes.push(Object.assign({},base,{divisao:t.divisao,grupo:t.grupo,pagoPor:t.perfil}));
      if(!t.revisar)revisados.push({uid:t.uid,dedupKey:t.dedupKey});});});
    var payload={version:3,lastUpdated:new Date().toISOString(),perfis:['NuNa','Ana','Manuela'],
      chaveDeduplicacao:'mes|fonte|cartao|data|descricao|valor (+ ordinal para repeticoes legitimas no mesmo dia)',
      statusMarks:statusMarks,categoryOverrides:categoryOverrides,divisoes:divisoes,revisados:revisados};
    renderAll(); saveOverrides(JSON.stringify(payload,null,2));});
}
function saveOverrides(texto){ baixarArquivo('overrides.json', texto); }
function flashToast(msg){var d=document.createElement('div');d.className='toast';d.textContent=msg;document.body.appendChild(d);setTimeout(function(){d.remove()},3500);}
