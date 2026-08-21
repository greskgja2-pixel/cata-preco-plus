'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const extension = path.join(__dirname, '../extension');
const manifest = JSON.parse(fs.readFileSync(path.join(extension, 'manifest.json'), 'utf8'));
const content = fs.readFileSync(path.join(extension, 'content.js'), 'utf8');
const worker = fs.readFileSync(path.join(extension, 'service-worker.js'), 'utf8');

test('extensão é Manifest V3 e contém o coletor visível', () => {
  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.background.service_worker, 'service-worker.js');
  assert.ok(manifest.permissions.includes('tabs'));
  assert.ok(manifest.permissions.includes('scripting'));
  assert.ok(manifest.content_scripts[0].matches.includes('https://*/*'));
});

test('coletor rola, lê JSON-LD, cards, preços e bloqueios', () => {
  assert.match(content, /scrollPage/);
  assert.match(content, /application\/ld\+json/);
  assert.match(content, /candidateCards/);
  assert.match(content, /isProductUrl/);
  assert.match(content, /isCategoryUrl/);
  assert.match(content, /\\\/\\d\{3,\}-/);
  assert.match(content, /R\\\$/);
  assert.match(content, /captcha/i);
  assert.match(content, /login/i);
  assert.match(content, /hasLoginLink/);
  assert.match(content, /heading\?\.closest/);
  assert.doesNotMatch(content, /money\(main\?\.innerText/);
});

test('serviço coleta em aba não ativa e nunca fecha CAPTCHA automaticamente', () => {
  assert.match(worker, /chrome\.tabs\.create\(\{ url: start\.href, active: false \}\)/);
  assert.match(worker, /chrome\.tabs\.update\(activeJob\.collectorTabId, \{ url: current\.url, active: false \}\)/);
  assert.match(worker, /message\.type === 'FOCUS'/);
  assert.match(worker, /activeJob\.queue\.unshift\(current\)/);
  assert.match(worker, /CAPTCHA detectado/);
  assert.doesNotMatch(worker, /chrome\.tabs\.remove/);
});

test('coletor captura fontes de imagem normais e lazy-loaded', () => {
  assert.match(content, /currentSrc/);
  assert.match(content, /srcset/);
  assert.match(content, /data-original/);
  assert.match(content, /data-lazy/);
  assert.match(content, /placeholder\|loading\|spinner/);
});

test('fila persiste e oferece pausa, retomada e cancelamento', () => {
  assert.match(worker, /chrome\.storage\.local\.set/);
  assert.match(worker, /message\.type === 'PAUSE'/);
  assert.match(worker, /message\.type === 'RESUME'/);
  assert.match(worker, /message\.type === 'CANCEL'/);
});

test('segue redirecionamento legítimo para www antes de filtrar links', () => {
  assert.match(worker, /activeJob\.pages === 1/);
  assert.match(worker, /activeJob\.origin = new URL\(result\.url\)\.origin/);
});

test('somente o painel Cata Preço pode iniciar a extensão', () => {
  assert.match(worker, /cata-preco-plus/);
  assert.match(worker, /validPanel\(sender\)/);
  assert.doesNotMatch(worker, /endsWith\('\.vercel\.app'\)/);
});
