'use strict';

const PANEL_HOSTS = new Set(['cata-preco-plus.vercel.app', 'localhost', '127.0.0.1']);
const isPanel = PANEL_HOSTS.has(location.hostname) || /^cata-preco-plus(?:-[a-z0-9-]+)?\.vercel\.app$/i.test(location.hostname);

if (isPanel && window === window.top) {
  window.addEventListener('message', async event => {
    if (event.source !== window || event.data?.channel !== 'CATAPRECO_PANEL') return;
    try {
      const response = await chrome.runtime.sendMessage({ ...event.data, panelUrl: location.href });
      window.postMessage({ channel: 'CATAPRECO_EXTENSION', requestId: event.data.requestId, ...response }, location.origin);
    } catch (error) {
      window.postMessage({ channel: 'CATAPRECO_EXTENSION', requestId: event.data.requestId, ok: false, error: error.message }, location.origin);
    }
  });

  chrome.runtime.onMessage.addListener(message => {
    if (message?.channel === 'CATAPRECO_EXTENSION') window.postMessage(message, location.origin);
  });

  window.postMessage({ channel: 'CATAPRECO_EXTENSION', type: 'READY', ok: true }, location.origin);
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'COLLECT_PAGE') return;
  collectPage(message).then(sendResponse).catch(error => sendResponse({ ok: false, error: error.message }));
  return true;
});

const clean = value => String(value || '').replace(/\s+/g, ' ').trim();
const absolute = value => { try { return new URL(value, location.href).href; } catch { return ''; } };
const money = text => clean(text).match(/R\$\s*\d{1,3}(?:\.\d{3})*(?:,\d{2})|R\$\s*\d+(?:[.,]\d{2})?/i)?.[0] || '';
const imageUrl = element => {
  if (!element) return '';
  const srcset = element.getAttribute?.('srcset') || element.dataset?.srcset || '';
  const srcsetCandidate = srcset.split(',').map(item => item.trim().split(/\s+/)[0]).filter(Boolean).pop();
  const candidates = [
    element.currentSrc,
    srcsetCandidate,
    element.dataset?.src,
    element.dataset?.lazySrc,
    element.dataset?.original,
    element.getAttribute?.('data-lazy'),
    element.getAttribute?.('data-original'),
    element.src
  ];
  for (const candidate of candidates) {
    const url = absolute(candidate);
    if (url && !/placeholder|loading|spinner|transparent|blank\.(?:png|gif)/i.test(url)) return url;
  }
  return '';
};
const isProductUrl = value => { try { return /\/products?\/|\/produto\/|\/p\/|\/\d{3,}-[a-z\d]/i.test(new URL(value, location.href).pathname); } catch { return false; } };
const isCategoryUrl = value => { try { return /\/t\/produtos|\/categor(?:y|ia)|\/collections?|\/cole(?:cao|coes|ção|ções)|\/departamentos?|\/\d{1,2}-[a-z\d]/i.test(new URL(value, location.href).pathname); } catch { return false; } };

function blockedState() {
  const text = clean(`${document.title} ${document.body?.innerText || ''}`).slice(0, 30000);
  if (/captcha|verify you are human|verifique que voc[eê] [eé] humano|acesso negado|access denied|unusual traffic/i.test(text)) return 'captcha';
  if (/identifique-se\s+para\s+ver\s+pre[cç]o|fa[cç]a\s+login\s+para\s+ver\s+pre[cç]o|entre\s+para\s+ver\s+pre[cç]o|R\$\s*\*{2,}/i.test(text)) return 'login';
  return '';
}

async function scrollPage() {
  let previous = 0;
  for (let step = 1; step <= 10; step += 1) {
    const height = Math.max(document.body?.scrollHeight || 0, document.documentElement.scrollHeight);
    window.scrollTo({ top: Math.round(height * step / 10), behavior: 'instant' });
    await new Promise(resolve => setTimeout(resolve, 450));
    if (height === previous && step >= 5) break;
    previous = height;
  }
  window.scrollTo({ top: 0, behavior: 'instant' });
  await new Promise(resolve => setTimeout(resolve, 250));
}

function structuredProducts() {
  const output = [];
  for (const node of document.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const root = JSON.parse(node.textContent || 'null');
      const queue = Array.isArray(root) ? root : [root];
      while (queue.length) {
        const item = queue.shift();
        if (!item || typeof item !== 'object') continue;
        if (Array.isArray(item['@graph'])) queue.push(...item['@graph']);
        const types = Array.isArray(item['@type']) ? item['@type'] : [item['@type']];
        if (!types.some(type => String(type).toLowerCase() === 'product')) continue;
        const offers = Array.isArray(item.offers) ? item.offers[0] : item.offers;
        output.push({ name: clean(item.name), price: String(offers?.price || offers?.lowPrice || ''), image: Array.isArray(item.image) ? item.image[0] : item.image, description: clean(item.description), url: absolute(item.url || location.href) });
      }
    } catch { /* JSON-LD inválido não interrompe a coleta */ }
  }
  return output;
}

