/* ============================================================
   NuNa · motorista.js
   1) PAINEL DO MOTORISTA (so no perfil da Ana)
      Lucro real de Uber, 99 e BlaBlaCar por mes:
      receita de cada app (lancada aqui ou em Dados > Receitas, com o
      nome do app na descricao)
      - custos diretos 100%: Carro > Gasolina/Uber e assinatura BlaBlaCar
      - custos do carro divididos por % ajustavel: lava jato,
        manutencao, seguro, IPVA & licenciamento
   2) SININHO DE VENCIMENTOS no topo: Bradesco vence dia 03,
      Inter dia 21. Aceso quando alguma fatura vence em ate 7 dias.
   ============================================================ */
var MT_APPS = [
  { id: 'Uber', re: /\buber\b/i },
  { id: '99', re: /(^|\W)99(\W|$)|99pop|99 ?app/i },
  { id: 'BlaBlaCar', re: /bla ?bla/i }
];
var MT_DIRETOS = ['Gasolina/Uber'];
var MT_RATEIO = ['Lava jato', 'Manutenção', 'Seguro', 'IPVA & Licenciamento'];
var MT_UID = '__motorista__';

function mtCfg() {
  var o = (Store.get(K.OVERRIDES, {}) || {})[MT_UID] || {};
  return { pct: typeof o.pct === 'number' ? o.pct : 50 };
}
function mtSalvarCfg(c) {
  var ov = Store.get(K.OVERRIDES, {}) || {};
  ov[MT_UID] = { pct: c.pct, atualizadoEm: new Date().toISOString() };
  Store.set(K.OVERRIDES, ov);
}
function mtAppDe(desc) {
  for (var i = 0; i < MT_APPS.length; i++) if (MT_APPS[i].re.test(String(desc || ''))) return MT_APPS[i].id;
  return null;
}
function mtEhPrev(m) { return typeof mesPrevisao === 'function' && mesPrevisao(m); }

/* numeros de um mes */
function mtMes(m) {
  var mm = DATA.months[m] || {}, pct = mtCfg().pct / 100;
  var r = { m: m, apps: {}, receita: 0, gas: 0, bla: 0, rateioBase: 0, rateio: 0, semSub: 0 };
  (mm.receitaItens || []).forEach(function (i) {
    if (i.perfil !== 'Ana') return;
    var a = mtAppDe(i.desc); if (!a) return;
    r.apps[a] = (r.apps[a] || 0) + i.valor; r.receita += i.valor;
  });
  mesTx(m).forEach(function (t) {
    if (t.perfil !== 'Ana' || t.contrib || t.grupo) return;
    if (/bla ?bla/i.test(t.raw || t.desc)) { r.bla += t.valor; return; }
    if (t.plano !== 'Carro') return;
    if (MT_DIRETOS.indexOf(t.sub) >= 0) r.gas += t.valor;
    else if (MT_RATEIO.indexOf(t.sub) >= 0) r.rateioBase += t.valor;
    else if (!t.sub && t.tipo === 'Gasolina') r.semSub += t.valor;
  });
  r.rateio = r.rateioBase * pct;
  r.custo = r.gas + r.bla + r.rateio;
  r.lucro = r.receita - r.custo;
  r.margem = r.receita ? r.lucro / r.receita : null;
  return r;
}
function mtMeses() {
  return MONTHS.filter(function (m) { return !mtEhPrev(m); }).map(mtMes)
    .filter(function (x) { return x.receita || x.custo; });
}

