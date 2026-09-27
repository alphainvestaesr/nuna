/* ============================================================
   NuNa · ajuda.js — CENTRAL DE AJUDA (icone ao lado do sino)
   Lista os materiais de docs/materiais.json: PDFs, videos e links.
   Para incluir um material novo basta acrescentar um item no JSON:
   { id, tipo: "pdf" | "video" | "link", titulo, desc, url, data,
     perfis: null (todos) ou ["Ana"] / ["Manuela"] / ["NuNa"] }
   O pontinho no icone aparece enquanto houver material nao aberto
   neste aparelho.
   ============================================================ */
var AJ = { itens: [], carregado: false };
var AJ_VISTOS = 'nuna.ajuda.vistos';

function ajVistos() { try { return JSON.parse(localStorage.getItem(AJ_VISTOS) || '{}') || {}; } catch (e) { return {}; } }
function ajMarcar(id) { try { var v = ajVistos(); v[id] = 1; localStorage.setItem(AJ_VISTOS, JSON.stringify(v)); } catch (e) {} }
function ajCarregar() {
  return fetch('docs/materiais.json', { cache: 'no-cache' }).then(function (r) { return r.ok ? r.json() : []; })
    .catch(function () { return []; }).then(function (l) { AJ.itens = Array.isArray(l) ? l : []; AJ.carregado = true; ajRender(); });
}
function ajVisiveis() {
  var perfil = state.perfil;
  return AJ.itens.filter(function (i) { return !i.perfis || i.perfis.indexOf(perfil) >= 0; })
    .sort(function (a, b) { return String(b.data || '').localeCompare(String(a.data || '')); });
}
function ajYoutube(url) {
  var m = String(url).match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/);
  return m ? 'https://www.youtube-nocookie.com/embed/' + m[1] : null;
}
function ajIco(t) { return t === 'video' ? '&#127916;' : t === 'link' ? '&#128279;' : '&#128196;'; }
function ajData(d) { var p = String(d || '').split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : ''; }

/* junta Ajuda, sino e Sair num grupo so, lado a lado no topo */
function ajGrupo() {
  var sair = el('top-sair'); if (!sair) return;
  var g = el('top-acoes');
  if (!g) {
    g = document.createElement('div'); g.id = 'top-acoes';
    g.style.cssText = 'display:flex;align-items:center;gap:8px;flex:none;align-self:center';
    sair.parentNode.insertBefore(g, sair);
  }
  [el('aj-wrap'), el('vc-wrap'), sair].forEach(function (x) { if (x && x.parentNode !== g) g.appendChild(x); });
  if (el('vc-wrap')) el('vc-wrap').style.marginRight = '0';
}
function ajRender() {
  ajGrupo();
  var ref = el('vc-wrap') || el('top-sair'); if (!ref) return;
  var w = el('aj-wrap');
  if (!w) {
    w = document.createElement('div'); w.id = 'aj-wrap'; w.className = 'vc-wrap';
    w.innerHTML = '<button type="button" id="aj-btn" class="vc-bell aj-btn" aria-label="Central de Ajuda" title="Central de Ajuda: guias e v&iacute;deos">' +
      '<span class="vc-emo">&#128216;</span><span id="aj-dot" class="aj-dot" hidden></span></button><div id="aj-pop" class="vc-pop aj-pop" hidden></div>';
    ref.parentNode.insertBefore(w, ref);
    el('aj-btn').addEventListener('click', function (e) {
      e.stopPropagation();
      var p = el('aj-pop'), r = el('aj-btn').getBoundingClientRect(), wd = Math.min(340, window.innerWidth - 16);
      var vp = el('vc-pop'); if (vp) vp.hidden = true;
      p.style.width = wd + 'px'; p.style.top = Math.round(r.bottom + 8) + 'px';
      p.style.left = Math.round(Math.max(8, Math.min(r.right - wd, window.innerWidth - wd - 8))) + 'px';
      p.hidden = !p.hidden;
    });
    w.addEventListener('click', ajClique);
    document.addEventListener('click', function (e) { if (!e.target.closest('#aj-wrap')) { var p = el('aj-pop'); if (p) p.hidden = true; } });
    window.addEventListener('scroll', function () { var p = el('aj-pop'); if (p) p.hidden = true; }, { passive: true });
  }
  if (w.nextElementSibling !== ref) ref.parentNode.insertBefore(w, ref);
  ajGrupo();
  var l = ajVisiveis(), vistos = ajVistos();
  var novos = l.filter(function (i) { return !vistos[i.id]; }).length;
  el('aj-dot').hidden = !novos;
  el('aj-btn').classList.toggle('vc-on', true);
  el('aj-pop').innerHTML = '<div class="vc-h">Central de Ajuda</div>' + (l.length ? l.map(function (i) {
    var yt = i.tipo === 'video' ? ajYoutube(i.url) : null;
    var acoes = i.tipo === 'pdf'
      ? '<a class="aj-a" data-aj="' + esc(i.id) + '" href="' + esc(i.url) + '" target="_blank" rel="noopener">Abrir</a>' +
        '<a class="aj-a aj-sec" data-aj="' + esc(i.id) + '" href="' + esc(i.url) + '" download>Baixar</a>'
      : i.tipo === 'video'
        ? '<button type="button" class="aj-a" data-aj="' + esc(i.id) + '" data-play="' + esc(yt || i.url) + '" data-yt="' + (yt ? 1 : 0) + '">Assistir</button>'
        : '<a class="aj-a" data-aj="' + esc(i.id) + '" href="' + esc(i.url) + '" target="_blank" rel="noopener">Abrir</a>';
    return '<div class="aj-i"><div class="aj-ico">' + ajIco(i.tipo) + '</div><div class="aj-txt">' +
      '<div class="aj-t">' + esc(i.titulo || '') + (!vistos[i.id] ? ' <span class="aj-novo">novo</span>' : '') + '</div>' +
      (i.desc ? '<div class="aj-d">' + esc(i.desc) + '</div>' : '') +
      '<div class="aj-m">' + (i.tipo === 'pdf' ? 'PDF' : i.tipo === 'video' ? 'V&iacute;deo' : 'Link') + (i.data ? ' &middot; ' + ajData(i.data) : '') + '</div>' +
      '<div class="aj-acoes">' + acoes + '</div></div></div>';
  }).join('') : '<div class="vc-i"><span>Nenhum material ainda.</span></div>');
}
function ajClique(e) {
  var a = e.target.closest('[data-aj]'); if (!a) return;
  ajMarcar(a.dataset.aj);
  if (a.dataset.play) { e.preventDefault(); ajPlayer(a.dataset.play, a.dataset.yt === '1'); }
  setTimeout(ajRender, 50);
}
function ajPlayer(url, yt) {
  var m = el('aj-modal');
  if (!m) {
    m = document.createElement('div'); m.id = 'aj-modal'; m.className = 'aj-modal';
    m.addEventListener('click', function (e) { if (e.target === m || e.target.closest('.aj-x')) { m.hidden = true; m.querySelector('.aj-vid').innerHTML = ''; } });
    document.body.appendChild(m);
  }
  m.innerHTML = '<div class="aj-box"><button type="button" class="aj-x" aria-label="Fechar">&times;</button><div class="aj-vid">' +
    (yt ? '<iframe src="' + esc(url) + '?autoplay=1&rel=0" allow="autoplay; encrypted-media; fullscreen" allowfullscreen></iframe>'
        : '<video src="' + esc(url) + '" controls autoplay playsinline></video>') + '</div></div>';
  m.hidden = false; var p = el('aj-pop'); if (p) p.hidden = true;
}

