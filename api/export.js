'use strict';

const ExcelJS = require('exceljs');

const COLUMNS = ['Nome do Fornecedor', 'Nome do Produto', 'Custo do Produto', 'Categoria do Produto', 'Descrição do Produto', 'Tipo de Embalagem', 'Link da Imagem'];

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });
  const products = Array.isArray(req.body?.products) ? req.body.products.slice(0, 10000) : [];
  if (!products.length) return res.status(400).json({ error: 'Não há produtos para exportar.' });
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet('Catálogo');
  const widths = [24, 44, 18, 28, 60, 20, 60];
  sheet.columns = COLUMNS.map((header, index) => ({ header, key: header, width: widths[index] }));
  for (const product of products) sheet.addRow(Object.fromEntries(COLUMNS.map(column => [column, product[column] ?? ''])));
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  const data = Buffer.from(await book.xlsx.writeBuffer());
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="catalogo-cata-preco.xlsx"');
  res.send(data);
};