function candidateCards() {
  const results = [];
  const seen = new Set();
  const links = [...document.querySelectorAll('a[href]')].filter(link => isProductUrl(link.href)).slice(0, 1500);
  for (const link of links) {
    const url = absolute(link?.href || '');
    if (!url || new URL(url).origin !== location.origin || seen.has(url)) continue;
    let node = link;
    let text = '';
    let price = '';
    for (let depth = 0; node && depth < 9; depth += 1, node = node.parentElement) {
      const candidateText = clean(node.innerText || node.textContent || '');
      const candidatePrice = money(candidateText);
      if (candidatePrice && candidateText.length <= 2200) { text = candidateText; price = candidatePrice; break; }
    }
    if (!node || !price) continue;
    const img = node.querySelector('img');
    const explicit = node.querySelector('[itemprop="name"], [class*="product-name" i], [class*="productName" i], [class*="produto-nome" i]');
    const heading = node.querySelector('h2, h3, h4');
    let name = clean(explicit?.textContent || img?.alt || link?.getAttribute('title') || heading?.textContent || link?.textContent || '');
    name = clean(name.replace(price, '')).slice(0, 300);
    if (!name || name.length < 3 || seen.has(url)) continue;
    seen.add(url);
    results.push({ name, price, image: imageUrl(img), description: text, url });
  }
  return results;
}

function pageProduct() {
  const heading = document.querySelector('h1, [itemprop="name"], .product-title, [class*="product-name" i]');
  const name = clean(heading?.textContent || document.querySelector('meta[property="og:title"]')?.content || '');
  const semanticPrice = document.querySelector('meta[itemprop="price"], meta[property="product:price:amount"], [itemprop="price"]')?.content || document.querySelector('[itemprop="price"]')?.textContent || '';
  const scope = heading?.closest('main, article, [class*="product" i], [class*="produto" i], section') || heading?.parentElement;
  const visiblePrice = scope?.querySelector('[itemprop="price"], .product-price, [class*="product-price" i], [class*="preco" i], [class*="price" i]')?.textContent || '';
  const price = money(semanticPrice) || money(visiblePrice);
  const buy = [...document.querySelectorAll('button, a, input[type="submit"]')].some(node => /comprar|adicionar|carrinho/i.test(node.textContent || node.value || ''));
  if (!name || !price || (!buy && !isProductUrl(location.href))) return null;
  return { name, price, image: document.querySelector('meta[property="og:image"]')?.content || imageUrl(scope?.querySelector('img')), description: clean(document.querySelector('[itemprop="description"], .product-description, [class*="description" i]')?.textContent || ''), url: location.href };
}

function relevantLinks() {
  const ignore = /conta|account|login|cadastro|carrinho|cart|checkout|contato|privacy|termos|blog|javascript:|mailto:|tel:/i;
  const links = [];
  const seen = new Set();
  for (const anchor of [...document.querySelectorAll('a[href]')].slice(0, 2500)) {
    const url = absolute(anchor.href);
    if (!url || seen.has(url) || new URL(url).origin !== location.origin || ignore.test(url)) continue;
    const context = clean((anchor.closest('article, li, [class*="product" i], [class*="produto" i], [class*="card" i]') || anchor).textContent || '').slice(0, 600);
    const value = `${url} ${clean(anchor.textContent)} ${context}`;
    let score = 0;
    if (isProductUrl(url)) score += 10;
    if (isCategoryUrl(url)) score += 9;
    if (/categoria|collection|colecao|departamento|produtos/i.test(value)) score += 6;
    if (money(context)) score += 7;
    if (anchor.querySelector('img')) score += 3;
    if (/\?page=\d+|[?&]pagina=\d+/i.test(url)) score += 5;
    if (score < 5) continue;
    seen.add(url);
    links.push({ url, score, kind: isCategoryUrl(url) ? 'category' : isProductUrl(url) ? 'product' : 'pagination', category: clean(document.querySelector('h1')?.textContent || document.title) });
  }
  const rank = link => link.kind === 'category' ? 0 : link.kind === 'pagination' ? 1 : 2;
  return links.sort((a, b) => rank(a) - rank(b) || b.score - a.score).slice(0, 250);
}

async function collectPage() {
  await scrollPage();
  const blocked = blockedState();
  if (blocked) return { ok: true, blocked, url: location.href, title: document.title };
  const raw = [...structuredProducts(), ...candidateCards()];
  const single = pageProduct();
  if (single) raw.push(single);
  const unique = [...new Map(raw.filter(item => item.name && item.price && item.url).map(item => [item.url, item])).values()];
  const productLinkCount = [...document.querySelectorAll('a[href]')].filter(anchor => isProductUrl(anchor.href)).length;
  const hasLoginLink = [...document.querySelectorAll('a[href]')].some(anchor => /login|minhaconta|account|entrar/i.test(`${anchor.href} ${anchor.textContent || ''}`));
  if (!unique.length && hasLoginLink && (isProductUrl(location.href) || productLinkCount >= 3)) return { ok: true, blocked: 'login', url: location.href, title: document.title, diagnostics: { cards: 0, prices: 0, links: document.links.length } };
  return { ok: true, url: location.href, title: document.title, products: unique, links: relevantLinks(), diagnostics: { cards: unique.length, prices: (document.body?.innerText.match(/R\$/g) || []).length, links: document.links.length } };
}
