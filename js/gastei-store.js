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
  /* confere de novo, contra as faturas ja importadas, os gastos que ainda nao foram encontrados */
  try{ agReconciliar(); }catch(e){ console.error('agReconciliar',e); }
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
function agConciliar(item, usadas){
  var melhor=null, best=0;
  allTx().forEach(function(t){
    if(t.perfil!==item.perfil) return;
    if(t.manual) return; /* compara so com a base oficial, nunca com outro gasto manual */
    if(usadas && usadas[t.uid||t.id]) return;
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

/* ============ PARCELAS E CONFERENCIA COM A FATURA ============
   Compra parcelada no ACABEI DE GASTAR: o valor total fica registrado no dia
   da compra, mas nos totais do dashboard entra uma parcela por fatura.
   Quando a fatura e importada, cada parcela e procurada na base (valor da
   parcela, data da compra, "(02/03)" na descricao) e, achada, sai da conta
   para nao contar duas vezes. A conferencia roda ao abrir o NuNa e a cada
   importacao de CSV - nao so no momento em que o gasto e salvo. */
function agDois(n){ return (n<10?'0':'')+n; }
function agNumParcelas(i){ var n=parseInt(i&&i.parcelas,10); return n>1 ? Math.min(n,48) : 1; }
/* valor de cada parcela: centavos que sobram vao para a 1a (como os bancos fazem) */
function agValoresParcelas(total, n){
  var c=Math.round(total*100), base=Math.floor(c/n), resto=c-base*n, out=[];
  for(var k=1;k<=n;k++) out.push((base+(k===1?resto:0))/100);
  return out;
}
/* ciclo do cartao: "base" = quantos meses depois da compra vence a fatura quando a
   compra e feita ate o fechamento; depois do fechamento, vai para a fatura seguinte */
var AG_CICLOS = [
  { teste:/bradesco/i, base:1, fecha:22 },   /* fecha ~dia 21-23, vence dia 03 do mes seguinte */
  { teste:/inter/i,    base:0, fecha:14 }
];
function agCiclo(fonte){
  fonte=String(fonte||'');
  for(var i=0;i<AG_CICLOS.length;i++) if(AG_CICLOS[i].teste.test(fonte)) return AG_CICLOS[i];
  if(/^cart/i.test(fonte)) return { base:1, fecha:22 };
  return null; /* Pix, dinheiro, debito, boleto: cai no proprio mes */
}
function agLabelDeOrdem(o){
  var ano=Math.floor(o/12), m=(o%12)+1;
  return (typeof mesLabelDe==='function') ? mesLabelDe(ano,m) : MES_LABEL[m-1];
}
/* lista das parcelas de um item: numero, valor, mes da fatura e se ja foi achada */
function agParcelasDe(i){
  var n=agNumParcelas(i), p=String(i.data||'').split('-'); if(p.length!==3) return [];
  var ordem=(+p[0])*12+(+p[1]-1), ciclo=agCiclo(i.fonte);
  if(ciclo) ordem += ciclo.base + ((+p[2])>ciclo.fecha ? 1 : 0);
  var vals=agValoresParcelas(i.valor,n), conc=i.parcConc||{}, out=[];
  for(var k=1;k<=n;k++) out.push({k:k, n:n, valor:vals[k-1], mes:agLabelDeOrdem(ordem+k-1),
    conciliada: i.status==='Conciliado' || !!conc[k]});
  return out;
}
/* le "(02/03)", "02/03" no fim ou "Parcela 02 de 03" na descricao do banco */
function agParcelaDaDesc(s){
  s=String(s||'');
  var m=s.match(/parcela\s*(\d{1,2})\s*de\s*(\d{1,2})/i) || s.match(/\(?\b(\d{1,2})\s*\/\s*(\d{1,2})\)?\s*$/);
  if(!m) return null;
  var k=+m[1], n=+m[2]; return (k>=1 && n>=2 && k<=n) ? {k:k,n:n} : null;
}
/* pontua uma linha da fatura contra uma parcela do gasto manual */
function agPontuaParcela(item, pc, t){
  if(t.perfil!==item.perfil) return 0;
  if(Math.abs(t.valor-pc.valor) > Math.max(0.05, pc.valor*0.01)) return 0;
  var d1=agDias(item.data), d2=agDiasBR(t.data); if(d1===null||d2===null) return 0;
  var dif=Math.abs(d1-d2); if(dif>5) return 0;
  var pd=agParcelaDaDesc(t.raw||t.desc);
  if(pd && (pd.n!==pc.n || pd.k!==pc.k)) return 0;
  var sDesc=agSimilar(item.desc, (t.desc||'')+' '+(t.raw||''));
  var sFonte=(item.fonte===t.fonteLabel)?1:0, sData=1-(dif/6);
  return Math.min(1, sDesc*0.5 + sFonte*0.3 + sData*0.2 + (pd?0.15:0));
}
/* confere todos os gastos manuais em aberto contra a base importada.
   Nunca desfaz uma conciliacao e nunca usa a mesma linha da fatura duas vezes.
   Devolve quantos gastos/parcelas foram encontrados agora. */
function agReconciliar(){
  if(typeof AG==='undefined' || !AG.itens.length || typeof DATA==='undefined' || !DATA || !DATA.months) return 0;
  var base=[]; MONTHS.forEach(function(m){ (DATA.months[m].transactions||[]).forEach(function(t){ base.push(t); }); });
  var usadas={};
  AG.itens.forEach(function(i){
    if(i.conciliadoUid) usadas[i.conciliadoUid]=1;
    var pc=i.parcConc||{}; Object.keys(pc).forEach(function(k){ if(pc[k] && pc[k].uid) usadas[pc[k].uid]=1; });
  });
  var achados=0, mudou=false;
  AG.itens.forEach(function(i){
    if(i.status==='Conciliado' || i.naoConciliar) return;
    if(/^dinheiro$/i.test(i.fonte||'')) return; /* dinheiro nunca aparece em fatura ou extrato: o lancamento manual e a unica fonte e sempre conta */
    var n=agNumParcelas(i);
    if(n===1){
      var c=agConciliar(i, usadas);
      if(c.status==='Conciliado'){
        i.status='Conciliado'; i.conciliadoCom=c.match.raw; i.conciliadoUid=c.match.uid||c.match.id;
        i.conciliadoEm=new Date().toISOString(); delete i.possivelMatch;
        usadas[i.conciliadoUid]=1; achados++; mudou=true;
      }
      return;
    }
    i.parcConc=i.parcConc||{};
    agParcelasDe(i).forEach(function(pc){
      if(pc.conciliada) return;
      var melhor=null, best=0;
      base.forEach(function(t){
        var u=t.uid||t.id; if(usadas[u]) return;
        var s=agPontuaParcela(i, pc, t); if(s>best){ best=s; melhor=t; }
      });
      if(melhor && best>=0.72){
        var u=melhor.uid||melhor.id; usadas[u]=1;
        i.parcConc[pc.k]={uid:u, raw:melhor.raw||melhor.desc, mes:melhor.mes};
        achados++; mudou=true;
      }
    });
    if(Object.keys(i.parcConc).length>=n){
      i.status='Conciliado'; i.conciliadoCom=n+' parcelas encontradas nas faturas'; i.conciliadoEm=new Date().toISOString();
    }
  });
  if(mudou) agLocalSave();
  return achados;
}
