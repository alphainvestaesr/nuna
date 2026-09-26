/* NuNa - core.js: acesso aos dados, helpers e seletores de perfil/mes */

/* DATA e carregado de data/base.json por app.js e completado com o que
   estiver gravado no Store (edicoes, linhas importadas de CSV). */
var DATA = null, MONTHS = [], CLOSED = [], GOALS = {}, GRUPOS = [], CATS = {}, TIPOS = [],
    GRUPO_PADRAO = '', FONTES = [];
var PALETTE = ['#C9A227','#3F6296','#2A9D8F','#8E5572','#E0A64B','#588157','#6F4E7C','#C77D43','#457B9D','#D62828','#7FC8A0','#B5838D','#9C6644','#386641','#8FB0DF','#A56336','#3D5A80','#6C757D'];
var COLOR = {};
function colorOf(c){ if(!(c in COLOR)) COLOR[c]=PALETTE[Object.keys(COLOR).length%PALETTE.length]; return COLOR[c]; }

var state={perfil:'NuNa', mes:null, txMes:'__all', axis:'plano', trendCat:null, sort:{k:'data',dir:1}};

/* ---------- montagem da base + persistencia das edicoes ---------- */
function aplicarBase(base){
  DATA = base;
  MONTHS = DATA.monthOrder; CLOSED = DATA.closedMonths; GOALS = DATA.goals;
  GRUPOS = DATA.gruposNuNa; CATS = DATA.catsPlano; TIPOS = DATA.tipos;
  GRUPO_PADRAO = DATA.grupoPadrao; FONTES = DATA.fontes;

  /* linhas vindas de importacao de CSV entram na base, sem duplicar */
  var imp = Store.get(K.IMPORTADOS, []);
  var vistos = {};
  MONTHS.forEach(function(m){ DATA.months[m].transactions.forEach(function(t){ vistos[t.uid]=1; vistos[t.dedupKey]=1; }) });
  imp.forEach(function(t){
    if(vistos[t.uid] || MONTHS.indexOf(t.mes)<0) return;
    vistos[t.uid]=1; DATA.months[t.mes].transactions.push(t);
  });

  /* orcamentos salvos sobrepoem os calculados */
  var orc = Store.get(K.ORCAMENTOS, null);
  if(orc) Object.keys(orc).forEach(function(p){ if(DATA.budgets[p]) Object.assign(DATA.budgets[p], orc[p]); });

  /* edicoes do usuario, por uid */
  var ov = Store.get(K.OVERRIDES, {});
  MONTHS.forEach(function(m){ DATA.months[m].transactions.forEach(function(t){
    var o = ov[t.uid]; if(!o) return;
    if(o.plano!==undefined) t.plano=o.plano;
    if(o.tipo!==undefined) t.tipo=o.tipo;
    if(o.grupo!==undefined) t.grupo=o.grupo;
    if(o.divisao!==undefined) t.divisao=o.divisao;
    if(o.status!==undefined) t.status=o.status;
    if(o.revisar!==undefined) t.revisar=o.revisar;
  })});

  COLOR = {}; var i=0;
  [].concat(CATS.NuNa,CATS.Ana,CATS.Manuela,TIPOS).forEach(function(c){ if(!(c in COLOR)) COLOR[c]=PALETTE[(i++)%PALETTE.length] });

  var p = Store.get(K.PREFS, {});
  state.perfil = p.perfil || DATA.perfilOrder[0];
  state.mes = (p.mes && MONTHS.indexOf(p.mes)>=0) ? p.mes : CLOSED[CLOSED.length-1];
  state.axis = p.axis || 'plano';
}
function salvarPrefs(){ Store.set(K.PREFS, {perfil:state.perfil, mes:state.mes, axis:state.axis}); }
function salvarOverride(t){
  var ov = Store.get(K.OVERRIDES, {});
  ov[t.uid] = {plano:t.plano, tipo:t.tipo, grupo:t.grupo, divisao:t.divisao, status:t.status, revisar:t.revisar};
  Store.set(K.OVERRIDES, ov);
}
function salvarOrcamentos(){ Store.set(K.ORCAMENTOS, DATA.budgets); }
function mesesFechados(){ return Store.get(K.FECHAMENTOS, []); }
function mesEstaFechado(m){ return mesesFechados().indexOf(m)>=0; }

