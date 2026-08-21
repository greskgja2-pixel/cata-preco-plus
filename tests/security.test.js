'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { isPrivateIp, normalizeUrlInput, validatePublicUrl, sameOrigin } = require('../lib/security');

test('bloqueia endereços locais e privados', () => {
  for (const ip of ['127.0.0.1', '10.0.0.1', '172.16.0.1', '192.168.1.1', '169.254.1.1', '::1']) assert.equal(isPrivateIp(ip), true);
  assert.equal(isPrivateIp('8.8.8.8'), false);
});

test('valida somente URL pública HTTP/HTTPS', async () => {
  const lookup = async () => [{ address: '93.184.216.34', family: 4 }];
  assert.equal((await validatePublicUrl('https://example.com/catalogo', lookup)).hostname, 'example.com');
  await assert.rejects(() => validatePublicUrl('file:///etc/passwd', lookup), /HTTP/);
  await assert.rejects(() => validatePublicUrl('https://user:pass@example.com', lookup), /credenciais/);
});

test('crawler fica no mesmo domínio', () => {
  assert.equal(sameOrigin('/produto/1', 'https://example.com'), true);
  assert.equal(sameOrigin('https://evil.example/produto/1', 'https://example.com'), false);
});

test('traduz falha de DNS para mensagem compreensível', async () => {
  const lookup = async () => { const error = new Error('busy'); error.code = 'ENOTFOUND'; throw error; };
  await assert.rejects(() => validatePublicUrl('https://inexistente.example', lookup), /Não foi possível localizar o domínio/);
});

test('adiciona HTTPS automaticamente quando o protocolo não foi digitado', () => {
  assert.equal(normalizeUrlInput('msatacado.com.br'), 'https://msatacado.com.br');
  assert.equal(normalizeUrlInput('www.msatacado.com.br/14-BRINQUEDOS'), 'https://www.msatacado.com.br/14-BRINQUEDOS');
  assert.equal(normalizeUrlInput('http://example.com'), 'http://example.com');
});
