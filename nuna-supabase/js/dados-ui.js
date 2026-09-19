/* NuNa - dados-ui.js: aba Dados (importar CSV, fechar mes, backup) */
var ultimaPreparacao = null;

function renderDados(){
  var s = Auth.sessao();
  el('dd-sessao').innerHTML = s
    ? 'Conectada como <b>'+esc(s.nome)+'</b> ('+esc(s.email||'')+') &middot; a sess&atilde;o continua ativa neste aparelho at&eacute; voc&ecirc; sair.'
    : '';
  var ov = Store.get(K.OVERRIDES,{}), imp = Store.get(K.IMPORTADOS,[]), g = Store.get(K.GASTEI,[]);
  el('dd-resumo').innerHTML =
    kpiCard('Lan&ccedil;amentos na base', allTx().length, 'base + importados','')+
    kpiCard('Importados de CSV', imp.length, 'guardados neste navegador','')+
    kpiCard('Edi&ccedil;&otilde;es suas', Object.keys(ov).length, 'categoria, divis&atilde;o, revis&atilde;o','')+
    kpiCard('ACABEI DE GASTAR', g.length, 'lan&ccedil;amentos r&aacute;pidos','');
  el('dd-armazenamento').innerHTML = '&#10003; Conectado ao banco online. O que voc&ecirc; edita ou lan&ccedil;a vai para o Supabase e aparece para as duas, em qualquer aparelho.'
    + (typeof USANDO_EXEMPLO !== 'undefined' && USANDO_EXEMPLO ? ' <b>Aten&ccedil;&atilde;o: a base ainda n&atilde;o foi importada &mdash; o que est&aacute; na tela s&atilde;o dados de exemplo.</b>' : '');
  renderFechamentos();
}
function renderFechamentos(){
  var f = mesesFechados();
  el('dd-fech').innerHTML = MONTHS.map(function(m){
    var fechado = f.indexOf(m)>=0;
    return '<label class="chk"><input type="checkbox" data-m="'+m+'"'+(fechado?' checked':'')+'>'+
      '<span class="n">'+m+'/2026'+(fechado?' <span class="badge b-ok">fechado</span>':'')+'</span>'+
      '<span class="v">'+brl(MONTHS.indexOf(m)>=0? mesTx(m).reduce(function(s,t){return s+t.valor},0):0)+'</span></label>';
  }).join('');
  [].forEach.call(el('dd-fech').querySelectorAll('input'),function(c){
    c.onchange=function(){
      var f=mesesFechados(), m=c.dataset.m;
      if(c.checked){ if(f.indexOf(m)<0) f.push(m); } else f=f.filter(function(x){return x!==m});
      Store.set(K.FECHAMENTOS,f); renderFechamentos(); renderAll(true);
      flashToast(c.checked? m+' fechado. O historico mensal passa a trata-lo como consolidado.' : m+' reaberto.');
    };
  });
}
var textoCSV = null;
function lerArquivoCSV(e){
  var f=e.target.files && e.target.files[0]; if(!f) return;
  var r=new FileReader();
  r.onload=function(){ textoCSV=String(r.result); reprocessarCSV(); };
  r.readAsText(f,'utf-8');
}
function reprocessarCSV(){
  if(!textoCSV) return;
  var res=CSV.ler(textoCSV);
  if(res.erro){ el('dd-preview').innerHTML='<p class="note" style="color:var(--neg)">'+esc(res.erro)+'</p>';
    ultimaPreparacao=null; el('dd-aplicar').disabled=true; return; }
  var prep=CSV.preparar(res.linhas, {fonte: el('dd-fonte').value||'', perfil: el('dd-perfil').value, mesFatura: el('dd-mes').value||''});
  ultimaPreparacao=prep;
  el('dd-preview').innerHTML=
    '<div class="grid3" style="margin:12px 0">'+
    kpiCard('Novos', prep.novos.length, 'entram como "a revisar"','green')+
    kpiCard('J&aacute; existiam', prep.duplicados.length, 'ignorados, sem duplicar','orange')+
    kpiCard('Fora do per&iacute;odo', prep.foraDoPeriodo.length, 'm&ecirc;s fora de mar&ndash;out/2026','')+
    '</div>'+
    (prep.novos.length? '<div class="scroll"><table><thead><tr><th>Data</th><th>Descri&ccedil;&atilde;o</th><th>M&ecirc;s</th><th>Perfil</th><th class="num">Valor</th><th></th></tr></thead><tbody>'+
      prep.novos.slice(0,40).map(function(t){return '<tr><td>'+t.data+'</td><td>'+esc(t.desc)+'</td><td>'+t.mes+'</td><td>'+t.perfil+'</td><td class="num">'+brl(t.valor)+'</td><td>'+(t.possivelDup?'<span class="badge b-warn">poss. dup.</span>':'')+'</td></tr>'}).join('')+
      '</tbody></table></div>'+(prep.novos.length>40?'<p class="note">Mostrando as 40 primeiras de '+prep.novos.length+'.</p>':'')
      : '<p class="note">Nenhuma linha nova &mdash; todas as linhas deste arquivo j&aacute; est&atilde;o na base.</p>');
  el('dd-aplicar').disabled = !prep.novos.length;
}
function wireDados(){
  var sm=el('dd-mes');
  MONTHS.forEach(function(m){ var o=document.createElement('option'); o.value=m; o.textContent='Fatura de '+m+'/2026'; sm.appendChild(o); });
  ['dd-fonte','dd-perfil','dd-mes'].forEach(function(id){ el(id).addEventListener('change', reprocessarCSV); });
  el('dd-file').addEventListener('change', lerArquivoCSV);
  el('dd-aplicar').addEventListener('click', function(){
    if(!ultimaPreparacao || !ultimaPreparacao.novos.length) return;
    var n=ultimaPreparacao.novos.length;
    CSV.aplicar(ultimaPreparacao.novos);
    ultimaPreparacao=null; el('dd-aplicar').disabled=true; el('dd-file').value=''; textoCSV=null;
    el('dd-preview').innerHTML='<p class="note">'+n+' lan&ccedil;amentos importados. Est&atilde;o na aba <b>Revisar</b> aguardando sua confer&ecirc;ncia.</p>';
    renderAll(); flashToast(n+' lancamentos importados sem duplicar.');
  });
  el('dd-backup').addEventListener('click', function(){
    baixarArquivo('nuna-backup-'+new Date().toISOString().slice(0,10)+'.json',
                  JSON.stringify(Store.exportarTudo(), null, 2));
  });
  el('dd-restaurar').addEventListener('change', function(e){
    var f=e.target.files && e.target.files[0]; if(!f) return;
    var r=new FileReader();
    r.onload=function(){
      try{
        var obj=JSON.parse(String(r.result));
        if(!obj.dados) throw new Error('formato');
        if(!confirm('Restaurar o backup? As edicoes atuais deste navegador serao substituidas.')) return;
        Store.importarTudo(obj); location.reload();
      }catch(err){ flashToast('Arquivo de backup invalido.'); }
    };
    r.readAsText(f,'utf-8');
  });
  el('dd-limpar').addEventListener('click', function(){
    if(!confirm('Apagar TODAS as suas edicoes, importacoes e lancamentos do ACABEI DE GASTAR deste navegador? A base original de mar-out/2026 continua.')) return;
    [K.OVERRIDES,K.ORCAMENTOS,K.GASTEI,K.IMPORTADOS,K.FECHAMENTOS,K.TRANSF,K.PREFS,K.CONTRIB].forEach(Store.remove);
    location.reload();
  });
  el('dd-sair').addEventListener('click', sairDaConta);
}
function baixarArquivo(nome, texto){
  try{
    var blob=new Blob([texto],{type:'application/json'});
    var a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=nome;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function(){URL.revokeObjectURL(a.href)},2000);
    flashToast(nome+' baixado.');
  }catch(e){ flashToast('Nao consegui gerar o download neste navegador.'); }
}
