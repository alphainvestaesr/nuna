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
    var m = lsGet(LS.modo, 'auto');
    if (m === 'on') return true;
    if (m === 'off') return false;
    return standalone() || (window.matchMedia && matchMedia('(max-width: 820px)').matches);
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

  function montarBarra() {
    if ($('mbar')) return;
    var host = $('tela-app') || document.body;
    var bar = document.createElement('nav');
    bar.id = 'mbar'; bar.className = 'mbar'; bar.setAttribute('aria-label', 'Navegação rápida');
    bar.innerHTML =
      '<button data-k="inicio" aria-label="Início" title="Início">' + ICONES.inicio + '</button>' +
      '<button data-k="gastei" aria-label="Acabei de gastar" title="Acabei de gastar">' + ICONES.gastei + '</button>' +
      '<button data-k="notas" aria-label="Notas fiscais (QR Code)" title="Notas fiscais">' + ICONES.notas + '</button>' +
      '<button data-k="trans" aria-label="Transações" title="Transações">' + ICONES.trans + '</button>' +
      '<button data-k="mais" aria-label="Mais" title="Mais">' + ICONES.mais + '<span class="mb-pin" id="mb-pin" data-zero="1">0</span></button>';
    host.appendChild(bar);
    bar.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      var k = b.dataset.k;
      if (k === 'inicio') abrirAba('overview');
      else if (k === 'gastei') abrirGastei();
      else if (k === 'notas') { if (typeof ntAbrirLeitor === 'function') ntAbrirLeitor(); else abrirAba('notas'); return; }
      else if (k === 'trans') abrirAba('transactions');
      else if (k === 'mais') abrirSheet();
      window.scrollTo(0, 0);
    });
    montarSheet(host);
  }

  function marcarAtivo() {
    var bar = $('mbar'); if (!bar) return;
    var t = $('tabs') && $('tabs').querySelector('button.active'), tab = t ? t.dataset.tab : 'overview';
    var k = tab === 'overview' ? 'inicio' : tab === 'gastei' ? 'gastei' : tab === 'transactions' ? 'trans' : 'mais';
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

  function atualizarSheet() {
    var sh = $('msheet'); if (!sh) return;
    var modo = lsGet(LS.modo, 'auto');
    var tema = (typeof TEMA !== 'undefined' && TEMA.modo) ? TEMA.modo : 'auto';
    var rp = $('rev-pin'), rev = rp ? rp.textContent : '0';
    var instalado = standalone();
    sh.innerHTML =
      '<div class="grip"></div>' +
      '<h4>Ir para</h4>' +
      '<button class="mrow" data-go="budget">Orçamento</button>' +
      '<button class="mrow" data-go="review">Revisar' + (rev && rev !== '0' ? '<span class="pin" data-zero="0">' + rev + '</span>' : '') + '</button>' +
      '<button class="mrow" data-go="notas">Notas fiscais <small>lista e itens</small></button>' +
      '<button class="mrow" data-go="insights">Insights</button>' +
      '<button class="mrow" data-go="mvm">Mês vs Mês <small>histórico</small></button>' +
      '<button class="mrow" data-go="dados">Dados e receitas</button>' +
      '<h4>Visual do app neste aparelho</h4>' +
      '<div class="seg">' +
        ['auto:Automático', 'on:Ligado', 'off:Desligado'].map(function (x) { var p = x.split(':'); return '<button data-modo="' + p[0] + '"' + (modo === p[0] ? ' class="on"' : '') + '>' + p[1] + '</button>'; }).join('') +
      '</div>' +
      '<p class="mnote">Ligado mostra a barra inferior de ícones. Automático liga no celular e no app instalado.</p>' +
      '<h4>Tema</h4>' +
      '<div class="seg">' +
        ['claro:Claro', 'escuro:Escuro', 'auto:Auto'].map(function (x) { var p = x.split(':'); return '<button data-acao="tema" data-t="' + p[0] + '"' + (tema === p[0] ? ' class="on"' : '') + '>' + p[1] + '</button>'; }).join('') +
      '</div>' +
      (instalado ? '' :
        '<h4>App</h4><button class="mrow" data-acao="instalar">Instalar o NuNa neste aparelho <small>' + (promptInstalar ? 'pronto' : (ios() ? 'iPhone' : 'menu do navegador')) + '</small></button>') +
      '<h4>Conta</h4><button class="mrow" data-acao="sair">Sair</button>';
  }

  /* ---------- aba Notas (esqueleto: conteudo em notas.js) ---------- */
  function garantirAbaNotas() {
    var tabs = $('tabs'); if (!tabs || tabs.querySelector('[data-tab="notas"]')) return;
    var b = document.createElement('button'); b.dataset.tab = 'notas'; b.textContent = 'Notas'; b.hidden = true; /* escondida: acesso pelo QR da barra ou por "Mais" */
    var ref = tabs.querySelector('[data-tab="transactions"]');
    if (ref && ref.nextSibling) tabs.insertBefore(b, ref.nextSibling); else tabs.appendChild(b);
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
      var mq = matchMedia('(max-width: 820px)'); (mq.addEventListener ? mq.addEventListener('change', aplicarModo) : mq.addListener(aplicarModo));
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