/* ---------- painel no Mes vs Mes ---------- */
function mtHost() {
  var p = el('panel-mvm'); if (!p) return null;
  var h = el('mt-painel');
  if (!h) {
    h = document.createElement('div'); h.id = 'mt-painel'; h.className = 'card mt-card';
    var ref = el('pc-painel');
    if (ref && ref.parentNode === p) p.insertBefore(h, ref.nextSibling);
    else p.insertBefore(h, p.querySelector('footer'));
    h.addEventListener('click', mtClique);
    h.addEventListener('change', function (e) {
      if (e.target.id === 'mt-pct') {
        var v = Math.max(0, Math.min(100, parseInt(e.target.value, 10) || 0));
        mtSalvarCfg({ pct: v }); renderMotorista(); try { renderMotoristaCard(); } catch (x) {}
      }
    });
  }
  return h;
}
function mtClique(e) {
  if (e.target.id === 'mt-add') mtLancar();
}
function renderMotorista() {
  var h = mtHost(); if (!h) return;
  if (state.perfil !== 'Ana') { h.hidden = true; return; }
  h.hidden = false;
  var meses = mtMeses(), cfg = mtCfg();
  var atual = mtMes(state.mes && !mtEhPrev(state.mes) ? state.mes : (meses.length ? meses[meses.length - 1].m : MONTHS[0]));
  var ult3 = meses.filter(function (x) { return x.receita; }).slice(-3);
  var med = ult3.length ? ult3.reduce(function (s, x) { return s + x.lucro; }, 0) / ult3.length : null;

  var hoje = typeof rcMesPadrao === 'function' ? rcMesPadrao() : state.mes;
  var opM = (typeof rcMesesDisponiveis === 'function' ? rcMesesDisponiveis() : MONTHS).filter(function (m) { return !mtEhPrev(m) || m === hoje; })
    .map(function (m) { return '<option value="' + esc(m) + '"' + (m === hoje ? ' selected' : '') + '>' + esc(pcMesNome(m)) + '</option>'; }).join('');
  var form = '<div class="mt-form">' +
    '<select id="mt-app">' + MT_APPS.map(function (a) { return '<option>' + a.id + '</option>'; }).join('') + '</select>' +
    '<select id="mt-mes">' + opM + '</select>' +
    '<input id="mt-valor" type="text" inputmode="decimal" placeholder="R$ ganho no m&ecirc;s">' +
    '<button type="button" class="btn" id="mt-add">Lan&ccedil;ar ganho</button></div>';

  var cor = function (v) { return v >= 0 ? 'var(--pos)' : 'var(--neg)'; };
  var hero = atual.receita || atual.custo
    ? '<div class="mt-hero"><div><div class="mt-big" style="color:' + cor(atual.lucro) + '">' + brl(atual.lucro) + '</div>' +
      '<div class="mt-hsub">lucro real em ' + esc(pcMesNome(atual.m)) + (atual.margem !== null ? ' &middot; margem <b>' + Math.round(atual.margem * 100) + '%</b>' : '') +
      (med !== null ? '<br>m&eacute;dia dos &uacute;ltimos ' + ult3.length + ' meses: <b>' + brl(med) + '</b>' : '') + '</div></div>' +
      '<div class="mt-conta">' +
        '<div><span>Ganhos' + (Object.keys(atual.apps).length ? ' (' + Object.keys(atual.apps).map(function (a) { return a + ' ' + brl(atual.apps[a]); }).join(' &middot; ') + ')' : '') + '</span><b>' + brl(atual.receita) + '</b></div>' +
        '<div><span>&minus; Gasolina/Uber</span><b>' + brl(atual.gas) + '</b></div>' +
        '<div><span>&minus; Assinatura BlaBlaCar</span><b>' + brl(atual.bla) + '</b></div>' +
        '<div><span>&minus; Carro (' + cfg.pct + '% de ' + brl(atual.rateioBase) + ')</span><b>' + brl(atual.rateio) + '</b></div>' +
        '<div class="mt-tot"><span>= Lucro real</span><b style="color:' + cor(atual.lucro) + '">' + brl(atual.lucro) + '</b></div></div></div>'
    : '<p class="note" style="margin:4px 0 10px">Ainda n&atilde;o h&aacute; ganhos nem custos de app em ' + esc(pcMesNome(atual.m)) + '. Lance o que recebeu de cada app abaixo.</p>';

  var avisos = [];
  if (atual.semSub > 0) avisos.push('<b>' + brl(atual.semSub) + '</b> de gasolina em ' + esc(pcMesNome(atual.m)) + ' est&aacute; sem subcategoria. Marque como <b>Carro › Gasolina/Uber</b> na aba Transa&ccedil;&otilde;es o que foi do app.');
  if (atual.custo > 0 && !atual.receita) avisos.push('H&aacute; custo de app em ' + esc(pcMesNome(atual.m)) + ', mas nenhum ganho lan&ccedil;ado.');

  var max = meses.reduce(function (m, x) { return Math.max(m, Math.abs(x.lucro), x.receita); }, 0) || 1;
  var barras = meses.map(function (x) {
    return '<div class="mt-col" title="' + esc(pcMesNome(x.m)) + ': ganhos ' + brl(x.receita) + ', custos ' + brl(x.custo) + ', lucro ' + brl(x.lucro) + '">' +
      '<span class="mt-val" style="color:' + cor(x.lucro) + '">' + (Math.abs(x.lucro) >= 1000 ? (x.lucro / 1000).toFixed(1).replace('.', ',') + 'k' : Math.round(x.lucro)) + '</span>' +
      '<span class="mt-pair"><span class="mt-b mt-rec" style="height:' + Math.round(x.receita / max * 100) + '%"></span>' +
      '<span class="mt-b mt-cus" style="height:' + Math.round(x.custo / max * 100) + '%"></span></span>' +
      '<span class="mt-mes">' + pcMesCurto(x.m) + '</span></div>';
  }).join('');

  h.innerHTML =
    '<div class="mt-top"><span class="mt-tag">Painel do Motorista</span><span class="mt-apps">Uber &middot; 99 &middot; BlaBlaCar</span></div>' +
    hero +
    (avisos.length ? '<ul class="pc-als">' + avisos.map(function (a) { return '<li class="pc-al pc-al-warn">' + a + '</li>'; }).join('') + '</ul>' : '') +
    (meses.length ? '<div class="pc-h3">M&ecirc;s a m&ecirc;s <span class="mt-leg"><i class="mt-rec"></i>ganhos <i class="mt-cus"></i>custos &middot; n&uacute;mero = lucro</span></div><div class="mt-time">' + barras + '</div>' : '') +
    '<div class="pc-h3">Lan&ccedil;ar ganho de um app</div>' + form +
    '<div class="mt-cfg"><label>Parte do carro usada no app: <input id="mt-pct" type="number" min="0" max="100" step="5" value="' + cfg.pct + '">%</label>' +
    '<span>vale para lava jato, manuten&ccedil;&atilde;o, seguro e IPVA. Gasolina/Uber e BlaBlaCar entram 100%.</span></div>';
}

