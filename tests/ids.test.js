/* Testes de ids de lancamentos. Rodar com: node --test tests/ */
var test = require('node:test');
var assert = require('node:assert');
var fs = require('fs');
var path = require('path');
var vm = require('vm');

/* carrega js/csv.js com um Store em memoria e uma base minima */
function ambiente(base) {
  var mem = {};
  var ctx = {
    console: console,
    K: { IMPORTADOS: 'importados' },
    Store: { get: function (k, p) { return mem[k] === undefined ? p : mem[k]; }, set: function (k, v) { mem[k] = v; } },
    MONTHS: base.monthOrder,
    DATA: base
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'csv.js'), 'utf8') + '\nthis.CSV = CSV;', ctx);
  return ctx;
}
function tx(mes, uid, dedupKey, ordinal) {
  return { mes: mes, uid: uid, id: uid, dedupKey: dedupKey, ordinal: ordinal, valor: 10, data: '01/09/26', raw: 'X', desc: 'X', fonteLabel: 'F' };
}
function todos(base) {
  var a = [];
  base.monthOrder.forEach(function (m) { base.months[m].transactions.forEach(function (t) { a.push(t); }); });
  return a;
}

test('ids "real-" repetidos: 1o mantem o id, demais ganham hashCurto(dedupKey#ordinal)', function () {
  var base = { monthOrder: ['Ago', 'Set'], months: {
    Ago: { transactions: [
      tx('Ago', 'real-aaaa', 'Ago|F|01/08/26|PADARIA|10.00', 1),
      tx('Ago', 'real-aaaa', 'Ago|F|01/08/26|PADARIA|10.00', 2),
      tx('Ago', 'real-unico', 'Ago|F|02/08/26|POSTO|50.00', 1),
      tx('Ago', 'csv-12345678', 'Ago|F|03/08/26|LOJA|20.00', 1),
      tx('Ago', 'csv-12345678', 'Ago|F|03/08/26|LOJA|20.00', 1)
    ] },
    Set: { transactions: [
      tx('Set', 'real-aaaa', 'Set|F|01/09/26|MERCADO|30.00', 1),
      tx('Set', 'real-bbbb', 'Set|F|05/09/26|FARMACIA|15.00', 1),
      tx('Set', 'real-bbbb', 'Set|F|05/09/26|FARMACIA|15.00', 1)
    ] }
  } };
  var c = ambiente(base), h = c.CSV.hashCurto;
  var trocas = c.CSV.corrigirIdsRepetidos(base, []);
  var A = base.months.Ago.transactions, S = base.months.Set.transactions;

  assert.strictEqual(A[0].uid, 'real-aaaa');
  assert.strictEqual(A[1].uid, 'real-' + h('Ago|F|01/08/26|PADARIA|10.00#2'));
  assert.strictEqual(S[0].uid, 'real-' + h('Set|F|01/09/26|MERCADO|30.00#1'));
  assert.strictEqual(S[1].uid, 'real-bbbb');
  assert.strictEqual(S[2].uid, 'real-' + h('Set|F|05/09/26|FARMACIA|15.00#1'));
  assert.strictEqual(S[2].ordinal, 1);
  /* id e uid andam juntos */
  todos(base).forEach(function (t) { assert.strictEqual(t.id, t.uid); });
  /* "real-" sem repeticao e "csv-" nao mudam */
  assert.strictEqual(A[2].uid, 'real-unico');
  assert.strictEqual(A[3].uid, 'csv-12345678');
  assert.strictEqual(A[4].uid, 'csv-12345678');
  assert.strictEqual(trocas.length, 3);
  /* nenhum "real-" repetido sobra */
  var reais = todos(base).map(function (t) { return t.uid; }).filter(function (u) { return /^real-/.test(u); });
  assert.strictEqual(new Set(reais).size, reais.length);
  /* rodar de novo nao muda nada */
  var antes = JSON.stringify(base);
  assert.strictEqual(c.CSV.corrigirIdsRepetidos(base, []).length, 0);
  assert.strictEqual(JSON.stringify(base), antes);
});

test('id novo nao colide com ids ja em uso fora da base', function () {
  var k = 'Ago|F|01/08/26|PADARIA|10.00';
  var base = { monthOrder: ['Ago'], months: { Ago: { transactions: [tx('Ago', 'real-x', k, 1), tx('Ago', 'real-x', k, 2)] } } };
  var c = ambiente(base), h = c.CSV.hashCurto;
  c.CSV.corrigirIdsRepetidos(base, ['real-' + h(k + '#2')]);
  assert.strictEqual(base.months.Ago.transactions[1].uid, 'real-' + h(k + '#3'));
});

