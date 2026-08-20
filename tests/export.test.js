'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const ExcelJS = require('exceljs');
const handler = require('../api/export');

test('exporta XLSX válido com as sete colunas exatas', async () => {
  let buffer;
  const req = { method: 'POST', body: { products: [{
    'Nome do Fornecedor': 'Árvore', 'Nome do Produto': 'Cabo', 'Custo do Produto': 19.9,
    'Categoria do Produto': 'Cabos', 'Descrição do Produto': 'Descrição',
    'Tipo de Embalagem': 'Unidade', 'Link da Imagem': 'https://example.com/a.webp', indevido: 'não exportar'
  }] } };
  const res = { headers: {}, setHeader(key, value) { this.headers[key] = value; }, send(value) { buffer = value; } };
  await handler(req, res);
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(buffer);
  const sheet = book.getWorksheet('Catálogo');
  assert.deepEqual(sheet.getRow(1).values.slice(1), ['Nome do Fornecedor', 'Nome do Produto', 'Custo do Produto', 'Categoria do Produto', 'Descrição do Produto', 'Tipo de Embalagem', 'Link da Imagem']);
  assert.equal(sheet.getRow(2).getCell(1).value, 'Árvore');
  assert.equal(sheet.columnCount, 7);
});
