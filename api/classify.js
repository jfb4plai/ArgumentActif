'use strict';
// Proxy serverless optionnel : cache la clé PLAI. Reçoit { texte, sujet },
// relaie la réponse structurée du modèle telle quelle. Aucune autre logique.
const { buildClassifyRequest } = require('../logic.js');

const ALLOWED_ORIGIN = process.env.ARGUMENTACTIF_ORIGIN || '';

module.exports = async function handler(req, res) {
  if (ALLOWED_ORIGIN) res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée.' });

  const texte = req.body && req.body.texte;
  const sujet = (req.body && req.body.sujet) || '';
  if (!texte || !String(texte).trim()) {
    return res.status(400).json({ error: 'Champ "texte" requis.' });
  }
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return res.status(500).json({ error: 'Erreur de configuration serveur (clé API absente).' });
  }

  try {
    const r = buildClassifyRequest({ mode: 'cle', apiKey: key, texte, sujet });
    const upstream = await fetch(r.url, { method: 'POST', headers: r.headers, body: r.body });
    const data = await upstream.json();
    if (!upstream.ok) {
      return res.status(502).json({ error: 'Le modèle a renvoyé une erreur.', detail: data });
    }
    return res.status(200).json(data);
  } catch (e) {
    return res.status(502).json({ error: 'Appel au modèle impossible.', detail: String(e && e.message) });
  }
};
