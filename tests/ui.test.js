'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');

test('interface contém todos os controles obrigatórios', () => {
  for (const id of ['supplier', 'url', 'start', 'cancel', 'pause', 'resume', 'focusTab', 'collector', 'bar', 'status', 'pages', 'count', 'elapsed', 'xlsx', 'json']) {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  }
});

test('JavaScript embutido compila', () => {
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match => match[1]);
  assert.ok(scripts.length);
  for (const script of scripts) assert.doesNotThrow(() => new Function(script));
});

test('interface controla a pesquisa pela extensão e preserva exportação após cancelamento', () => {
  assert.match(html, /CATAPRECO_PANEL/);
  assert.match(html, /command\('CANCEL'\)/);
  assert.doesNotMatch(html, /location\.reload/);
  assert.doesNotMatch(html, /fetch\('\/api\/scrape'/);
});

test('conclusão usa mensagem em português e encerra o estado de execução', () => {
  assert.match(html, /Sem resultados/);
  assert.match(html, /Pesquisa concluída/);
  assert.match(html, /setRunning\(false\)/);
});

test('interface distingue CAPTCHA/pausa de pesquisa vazia', () => {
  assert.match(html, /event\.type==='paused'/);
  assert.match(html, /event\.reason==='captcha'/);
  assert.match(html, /event\.diagnostic/);
});

test('interface completa HTTPS automaticamente', () => {
  assert.match(html, /const normalizeUrl=/);
  assert.match(html, /ui\.url\.addEventListener\('blur'/);
  assert.match(html, /https:\/\//);
});
test('interface exige o coletor e oferece download e controles de CAPTCHA', () => {
  assert.match(html, /coletor-cata-preco-plus\.zip/);
  assert.match(html, /Coletor não conectado/);
  assert.match(html, /Pausar/);
  assert.match(html, /Continuar/);
  assert.match(html, /CAPTCHA/);
});
