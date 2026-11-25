'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('child_process');
const path = require('path');
const { root } = require('./helpers');

test('every question passes the quality gate', () => {
  const out = execFileSync(process.execPath, [path.join(root, 'tools', 'validate-bank.js')], { encoding: 'utf8' });
  assert.match(out, /Quality gate passed/);
});
