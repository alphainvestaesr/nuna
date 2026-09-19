/* NuNa - theme.js: seletor Claro / Escuro / Automatico por horario */
/* ============ TEMA: Claro / Escuro / Automatico ============ */
var TEMA = { modo:'auto', timer:null };
function temaPorHora(){ var h=new Date().getHours(); return (h>=6 && h<18) ? 'light' : 'dark'; }
function temaEfetivo(){ return TEMA.modo==='claro' ? 'light' : TEMA.modo==='escuro' ? 'dark' : temaPorHora(); }
function aplicarTema(){
  var t=temaEfetivo();
  document.documentElement.setAttribute('data-theme', t);
  var hint=document.getElementById('theme-hint');
  if(hint){
    if(TEMA.modo==='auto'){
      var h=new Date().getHours(), hh=String(h).padStart(2,'0')+':'+String(new Date().getMinutes()).padStart(2,'0');
      hint.textContent = (t==='light'? 'Claro ate as 18h' : 'Escuro ate as 6h') + ' · agora ' + hh;
    } else hint.textContent = TEMA.modo==='claro' ? 'Fixo em claro' : 'Fixo em escuro';
  }
  atualizarCharts(t);
}
function atualizarCharts(t){
  if(typeof Chart==='undefined') return;
  Chart.defaults.color = t==='dark' ? '#B8B8B2' : '#52525B';
  Chart.defaults.borderColor = t==='dark' ? 'rgba(200,200,200,.14)' : 'rgba(0,0,0,.08)';
  [typeof donutChart!=='undefined'?donutChart:null, typeof barChart!=='undefined'?barChart:null,
   typeof saldoChart!=='undefined'?saldoChart:null, typeof contribChart!=='undefined'?contribChart:null,
   typeof trendChart!=='undefined'?trendChart:null].forEach(function(c){ if(c){ try{ c.update('none') }catch(e){} } });
}
function definirTema(modo){
  TEMA.modo=modo;
  Store.set(K.TEMA, modo);
  var sel=document.getElementById('theme-sel');
  if(sel) [].forEach.call(sel.children,function(b){ b.classList.toggle('on', b.dataset.t===modo) });
  aplicarTema();
  if(TEMA.timer){ clearInterval(TEMA.timer); TEMA.timer=null; }
  if(modo==='auto') TEMA.timer=setInterval(aplicarTema, 60000);
}
function wireTema(){
  var salvo='auto';
  var s=Store.get(K.TEMA,null); if(s==='claro'||s==='escuro'||s==='auto') salvo=s;
  var sel=document.getElementById('theme-sel');
  if(sel) sel.addEventListener('click',function(e){
    var b=e.target.closest('button'); if(!b) return; definirTema(b.dataset.t);
  });
  definirTema(salvo);
}
/* aplica antes do primeiro paint para nao piscar */
/* aplica antes do primeiro paint para nao piscar */
function preAplicarTema(){
  var s = Store.get(K.TEMA, 'auto');
  TEMA.modo = (s==='claro'||s==='escuro') ? s : 'auto';
  document.documentElement.setAttribute('data-theme', temaEfetivo());
}
