/* Regras por descricao da importacao. Rodar com: node --test tests/ */
var test = require('node:test');
var assert = require('node:assert');
var fs = require('fs');
var path = require('path');
var vm = require('vm');

function carregar(listas) {
  var c = { console: console, catLista: function (p) { return listas[p] || []; } };
  vm.createContext(c);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'csv.js'), 'utf8') + '\nthis.classificar = classificarDescricao;', c);
  return c.classificar;
}

test('regras por descricao: tipo e categoria do perfil', function () {
  var cl = carregar({ Ana: ['Carro', 'Lazer & Viagem', 'Outros'], Manuela: ['Transporte', 'Outros'] });
  var r = function (d, p) { var x = cl(d, p); return x ? [x.tipo, x.plano, x.sub] : null; };
  assert.deepStrictEqual(r('UBER * PENDING', 'Ana'), ['Uber / transporte', 'Carro', 'Uber/99']);
  assert.deepStrictEqual(r('UBER * PENDING', 'Manuela'), ['Uber / transporte', 'Transporte', 'Uber/99']);
  assert.deepStrictEqual(r('99APP *99POP', 'Ana'), ['Uber / transporte', 'Carro', 'Uber/99']);
  assert.deepStrictEqual(r('NETFLIX.COM', 'Ana'), ['Streaming', 'Lazer & Viagem', 'Streaming']);
  /* categoria que nao existe na lista do perfil: so o tipo muda */
  assert.deepStrictEqual(r('NETFLIX.COM', 'Manuela'), ['Streaming', 'Outros', '']);
  ['DISNEY PLUS', 'AMAZON PRIME BR', 'PRIMEVIDEO', 'SPOTIFY', 'HBOMAX', 'MAX.COM'].forEach(function (d) { assert.strictEqual(r(d, 'Ana')[0], 'Streaming', d); });
  ['UBER EATS', 'Uber *Eats', '99PAY *BOLETO', 'AMAZON MARKETPLACE', 'MAXXI ATACADO', 'PADARIA'].forEach(function (d) { assert.strictEqual(r(d, 'Ana'), null, d); });
});
