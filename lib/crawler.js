'use strict';

const { CATEGORY_HINTS, PRODUCT_HINTS, parseSnapshot } = require('./parser');
const { sameOrigin, validatePublicUrl } = require('./security');

const BLOCKED_RE = /captcha|verify you are human|verifique que voc[eê] [eé] humano|acesso negado|access denied|unusual traffic/i;

function uniqueLinks(links, base) {
  const result = [];
  const seen = new Set();
  for (const value of links) {
    try {
      const url = new URL(value, base);
      url.hash = '';
      ['utm_source', 'utm_medium', 'utm_campaign', 'fbclid', 'gclid'].forEach(key => url.searchParams.delete(key));
      if (!sameOrigin(url.href, base) || seen.has(url.href)) continue;
      seen.add(url.href); result.push(url.href);
    } catch { /* link inválido */ }
  }
  return result;
}

async function snapshotPage(page) {
  return page.evaluate(() => {
    const text = selector => document.querySelector(selector)?.textContent?.trim() || '';
    const attr = (selector, name) => document.querySelector(selector)?.getAttribute(name) || '';
    const jsonLd = [...document.querySelectorAll('script[type="application/ld+json"]')].map(node => node.textContent || '');
    const links = [...document.querySelectorAll('a[href]')].map(a => a.href);
    const images = [...document.images].map(img => img.currentSrc || img.dataset.src || img.src).filter(Boolean);
    return {
      url: location.href,
      title: document.title,
      bodyText: document.body?.innerText?.slice(0, 12000) || '',
      jsonLd,
      links,
      meta: {
        title: attr('meta[property="og:title"]', 'content'),
        description: attr('meta[property="og:description"]', 'content'),
        image: attr('meta[property="og:image"]', 'content'),
        price: attr('meta[property="product:price:amount"], meta[property="og:price:amount"]', 'content')
      },
      h1: text('h1, [itemprop="name"], .product-title'),
      price: text('[itemprop="price"], meta[itemprop="price"], .product-price, .price, [class*="price"]'),
      description: text('[itemprop="description"], #description, .product-description, [class*="description"]'),
      breadcrumb: text('nav[aria-label*="breadcrumb" i], .breadcrumb, [class*="breadcrumb"]'),
      image: attr('[itemprop="image"], main img, .product img', 'content') || attr('main img, .product img', 'src') || images[0] || ''
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
        const product = parseSnapshot(snapshot, supplier, current.category);
        if (product && !productUrls.has(product._url)) {
          productUrls.add(product._url); products.push(product);
          emit({ type: 'product', product, pages: visited.size, products: products.length });
        }
        const links = uniqueLinks(snapshot.links, startUrl);
        const prioritized = links.sort((a, b) => Number(PRODUCT_HINTS.test(b)) - Number(PRODUCT_HINTS.test(a)) || Number(CATEGORY_HINTS.test(b)) - Number(CATEGORY_HINTS.test(a)));
        for (const link of prioritized) {
          if (queued.has(link) || visited.has(link)) continue;
          if (!PRODUCT_HINTS.test(link) && !CATEGORY_HINTS.test(link) && !/[?&](?:page|pagina|p)=\d+/i.test(link)) continue;
          queued.add(link);
          queue.push({ url: link, category: CATEGORY_HINTS.test(current.url) ? snapshot.title : current.category });
        }
      } catch (error) {
        if (signal.aborted) throw error;
        emit({ type: 'warning', status: `Página ignorada: ${error.message}`, url: current.url });
      }
    }
    return { status: blocked ? 'blocked' : 'completed', pages: visited.size, products, elapsedMs: Date.now() - started, queueRemaining: queue.length };
  } finally {
    await context.close().catch(() => {});
  }
}

module.exports = { BLOCKED_RE, uniqueLinks, progressiveScroll, crawl };
