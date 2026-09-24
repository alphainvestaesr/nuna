/* ============================================================
   NuNa · auth.js — Supabase Auth (e-mail e senha)
   Sessao persistente no aparelho (localStorage do supabase-js).
   Nao existe cadastro: as contas sao criadas no painel do Supabase.
   A verificacao real de acesso aos dados e feita pelo RLS do banco.
   ============================================================ */
var Auth = (function () {
  var sb = null, _sessao = null, _iniciado = null;
  var PORTA = 'index.html';

  function cliente() {
    if (sb) return sb;
    if (typeof supabase === 'undefined' || !window.NUNA_SUPABASE) return null;
    sb = supabase.createClient(NUNA_SUPABASE.url, NUNA_SUPABASE.anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    return sb;
  }

  /* Le o vinculo da usuaria logada: perfil (Ana / Manuela) e household. */
  function carregarMembro(user) {
    return cliente().from('membros')
      .select('perfil, nome, household_id')
      .eq('id', user.id).maybeSingle()
      .then(function (r) {
        if (r.error) throw r.error;
        var m = r.data;
        if (!m) throw new Error('Esta conta ainda nao esta ligada a um household. Rode o seed do schema.sql.');
        _sessao = {
          usuario: user.email,
          email: user.email,
          nome: m.nome || m.perfil,
          perfil: m.perfil,
          userId: user.id,
          householdId: m.household_id
        };
        return _sessao;
      });
  }

  /* Resolve com a sessao (ou null). Chame uma vez no boot. */
  function iniciar() {
    if (_iniciado) return _iniciado;
    var c = cliente();
    if (!c) return Promise.reject(new Error('supabase-js nao carregou ou a chave publica nao foi preenchida em js/supabase-config.js.'));
    _iniciado = c.auth.getSession().then(function (r) {
      var s = r && r.data && r.data.session;
      if (!s || !s.user) { _sessao = null; return null; }
      return carregarMembro(s.user);
    });
    c.auth.onAuthStateChange(function (evt) {
      /* so volta para o acesso se estiver DENTRO do app; na propria tela de acesso
       recarregar causaria um vai-e-volta (principalmente no iPhone) */
    if (evt === 'SIGNED_OUT') { _sessao = null; if (/app\.html/.test(location.pathname)) location.replace(PORTA); }
    });
    return _iniciado;
  }

  function entrar(email, senha) {
    var c = cliente();
    if (!c) return Promise.reject(new Error('supabase-js nao carregou.'));
    return c.auth.signInWithPassword({ email: String(email || '').trim(), password: String(senha || '') })
      .then(function (r) {
        if (r.error) throw r.error;
        return carregarMembro(r.data.user);
      });
  }

  function recuperarSenha(email) {
    var c = cliente();
    if (!c) return Promise.reject(new Error('supabase-js nao carregou.'));
    return c.auth.resetPasswordForEmail(String(email || '').trim(), { redirectTo: location.href });
  }

  function sair() {
    var c = cliente();
    _sessao = null;
    if (!c) return Promise.resolve();
    return c.auth.signOut().catch(function () {});
  }

  /* Sincrono: o resto do app continua chamando Auth.sessao() como antes. */
  function sessao() { return _sessao; }

  function exigirSessao() {
    if (_sessao) return true;
    location.replace(PORTA);
    return false;
  }

  return {
    cliente: cliente, iniciar: iniciar, entrar: entrar, sair: sair,
    sessao: sessao, exigirSessao: exigirSessao, recuperarSenha: recuperarSenha,
    porta: PORTA
  };
})();
