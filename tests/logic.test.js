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

test('setCamp accepte pour/contre/null et rejette le reste (dont autre)', () => {
  let s = L.clearSeance({ sujet: 's' });
  const u = L.createUnite({ texteSource: 'a', texte: 'a', categorie: 'opinion', origine: 'ia' });
  s = L.addUnite(s, u);
  s = L.setCamp(s, u.id, 'contre');
  assert.equal(s.unites[0].camp, 'contre');
  s = L.setCamp(s, u.id, 'pour');
  assert.equal(s.unites[0].camp, 'pour');
  s = L.setCamp(s, u.id, null);
  assert.equal(s.unites[0].camp, null);
  assert.throws(() => L.setCamp(s, u.id, 'autre'), /camp/i);
  assert.throws(() => L.setCamp(s, u.id, 'Kevin'), /camp/i);
});

test('CAMPS = pour, contre', () => {
  assert.deepEqual(L.CAMPS, ['pour', 'contre']);
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
  assert.match(txt, /Affirmations à vérifier par les élèves\s*:\s*1/);
});

test('formatExport gère une séance vide sans planter', () => {
  const txt = L.formatExport(L.clearSeance({ sujet: '' }));
  assert.match(txt, /Aucune prise de parole/);
});

test('formatExport n\'affiche jamais de verdict vrai/faux', () => {
  let s = L.clearSeance({ sujet: 's' });
  s = L.addUnite(s, L.createUnite({ texteSource: 'a', texte: 'x', categorie: 'affirmation-factuelle', origine: 'ia' }));
  const txt = L.formatExport(s);
  assert.doesNotMatch(txt, /\b(vrai|faux|correct|incorrect|erroné)\b/i);
});

test('detectMode: proxy si URL de proxy fournie', () => {
  assert.equal(L.detectMode({ proxyUrl: 'https://x.vercel.app/api/classify', apiKey: '' }), 'proxy');
  assert.equal(L.detectMode({ proxyUrl: 'https://x/api/classify', apiKey: 'sk-ant-xxx' }), 'proxy');
});

test('detectMode: cle si clé fournie et pas de proxy', () => {
  assert.equal(L.detectMode({ proxyUrl: '', apiKey: 'sk-ant-abc' }), 'cle');
  assert.equal(L.detectMode({ proxyUrl: '   ', apiKey: '  sk-ant-abc ' }), 'cle');
});

test('detectMode: manuel si rien', () => {
  assert.equal(L.detectMode({ proxyUrl: '', apiKey: '' }), 'manuel');
  assert.equal(L.detectMode({}), 'manuel');
});

test('buildClassifyRequest mode cle: endpoint Anthropic, headers clé + version + browser flag', () => {
  const r = L.buildClassifyRequest({ mode: 'cle', apiKey: 'sk-ant-K', texte: 'Tout le monde sait que X.', sujet: 'S' });
  assert.equal(r.url, 'https://api.anthropic.com/v1/messages');
  assert.equal(r.headers['x-api-key'], 'sk-ant-K');
  assert.equal(r.headers['anthropic-version'], '2023-06-01');
  assert.equal(r.headers['anthropic-dangerous-direct-browser-access'], 'true');
  assert.equal(r.headers['content-type'], 'application/json');
});

test('buildClassifyRequest mode proxy: endpoint proxy, aucun secret dans les headers', () => {
  const r = L.buildClassifyRequest({ mode: 'proxy', proxyUrl: 'https://p.vercel.app/api/classify', texte: 't', sujet: 'S' });
  assert.equal(r.url, 'https://p.vercel.app/api/classify');
  assert.equal(r.headers['x-api-key'], undefined);
  assert.deepEqual(JSON.parse(r.body), { texte: 't', sujet: 'S' });
});

