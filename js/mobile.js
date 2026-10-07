/* ============================================================
   NuNa · mobile.js
   1) Mes atual sempre em destaque; os outros meses ficam recolhidos
      atras do botao "Meses anteriores" (em todas as telas com meses).
   2) Cartoes secundarios da Visao Geral recolhidos (toque no titulo).
   3) Modo APP: barra inferior fixa so com icones (Inicio, Gastei, Notas,
      Transacoes, Mais), pensada para o polegar. Configuracao por aparelho:
      Automatico (celular ou app instalado) / Ligado / Desligado.
   4) Instalar no aparelho (Android: prompt nativo; iPhone: instrucao).
   Nada aqui grava no banco: so preferencias deste aparelho (localStorage).
   ============================================================ */
(function () {
  'use strict';
  var LS = { modo: 'nuna.appmode', fold: 'nuna.fold' };
  function lsGet(k, d) { try { var v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function $(id) { return document.getElementById(id); }

  /* ---------- mes atual ---------- */
  function mesAtualLabel() {
    var h = new Date();
    var lab = (typeof mesLabelDe === 'function') ? mesLabelDe(h.getFullYear(), h.getMonth() + 1) : null;
    if (lab && typeof MONTHS !== 'undefined' && MONTHS.indexOf(lab) >= 0) return lab;
    return (typeof MONTHS !== 'undefined' && MONTHS.length) ? MONTHS[MONTHS.length - 1] : lab;
  }
  window.mpMesAtual = mesAtualLabel;

  /* Ao abrir o app, comeca no mes atual (so na 1a carga: depois o usuario navega livremente,
     mesmo quando o Store recarrega do banco ao voltar o foco para a janela). */
  var mesInicialAplicado = false;
  if (typeof window.aplicarBase === 'function') {
    var _aplicar = window.aplicarBase;
    window.aplicarBase = function () {
      var r = _aplicar.apply(this, arguments);
      if (!mesInicialAplicado) {
        mesInicialAplicado = true;
        try { var m = mesAtualLabel(); if (m) { state.mes = m; state.txMes = m; } } catch (e) {}
      }
      return r;
    };
  }

  /* ---------- meses anteriores recolhidos ---------- */
  function colapsarMeses(node, cur) {
    if (!node) return;
    var atual = mesAtualLabel(), pills = [].slice.call(node.querySelectorAll('.pill:not(.mp-toggle)'));
    var velhos = 0;
    pills.forEach(function (b) {
      var manter = b.textContent === atual || b.classList.contains('on') || b.textContent === cur;
      b.classList.toggle('mp-old', !manter);
      if (!manter) velhos++;
    });
    var t = node.querySelector('.mp-toggle');
    if (t) t.remove();
    if (!velhos) { node.classList.remove('mp-open'); return; }
    t = document.createElement('button');
    t.className = 'pill mp-toggle';
    var aberto = node.classList.contains('mp-open');
    t.textContent = aberto ? 'Recolher meses ▴' : 'Meses anteriores ▾';
    t.onclick = function () { node.classList.toggle('mp-open'); colapsarMeses(node, cur); };
    node.appendChild(t);
  }
  window.mpColapsarMeses = colapsarMeses;
  if (typeof window.monthPills === 'function') {
    var _mp = window.monthPills;
    window.monthPills = function (node, cur) {
      var r = _mp.apply(this, arguments);
      try { colapsarMeses(node, cur); } catch (e) { console.warn('mobile/meses', e); }
      return r;
    };
  }

  /* ---------- cartoes recolhiveis ---------- */
  function dobras() { try { return JSON.parse(lsGet(LS.fold, '{}')) || {}; } catch (e) { return {}; } }
  var PADRAO_FECHADO = { 'collab-card': 1, 'rc-economia': 1 };
  function prepararDobras() {
    var alvos = [];
    var col = $('collab-card'); if (col) alvos.push([col, 'collab-card']);
    [].forEach.call(document.querySelectorAll('#panel-overview .card>h2'), function (h) {
      if (/Rastreador de Economia/i.test(h.textContent)) alvos.push([h.parentNode, 'rc-economia']);
    });
    var salvo = dobras();
    alvos.forEach(function (a) {
      var card = a[0], id = a[1];
      if (card.dataset.mpFold) return;
      card.dataset.mpFold = '1';
      var h2 = card.querySelector(':scope>h2'); if (!h2) return;
      card.classList.add('mp-fold');
      var fechado = (id in salvo) ? !!salvo[id] : !!PADRAO_FECHADO[id];
      card.classList.toggle('mp-closed', fechado);
      h2.addEventListener('click', function () {
        var f = card.classList.toggle('mp-closed'), s = dobras(); s[id] = f ? 1 : 0; lsSet(LS.fold, JSON.stringify(s));
      });
    });
  }

  /* ---------- modo APP ---------- */
  function standalone() {
    return (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
  }
  function modoEfetivo() {
    /* fixo: celulares, iPad e app instalado usam o visual APP; computador usa o visual normal */
    var mm = window.matchMedia ? function (q) { return matchMedia(q).matches; } : function () { return false; };
    return standalone() || ios() || mm('(max-width: 1024px)') || (mm('(pointer: coarse)') && Math.min(screen.width, screen.height) <= 1100);
  }
  function aplicarModo() {
    document.documentElement.classList.toggle('app-mode', modoEfetivo());
    atualizarSheet();
  }

  var ICONES = {
    inicio: '<svg viewBox="0 0 24 24"><path d="M3.5 11 12 4l8.5 7"/><path d="M5.5 9.8V20h13V9.8"/><path d="M10 20v-5.5h4V20"/></svg>',
    gastei: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7.5v9M7.5 12h9"/></svg>',
    notas: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1.3"/><rect x="14" y="3" width="7" height="7" rx="1.3"/><rect x="3" y="14" width="7" height="7" rx="1.3"/><rect class="fill" x="5.2" y="5.2" width="2.6" height="2.6"/><rect class="fill" x="16.2" y="5.2" width="2.6" height="2.6"/><rect class="fill" x="5.2" y="16.2" width="2.6" height="2.6"/><path d="M14 14h2.5v2.5H14zM18.5 14H21M14 19h2.5M18.5 17.5V21M21 17.5V21"/></svg>',
    trans: '<svg viewBox="0 0 24 24"><path d="M8.5 6.5H20M8.5 12H20M8.5 17.5H20"/><circle class="fill" cx="4.3" cy="6.5" r="1.2"/><circle class="fill" cx="4.3" cy="12" r="1.2"/><circle class="fill" cx="4.3" cy="17.5" r="1.2"/></svg>',
    orc: '<svg viewBox="0 0 24 24"><path d="M4 20V10M10 20V4M16 20v-7M21 20H3"/></svg>',
    mais2: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
    mais: '<svg viewBox="0 0 24 24"><circle class="fill" cx="5.5" cy="12" r="1.7"/><circle class="fill" cx="12" cy="12" r="1.7"/><circle class="fill" cx="18.5" cy="12" r="1.7"/></svg>'
  };
  window.NUNA_ICONE_QR = ICONES.notas;

  function abrirAba(tab) {
    var b = $('tabs') && $('tabs').querySelector('[data-tab="' + tab + '"]');
    if (b) b.click();
  }
  function abrirGastei() {
    var s = (window.Auth && Auth.sessao && Auth.sessao()) || {};
    if (state.perfil === 'NuNa' && s.perfil) {
      var p = document.querySelector('.prof[data-p="' + s.perfil + '"]'); if (p) p.click();
    }
    setTimeout(function () { var o = $('ag-open'); if (o) o.click(); }, 80);
  }

  function lerQR() { if (typeof ntAbrirLeitor === 'function') ntAbrirLeitor(); else abrirAba('notas'); }
  window.mpLerQR = lerQR;

  function montarBarra() {
    if ($('mbar')) return;
    var host = $('tela-app') || document.body;
    var bar = document.createElement('nav');
    bar.id = 'mbar'; bar.className = 'mbar'; bar.setAttribute('aria-label', 'Navegação rápida');
    /* Inicio · Transacoes · (+) · Orcamento · Mais — nome embaixo de cada icone */
    bar.innerHTML =
      '<button data-k="inicio">' + ICONES.inicio + '<span class="mb-lab">Início</span></button>' +
      '<button data-k="trans">' + ICONES.trans + '<span class="mb-lab">Transações</span></button>' +
      '<button data-k="gastei" aria-label="Novo gasto">' + ICONES.mais2 + '</button>' +
      '<button data-k="orc">' + ICONES.orc + '<span class="mb-lab">Orçamento</span></button>' +
      '<button data-k="mais">' + ICONES.mais + '<span class="mb-lab">Mais</span><span class="mb-pin" id="mb-pin" data-zero="1">0</span></button>';
    host.appendChild(bar);
    bar.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      var k = b.dataset.k;
      if (k === 'inicio') abrirAba('overview');
      else if (k === 'gastei') abrirGastei();
      else if (k === 'trans') abrirAba('transactions');
      else if (k === 'orc') abrirAba('budget');
      else if (k === 'mais') abrirSheet();
      window.scrollTo(0, 0);
    });
    montarSheet(host);
  }

  function marcarAtivo() {
    var bar = $('mbar'); if (!bar) return;
    var t = $('tabs') && $('tabs').querySelector('button.active'), tab = t ? t.dataset.tab : 'overview';
    var k = tab === 'overview' ? 'inicio' : tab === 'gastei' ? 'gastei' : tab === 'transactions' ? 'trans' : tab === 'budget' ? 'orc' : 'mais';
    [].forEach.call(bar.querySelectorAll('button'), function (b) { b.classList.toggle('on', b.dataset.k === k); });
    var rp = $('rev-pin'), mp = $('mb-pin');
    if (rp && mp) { mp.textContent = rp.textContent; mp.dataset.zero = rp.dataset.zero === '0' ? '0' : '1'; }
  }

  /* ---------- folha "Mais" ---------- */
  function montarSheet(host) {
    var bg = document.createElement('div'); bg.className = 'msheet-bg'; bg.id = 'msheet-bg';
    var sh = document.createElement('div'); sh.className = 'msheet'; sh.id = 'msheet'; sh.setAttribute('role', 'dialog'); sh.setAttribute('aria-label', 'Mais opções');
    host.appendChild(bg); host.appendChild(sh);
    bg.addEventListener('click', fecharSheet);
    sh.addEventListener('click', function (e) {
      var b = e.target.closest('[data-go],[data-modo],[data-acao]'); if (!b) return;
      if (b.dataset.go) { fecharSheet(); abrirAba(b.dataset.go); window.scrollTo(0, 0); }
      else if (b.dataset.modo) { lsSet(LS.modo, b.dataset.modo); aplicarModo(); }
      else if (b.dataset.acao === 'instalar') instalar();
      else if (b.dataset.acao === 'qr') { fecharSheet(); lerQR(); }
      else if (b.dataset.acao === 'sair') { fecharSheet(); var s = $('top-sair'); if (s) s.click(); }
      else if (b.dataset.acao === 'tema') { var t = document.querySelector('#theme-sel [data-t="' + b.dataset.t + '"]'); if (t) t.click(); atualizarSheet(); }
    });
    atualizarSheet();
  }
  function abrirSheet() { atualizarSheet(); $('msheet-bg').classList.add('open'); $('msheet').classList.add('open'); }
  function fecharSheet() { var b = $('msheet-bg'), s = $('msheet'); if (b) b.classList.remove('open'); if (s) s.classList.remove('open'); }

  var promptInstalar = null;
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); promptInstalar = e; atualizarSheet(); });
  window.addEventListener('appinstalled', function () { promptInstalar = null; atualizarSheet(); });
  function ios() { return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); }
  function instalar() {
    if (promptInstalar) { promptInstalar.prompt(); promptInstalar.userChoice.then(function () { promptInstalar = null; atualizarSheet(); }); return; }
    if (typeof flashToast === 'function') flashToast(ios() ? 'No iPhone: toque em Compartilhar e depois em Adicionar à Tela de Início.' : 'No menu do navegador, escolha Instalar app / Adicionar à tela inicial.');
  }

  function tile(go, nome, svg, pin) {
    return '<button class="mtile" data-go="' + go + '"><svg viewBox="0 0 24 24" aria-hidden="true">' + svg + '</svg><span>' + nome + '</span>' + (pin ? '<i class="pin">' + pin + '</i>' : '') + '</button>';
  }
  function atualizarSheet() {
    var sh = $('msheet'); if (!sh) return;
    var tema = (typeof TEMA !== 'undefined' && TEMA.modo) ? TEMA.modo : 'auto';
    var rp = $('rev-pin'), rev = rp ? rp.textContent : '0';
    var instalado = standalone();
    sh.innerHTML =
      '<div class="grip"></div>' +
      (instalado ? '' : '<button class="mrow mrow-inst" data-acao="instalar">Instalar o NuNa neste aparelho <small>' + (promptInstalar ? 'toque para instalar' : (ios() ? 'iPhone/iPad' : 'menu do navegador')) + '</small></button>') +
      '<div class="mgrid">' +
        tile('review', 'Revisar', '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l3 3 5-6"/>', (rev && rev !== '0') ? rev : '') +
        tile('mvm', 'Mês vs Mês', '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>') +
        '<button class="mtile" data-acao="qr">' + ICONES.notas + '<span>Ler nota (QR)</span></button>' +
        tile('insights', 'Insights', '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.3 1 2.5h6c0-1.2.3-1.8 1-2.5A6 6 0 0 0 12 3z"/>') +
        tile('dados', 'Dados', '<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"/>') +
        tile('notas', 'Notas', '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>') +
      '</div>' +
      '<div class="mfoot">' +
        '<button data-acao="tema" data-t="' + ({ claro: 'escuro', escuro: 'auto', auto: 'claro' }[tema] || 'claro') + '">Tema: ' + ({ claro: 'Claro', escuro: 'Escuro', auto: 'Auto' }[tema] || 'Auto') + '</button>' +
        '<button data-acao="sair">Sair</button>' +
      '</div>';
  }

  /* ---------- aba Notas (esqueleto: conteudo em notas.js) ---------- */
  function garantirAbaNotas() {
    var tabs = $('tabs'); if (!tabs || tabs.querySelector('[data-tab="notas"]')) return;
    var b = document.createElement('button'); b.dataset.tab = 'notas'; b.textContent = 'Notas'; b.hidden = true; /* escondida: acesso pelo QR da barra ou por "Mais" */
    tabs.appendChild(b); /* sempre a ultima */
    var ins = $('panel-insights');
    if (ins && !$('panel-notas')) {
      var p = document.createElement('div'); p.id = 'panel-notas'; p.className = 'panel';
      ins.parentNode.insertBefore(p, ins);
    }
    if (typeof PANEL_FNS !== 'undefined') PANEL_FNS.notas = ['ntRender'];
  }

  /* ---------- ligacao ---------- */
  function ligar() {
    garantirAbaNotas();
    montarBarra();
    aplicarModo();
    prepararDobras();
    marcarAtivo();
    var tabs = $('tabs');
    if (tabs && window.MutationObserver) {
      new MutationObserver(marcarAtivo).observe(tabs, { attributes: true, subtree: true, attributeFilter: ['class'] });
    }
    var rp = $('rev-pin');
    if (rp && window.MutationObserver) new MutationObserver(marcarAtivo).observe(rp, { childList: true, characterData: true, subtree: true, attributes: true });
    if (window.matchMedia) {
      var mq = matchMedia('(max-width: 1024px)'); (mq.addEventListener ? mq.addEventListener('change', aplicarModo) : mq.addListener(aplicarModo));
    }
  }
  if (typeof window.renderAll === 'function') {
    var _ra = window.renderAll;
    window.renderAll = function () { var r = _ra.apply(this, arguments); try { prepararDobras(); marcarAtivo(); } catch (e) {} return r; };
  }
  /* atalho do app instalado: app.html#notas abre direto a aba Notas quando o painel terminar de carregar */
  if (location.hash === '#notas') {
    var tent = 0, iv = setInterval(function () {
      var b = $('tabs') && $('tabs').querySelector('[data-tab="notas"]'), boot = $('boot');
      if (b && boot && boot.hidden) { clearInterval(iv); b.click(); }
      if (++tent > 60) clearInterval(iv);
    }, 500);
  }
  /* aplica o modo o quanto antes (evita piscar) e liga o resto quando o DOM estiver pronto */
  try { document.documentElement.classList.toggle('app-mode', modoEfetivo()); } catch (e) {}
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ligar); else ligar();
})();

