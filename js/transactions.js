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
/* mes da aba Transacoes: se vier vazio ou invalido (ex.: base ainda carregando), usa o mes selecionado ou todos */
/* Transacoes soma so um mes por vez (o mes atual por padrao); "todos os meses" fica so na aba Revisar */
function txMesOk(){ var m=state.txMes; if(m&&m!=='__all'&&DATA&&DATA.months&&DATA.months[m])return; state.txMes=(state.mes&&DATA&&DATA.months&&DATA.months[state.mes])?state.mes:MONTHS[MONTHS.length-1]; try{renderTxMonthPills();}catch(e){} }
function revMesOk(){ var m=state.revMes; if(m==='__all'||(m&&DATA&&DATA.months&&DATA.months[m]))return; state.revMes='__all'; }
function txFiltered(){ txMesOk();
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
      '<td'+(t.obs?'':' title="'+esc(t.raw)+'"')+'>'+(t.obs?'<span class="tem-obs" data-obs="'+esc(t.obs)+'" title="'+esc(t.obs)+'">'+esc(t.desc)+'</span>':esc(t.desc))+(t.previsto?' <span class="badge b-ind" title="Parcela futura projetada a partir da ultima fatura. Sai sozinha quando a fatura deste mes for importada.">prevista</span>':'')+(t.possivelDup?' <span class="badge b-warn" title="Mesma fonte, data, descricao e valor aparecem mais de uma vez neste mes. Confira se sao compras distintas.">poss. dup.</span>':'')+
        (t.manual?' <span class="badge b-cj" title="Lancado no ACABEI DE GASTAR - edite por la">ao vivo</span>':'')+(typeof ehLoja==='function'&&ehLoja(t)?' <span class="badge b-cj" title="Cravo & Canela: fica fora dos gastos individuais, dos conjuntos e do saldo">&agrave; parte &middot; loja</span>':'')+'</td>'+
      '<td><span class="badge '+(t.fontePendente?'b-warn':'b-ind')+'">'+esc(t.fonteLabel)+'</span></td>'+
      '<td><span class="badge b-ind">'+t.perfil+'</span></td>'+
      '<td><select class="c-dv"'+(t.manual?' disabled':'')+'><option value="INDIVIDUAL"'+(t.divisao==='INDIVIDUAL'?' selected':'')+'>INDIVIDUAL</option><option value="CONJUNTA"'+(t.divisao==='CONJUNTA'?' selected':'')+'>CONJUNTA</option></select></td>'+
      '<td><select class="c-grupo" data-perfil="NuNa" data-vazio="1"'+(t.divisao==='CONJUNTA'&&!t.manual?'':' disabled')+'>'+catOptsHTML('NuNa',t.grupo,t.grupo?t.sub:'',{novo:!t.manual,vazio:true})+'</select></td>'+
      '<td><select class="c-plano" data-perfil="'+t.perfil+'"'+(t.manual?' disabled':'')+'>'+catOptsHTML(t.perfil,t.plano,t.grupo?'':t.sub,{novo:!t.manual})+'</select></td>'+
      '<td><select class="c-tipo"'+(t.manual?' disabled':'')+'>'+tipoOpts(t.tipo)+'</select></td>'+
      '<td class="num">'+brl(t.valor)+'</td>'+
      '<td>'+(t.manual? agStatusBadge(t.agStatus) : '<select class="c-st"><option value="">&mdash;</option>'+
        ['pode cancelar','cancelado'].map(function(o){return '<option value="'+o+'"'+(t.status===o?' selected':'')+'>'+o+'</option>'}).join('')+'</select>')+'</td>'+
      '<td>'+(t.revisar?'<span class="badge b-warn">revisar</span>':(t.manual?'<span class="rev-ok">&#10003;</span>':'<button type="button" class="rev-back" title="Conferido. Clique para mandar de volta para Revisar" aria-label="Mandar de volta para Revisar"></button>'))+'</td></tr>';}).join('');
  el('tx-count').innerHTML='<b>'+list.length+'</b> lan&ccedil;amentos &middot; total '+brl(list.reduce(function(s,t){return s+t.valor},0))+
    ' &middot; passe o mouse na descri&ccedil;&atilde;o para ver o texto original do banco.';
}
function findTx(key){var p=key.split('|');return DATA.months[p[0]].transactions.filter(function(t){return t.id===p[1]})[0];}
function ehManual(key){var p=key.split('|');return !findTx(key) && AG.itens.some(function(i){return i.id===p[1]});}
function applyEdit(tr,target){
  var t=findTx(tr.dataset.id); if(!t)return;
  if(target.classList.contains('c-plano')){var cp=catParse(target.value); t.plano=cp.cat; if(!t.grupo) t.sub=cp.sub; if(typeof ehLoja==='function'&&ehLoja(t)){t.grupo=null;t.divisao='INDIVIDUAL';t.sub='';}}
  if(target.classList.contains('c-tipo'))t.tipo=target.value;
  if(target.classList.contains('c-grupo')){var cg=catParse(target.value); t.grupo=cg.cat||null; t.sub=t.grupo?cg.sub:''; t.divisao=t.grupo?'CONJUNTA':'INDIVIDUAL';}
  if(target.classList.contains('c-st'))t.status=target.value;
  if(target.classList.contains('c-dv')){
    t.divisao=target.value;
    if(t.divisao==='CONJUNTA'){ if(!t.grupo) t.grupo=GRUPO_PADRAO; }
    else t.grupo=null;
    t.sub='';
  }
  salvarOverride(t);
}
function wireTxControls(){
  var fs=el('tx-fonte'); var listaF=FONTES.slice(); fontesConhecidas().forEach(function(f){ if(listaF.indexOf(f)<0) listaF.push(f); }); listaF.forEach(function(f){var o=document.createElement('option');o.value=f;o.textContent=f;fs.appendChild(o)});
  ['tx-search','tx-status','tx-tipo','tx-rev','tx-fonte'].forEach(function(id){
    el(id).addEventListener('input',function(){renderTxTable()});
    el(id).addEventListener('change',function(){renderTxTable()});});
  el('tx-table').addEventListener('change',function(e){
    var tr=e.target.closest('tr'); if(!tr)return;
    if(ehManual(tr.dataset.id)){ flashToast('Este lancamento veio do ACABEI DE GASTAR - edite por la.'); renderTxTable(); return; }
    applyEdit(tr,e.target);
    var estrutural=e.target.classList.contains('c-dv')||e.target.classList.contains('c-grupo');
    renderAll(true); if(estrutural) renderTxTable();});
  el('tx-table').addEventListener('click',function(e){
    var b=e.target.closest('.rev-back'); if(!b)return;
    var tr=b.closest('tr'), t=tr&&findTx(tr.dataset.id); if(!t)return;
    if(typeof mesTravado==='function'&&mesTravado(t)){ avisoTravado(t); return; }
    t.revisar=true; salvarOverride(t);
    flashToast('Voltou para Revisar: '+t.desc);
    renderAll(true);});
  el('tx-table').querySelector('thead').addEventListener('click',function(e){
    var th=e.target.closest('th'); if(!th||!th.dataset.s)return;
    if(state.sort.k===th.dataset.s)state.sort.dir*=-1;else{state.sort.k=th.dataset.s;state.sort.dir=1;}
    renderTxTable();});
}
function renderTxInsight(){ txMesOk();
  var l=state.txMes==='__all'?allTx().filter(function(t){return inView(t,state.perfil)}):txOf(state.txMes,state.perfil);
  var ass=l.filter(function(t){return t.tipo==='Assinaturas'||t.tipo==='Streaming'||t.tipo==='Gympass'});
  el('ins-tx').textContent='"'+ass.length+' assinaturas detectadas no recorte atual, somando '+brl(ass.reduce(function(s,t){return s+t.valor},0))+'. Marque o que nao usa para ver a economia."';
}

