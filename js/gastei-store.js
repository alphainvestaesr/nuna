/* NuNa - gastei-store.js: armazenamento e Nucleo de Inteligencia do ACABEI DE GASTAR */
/* ============ ACABEI DE GASTAR — armazenamento ============ */
var AG = { db:null, pronto:false, itens:[], unsub:null, modo:'memoria' };
var AG_FONTES = ['Cartao Bradesco 8338 (Ana)','Cartao Bradesco 6897 (Ana)','Cartao Bradesco 7087 (Ana)',
  'Cartao Bradesco 6017 (Manuela)','Banco Inter 8614 (Ana)','Banco Inter 4876 (Ana)',
  'Pix','Dinheiro','Debito','Boleto','Outra'];
var AG_STATUS = ['Pendente','Confirmado','Conciliado','Revisar'];

function agLocalLoad(){ return Store.get(K.GASTEI, []); }
function agLocalSave(){ Store.set(K.GASTEI, AG.itens); }

function agInit(){
  AG.itens = agLocalLoad();
  AG.modo = Store.disponivel ? 'local' : 'memoria';
  AG.pronto = true;
  agRenderAll();
}
function agSalvarItem(item){
  agLocalSave(); agRenderAll(); renderAll(true);
  return Promise.resolve();
}
function agRemoverItem(id){
  AG.itens = AG.itens.filter(function(x){return x.id!==id});
  agLocalSave(); agRenderAll(); renderAll(true);
  return Promise.resolve();
}

/* ============ NUCLEO DE INTELIGENCIA ============ */
function agNorm(s){
  return String(s||'').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g,'')
    .replace(/[^a-z0-9 ]+/g,' ').replace(/\s+/g,' ').trim();
}
function agTokens(s){ return agNorm(s).split(' ').filter(function(t){return t.length>2}); }
function agUnicos(s){ var o={},r=[]; agTokens(s).forEach(function(t){ if(!o[t]){o[t]=1;r.push(t)} }); return r; }
/* coeficiente de Dice sobre tokens unicos: nao penaliza descricao repetida */
function agSimilar(a,b){
  var A=agUnicos(a), B=agUnicos(b); if(!A.length||!B.length) return 0;
  var setB={}; B.forEach(function(t){setB[t]=1});
  var hit=A.filter(function(t){return setB[t]}).length;
  if(!hit) return 0;
  return (2*hit)/(A.length+B.length);
}
/* sugere categoria/tipo/grupo/fonte a partir do historico importado */
function agSugerir(desc, perfil){
  if(!desc || agNorm(desc).length<3) return null;
  var melhor=null, score=0;
  allTx().forEach(function(t){
    if(t.perfil!==perfil) return;
    var s=agSimilar(desc, t.desc+' '+t.raw);
    if(s>score){ score=s; melhor=t; }
  });
  if(!melhor || score<0.33) return null;
  return {plano:melhor.plano, tipo:melhor.tipo, grupo:melhor.grupo,
          fonte:melhor.fonteLabel, score:score, base:melhor.desc};
}
/* concilia um lancamento manual com a base oficial importada */
function agConciliar(item){
  var melhor=null, best=0;
  allTx().forEach(function(t){
    if(t.perfil!==item.perfil) return;
    if(Math.abs(t.valor-item.valor) > Math.max(0.02, item.valor*0.01)) return;
    var d1=agDias(item.data), d2=agDiasBR(t.data);
    if(d1===null||d2===null) return;
    var dif=Math.abs(d1-d2); if(dif>5) return;
    var sDesc=agSimilar(item.desc, t.desc+' '+t.raw);
    var sFonte=(item.fonte===t.fonteLabel)?1:0;
    var sData=1-(dif/6);
    var score=sDesc*0.5 + sFonte*0.3 + sData*0.2;
    if(score>best){ best=score; melhor=t; }
  });
  if(!melhor) return {status:null, match:null, score:0};
  if(best>=0.72) return {status:'Conciliado', match:melhor, score:best};
  if(best>=0.42) return {status:'Revisar', match:melhor, score:best};
  return {status:null, match:null, score:best};
}
function agDias(iso){ if(!iso) return null; var p=iso.split('-'); if(p.length!==3) return null;
  return Math.floor(Date.UTC(+p[0],+p[1]-1,+p[2])/86400000); }
function agDiasBR(br){ if(!br) return null; var p=br.split('/'); if(p.length!==3) return null;
  return Math.floor(Date.UTC(2000+ +p[2],+p[1]-1,+p[0])/86400000); }
var MES_LABEL=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
function agMesDe(iso){ var p=String(iso||'').split('-'); if(p.length<2) return null;
  var n=+p[1]; return (n>=1&&n<=12)? MES_LABEL[n-1] : null; }
function agMesNoDash(iso){ var m=agMesDe(iso); return m && MONTHS.indexOf(m)>=0 ? m : null; }
function agHojeISO(){ var d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
function agBR(iso){ var p=String(iso||'').split('-'); return p.length===3? p[2]+'/'+p[1]+'/'+p[0].slice(2) : iso; }

/* itens que entram nos totais: conciliados NAO entram (a fatura ja tem) */
function agContabilizaveis(){ return AG.itens.filter(function(i){ return i.status!=='Conciliado' }); }
function agDoMes(mes, perfil){
  return AG.itens.filter(function(i){
    if(agMesDe(i.data)!==mes) return false;
    if(perfil==='NuNa') return i.divisao==='CONJUNTA';
    return i.perfil===perfil;
  });
}
