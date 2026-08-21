'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { BLOCKED_RE, LOGIN_REQUIRED_RE, scoreLink, uniqueLinks } = require('../lib/crawler');
const { PRODUCT_HINTS, CATEGORY_HINTS } = require('../lib/parser');

test('detecta CAPTCHA e bloqueios em português e inglês', () => {
  assert.match('Verify you are human', BLOCKED_RE);
  assert.match('Resolva o CAPTCHA', BLOCKED_RE);
  assert.match('Acesso negado', BLOCKED_RE);
});

test('detecta fornecedor que esconde preço até autenticação', () => {
  assert.match('Identifique-se para ver preço', LOGIN_REQUIRED_RE);
  assert.match('R$ ***', LOGIN_REQUIRED_RE);
  assert.doesNotMatch('R$ 149,90', LOGIN_REQUIRED_RE);
});

test('deduplica links, remove rastreamento e rejeita outro domínio', () => {
  const links = uniqueLinks(['/produto/1?utm_source=x', '/produto/1', 'https://outro.example/produto/2'], 'https://loja.example');
  assert.equal(links.length, 1);
  assert.equal(links[0].href, 'https://loja.example/produto/1');
});

test('reconhece produto com slug na raiz pelo contexto do card', () => {
  assert.ok(scoreLink({ href: 'https://loja.example/cabo-hdmi-2m', context: 'Cabo HDMI R$ 19,90', hasImage: true, className: 'produto-item' }) >= 10);
});

test('rejeita links de conta e carrinho', () => {
  assert.ok(scoreLink({ href: 'https://loja.example/minha-conta', inNav: true }) < 0);
  assert.ok(scoreLink({ href: 'https://loja.example/carrinho', context: 'R$ 10,00', hasImage: true }) < 0);
});

test('reconhece as rotas reais de categoria e produto da MS Atacado', () => {
  assert.match('https://www.msatacado.com.br/14-BRINQUEDOS', CATEGORY_HINTS);
  assert.doesNotMatch('https://www.msatacado.com.br/14-BRINQUEDOS', PRODUCT_HINTS);
  assert.match('https://www.msatacado.com.br/1548-TANQUE-NAVE', PRODUCT_HINTS);
  assert.doesNotMatch('https://www.msatacado.com.br/1548-TANQUE-NAVE', CATEGORY_HINTS);
});
