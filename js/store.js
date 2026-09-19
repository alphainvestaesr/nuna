/* ============================================================
   NuNa · store.js — camada de persistencia (Supabase)
   Mesma interface de antes: get(chave, padrao) / set(chave, valor) /
   remove(chave) sao SINCRONOS. O estado inteiro do household e
   carregado uma vez no boot para um cache em memoria; toda escrita
   entra no cache na hora e vai para o banco em segundo plano
   (write-through com agrupamento de 400ms).
   Realtime + retorno de foco recarregam o cache quando a outra
   usuaria grava algo no mesmo household.
   ============================================================ */
var Store = (function () {
  var NS = 'nuna.v1.';
  var cache = {};
  var espelho = {};              // ultimo estado gravado, para calcular diferencas
  var pendentes = {};
  var timer = null, gravando = false;
  var ctx = { userId: null, householdId: null, perfil: null };
  var ouvintes = [];
  var sb = null;

  function cli() { if (!sb) sb = Auth.cliente(); return sb; }
  function clone(v) { return v == null ? v : JSON.parse(JSON.stringify(v)); }
  function erro(e) { if (e) console.error('[NuNa/store]', e.message || e); }

  /* ---------- API sincrona usada pelo resto do app ---------- */
  function get(chave, padrao) {
    var v = cache[chave];
    return (v === undefined || v === null) ? padrao : v;
  }
  function set(chave, valor) {
    cache[chave] = valor;
    agendar(chave);
    return true;
  }
  function remove(chave) {
    cache[chave] = null;
    agendar(chave);
  }
  function chaves() {
    return Object.keys(cache).filter(function (k) { return cache[k] != null; });
  }
  function exportarTudo() {
    var o = { versao: 2, origem: 'supabase', exportadoEm: new Date().toISOString(), dados: {} };
    chaves().forEach(function (k) { o.dados[k] = clone(cache[k]); });
    return o;
  }
  function importarTudo(obj) {
    if (!obj || !obj.dados) return false;
    Object.keys(obj.dados).forEach(function (k) { set(k, obj.dados[k]); });
    return true;
  }

  function agendar(chave) {
    pendentes[chave] = 1;
    if (timer) clearTimeout(timer);
    timer = setTimeout(descarregar, 400);
  }

  function descarregar() {
    timer = null;
    if (!ctx.householdId || gravando) { if (!ctx.householdId) pendentes = {}; return; }
    var lista = Object.keys(pendentes);
    if (!lista.length) return;
    pendentes = {};
    gravando = true;
    Promise.all(lista.map(function (k) {
      var ad = ADAPTADORES[k];
      if (!ad) return Promise.resolve();
      return Promise.resolve(ad.salvar(cache[k])).then(function () {
        espelho[k] = clone(cache[k]);
      }).catch(erro);
    })).then(function () {
      gravando = false;
      if (Object.keys(pendentes).length) descarregar();
    });
  }

  /* ---------- helpers de tabela ---------- */
  function hid() { return ctx.householdId; }

  function lerTabela(tabela, colunas) {
    return cli().from(tabela).select(colunas || '*').eq('household_id', hid())
      .then(function (r) { if (r.error) throw r.error; return r.data || []; });
  }

  /* Colecoes pequenas: apaga tudo do household e regrava. */
  function regravar(tabela, linhas) {
    return cli().from(tabela).delete().eq('household_id', hid()).then(function (r) {
      if (r.error) throw r.error;
      if (!linhas.length) return null;
      return cli().from(tabela).insert(linhas).then(function (x) { if (x.error) throw x.error; });
    });
  }

  /* ---------- mapeamento chave do app -> tabela ---------- */
  var COLS_TX = {
    uid: 'uid', mes: 'mes', data: 'data_br', iso: 'data_iso', desc: 'descricao', raw: 'raw',
    valor: 'valor', fonte: 'fonte', fonteLabel: 'fonte_label', plano: 'plano', tipo: 'tipo',
    grupo: 'grupo', divisao: 'divisao', pagoPor: 'pago_por', perfil: 'perfil_dono',
    revisar: 'revisar', conferido: 'conferido', status: 'status', dedupKey: 'dedup_key'
  };

  function paraLinha(t, mapa) {
    var l = { household_id: hid() }, extra = {};
    Object.keys(t).forEach(function (k) {
      if (mapa[k]) {
        var v = t[k];
        if (mapa[k] === 'data_iso' && !v) v = null;
        if (mapa[k] === 'revisar') v = (v === true || v === 'sim' || v === 1);
        l[mapa[k]] = v;
      } else extra[k] = t[k];
    });
    l.extra = extra;
    return l;
  }
  function paraObjeto(l, mapa) {
    var inv = {}, o = {};
    Object.keys(mapa).forEach(function (k) { inv[mapa[k]] = k; });
    Object.keys(l).forEach(function (c) {
      if (c === 'household_id' || c === 'id' || c === 'criado_em' || c === 'atualizado_em') return;
      if (c === 'extra') { Object.assign(o, l.extra || {}); return; }
      if (inv[c] !== undefined) o[inv[c]] = l[c];
    });
    if (typeof o.valor === 'string') o.valor = parseFloat(o.valor);
    return o;
  }

  function salvarColecaoTx(tabela, lista, mapa) {
    lista = Array.isArray(lista) ? lista : [];
    var linhas = lista.map(function (t) { return paraLinha(t, mapa); });
    var uids = lista.map(function (t) { return t.uid; }).filter(Boolean);
    var p = linhas.length
      ? cli().from(tabela).upsert(linhas, { onConflict: 'household_id,uid' }).then(function (r) { if (r.error) throw r.error; })
      : Promise.resolve();
    return p.then(function () {
      var q = cli().from(tabela).delete().eq('household_id', hid());
      if (uids.length) q = q.not('uid', 'in', '(' + uids.map(function (u) { return '"' + u + '"'; }).join(',') + ')');
      return q.then(function (r) { if (r.error) throw r.error; });
    });
  }

  var ADAPTADORES = {
    /* base completa do dashboard (importada uma unica vez pela aba Dados) */
    base: {
      carregar: function () {
        return cli().from('base_documento').select('dados').eq('household_id', hid()).maybeSingle()
          .then(function (r) { if (r.error) throw r.error; return r.data ? r.data.dados : null; });
      },
      salvar: function (v) {
        if (v == null) return cli().from('base_documento').delete().eq('household_id', hid());
        return cli().from('base_documento')
          .upsert({ household_id: hid(), dados: v, atualizado_em: new Date().toISOString() }, { onConflict: 'household_id' })
          .then(function (r) { if (r.error) throw r.error; });
      }
    },
    /* preferencias por usuaria */
    tema: {
      carregar: function () { return lerPref('tema'); },
      salvar: function (v) { return salvarPref('tema', v); }
    },
    prefs: {
      carregar: function () { return lerPref('prefs'); },
      salvar: function (v) { return salvarPref('prefs', v); }
    },
    /* edicoes manuais por uid */
    overrides: {
      carregar: function () {
        return lerTabela('overrides', 'uid, dados').then(function (rs) {
          var o = {}; rs.forEach(function (r) { o[r.uid] = r.dados; }); return o;
        });
      },
      salvar: function (v) {
        v = v || {};
        var linhas = Object.keys(v).map(function (uid) {
          return { household_id: hid(), uid: uid, dados: v[uid], atualizado_em: new Date().toISOString() };
        });
        var p = linhas.length
          ? cli().from('overrides').upsert(linhas, { onConflict: 'household_id,uid' }).then(function (r) { if (r.error) throw r.error; })
          : Promise.resolve();
        return p.then(function () {
          var antigos = Object.keys(espelho.overrides || {}).filter(function (u) { return !(u in v); });
          if (!antigos.length) return;
          return cli().from('overrides').delete().eq('household_id', hid()).in('uid', antigos)
            .then(function (r) { if (r.error) throw r.error; });
        });
      }
    },
    /* lancamentos vindos de CSV */
    importados: {
      carregar: function () {
        return lerTabela('transacoes').then(function (rs) {
          return rs.map(function (l) { return paraObjeto(l, COLS_TX); });
        });
      },
      salvar: function (v) { return salvarColecaoTx('transacoes', v, COLS_TX); }
    },
    /* ACABEI DE GASTAR */
    gastei: {
      carregar: function () {
        return lerTabela('gastos').then(function (rs) {
          return rs.map(function (l) { return paraObjeto(l, COLS_TX); });
        });
      },
      salvar: function (v) { return salvarColecaoTx('gastos', v, COLS_TX); }
    },
    orcamentos: {
      carregar: function () {
        return lerTabela('orcamentos', 'perfil, dados').then(function (rs) {
          if (!rs.length) return null;
          var o = {}; rs.forEach(function (r) { o[r.perfil] = r.dados; }); return o;
        });
      },
      salvar: function (v) {
        v = v || {};
        var linhas = Object.keys(v).map(function (p) { return { household_id: hid(), perfil: p, dados: v[p] }; });
        return regravar('orcamentos', linhas);
      }
    },
    fechamentos: {
      carregar: function () {
        return lerTabela('fechamentos', 'mes').then(function (rs) { return rs.map(function (r) { return r.mes; }); });
      },
      salvar: function (v) {
        return regravar('fechamentos', (v || []).map(function (m) { return { household_id: hid(), mes: m }; }));
      }
    },
    transferencias: {
      carregar: function () {
        return lerTabela('transferencias', 'chave').then(function (rs) {
          var o = {}; rs.forEach(function (r) { o[r.chave] = 1; }); return o;
        });
      },
      salvar: function (v) {
        v = v || {};
        return regravar('transferencias', Object.keys(v).map(function (k) { return { household_id: hid(), chave: k }; }));
      }
    },
    contribuicoes: {
      carregar: function () {
        return lerTabela('contribuicoes', 'dados, ordem').then(function (rs) {
          return rs.sort(function (a, b) { return a.ordem - b.ordem; }).map(function (r) { return r.dados; });
        });
      },
      salvar: function (v) {
        return regravar('contribuicoes', (v || []).map(function (d, i) {
          return { household_id: hid(), ordem: i, dados: d };
        }));
      }
    },
    revisados: {
      carregar: function () {
        return lerTabela('revisados', 'uid').then(function (rs) {
          var o = {}; rs.forEach(function (r) { o[r.uid] = 1; }); return o;
        });
      },
      salvar: function (v) {
        v = v || {};
        return regravar('revisados', Object.keys(v).map(function (u) { return { household_id: hid(), uid: u }; }));
      }
    }
  };

  function lerPref(campo) {
    return cli().from('preferencias').select(campo).eq('user_id', ctx.userId).maybeSingle()
      .then(function (r) { if (r.error) throw r.error; return r.data ? r.data[campo] : null; });
  }
  function salvarPref(campo, valor) {
    var l = { user_id: ctx.userId, household_id: hid(), atualizado_em: new Date().toISOString() };
    l[campo] = valor;
    return cli().from('preferencias').upsert(l, { onConflict: 'user_id' })
      .then(function (r) { if (r.error) throw r.error; });
  }

  /* ---------- carga inicial e sincronizacao ---------- */
  function carregarTudo() {
    var ks = Object.keys(ADAPTADORES);
    return Promise.all(ks.map(function (k) {
      return ADAPTADORES[k].carregar().catch(function (e) { erro(e); return null; });
    })).then(function (vals) {
      ks.forEach(function (k, i) { cache[k] = vals[i]; espelho[k] = clone(vals[i]); });
      return true;
    });
  }

  var recarregando = false, pedido = false;
  function recarregar() {
    if (!ctx.householdId) return Promise.resolve(false);
    if (recarregando) { pedido = true; return Promise.resolve(false); }
    recarregando = true;
    return carregarTudo().then(function () {
      recarregando = false;
      if (pedido) { pedido = false; return recarregar(); }
      ouvintes.forEach(function (f) { try { f(); } catch (e) { erro(e); } });
      return true;
    }).catch(function (e) { recarregando = false; erro(e); return false; });
  }

  var deb = null;
  function recarregarEmBreve() {
    if (deb) clearTimeout(deb);
    deb = setTimeout(function () { deb = null; recarregar(); }, 700);
  }

  function assinarRealtime() {
    try {
      var canal = cli().channel('nuna-' + hid());
      ['base_documento', 'transacoes', 'gastos', 'overrides', 'orcamentos',
       'transferencias', 'fechamentos', 'contribuicoes', 'revisados'].forEach(function (t) {
        canal.on('postgres_changes',
          { event: '*', schema: 'public', table: t, filter: 'household_id=eq.' + hid() },
          function () { if (!gravando) recarregarEmBreve(); });
      });
      canal.subscribe();
    } catch (e) { erro(e); }
  }

  /* Chamado pelo boot com a sessao do Auth. */
  function iniciar(sessao) {
    ctx.userId = sessao.userId;
    ctx.householdId = sessao.householdId;
    ctx.perfil = sessao.perfil;
    return carregarTudo().then(function () {
      assinarRealtime();
      window.addEventListener('focus', recarregarEmBreve);
      document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'visible') recarregarEmBreve();
      });
      return true;
    });
  }

  function aoAtualizar(cb) { if (typeof cb === 'function') ouvintes.push(cb); }
  function base() { return cache.base || null; }
  function definirBase(json) { set('base', json); return descarregarAgora(); }
  function descarregarAgora() {
    if (timer) { clearTimeout(timer); timer = null; }
    descarregar();
    return new Promise(function (res) {
      (function espera() {
        if (!gravando && !Object.keys(pendentes).length) return res(true);
        setTimeout(espera, 120);
      })();
    });
  }

  return {
    get: get, set: set, remove: remove, chaves: chaves,
    exportarTudo: exportarTudo, importarTudo: importarTudo,
    iniciar: iniciar, recarregar: recarregar, aoAtualizar: aoAtualizar,
    base: base, definirBase: definirBase, sincronizar: descarregarAgora,
    contexto: ctx, disponivel: true, prefixo: NS
  };
})();

/* Chaves usadas pelo app — centralizadas para facilitar migracao */
var K = {
  SESSAO:      'sessao',
  CONTRIB:     'contribuicoes',
  TEMA:        'tema',
  PREFS:       'prefs',
  OVERRIDES:   'overrides',
  ORCAMENTOS:  'orcamentos',
  GASTEI:      'gastei',
  IMPORTADOS:  'importados',
  FECHAMENTOS: 'fechamentos',
  TRANSF:      'transferencias'
};
