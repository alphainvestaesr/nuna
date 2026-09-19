/* NuNa - agente.js: Relatorio do Agente Financeiro e historico mensal */
/* ============ RELATORIO DO AGENTE FINANCEIRO ============ */
function agMediaHistorica(cat, perfil){
  var v=CLOSED.map(function(m){
    return txOf(m,perfil).filter(function(t){return t.plano===cat}).reduce(function(s,t){return s+t.valor},0);});
  return v.reduce(function(a,b){return a+b},0)/v.length;
}
function agRelatorio(){
  var hoje=agHojeISO(), mes=agMesDe(hoje);
  var doMes=AG.itens.filter(function(i){return agMesDe(i.data)===mes && i.status!=='Conciliado'});
  var box=el('ag-relatorio');
  if(!doMes.length){
    box.innerHTML='<p class="note" style="margin:0">O Agente Financeiro comenta a partir do primeiro gasto registrado no m&ecirc;s. Lance um e ele come&ccedil;a a acompanhar.</p>';
    el('ins-ag').textContent='"Nenhum gasto registrado ainda neste mes. O ACABEI DE GASTAR e a porta de entrada rapida para a mesma base."';
    return;
  }
  var soma=function(a){return a.reduce(function(s,i){return s+i.valor},0)};
  var total=soma(doMes), n=doMes.length;
  var dias={}; doMes.forEach(function(i){dias[i.data]=1});
  var nd=Object.keys(dias).length, medDia=total/Math.max(1,nd);
  var porCat={}; doMes.forEach(function(i){porCat[i.categoria]=(porCat[i.categoria]||0)+i.valor});
  var cats=Object.keys(porCat).sort(function(a,b){return porCat[b]-porCat[a]});
  var cj=soma(doMes.filter(function(i){return i.divisao==='CONJUNTA'}));
  var pendentes=doMes.filter(function(i){return i.status==='Pendente'||i.status==='Revisar'});

  var dicas=[], alertas=[];
  dicas.push('Voc&ecirc; registrou <b>'+n+'</b> gasto'+(n===1?'':'s')+' em '+nd+' dia'+(nd===1?'':'s')+', somando <b>'+brl(total)+'</b> &mdash; m&eacute;dia de '+brl(medDia)+' por dia com lan&ccedil;amento.');
  if(cats.length) dicas.push('Maior categoria do m&ecirc;s at&eacute; agora: <b>'+esc(cats[0])+'</b>, com '+brl(porCat[cats[0]])+' ('+Math.round(porCat[cats[0]]/total*100)+'% do registrado).');
  if(cj>0) dicas.push('Do total registrado, <b>'+brl(cj)+'</b> ('+Math.round(cj/total*100)+'%) est&aacute; marcado como conjunto e vai compor o perfil NuNa.');

  cats.slice(0,4).forEach(function(c){
    var med=agMediaHistorica(c, doMes[0].perfil);
    if(med>100 && porCat[c] > med*1.25){
      alertas.push('<b>'+esc(c)+'</b> j&aacute; est&aacute; em '+brl(porCat[c])+' no m&ecirc;s, contra uma m&eacute;dia hist&oacute;rica de '+brl(med)+'. Crescimento de '+Math.round((porCat[c]/med-1)*100)+'%.');
    }
  });
  if(cats.length && porCat[cats[0]]/total > 0.5 && n>=4)
    alertas.push('Metade do que voc&ecirc; registrou est&aacute; concentrado em <b>'+esc(cats[0])+'</b>. Vale olhar se isso &eacute; padr&atilde;o do m&ecirc;s ou um gasto pontual.');
  var mesAtual = MONTHS.indexOf(mes)>=0 ? mes : null;
  if(mesAtual){
    var saldoRef = saldoOf(mesAtual, doMes[0].perfil);
    if(saldoRef<0) alertas.push('O perfil <b>'+doMes[0].perfil+'</b> j&aacute; fecha '+mesAtual+' negativo na base importada ('+brl(saldoRef)+'). Cada gasto novo aprofunda o buraco antes de qualquer sobra.');
    else if(total > saldoRef*0.6 && saldoRef>0) alertas.push('O registrado no m&ecirc;s ('+brl(total)+') j&aacute; consome mais de 60% do saldo dispon&iacute;vel de '+mesAtual+' ('+brl(saldoRef)+').');
  }
  if(pendentes.length) alertas.push('<b>'+pendentes.length+'</b> lan&ccedil;amento'+(pendentes.length===1?'':'s')+' ainda em Pendente ou Revisar. Confirme a categoria para o hist&oacute;rico ficar confi&aacute;vel.');

  var conc=AG.itens.filter(function(i){return agMesDe(i.data)===mes && i.status==='Conciliado'});
  var resumo='No m&ecirc;s de '+mes+', foram <b>'+brl(total)+'</b> em '+n+' lan&ccedil;amento'+(n===1?'':'s')+' registrados na hora. '+
    (conc.length? conc.length+' j&aacute; foram encontrados na fatura e conciliados &mdash; n&atilde;o contam duas vezes. ' : '')+
    (alertas.length? 'H&aacute; '+alertas.length+' ponto'+(alertas.length===1?'':'s')+' de aten&ccedil;&atilde;o abaixo.' : 'Nada fora do padr&atilde;o at&eacute; aqui.');

  box.innerHTML='<div class="rep">'+
    '<h4>Resumo</h4><ul><li>'+resumo+'</li></ul>'+
    '<h4>Dicas</h4><ul>'+dicas.map(function(d){return '<li>'+d+'</li>'}).join('')+'</ul>'+
    '<h4>Alertas</h4><ul>'+(alertas.length? alertas.map(function(a){return '<li class="alerta">'+a+'</li>'}).join('') : '<li>Nenhum alerta neste m&ecirc;s.</li>')+'</ul></div>';
  el('ins-ag').textContent='"'+n+' gastos lancados na hora em '+mes+', somando '+brl(total)+'. '+conc.length+' ja conciliados com a fatura."';
}
function agRenderHist(){
  var por={};
  AG.itens.forEach(function(i){
    var m=agMesDe(i.data); if(!m) return;
    var x=por[m]=por[m]||{n:0,t:0};
    x.n++; if(i.status!=='Conciliado') x.t+=i.valor;
  });
  var hojeMes=agMesDe(agHojeISO());
  var ms=MONTHS.filter(function(m){return por[m]});
  el('ag-hist').querySelector('tbody').innerHTML = ms.length
    ? ms.map(function(m,idx){
        var x=por[m], ant= idx>0 ? por[ms[idx-1]] : null;
        var dif = ant && ant.t>0 ? (x.t/ant.t-1)*100 : null;
        var op;
        if(m===hojeMes) op='M&ecirc;s em andamento &mdash; o fechamento consolida e o detalhe fica na aba Transa&ccedil;&otilde;es.';
        else if(dif===null) op='Primeiro m&ecirc;s com registro di&aacute;rio; serve de base para comparar os pr&oacute;ximos.';
        else if(dif>15) op='Gastou '+Math.round(dif)+'% a mais que no m&ecirc;s anterior. Vale olhar qual categoria puxou.';
        else if(dif<-15) op='Gastou '+Math.round(-dif)+'% a menos que no m&ecirc;s anterior. Bom sinal, se n&atilde;o foi falta de registro.';
        else op='Volume parecido com o m&ecirc;s anterior, sem oscila&ccedil;&atilde;o relevante.';
        return '<tr><td>'+m+'/2026'+(m===hojeMes?' <span class="badge b-warn">em aberto</span>':'')+'</td><td class="num">'+x.n+'</td>'+
          '<td class="num"><b>'+brl(x.t)+'</b></td><td class="num">'+(dif===null?'&mdash;':(dif>0?'+':'')+Math.round(dif)+'%')+'</td>'+
          '<td style="font-size:12px;color:var(--tx2)">'+op+'</td></tr>';}).join('')
    : '<tr><td colspan="5" style="color:var(--tx3)">Ainda sem hist&oacute;rico &mdash; ele se forma conforme voc&ecirc; registra.</td></tr>';
}
function agRenderAll(){
  [agRenderCTA,agRenderKPIs,agRenderHoje,agRenderDias,agRenderFontes,agRelatorio,agRenderHist]
    .forEach(function(f){ try{f()}catch(e){console.error('Erro em '+f.name+':',e)} });
}