/* lanca o ganho como receita da Ana (soma na receita do mes), sem recarregar a pagina */
function mtLancar() {
  var app = el('mt-app').value, m = el('mt-mes').value, v = rcNum(el('mt-valor').value);
  if (!(v > 0)) { flashToast('Informe quanto recebeu do ' + app + '.'); el('mt-valor').focus(); return; }
  if (!Store.base()) { flashToast('A base ainda nao foi importada.'); return; }
  var b = rcBaseClone(); rcGarantirMes(b, m);
  var mm = b.months[m]; mm.receitaItens = mm.receitaItens || [];
  var temItens = mm.receitaItens.some(function (i) { return i.perfil === 'Ana'; });
  var temCC = (mm.contracheques || []).length > 0, antigo = (mm.receita || {}).Ana || 0;
  if (!temItens && !temCC && antigo > 0)
    mm.receitaItens.push({ id: 'r' + Date.now().toString(36) + 'a', perfil: 'Ana', valor: antigo, desc: 'Valor já registrado antes', origem: 'anterior', criadoEm: new Date().toISOString() });
  mm.receitaItens.push({ id: 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), perfil: 'Ana', valor: rcArred(v), desc: app, origem: 'app', criadoEm: new Date().toISOString() });
  rcRecalcular(mm, 'Ana');
  Promise.resolve(Store.definirBase(b)).then(function () {
    flashToast(app + ': ' + brl(v) + ' em ' + pcMesNome(m) + '. Receita do mes: ' + brl(mm.receita.Ana) + '.');
    if (typeof recarregarDoBanco === 'function') recarregarDoBanco();
  });
}

