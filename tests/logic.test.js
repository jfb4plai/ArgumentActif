const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../logic.js');

const KEYS = [
  'affirmation-factuelle', 'opinion', 'generalisation-abusive', 'appel-emotion',
  'homme-de-paille', 'ad-hominem', 'fausse-dichotomie', 'pente-glissante',
  'autorite-non-sourcee', 'question-rhetorique',
];

test('TAXONOMY contient exactement les 10 clés de la spec', () => {
  assert.deepEqual(Object.keys(L.TAXONOMY).sort(), [...KEYS].sort());
});

test('chaque catégorie a libelle, definition, couleur', () => {
  for (const k of KEYS) {
    const c = L.TAXONOMY[k];
    assert.ok(c.libelle && typeof c.libelle === 'string', `${k}.libelle`);
    assert.ok(c.definition && typeof c.definition === 'string', `${k}.definition`);
    assert.match(c.couleur, /^#[0-9a-fA-F]{6}$/, `${k}.couleur hex`);
  }
});

test('aucune couleur en double', () => {
  const couleurs = KEYS.map((k) => L.TAXONOMY[k].couleur.toLowerCase());
  assert.equal(new Set(couleurs).size, couleurs.length);
});

test('SOCRATIC_BANK a au moins une piste par catégorie, formulées en questions', () => {
  for (const k of KEYS) {
    const pistes = L.SOCRATIC_BANK[k];
    assert.ok(Array.isArray(pistes) && pistes.length >= 1, `${k} a des pistes`);
    for (const p of pistes) assert.match(p, /\?\s*$/, `piste "${p}" est une question`);
  }
});

test('aucune piste socratique ne contient de formulation de réplique toute faite', () => {
  const interdits = /(tu devrais répondre|réponds que|dis que|le contre-argument est|voici)/i;
  for (const k of KEYS) {
    for (const p of L.SOCRATIC_BANK[k]) assert.doesNotMatch(p, interdits, `${k}: "${p}"`);
  }
});
