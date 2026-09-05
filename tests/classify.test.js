const test = require('node:test');
const assert = require('node:assert/strict');

test('api/classify: rejette une méthode non-POST', async () => {
  const handler = require('../api/classify.js');
  const res = mockRes();
  await handler({ method: 'GET', body: {} }, res);
  assert.equal(res.statusCode, 405);
});

test('api/classify: rejette un body sans texte', async () => {
  const handler = require('../api/classify.js');
  const res = mockRes();
  await handler({ method: 'POST', body: { sujet: 's' } }, res);
  assert.equal(res.statusCode, 400);
});

test('api/classify: 500 clair si ANTHROPIC_API_KEY absente', async () => {
  delete process.env.ANTHROPIC_API_KEY;
  const handler = require('../api/classify.js');
  const res = mockRes();
  await handler({ method: 'POST', body: { texte: 'x' } }, res);
  assert.equal(res.statusCode, 500);
  assert.match(JSON.stringify(res.jsonBody), /configuration/i);
});

function mockRes() {
  return {
    statusCode: 200,
    jsonBody: null,
    headers: {},
    setHeader(k, v) { this.headers[k] = v; },
    status(c) { this.statusCode = c; return this; },
    json(o) { this.jsonBody = o; return this; },
    end() { return this; },
  };
}