/* ---------- chamada na Visao Geral (so Ana) ---------- */
function renderMotoristaCard() {
  var b = el('mt-banner');
  if (state.perfil !== 'Ana') { if (b) b.hidden = true; return; }
  var ref = el('pc-banner'); var anchor = (ref && !ref.hidden) ? ref : (el('donut') && el('donut').closest('#panel-overview > *'));
  if (!anchor) return;
  if (!b) {
    b = document.createElement('button'); b.type = 'button'; b.id = 'mt-banner'; b.className = 'pc-banner mt-banner';
    b.addEventListener('click', function () {
      var t = el('tabs').querySelector('[data-tab="mvm"]'); if (t) t.click();
      var n = 0; (function vai() { var p = el('mt-painel'); if (p && p.offsetParent) { p.scrollIntoView({ behavior: 'smooth', block: 'start' }); p.classList.add('pc-flash'); setTimeout(function () { p.classList.remove('pc-flash'); }, 1600); return; } if (++n < 30) setTimeout(vai, 80); })();
    });
  }
  if (b.previousElementSibling !== anchor) anchor.parentNode.insertBefore(b, anchor.nextSibling);
  b.hidden = false;
  var m = state.mes && !mtEhPrev(state.mes) ? state.mes : null, x = m ? mtMes(m) : null;
  var sub = x && (x.receita || x.custo)
    ? 'ganhos ' + brl(x.receita) + ' &middot; custos ' + brl(x.custo) + (x.margem !== null ? ' &middot; margem ' + Math.round(x.margem * 100) + '%' : '')
    : 'lance os ganhos de Uber, 99 e BlaBlaCar para ver o lucro real';
  b.innerHTML =
    '<span class="pc-b-ico" aria-hidden="true"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 17h14M6 17l1.5-5h9L18 17"/><circle cx="8" cy="17.5" r="1.8"/><circle cx="16" cy="17.5" r="1.8"/><path d="M8.5 12l1.2-3h4.6l1.2 3"/></svg></span>' +
    '<span class="pc-b-txt"><span class="pc-b-lab">Motorista &middot; ' + (m ? esc(pcMesNome(m)) : '') + '</span>' +
    '<span class="pc-b-val" style="color:' + (x && x.lucro < 0 ? 'var(--neg)' : 'var(--pos)') + '">' + (x && (x.receita || x.custo) ? brl(x.lucro) + ' <small style="font-size:12px;font-weight:600;color:var(--tx3)">lucro real</small>' : '&mdash;') + '</span>' +
    '<span class="pc-b-sub">' + sub + '</span></span><span class="pc-b-go">Ver painel &rarr;</span>';
}

