'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');

test('interface contém todos os controles obrigatórios', () => {
  for (const id of ['supplier', 'url', 'start', 'cancel', 'bar', 'status', 'pages', 'count', 'elapsed', 'xlsx', 'json']) {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  }
});

test('JavaScript embutido compila', () => {
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match => match[1]);
  assert.ok(scripts.length);
  for (const script of scripts) assert.doesNotThrow(() => new Function(script));
});

test('interface usa AbortController e preserva exportação após cancelamento', () => {
  assert.match(html, /new AbortController\(\)/);
  assert.match(html, /produtos já recebidos foram preservados/i);
  assert.doesNotMatch(html, /location\.reload/);
});
