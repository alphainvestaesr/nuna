/* Migracao das categorias da Manuela. Rodar com: node --test tests/ */
var test = require('node:test');
var assert = require('node:assert');
var fs = require('fs');
var path = require('path');
var vm = require('vm');

function carregar() {
  var c = { console: console, CAT_UID: '__catalogo__' };
  vm.createContext(c);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'migracao-manuela.js'), 'utf8') + '\nthis.MigManuela = MigManuela;', c);
  return c.MigManuela;
}
function j(v) { return JSON.parse(JSON.stringify(v)); }
function tx(uid, mes, perfil, plano, tipo, valor, extra) {
  return Object.assign({ uid: uid, id: uid, mes: mes, data: '05/' + mes, perfil: perfil, plano: plano, sub: '', tipo: tipo, valor: valor,
    grupo: null, divisao: 'INDIVIDUAL', status: '', desc: plano + ' ' + uid }, extra || {});
}

test('Uber -> Transporte › Uber/99 e Terreno -> Patrimônio, sem mudar valor, data, tipo nem status', function () {
  var M = carregar();
  var base = { monthOrder: ['Mar', 'Abr'], catsPlano: { Ana: ['Uber', 'Terreno', 'Outros'], Manuela: ['Terreno', 'Uber', 'Outros'] },
    budgets: { Manuela: { Terreno: 850, Uber: 200, Outros: 10 }, Ana: { Terreno: 1, Uber: 2 } },
    months: {
      Mar: { transactions: [tx('real-u1', 'Mar', 'Manuela', 'Uber', 'Uber / transporte', 23.4, { status: 'pode cancelar' }),
                            tx('real-t1', 'Mar', 'Manuela', 'Terreno', 'Terreno', 850),
                            tx('real-a1', 'Mar', 'Ana', 'Uber', 'Uber / transporte', 30)] },
      Abr: { transactions: [tx('real-u2', 'Abr', 'Manuela', 'Cartao Bradesco', 'Uber / transporte', 12),
                            tx('real-t2', 'Abr', 'Manuela', 'Terreno', 'Terreno', 850)] } } };
  /* o que a tela mostra depois de carregar: o cartao como categoria ja virou Uber */
  var tela = j(base); tela.months.Abr.transactions[0].plano = 'Uber';
  var ov = { 'real-u1': { plano: 'Uber', sub: '', tipo: 'Uber / transporte', grupo: null, divisao: 'INDIVIDUAL', status: 'pode cancelar', revisar: false },
             'real-a1': { plano: 'Uber', sub: '', tipo: 'Uber / transporte', revisar: false },
             '__catalogo__': { cats: { Manuela: ['Uber', 'Pilates'] }, subs: { Manuela: { Uber: ['Noite'] } }, cores: {} } };
  var gastei = [{ id: 'g1', perfil: 'Manuela', categoria: 'Uber', divisao: 'INDIVIDUAL', valor: 9, data: '2026-04-02' },
                { id: 'g2', perfil: 'Ana', categoria: 'Uber', divisao: 'INDIVIDUAL', valor: 9 }];
  var orc = { Manuela: { Terreno: 850, Uber: 200 }, Ana: { Uber: 5 } };

  var lista = j(M.lancamentos(tela)).concat(j(M.gastos(gastei)));
  assert.strictEqual(lista.length, 5);
  assert.deepStrictEqual(lista.map(function (x) { return x.uid + ':' + x.novaCat + '/' + x.novaSub; }),
    ['real-u1:Transporte/Uber/99', 'real-t1:Patrimônio/', 'real-u2:Transporte/Uber/99', 'real-t2:Patrimônio/', 'g1:Transporte/Uber/99']);

  var antes = JSON.stringify(base);
  var r = j(M.aplicarEm({ base: base, importados: [], overrides: ov, orcamentos: orc, gastei: gastei }, lista));
  assert.strictEqual(JSON.stringify(base), antes, 'nao altera o original');

  var t = {}; r.base.monthOrder.forEach(function (m) { r.base.months[m].transactions.forEach(function (x) { t[x.uid] = x; }); });
  assert.deepStrictEqual([t['real-u1'].plano, t['real-u1'].sub, t['real-u1'].tipo, t['real-u1'].valor, t['real-u1'].status], ['Transporte', 'Uber/99', 'Uber / transporte', 23.4, 'pode cancelar']);
  assert.deepStrictEqual([t['real-u2'].plano, t['real-u2'].sub, t['real-u2'].tipo], ['Transporte', 'Uber/99', 'Uber / transporte']);
  assert.deepStrictEqual([t['real-t1'].plano, t['real-t1'].tipo, t['real-t1'].valor], ['Patrimônio', 'Terreno', 850]);
  assert.strictEqual(t['real-a1'].plano, 'Uber', 'Ana nao muda');
  assert.deepStrictEqual([r.overrides['real-u1'].plano, r.overrides['real-u1'].sub, r.overrides['real-u1'].status], ['Transporte', 'Uber/99', 'pode cancelar']);
  assert.strictEqual(r.overrides['real-a1'].plano, 'Uber');
  /* catalogo: so na lista da Manuela */
  assert.deepStrictEqual(r.base.catsPlano.Manuela, ['Transporte', 'Patrimônio', 'Outros']);
  assert.deepStrictEqual(r.base.catsPlano.Ana, ['Uber', 'Terreno', 'Outros']);
  assert.deepStrictEqual(r.overrides.__catalogo__.cats.Manuela, ['Pilates']);
  assert.deepStrictEqual(r.overrides.__catalogo__.subs.Manuela, { Transporte: ['Noite', 'Uber/99'] });
  /* orcamento */
  assert.deepStrictEqual(r.base.budgets.Manuela, { Outros: 10, 'Patrimônio': 850, Transporte: 200 });
  assert.deepStrictEqual(r.orcamentos.Manuela, { 'Patrimônio': 850, Transporte: 200 });
  assert.deepStrictEqual(r.base.budgets.Ana, { Terreno: 1, Uber: 2 });
  assert.deepStrictEqual(r.orcamentos.Ana, { Uber: 5 });
  /* Acabei de Gastar */
  assert.deepStrictEqual([r.gastei[0].categoria, r.gastei[0].sub], ['Transporte', 'Uber/99']);
  assert.strictEqual(r.gastei[1].categoria, 'Uber');
  /* nada removido, nenhum valor mudou */
  assert.strictEqual(Object.keys(t).length, 5);
  var soma = function (b) { var s = 0; b.monthOrder.forEach(function (m) { b.months[m].transactions.forEach(function (x) { s += x.valor; }); }); return s; };
  assert.strictEqual(soma(r.base), soma(base));
});
