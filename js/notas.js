/* ============================================================
   NuNa · notas.js — Notas fiscais (NFC-e): leitor de QR Code / codigo de barras
   e acompanhamento dos itens comprados.
   - Camera do aparelho (BarcodeDetector; se nao existir, biblioteca ZXing).
   - QR Code da NFC-e traz o link da nota: a funcao do Supabase "nfce-buscar"
     abre o link na SEFAZ e devolve emitente, data, total e itens.
   - Codigo de barras traz so a chave de acesso (44 digitos): a nota fica
     registrada (loja, mes, UF) e os itens dependem do QR Code.
   - Tabela public.notas_fiscais (RLS por household). Nao mexe na base do app.
   ============================================================ */
var NT = { lista: [], carregado: false, carregando: false, mes: null, erro: null, montado: false };
var NT_UF = { '11': 'RO', '12': 'AC', '13': 'AM', '14': 'RR', '15': 'PA', '16': 'AP', '17': 'TO', '21': 'MA', '22': 'PI', '23': 'CE', '24': 'RN', '25': 'PB', '26': 'PE', '27': 'AL', '28': 'SE', '29': 'BA', '31': 'MG', '32': 'ES', '33': 'RJ', '35': 'SP', '41': 'PR', '42': 'SC', '43': 'RS', '50': 'MS', '51': 'MT', '52': 'GO', '53': 'DF' };
var NT_ZXING = 'https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js';

function ntCli() { return window.Auth && Auth.cliente ? Auth.cliente() : null; }
function ntSessao() { return (window.Auth && Auth.sessao && Auth.sessao()) || {}; }

