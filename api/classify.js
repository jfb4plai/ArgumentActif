'use strict';
// Proxy serverless optionnel : cache la clé PLAI. Reçoit { texte, sujet },
// relaie l'enveloppe du modèle telle quelle.
//
// ⚠️ Ce proxy n'a PAS de limitation de débit. Ne définir ANTHROPIC_API_KEY
// (donc n'activer le proxy) qu'avec, au minimum, l'un de :
//   - un rate-limit par IP (Vercel KV / Upstash),
//   - un secret partagé (en-tête personnalisé vérifié ici),
//   - le mode « clé personnelle » de l'enseignant en attendant.
// Voir README § Déployer le proxy.
const { buildClassifyRequest } = require('../logic.js');

const ALLOWED_ORIGIN = process.env.ARGUMENTACTIF_ORIGIN || '';

module.exports = async function handler(req, res) {
  if (ALLOWED_ORIGIN) res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée.' });

  const texte = req.body && req.body.texte;
  const sujet = String((req.body && req.body.sujet) || '').slice(0, 300);
  if (!texte || !String(texte).trim()) {
    return res.status(400).json({ error: 'Champ "texte" requis.' });
  }
  if (String(texte).length > 5000) {
    return res.status(413).json({ error: 'Passage trop long.' });
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
      console.error('upstream error', upstream.status);
      return res.status(502).json({ error: 'Le modèle a renvoyé une erreur.' });
    }
    return res.status(200).json(data);
  } catch (e) {
    console.error('proxy error', e && e.message);
    return res.status(502).json({ error: 'Appel au modèle impossible.' });
  }
};