function brl(v){return 'R$ '+(v<0?'-':'')+Math.abs(v).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});}
function el(id){return document.getElementById(id);}
function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');}
/* contribuicao importada (t.contrib) nao e despesa: o valor conta so pelo botao CONTRIBUICAO, senao sai duas vezes do saldo */
function inView(t,p){if(t.contrib) return false; return p==='NuNa' ? !!t.grupo : t.perfil===p;}
/* lancamentos do ACABEI DE GASTAR entram como transacao; os CONCILIADOS nao,
   porque a versao oficial deles ja esta na base importada (regra anti-duplicidade) */
function agComoTx(mes){
  if(typeof AG==='undefined'||!AG.itens.length) return [];
  var out=[];
  AG.itens.forEach(function(i){
    if(i.status==='Conciliado') return;
    /* compra parcelada: cada parcela entra na fatura em que vai cair,
       e sai sozinha quando a parcela aparece na fatura importada */
    if(typeof agNumParcelas==='function' && agNumParcelas(i)>1){
      agParcelasDe(i).forEach(function(pc){
        if(pc.mes!==mes || pc.conciliada) return;
        out.push(agTxDeItem(i, mes, pc.valor, i.desc+' ('+agDois(pc.k)+'/'+agDois(pc.n)+')', 'AG|'+i.id+'|'+pc.k));
      });
      return;
    }
    if(agMesNoDash(i.data)!==mes) return;
    out.push(agTxDeItem(i, mes, i.valor, i.desc, 'AG|'+i.id));
  });
  return out;
}
function agTxDeItem(i, mes, valor, desc, chave){
  return {mes:mes,data:agBR(i.data),perfil:i.perfil,raw:desc,desc:desc,
      tipo:i.categoria,grupo:i.grupo||null,plano:i.categoria,planoOrig:i.categoria,grupoOrig:i.grupo||null,
      valor:valor,fonte:i.fonte,fonteLabel:i.fonte,fontePendente:false,cartao:'-',
      revisar:(i.status==='Pendente'||i.status==='Revisar'),status:'',divisao:i.divisao,
      contrib:false,possivelDup:false,manual:true,agStatus:i.status,id:i.id,uid:i.id,dedupKey:chave};
}
/* CONTRIBUICAO NAO E DESPESA: vive fora da lista de transacoes, nao entra
   em nenhum total nem grafico de despesas. Participa exclusivamente da
   formula RECEITAS - (DESPESAS INDIVIDUAIS + CONTRIBUICAO) = SALDO. */
function contribList(){ var l=Store.get(K.CONTRIB, []); return Array.isArray(l)?l:[]; }
function contribSave(l){ Store.set(K.CONTRIB, l); }
function contribDoMes(mes,perfil){
  return contribList().filter(function(c){ return c.mes===mes && (!perfil || c.perfil===perfil) });
}
function contribManualOf(mes,perfil){
  return contribDoMes(mes,perfil).reduce(function(s,c){return s+c.valor},0);
}
function mesTx(mes){ return DATA.months[mes].transactions.concat(agComoTx(mes)); }
/* CRAVO & CANELA: lancamento da loja fica a parte - fora dos gastos individuais,
   dos conjuntos, dos graficos e do saldo. Continua visivel na aba Transacoes. */
var CAT_LOJA='Cravo & Canela';
function ehLoja(t){ return !!t && (t.plano===CAT_LOJA || t.categoria===CAT_LOJA); }
function lojaOf(mes,p){ return mesTx(mes).filter(function(t){return !t.contrib && ehLoja(t) && (p==='NuNa'||t.perfil===p)}).reduce(function(s,t){return s+t.valor},0); }
function txOf(mes,p){return mesTx(mes).filter(function(t){return inView(t,p) && !ehLoja(t)});}
function allTx(){var a=[];MONTHS.forEach(function(m){DATA.months[m].transactions.forEach(function(t){t._m=m;a.push(t)})});return a;}
function catKey(t){ return state.perfil==='NuNa' && state.axis==='plano' ? t.grupo : t[state.axis]; }
function rendaOf(mes,p){var r=DATA.months[mes].receita;
  return p==='Ana'?r.Ana : p==='Manuela'?r.Manuela : r.Ana+r.Manuela;}
