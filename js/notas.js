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

  var doMes = NT.lista.filter(function (n) { return ntMesDe(n) === NT.mes; });
  var total = doMes.reduce(function (s, n) { return s + (+n.total || 0); }, 0);
  var nItens = doMes.reduce(function (s, n) { return s + (n.itens || []).length; }, 0);
  el('nt-resumo').innerHTML = '<div class="kpis"><div class="kpi"><div class="lab">Notas em ' + esc(mesNome(NT.mes)) + '</div><div class="val">' + doMes.length + '</div></div>' +
    '<div class="kpi"><div class="lab">Total em notas</div><div class="val">' + brl(total) + '</div></div>' +
    '<div class="kpi"><div class="lab">Itens</div><div class="val">' + nItens + '</div></div></div>';

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
  el('nt-top').innerHTML = top.length ? '<div class="card"><h2>Onde mais gastou (itens)</h2>' + top.map(function (a) {
    return '<div class="nt-top"><span>' + esc(a.desc) + '<small style="display:block;color:var(--tx3)">' + a.vezes + 'x · qtd ' + (Math.round(a.qtd * 1000) / 1000) + '</small></span><b>' + brl(a.total) + '</b></div>';
  }).join('') + '</div>' : '';
}
function ntNotaHtml(n) {
  var itens = n.itens || [], quando = n.data_emissao ? new Date(n.data_emissao).toLocaleDateString('pt-BR') : (n.mes_ref || '');
  var nome = n.emitente || (n.cnpj ? 'CNPJ ' + ntFormatCnpj(String(n.cnpj)) : 'Nota ' + String(n.chave).slice(-8));
  var tag = n.status === 'lida' ? '' : '<span class="nt-tag err">itens pendentes</span>';
  return '<details class="nt-nota"><summary><div><div class="nt-loja">' + esc(nome) + tag + '</div>' +
    '<div class="nt-meta">' + esc(quando) + (n.uf ? ' · ' + esc(n.uf) : '') + ' · ' + itens.length + ' itens' + (n.lida_por ? ' · ' + esc(n.lida_por) : '') + '</div></div>' +
    '<div class="nt-tot">' + (n.total != null ? brl(+n.total) : '—') + '</div></summary><div class="nt-corpo">' +
    (itens.length ? itens.map(function (i) {
      return '<div class="nt-item"><span>' + esc(i.desc) + '<small>' + (Math.round((+i.qtd || 0) * 1000) / 1000) + ' ' + esc(i.un || '') + ' × ' + brl(+i.unit || 0) + '</small></span><b>' + brl(+i.total || 0) + '</b></div>';
    }).join('') : '<p class="note" style="margin:0">' + esc(n.erro || 'Sem itens.') + '</p>') +
    '<div class="nt-sub">' +
    (n.status !== 'lida' && n.url ? '<button class="pill" data-nt="retry" data-id="' + esc(n.id) + '">Buscar itens de novo</button>' : '') +
    (n.url ? '<a class="pill" href="' + esc(n.url) + '" target="_blank" rel="noopener">Abrir na SEFAZ</a>' : '') +
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
  o.innerHTML = '<video playsinline muted></video><div class="nt-mira"></div><div class="nt-dica">Aponte para o QR Code da nota fiscal</div>' +
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
  if (!r.chave) { var m = document.getElementById('nt-scan-msg'); if (m) m.textContent = 'Código lido, mas não é uma nota fiscal. Continue procurando…'; return; }
  if (navigator.vibrate) try { navigator.vibrate(60); } catch (e) {}
  ntFecharLeitor();
  ntTratar(texto);
}
function ntAbrirLeitor() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { flashToast('Este navegador não dá acesso à câmera. Use “Foto do QR” ou cole o link.'); return; }
  var o = ntOverlay(), v = o.querySelector('video'), msg = document.getElementById('nt-scan-msg');
  o.classList.add('open'); NT_LEITOR.aberto = true; msg.textContent = 'Abrindo a câmera…';
  navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } }, audio: false }).then(function (stream) {
    if (!NT_LEITOR.aberto) { stream.getTracks().forEach(function (t) { t.stop(); }); return; }
    NT_LEITOR.stream = stream; v.srcObject = stream; v.play().catch(function () {});
    msg.textContent = 'Procurando o código… mantenha a nota bem iluminada e firme.';
    if ('BarcodeDetector' in window) {
      var det;
      var pronto = (BarcodeDetector.getSupportedFormats ? BarcodeDetector.getSupportedFormats() : Promise.resolve(['qr_code', 'code_128', 'itf', 'ean_13'])).then(function (fs) {
        var quer = ['qr_code', 'code_128', 'itf', 'ean_13'].filter(function (f) { return fs.indexOf(f) >= 0; });
        det = new BarcodeDetector({ formats: quer.length ? quer : undefined });
      });
      pronto.then(function () {
        var ocupado = false;
        NT_LEITOR.timer = setInterval(function () {
          if (ocupado || v.readyState < 2) return; ocupado = true;
          det.detect(v).then(function (rs) { if (rs && rs.length) ntAcertou(rs[0].rawValue); }).catch(function () {}).then(function () { ocupado = false; });
        }, 260);
      });
    } else {
      ntCarregarZXing().then(function (Z) {
        if (!NT_LEITOR.aberto) return;
        var hints = new Map();
        hints.set(Z.DecodeHintType.POSSIBLE_FORMATS, [Z.BarcodeFormat.QR_CODE, Z.BarcodeFormat.CODE_128, Z.BarcodeFormat.ITF, Z.BarcodeFormat.EAN_13]);
        hints.set(Z.DecodeHintType.TRY_HARDER, true);
        var rd = new Z.BrowserMultiFormatReader(hints); NT_LEITOR.zx = rd;
        rd.decodeFromStream(stream, v, function (res) { if (res) ntAcertou(res.getText()); });
      }).catch(function (e) { msg.textContent = e.message; });
    }
  }).catch(function (e) {
    ntFecharLeitor();
    flashToast(e && e.name === 'NotAllowedError' ? 'Permita o uso da câmera para ler a nota, ou use “Foto do QR”.' : 'Não consegui abrir a câmera. Use “Foto do QR” ou cole o link.');
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
      new BarcodeDetector({ formats: ['qr_code', 'code_128', 'itf'] }).detect(img).then(function (rs) {
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