/* NuNa · recolher alerta e lista de categorias no modo APP */
(function () {
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t.closest || !document.documentElement.classList.contains('app-mode')) return;
    if (t.closest('#agente-nuna > :first-child')) { document.documentElement.classList.toggle('ag-open'); return; }
    var s = t.closest('.split-donut');
    if (s && !t.closest('.legend')) s.classList.toggle('lg-open');
  });
})();

/* NuNa · blocos da Visao Geral recolhidos no modo APP (lembra a escolha neste aparelho) */
(function () {
  var CH = 'nuna_mp_fold2', PADRAO = { caixinha: 1, saldo: 1, divisao: 1 };
  function ler() { try { return JSON.parse(localStorage.getItem(CH) || '{}') || {}; } catch (e) { return {}; } }
  function gravar(s) { try { localStorage.setItem(CH, JSON.stringify(s)); } catch (e) {} }
  function ident(t) {
    t = (t || '').toLowerCase();
    if (/caixinha/.test(t)) return 'caixinha';
    if (/como o saldo/.test(t)) return 'saldo';
    if (/divis/.test(t)) return 'divisao';
    return null;
  }
  function preparar() {
    [].forEach.call(document.querySelectorAll('#panel-overview .card'), function (c) {
      if (c.dataset.mpF2) return;
      var h = c.querySelector('h2,h3'); if (!h) return;
      var k = ident(h.textContent); if (!k) return;
      var cab = h; while (cab.parentNode && cab.parentNode !== c) cab = cab.parentNode;
      if (cab.parentNode !== c) return;
      c.dataset.mpF2 = '1'; c.classList.add('mp-f2'); cab.classList.add('mp-h2x');
      var st = ler(); c.classList.toggle('mp-f2-closed', (k in st) ? !!st[k] : !!PADRAO[k]);
      cab.addEventListener('click', function () {
        var f = c.classList.toggle('mp-f2-closed'), s = ler(); s[k] = f ? 1 : 0; gravar(s);
      });
    });
  }
  if (typeof window.renderAll === 'function') {
    var ra = window.renderAll;
    window.renderAll = function () { var r = ra.apply(this, arguments); try { preparar(); } catch (e) {} return r; };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', preparar); else preparar();
})();

/* NuNa · botao + da barra: abre na hora o formulario de gasto (o mesmo da aba
   Acabei de Gastar, emprestado para a folha) com o valor ja em foco.
   Atalhos no topo: Ler nota (QR) e Contribuicao. Filtros das Transacoes. */
(function () {
  var $ = function (i) { return document.getElementById(i); };
  var marcador = null, card = null;
  function devolver() {
    if (card && marcador && marcador.parentNode) { marcador.parentNode.insertBefore(card, marcador); marcador.remove(); }
    marcador = null; if (card) card.classList.remove('mq-det');
  }
  function fechar() {
    var a = $('macts'), b = $('macts-bg'); if (a) a.classList.remove('open'); if (b) b.classList.remove('open');
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    setTimeout(function () { if (!$('macts') || !$('macts').classList.contains('open')) devolver(); }, 220);
  }
  window.mpFecharGasto = fechar;
  function montar() {
    if ($('macts')) return;
    var host = $('tela-app') || document.body;
    var bg = document.createElement('div'); bg.id = 'macts-bg'; bg.className = 'msheet-bg';
    var sh = document.createElement('div'); sh.id = 'macts'; sh.className = 'msheet'; sh.setAttribute('role', 'dialog'); sh.setAttribute('aria-label', 'Novo gasto');
    sh.innerHTML = '<div class="grip"></div>' +
      '<div class="mq-top"><b>Novo gasto</b>' +
        '<button type="button" data-a="qr">' + (window.NUNA_ICONE_QR || '') + 'Ler nota</button>' +
        '<button type="button" data-a="contrib">Contribuição</button>' +
        '<button type="button" data-a="x" aria-label="Fechar">×</button></div>' +
      '<div id="mq-form"></div>' +
      '<button type="button" class="mq-mais" data-a="det">Mais detalhes (data, parcelas, divisão…)</button>';
    host.appendChild(bg); host.appendChild(sh);
    bg.addEventListener('click', fechar);
    sh.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-a]'); if (!b) return;
      var a = b.dataset.a;
      if (a === 'x') return fechar();
      if (a === 'det') { if (card) card.classList.toggle('mq-det'); b.textContent = card && card.classList.contains('mq-det') ? 'Menos detalhes' : 'Mais detalhes (data, parcelas, divisão…)'; return; }
      if (a === 'qr') { fechar(); if (window.mpLerQR) mpLerQR(); return; }
      if (a === 'contrib') {
        fechar();
        var s = (window.Auth && Auth.sessao && Auth.sessao()) || {};
        var ativo = document.querySelector('.prof.on');
        if (ativo && ativo.dataset.p === 'NuNa' && s.perfil) { var p = document.querySelector('.prof[data-p="' + s.perfil + '"]'); if (p) p.click(); }
        setTimeout(function () { var o = $('ca-abrir'); if (o) o.click(); window.scrollTo(0, 0); }, 120);
      }
    });
  }
  function abrir() {
    montar();
    var desc = $('ag-desc'); card = card || (desc && desc.closest('.card'));
    if (card && !marcador) {
      marcador = document.createComment('form-gasto'); card.parentNode.insertBefore(marcador, card);
      $('mq-form').appendChild(card);
    }
    var bt = document.querySelector('#macts .mq-mais'); if (bt) bt.textContent = 'Mais detalhes (data, parcelas, divisão…)';
    $('macts').classList.add('open'); $('macts-bg').classList.add('open');
    /* foco dentro do proprio toque: no iPhone e o que faz o teclado abrir */
    var v = $('ag-valor'); if (v) try { v.focus({ preventScroll: true }); } catch (e) { v.focus(); }
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('.mbar button[data-k="gastei"]');
    if (!b || !document.documentElement.classList.contains('app-mode')) return;
    e.stopPropagation(); e.preventDefault();
    abrir();
  }, true);
  /* gasto salvo: fecha a folha */
  if (typeof window.agSalvarItem === 'function') {
    var _si = window.agSalvarItem;
    window.agSalvarItem = function () {
      var r = _si.apply(this, arguments);
      var sh = $('macts');
      if (sh && sh.classList.contains('open')) Promise.resolve(r).then(function () { fechar(); });
      return r;
    };
  }

  function filtros() {
    var i = $('tx-search'); if (!i || $('tx-fbtn')) return;
    var b = document.createElement('button'); b.type = 'button'; b.id = 'tx-fbtn'; b.textContent = 'Filtros'; i.after(b);
    function marca() {
      var t = [].some.call(document.querySelectorAll('#tx-months + div > select'), function (s) { return s.selectedIndex > 0; });
      b.classList.toggle('tem', t);
    }
    b.addEventListener('click', function () { document.documentElement.classList.toggle('tx-filtros'); });
    document.addEventListener('change', marca); marca();
  }
  if (typeof window.renderAll === 'function') {
    var ra = window.renderAll;
    window.renderAll = function () { var r = ra.apply(this, arguments); try { filtros(); } catch (e) {} return r; };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', filtros); else filtros();
})();

