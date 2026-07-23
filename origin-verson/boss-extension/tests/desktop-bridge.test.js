const test = require('node:test');
const assert = require('node:assert/strict');

const {
  assertApiSuccess,
  escapeHtml,
  extractProxyText,
} = require('../src/desktop-bridge.js');

test('extractProxyText unwraps Flask and OpenAI envelopes', () => {
  const envelope = {
    success: true,
    data: { choices: [{ message: { content: 'hello' } }] },
  };

  assert.equal(extractProxyText(envelope), 'hello');
});

test('assertApiSuccess rejects a failed API envelope', () => {
  assert.throws(
    () => assertApiSuccess({ success: false, error: 'denied' }),
    /denied/,
  );
});

test('escapeHtml neutralizes job text markup', () => {
  assert.equal(
    escapeHtml('<img src=x onerror=alert(1)>'),
    '&lt;img src=x onerror=alert(1)&gt;',
  );
});