function gastoOf(mes,p){return txOf(mes,p).reduce(function(s,t){return s+t.valor},0);}
function splitOf(mes,p){var l=txOf(mes,p);
  return {ind:l.filter(function(t){return !t.grupo}).reduce(function(s,t){return s+t.valor},0),
          conj:l.filter(function(t){return !!t.grupo}).reduce(function(s,t){return s+t.valor},0)};}
/* CONTAS CONJUNTAS LANCADAS SAO APENAS INFORMATIVAS: o total do mes nao e
   despesa paga por ninguem. O pagamento real de cada pessoa e exclusivamente
   o que ela registra no botao CONTRIBUICAO. */
function contribTotalOf(mes,p){ return contribManualOf(mes,p); }
function saldoOf(mes,p){
  if(p==='NuNa') return -gastoOf(mes,'NuNa');
  return rendaOf(mes,p) - splitOf(mes,p).ind - contribTotalOf(mes,p);
}
function contribOf(mes){
  var tr=DATA.months[mes].transactions.filter(function(t){return t.contrib}).reduce(function(s,t){return s+t.valor},0);
  return {ana:contribTotalOf(mes,'Ana'), manu:contribTotalOf(mes,'Manuela'), tr:tr};
}
function catTotals(list){var o={};list.forEach(function(t){if(state.perfil!=='NuNa'&&t.divisao==='CONJUNTA')return; /* perfil individual: so gastos individuais */ var k=catKey(t)||'(sem grupo)';o[k]=(o[k]||0)+t.valor});return o;}


function wireProfile(){
  el('profsel').addEventListener('click',function(e){var b=e.target.closest('.prof');if(!b)return;
    state.perfil=b.dataset.p; salvarPrefs(); try{ esconderContribSeConjunto() }catch(e){}
    [].forEach.call(document.querySelectorAll('.prof'),function(y){y.classList.toggle('on',y.dataset.p===state.perfil)});
    renderAll();});
  [].forEach.call(document.querySelectorAll('.prof'),function(y){y.classList.toggle('on',y.dataset.p===state.perfil)});
}
function wireTabs(){
  el('tabs').addEventListener('click',function(e){var b=e.target.closest('button');if(!b)return;
    [].forEach.call(el('tabs').children,function(x){x.classList.remove('active')});b.classList.add('active');
    [].forEach.call(document.querySelectorAll('.panel'),function(p){p.classList.remove('active')});
    el('panel-'+b.dataset.tab).classList.add('active');
    proximaFatia(function(){ sincronizaPerfil(); renderPanel(b.dataset.tab) });});
}
function wireAxis(){
  el('axis-sel').addEventListener('click',function(e){var b=e.target.closest('.pill');if(!b)return;
    state.axis=b.dataset.ax; salvarPrefs();
    [].forEach.call(el('axis-sel').children,function(y){y.classList.toggle('on',y.dataset.ax===state.axis)});
    renderAll();});
  [].forEach.call(el('axis-sel').children,function(y){y.classList.toggle('on',y.dataset.ax===state.axis)});
}
function monthPills(node,cur,cb,withAll){
  node.innerHTML='';
  if(withAll){var a=document.createElement('button');a.className='pill'+(cur==='__all'?' on':'');a.textContent='Todos os meses';a.onclick=function(){cb('__all')};node.appendChild(a);}
  MONTHS.forEach(function(m){var b=document.createElement('button');b.className='pill'+(m===cur?' on':'');b.textContent=m;
    if(CLOSED.indexOf(m)<0)b.title='Mes em aberto / dados parciais';
    b.onclick=function(){cb(m)};node.appendChild(b);});
}
function renderOverviewMonths(){monthPills(el('ov-months'),state.mes,function(m){state.mes=m;salvarPrefs();renderAll();},false);}
function renderTxMonthPills(){monthPills(el('tx-months'),state.txMes,function(m){state.txMes=m;renderTxTable();renderTxInsight();try{renderReview();}catch(e){}},true);}
