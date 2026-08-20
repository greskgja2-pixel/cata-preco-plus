'use strict';

const chromium = require('@sparticuz/chromium');
const { chromium: playwright } = require('playwright-core');
const { crawl } = require('../lib/crawler');
const { validatePublicUrl } = require('../lib/security');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });
  res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  const emit = payload => { if (!res.writableEnded) res.write(`${JSON.stringify(payload)}\n`); };
  const controller = new AbortController();
  req.on('aborted', () => controller.abort(new Error('Pesquisa cancelada pelo usuário.')));
  let browser;
  try {
    const supplier = String(req.body?.supplier || '').trim();
    if (supplier.length < 2 || supplier.length > 120) throw new Error('Informe o nome do fornecedor.');
    const url = await validatePublicUrl(req.body?.url);
    emit({ type: 'started', status: 'Iniciando navegador seguro…', percent: 1 });
    browser = await playwright.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true
    });
    const result = await crawl({ browser, startUrl: url.href, supplier, emit, signal: controller.signal });
    emit({ type: 'final', ...result, products: result.products.map(({ _url, ...product }) => product), percent: ['completed', 'no_results', 'login_required'].includes(result.status) ? 100 : undefined });
  } catch (error) {
    const cancelled = controller.signal.aborted;
    emit({ type: cancelled ? 'cancelled' : 'error', status: cancelled ? 'Pesquisa cancelada. Os itens já recebidos foram preservados.' : error.message });
  } finally {
    if (browser) await browser.close().catch(() => {});
    if (!res.writableEnded) res.end();
  }
};