test('buildClassifyRequest mode cle: body contient le system prompt contraignant et le schéma', () => {
  const r = L.buildClassifyRequest({ mode: 'cle', apiKey: 'k', texte: 'phrase', sujet: "Le sport à l'école" });
  const b = JSON.parse(r.body);
  assert.equal(b.model, 'claude-sonnet-5');
  assert.ok(b.max_tokens <= 800);
  assert.equal(b.temperature, undefined, 'pas de temperature (400 sur sonnet-5)');
  assert.equal(b.top_p, undefined);
  assert.equal(b.top_k, undefined);
  assert.deepEqual(b.thinking, { type: 'disabled' });
  assert.equal(b.output_config.effort, 'low');
  assert.equal(b.output_config.format.type, 'json_schema');
  assert.ok(b.output_config.format.schema && b.output_config.format.schema.type === 'object');
  assert.match(b.system, /jamais.*réplique|jamais.*contre-argument/i);
  assert.match(b.system, /jamais.*(vrai|faux)/i);
  assert.match(b.system, /dominante/i);
  for (const k of L.CATEGORIES) assert.ok(b.system.includes(k), `system mentionne ${k}`);
  assert.match(b.messages[0].content, /phrase/);
  assert.match(b.messages[0].content, /Le sport à l'école/);
});

test('buildClassifyRequest mode manuel: jette une erreur (aucun appel réseau attendu)', () => {
  assert.throws(() => L.buildClassifyRequest({ mode: 'manuel', texte: 't' }), /manuel/i);
});

test('buildClassifyRequest exige un texte non vide', () => {
  assert.throws(() => L.buildClassifyRequest({ mode: 'cle', apiKey: 'k', texte: '   ' }), /texte/i);
});

test('removeUnite retire l\'unité ciblée sans muter l\'ancien état', () => {
  let s = L.clearSeance({ sujet: 's' });
  const u1 = L.createUnite({ texteSource: 'a', texte: 'a', categorie: 'opinion', origine: 'ia' });
  const u2 = L.createUnite({ texteSource: 'b', texte: 'b', categorie: 'opinion', origine: 'ia' });
  s = L.addUnite(L.addUnite(s, u1), u2);
  const s2 = L.removeUnite(s, u1.id);
  assert.equal(s.unites.length, 2);
  assert.equal(s2.unites.length, 1);
  assert.equal(s2.unites[0].id, u2.id);
});

test('buildClassifyRequest tronque un texte trop long à MAX_TEXTE', () => {
  const long = 'x'.repeat(L.MAX_TEXTE + 500);
  const r = L.buildClassifyRequest({ mode: 'cle', apiKey: 'k', texte: long, sujet: 's' });
  const b = JSON.parse(r.body);
  const passage = b.messages[0].content;
  // le passage inséré ne contient pas plus de MAX_TEXTE 'x'
  assert.ok((passage.match(/x/g) || []).length <= L.MAX_TEXTE);
});

test('clearSeance initialise texteDepart, sourceIA à vide et phase à debat', () => {
  const s = L.clearSeance({ sujet: 'S' });
  assert.equal(s.texteDepart, '');
  assert.equal(s.sourceIA, '');
  assert.equal(s.phase, 'debat');
});

test('clearSeance normalise texteDepart et sourceIA fournis', () => {
  const s = L.clearSeance({ sujet: 'S', texteDepart: 'Réponse de l\'IA…', sourceIA: 'ChatGPT' });
  assert.equal(s.texteDepart, 'Réponse de l\'IA…');
  assert.equal(s.sourceIA, 'ChatGPT');
  assert.equal(s.phase, 'debat');
});

test('clearSeance : texteDepart/sourceIA non-string deviennent vide', () => {
  const s = L.clearSeance({ sujet: 'S', texteDepart: null, sourceIA: undefined });
  assert.equal(s.texteDepart, '');
  assert.equal(s.sourceIA, '');
});

test('createUnite accepte origine "texte-depart"', () => {
  const u = L.createUnite({ texteSource: 'txt', texte: 'un passage', categorie: 'opinion', origine: 'texte-depart' });
  assert.equal(u.origine, 'texte-depart');
  assert.equal(u.camp, null);
});

test('createUnite refuse toujours une origine inconnue', () => {
  assert.throws(() => L.createUnite({ texteSource: 'x', texte: 'x', categorie: 'opinion', origine: 'robot' }), /origine/i);
});

test('formatExport sans texteDepart : format inchangé (liste unique)', () => {
  let s = L.clearSeance({ sujet: 'Sujet X' });
  s = L.addUnite(s, { ...L.createUnite({ texteSource: 'a', texte: 'phrase', categorie: 'opinion', origine: 'manuel' }), timestamp: '2026-09-06T10:00:00.000Z' });
  const txt = L.formatExport(s);
  assert.doesNotMatch(txt, /Texte de départ/);
  assert.doesNotMatch(txt, /MOUVEMENTS DES ÉLÈVES/);
  assert.match(txt, /Total de prises de parole : 1/);
});

test('formatExport avec texteDepart : en-tête + 2 sections', () => {
  let s = L.clearSeance({ sujet: 'Les OGM', texteDepart: 'Les OGM sont sans danger.', sourceIA: 'ChatGPT — prompt « OGM ? »' });
  s = L.addUnite(s, { ...L.createUnite({ texteSource: s.texteDepart, texte: 'les OGM sont tous identiques', categorie: 'generalisation-abusive', origine: 'texte-depart' }) });
  s = L.addUnite(s, { ...L.createUnite({ texteSource: 'a', texte: 'on va être empoisonnés', categorie: 'appel-emotion', origine: 'manuel' }), timestamp: '2026-09-06T14:02:00.000Z', camp: 'contre' });
  const txt = L.formatExport(s);
  assert.match(txt, /Texte de départ — provenance : ChatGPT — prompt « OGM \? »/);
  assert.match(txt, /"""\nLes OGM sont sans danger\.\n"""/);
  assert.match(txt, /MOUVEMENTS REPÉRÉS DANS LE TEXTE DE L'IA \(par la classe\)/);
  assert.match(txt, /\[--:--\] GÉNÉRALISATION ABUSIVE/);
  assert.match(txt, /MOUVEMENTS DES ÉLÈVES PENDANT LE DÉBAT/);
  assert.match(txt, /\[14:02\] APPEL À L'ÉMOTION \| camp: contre/);
  assert.match(txt, /Mouvements repérés dans le texte de l'IA : 1/);
  assert.match(txt, /Prises de parole des élèves : 1/);
});

test('formatExport avec texteDepart mais aucune unité texte-depart', () => {
  let s = L.clearSeance({ sujet: 'X', texteDepart: 'blabla', sourceIA: '' });
  s = L.addUnite(s, L.createUnite({ texteSource: 'a', texte: 'phrase', categorie: 'opinion', origine: 'manuel' }));
  const txt = L.formatExport(s);
  assert.match(txt, /provenance : \(non précisée\)/);
  assert.match(txt, /\(aucun mouvement repéré dans le texte pour l'instant\)/);
});

test('formatExport n\'affiche jamais de verdict vrai/faux (avec texteDepart)', () => {
  let s = L.clearSeance({ sujet: 's', texteDepart: 'x', sourceIA: 'y' });
  s = L.addUnite(s, L.createUnite({ texteSource: 'x', texte: 'z', categorie: 'affirmation-factuelle', origine: 'texte-depart' }));
  assert.doesNotMatch(L.formatExport(s), /\b(vrai|faux|correct|incorrect|erroné)\b/i);
});

test('FAMILLES couvre les 10 catégories exactement une fois', () => {
  const cles = L.FAMILLES.flatMap((f) => f.cles);
  assert.equal(cles.length, 10);
  assert.deepEqual([...cles].sort(), [...L.CATEGORIES].sort());
  for (const f of L.FAMILLES) assert.ok(f.titre && f.cles.length >= 1);
});

test('SUJETS : 4 thèmes non vides, prompts se terminant par ?', () => {
  assert.ok(L.SUJETS.length >= 3);
  for (const g of L.SUJETS) {
    assert.ok(g.theme && Array.isArray(g.items) && g.items.length >= 1);
    for (const s of g.items) assert.match(s, /\?\s*$/);
  }
});
