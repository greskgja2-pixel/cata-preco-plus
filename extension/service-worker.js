'use strict';

const PANEL_HOSTS = new Set(['cata-preco-plus.vercel.app', 'localhost', '127.0.0.1']);
let activeJob = null;
const recovery = chrome.storage.local.get('activeJob').then(({ activeJob: saved }) => {
  if (!saved) return;
  activeJob = { ...saved, paused: true, pauseReason: 'recovery' };
});

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const clean = value => String(value || '').replace(/\s+/g, ' ').trim();
const normalizeUrl = value => {
  const raw = clean(value);
  const url = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Use um endereço HTTP ou HTTPS.');
  return url;
};
const validPanel = sender => {
  try { const url = new URL(sender.tab?.url || sender.url || ''); return PANEL_HOSTS.has(url.hostname) || /^cata-preco-plus(?:-[a-z0-9-]+)?\.vercel\.app$/i.test(url.hostname); } catch { return false; }
};

async function sendPanel(payload) {
  if (!activeJob?.panelTabId) return;
  await chrome.tabs.sendMessage(activeJob.panelTabId, { channel: 'CATAPRECO_EXTENSION', ...payload }).catch(() => {});
}

function publicProduct(raw, job) {
  const numeric = clean(raw.price).replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3}(?:\D|$))/g, '').replace(',', '.');
  const price = Number(numeric);
  if (!raw.name || !Number.isFinite(price) || price <= 0) return null;
  const bulk = /\b(caixa|caxia|cx\.?|fardo|kit|pacote)\b|\bcont[eé]m\s*\d+|\bc\s*\/\s*\d+/i.test(`${raw.name} ${raw.description || ''}`);
  return {
    'Nome do Fornecedor': job.supplier,
    'Nome do Produto': clean(raw.name),
    'Custo do Produto': price,
    'Categoria do Produto': clean(job.currentCategory || ''),
    'Descrição do Produto': clean(raw.description || ''),
    'Tipo de Embalagem': bulk ? 'Caixa Fechada' : 'Unidade',
    'Link da Imagem': raw.image || '',
    _url: raw.url
  };
}

async function waitComplete(tabId, timeout = 30000) {
  const tab = await chrome.tabs.get(tabId);
  if (tab.status === 'complete') return;
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => { chrome.tabs.onUpdated.removeListener(listener); reject(new Error('Tempo limite ao carregar a página.')); }, timeout);
    const listener = (id, info) => { if (id === tabId && info.status === 'complete') { clearTimeout(timer); chrome.tabs.onUpdated.removeListener(listener); resolve(); } };
    chrome.tabs.onUpdated.addListener(listener);
  });
}

async function collectCurrentPage() {
  await waitComplete(activeJob.collectorTabId).catch(() => {});
  await sleep(900);
  let result;
  try {
    result = await chrome.tabs.sendMessage(activeJob.collectorTabId, { type: 'COLLECT_PAGE' });
  } catch {
    await chrome.scripting.executeScript({ target: { tabId: activeJob.collectorTabId }, files: ['content.js'] });
    result = await chrome.tabs.sendMessage(activeJob.collectorTabId, { type: 'COLLECT_PAGE' });
  }
  return result;
}

