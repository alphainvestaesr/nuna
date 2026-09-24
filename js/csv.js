/* ============================================================
   NuNa · csv.js — importacao de faturas/extratos com protecao
   contra duplicidade.
   Regra: a mesma linha nunca vira duas transacoes. A chave e
   mes|fonte|cartao|data|descricao|valor, mais um ordinal que
   separa repeticoes legitimas do mesmo dia (dois abastecimentos
   de R$ 100 no mesmo posto sao compras distintas). Na duvida,
   marca para revisao — nunca descarta nem duplica em silencio.
   ============================================================ */
var CSV = (function () {
  var MES_LABEL = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

  function detectarSeparador(txt) {
    var l = txt.split(/\r?\n/).filter(function (x) { return x.trim(); })[0] || '';
    var c = { ';': 0, ',': 0, '\t': 0 };
    Object.keys(c).forEach(function (s) { c[s] = l.split(s).length - 1; });
    return Object.keys(c).sort(function (a, b) { return c[b] - c[a]; })[0];
  }
  function linhas(txt, sep) {
    return txt.split(/\r?\n/).filter(function (l) { return l.trim(); }).map(function (l) {
      var out = [], cur = '', dentro = false;
      for (var i = 0; i < l.length; i++) {
        var ch = l[i];
        if (ch === '"') { dentro = !dentro; continue; }
        if (ch === sep && !dentro) { out.push(cur.trim()); cur = ''; continue; }
        cur += ch;
      }
      out.push(cur.trim());
      return out;
    });
  }
  function acha(cab, nomes) {
    for (var i = 0; i < cab.length; i++) {
      var c = cab[i].toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
      for (var j = 0; j < nomes.length; j++) if (c.indexOf(nomes[j]) >= 0) return i;
    }
    return -1;
  }
  function valorBR(s) {
    s = String(s || '').replace(/[R$\s]/g, '');
    if (!s) return NaN;
    if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.');
    return parseFloat(s);
  }
  function dataISO(s) {
    s = String(s || '').trim();
    var m = s.match(/^(\d{2})\/(\d{2})\/(\d{2,4})$/);
    if (m) { var a = m[3].length === 2 ? '20' + m[3] : m[3]; return a + '-' + m[2] + '-' + m[1]; }
    m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return m[1] + '-' + m[2] + '-' + m[3];
    return null;
  }
  function dataBR(iso) { var p = iso.split('-'); return p[2] + '/' + p[1] + '/' + p[0].slice(2); }

  /* le um CSV e devolve linhas cruas normalizadas */
  function ler(texto) {
    var sep = detectarSeparador(texto);
    var L = linhas(texto, sep);
    if (L.length < 2) return { erro: 'Arquivo sem linhas de dados.' };
    var cab = L[0];
    var iData = acha(cab, ['data']);
    var iDesc = acha(cab, ['descricao', 'historico', 'lancamento', 'movimentacao', 'estabelecimento', 'title']);
    var iVal  = acha(cab, ['valor', 'amount', 'montante']);
    var iCred = acha(cab, ['credito']);
    var iDeb  = acha(cab, ['debito']);
    var iFon  = acha(cab, ['fonte', 'cartao', 'conta']);
    var iPer  = acha(cab, ['perfil', 'titular']);
    var iId   = acha(cab, ['identificador', 'id']);
    if (iData < 0 || iDesc < 0 || (iVal < 0 && iDeb < 0))
      return { erro: 'Nao encontrei as colunas de Data, Descricao e Valor. Cabecalho lido: ' + cab.join(' | ') };
    var out = [];
    for (var i = 1; i < L.length; i++) {
      var r = L[i];
      var iso = dataISO(r[iData]); if (!iso) continue;
      var v = iVal >= 0 ? valorBR(r[iVal]) : 0;
      if (iVal < 0) { var d = valorBR(r[iDeb]) || 0, c = iCred >= 0 ? (valorBR(r[iCred]) || 0) : 0; v = d - c; }
      if (!isFinite(v) || v === 0) continue;
      out.push({ iso: iso, desc: String(r[iDesc] || '').trim(), valor: v,
                 fonte: iFon >= 0 ? r[iFon] : '', perfil: iPer >= 0 ? r[iPer] : '',
                 idOriginal: iId >= 0 ? r[iId] : '' });
    }
    return { linhas: out, colunas: cab };
  }

  /* monta as transacoes finais, deduplicando contra a base */
  function preparar(cruas, opcoes) {
    opcoes = opcoes || {};
    var fontePadrao = opcoes.fonte || 'Fonte nao identificada';
    var perfilPadrao = opcoes.perfil || 'Ana';
    var existentes = {}, ordinais = {}, semFonte = {};
    MONTHS.forEach(function (m) {
      DATA.months[m].transactions.forEach(function (t) {
        existentes[t.dedupKey] = (existentes[t.dedupKey] || 0) + 1;
        ordinais[t.dedupKey] = Math.max(ordinais[t.dedupKey] || 0, t.ordinal || 1);
        semFonte[chaveSemFonte(m, t.data, t.raw || t.desc, t.valor)] = t.fonteLabel;
      });
    });
    var novos = [], duplicados = [], foraDoPeriodo = [], porChave = {};
    cruas.forEach(function (r) {
      if (r.valor <= 0) return; /* credito/pagamento de fatura: nao e despesa */
      /* Em fatura de cartao o lancamento pertence ao mes da FATURA, nao ao mes
         da compra (uma parcela de marco entra na fatura de setembro). Por isso
         opcoes.mesFatura tem prioridade sobre a data da linha. */
      var mes = opcoes.mesFatura || (typeof mesLabelDeISO === 'function' ? mesLabelDeISO(r.iso) : MES_LABEL[+r.iso.split('-')[1] - 1]);
      if (MONTHS.indexOf(mes) < 0) { foraDoPeriodo.push(r); return; }
      var fonte = r.fonte || fontePadrao;
      var perfil = /manuela/i.test(r.perfil) ? 'Manuela' : (r.perfil ? 'Ana' : perfilPadrao);
      var descN = r.desc.replace(/\s+/g, ' ').trim().toUpperCase();
      var chave = [mes, fonte, dataBR(r.iso), descN, r.valor.toFixed(2)].join('|');
      porChave[chave] = (porChave[chave] || 0) + 1;
      var jaTem = existentes[chave] || 0;
      if (porChave[chave] <= jaTem) { duplicados.push({ desc: r.desc, valor: r.valor, data: dataBR(r.iso) }); return; }
      var ord = (ordinais[chave] || 0) + (porChave[chave] - jaTem);
      var uid = 'csv-' + hashCurto(chave + '#' + ord);
      novos.push({
        mes: mes, data: dataBR(r.iso), perfil: perfil, raw: r.desc, desc: r.desc,
        tipo: 'Outros', grupo: null, plano: perfil === 'Manuela' ? 'Cartao Bradesco' : 'Bradesco',
        planoOrig: perfil === 'Manuela' ? 'Cartao Bradesco' : 'Bradesco', grupoOrig: null,
        valor: Math.round(r.valor * 100) / 100, fonte: fonte, cartao: '-',
        fonteLabel: fonte, fontePendente: !r.fonte && !opcoes.fonte,
        revisar: true, status: '', divisao: 'INDIVIDUAL', contrib: false,
        /* mesma compra ja lancada com OUTRO nome de cartao: nao descarta, marca para revisar */
        possivelDup: (existentes[chave] || 0) > 0 || porChave[chave] > 1 ||
          (!!semFonte[chaveSemFonte(mes, dataBR(r.iso), r.desc, r.valor)] && semFonte[chaveSemFonte(mes, dataBR(r.iso), r.desc, r.valor)] !== fonte),
        id: uid, uid: uid, dedupKey: chave, ordinal: ord,
        idOriginal: r.idOriginal || null, importadoEm: new Date().toISOString()
      });
    });
    return { novos: novos, duplicados: duplicados, foraDoPeriodo: foraDoPeriodo };
  }
  /* chave da compra sem o cartao: mes|data|descricao|valor */
  function chaveSemFonte(mes, data, desc, valor) {
    return [mes, data, String(desc || '').replace(/\s+/g, ' ').trim().toUpperCase(), Number(valor).toFixed(2)].join('|');
  }
  /* tenta descobrir banco e final do cartao pelo nome do arquivo e pela coluna de cartao */
  function sugerirFonte(nomeArq, cruas) {
    var txt = String(nomeArq || '') + ' ' + (cruas || []).slice(0, 50).map(function (r) { return r.fonte || ''; }).join(' ');
    var low = ' ' + txt.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[_\-.]/g, ' ') + ' ';
    var BANCOS = [['nubank','Nubank'],['nu','Nubank'],['inter','Inter'],['bradesco','Bradesco'],['itau','Itau'],['santander','Santander'],
      ['c6','C6'],['caixa','Caixa'],['banco do brasil','Banco do Brasil'],['bb','Banco do Brasil'],['neon','Neon'],['picpay','PicPay'],
      ['mercado pago','Mercado Pago'],['xp','XP'],['btg','BTG'],['porto','Porto'],['sicredi','Sicredi'],['sicoob','Sicoob'],
      ['will','Will Bank'],['riachuelo','Riachuelo'],['midway','Midway'],['renner','Renner'],['pan','Pan'],['next','Next'],['ourocard','Ourocard']];
    var banco = '';
    for (var i = 0; i < BANCOS.length && !banco; i++) if (new RegExp('[^a-z0-9]' + BANCOS[i][0] + '[^a-z0-9]').test(low)) banco = BANCOS[i][1];
    var fins = (txt.match(/\d{4}(?!\d)/g) || []).filter(function (x) { return !/^(19|20)\d\d$/.test(x); });
    var fim = fins[0] || '', conhecida = null;
    if (fim) fontesConhecidas().forEach(function (f) { if (!conhecida && f.indexOf(fim) >= 0) conhecida = f; });
    return { banco: banco, fim: fim, conhecida: conhecida };
  }
  /* liga lancamentos importados sem cartao a um cartao, recalculando a chave anti-duplicidade */
  function religar(uids, nome) {
    var set = {}; uids.forEach(function (u) { set[u] = 1; });
    var guardados = Store.get(K.IMPORTADOS, []), n = 0;
    function ajusta(t) {
      t.fonte = nome; t.fonteLabel = nome; t.fontePendente = false;
      t.dedupKey = [t.mes, nome, t.data, String(t.raw || t.desc).replace(/\s+/g, ' ').trim().toUpperCase(), Number(t.valor).toFixed(2)].join('|');
    }
    guardados.forEach(function (t) { if (set[t.uid]) { ajusta(t); n++; } });
    MONTHS.forEach(function (m) { DATA.months[m].transactions.forEach(function (t) { if (set[t.uid]) ajusta(t); }); });
    Store.set(K.IMPORTADOS, guardados);
    return n;
  }
  function hashCurto(s) {
    var h = 0x811c9dc5;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = (h * 0x01000193) >>> 0; }
    return ('00000000' + h.toString(16)).slice(-8);
  }
  function aplicar(novos) {
    var guardados = Store.get(K.IMPORTADOS, []);
    var vistos = {}; guardados.forEach(function (t) { vistos[t.uid] = 1; });
    novos.forEach(function (t) {
      if (vistos[t.uid]) return;
      vistos[t.uid] = 1; guardados.push(t);
      DATA.months[t.mes].transactions.push(t);
    });
    Store.set(K.IMPORTADOS, guardados);
    return guardados.length;
  }
  return { ler: ler, preparar: preparar, aplicar: aplicar, sugerirFonte: sugerirFonte, religar: religar };
})();

