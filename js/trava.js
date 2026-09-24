/* ============================================================
   NuNa · trava.js — pede a senha OU o desbloqueio do aparelho
   (Face ID, digital ou codigo do celular) sempre que o NuNa e aberto.
   - Toda abertura nova (app reaberto, aba nova) comeca TRAVADA.
   - Com o desbloqueio do aparelho ativado NESTE aparelho: aparece a
     tela de desbloqueio (WebAuthn com verificacao do usuario).
   - Sem ele: a sessao e encerrada e a senha e pedida na tela de acesso.
   - Recarregar a pagina na mesma sessao nao pede de novo; ficar mais
     de 5 minutos em segundo plano trava outra vez.
   Obs.: e uma trava do aparelho. A protecao dos dados continua sendo
   o login do Supabase + as regras de acesso (RLS) do banco.
   ============================================================ */
var Trava = (function () {
  var K_OK = 'nuna.v1.desbloqueado', K_FORA = 'nuna.v1.saiuEm';
  var PFX = 'nuna.v1.chaveAparelho.', K_NAO = 'nuna.v1.chaveAparelho.recusou.';
  var LIMITE = 5 * 60 * 1000;

  function ss() { try { return window.sessionStorage; } catch (e) { return null; } }
  function ls() { try { return window.localStorage; } catch (e) { return null; } }
  function ler(st, k) { try { return st ? st.getItem(k) : null; } catch (e) { return null; } }
  function gravar(st, k, v) { try { if (st) st.setItem(k, v); } catch (e) {} }
  function apagar(st, k) { try { if (st) st.removeItem(k); } catch (e) {} }
  function marcar() { gravar(ss(), K_OK, String(Date.now())); }
  function desmarcar() { apagar(ss(), K_OK); }
  function destravado() { return !!ler(ss(), K_OK); }
  function ehApp() { return /app\.html/.test(location.pathname); }
  function suporta() { return !!(window.PublicKeyCredential && navigator.credentials && navigator.credentials.create && window.crypto && crypto.getRandomValues); }
  function chaveDe(uid) { return ler(ls(), PFX + uid); }
  function escT(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); }
  function aviso(m) { if (typeof flashToast === 'function') flashToast(m); }
  function b64(buf) { var s = '', b = new Uint8Array(buf); for (var i = 0; i < b.length; i++) s += String.fromCharCode(b[i]); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
  function deb64(str) { str = str.replace(/-/g, '+').replace(/_/g, '/'); while (str.length % 4) str += '='; var s = atob(str), b = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) b[i] = s.charCodeAt(i); return b; }
  function aleatorio(n) { var b = new Uint8Array(n); crypto.getRandomValues(b); return b; }
  /* apaga o login guardado neste aparelho (sem derrubar os outros aparelhos) */
  function limparTokens() {
    var l = ls();
    try { Object.keys(l).forEach(function (k) { if (/^sb-.*-auth-token/.test(k)) l.removeItem(k); }); } catch (e) {}
    try { Auth.cliente().auth.stopAutoRefresh(); } catch (e) {}
  }
  function sairLocal() {
    desmarcar();
    var c = null; try { c = Auth.cliente(); } catch (e) {}
    var p = c ? Promise.race([c.auth.signOut({ scope: 'local' }).catch(function () {}), new Promise(function (r) { setTimeout(r, 2500); })]) : Promise.resolve();
    return p.then(limparTokens);
  }

  /* registra o Face ID / digital / codigo deste aparelho para esta usuaria */
  function ativar(sessao) {
    if (!suporta()) return Promise.reject(new Error('Este aparelho ou navegador não oferece desbloqueio por Face ID ou digital.'));
    return navigator.credentials.create({ publicKey: {
      challenge: aleatorio(32),
      rp: { name: 'NuNa', id: location.hostname },
      user: { id: new TextEncoder().encode(String(sessao.userId).slice(0, 64)), name: sessao.email || sessao.nome || 'NuNa', displayName: 'NuNa · ' + (sessao.nome || sessao.perfil) },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
      timeout: 60000, attestation: 'none'
    } }).then(function (cred) {
      gravar(ls(), PFX + sessao.userId, b64(cred.rawId));
      apagar(ls(), K_NAO + sessao.userId);
      return true;
    });
  }
  function desativar(sessao) { apagar(ls(), PFX + sessao.userId); }
  function verificar(uid) {
    return navigator.credentials.get({ publicKey: {
      challenge: aleatorio(32), rpId: location.hostname,
      allowCredentials: [{ type: 'public-key', id: deb64(chaveDe(uid)) }],
      userVerification: 'required', timeout: 60000
    } });
  }

  /* tela de desbloqueio (o toque no botao e exigido pelo iPhone/iPad) */
  function tela(sessao) {
    return new Promise(function (ok) {
      var d = document.createElement('div'); d.id = 'trava';
      d.style.cssText = 'position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;padding:24px;background:#0b0b0c;color:#f3ead2;text-align:center';
      d.innerHTML = '<div style="max-width:340px;width:100%">' +
        '<img src="assets/icon-192.png" alt="" style="width:112px;height:112px;border-radius:24px;margin-bottom:16px">' +
        '<h2 style="margin:0 0 6px;font-weight:600;letter-spacing:.06em">NuNa</h2>' +
        '<p style="margin:0 0 22px;opacity:.8;font-size:14px">Olá, ' + escT(sessao.nome || sessao.perfil) + '. Desbloqueie para continuar.</p>' +
        '<button id="trava-ok" type="button" style="width:100%;padding:14px;border:0;border-radius:12px;background:#C9A227;color:#1a1405;font-weight:700;font-size:15px;cursor:pointer">Desbloquear com Face ID / digital / código</button>' +
        '<p id="trava-msg" style="min-height:18px;margin:12px 0;font-size:13px;color:#f0a8a8"></p>' +
        '<button id="trava-senha" type="button" style="background:none;border:0;color:#f3ead2;text-decoration:underline;font-size:14px;cursor:pointer">Entrar com senha</button>' +
        '</div>';
      document.body.appendChild(d);
      var msg = d.querySelector('#trava-msg');
      d.querySelector('#trava-ok').onclick = function () {
        msg.textContent = '';
        verificar(sessao.userId).then(function () { marcar(); d.remove(); ok(sessao); })
          .catch(function () { msg.textContent = 'Não foi possível desbloquear. Tente de novo ou entre com a senha.'; });
      };
      d.querySelector('#trava-senha').onclick = function () { sairLocal().then(function () { location.replace(Auth.porta); }); };
    });
  }

  /* chamada no boot do app: so libera depois da senha ou do desbloqueio */
  function garantir(sessao) {
    if (!sessao || destravado()) return Promise.resolve(sessao);
    if (chaveDe(sessao.userId) && suporta()) return tela(sessao);
    return sairLocal().then(function () {
      location.replace(Auth.porta);
      return new Promise(function () {});
    });
  }

  /* depois de entrar com senha, oferece ativar o desbloqueio do aparelho */
  function oferecer(sessao) {
    if (!sessao || !suporta() || chaveDe(sessao.userId) || ler(ls(), K_NAO + sessao.userId)) return;
    if (!PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable) return;
    PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable().then(function (tem) {
      if (!tem || document.getElementById('trava-oferta')) return;
      var b = document.createElement('div'); b.id = 'trava-oferta';
      b.style.cssText = 'position:fixed;left:12px;right:12px;bottom:12px;z-index:9999;max-width:520px;margin:0 auto;padding:14px 16px;border-radius:14px;background:#1B4332;color:#fff;box-shadow:0 8px 30px rgba(0,0,0,.25);font-size:14px;line-height:1.4';
      b.innerHTML = '<b>Desbloqueio rápido</b><br>Quer abrir o NuNa neste aparelho com Face ID, digital ou o código do celular, em vez da senha?' +
        '<div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">' +
        '<button id="to-sim" type="button" style="padding:8px 14px;border:0;border-radius:10px;background:#C9A227;color:#1a1405;font-weight:700;cursor:pointer">Ativar</button>' +
        '<button id="to-nao" type="button" style="padding:8px 14px;border:1px solid rgba(255,255,255,.5);border-radius:10px;background:none;color:#fff;cursor:pointer">Agora não</button></div>';
      document.body.appendChild(b);
      b.querySelector('#to-sim').onclick = function () {
        ativar(sessao).then(function () { b.remove(); aviso('Desbloqueio ativado neste aparelho.'); renderSeguranca(); })
          .catch(function () { aviso('Não foi possível ativar agora. Você pode tentar depois na aba Dados.'); });
      };
      b.querySelector('#to-nao').onclick = function () { gravar(ls(), K_NAO + sessao.userId, '1'); b.remove(); };
    });
  }

  /* bloco "Seguranca deste aparelho" na aba Dados */
  function renderSeguranca() {
    var p = document.getElementById('panel-dados'), s = (typeof Auth !== 'undefined') && Auth.sessao();
    if (!p || !s) return;
    var c = document.getElementById('trava-card');
    if (!c) { c = document.createElement('div'); c.className = 'card'; c.id = 'trava-card'; c.style.marginTop = '16px'; p.appendChild(c); }
    var tem = !!chaveDe(s.userId);
    c.innerHTML = '<h3>Segurança deste aparelho</h3>' +
      '<p class="note">O NuNa pede a senha ou o desbloqueio do aparelho toda vez que é aberto, e de novo se ficar mais de 5 minutos em segundo plano. ' +
      (tem ? 'Neste aparelho está <b>ativado</b> o desbloqueio por Face ID / digital / código.' : 'Neste aparelho é pedida a <b>senha</b>.') + '</p>' +
      (suporta() ? '<button class="pill" id="trava-tg" type="button">' + (tem ? 'Desativar desbloqueio do aparelho' : 'Ativar Face ID / digital / código') + '</button>'
        : '<p class="note">Este navegador não oferece desbloqueio do aparelho; a senha será pedida.</p>');
    var bt = document.getElementById('trava-tg');
    if (bt) bt.onclick = function () {
      if (tem) { desativar(s); aviso('Desbloqueio do aparelho desativado. A senha será pedida.'); renderSeguranca(); }
      else ativar(s).then(function () { aviso('Desbloqueio ativado neste aparelho.'); renderSeguranca(); })
        .catch(function () { aviso('Não foi possível ativar agora.'); });
    };
  }

  /* trava de novo depois de 5 minutos em segundo plano */
  document.addEventListener('visibilitychange', function () {
    if (!ehApp()) return;
    if (document.hidden) { gravar(ss(), K_FORA, String(Date.now())); return; }
    var t = +(ler(ss(), K_FORA) || 0);
    if (t && Date.now() - t > LIMITE && destravado()) { desmarcar(); location.reload(); }
  });

  /* liga nas funcoes de acesso */
  if (typeof Auth !== 'undefined') {
    var _entrar = Auth.entrar;
    Auth.entrar = function () { return _entrar.apply(Auth, arguments).then(function (s) { marcar(); return s; }); };
    /* sair so deste aparelho (nao derruba o login dos outros aparelhos) */
    Auth.sair = function () { return sairLocal(); };
    if (!ehApp()) {
      /* tela de acesso: so segue direto para o app se este aparelho ja estiver liberado
         ou tiver o desbloqueio ativado; senao mostra o login (evita o vai-e-volta) */
      var _iniIdx = Auth.iniciar;
      Auth.iniciar = function () {
        return _iniIdx.apply(Auth, arguments).then(function (s) {
          if (!s || destravado() || chaveDe(s.userId)) return s;
          limparTokens(); return null;
        }, function () { limparTokens(); return null; });
      };
    }
    if (ehApp()) {
      var _iniciar = Auth.iniciar, memo = null;
      Auth.iniciar = function () {
        if (memo) return memo;
        memo = _iniciar.apply(Auth, arguments).then(garantir).then(function (s) {
          if (s) setTimeout(function () { oferecer(s); }, 2500);
          return s;
        });
        return memo;
      };
    }
  }
  /* bloco de seguranca aparece na aba Dados */
  if (typeof renderDados === 'function') {
    var _rd = renderDados;
    renderDados = function () { _rd.apply(this, arguments); try { renderSeguranca(); } catch (e) {} };
  }

  return { ativar: ativar, desativar: desativar, garantir: garantir, destravado: destravado, renderSeguranca: renderSeguranca };
})();