async function runJob() {
  while (activeJob && !activeJob.cancelled && activeJob.queue.length && activeJob.pages < activeJob.maxPages && activeJob.products.length < activeJob.maxProducts) {
    if (activeJob.paused) { await sleep(500); continue; }
    const current = activeJob.queue.shift();
    if (activeJob.productUrls.includes(current.url)) continue;
    if (activeJob.visited.includes(current.url)) continue;
    activeJob.visited.push(current.url);
    activeJob.pages = activeJob.visited.length;
    activeJob.currentCategory = current.category || '';
    await sendPanel({ type: 'progress', status: `Abrindo ${current.url}`, pages: activeJob.pages, products: activeJob.products.length, percent: Math.min(95, Math.round(activeJob.pages / activeJob.maxPages * 100)) });
    try {
      await chrome.tabs.update(activeJob.collectorTabId, { url: current.url, active: true });
      const result = await collectCurrentPage();
      if (!result?.ok) throw new Error(result?.error || 'A página não respondeu ao coletor.');
      if (activeJob.pages === 1 && result.url) activeJob.origin = new URL(result.url).origin;
      if (result.blocked) {
        activeJob.visited = activeJob.visited.filter(url => url !== current.url);
        activeJob.queue.unshift(current);
        activeJob.paused = true;
        activeJob.pauseReason = result.blocked;
        await chrome.storage.local.set({ activeJob });
        await sendPanel({ type: 'paused', reason: result.blocked, status: result.blocked === 'captcha' ? 'CAPTCHA detectado. Resolva na aba aberta e clique em Continuar.' : 'Login necessário. Entre na aba aberta e clique em Continuar.', pages: activeJob.pages, products: activeJob.products.length, diagnostics: result.diagnostics });
        continue;
      }
      for (const raw of result.products || []) {
        const product = publicProduct(raw, activeJob);
        if (!product || activeJob.productUrls.includes(product._url)) continue;
        activeJob.productUrls.push(product._url);
        activeJob.products.push(product);
        await sendPanel({ type: 'product', product, pages: activeJob.pages, products: activeJob.products.length });
        if (activeJob.products.length >= activeJob.maxProducts) break;
      }
      for (const link of result.links || []) {
        try {
          const url = new URL(link.url);
          if (url.origin !== activeJob.origin || activeJob.queued.includes(url.href) || activeJob.visited.includes(url.href)) continue;
          activeJob.queued.push(url.href);
          activeJob.queue.push({ url: url.href, category: link.category || activeJob.currentCategory });
          if (activeJob.queue.length >= activeJob.maxPages * 5) break;
        } catch { /* link inválido */ }
      }
      await chrome.storage.local.set({ activeJob });
      await sendPanel({ type: 'diagnostic', status: `${result.diagnostics?.cards || 0} produto(s), ${result.diagnostics?.prices || 0} preço(s) e ${result.diagnostics?.links || 0} link(s) vistos nesta página.`, diagnostics: result.diagnostics, pages: activeJob.pages, products: activeJob.products.length });
    } catch (error) {
      await sendPanel({ type: 'warning', status: `Página ignorada: ${error.message}`, url: current.url, pages: activeJob.pages, products: activeJob.products.length });
    }
  }
  if (!activeJob) return;
  const cancelled = activeJob.cancelled;
  const finalProducts = activeJob.products;
  const payload = { type: cancelled ? 'cancelled' : 'final', status: cancelled ? 'cancelled' : finalProducts.length ? 'completed' : 'no_results', diagnostic: cancelled ? 'Pesquisa cancelada. Os produtos já coletados foram preservados.' : finalProducts.length ? '' : 'Nenhum produto com nome e preço público foi encontrado. Consulte os diagnósticos mostrados durante a coleta.', pages: activeJob.pages, products: finalProducts, elapsedMs: Date.now() - activeJob.startedAt, percent: 100 };
  await sendPanel(payload);
  await chrome.storage.local.remove('activeJob');
  activeJob = null;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message?.channel || message.channel !== 'CATAPRECO_PANEL' || !validPanel(sender)) return;
  (async () => {
    await recovery;
    if (message.type === 'PING') return { ok: true, type: 'PONG', version: chrome.runtime.getManifest().version, running: Boolean(activeJob), paused: Boolean(activeJob?.paused), pages: activeJob?.pages || 0, products: activeJob?.products || [] };
    if (message.type === 'START') {
      if (activeJob) throw new Error('Já existe uma pesquisa em andamento.');
      const start = normalizeUrl(message.url);
      const supplier = clean(message.supplier);
      if (supplier.length < 2) throw new Error('Informe o nome do fornecedor.');
      const collector = await chrome.tabs.create({ url: start.href, active: true });
      activeJob = { id: crypto.randomUUID(), panelTabId: sender.tab.id, collectorTabId: collector.id, supplier, origin: start.origin, queue: [{ url: start.href, category: '' }], queued: [start.href], visited: [], productUrls: [], products: [], pages: 0, maxPages: 180, maxProducts: 2500, paused: false, pauseReason: '', cancelled: false, startedAt: Date.now() };
      await chrome.storage.local.set({ activeJob });
      runJob().catch(async error => { await sendPanel({ type: 'error', status: error.message }); activeJob = null; await chrome.storage.local.remove('activeJob'); });
      return { ok: true, type: 'STARTED', jobId: activeJob.id };
    }
    if (!activeJob) throw new Error('Não existe pesquisa em andamento.');
    if (message.type === 'PAUSE') { activeJob.paused = true; activeJob.pauseReason = 'manual'; await chrome.storage.local.set({ activeJob }); await sendPanel({ type: 'paused', reason: 'manual', status: 'Pesquisa pausada.', pages: activeJob.pages, products: activeJob.products.length }); return { ok: true }; }
    if (message.type === 'RESUME') { const recovering = activeJob.pauseReason === 'recovery'; activeJob.paused = false; activeJob.pauseReason = ''; await chrome.storage.local.set({ activeJob }); await sendPanel({ type: 'resumed', status: 'Pesquisa retomada.', pages: activeJob.pages, products: activeJob.products.length }); if (recovering) runJob().catch(async error => { await sendPanel({ type: 'error', status: error.message }); activeJob = null; await chrome.storage.local.remove('activeJob'); }); return { ok: true }; }
    if (message.type === 'CANCEL') { activeJob.cancelled = true; activeJob.paused = false; return { ok: true }; }
    if (message.type === 'FOCUS') { await chrome.tabs.update(activeJob.collectorTabId, { active: true }); if (sender.tab?.windowId) await chrome.windows.update(sender.tab.windowId, { focused: true }).catch(() => {}); return { ok: true }; }
    throw new Error('Comando desconhecido.');
  })().then(sendResponse).catch(error => sendResponse({ ok: false, error: error.message }));
  return true;
});

chrome.runtime.onInstalled.addListener(() => chrome.storage.local.remove('activeJob'));