/* ---------- cartoes e contas: lista viva ----------
   Lista fixa + todo cartao que ja apareceu num lancamento importado.
   Um cartao novo passa a existir quando a primeira fatura dele e importada
   (fica gravado nos proprios lancamentos, no banco), e aparece para as duas. */
var FONTES_AVULSAS = ['Pix', 'Dinheiro', 'Debito', 'Boleto', 'Outra'];
function fontesConhecidas() {
  var vistos = {}, out = [];
  function add(f) {
    if (!f || vistos[f] || FONTES_AVULSAS.indexOf(f) >= 0) return;
    if (f === 'Fonte nao identificada' || f === 'Informado manualmente' || /^Contracheque/i.test(f)) return;
    vistos[f] = 1; out.push(f);
  }
  if (typeof AG_FONTES !== 'undefined') AG_FONTES.forEach(add);
  if (typeof FONTES !== 'undefined' && FONTES) FONTES.forEach(add);
  if (typeof DATA !== 'undefined' && DATA && DATA.months) MONTHS.forEach(function (m) {
    DATA.months[m].transactions.forEach(function (t) { add(t.fonteLabel); });
  });
  return out;
}
function fontesParaGasto() { return fontesConhecidas().concat(FONTES_AVULSAS); }
function nomeNovaFonte(tipo, banco, fim, perfil) {
  banco = String(banco || '').trim(); fim = String(fim || '').replace(/\D/g, '').slice(-4);
  if (!banco) return '';
  return (tipo === 'Conta' ? 'Conta ' : 'Cartao ') + banco + (fim ? ' ' + fim : '') + ' (' + (perfil || 'Ana') + ')';
}