/* ---------- REVISAR ---------- */
/* cada uma revisa so os proprios lancamentos e os conjuntos */
function revVisivel(t){var lg=(typeof Auth!=='undefined'&&Auth.sessao()||{}).perfil; return !lg || t.perfil===lg || !!t.grupo;}
function revList(){
  revMesOk(); /* Revisar tem mes proprio e pode ver todos os meses */
  var q=(el('rev-search').value||'').toLowerCase(), pf=el('rev-perfil').value, out=[];
  var ms=state.revMes==='__all'?MONTHS:[state.revMes];
  ms.forEach(function(m){DATA.months[m].transactions.forEach(function(t){
    if(!t.revisar)return;
if(!revVisivel(t))return;
    if(pf&&t.perfil!==pf)return;
    if(q&&(t.desc+' '+t.raw).toLowerCase().indexOf(q)<0)return;
    t._m=m; out.push(t);});});
  out.sort(function(a,b){return b.valor-a.valor});
  return out;
}
function renderRevMonthPills(){ var n=el('rev-months'); if(!n) return;
  monthPills(n,state.revMes,function(m){state.revMes=m;renderReview();},true); }
/* a tabela monta 40 linhas por vez (cada linha tem 4 menus); "Carregar mais" traz mais 40 */
var REV_PASSO=40, revLimite=REV_PASSO, revFiltroAnt='';
function revApp(){ return document.documentElement.classList.contains('app-mode'); }
function renderReview(){
  var list=revList(), tb=el('rev-table').querySelector('tbody');
  var filtro=state.revMes+'|'+el('rev-search').value+'|'+el('rev-perfil').value;
  if(filtro!==revFiltroAnt){ revFiltroAnt=filtro; revLimite=REV_PASSO; }
  renderRevMonthPills();
  var todos=state.revMes==='__all', nomeMes=todos?'todos os meses':(typeof mesNome==='function'?mesNome(state.revMes):state.revMes);
  var total=allTx().filter(revVisivel).length, pend=allTx().filter(function(t){return t.revisar&&revVisivel(t)}).length;
  el('rev-pin').textContent=pend; el('rev-pin').dataset.zero = pend===0?'1':'0';
  el('rev-head').innerHTML='Cerca de <b>'+Math.round(pend/total*100)+'%</b> dos lan&ccedil;amentos ('+pend+' de '+total+') foram categorizados automaticamente e ainda esperam sua confer&ecirc;ncia. Corrija a categoria se estiver errada e marque <b>Conferido</b> &mdash; a marca&ccedil;&atilde;o &eacute; salva automaticamente e os pr&oacute;ximos meses j&aacute; aprendem com ela. Aqui aparecem s&oacute; os seus lan&ccedil;amentos e os conjuntos.';
  /* no celular a lista enxuta (mobile.js) substitui a tabela: nao monta os menus escondidos */
  var vis=revApp()?[]:list.slice(0,revLimite);
  tb.innerHTML=vis.map(function(t){
    return '<tr data-id="'+t._m+'|'+t.id+'">'+
      '<td style="white-space:nowrap">'+t.data+(todos?'<br><span style="font-size:11px;color:var(--tx3)">fatura '+esc(t._m)+'</span>':'')+'</td>'+
      '<td title="'+esc(t.raw)+'">'+esc(t.desc)+(t.possivelDup?' <span class="badge b-warn">poss. dup.</span>':'')+'</td>'+
      '<td><span class="badge '+(t.fontePendente?'b-warn':'b-ind')+'">'+esc(t.fonteLabel)+'</span></td>'+
      '<td><span class="badge b-ind">'+t.perfil+'</span></td>'+
      '<td><select class="c-dv"><option value="INDIVIDUAL"'+(t.divisao==='INDIVIDUAL'?' selected':'')+'>INDIVIDUAL</option><option value="CONJUNTA"'+(t.divisao==='CONJUNTA'?' selected':'')+'>CONJUNTA</option></select></td>'+
      '<td><select class="c-grupo" data-perfil="NuNa" data-vazio="1"'+(t.divisao==='CONJUNTA'?'':' disabled')+'>'+catOptsHTML('NuNa',t.grupo,t.grupo?t.sub:'',{novo:true,vazio:true})+'</select></td>'+
      '<td><select class="c-plano" data-perfil="'+t.perfil+'">'+catOptsHTML(t.perfil,t.plano,t.grupo?'':t.sub,{novo:true})+'</select></td>'+
      '<td><select class="c-tipo">'+tipoOpts(t.tipo)+'</select></td>'+
      '<td class="num">'+brl(t.valor)+'</td>'+
      '<td style="text-align:center"><input type="checkbox" class="c-rev" style="width:17px;height:17px;accent-color:var(--pos)"></td></tr>';}).join('');
  el('rev-count').innerHTML='<b>'+list.length+'</b> lan&ccedil;amentos aguardando confer&ecirc;ncia em <b>'+nomeMes+'</b>'+(list.length>vis.length?' (mostrando os '+vis.length+' maiores)':'')+
    ' &middot; total '+brl(list.reduce(function(s,t){return s+t.valor},0))+
    (list.length>vis.length?' <button type="button" class="pill" id="rev-mais">Carregar mais '+Math.min(REV_PASSO,list.length-vis.length)+'</button>':'');
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
  el('rev-count').addEventListener('click',function(e){
    if(!e.target.closest('#rev-mais'))return; revLimite+=REV_PASSO; renderReview();});
  el('rev-all').addEventListener('click',function(){
    /* so as linhas que estao na tela */
    var l=revApp()&&typeof mpRevVisiveis==='function' ? mpRevVisiveis()
      : [].map.call(el('rev-table').querySelectorAll('tbody tr[data-id]'),function(tr){return findTx(tr.dataset.id)}).filter(function(t){return t&&t.revisar});
    if(!l.length){ flashToast('Nenhum lancamento visivel para confirmar.'); return; }
    l.forEach(function(t){t.revisar=false; salvarOverride(t)});
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
