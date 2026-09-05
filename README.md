# ArgumentActif

Outil web autonome pour entraîner des élèves du secondaire (FWB) à l'argumentation
pendant des débats structurés. L'outil **repère et étiquette** le type de mouvement
argumentatif employé (sophisme, appel à l'émotion, généralisation abusive…). Il ne
génère **jamais** de réplique, de contre-argument ni de verdict de vérité — les élèves
construisent eux-mêmes la réponse.

## Lancer l'app

### En local (le plus simple)
Ouvrir `index.html` dans Chrome ou Edge (double-clic ou glisser dans une fenêtre).
La reconnaissance vocale et la saisie clavier fonctionnent. Pour la classification
automatique, renseigner une clé API (voir plus bas) ou rester en mode manuel.

### Hébergé (Vercel)
Déploiement continu depuis GitHub (`jfb4plai/ArgumentActif`, branche `main`) vers
`argumentactif.jfb4plai.com`. Le fichier livré est `index.html` (généré par
`npm run build` — ne pas éditer à la main ; éditer `index.template.html`, `logic.js`,
`app.js`).

## Trois modes d'accès au modèle

| Mode | Comment | Où va la clé |
|---|---|---|
| **Proxy** | Coller l'URL du proxy dans « Avant le débat » | nulle part côté navigateur — elle reste sur le serveur Vercel |
| **Clé personnelle** | Coller une clé `sk-ant-…` | en mémoire de l'onglet uniquement (`sessionStorage`), jamais enregistrée, envoyée seulement à `api.anthropic.com` |
| **Manuel / hors ligne** | Ne rien renseigner | aucune — l'enseignant segmente et clique la catégorie |

### Déployer le proxy (optionnel, recommandé pour une clé PLAI partagée)
1. `api/classify.js` est déjà dans le repo.
2. Dans Vercel → Settings → Environment Variables : ajouter `ANTHROPIC_API_KEY`
   (et, pour restreindre le CORS, `ARGUMENTACTIF_ORIGIN=https://argumentactif.jfb4plai.com`).
3. L'URL du proxy est `https://<déploiement>/api/classify`.

## Limites connues

- **Reconnaissance vocale** : dépend du navigateur (Chrome/Edge OK, Firefox/Safari non
  à ce jour). En classe bruyante ou à plusieurs locuteurs, la transcription est peu
  fiable — la saisie clavier reste le mode de secours et est toujours disponible. Un
  message clair s'affiche si le navigateur ne supporte pas la dictée.
- **Classification automatique** : elle propose un type de mouvement, elle ne le
  garantit pas. L'enseignant reclasse n'importe quelle unité d'un clic. Les phrases
  ambiguës reçoivent la catégorie *dominante* — voir `CAS-LIMITES.md`.
- **Dispositif non validé empiriquement** : le corpus scientifique francophone (RISS)
  soutient chacun des principes de conception (voir la spec), mais aucun travail publié
  n'évalue un outil d'étiquetage en direct des sophismes pendant un débat de classe.
  À utiliser comme support de discussion, pas comme autorité.
- **Aucune persistance** : rien n'est enregistré au-delà de la session (pas d'audio,
  pas de transcription). Exporter le débriefing (`.txt`) avant de fermer l'onglet.
- **Vues** : la projection s'ouvre dans une 2e fenêtre sur le même appareil
  (synchronisation locale). Pas de partage réseau entre appareils.

## Ancrage scientifique (corpus RISS, vérifié le 2026-09-05)

- Pallarès, de Checchi & Bächtold, *Quelle didactique pour l'esprit critique ?*,
  RDST 2023 — DOI 10.4000/rdst.5221
- Beaulac & Robert, *Théories à processus duaux et enseignement de la pensée critique
  et de la logique*, 2018 — DOI 10.7202/1044302ar
- Plantin, *Dictionnaire de l'argumentation*, 2025 — DOI 10.13140/RG.2.2.32342.97600
- Renard, *Comprendre les malentendus dans l'argumentation pour réduire les inégalités
  d'apprentissage*, 2024 — HAL hal-05136758
- Gagnon, *Le débat régulé oral*, 2010 — DOI 10.24452/sjer.32.1.4825
- Vandenbroucke, *Améliorer la compréhension de textes narratifs chez les élèves
  dyslexiques de CM2*, 2016 — HAL tel-01416775

Catégories issues de la logique informelle (pente glissante, fausse dichotomie, homme
de paille) : Hamblin, *Fallacies*, 1970 — réel, hors corpus RISS francophone dédié.

## Développement

```bash
npm test        # tests unitaires de la logique pure (node:test)
npm run build   # régénère index.html depuis le template + logic.js + app.js
npx vercel dev  # sert l'app + le proxy /api en local
```
