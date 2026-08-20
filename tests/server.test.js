'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

test('servidor Express pode ser importado sem quebrar o roteador', () => {
  const app = require('../server');
  assert.equal(typeof app.listen, 'function');
});
