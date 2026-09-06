'use strict';
// Proxy serverless : cache la clé côté serveur. Reçoit { texte, sujet },
// relaie l'enveloppe du modèle. Protections : verrou d'origine, limitation
// de débit par IP et globale (en mémoire, par instance), plafond de taille.
//
// Reste imparfait (les compteurs mémoire repartent à zéro à froid). Pour un
// usage à large échelle : rate-limit persistant (Vercel KV / Upstash).
const { buildClassifyRequest } = require('../logic.js');

const ALLOWED_ORIGIN = process.env.ARGUMENTACTIF_ORIGIN || '';

// ── Limitation de débit (en mémoire, par instance serverless) ──
const IP_WINDOW_MS = 60_000;
const IP_MAX = 15;                 // requêtes / minute / IP
const GLOBAL_WINDOW_MS = 3_600_000;
const GLOBAL_MAX = 800;            // requêtes / heure / instance

const ipHits = new Map();          // ip -> { n, resetAt }
let globalHits = { n: 0, resetAt: 0 };

function tropDeRequetes(ip, now) {
  if (now > globalHits.resetAt) globalHits = { n: 0, resetAt: now + GLOBAL_WINDOW_MS };
  globalHits.n += 1;
  if (globalHits.n > GLOBAL_MAX) {
    return { retryAfter: Math.max(1, Math.ceil((globalHits.resetAt - now) / 1000)) };
  }
  let e = ipHits.get(ip);
  if (!e || now > e.resetAt) { e = { n: 0, resetAt: now + IP_WINDOW_MS }; ipHits.set(ip, e); }
  e.n += 1;
  if (ipHits.size > 5000) ipHits.clear(); // garde-fou mémoire
  if (e.n > IP_MAX) {
    return { retryAfter: Math.max(1, Math.ceil((e.resetAt - now) / 1000)) };
  }
  return null;
}

function clientIp(req) {
  const h = req.headers || {};
  if (h['x-forwarded-for']) return String(h['x-forwarded-for']).split(',')[0].trim();
  return (req.socket && req.socket.remoteAddress) || 'inconnu';
}

function originAutorisee(req) {
  if (!ALLOWED_ORIGIN) return true;
  const h = req.headers || {};
  if (h.origin) return h.origin === ALLOWED_ORIGIN;
  if (h.referer) return String(h.referer).startsWith(ALLOWED_ORIGIN);
  return false; // origine attendue mais aucun en-tête → refus
}

module.exports = async function handler(req, res) {
  if (ALLOWED_ORIGIN) res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée.' });

  if (!originAutorisee(req)) {
    return res.status(403).json({ error: 'Origine non autorisée.' });
  }

  const limite = tropDeRequetes(clientIp(req), Date.now());
  if (limite) {
    res.setHeader('Retry-After', String(limite.retryAfter));
    return res.status(429).json({ error: 'Trop de requêtes — réessaie dans un instant.' });
  }

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

// remise à zéro des compteurs — pour les tests uniquement
module.exports._resetLimites = () => { ipHits.clear(); globalHits = { n: 0, resetAt: 0 }; };
