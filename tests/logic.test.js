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

test('createUnite produit une unité valide avec valeurs par défaut', () => {
  const u = L.createUnite({ texteSource: "phrase brute", texte: "phrase brute", categorie: 'opinion', origine: 'manuel' });
  assert.ok(u.id && typeof u.id === 'string');
  assert.ok(u.timestamp && !Number.isNaN(Date.parse(u.timestamp)));
  assert.equal(u.texte, "phrase brute");
  assert.equal(u.categorie, 'opinion');
  assert.equal(u.camp, null);
  assert.equal(u.aVerifier, false);
  assert.equal(u.origine, 'manuel');
  assert.equal(u.editee, false);
});

test('createUnite refuse une catégorie hors taxonomie', () => {
  assert.throws(() => L.createUnite({ texteSource: 'x', texte: 'x', categorie: 'inventee', origine: 'ia' }), /catégorie/i);
});

test('createUnite accepte categorie "non-classe"', () => {
  const u = L.createUnite({ texteSource: 'x', texte: 'x', categorie: 'non-classe', origine: 'manuel' });
  assert.equal(u.categorie, 'non-classe');
});

test('addUnite renvoie un nouvel état sans muter l\'ancien', () => {
  const s0 = L.clearSeance({ sujet: 'Faut-il interdire X ?' });
  const u = L.createUnite({ texteSource: 'a', texte: 'a', categorie: 'opinion', origine: 'manuel' });
  const s1 = L.addUnite(s0, u);
  assert.equal(s0.unites.length, 0);
  assert.equal(s1.unites.length, 1);
  assert.equal(s1.sujet, 'Faut-il interdire X ?');
});

test('reclassifyUnite change la catégorie et marque editee=true', () => {
  let s = L.clearSeance({ sujet: 's' });
  const u = L.createUnite({ texteSource: 'a', texte: 'a', categorie: 'opinion', origine: 'ia' });
  s = L.addUnite(s, u);
  s = L.reclassifyUnite(s, u.id, 'ad-hominem');
  assert.equal(s.unites[0].categorie, 'ad-hominem');
  assert.equal(s.unites[0].editee, true);
});

test('setCamp accepte pour/contre/autre/null et rejette le reste', () => {
  let s = L.clearSeance({ sujet: 's' });
  const u = L.createUnite({ texteSource: 'a', texte: 'a', categorie: 'opinion', origine: 'ia' });
  s = L.addUnite(s, u);
  s = L.setCamp(s, u.id, 'contre');
  assert.equal(s.unites[0].camp, 'contre');
  s = L.setCamp(s, u.id, null);
  assert.equal(s.unites[0].camp, null);
  assert.throws(() => L.setCamp(s, u.id, 'Kevin'), /camp/i);
});

test('toggleFlag bascule aVerifier sans aucun autre effet', () => {
  let s = L.clearSeance({ sujet: 's' });
  const u = L.createUnite({ texteSource: 'a', texte: 'a', categorie: 'affirmation-factuelle', origine: 'ia' });
  s = L.addUnite(s, u);
  s = L.toggleFlag(s, u.id);
  assert.equal(s.unites[0].aVerifier, true);
  s = L.toggleFlag(s, u.id);
  assert.equal(s.unites[0].aVerifier, false);
});

test('clearSeance vide les unités et garde/père le sujet', () => {
  let s = L.clearSeance({ sujet: 'ancien' });
  s = L.addUnite(s, L.createUnite({ texteSource: 'a', texte: 'a', categorie: 'opinion', origine: 'ia' }));
  const s2 = L.clearSeance({ sujet: 'ancien' });
  assert.equal(s2.unites.length, 0);
  assert.equal(s2.sujet, 'ancien');
});

test('parseModelResponse extrait les unités d\'un objet déjà propre', () => {
  const raw = { unites: [
    { texte: "le budget a baissé de 12 %", categorie: 'affirmation-factuelle' },
    { texte: "c'est scandaleux", categorie: 'opinion' },
  ]};
  const out = L.parseModelResponse(raw);
  assert.equal(out.length, 2);
  assert.equal(out[0].categorie, 'affirmation-factuelle');
});

test('parseModelResponse accepte une string JSON', () => {
  const out = L.parseModelResponse('{"unites":[{"texte":"a","categorie":"opinion"}]}');
  assert.equal(out.length, 1);
});

test('parseModelResponse tolère un enrobage Markdown ```json', () => {
  const s = "```json\n{\"unites\":[{\"texte\":\"a\",\"categorie\":\"opinion\"}]}\n```";
  const out = L.parseModelResponse(s);
  assert.equal(out[0].texte, 'a');
});

test('parseModelResponse remplace une catégorie inconnue par non-classe', () => {
  const out = L.parseModelResponse({ unites: [{ texte: 'a', categorie: 'sophisme-XYZ' }] });
  assert.equal(out[0].categorie, 'non-classe');
});

test('parseModelResponse ignore les unités sans texte', () => {
  const out = L.parseModelResponse({ unites: [{ texte: '', categorie: 'opinion' }, { texte: 'ok', categorie: 'opinion' }] });
  assert.equal(out.length, 1);
  assert.equal(out[0].texte, 'ok');
});

test('parseModelResponse jette une erreur claire si structure irrécupérable', () => {
  assert.throws(() => L.parseModelResponse('pas du json du tout'), /réponse du modèle/i);
  assert.throws(() => L.parseModelResponse({ foo: 1 }), /réponse du modèle/i);
});

test('formatExport produit un .txt lisible avec en-tête, unités et compteur', () => {
  let s = L.clearSeance({ sujet: 'Faut-il noter les élèves ?' });
  s.creeLe = '2026-09-05T09:00:00.000Z';
  const u1 = { ...L.createUnite({ texteSource: 'a', texte: 'si on note, ils vont stresser puis décrocher', categorie: 'pente-glissante', origine: 'ia' }), timestamp: '2026-09-05T09:01:00.000Z', camp: 'contre' };
  const u2 = { ...L.createUnite({ texteSource: 'b', texte: 'la moyenne a chuté de 3 points', categorie: 'affirmation-factuelle', origine: 'ia' }), timestamp: '2026-09-05T09:02:00.000Z', camp: 'pour', aVerifier: true };
  s = L.addUnite(L.addUnite(s, u1), u2);
  const txt = L.formatExport(s);
  assert.match(txt, /ArgumentActif/);
  assert.match(txt, /Faut-il noter les élèves \?/);
  assert.match(txt, /PENTE GLISSANTE \| camp: contre/);
  assert.match(txt, /AFFIRMATION FACTUELLE VÉRIFIABLE — À VÉRIFIER \| camp: pour/);
  assert.match(txt, /"la moyenne a chuté de 3 points"/);
  assert.match(txt, /Unités à vérifier par les élèves\s*:\s*1/);
});

test('formatExport gère une séance vide sans planter', () => {
  const txt = L.formatExport(L.clearSeance({ sujet: '' }));
  assert.match(txt, /Aucune unité/);
});

test('formatExport n\'affiche jamais de verdict vrai/faux', () => {
  let s = L.clearSeance({ sujet: 's' });
  s = L.addUnite(s, L.createUnite({ texteSource: 'a', texte: 'x', categorie: 'affirmation-factuelle', origine: 'ia' }));
  const txt = L.formatExport(s);
  assert.doesNotMatch(txt, /\b(vrai|faux|correct|incorrect|erroné)\b/i);
});
