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

test('api/classify: 429 après trop de requêtes depuis la même IP', async () => {
  process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
  const handler = require('../api/classify.js');
  handler._resetLimites();
  const req = { method: 'POST', headers: { 'x-forwarded-for': '203.0.113.9' }, body: { texte: 'x' } };
  // globalThis.fetch mocké pour ne pas appeler le vrai modèle
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ content: [{ text: '{"unites":[]}' }] }) });
  try {
    let last = 0;
    for (let i = 0; i < 20; i++) { const res = mockRes(); await handler(req, res); last = res.statusCode; }
    assert.equal(last, 429, 'la 16e+ requête doit être limitée');
    // une IP différente n'est pas bloquée
    const res2 = mockRes();
    await handler({ ...req, headers: { 'x-forwarded-for': '198.51.100.4' } }, res2);
    assert.notEqual(res2.statusCode, 429);
  } finally {
    globalThis.fetch = realFetch;
    delete process.env.ANTHROPIC_API_KEY;
    handler._resetLimites();
  }
});

test('api/classify: 403 si Origin ne correspond pas à ARGUMENTACTIF_ORIGIN', async () => {
  process.env.ARGUMENTACTIF_ORIGIN = 'https://argumentactif.jfb4plai.com';
  delete require.cache[require.resolve('../api/classify.js')];
  const handler = require('../api/classify.js');
  const res = mockRes();
  await handler({ method: 'POST', headers: { origin: 'https://evil.example' }, body: { texte: 'x' } }, res);
  assert.equal(res.statusCode, 403);
  const ok = mockRes();
  await handler({ method: 'POST', headers: { origin: 'https://argumentactif.jfb4plai.com', 'x-forwarded-for': '203.0.113.77' }, body: { texte: 'x' } }, ok);
  assert.notEqual(ok.statusCode, 403);
  delete process.env.ARGUMENTACTIF_ORIGIN;
  delete require.cache[require.resolve('../api/classify.js')];
});
