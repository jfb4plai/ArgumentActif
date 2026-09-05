'use strict';
const fs = require('node:fs');
const path = require('node:path');

const ROOT = __dirname;
const template = fs.readFileSync(path.join(ROOT, 'index.template.html'), 'utf8');

function inlineScript(html, file) {
  const code = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const tag = new RegExp(`<script src="${file.replace('.', '\\.')}"></script>`);
  if (!tag.test(html)) throw new Error(`Balise <script src="${file}"> introuvable dans le template.`);
  const safe = code.replace(/<\/script>/gi, '<\\/script>');
  return html.replace(tag, `<script>\n${safe}\n</script>`);
}

let out = template;
out = inlineScript(out, 'logic.js');
out = inlineScript(out, 'app.js');
out = out.replace(
  '<!doctype html>',
  '<!doctype html>\n<!-- Fichier généré par build.js — ne pas éditer. Source : index.template.html + logic.js + app.js -->'
);

fs.writeFileSync(path.join(ROOT, 'index.html'), out);
console.log('index.html généré (' + out.length + ' octets).');