/* ---------- chave de acesso ---------- */
function ntChaveValida(c) {
  if (!/^\d{44}$/.test(c)) return false;
  var soma = 0, peso = 2;
  for (var i = 42; i >= 0; i--) { soma += (+c[i]) * peso; peso = peso === 9 ? 2 : peso + 1; }
  var r = soma % 11, dv = r < 2 ? 0 : 11 - r;
  return dv === +c[43];
}
function ntFormatCnpj(c) { return c.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5'); }
function ntInfoChave(c) {
  var aa = c.slice(2, 4), mm = c.slice(4, 6);
  return { uf: NT_UF[c.slice(0, 2)] || c.slice(0, 2), cnpj: c.slice(6, 20), mes_ref: '20' + aa + '-' + mm };
}
/* aceita: link do QR Code, chave com/sem espacos, ou texto que contenha a chave */
function ntInterpretar(txt) {
  txt = String(txt || '').trim();
  var url = /^https?:\/\//i.test(txt) ? txt : null, chave = null, m;
  if (url) {
    m = url.match(/[?&]p=([^&\s]+)/i); if (m) { var p = decodeURIComponent(m[1]).split('|')[0]; if (/^\d{44}$/.test(p)) chave = p; }
    if (!chave) { m = url.match(/chNFe=(\d{44})/i); if (m) chave = m[1]; }
  }
  if (!chave) {
    var so = txt.replace(/\D/g, '');
    if (so.length === 44) chave = so;
    else { m = txt.match(/\d{44}/); if (m) chave = m[0]; }
  }
  return { chave: chave, url: url };
}

/* ---------- dados ---------- */
function ntCarregar(forcar) {
  var c = ntCli(); if (!c) return Promise.resolve();
  if (NT.carregando) return Promise.resolve();
  if (NT.carregado && !forcar) return Promise.resolve();
  NT.carregando = true;
  return c.from('notas_fiscais').select('*').order('criado_em', { ascending: false }).limit(500).then(function (r) {
    NT.carregando = false;
    if (r.error) { NT.erro = r.error.message || String(r.error); NT.lista = []; }
    else { NT.erro = null; NT.lista = r.data || []; NT.carregado = true; }
  }, function (e) { NT.carregando = false; NT.erro = String(e && e.message || e); });
}
function ntMesDe(n) {
  var iso = n.data_emissao ? String(n.data_emissao).slice(0, 10) : (n.mes_ref ? n.mes_ref + '-01' : '');
  return (typeof mesLabelDeISO === 'function') ? mesLabelDeISO(iso) : null;
}
function ntSalvarNota(chave, url) {
  var c = ntCli(), s = ntSessao(); if (!c || !s.householdId) { flashToast('Sem sessão ativa.'); return Promise.resolve(); }
  var existente = NT.lista.filter(function (n) { return n.chave === chave; })[0];
  if (existente && existente.status === 'lida') { flashToast('Esta nota já está no NuNa.'); NT.mes = ntMesDe(existente) || NT.mes; ntRender(); return Promise.resolve(); }
  var info = ntInfoChave(chave);
  var linha = existente ? Object.assign({}, existente) : {
    household_id: s.householdId, chave: chave, uf: info.uf, cnpj: info.cnpj, mes_ref: info.mes_ref,
    itens: [], status: 'pendente', lida_por: s.perfil || null
  };
  delete linha.id; delete linha.criado_em;
  if (url) linha.url = url;
  flashToast('Lendo a nota…');
  var busca = linha.url ? c.functions.invoke('nfce-buscar', { body: { url: linha.url } }).then(function (r) {
    if (r.error) throw new Error(r.error.message || 'Falha ao consultar a SEFAZ.');
    var d = r.data || {}; if (!d.ok) throw new Error(d.erro || 'A SEFAZ não devolveu os itens.');
    return d.nota;
  }) : Promise.reject(new Error('Sem QR Code: só a chave foi lida. Escaneie o QR Code da nota para trazer os itens.'));
  return busca.then(function (nota) {
    linha.emitente = nota.emitente || linha.emitente || null;
    if (nota.cnpj) linha.cnpj = String(nota.cnpj).replace(/\D/g, '');
    if (nota.data_emissao) linha.data_emissao = nota.data_emissao;
    linha.total = nota.total != null ? nota.total : linha.total;
    linha.itens = nota.itens || [];
    linha.status = linha.itens.length ? 'lida' : 'pendente';
    linha.erro = linha.itens.length ? null : 'A nota foi aberta, mas nenhum item foi reconhecido.';
  }).catch(function (e) { linha.status = 'pendente'; linha.erro = String(e && e.message || e).slice(0, 300); })
    .then(function () { return c.from('notas_fiscais').upsert(linha, { onConflict: 'household_id,chave' }); })
    .then(function (r) {
      if (r && r.error) throw r.error;
      return ntCarregar(true);
    }).then(function () {
      var n = NT.lista.filter(function (x) { return x.chave === chave; })[0];
      if (n) NT.mes = ntMesDe(n) || NT.mes;
      ntRender();
      flashToast(n && n.status === 'lida' ? 'Nota lida: ' + (n.itens || []).length + ' itens, ' + brl(+n.total || 0) + '.' : (n && n.erro ? n.erro : 'Nota guardada.'));
    }).catch(function (e) { flashToast('Não consegui salvar a nota: ' + (e && e.message || e)); });
}
function ntRemover(id) {
  if (!confirm('Remover esta nota do NuNa?')) return;
  var c = ntCli(); if (!c) return;
  c.from('notas_fiscais').delete().eq('id', id).then(function (r) {
    if (r.error) { flashToast('Não consegui remover: ' + r.error.message); return; }
    return ntCarregar(true).then(ntRender);
  });
}

/* ---------- tela ---------- */
function ntMontar() {
  var p = el('panel-notas'); if (!p || NT.montado) return;
  NT.montado = true;
  p.innerHTML =
    '<div class="card"><h2>Notas fiscais</h2>' +
    '<p class="note" style="margin:0 0 12px">Escaneie o QR Code da nota (NFC-e) para o NuNa trazer a loja, o total e os itens comprados. O código de barras guarda a nota, mas só o QR Code traz os itens.</p>' +
    '<div class="nt-acoes"><button class="nt-big" id="nt-ler">' + (window.NUNA_ICONE_QR || '') + 'Ler QR Code / código de barras</button></div>' +
    '<div class="nt-manual"><input id="nt-txt" type="text" inputmode="text" placeholder="ou cole o link da nota / a chave de 44 dígitos" autocomplete="off">' +
    '<button class="pill" id="nt-add">Adicionar</button>' +
    '<label class="pill" style="cursor:pointer">Foto do QR<input id="nt-foto" type="file" accept="image/*" capture="environment" hidden></label></div>' +
    '<p class="note" id="nt-msg" style="margin:8px 0 0"></p></div>' +
    '<div class="pills" id="nt-meses"></div>' +
    '<div id="nt-resumo"></div><div id="nt-lista"></div><div id="nt-top"></div>';
  el('nt-ler').onclick = ntAbrirLeitor;
  el('nt-add').onclick = function () { var v = el('nt-txt').value; if (ntTratar(v)) el('nt-txt').value = ''; };
  el('nt-txt').addEventListener('keydown', function (e) { if (e.key === 'Enter') el('nt-add').click(); });
  el('nt-foto').addEventListener('change', ntLerFoto);
  el('nt-lista').addEventListener('click', function (e) {
    var b = e.target.closest('[data-nt]'); if (!b) return;
    e.preventDefault(); e.stopPropagation();
    var n = NT.lista.filter(function (x) { return x.id === b.dataset.id; })[0]; if (!n) return;
    if (b.dataset.nt === 'rm') ntRemover(n.id);
    else if (b.dataset.nt === 'retry') ntSalvarNota(n.chave, n.url);
    else if (b.dataset.nt === 'conj') ntSetConj(n.chave, !n.conjunta);
  });
}
function ntTratar(txt) {
  var r = ntInterpretar(txt);
  if (!r.chave) { flashToast('Não achei uma chave de acesso de 44 dígitos nesse texto.'); return false; }
  if (!ntChaveValida(r.chave)) { flashToast('Chave de acesso inválida (dígito verificador não confere). Tente ler de novo.'); return false; }
  ntSalvarNota(r.chave, r.url);
  return true;
}
function ntRender() {
  var p = el('panel-notas'); if (!p) return;
  ntMontar();
  if (!NT.carregado && !NT.carregando) { ntCarregar().then(function () { ntRender(); }); }
  var atual = (typeof mpMesAtual === 'function' ? mpMesAtual() : null) || (typeof rcMesPadrao === 'function' ? rcMesPadrao() : null);
  if (!NT.mes) NT.mes = atual;
  var msg = el('nt-msg');
  if (NT.erro) msg.innerHTML = '<span style="color:var(--neg)">Não consegui carregar as notas: ' + esc(NT.erro) + (/relation|does not exist|schema cache/i.test(NT.erro) ? ' (a tabela notas_fiscais ainda não foi criada no Supabase).' : '') + '</span>';
  else msg.textContent = '';

  /* meses com notas + mes atual; o atual fica em destaque, os outros recolhidos */
  var set = {}; set[atual] = 1; set[NT.mes] = 1;
  NT.lista.forEach(function (n) { var m = ntMesDe(n); if (m) set[m] = 1; });
  var meses = Object.keys(set).sort(function (a, b) { return mesOrdem(a) - mesOrdem(b); });
  var box = el('nt-meses'), aberto = box.classList.contains('mp-open');
  box.innerHTML = '';
  meses.forEach(function (m) {
    var b = document.createElement('button'); b.className = 'pill' + (m === NT.mes ? ' on' : ''); b.textContent = m;
    b.onclick = function () { NT.mes = m; ntRender(); }; box.appendChild(b);
  });
  if (aberto) box.classList.add('mp-open');
  if (typeof mpColapsarMeses === 'function') mpColapsarMeses(box, NT.mes);

  var doMes = NT.lista.filter(function (n) { return ntMesDe(n) === NT.mes && ntVisivel(n); });
  var total = doMes.reduce(function (s, n) { return s + (+n.total || 0); }, 0);
  var nItens = doMes.reduce(function (s, n) { return s + (n.itens || []).length; }, 0);
  el('nt-resumo').innerHTML = '<div class="kpis"><div class="kpi"><div class="lab">Notas em ' + esc(mesNome(NT.mes)) + '</div><div class="val">' + doMes.length + '</div></div>' +
    '<div class="kpi"><div class="lab">Total em notas</div><div class="val">' + brl(total) + '</div></div>' +
    '<div class="kpi"><div class="lab">Itens</div><div class="val">' + nItens + '</div></div></div>' + ntBlocoCats(doMes);

  el('nt-lista').innerHTML = doMes.length ? doMes.map(ntNotaHtml).join('') :
    '<div class="card"><p class="note" style="margin:0">' + (NT.carregando ? 'Carregando…' : 'Nenhuma nota neste mês. Toque em “Ler QR Code” para adicionar.') + '</p></div>';

  /* itens mais comprados no mes */
  var agg = {};
  doMes.forEach(function (n) { (n.itens || []).forEach(function (i) {
    var k = String(i.desc || '').toUpperCase().replace(/\s+/g, ' ').trim(); if (!k) return;
    var a = agg[k] || (agg[k] = { desc: k, qtd: 0, total: 0, vezes: 0 });
    a.qtd += +i.qtd || 0; a.total += +i.total || 0; a.vezes++;
  }); });
  var top = Object.keys(agg).map(function (k) { return agg[k]; }).sort(function (a, b) { return b.total - a.total; }).slice(0, 10);
  el('nt-top').innerHTML = top.length ? '<details class="card nt-card"><summary><span>Onde mais gastou (itens)</span></summary><div class="ntc-corpo">' + top.map(function (a) {
    return '<div class="nt-top"><span>' + esc(a.desc) + '<small style="display:block;color:var(--tx3)">' + a.vezes + 'x · qtd ' + (Math.round(a.qtd * 1000) / 1000) + '</small></span><b>' + brl(a.total) + '</b></div>';
  }).join('') + '</div></details>' : '';
}
function ntNotaHtml(n) {
  var itens = n.itens || [], quando = n.data_emissao ? new Date(n.data_emissao).toLocaleDateString('pt-BR') : (n.mes_ref || '');
  var nome = n.emitente || (n.cnpj ? 'CNPJ ' + ntFormatCnpj(String(n.cnpj)) : 'Nota ' + String(n.chave).slice(-8));
  var tag = n.status === 'lida' ? '' : '<span class="nt-tag err">itens pendentes</span>';
  return '<details class="nt-nota"><summary><div><div class="nt-loja">' + esc(nome) + tag + '</div>' +
    '<div class="nt-meta">' + esc(quando) + (n.uf ? ' · ' + esc(n.uf) : '') + ' · ' + itens.length + ' itens' + (n.lida_por ? ' · ' + esc(n.lida_por) : '') + (n.conjunta ? ' · conjunta' : '') + '</div></div>' +
    '<div class="nt-tot">' + (n.total != null ? brl(+n.total) : '—') + '</div></summary><div class="nt-corpo">' +
    (itens.length ? itens.map(function (i) {
      return '<div class="nt-item"><span>' + esc(i.desc) + '<small>' + (Math.round((+i.qtd || 0) * 1000) / 1000) + ' ' + esc(i.un || '') + ' × ' + brl(+i.unit || 0) + ntCmpHtml(n, i) + '</small></span><b>' + brl(+i.total || 0) + '</b></div>';
    }).join('') : '<p class="note" style="margin:0">' + esc(n.erro || 'Sem itens.') + '</p>') +
    '<div class="nt-sub">' +
    (n.status !== 'lida' && n.url ? '<button class="pill" data-nt="retry" data-id="' + esc(n.id) + '">Buscar itens de novo</button>' : '') +
    (n.url ? '<a class="pill" href="' + esc(n.url) + '" target="_blank" rel="noopener">Abrir na SEFAZ</a>' : '') +
    '<button class="pill" data-nt="conj" data-id="' + esc(n.id) + '">' + (n.conjunta ? 'Tornar individual' : 'Marcar como conjunta') + '</button>' +
    '<button class="pill" data-nt="rm" data-id="' + esc(n.id) + '">Remover</button></div></div></details>';
}

/* ---------- leitor (camera) ---------- */
var NT_LEITOR = { stream: null, timer: null, zx: null, aberto: false };
function ntCarregarZXing() {
  if (window.ZXing) return Promise.resolve(window.ZXing);
  return new Promise(function (ok, err) {
    var s = document.createElement('script'); s.src = NT_ZXING;
    s.onload = function () { ok(window.ZXing); };
    s.onerror = function () { err(new Error('Não consegui carregar o leitor de código. Verifique a internet.')); };
    document.head.appendChild(s);
  });
}
function ntOverlay() {
  var o = document.getElementById('nt-scan'); if (o) return o;
  o = document.createElement('div'); o.id = 'nt-scan'; o.className = 'nt-scan';
  o.innerHTML = '<video playsinline muted></video><div class="nt-mira"></div><div class="nt-dica">Aponte para o QR Code da nota ou para o código de barras de um produto</div>' +
    '<button class="nt-fechar" aria-label="Fechar">×</button><div class="nt-rodape" id="nt-scan-msg">Abrindo a câmera…</div>';
  document.body.appendChild(o);
  o.querySelector('.nt-fechar').onclick = ntFecharLeitor;
  return o;
}
function ntFecharLeitor() {
  NT_LEITOR.aberto = false;
  if (NT_LEITOR.timer) { clearInterval(NT_LEITOR.timer); NT_LEITOR.timer = null; }
  if (NT_LEITOR.zx) { try { NT_LEITOR.zx.reset(); } catch (e) {} NT_LEITOR.zx = null; }
  if (NT_LEITOR.stream) { NT_LEITOR.stream.getTracks().forEach(function (t) { t.stop(); }); NT_LEITOR.stream = null; }
  var o = document.getElementById('nt-scan'); if (o) o.classList.remove('open');
}
function ntAcertou(texto) {
  if (!NT_LEITOR.aberto) return;
  var r = ntInterpretar(texto);
  var soNum = String(texto || '').trim();
  if (!r.chave && /^\d{8,14}$/.test(soNum)) { if (navigator.vibrate) try { navigator.vibrate(60); } catch (e) {} ntFecharLeitor(); ntConsulta(soNum); return; }
  if (!r.chave) { var m = document.getElementById('nt-scan-msg'); if (m) m.textContent = 'Código lido, mas não é uma nota fiscal. Continue procurando…'; return; }
  if (navigator.vibrate) try { navigator.vibrate(60); } catch (e) {}
  ntFecharLeitor();
  ntTratar(texto);
}
function ntQuadro(v, cv, larg) {
  var w = v.videoWidth, h = v.videoHeight; if (!w || !h) return false;
  var k = Math.min(1, larg / w); cv.width = Math.round(w * k); cv.height = Math.round(h * k);
  cv.getContext('2d', { willReadFrequently: true }).drawImage(v, 0, 0, cv.width, cv.height);
  return true;
}
function ntDecodeZX(Z, rd, cv) {
  try {
    var bmp = new Z.BinaryBitmap(new Z.HybridBinarizer(new Z.HTMLCanvasElementLuminanceSource(cv)));
    return rd.decode(bmp).getText();
  } catch (e) { return null; }
}
function ntAbrirLeitor() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { flashToast('Este navegador não dá acesso à câmera. Use “Foto do QR” ou cole o link.'); return; }
  var o = ntOverlay(), v = o.querySelector('video'), msg = document.getElementById('nt-scan-msg');
  o.classList.add('open'); NT_LEITOR.aberto = true; msg.textContent = 'Abrindo a câmera…';
  navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false }).then(function (stream) {
    if (!NT_LEITOR.aberto) { stream.getTracks().forEach(function (t) { t.stop(); }); return; }
    NT_LEITOR.stream = stream; v.setAttribute('playsinline', ''); v.muted = true; v.srcObject = stream;
    var pl = v.play(); if (pl && pl.catch) pl.catch(function () {});
    try { var tr = stream.getVideoTracks()[0], cap = tr.getCapabilities && tr.getCapabilities(); if (cap && cap.focusMode && cap.focusMode.indexOf('continuous') >= 0) tr.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }).catch(function () {}); } catch (e) {}
    var det = null, Z = null, zrd = null, cv = document.createElement('canvas'), inicio = Date.now(), ocupado = false, quadros = 0;
    function motor() { return (det ? 'leitor nativo' : '') + (det && Z ? ' + ' : '') + (Z ? 'ZXing' : '') || 'carregando leitor'; }
    if ('BarcodeDetector' in window) {
      try { det = new BarcodeDetector({ formats: ['qr_code', 'code_128', 'itf', 'ean_13', 'ean_8', 'upc_a'] }); } catch (e) { try { det = new BarcodeDetector(); } catch (e2) { det = null; } }
    }
    ntCarregarZXing().then(function (lib) {
      Z = lib;
      var hints = new Map();
      hints.set(Z.DecodeHintType.POSSIBLE_FORMATS, [Z.BarcodeFormat.QR_CODE, Z.BarcodeFormat.CODE_128, Z.BarcodeFormat.ITF, Z.BarcodeFormat.EAN_13, Z.BarcodeFormat.EAN_8, Z.BarcodeFormat.UPC_A]);
      hints.set(Z.DecodeHintType.TRY_HARDER, true);
      zrd = new Z.MultiFormatReader(); zrd.setHints(hints);
    }).catch(function () { Z = null; });
    NT_LEITOR.timer = setInterval(function () {
      if (!NT_LEITOR.aberto || ocupado) return;
      if (v.readyState < 2 || !v.videoWidth) { msg.textContent = 'Câmera aberta, aguardando imagem…'; return; }
      ocupado = true; quadros++;
      var seg = Math.round((Date.now() - inicio) / 1000);
      msg.textContent = 'Procurando o código… (' + motor() + ', ' + v.videoWidth + 'x' + v.videoHeight + ')' + (seg > 8 ? ' — aproxime, evite reflexo, ou use “Foto do QR”.' : '');
      var fim = function () { ocupado = false; };
      var viaZX = function () {
        if (Z && zrd && ntQuadro(v, cv, 1280)) { var t = ntDecodeZX(Z, zrd, cv); if (t) ntAcertou(t); }
        fim();
      };
      if (det) { det.detect(v).then(function (rs) { if (rs && rs.length) ntAcertou(rs[0].rawValue); else viaZX(); }).catch(viaZX); }
      else viaZX();
    }, 350);
  }).catch(function (e) {
    ntFecharLeitor();
    var n = e && e.name;
    flashToast(n === 'NotAllowedError' ? 'A câmera foi bloqueada. Libere a câmera para este site nas permissões do navegador, ou use “Foto do QR”.' :
      n === 'NotFoundError' ? 'Não encontrei câmera neste aparelho. Use “Foto do QR” ou cole o link.' :
      'Não consegui abrir a câmera (' + (n || 'erro') + '). Use “Foto do QR” ou cole o link.');
  });
}
/* foto do QR (quando a camera ao vivo nao esta disponivel) */
function ntLerFoto(e) {
  var f = e.target.files && e.target.files[0]; e.target.value = ''; if (!f) return;
  flashToast('Lendo a foto…');
  var url = URL.createObjectURL(f);
  function fim() { URL.revokeObjectURL(url); }
  function falhou() { fim(); flashToast('Não achei um QR Code nessa foto. Chegue mais perto e evite reflexo.'); }
  if ('BarcodeDetector' in window) {
    var img = new Image();
    img.onload = function () {
      new BarcodeDetector({ formats: ['qr_code', 'code_128', 'itf', 'ean_13', 'ean_8', 'upc_a'] }).detect(img).then(function (rs) {
        fim(); if (rs && rs.length) { NT_LEITOR.aberto = true; ntAcertou(rs[0].rawValue); NT_LEITOR.aberto = false; } else falhou();
      }).catch(falhou);
    };
    img.onerror = falhou; img.src = url;
  } else {
    ntCarregarZXing().then(function (Z) {
      var rd = new Z.BrowserMultiFormatReader();
      return rd.decodeFromImageUrl(url).then(function (res) { fim(); NT_LEITOR.aberto = true; ntAcertou(res.getText()); NT_LEITOR.aberto = false; });
    }).catch(falhou);
  }
}

