'use strict';

const { CATEGORY_HINTS, PRODUCT_HINTS, parseSnapshot, parseListingCard } = require('./parser');
const { sameOrigin, validatePublicUrl } = require('./security');

const BLOCKED_RE = /captcha|verify you are human|verifique que voc[eê] [eé] humano|acesso negado|access denied|unusual traffic/i;
const LOGIN_REQUIRED_RE = /identifique-se\s+para\s+ver\s+pre[cç]o|fa[cç]a\s+login\s+para\s+ver\s+pre[cç]o|entre\s+para\s+ver\s+pre[cç]o|pre[cç]os?\s+(?:dispon[ií]ve(?:l|is)|vis[ií]ve(?:l|is))\s+ap[oó]s\s+(?:o\s+)?login|R\$\s*\*{2,}/i;

const IGNORE_LINK = /\/[^/?#]*(?:conta|account|login|cadastro|register|carrinho|cart|checkout|pedido|wishlist|favorit|contato|contact|politica|privacy|termos|terms|blog)[^/?#]*(?:\/|$|[?#])|^(?:mailto|tel|javascript):/i;

function scoreLink(link) {
  const value = `${link.href || ''} ${link.text || ''} ${link.context || ''}`;
  if (IGNORE_LINK.test(link.href || '')) return -100;
  let score = 0;
  if (PRODUCT_HINTS.test(link.href || '')) score += 10;
  if (CATEGORY_HINTS.test(link.href || '')) score += 8;
  if (link.hasImage) score += 3;
  if (/R\$\s*\d/i.test(link.context || '')) score += 5;
  if (/product|produto|item|vitrine|showcase/i.test(link.className || '')) score += 4;
  if (link.inNav) score += 2;
  if (/comprar|ver mais|detalhes|lan[cç]amentos|promo[cç][oõ]es|jogos|acess[oó]rios/i.test(value)) score += 2;
  if (/\.(?:png|jpe?g|webp|svg|pdf|zip)(?:$|[?#])/i.test(link.href || '')) score -= 20;
  return score;
}

function uniqueLinks(links, base) {
  const result = [];
  const seen = new Set();
  for (const item of links) {
    const value = typeof item === 'string' ? item : item.href;
    try {
      const url = new URL(value, base);
      url.hash = '';
      ['utm_source', 'utm_medium', 'utm_campaign', 'fbclid', 'gclid'].forEach(key => url.searchParams.delete(key));
      if (!sameOrigin(url.href, base) || seen.has(url.href)) continue;
      seen.add(url.href); result.push({ ...(typeof item === 'string' ? {} : item), href: url.href, score: scoreLink(typeof item === 'string' ? { href: url.href } : { ...item, href: url.href }) });
    } catch { /* link inválido */ }
  }
  return result;
}

async function snapshotPage(page) {
  return page.evaluate(() => {
    const text = selector => document.querySelector(selector)?.textContent?.trim() || '';
    const attr = (selector, name) => document.querySelector(selector)?.getAttribute(name) || '';
    const firstPrice = () => {
      const semantic = attr('meta[itemprop="price"], meta[property="product:price:amount"], meta[property="og:price:amount"]', 'content');
      if (/\d/.test(semantic)) return semantic;
      const selectors = ['main .preco-promocional', '[itemtype*="Product"] .preco-promocional', 'main [itemprop="price"]', 'main .product-price', 'main [class*="preco" i]', 'main [class*="price" i]'];
      for (const selector of selectors) {
        for (const node of document.querySelectorAll(selector)) {
          const value = (node.getAttribute('content') || node.textContent || '').replace(/\s+/g, ' ').trim();
          if (/\d/.test(value) && !/--[A-Z_]+--/.test(value)) return value;
        }
      }
      return '';
    };
    const jsonLd = [...document.querySelectorAll('script[type="application/ld+json"]')].map(node => node.textContent || '');
    const links = [...document.querySelectorAll('a[href]')].slice(0, 1500).map(a => {
      const contextNode = a.closest('[class*="product" i], [class*="produto" i], [class*="item" i], article, li') || a;
      return {
        href: a.href,
        text: (a.textContent || a.getAttribute('title') || '').trim().slice(0, 240),
        context: (contextNode.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 500),
        className: `${a.className || ''} ${contextNode.className || ''}`.slice(0, 300),
        hasImage: Boolean(a.querySelector('img') || contextNode.querySelector?.('img')),
        inNav: Boolean(a.closest('nav, header, [class*="menu" i], [class*="categor" i]'))
      };
    });
    const images = [...document.images].map(img => img.currentSrc || img.dataset.src || img.src).filter(Boolean);
    const cards = [...document.querySelectorAll('a[href]')].map(anchor => {
      const fullText = anchor.textContent?.replace(/\s+/g, ' ').trim() || '';
      const priceMatch = fullText.match(/(?:R\$|US\$|\$)\s*[\d.,]+/i);
      if (!priceMatch) return null;
      const image = anchor.querySelector('img');
      const explicitName = anchor.querySelector('[itemprop="name"], h2, h3, h4, .product-name, [class*="productName"], [class*="product-name"]')?.textContent?.trim();
      const fallbackName = anchor.getAttribute('title') || image?.getAttribute('alt') || fullText.slice(0, Math.max(0, fullText.indexOf(priceMatch[0])));
      return {
        url: anchor.href,
        name: explicitName || fallbackName,
        price: priceMatch[0],
        description: fullText,
        image: image?.currentSrc || image?.dataset.src || image?.src || ''
      };
    }).filter(Boolean);
    return {
      url: location.href,
      title: document.title,
      bodyText: document.body?.innerText?.slice(0, 12000) || '',
      jsonLd,
      links,
      cards,
      meta: {
        title: attr('meta[property="og:title"]', 'content'),
        description: attr('meta[property="og:description"]', 'content'),
        image: attr('meta[property="og:image"]', 'content'),
        price: attr('meta[itemprop="price"], meta[property="product:price:amount"], meta[property="og:price:amount"]', 'content')
      },
      h1: text('h1, [itemprop="name"], .product-title'),
      price: firstPrice(),
      description: text('[itemprop="description"], #description, .product-description, [class*="description"]'),
      breadcrumb: text('nav[aria-label*="breadcrumb" i], .breadcrumb, [class*="breadcrumb"]'),
      image: attr('[itemprop="image"], main img, .product img', 'content') || attr('main img, .product img', 'src') || images[0] || '',
      priceCount: document.querySelectorAll('[itemprop="price"], .product-price, .price, [class*="price" i], [class*="preco" i]').length,
      hasBuyButton: [...document.querySelectorAll('button, input[type="submit"], a')].some(el => /comprar|adicionar ao carrinho|buy now/i.test(el.textContent || el.value || ''))
    };
  });
}

async function progressiveScroll(page, signal) {
  let previous = 0;
  for (let index = 0; index < 8; index += 1) {
    if (signal.aborted) throw signal.reason || new Error('Pesquisa cancelada.');
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    await page.evaluate(y => window.scrollTo({ top: y, behavior: 'instant' }), Math.round(height * ((index + 1) / 8)));
    await page.waitForTimeout(350);
    if (height === previous && index >= 3) break;
    previous = height;
  }
  await page.evaluate(() => window.scrollTo(0, 0));
}

async function crawl({ browser, startUrl, supplier, emit, signal, maxPages = 35, maxProducts = 500, deadlineMs = 240000 }) {
  const started = Date.now();
  const context = await browser.newContext({ locale: 'pt-BR', userAgent: 'CataPrecoPlus/1.0 (+catalogador autorizado)' });
  await context.route('**/*', async route => {
    if (!route.request().isNavigationRequest()) return route.continue();
    try {
      await validatePublicUrl(route.request().url());
      return route.continue();
    } catch {
      return route.abort('blockedbyclient');
    }
  });
  const page = await context.newPage();
  page.setDefaultNavigationTimeout(20000);
  const queue = [{ url: startUrl, category: '' }];
  const queued = new Set([startUrl]);
  const visited = new Set();
  const products = [];
  const productUrls = new Set();
  let blocked = false;
  let loginRequired = false;
  let discoveredLinks = 0;

  try {
    while (queue.length && visited.size < maxPages && products.length < maxProducts) {
      if (signal.aborted) throw signal.reason || new Error('Pesquisa cancelada.');
      if (Date.now() - started > deadlineMs) throw new Error('Limite seguro de tempo atingido. Exporte os dados coletados ou execute por categoria.');
      const current = queue.shift();
      if (visited.has(current.url)) continue;
      visited.add(current.url);
      emit({ type: 'progress', status: `Abrindo ${current.url}`, pages: visited.size, products: products.length, percent: Math.min(95, Math.round((visited.size / maxPages) * 100)) });
      try {
        await page.goto(current.url, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(800);
        await progressiveScroll(page, signal);
        const snapshot = await snapshotPage(page);
        if (BLOCKED_RE.test(`${snapshot.title} ${snapshot.bodyText}`)) {
          blocked = true;
          emit({ type: 'blocked', status: 'O site exibiu CAPTCHA ou bloqueio. A pesquisa foi interrompida sem descartar os dados já coletados.', url: snapshot.url });
          break;
        }
        if (LOGIN_REQUIRED_RE.test(`${snapshot.title} ${snapshot.bodyText}`)) {
          loginRequired = true;
          emit({ type: 'login_required', status: 'O fornecedor exige login para revelar os preços. A pesquisa foi interrompida sem fabricar valores.', url: snapshot.url });
          break;
        }
        const product = parseSnapshot(snapshot, supplier, current.category);
        if (product && !productUrls.has(product._url)) {
          productUrls.add(product._url); products.push(product);
          emit({ type: 'product', product, pages: visited.size, products: products.length });
        }
        const listingCategory = snapshot.h1 || snapshot.title || current.category;
        for (const card of snapshot.cards || []) {
          if (!sameOrigin(card.url, snapshot.url) || !PRODUCT_HINTS.test(card.url)) continue;
          const listedProduct = parseListingCard(card, supplier, listingCategory);
          if (!listedProduct || productUrls.has(listedProduct._url)) continue;
          productUrls.add(listedProduct._url); products.push(listedProduct);
          emit({ type: 'product', product: listedProduct, pages: visited.size, products: products.length });
          if (products.length >= maxProducts) break;
        }
        const links = uniqueLinks(snapshot.links, snapshot.url).filter(link => link.score >= 2).sort((a, b) => Number(CATEGORY_HINTS.test(b.href)) - Number(CATEGORY_HINTS.test(a.href)) || b.score - a.score).slice(0, 120);
        discoveredLinks += links.length;
        let added = 0;
        for (const link of links) {
          if (queued.has(link.href) || visited.has(link.href)) continue;
          queued.add(link.href);
          queue.push({ url: link.href, category: link.inNav || CATEGORY_HINTS.test(current.url) ? snapshot.title : current.category });
          added += 1;
          if (queue.length >= maxPages * 3) break;
        }
        emit({ type: 'discovery', status: `${links.length} link(s) relevante(s) encontrado(s); ${added} adicionado(s) à fila.`, discoveredLinks: links.length, queued: queue.length, pages: visited.size, products: products.length });
      } catch (error) {
        if (signal.aborted) throw error;
        emit({ type: 'warning', status: `Página ignorada: ${error.message}`, url: current.url });
      }
    }
    const status = blocked ? 'blocked' : products.length ? 'completed' : loginRequired ? 'login_required' : 'no_results';
    const diagnostic = status === 'login_required'
      ? 'O fornecedor exige autenticação para revelar os preços. Nenhum preço oculto foi inventado ou exportado.'
      : status === 'no_results' && discoveredLinks === 0
        ? 'A página informada não expôs catálogo, links de categorias ou produtos públicos.'
        : status === 'no_results'
          ? 'Foram encontrados links, mas nenhuma página apresentou simultaneamente nome e preço público válidos.'
          : '';
    return { status, diagnostic, pages: visited.size, products, elapsedMs: Date.now() - started, queueRemaining: queue.length, discoveredLinks };
  } finally {
    await context.close().catch(() => {});
  }
}

module.exports = { BLOCKED_RE, LOGIN_REQUIRED_RE, IGNORE_LINK, scoreLink, uniqueLinks, progressiveScroll, crawl };