test('reimportar um arquivo ja importado nao duplica nem troca ids', function () {
  var base = { monthOrder: ['Set'], months: { Set: { transactions: [] } } };
  var c = ambiente(base);
  var csv = 'Data;Descricao;Valor\n01/09/2026;Posto Shell;100,00\n01/09/2026;Posto Shell;100,00\n02/09/2026;Padaria;12,50\n';
  var op = { fonte: 'Cartao Teste 1234 (Ana)', perfil: 'Ana', mesFatura: 'Set' };

  var r1 = c.CSV.preparar(c.CSV.ler(csv).linhas, op);
  assert.strictEqual(r1.novos.length, 3);
  c.CSV.aplicar(r1.novos);
  var ids1 = base.months.Set.transactions.map(function (t) { return t.uid; });
  assert.strictEqual(new Set(ids1).size, 3, 'repeticao legitima no mesmo dia ganha id proprio');

  var r2 = c.CSV.preparar(c.CSV.ler(csv).linhas, op);
  assert.strictEqual(r2.novos.length, 0);
  assert.strictEqual(r2.duplicados.length, 3);
  c.CSV.aplicar(r2.novos);
  assert.deepStrictEqual(base.months.Set.transactions.map(function (t) { return t.uid; }), ids1);
  assert.strictEqual(c.Store.get('importados').length, 3);

  /* arquivo maior com as mesmas linhas + uma nova: so a nova entra, ids antigos intactos */
  var r3 = c.CSV.preparar(c.CSV.ler(csv + '01/09/2026;Posto Shell;100,00\n').linhas, op);
  assert.strictEqual(r3.novos.length, 1);
  assert.strictEqual(ids1.indexOf(r3.novos[0].uid), -1);
  c.CSV.aplicar(r3.novos);
  assert.deepStrictEqual(base.months.Set.transactions.slice(0, 3).map(function (t) { return t.uid; }), ids1);
});

/* carrega csv.js + ids-repetidos.js (sem DOM) */
function ambienteMigracao(base) {
  var c = ambiente(base);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'ids-repetidos.js'), 'utf8') + '\nthis.IdsRepetidos = IdsRepetidos;', c);
  return c;
}

test('migracao copia ajustes (categoria, Conferido, status) para os ids novos e mantem as somas', function () {
  var k = 'Set|Cartao Bradesco 8338 (Ana)|22/08/26|LAVANDERIA|16.95';
  var lav = function (o) { var t = tx('Set', 'real-8d9d6c53', k, o); t.valor = 16.95; t.perfil = 'Ana'; t.plano = 'Outros'; t.revisar = true; return t; };
  var base = { monthOrder: ['Set'], months: { Set: { transactions: [lav(154), lav(155), lav(157), lav(158), tx('Set', 'real-disney01', 'Set|F|03/09/26|DISNEY PLUS|43.90', 1)] } } };
  var ov = { 'real-8d9d6c53': { plano: 'Lavanderia', sub: '', tipo: 'Outros', grupo: null, divisao: 'INDIVIDUAL', status: 'pode cancelar', revisar: false },
             'real-disney01': { plano: 'Lazer & Viagem', sub: 'Streaming', tipo: 'Streaming', revisar: false } };
  var c = ambienteMigracao(base), h = c.CSV.hashCurto;
  var antes = JSON.stringify(base);
  var r = c.IdsRepetidos.planejar(base, [], ov, null);

  assert.strictEqual(JSON.stringify(base), antes, 'planejar nao altera a base original');
  assert.strictEqual(r.trocas.length, 3);
  var ids = JSON.parse(JSON.stringify(r.base.months.Set.transactions.slice(0, 4).map(function (t) { return t.uid; })));
  assert.deepStrictEqual(ids, ['real-8d9d6c53', 'real-' + h(k + '#155'), 'real-' + h(k + '#157'), 'real-' + h(k + '#158')]);
  ids.forEach(function (u) { assert.deepStrictEqual(JSON.parse(JSON.stringify(r.overrides[u])), ov['real-8d9d6c53']); });
  assert.notStrictEqual(r.overrides[ids[1]], r.overrides[ids[0]], 'copias independentes');
  assert.deepStrictEqual(JSON.parse(JSON.stringify(r.overrides['real-disney01'])), ov['real-disney01']);
  assert.ok(r.somasIguais);
  assert.strictEqual(r.total, 5);
  assert.strictEqual(r.trocas[0].desc, 'X');
  assert.strictEqual(r.trocas[0].valor, 16.95);
});
