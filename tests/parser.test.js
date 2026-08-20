'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { parseMoney, packagingType, parseSnapshot } = require('../lib/parser');

test('converte preços brasileiros sem capturar símbolos isolados', () => {
  assert.equal(parseMoney('R$ 1.234,56'), 1234.56);
  assert.equal(parseMoney('R$ 1.234'), 1234);
  assert.equal(parseMoney('$ 19.99'), 19.99);
  assert.equal(parseMoney('R$'), null);
  assert.equal(parseMoney('0,00'), null);
});

test('classifica embalagem por conteúdo', () => {
  assert.equal(packagingType('Cabo USB', 'Caixa c/ 20 unidades'), 'Caixa Fechada');
  assert.equal(packagingType('Mouse sem fio', 'Venda por unidade'), 'Unidade');
});

test('extrai Product JSON-LD e mantém as sete colunas', () => {
  const product = parseSnapshot({
    url: 'https://loja.example/produto/cabo',
    jsonLd: [JSON.stringify({ '@type': 'Product', name: 'Cabo HDMI', description: 'Kit 2 peças', category: 'Cabos', image: '/cabo.webp', offers: { price: '19.90' } })],
    meta: {}
  }, 'Fornecedor');
  assert.equal(product['Nome do Produto'], 'Cabo HDMI');
  assert.equal(product['Custo do Produto'], 19.9);
  assert.equal(product['Tipo de Embalagem'], 'Caixa Fechada');
  assert.equal(product['Link da Imagem'], 'https://loja.example/cabo.webp');
  assert.equal(Object.keys(product).filter(key => !key.startsWith('_')).length, 7);
});

test('não salva página de categoria sem evidência de produto e preço', () => {
  assert.equal(parseSnapshot({ url: 'https://loja.example/categoria/cabos', jsonLd: [], meta: { title: 'Cabos' }, h1: 'Cabos', price: '' }, 'Fornecedor'), null);
});

test('produto sem preço obrigatório não é exportado como sucesso', () => {
  assert.equal(parseSnapshot({ url: 'https://loja.example/produto/cabo', jsonLd: [], meta: { title: 'Cabo' }, h1: 'Cabo' }, 'Fornecedor'), null);
});