/* NuNa · toque no lancamento abre os campos de edicao (cartao) */
(function () {
  document.addEventListener('click', function (e) {
    if (!document.documentElement.classList.contains('app-mode')) return;
    var tr = e.target.closest && e.target.closest('#tx-months ~ .scroll tbody tr');
    if (!tr || e.target.closest('select,option,button,a,input,td:nth-child(11)')) return;
    tr.classList.toggle('tx-open');
  });
})();

/* NuNa · resumo da nota logo depois de ler o QR (loja, total e itens) */
(function () {
  var $ = function (i) { return document.getElementById(i); };
  function esc2(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function fechar() { var a = $('nres'), b = $('nres-bg'); if (a) a.classList.remove('open'); if (b) b.classList.remove('open'); }
  function mostrar(n) {
    var itens = n.itens || [];
    var quando = n.data_emissao ? new Date(n.data_emissao).toLocaleDateString('pt-BR') : (n.mes_ref || '');
    var nome = n.emitente || 'Nota ' + String(n.chave).slice(-8);
    var bg = $('nres-bg'), sh = $('nres');
    if (!bg) {
      bg = document.createElement('div'); bg.id = 'nres-bg'; bg.className = 'nres-bg'; bg.addEventListener('click', fechar); document.body.appendChild(bg);
      sh = document.createElement('div'); sh.id = 'nres'; sh.className = 'nres'; document.body.appendChild(sh);
    }
    sh.innerHTML = '<div class="grip"></div><div class="nres-cab"><div><div class="nres-loja">' + esc2(nome) + '</div><div class="nres-meta">' + esc2(quando) + ' · ' + itens.length + ' itens</div></div><div class="nres-tot">' + (n.total != null ? brl(+n.total) : '—') + '</div></div>' +
      (window.ntCatHtml ? window.ntCatHtml(n) : '') + '<div class="nres-itens">' + (itens.length ? itens.map(function (i) {
        return '<div class="nres-it"><span>' + esc2(i.desc) + '<small>' + (Math.round((+i.qtd || 0) * 1000) / 1000) + ' ' + esc2(i.un || '') + ' × ' + brl(+i.unit || 0) + (window.ntCmpHtml ? window.ntCmpHtml(n, i) : '') + '</small></span><b>' + brl(+i.total || 0) + '</b></div>';
      }).join('') : '<p class="note">' + esc2(n.erro || 'Nenhum item reconhecido.') + '</p>') + '</div>' +
      '<div class="nres-bt"><button type="button" data-r="ver">Ver notas</button><button type="button" class="pri" data-r="ok">Pronto</button></div>';
    sh.querySelector('[data-r="ok"]').onclick = fechar;
    sh.querySelector('[data-r="ver"]').onclick = function () { fechar(); var b = document.querySelector('#tabs [data-tab="notas"]'); if (b) b.click(); };
    requestAnimationFrame(function () { sh.classList.add('open'); bg.classList.add('open'); });
  }
  function duplicada(n) {
    if (navigator.vibrate) try { navigator.vibrate([120, 60, 120]); } catch (e) {}
    var quando = n.data_emissao ? new Date(n.data_emissao).toLocaleDateString('pt-BR') : (n.mes_ref || '');
    var lida = n.criado_em ? new Date(n.criado_em).toLocaleDateString('pt-BR') : '';
    var bg = $('nres-bg'), sh = $('nres');
    if (!bg) {
      bg = document.createElement('div'); bg.id = 'nres-bg'; bg.className = 'nres-bg'; bg.addEventListener('click', fechar); document.body.appendChild(bg);
      sh = document.createElement('div'); sh.id = 'nres'; sh.className = 'nres'; document.body.appendChild(sh);
    }
    sh.innerHTML = '<div class="grip"></div><div class="nres-alerta">Nota fiscal repetida — não foi cadastrada de novo.</div>' +
      '<div class="nres-cab"><div><div class="nres-loja">' + esc2(n.emitente || 'Nota ' + String(n.chave).slice(-8)) + '</div><div class="nres-meta">' + esc2(quando) + ' · ' + (n.itens || []).length + ' itens' + (n.lida_por ? ' · lida por ' + esc2(n.lida_por) : '') + (lida ? ' em ' + esc2(lida) : '') + '</div></div><div class="nres-tot">' + (n.total != null ? brl(+n.total) : '—') + '</div></div>' +
      '<div class="nres-bt" style="margin-top:12px"><button type="button" data-r="ver">Ver esta nota</button><button type="button" class="pri" data-r="ok">Entendi</button></div>';
    sh.querySelector('[data-r="ok"]').onclick = fechar;
    sh.querySelector('[data-r="ver"]').onclick = function () { fechar(); var b = document.querySelector('#tabs [data-tab="notas"]'); if (b) b.click(); };
    requestAnimationFrame(function () { sh.classList.add('open'); bg.classList.add('open'); });
  }
  function ligar() {
    if (typeof window.ntSalvarNota !== 'function' || window.ntSalvarNota.__res) return;
    var orig = window.ntSalvarNota;
    var novo = function (chave, url) {
      var self = this, args = arguments;
      var pre = (typeof window.ntCarregar === 'function') ? Promise.resolve(window.ntCarregar(true)).catch(function () {}) : Promise.resolve();
      return pre.then(function () {
        var ex = (window.NT && NT.lista || []).filter(function (x) { return x.chave === chave && x.status === 'lida'; })[0];
        if (ex) { duplicada(ex); return; }
        var p = orig.apply(self, args);
        return Promise.resolve(p).then(function () {
        try {
          var n = (window.NT && NT.lista || []).filter(function (x) { return x.chave === chave; })[0];
          if (n) mostrar(n);
        } catch (e) {}
      });
      });
    };
    novo.__res = 1; window.ntSalvarNota = novo;
  }
  ligar(); document.addEventListener('DOMContentLoaded', ligar); window.addEventListener('load', ligar);
})();

/* NuNa · Orcamento e Revisar no celular: abrem sempre no mes atual, com seletor ‹ mes › */
(function () {
  var $ = function (i) { return document.getElementById(i); };
  var LONGO = { Jan: 'Janeiro', Fev: 'Fevereiro', Mar: 'Março', Abr: 'Abril', Mai: 'Maio', Jun: 'Junho', Jul: 'Julho', Ago: 'Agosto', Set: 'Setembro', Out: 'Outubro', Nov: 'Novembro', Dez: 'Dezembro' };
  function app() { return document.documentElement.classList.contains('app-mode'); }
  function atual() { return (window.mpMesAtual && mpMesAtual()) || MONTHS[MONTHS.length - 1]; }
  function nomeLongo(m) {
    if (m === '__all') return 'Todos os meses';
    var p = String(m).split('/'), ano = p[1] ? '20' + p[1] : '2026';
    return (LONGO[p[0]] || p[0]) + ' ' + ano;
  }
  window.mpNomeMes = nomeLongo;

  /* ‹ Outubro 2026 › — o nome do meio abre a lista de meses do aparelho */
  function seletor(id, antesDe, valor, comTodos, aoMudar) {
    var box = $(id);
    if (!box) {
      box = document.createElement('div'); box.id = id; box.className = 'mmes';
      antesDe.parentNode.insertBefore(box, antesDe);
    }
    var lista = (comTodos ? ['__all'] : []).concat(MONTHS), i = lista.indexOf(valor);
    var hoje = atual();
    box.innerHTML =
      '<button type="button" class="mmes-seta" data-d="-1" aria-label="Mês anterior"' + (i <= (comTodos ? 1 : 0) ? ' disabled' : '') + '>‹</button>' +
      '<label class="mmes-nome"><span>' + nomeLongo(valor) + (valor === hoje ? ' <em>mês atual</em>' : '') + '</span>' +
        '<select aria-label="Escolher mês">' + lista.map(function (m) {
          return '<option value="' + m + '"' + (m === valor ? ' selected' : '') + '>' + nomeLongo(m) + (m === hoje ? ' (atual)' : '') + '</option>';
        }).join('') + '</select></label>' +
      '<button type="button" class="mmes-seta" data-d="1" aria-label="Próximo mês"' + (i < 0 || i >= lista.length - 1 ? ' disabled' : '') + '>›</button>' +
      (valor !== hoje ? '<button type="button" class="mmes-hoje">Hoje</button>' : '');
    box.querySelector('select').onchange = function () { aoMudar(this.value); };
    [].forEach.call(box.querySelectorAll('.mmes-seta'), function (b) {
      b.onclick = function () { var n = lista[(i < 0 ? lista.indexOf(hoje) : i) + (+b.dataset.d)]; if (n && n !== '__all') aoMudar(n); };
    });
    var h = box.querySelector('.mmes-hoje'); if (h) h.onclick = function () { aoMudar(hoje); };
  }
  window.mpSeletorMes = seletor;

  /* ao abrir a aba (pela barra, pelo Mais ou pelo menu), volta para o mes atual */
  var mesOrc = null;
  window.mpMesOrc = function () { return mesOrc && DATA && DATA.months[mesOrc] ? mesOrc : atual(); };
  function ligarAbas() {
    var tabs = $('tabs'); if (!tabs || tabs.dataset.mpMes) return;
    tabs.dataset.mpMes = '1';
    tabs.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b || !app()) return;
      if (b.dataset.tab === 'review') state.revMes = atual();
      if (b.dataset.tab === 'budget') mesOrc = atual();
    }, true);
  }

  /* Revisar: seletor no lugar das pilulas de mes */
  if (typeof window.renderReview === 'function') {
    var _rr = window.renderReview;
    window.renderReview = function () {
      var r = _rr.apply(this, arguments);
      try {
        var pills = $('rev-months');
        if (app() && pills) seletor('rev-mmes', pills, state.revMes, true, function (m) { state.revMes = m; renderReview(); });
      } catch (e) { console.warn('mobile/rev-mes', e); }
      return r;
    };
  }

  /* Orcamento: no celular as contas e os status seguem o mes escolhido aqui,
     sem mexer no mes da tela Inicio */
  window.mpRenderBudget = function () {
    if (!app()) { rodarRender('renderBudgetTable'); rodarRender('renderBudgetInsight'); return; }
    var m = window.mpMesOrc(), antes = state.mes;
    state.mes = m;
    try { rodarRender('renderBudgetTable'); rodarRender('renderBudgetInsight'); if (window.mpRenderOrcCel) rodarRender('mpRenderOrcCel'); }
    finally { state.mes = antes; }
    var alvo = $('mbd') || $('orc-renda') || $('bd-cards');
    if (alvo) seletor('bd-mmes', alvo, m, false, function (n) { mesOrc = n; mpRenderBudget(); });
  };
  if (typeof PANEL_FNS !== 'undefined') PANEL_FNS.budget = ['mpRenderBudget'];

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ligarAbas); else ligarAbas();
})();