(function () {
  window.addEventListener('load', function () {
    if (typeof renderAll === 'function') {
      var _ra = renderAll;
      renderAll = function () { var r = _ra.apply(this, arguments); try { if (AJ.carregado) ajRender(); } catch (e) { console.warn(e); } return r; };
    }
    ajCarregar();
  });
  var st = document.createElement('style');
  st.textContent = [
    '.aj-btn{filter:none;opacity:1}',
    '.aj-dot{position:absolute;top:-2px;right:-2px;width:10px;height:10px;border-radius:50%;background:var(--acc);border:2px solid var(--bg)}',
    '.aj-dot[hidden]{display:none}',
    '.aj-i{display:flex;gap:10px;padding:10px 6px;border-top:1px solid var(--border2)}',
    '.aj-ico{font-size:24px;line-height:1;flex:none}',
    '.aj-txt{min-width:0;flex:1}',
    '.aj-t{font-weight:700;font-size:14px}',
    '.aj-novo{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;padding:1px 6px;border-radius:99px;background:var(--acc);color:var(--card);vertical-align:1px}',
    '.aj-d{font-size:12px;color:var(--tx2);margin-top:2px;line-height:1.35}',
    '.aj-m{font-size:11px;color:var(--tx3);margin-top:3px}',
    '.aj-acoes{display:flex;gap:6px;margin-top:8px}',
    '.aj-a{font:inherit;font-size:12px;font-weight:700;padding:5px 12px;border-radius:999px;border:1px solid var(--acc);background:var(--acc);color:var(--card);text-decoration:none;cursor:pointer}',
    '.aj-sec{background:transparent;color:var(--acc)}',
    '.aj-modal{position:fixed;inset:0;z-index:90;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center;padding:16px}',
    '.aj-modal[hidden]{display:none}',
    '.aj-box{position:relative;width:min(960px,100%)}',
    '.aj-vid{position:relative;padding-top:56.25%;background:#000;border-radius:12px;overflow:hidden}',
    '.aj-vid iframe,.aj-vid video{position:absolute;inset:0;width:100%;height:100%;border:0}',
    '.aj-x{position:absolute;top:-40px;right:0;width:34px;height:34px;border-radius:50%;border:0;background:#fff;color:#000;font-size:22px;line-height:1;cursor:pointer}'
  ].join('');
  document.head.appendChild(st);
})();
