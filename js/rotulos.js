/* ============================================================
   NuNa · rotulos.js — acentos so no texto exibido.
   O valor guardado (tipo/categoria nos lancamentos, ajustes, orcamento,
   value dos seletores) continua igual; muda apenas o que aparece na tela.
   Para incluir outro nome: acrescente "guardado": "exibido" em ROTULOS.
   ============================================================ */
var ROTULOS = {
  'Alimentacao Fora': 'Alimentação Fora',
  'Saude': 'Saúde',
  'Emprestimo consignado': 'Empréstimo consignado',
  'Material de construcao': 'Material de construção',
  'Aluguel+Agua': 'Aluguel+Água',
  'SAAE (agua)': 'SAAE (água)',
  'Contribuicao NuNa': 'Contribuição NuNa',
  'Transferencia a pessoas': 'Transferência a pessoas',
  'Conta telefonica': 'Conta telefônica'
};
/* texto exibido de um tipo/categoria */
function rotuloExib(s) { return Object.prototype.hasOwnProperty.call(ROTULOS, s) ? ROTULOS[s] : s; }
/* caminho inverso, para codigo que le o nome da tela (ex.: tabela do Orcamento) */
function rotuloGuardado(s) {
  for (var k in ROTULOS) if (ROTULOS[k] === s) return k;
  return s;
}

(function () {
  var nomes = Object.keys(ROTULOS).sort(function (a, b) { return b.length - a.length; });
  var esc = function (s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); };
  /* nome inteiro, sem letra colada antes ou depois (nao mexe em "Saudeplus") */
  var RE = new RegExp('(^|[^A-Za-zÀ-ÿ])(' + nomes.map(esc).join('|') + ')(?![A-Za-zÀ-ÿ])', 'g');
  var PULA = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, INPUT: 1 };

  function trocar(no) {
    var v = no.nodeValue;
    if (!v || v.length < 4) return;
    RE.lastIndex = 0;
    if (!RE.test(v)) return;
    var pai = no.parentNode;
    if (!pai || PULA[pai.nodeName]) return;
    /* <option> sem value usa o texto como valor: so troca se o value existir */
    if (pai.nodeName === 'OPTION' && !pai.hasAttribute('value')) return;
    RE.lastIndex = 0;
    var novo = v.replace(RE, function (m, a, n) { return a + ROTULOS[n]; });
    if (novo !== v) no.nodeValue = novo;
  }
  function varrer(raiz) {
    if (!raiz) return;
    if (raiz.nodeType === 3) { trocar(raiz); return; }
    if (raiz.nodeType !== 1 || PULA[raiz.nodeName]) return;
    var w = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT, null), n;
    while ((n = w.nextNode())) trocar(n);
  }
  function ligar() {
    varrer(document.body);
    new MutationObserver(function (lista) {
      lista.forEach(function (m) {
        if (m.type === 'characterData') trocar(m.target);
        else m.addedNodes.forEach(varrer);
      });
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
  }
  if (typeof document === 'undefined') return;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ligar); else ligar();
})();