/* NuNa · Revisar no celular: lista enxuta para dar conta de centenas de pendentes.
   - iguais agrupados (ex.: 7x iFood) com um toque para conferir o grupo todo
   - um toque no ✓ confere; "Desfazer" no aviso
   - toque no lancamento abre os campos para corrigir
   - mostra 40 por vez (a tela nao trava) */
(function () {
  var $ = function (i) { return document.getElementById(i); };
  var abertos = {}, limite = 40, agrupar = true, ultimoMes = null;
  function app() { return document.documentElement.classList.contains('app-mode'); }
  function chaveDesc(t) {
    return String(t.desc || t.raw || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/\(\d+\/\d+\)/g, '').replace(/[0-9*#.\-\/]+/g, ' ').replace(/\s+/g, ' ').trim() || '?';
  }
  function dia(t) { return String(t.data || '').slice(0, 5); }
  function catDe(t) { return t.grupo ? 'Conjunto · ' + t.grupo + (t.sub ? ' › ' + t.sub : '') : (t.plano || 'sem categoria') + (t.sub ? ' › ' + t.sub : ''); }
  function fonteCurta(t) { return String(t.fonteLabel || '').replace(/^Cartao\s+/i, '').replace(/\s*\((Ana|Manuela)\)$/, ''); }
  function chave(t) { return t._m + '|' + t.id; }

  function editor(t) {
    return '<div class="mr-ed">' +
      '<label>Divisão<select class="c-dv"><option value="INDIVIDUAL"' + (t.divisao === 'INDIVIDUAL' ? ' selected' : '') + '>Individual</option><option value="CONJUNTA"' + (t.divisao === 'CONJUNTA' ? ' selected' : '') + '>Conjunta</option></select></label>' +
      (t.divisao === 'CONJUNTA'
        ? '<label>Grupo do conjunto<select class="c-grupo" data-perfil="NuNa" data-vazio="1">' + catOptsHTML('NuNa', t.grupo, t.grupo ? t.sub : '', { novo: true, vazio: true }) + '</select></label>'
        : '') +
      '<label>Categoria de ' + esc(t.perfil) + '<select class="c-plano" data-perfil="' + esc(t.perfil) + '">' + catOptsHTML(t.perfil, t.plano, t.grupo ? '' : t.sub, { novo: true }) + '</select></label>' +
      '<label>Tipo<select class="c-tipo">' + tipoOpts(t.tipo) + '</select></label>' +
      '<div class="mr-raw">' + esc(t.raw || '') + ' · ' + esc(t.fonteLabel || '') + '</div>' +
      '</div>';
  }
  function item(t, noGrupo) {
    var k = chave(t), ab = !!abertos[k];
    return '<div class="mr-it' + (ab ? ' open' : '') + '" data-id="' + esc(k) + '">' +
      '<div class="mr-l" data-abre="' + esc(k) + '">' +
        '<div class="mr-meta">' + dia(t) + ' · ' + esc(fonteCurta(t)) + (t.perfil ? ' · ' + esc(t.perfil) : '') + (t.possivelDup ? ' · <b class="mr-dup">poss. dup.</b>' : '') + '</div>' +
        (noGrupo ? '' : '<div class="mr-desc">' + esc(t.desc) + '</div>') +
        '<div class="mr-cat">' + esc(catDe(t)) + ' <span>✎</span></div>' +
      '</div>' +
      '<div class="mr-r"><b>' + brl(t.valor) + '</b><button type="button" class="mr-ok" data-ok="' + esc(k) + '" aria-label="Conferido">✓</button></div>' +
      (ab ? editor(t) : '') +
    '</div>';
  }
  function grupo(g) {
    var k = 'g:' + g.k, ab = !!abertos[k], tot = g.l.reduce(function (s, t) { return s + t.valor; }, 0);
    var cats = {}; g.l.forEach(function (t) { cats[catDe(t)] = 1; });
    var cs = Object.keys(cats), mesmoPerfil = g.l.every(function (t) { return t.perfil === g.l[0].perfil; });
    return '<div class="mr-grp' + (ab ? ' open' : '') + '">' +
      '<div class="mr-it mr-gh">' +
        '<div class="mr-l" data-abre="' + esc(k) + '">' +
          '<div class="mr-meta">' + g.l.length + ' iguais · toque para ver</div>' +
          '<div class="mr-desc">' + esc(g.l[0].desc) + '</div>' +
          '<div class="mr-cat">' + (cs.length === 1 ? esc(cs[0]) : cs.length + ' categorias diferentes') + '</div>' +
        '</div>' +
        '<div class="mr-r"><b>' + brl(tot) + '</b><button type="button" class="mr-ok mr-okg" data-okg="' + esc(g.k) + '" aria-label="Conferir os ' + g.l.length + '">✓ ' + g.l.length + '</button></div>' +
      '</div>' +
      (ab ? '<div class="mr-gcorpo">' +
        (mesmoPerfil ? '<label class="mr-todos" data-grp="' + esc(g.k) + '">Categoria para os ' + g.l.length + '<select class="mr-gcat" data-perfil="' + esc(g.l[0].perfil) + '"><option value="">escolher…</option>' + catOptsHTML(g.l[0].perfil, '', '', {}) + '</select></label>' : '') +
        g.l.map(function (t) { return item(t, true); }).join('') + '</div>' : '') +
    '</div>';
  }

  var ULT = [], VIS = [];
  /* lancamentos que estao na tela (para "Confirmar todos os visiveis") */
  window.mpRevVisiveis = function () { return VIS.filter(function (t) { return t.revisar; }); };
  function montar() {
    var host = $('mrev'), tabela = $('rev-table');
    if (!tabela) return;
    if (!host) {
      host = document.createElement('div'); host.id = 'mrev';
      var sc = tabela.closest('.scroll') || tabela; sc.parentNode.insertBefore(host, sc);
      ligar(host);
    }
    if (ultimoMes !== state.revMes) { ultimoMes = state.revMes; limite = 40; }
    var list = revList(); ULT = list; VIS = [];
    /* cabecalho: quanto falta no mes */
    var ms = state.revMes === '__all' ? MONTHS : [state.revMes], noMes = 0;
    ms.forEach(function (m) { if (DATA.months[m]) DATA.months[m].transactions.forEach(function (t) { if (revVisivel(t)) noMes++; }); });
    var feitos = Math.max(0, noMes - list.length), pct = noMes ? Math.round(feitos / noMes * 100) : 100;
    var tot = list.reduce(function (s, t) { return s + t.valor; }, 0);
    var h = '<div class="mr-head"><div><b>' + list.length + '</b> a conferir <span>· ' + brl(tot) + '</span></div><div class="mr-pct">' + pct + '% conferido</div></div>' +
      '<div class="mr-bar"><i style="width:' + pct + '%"></i></div>' +
      '<div class="mr-modo"><button type="button" data-modo="g" class="' + (agrupar ? 'on' : '') + '">Agrupar iguais</button><button type="button" data-modo="v" class="' + (agrupar ? '' : 'on') + '">Maiores primeiro</button></div>';
    if (!list.length) {
      host.innerHTML = h + '<div class="mr-vazio">Tudo conferido ' + (state.revMes === '__all' ? '' : 'em ' + mpNomeMes(state.revMes)) + ' ✓</div>';
      return;
    }
    var ent = [];
    if (agrupar) {
      var gs = {}, ordem = [];
      list.forEach(function (t) { var k = chaveDesc(t); if (!gs[k]) { gs[k] = []; ordem.push(k); } gs[k].push(t); });
      ordem.forEach(function (k) {
        var l = gs[k];
        if (l.length > 1) ent.push({ k: k, l: l, v: l.reduce(function (s, t) { return s + t.valor; }, 0) });
        else ent.push({ t: l[0], v: l[0].valor });
      });
      ent.sort(function (a, b) { return b.v - a.v; });
    } else ent = list.map(function (t) { return { t: t, v: t.valor }; });
    var vis = ent.slice(0, limite);
    vis.forEach(function (e) { VIS = VIS.concat(e.l || [e.t]); });
    h += vis.map(function (e) { return e.l ? grupo(e) : item(e.t); }).join('');
    if (ent.length > limite) h += '<button type="button" class="mr-mais">Mostrar mais ' + Math.min(40, ent.length - limite) + ' (faltam ' + (ent.length - limite) + ')</button>';
    host.innerHTML = h;
  }

  function conferir(lista) {
    lista.forEach(function (t) { t.revisar = false; salvarOverride(t); });
    desfazerAviso(lista);
    renderReview(); renderAll(true);
  }
  var avisoT = null;
  function desfazerAviso(lista) {
    var a = $('mr-toast'); if (a) a.remove(); clearTimeout(avisoT);
    a = document.createElement('div'); a.id = 'mr-toast'; a.className = 'mr-toast';
    a.innerHTML = '<span>' + (lista.length === 1 ? 'Conferido: ' + esc(lista[0].desc) : lista.length + ' lançamentos conferidos') + '</span><button type="button">Desfazer</button>';
    a.querySelector('button').onclick = function () {
      lista.forEach(function (t) { t.revisar = true; salvarOverride(t); });
      a.remove(); renderReview(); renderAll(true);
    };
    document.body.appendChild(a);
    avisoT = setTimeout(function () { a.remove(); }, 5000);
  }
  function ligar(host) {
    host.addEventListener('click', function (e) {
      var b;
      if ((b = e.target.closest('[data-ok]'))) { var t = findTx(b.dataset.ok); if (!t) return; var it = b.closest('.mr-it'); it.classList.add('saindo'); setTimeout(function () { conferir([t]); }, 160); return; }
      if ((b = e.target.closest('[data-okg]'))) { var l = ULT.filter(function (t) { return chaveDesc(t) === b.dataset.okg; }); b.closest('.mr-grp').classList.add('saindo'); setTimeout(function () { conferir(l); }, 160); return; }
      if ((b = e.target.closest('[data-modo]'))) { agrupar = b.dataset.modo === 'g'; limite = 40; montar(); return; }
      if (e.target.closest('.mr-mais')) { limite += 40; montar(); return; }
      if (e.target.closest('.mr-ed,.mr-todos')) return;
      if ((b = e.target.closest('[data-abre]'))) { var k = b.dataset.abre; if (abertos[k]) delete abertos[k]; else abertos[k] = 1; montar(); }
    });
    host.addEventListener('change', function (e) {
      var s = e.target;
      if (s.classList.contains('mr-gcat')) {
        if (!s.value || s.value === '__novo__') return;
        var k = s.closest('[data-grp]').dataset.grp;
        var alvo = { value: s.value, classList: { contains: function (c) { return c === 'c-plano'; } } };
        var l = ULT.filter(function (t) { return chaveDesc(t) === k; });
        l.forEach(function (t) { applyEdit({ dataset: { id: chave(t) } }, alvo); });
        flashToast('Categoria trocada em ' + l.length + ' lançamentos.');
        renderReview(); renderAll(true);
        return;
      }
      var it = s.closest('.mr-it'); if (!it) return;
      applyEdit(it, s);
      renderReview(); renderAll(true);
    });
  }

  if (typeof window.renderReview === 'function') {
    var _rr = window.renderReview;
    window.renderReview = function () {
      var r = _rr.apply(this, arguments);
      try { if (app()) montar(); } catch (e) { console.warn('mobile/revisar', e); }
      return r;
    };
  }
})();

/* NuNa · Orcamento no celular: um cartao por categoria com barra e status do mes escolhido.
   Toque no cartao para mudar a meta. Mesmas regras de status do computador. */
(function () {
  var $ = function (i) { return document.getElementById(i); };
  var aberto = null;
  var COR = { ok: 'var(--pos)', warn: '#d49a1e', bad: 'var(--neg)', neu: 'var(--tx3)' };
  function num(v) { return parseFloat(String(v).replace(/\./g, '').replace(',', '.')) || 0; }
  window.mpRenderOrcCel = function () {
    var panel = $('panel-budget'); if (!panel || !DATA) return;
    var host = $('mbd');
    if (!host) {
      host = document.createElement('div'); host.id = 'mbd';
      panel.insertBefore(host, panel.firstChild);
      host.addEventListener('click', function (e) {
        if (e.target.closest('.mo-ed')) return;
        var c = e.target.closest('[data-cat]'); if (!c) return;
        aberto = aberto === c.dataset.cat ? null : c.dataset.cat; mpRenderBudget();
        if (aberto) { var i = host.querySelector('.mo-ed input'); if (i) i.focus(); }
      });
      host.addEventListener('change', function (e) {
        var i = e.target.closest('.mo-ed input'); if (!i) return;
        var p = state.perfil; DATA.budgets[p] = DATA.budgets[p] || {};
        DATA.budgets[p][i.dataset.c] = num(i.value); salvarOrcamentos();
        flashToast('Meta de ' + i.dataset.c + ': ' + brl(num(i.value)) + ' por mês.');
        aberto = null; mpRenderBudget();
      });
    }
    var p = state.perfil, m = state.mes, B = (DATA.budgets && DATA.budgets[p]) || {};
    var T = typeof agtTotais === 'function' ? agtTotais(m, p) : {};
    var frac = typeof agtFrac === 'function' ? agtFrac(m) : 1;
    var prev = typeof mesPrevisao === 'function' && mesPrevisao(m);
    var FIX = window.ORC_FIXAS || {}, MET = window.ORC_METAS || {}, FORA = window.ORC_FORA || {};
    var cats = {}; Object.keys(B).forEach(function (c) { if (+B[c]) cats[c] = 1; }); Object.keys(T).forEach(function (c) { if (T[c]) cats[c] = 1; });
    var linhas = [], cont = { ok: 0, warn: 0, bad: 0 }, somaB = 0, somaG = 0;
    Object.keys(cats).forEach(function (c) {
      if (p !== 'NuNa' && FORA[c]) return;
      var b = +B[c] || 0, g = T[c] || 0, pct = b ? g / b : (g ? 9 : 0), st, lab;
      if (prev) { st = 'neu'; lab = 'previsão'; }
      else if (MET[c]) { st = g >= b && b ? 'ok' : 'warn'; lab = g >= b && b ? 'meta atingida' : 'guardando'; }
      else if (FIX[c]) { st = 'neu'; lab = 'fixa'; }
      else if (!b) { st = g ? 'warn' : 'neu'; lab = 'sem meta'; }
      else if (pct > 1) { st = 'bad'; lab = 'estourou'; }
      else if (pct >= 0.9 || (frac !== null && frac < 1 && pct > frac + 0.15)) { st = 'warn'; lab = 'atenção'; }
      else { st = 'ok'; lab = 'no alvo'; }
      if (!prev && !MET[c] && !FIX[c] && b) cont[st]++;
      if (!MET[c]) { somaB += b; somaG += g; }
      linhas.push({ c: c, b: b, g: g, pct: pct, st: st, lab: lab, ord: st === 'bad' ? 3 : st === 'warn' ? 2 : st === 'ok' ? 1 : 0 });
    });
    linhas.sort(function (x, y) { return (y.ord - x.ord) || (y.pct - x.pct) || (y.g - x.g); });
    var ptot = somaB ? somaG / somaB : 0, stTot = ptot > 1 ? 'bad' : ptot >= 0.9 ? 'warn' : 'ok';
    var marca = frac !== null && frac < 1 ? '<s style="left:' + (frac * 100).toFixed(1) + '%" title="hoje"></s>' : '';
    var h = '<div class="mo-tot">' +
      '<div class="mo-tl"><span>Gasto em ' + mpNomeMes(m).split(' ')[0] + '</span><b>' + brl(somaG) + '</b></div>' +
      '<div class="mo-tl mo-sub"><span>de ' + brl(somaB) + ' orçados</span><span style="color:' + COR[stTot] + '">' +
        (somaB ? (somaG <= somaB ? 'sobram ' + brl(somaB - somaG) : 'passou ' + brl(somaG - somaB)) : '') + '</span></div>' +
      '<div class="mo-bar big"><i style="width:' + Math.min(100, ptot * 100).toFixed(1) + '%;background:' + COR[stTot] + '"></i>' + marca + '</div>' +
      (prev ? '<div class="mo-chips"><span>Mês de previsão: só parcelas já comprometidas</span></div>' :
      '<div class="mo-chips"><span class="ok">' + cont.ok + ' no alvo</span><span class="warn">' + cont.warn + ' atenção</span><span class="bad">' + cont.bad + ' estourou</span></div>') +
      (marca ? '<div class="mo-hoje">A linha marca o dia de hoje no mês.</div>' : '') +
      '</div>';
    h += linhas.map(function (l) {
      var w = l.b ? Math.min(100, l.pct * 100) : (l.g ? 100 : 0);
      var resto = l.b ? (l.g <= l.b ? 'sobram ' + brl(l.b - l.g) : 'passou ' + brl(l.g - l.b)) : 'toque para definir uma meta';
      return '<div class="mo-c' + (aberto === l.c ? ' open' : '') + '" data-cat="' + esc(l.c) + '">' +
        '<div class="mo-l1"><span class="mo-nome"><i style="background:' + colorOf(l.c) + '"></i>' + esc(l.c) + '</span><span class="mo-st mo-' + l.st + '">' + l.lab + '</span></div>' +
        '<div class="mo-bar"><i style="width:' + w.toFixed(1) + '%;background:' + COR[l.st] + '"></i>' + (l.b ? marca : '') + '</div>' +
        '<div class="mo-l2"><span><b>' + brl(l.g) + '</b>' + (l.b ? ' de ' + brl(l.b) : '') + '</span><span>' + (l.b ? Math.round(l.pct * 100) + '% · ' : '') + resto + '</span></div>' +
        (aberto === l.c ? '<label class="mo-ed">Meta por mês (R$)<input type="text" inputmode="decimal" data-c="' + esc(l.c) + '" value="' + l.b.toFixed(2).replace('.', ',') + '"></label>' : '') +
      '</div>';
    }).join('') || '<p class="note">Sem gastos nem metas neste mês.</p>';
    host.innerHTML = h;
  };
})();
