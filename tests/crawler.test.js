'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { BLOCKED_RE, scoreLink, uniqueLinks } = require('../lib/crawler');

test('detecta CAPTCHA e bloqueios em português e inglês', () => {
  assert.match('Verify you are human', BLOCKED_RE);
  assert.match('Resolva o CAPTCHA', BLOCKED_RE);
  assert.match('Acesso negado', BLOCKED_RE);
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
