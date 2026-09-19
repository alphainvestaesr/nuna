/* Chart.js entra de forma assincrona: se a CDN demorar ou estiver
   bloqueada, o dashboard carrega e funciona sem os graficos, e eles
   aparecem sozinhos quando a biblioteca chega. */
function nunaCarregarChart(){
  var s=document.createElement('script');
  s.src='https://cdn.jsdelivr.net/npm/chart.js@4.5.0/dist/chart.umd.js';
  s.async=true; s.crossOrigin='anonymous';
  s.integrity='sha384-iU8HYtnGQ8Cy4zl7gbNMOhsDTTKX02BTXptVP/vqAWIaTfM7isw76iyZCsjL2eVi';
  s.onload=function(){
    try{ if(typeof aplicarTema==='function') aplicarTema(); }catch(e){}
    try{ if(typeof dashboardPronto!=='undefined' && dashboardPronto && typeof renderAll==='function') renderAll(); }catch(e){}
  };
  s.onerror=function(){ console.warn('Chart.js nao carregou: o dashboard segue sem graficos.'); };
  document.head.appendChild(s);
}
/* so depois do load: assim a pagina termina de carregar mesmo que a CDN nao responda */
if(document.readyState==='complete') setTimeout(nunaCarregarChart,0);
else window.addEventListener('load', function(){ setTimeout(nunaCarregarChart,0) });