/* ============ SININHO DE VENCIMENTOS ============ */
var VC_DIAS = [{ re: /bradesco/i, dia: 3 }, { re: /inter/i, dia: 21 }];
function vcDia(fonte) { for (var i = 0; i < VC_DIAS.length; i++) if (VC_DIAS[i].re.test(fonte)) return VC_DIAS[i].dia; return null; }
function vcLista() {
  if (!DATA || !DATA.months) return [];
  var hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  var fontes = {};
  MONTHS.slice(-4).forEach(function (m) { mesTx(m).forEach(function (t) { if (vcDia(t.fonteLabel) && /^(cart|banco inter)/i.test(t.fonteLabel)) fontes[t.fonteLabel] = 1; }); });
  return Object.keys(fontes).filter(function (f) {
    if (state.perfil === 'NuNa') return true;
    return f.indexOf('(' + state.perfil + ')') >= 0;
  }).map(function (f) {
    var d = vcDia(f), v = new Date(hoje.getFullYear(), hoje.getMonth(), d);
    if (v < hoje) v = new Date(hoje.getFullYear(), hoje.getMonth() + 1, d);
    var lab = mesLabelDe(v.getFullYear(), v.getMonth() + 1);
    var tot = DATA.months[lab] ? mesTx(lab).filter(function (t) { return t.fonteLabel === f && !t.contrib; }).reduce(function (s, t) { return s + t.valor; }, 0) : 0;
    var dias = Math.round((v - hoje) / 864e5);
    return { fonte: f, data: v, dias: dias, valor: tot, mes: lab };
  }).sort(function (a, b) { return a.data - b.data; });
}
function vcRender() {
  var sair = el('top-sair'); if (!sair) return;
  var w = el('vc-wrap');
  if (!w) {
    w = document.createElement('div'); w.id = 'vc-wrap'; w.className = 'vc-wrap';
    w.innerHTML = '<button type="button" id="vc-bell" class="vc-bell" aria-label="Vencimentos"><span class="vc-emo">&#128276;</span><span id="vc-n" class="vc-n"></span></button><div id="vc-pop" class="vc-pop" hidden></div>';
    sair.parentNode.insertBefore(w, sair);
    el('vc-bell').addEventListener('click', function (e) {
      e.stopPropagation(); var p = el('vc-pop'), r = el('vc-bell').getBoundingClientRect();
      p.style.top = Math.round(r.bottom + 8) + 'px';
      var w = Math.min(300, window.innerWidth - 16); p.style.width = w + 'px'; p.style.right = 'auto';
      p.style.left = Math.round(Math.max(8, Math.min(r.right - w, window.innerWidth - w - 8))) + 'px';
      p.hidden = !p.hidden;
    });
    window.addEventListener('scroll', function () { var p = el('vc-pop'); if (p) p.hidden = true; }, { passive: true });
    document.addEventListener('click', function (e) { if (!e.target.closest('#vc-wrap')) el('vc-pop').hidden = true; });
  }
  var l = vcLista(), perto = l.filter(function (x) { return x.dias <= 7; });
  var n = el('vc-n'); n.textContent = perto.length || ''; n.hidden = !perto.length;
  el('vc-bell').classList.toggle('vc-on', perto.length > 0);
  el('vc-bell').title = perto.length ? perto.length + ' fatura' + (perto.length > 1 ? 's vencem' : ' vence') + ' em até 7 dias' : 'Nenhuma fatura vencendo nos próximos 7 dias';
  var dd = function (d) { return ('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2); };
  el('vc-pop').innerHTML = '<div class="vc-h">Vencimentos</div>' + (l.length ? l.map(function (x) {
    var q = x.dias === 0 ? 'hoje' : x.dias === 1 ? 'amanh&atilde;' : 'em ' + x.dias + ' dias';
    return '<div class="vc-i' + (x.dias <= 7 ? ' vc-perto' : '') + '"><div><b>' + esc(x.fonte.replace(/^Cartao |^Banco /, '')) + '</b><br><span>vence ' + dd(x.data) + ' &middot; ' + q + '</span></div>' +
      '<div class="vc-v">' + (x.valor ? brl(x.valor) : '<span style="opacity:.6">sem fatura</span>') + '</div></div>';
  }).join('') : '<div class="vc-i"><span>Nenhum cart&atilde;o com vencimento conhecido.</span></div>') +
    '<div class="vc-nota">Valor = fatura importada + parcelas previstas + ACABEI DE GASTAR daquele m&ecirc;s.</div>';
}

/* ---------- ligacoes ---------- */
(function () {
  if (typeof PANEL_FNS !== 'undefined') {
    if (PANEL_FNS.mvm.indexOf('renderMotorista') < 0) PANEL_FNS.mvm.push('renderMotorista');
    if (PANEL_FNS.overview.indexOf('renderMotoristaCard') < 0) PANEL_FNS.overview.push('renderMotoristaCard');
  }
  window.addEventListener('load', function () {
    if (typeof renderAll === 'function') {
      var _ra = renderAll;
      renderAll = function () { var r = _ra.apply(this, arguments); try { vcRender(); } catch (e) { console.warn(e); } return r; };
    }
  });
})();

(function () {
  var st = document.createElement('style');
  st.textContent = [
    '.mt-card{position:relative;border:1.5px solid var(--pos);background:linear-gradient(180deg,var(--posL) 0,var(--card) 150px);overflow:hidden}',
    '.mt-card::before{content:"";position:absolute;left:0;top:0;right:0;height:4px;background:linear-gradient(90deg,var(--pos),var(--acc))}',
    '.mt-top{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px}',
    '.mt-tag{font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--pos)}',
    '.mt-apps{font-size:12px;color:var(--tx3)}',
    '.mt-hero{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.2fr);gap:18px;align-items:start;margin-bottom:12px}',
    '@media (max-width:640px){.mt-hero{grid-template-columns:1fr}}',
    '.mt-big{font-size:clamp(30px,6vw,44px);font-weight:800;letter-spacing:-.02em;line-height:1;font-variant-numeric:tabular-nums}',
    '.mt-hsub{font-size:13px;color:var(--tx2);margin-top:6px;line-height:1.45}',
    '.mt-conta{font-size:13px;border:1px solid var(--border);border-radius:10px;padding:8px 12px;background:var(--card)}',
    '.mt-conta>div{display:flex;justify-content:space-between;gap:10px;padding:3px 0;font-variant-numeric:tabular-nums}',
    '.mt-conta span{color:var(--tx2)}',
    '.mt-tot{border-top:1px solid var(--border);margin-top:4px;padding-top:6px!important}',
    '.mt-tot span{color:var(--tx)!important;font-weight:700}',
    '.mt-time{display:flex;align-items:flex-end;gap:8px;height:150px;overflow-x:auto;padding-top:4px}',
    '.mt-col{flex:1 0 40px;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%;gap:4px}',
    '.mt-pair{display:flex;align-items:flex-end;gap:3px;height:100%;width:100%;justify-content:center}',
    '.mt-b{width:14px;border-radius:4px 4px 1px 1px;min-height:2px}',
    '.mt-rec{background:var(--pos)}.mt-cus{background:var(--neg);opacity:.75}',
    '.mt-val{font-size:11px;font-weight:700;font-variant-numeric:tabular-nums}',
    '.mt-mes{font-size:11px;color:var(--tx3);white-space:nowrap}',
    '.mt-leg{font-weight:400;text-transform:none;letter-spacing:0;margin-left:8px}',
    '.mt-leg i{display:inline-block;width:9px;height:9px;border-radius:2px;margin:0 4px 0 8px;vertical-align:-1px}',
    '.mt-form{display:flex;gap:8px;flex-wrap:wrap}',
    '.mt-form select,.mt-form input{font:inherit;font-size:13px;padding:7px 10px;border-radius:8px;border:1px solid var(--border);background:var(--card);color:var(--tx)}',
    '.mt-form input{flex:1 1 140px;min-width:0}',
    '.mt-cfg{display:flex;gap:6px 12px;flex-wrap:wrap;align-items:center;font-size:12px;color:var(--tx3);margin-top:14px;padding-top:10px;border-top:1px dashed var(--border)}',
    '.mt-cfg label{color:var(--tx2);font-size:13px}',
    '.mt-cfg input{width:64px;font:inherit;font-size:13px;padding:4px 6px;border-radius:6px;border:1px solid var(--border);background:var(--card);color:var(--tx);text-align:right}',
    '.mt-banner{border-color:var(--pos);background:linear-gradient(90deg,var(--posL),var(--card))}',
    '.mt-banner::before{background:linear-gradient(180deg,var(--pos),var(--acc))}',
    '.mt-banner .pc-b-lab,.mt-banner .pc-b-ico,.mt-banner .pc-b-go{color:var(--pos)}',
    '.vc-wrap{position:relative;flex:none;align-self:center;margin-right:8px}',
    '.vc-bell{position:relative;font-size:18px;line-height:1;background:transparent;border:1px solid var(--border);border-radius:999px;width:36px;height:36px;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;filter:grayscale(1);opacity:.55}',
    '.vc-bell.vc-on{filter:none;opacity:1;border-color:var(--acc)}',
    '.vc-n{position:absolute;top:-4px;right:-4px;min-width:17px;height:17px;border-radius:9px;background:var(--neg);color:#fff;font-size:10px;font-weight:800;display:flex;align-items:center;justify-content:center;padding:0 4px}',
    '.vc-n[hidden]{display:none}',
    '.vc-pop{position:fixed;z-index:60;width:min(300px,86vw);background:var(--card);border:1px solid var(--border);border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.18);padding:8px}',
    '.vc-h{font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--tx3);padding:4px 6px 6px}',
    '.vc-i{display:flex;justify-content:space-between;gap:10px;align-items:center;font-size:13px;padding:8px 6px;border-top:1px solid var(--border2)}',
    '.vc-i span{font-size:12px;color:var(--tx3)}',
    '.vc-perto{background:var(--accL);border-radius:8px}',
    '.vc-perto span{color:var(--amb);font-weight:600}',
    '.vc-v{font-weight:700;white-space:nowrap;font-variant-numeric:tabular-nums}',
    '.vc-nota{font-size:11px;color:var(--tx3);padding:6px 6px 2px}'
  ].join('');
  document.head.appendChild(st);
})();