/* ---------- categorias das notas + cartao "Notas do mes" (informativo: nao soma nos totais do painel) ---------- */
var NT_CATS = ['Alimentação', 'Carro', 'Saúde & Bem-estar', 'Comer fora', 'Casa & Utilidades', 'Pets', 'Compras pessoais', 'Lazer & Viagem', 'Outros'];
var NT_REGRAS = [
  ['Carro', /posto|combust|gasolin|etanol|diesel|\bgnv\b|ipiranga|petrobras|br mania|lubrific|autope|borracharia|estaciona/i],
  ['Saúde & Bem-estar', /farmac|drog|pague menos|panvel|ultrafarma|cl[ií]nic|laborat|hospital|[oó]tica|odonto/i],
  ['Pets', /\bpet\b|ra[cç][aã]o|veterin|agropec|petz|cobasi/i],
  ['Comer fora', /restaur|lanchon|pizzar|hamburg|padaria|cafeteria|caf[eé]\b|sorvet|churrasc|a[cç]a[ií]|lanche|pastel|tapioca/i],
  ['Casa & Utilidades', /constru|ferrag|leroy|telha|m[oó]veis|utilidad|lavand|el[eé]trica|tintas/i],
  ['Alimentação', /atacad|mercad|supermerc|assa[ií]|carrefour|extra\b|p[aã]o de a[cç]|bompre|hiper|mercantil|feira|kitanda|a[cç]ougue|hortifruti|frios|sacol[aã]o|frutas/i],
  ['Compras pessoais', /magazine|riachuelo|renner|c&a|shopee|calcad|roupa|vestu|boutique|americanas|shein/i]
];
function ntCatAuto(n) {
  var loja = n.emitente || '';
  for (var i = 0; i < NT_REGRAS.length; i++) if (NT_REGRAS[i][1].test(loja)) return NT_REGRAS[i][0];
  var itens = (n.itens || []).map(function (x) { return x.desc || ''; }).join(' | ');
  for (var j = 0; j < NT_REGRAS.length - 1; j++) if (NT_REGRAS[j][1].test(itens)) return NT_REGRAS[j][0];
  return 'Outros';
}
function ntCat(n) {
  if (n.cat_manual && n.categoria) return n.categoria;
  if (n.cnpj) {
    var ap = (NT.lista || []).filter(function (x) { return x.cnpj === n.cnpj && x.cat_manual && x.categoria; })[0];
    if (ap) return ap.categoria;
  }
  return ntCatAuto(n);
}
function ntCatHtml(n) {
  var atual = ntCat(n);
  return '<label class="nres-cat">Categoria <select class="nres-catsel" data-chave="' + esc(n.chave) + '">' +
    NT_CATS.map(function (c) { return '<option' + (c === atual ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('') + '</select></label>' +
    '<label class="nres-cat">Compra conjunta (casal) <input type="checkbox" class="nres-conj" data-chave="' + esc(n.chave) + '"' + (n.conjunta ? ' checked' : '') + '></label>';
}
function ntSetCat(chave, cat) {
  var n = (NT.lista || []).filter(function (x) { return x.chave === chave; })[0], c = ntCli(); if (!n || !c) return;
  var q = c.from('notas_fiscais').update({ categoria: cat, cat_manual: true }).eq('household_id', n.household_id);
  q = n.cnpj ? q.eq('cnpj', n.cnpj) : q.eq('id', n.id);
  q.then(function (r) {
    if (r && r.error) { flashToast('Não consegui guardar a categoria.'); return; }
    (NT.lista || []).forEach(function (x) { if (n.cnpj ? x.cnpj === n.cnpj : x.id === n.id) { x.categoria = cat; x.cat_manual = true; } });
    flashToast('Guardei: ' + (n.emitente || 'loja') + ' → ' + cat + '. As próximas notas dessa loja seguem assim.');
    try { ntRender(); } catch (e) {}
  });
}
document.addEventListener('change', function (e) {
  var s = e.target; if (!s || !s.classList) return;
  if (s.classList.contains('nres-catsel')) ntSetCat(s.dataset.chave, s.value);
  else if (s.classList.contains('nres-conj')) ntSetConj(s.dataset.chave, s.checked);
});
function ntVisivel(n) {
  var p = (window.state && state.perfil) || 'NuNa';
  if (p === 'NuNa') return !!n.conjunta;
  return !n.conjunta && (n.lida_por || 'Ana') === p;
}
function ntBlocoCats(lista) {
  if (!lista.length) return '';
  var ag = {}, tot = 0;
  lista.forEach(function (n) { var k = ntCat(n), v = +n.total || 0; (ag[k] = ag[k] || { t: 0, q: 0 }); ag[k].t += v; ag[k].q++; tot += v; });
  var linhas = Object.keys(ag).sort(function (a, b) { return ag[b].t - ag[a].t; });
  var max = ag[linhas[0]].t || 1;
  var cor = function (k) { try { return typeof colorOf === 'function' ? colorOf(k) : '#A8A29E'; } catch (e) { return '#A8A29E'; } };
  return '<div class="card"><h2>Para onde foi</h2><div class="ntc-corpo">' + linhas.map(function (k) {
    return '<div class="ntc-row"><div class="ntc-l"><span>' + esc(k) + ' <small>' + ag[k].q + (ag[k].q > 1 ? ' notas' : ' nota') + '</small></span><b>' + brl(ag[k].t) + '</b></div>' +
      '<div class="ntc-bar"><i style="width:' + Math.max(4, Math.round(ag[k].t / max * 100)) + '%;background:' + cor(k) + '"></i></div></div>';
  }).join('') + '<p class="note" style="margin:8px 0 0">Informativo: vem das notas lidas pelo QR e não soma nos totais do painel (a fatura já conta esses gastos).</p></div></div>';
}
function ntSetConj(chave, v) {
  var n = (NT.lista || []).filter(function (x) { return x.chave === chave; })[0], c = ntCli(); if (!n || !c) return;
  c.from('notas_fiscais').update({ conjunta: !!v }).eq('id', n.id).then(function (r) {
    if (r && r.error) { flashToast('Não consegui atualizar a nota.'); return; }
    n.conjunta = !!v;
    flashToast(v ? 'Compra conjunta: aparece só no perfil Conjunto.' : 'Compra individual: aparece só no perfil de quem leu.');
    try { ntRender(); } catch (e) {}
  });
}

/* ---------- comparacao de precos com a compra anterior do mesmo produto ---------- */
function ntChaveItem(i) { return i.ean ? 'e:' + i.ean : 'd:' + String(i.desc || '').toUpperCase().replace(/\s+/g, ' ').trim(); }
function ntAnterior(n, i) {
  var k = ntChaveItem(i), t0 = n.data_emissao || n.criado_em || '', best = null;
  (NT.lista || []).forEach(function (x) {
    if (x.id === n.id || x.chave === n.chave || x.status !== 'lida') return;
    var t = x.data_emissao || x.criado_em || ''; if (t0 && t >= t0) return;
    (x.itens || []).forEach(function (j) {
      if (ntChaveItem(j) !== k || (j.un || '') !== (i.un || '') || !(+j.unit > 0)) return;
      if (!best || t > best.t) best = { t: t, unit: +j.unit, loja: x.emitente };
    });
  });
  return best;
}
function ntCmpHtml(n, i) {
  if (!(+i.unit > 0)) return '';
  var a = ntAnterior(n, i); if (!a) return '';
  var r = Math.round((+i.unit - a.unit) / a.unit * 1000) / 10;
  var cls = r > 0.5 ? 'nt-up' : (r < -0.5 ? 'nt-dn' : 'nt-eq');
  var txt = r > 0.5 ? '▲ +' + r + '%' : (r < -0.5 ? '▼ ' + r + '%' : '= igual');
  return ' <span class="nt-cmp ' + cls + '">' + txt + ' <em>antes ' + brl(a.unit) + (a.loja ? ' · ' + esc(String(a.loja).slice(0, 18)) : '') + '</em></span>';
}

/* ---------- consulta de preco pelo codigo de barras do produto ---------- */
function ntConsulta(code) {
  var k = String(code).replace(/^0+/, '');
  var abrir = function () {
    var ach = [];
    (NT.lista || []).forEach(function (x) {
      if (x.status !== 'lida') return;
      (x.itens || []).forEach(function (j) {
        if (j.ean && String(j.ean).replace(/^0+/, '') === k && +j.unit > 0) ach.push({ t: x.data_emissao || x.criado_em || '', unit: +j.unit, un: j.un || '', loja: x.emitente || '', desc: j.desc });
      });
    });
    ach.sort(function (a, b) { return a.t < b.t ? 1 : -1; });
    var ult = ach[0], menor = ach.slice().sort(function (a, b) { return a.unit - b.unit; })[0];
    var dt = function (a) { return a.t ? new Date(a.t).toLocaleDateString('pt-BR') : ''; };
    var bg = document.getElementById('nres-bg'), sh = document.getElementById('nres');
    if (!bg) {
      bg = document.createElement('div'); bg.id = 'nres-bg'; bg.className = 'nres-bg'; document.body.appendChild(bg);
      sh = document.createElement('div'); sh.id = 'nres'; sh.className = 'nres'; document.body.appendChild(sh);
    }
    var fechar = function () { sh.classList.remove('open'); bg.classList.remove('open'); };
    bg.onclick = fechar;
    sh.innerHTML = '<div class="grip"></div><div class="nres-cab"><div><div class="nres-loja">' + esc(ult ? ult.desc : 'Produto ainda não comprado') + '</div><div class="nres-meta">Código ' + esc(code) + '</div></div></div>' +
      (ult ? '<div class="nres-itens" style="border-top:1px solid var(--border2)"><div class="nres-it"><span>Última compra<small>' + esc(dt(ult)) + (ult.loja ? ' · ' + esc(ult.loja) : '') + '</small></span><b>' + brl(ult.unit) + (ult.un ? '/' + esc(ult.un) : '') + '</b></div>' +
        (menor && menor !== ult ? '<div class="nres-it"><span>Menor preço já pago<small>' + esc(dt(menor)) + (menor.loja ? ' · ' + esc(menor.loja) : '') + '</small></span><b>' + brl(menor.unit) + '</b></div>' : '') + '</div>'
        : '<p class="note" style="margin:10px 0">Não achei esse código nas suas notas. Depois de comprar e ler a nota, o NuNa passa a comparar.</p>') +
      (ult ? '<label class="nres-cat">Preço na prateleira <input id="nc-preco" inputmode="decimal" placeholder="0,00" style="flex:1;max-width:120px;padding:6px 8px;border-radius:8px;border:1px solid var(--border);background:var(--card);color:var(--tx);font:inherit;font-size:14px;text-align:right"></label><div id="nc-res" class="nres-meta" style="margin:8px 0;min-height:18px;font-size:13px"></div>' : '') +
      '<div class="nres-bt" style="margin-top:8px"><button type="button" data-r="outro">Ler outro</button><button type="button" class="pri" data-r="ok">Fechar</button></div>';
    sh.querySelector('[data-r="ok"]').onclick = fechar;
    sh.querySelector('[data-r="outro"]').onclick = function () { fechar(); setTimeout(ntAbrirLeitor, 250); };
    var inp = sh.querySelector('#nc-preco');
    if (inp) inp.addEventListener('input', function () {
      var p = parseFloat(String(inp.value).replace(/\./g, '').replace(',', '.')), out = sh.querySelector('#nc-res');
      if (!(p > 0)) { out.innerHTML = ''; return; }
      var r = Math.round((p - ult.unit) / ult.unit * 1000) / 10;
      out.innerHTML = r > 0.5 ? '<span class="nt-cmp nt-up">▲ ' + r + '% mais caro que a última compra</span>' : (r < -0.5 ? '<span class="nt-cmp nt-dn">▼ ' + Math.abs(r) + '% mais barato que a última compra</span>' : '<span class="nt-cmp nt-eq">= igual à última compra</span>');
    });
    requestAnimationFrame(function () { sh.classList.add('open'); bg.classList.add('open'); });
  };
  (typeof ntCarregar === 'function' ? Promise.resolve(ntCarregar(true)) : Promise.resolve()).then(abrir, abrir);
}
