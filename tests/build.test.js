const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

test('build.js produit index.html sans <script src> local résiduel', () => {
  const appPath = path.join(ROOT, 'app.js');
  const created = !fs.existsSync(appPath);
  if (created) fs.writeFileSync(appPath, '/* stub */\n');
  try {
    execFileSync('node', ['build.js'], { cwd: ROOT });
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    assert.doesNotMatch(html, /<script src="logic\.js">/);
    assert.doesNotMatch(html, /<script src="app\.js">/);
    assert.match(html, /window\.ArgumentActifLogic/); // logic.js inliné
    assert.match(html, /\/\* stub \*\/|ArgumentActifApp/); // app.js inliné
  } finally {
    if (created) fs.unlinkSync(appPath);
  }
});
