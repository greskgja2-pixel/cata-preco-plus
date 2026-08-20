'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { BLOCKED_RE, uniqueLinks } = require('../lib/crawler');

test('detecta CAPTCHA e bloqueios em português e inglês', () => {
  assert.match('Verify you are human', BLOCKED_RE);
  assert.match('Resolva o CAPTCHA', BLOCKED_RE);
  assert.match('Acesso negado', BLOCKED_RE);
});

test('deduplica links, remove rastreamento e rejeita outro domínio', () => {
  const links = uniqueLinks(['/produto/1?utm_source=x', '/produto/1', 'https://outro.example/produto/2'], 'https://loja.example');
  assert.deepEqual(links, ['https://loja.example/produto/1']);
});
