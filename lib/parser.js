'use strict';

const PRODUCT_HINTS = /\/products?\/|\/produto\/|\/p\/|product[-_]?id|sku=|\/\d{3,}-[a-z\d][a-z\d-]*(?:[/?#]|$)/i;
const CATEGORY_HINTS = /\/categor(?:y|ia)s?\/|\/collections?\/|\/cole(?:cao|coes|ção|ções)\/|\/departamentos?\/|\/t\/produtos|\/\d{1,2}-[a-z\d][a-z\d-]*(?:[/?#]|$)/i;

function cleanText(value = '') { return String(value).replace(/\s+/g, ' ').trim(); }

function parseMoney(value) {
  if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? value : null;
  const text = cleanText(value).replace(/[^\d,.-]/g, '');
  if (!text) return null;
  let normalized = text;
  const lastComma = normalized.lastIndexOf(',');
  const lastDot = normalized.lastIndexOf('.');
  if (lastComma > lastDot) normalized = normalized.replace(/\./g, '').replace(',', '.');
  else if (lastDot > lastComma && lastComma >= 0) normalized = normalized.replace(/,/g, '');
  else if (lastDot >= 0 && /^\d{1,3}(?:\.\d{3})+$/.test(normalized)) normalized = normalized.replace(/\./g, '');
  else if (lastComma >= 0) normalized = normalized.replace(',', '.');
  const number = Number(normalized);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function packagingType(title, description) {
  const value = `${title || ''} ${description || ''}`;
  const bulk = /\b(caixa|cx\.?|fardo|kit|pacote)\b|\bcont[eé]m\s*\d+|\bc\s*\/\s*\d+/i;
  return bulk.test(value) ? 'Caixa Fechada' : 'Unidade';
}

function normalizeImage(value, baseUrl) {
  if (Array.isArray(value)) value = value[0];
  if (value && typeof value === 'object') value = value.url || value.contentUrl;
  if (!value) return '';
  try {
    const url = new URL(String(value), baseUrl);
    return /^https?:$/.test(url.protocol) && /\.(?:png|jpe?g|webp)(?:$|[?#])/i.test(url.href) ? url.href : '';
  } catch { return ''; }
}

function flattenJsonLd(input) {
  const values = Array.isArray(input) ? input : [input];
  return values.flatMap(value => value && Array.isArray(value['@graph']) ? value['@graph'] : value).filter(Boolean);
}

function findProductJsonLd(jsonLd = []) {
  for (const raw of jsonLd) {
    let parsed;
    try { parsed = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { continue; }
    for (const item of flattenJsonLd(parsed)) {
      const types = Array.isArray(item['@type']) ? item['@type'] : [item['@type']];
      if (types.some(type => String(type).toLowerCase() === 'product')) return item;
    }
  }
  return null;
}

function offerPrice(offers) {
  const list = Array.isArray(offers) ? offers : [offers];
  for (const offer of list.filter(Boolean)) {
    const value = parseMoney(offer.price ?? offer.lowPrice ?? offer.highPrice);
    if (value) return value;
  }
  return null;
}

function parseSnapshot(snapshot, supplier, sourceCategory = '') {
  const structured = findProductJsonLd(snapshot.jsonLd);
  const name = cleanText(structured?.name || snapshot.meta?.title || snapshot.h1);
  const description = cleanText(structured?.description || snapshot.meta?.description || snapshot.description);
  const price = offerPrice(structured?.offers) || parseMoney(snapshot.meta?.price) || parseMoney(snapshot.price);
  const image = normalizeImage(structured?.image || snapshot.meta?.image || snapshot.image, snapshot.url);
  const category = cleanText(structured?.category || snapshot.breadcrumb || sourceCategory);
  const evidence = Number(Boolean(structured)) * 4 + Number(Boolean(name)) * 2 + Number(Boolean(price)) * 3 + Number(PRODUCT_HINTS.test(snapshot.url)) + Number(Boolean(snapshot.hasBuyButton)) * 2 + Number(Boolean(snapshot.breadcrumb));
  const categoryOnly = !structured && !snapshot.hasBuyButton && (CATEGORY_HINTS.test(snapshot.url) || Number(snapshot.priceCount) > 1);
  if (evidence < 6 || categoryOnly || !name || !price) return null;
  return {
    'Nome do Fornecedor': cleanText(supplier),
    'Nome do Produto': name,
    'Custo do Produto': price,
    'Categoria do Produto': category,
    'Descrição do Produto': description,
    'Tipo de Embalagem': packagingType(name, description),
    'Link da Imagem': image,
    _url: snapshot.url
  };
}

function parseListingCard(card, supplier, sourceCategory = '') {
  const name = cleanText(card.name);
  const price = parseMoney(card.price || card.text);
  if (!name || !price || !card.url) return null;
  const description = cleanText(card.description || '');
  return {
    'Nome do Fornecedor': cleanText(supplier),
    'Nome do Produto': name.replace(/^c[oó]d\.?\s*:\s*\S+\s*/i, ''),
    'Custo do Produto': price,
    'Categoria do Produto': cleanText(sourceCategory),
    'Descrição do Produto': description,
    'Tipo de Embalagem': packagingType(name, description),
    'Link da Imagem': normalizeImage(card.image, card.url),
    _url: card.url
  };
}

module.exports = { CATEGORY_HINTS, PRODUCT_HINTS, cleanText, parseMoney, packagingType, normalizeImage, findProductJsonLd, parseSnapshot, parseListingCard };
