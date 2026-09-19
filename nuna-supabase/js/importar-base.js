/* ============================================================
   NuNa · importar-base.js — carga inicial da base no Supabase
   Rotina de uso unico: a usuaria logada escolhe o arquivo base.json
   que esta no computador dela e ele e gravado no banco (tabela
   base_documento). O arquivo NUNCA viaja dentro do repositorio.
   ============================================================ */
(function () {
  function montar() {
    var painel = document.getElementById('panel-dados');
    if (!painel || document.getElementById('ib-card')) return;

    var card = document.createElement('div');
    card.className = 'card';
    card.id = 'ib-card';
    card.innerHTML =
      '<h2>Base consolidada (carga inicial)</h2>' +
      '<p class="note" id="ib-estado" style="margin:0 0 14px"></p>' +
      '<div class="agform">' +
        '<label>Arquivo base.json do seu computador<input type="file" id="ib-file" accept=".json,application/json"></label>' +
      '</div>' +
      '<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-top:12px">' +
        '<button class="btn" id="ib-enviar" disabled>Enviar base para o banco</button>' +
        '<button class="pill" id="ib-baixar">Baixar a base que esta no banco</button>' +
      '</div>' +
      '<p class="note" id="ib-msg" style="margin-top:12px"></p>';
    painel.insertBefore(card, painel.firstChild);

    var arquivo = null;
    var bEnviar = document.getElementById('ib-enviar');
    var msg = document.getElementById('ib-msg');

    estado();
    function estado() {
      var b = Store.base();
      document.getElementById('ib-estado').innerHTML = b
        ? 'A base ja esta no banco e e a mesma para Ana e Manuela. Enviar outro arquivo <b>substitui</b> a base atual (as suas edicoes, lancamentos e orcamentos nao sao apagados).'
        : '<b>A base ainda nao foi importada.</b> O dashboard esta mostrando <b>dados ficticios de exemplo</b>. Escolha o arquivo <code>base.json</code> para carregar os dados reais no banco.';
    }

    document.getElementById('ib-file').addEventListener('change', function (e) {
      arquivo = e.target.files && e.target.files[0];
      bEnviar.disabled = !arquivo;
      msg.textContent = arquivo ? 'Arquivo selecionado: ' + arquivo.name : '';
    });

    bEnviar.addEventListener('click', function () {
      if (!arquivo) return;
      bEnviar.disabled = true;
      msg.textContent = 'Lendo o arquivo...';
      var fr = new FileReader();
      fr.onload = function () {
        var json;
        try { json = JSON.parse(fr.result); }
        catch (err) { msg.innerHTML = '<b>Arquivo invalido:</b> nao consegui ler o JSON.'; bEnviar.disabled = false; return; }
        if (!json || !json.monthOrder || !json.months) {
          msg.innerHTML = '<b>Este nao parece ser o base.json do NuNa</b> (faltam <code>monthOrder</code> e <code>months</code>).';
          bEnviar.disabled = false; return;
        }
        msg.textContent = 'Enviando para o banco...';
        Store.definirBase(json).then(function () {
          msg.innerHTML = '&#10003; Base gravada. Recarregando o dashboard...';
          setTimeout(function () { location.reload(); }, 900);
        }).catch(function (e) {
          console.error(e);
          msg.innerHTML = '<b>Nao consegui gravar:</b> ' + (e && e.message || e);
          bEnviar.disabled = false;
        });
      };
      fr.readAsText(arquivo);
    });

    document.getElementById('ib-baixar').addEventListener('click', function () {
      var b = Store.base();
      if (!b) { msg.textContent = 'Ainda nao existe base no banco.'; return; }
      var a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([JSON.stringify(b)], { type: 'application/json' }));
      a.download = 'base.json';
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    [800, 2000, 4000].forEach(function (t) { setTimeout(montar, t); });
  });
})();
