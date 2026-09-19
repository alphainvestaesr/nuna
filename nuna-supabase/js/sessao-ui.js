(function(){
  function nomeNoTopo(){
    var s = (window.Auth && Auth.sessao && Auth.sessao()) || null;
    var alvo = document.getElementById('top-sessao');
    if (alvo && s) alvo.innerHTML = 'Conectada como <b style="color:var(--acc)">' + s.nome + '</b>';
  }
  function filtrar(){
    var s = (window.Auth && Auth.sessao && Auth.sessao()) || null;
    if (!s || !s.perfil) return;
    [].forEach.call(document.querySelectorAll('#profsel .prof'), function(b){
      b.hidden = (b.dataset.p !== 'NuNa' && b.dataset.p !== s.perfil);
    });
  }
  document.addEventListener('DOMContentLoaded', function(){
    [250, 900, 2000].forEach(function(t){ setTimeout(function(){ filtrar(); nomeNoTopo(); }, t) });
  });
})();
