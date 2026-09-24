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
    kpiCard('Importados de CSV', imp.length, 'guardados no banco online','')+
    kpiCard('Edi&ccedil;&otilde;es suas', Object.keys(ov).length, 'categoria, divis&atilde;o, revis&atilde;o','')+
    kpiCard('ACABEI DE GASTAR', g.length, 'lan&ccedil;amentos r&aacute;pidos','');
  el('dd-armazenamento').innerHTML = '&#10003; Conectado ao banco online. O que voc&ecirc; edita ou lan&ccedil;a vai para o Supabase e aparece para as duas, em qualquer aparelho.'
    + (typeof USANDO_EXEMPLO !== 'undefined' && USANDO_EXEMPLO ? ' <b>Aten&ccedil;&atilde;o: a base ainda n&atilde;o foi importada &mdash; o que est&aacute; na tela s&atilde;o dados de exemplo.</b>' : '');
  renderFechamentos();
}
function renderFechamentos(){ try{ ddRenderPendentes(); }catch(e){}
  var f = mesesFechados();
  el('dd-fech').innerHTML = MONTHS.map(function(m){
    var fechado = f.indexOf(m)>=0;
    return '<label class="chk"><input type="checkbox" data-m="'+m+'"'+(fechado?' checked':'')+'>'+
      '<span class="n">'+(typeof mesNome==='function'?mesNome(m):m+'/2026')+(fechado?' <span class="badge b-ok">fechado</span>':'')+'</span>'+
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
  var f=e.target.files && e.target.files[0]; if(!f) return; nomeArquivoCSV=f.name;
  var r=new FileReader();
  r.onload=function(){ textoCSV=String(r.result); ddSugerirFonte(); reprocessarCSV(); };
  r.readAsText(f,'utf-8');
}
function reprocessarCSV(){
  if(!textoCSV) return;
  var res=CSV.ler(textoCSV);
  if(res.erro){ el('dd-preview').innerHTML='<p class="note" style="color:var(--neg)">'+esc(res.erro)+'</p>';
    ultimaPreparacao=null; el('dd-aplicar').disabled=true; return; }
  var prep=CSV.preparar(res.linhas, {fonte: ddFonteEscolhida(), perfil: el('dd-perfil').value, mesFatura: el('dd-mes').value||''});
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
ddMontarNovo(); ddMontarFontes();
  MONTHS.forEach(function(m){ var o=document.createElement('option'); o.value=m; o.textContent='Fatura de '+(typeof mesNome==='function'?mesNome(m):m+'/2026'); sm.appendChild(o); });
  ['dd-fonte','dd-perfil','dd-mes'].forEach(function(id){ el(id).addEventListener('change', reprocessarCSV); });
  el('dd-file').addEventListener('change', lerArquivoCSV);
  el('dd-aplicar').addEventListener('click', function(){
    if(!ultimaPreparacao || !ultimaPreparacao.novos.length) return;
    var n=ultimaPreparacao.novos.length;
    var nomeNovo = el('dd-fonte').value==='__novo' ? ddFonteEscolhida() : '';
CSV.aplicar(ultimaPreparacao.novos);
ddMontarFontes(nomeNovo); if(typeof agAtualizarFontes==='function') agAtualizarFontes();
if(nomeNovo) setTimeout(function(){ flashToast('Cartao cadastrado: '+nomeNovo+'. Ja aparece para as duas.'); },3600);
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

/* ---------- cartao/conta novo na importacao ----------
   "+ Novo cartao/conta" pede banco e final; o nome vira a fonte dos
   lancamentos importados e passa a existir em todas as listas. */
var nomeArquivoCSV = '';
function ddMontarFontes(selecionar){
  var s=el('dd-fonte'); if(!s) return;
  var atual = selecionar || s.value;
  var ops=[['','Deixar pendente de revis\u00e3o']];
  fontesConhecidas().forEach(function(f){ ops.push([f,f]); });
  ['Pix','Debito','Boleto'].forEach(function(f){ ops.push([f,f]); });
  ops.push(['__novo','+ Novo cart\u00e3o/conta\u2026']);
  s.innerHTML=ops.map(function(o){return '<option value="'+esc(o[0])+'">'+esc(o[1])+'</option>'}).join('');
  s.value = ops.some(function(o){return o[0]===atual}) ? atual : '';
  ddAtualizarNovo();
}
function ddMontarNovo(){
  if(el('dd-novo')) return;
  var s=el('dd-fonte'); if(!s) return;
  /* o perfil da importacao comeca em quem esta logada */
  var lg=(Auth.sessao()||{}).perfil; if(lg && el('dd-perfil')) el('dd-perfil').value=lg;
  var ancora=s.closest('.agform')||s.closest('label')||s;
  var box=document.createElement('div'); box.id='dd-novo'; box.hidden=true;
  box.style.cssText='margin:10px 0;padding:10px 12px;border:1px dashed var(--border);border-radius:10px';
  box.innerHTML='<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center">'+
    '<b style="font-size:13px">Novo:</b>'+
    '<select id="dd-novo-tipo"><option value="Cartao">Cart\u00e3o</option><option value="Conta">Conta</option></select>'+
    '<input id="dd-novo-banco" type="text" placeholder="Banco (ex.: Nubank)" style="min-width:150px">'+
    '<input id="dd-novo-fim" type="text" inputmode="numeric" maxlength="4" placeholder="Final (4 d\u00edgitos)" style="width:140px">'+
    '</div><p class="note" id="dd-novo-prev" style="margin:6px 0 0"></p>';
  ancora.insertAdjacentElement('afterend', box);
  ['dd-novo-tipo','dd-novo-banco','dd-novo-fim'].forEach(function(id){
    el(id).addEventListener('input', function(){ ddAtualizarNovo(); reprocessarCSV(); });
    el(id).addEventListener('change', function(){ ddAtualizarNovo(); reprocessarCSV(); });
  });
  s.addEventListener('change', ddAtualizarNovo);
  el('dd-perfil').addEventListener('change', ddAtualizarNovo);
}
function ddFonteEscolhida(){
  var s=el('dd-fonte'); if(!s) return '';
  if(s.value!=='__novo') return s.value||'';
  return nomeNovaFonte(el('dd-novo-tipo').value, el('dd-novo-banco').value, el('dd-novo-fim').value, el('dd-perfil').value);
}
function ddAtualizarNovo(){
  var box=el('dd-novo'), s=el('dd-fonte'); if(!box||!s) return;
  box.hidden = s.value!=='__novo';
  if(box.hidden) return;
  var nome=ddFonteEscolhida();
  el('dd-novo-prev').innerHTML = nome
    ? 'Vai ser cadastrado como <b>'+esc(nome)+'</b>. Depois de importar, aparece para as duas no ACABEI DE GASTAR, nos filtros e nas pr\u00f3ximas importa\u00e7\u00f5es.'
    : 'Escreva o banco para dar nome ao cart\u00e3o. Sem nome, os lan\u00e7amentos ficam pendentes de revis\u00e3o.';
}
function ddSugerirFonte(){
  if(!textoCSV) return;
  var s=el('dd-fonte'); if(!s || s.value) return;
  var res=CSV.ler(textoCSV); if(res.erro) return;
  if(res.linhas.some(function(r){return r.fonte})) return; /* o proprio arquivo ja informa o cartao */
  var sg=CSV.sugerirFonte(nomeArquivoCSV, res.linhas);
  if(sg.conhecida){ s.value=sg.conhecida; ddAtualizarNovo(); flashToast('Reconheci o cart\u00e3o '+sg.conhecida+'. Confira antes de importar.'); return; }
  if(sg.banco||sg.fim){
    s.value='__novo'; el('dd-novo-banco').value=sg.banco; el('dd-novo-fim').value=sg.fim;
    ddAtualizarNovo(); flashToast('Parece um cart\u00e3o novo. Confira o nome sugerido antes de importar.');
  }
}
/* lancamentos importados sem cartao: liga a um cartao existente ou novo, sem duplicar */
function ddRenderPendentes(){
  var host=el('dd-pendentes');
  if(!host){ var pv=el('dd-preview'); if(!pv) return; host=document.createElement('div'); host.id='dd-pendentes'; pv.insertAdjacentElement('afterend', host); }
  var imp=Store.get(K.IMPORTADOS,[]).filter(function(t){return t.fontePendente});
  if(!imp.length){ host.innerHTML=''; return; }
  var grupos={};
  imp.forEach(function(t){
    var k=t.mes+' \u00b7 '+t.perfil+' \u00b7 importado em '+String(t.importadoEm||'').slice(0,10).split('-').reverse().join('/');
    (grupos[k]=grupos[k]||[]).push(t);
  });
  var chaves=Object.keys(grupos);
  var ops=fontesConhecidas().map(function(f){return '<option value="'+esc(f)+'">'+esc(f)+'</option>'}).join('');
  host.innerHTML='<h3 style="margin-top:18px">Faturas sem cart\u00e3o</h3>'+
    '<p class="note">Estes lan\u00e7amentos entraram como \u201cFonte n\u00e3o identificada\u201d. Escolha o cart\u00e3o ou escreva um nome novo e clique em <b>Ligar</b>. Nenhum lan\u00e7amento \u00e9 duplicado.</p>'+
    chaves.map(function(k,i){
      var g=grupos[k], tot=g.reduce(function(s,t){return s+t.valor},0);
      return '<div data-i="'+i+'" style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:8px 0;border-top:1px solid var(--border)">'+
        '<span style="flex:1 1 220px">'+esc(k)+' \u00b7 '+g.length+' lan\u00e7amentos \u00b7 '+brl(tot)+'</span>'+
        '<select class="dp-sel"><option value="">escolha o cart\u00e3o\u2026</option>'+ops+'</select>'+
        '<input class="dp-nome" type="text" placeholder="ou nome novo: Cartao Nubank 1234 (Manuela)" style="min-width:230px">'+
        '<button class="pill dp-ok">Ligar</button></div>';
    }).join('');
  [].forEach.call(host.querySelectorAll('.dp-ok'), function(b){
    b.onclick=function(){
      var row=b.closest('[data-i]'), g=grupos[chaves[+row.dataset.i]];
      var nome=row.querySelector('.dp-nome').value.trim() || row.querySelector('.dp-sel').value;
      if(!nome){ flashToast('Escolha ou escreva o cart\u00e3o.'); return; }
      var n=CSV.religar(g.map(function(t){return t.uid}), nome);
      ddMontarFontes(); if(typeof agAtualizarFontes==='function') agAtualizarFontes();
      renderAll(true); ddRenderPendentes();
      flashToast(n+' lan\u00e7amentos ligados a '+nome+'.');
    };
  });
}
