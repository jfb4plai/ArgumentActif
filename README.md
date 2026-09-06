# ArgumentActif

Outil web autonome pour le secondaire (FWB) : il met un **nom** sur le type de mouvement
argumentatif employé (sophisme, appel à l'émotion, généralisation abusive…), comme une
étiquette descriptive. Il ne génère **jamais** de réplique, de contre-argument ni de
verdict de vérité — les élèves construisent eux-mêmes la réponse.

**Deux scénarios, par valeur ajoutée décroissante :**

1. **Critiquer une réponse d'IA (« texte de départ ») — recommandé.** Un texte figé, le
   même pour toute la classe, analysé posément : pas de goulot de transcription, on peut
   délibérer. C'est le scénario le mieux étayé par la recherche (voir *Scénario A* plus bas).
2. **Étiqueter un débat oral en direct.** Possible, mais c'est le mode le plus exigeant à
   animer (transcrire en temps réel + modérer + projeter) et le moins validé. L'étiquetage
   complet se fait de toute façon **au débriefing**, à froid. À réserver à une classe déjà
   rodée au débat réglé, en visant 4-6 moments marquants, pas l'exhaustivité.

Là où l'outil apporte le plus : la **préparation** (choix et cadrage du texte / du sujet)
et le **débriefing guidé**. L'affichage en direct est un support, pas un oracle.

> **Limite de fond.** Nommer un procédé n'est pas le comprendre : le risque connu est la
> « chasse aux sophismes » (lancer « homme de paille ! » comme un coup, sans examiner le
> raisonnement). L'étiquette ne vaut que si elle ouvre une discussion sur le fond. Et un
> élève fragile est *plus* exposé à l'oral analysé en direct, pas moins — d'où la
> préférence pour le Scénario A, où l'objet critiqué est la machine. Dispositif cohérent
> avec la recherche, **pas validé par elle**. Voir *Limites connues*.

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
1. `api/classify.js` est déjà dans le repo. Protections en place : verrou d'origine,
   limitation de débit (15 req/min/IP, 800 req/h/instance — compteurs en mémoire,
   remis à zéro à froid), plafond de taille (413 au-delà de 5000 caractères).
2. Dans Vercel → Settings → Environment Variables :
   - `ANTHROPIC_API_KEY` = la clé `sk-ant-…`
   - `ARGUMENTACTIF_ORIGIN` = `https://argumentactif.jfb4plai.com` (active le verrou
     d'origine + le CORS ; **fortement recommandé** avant d'exposer une clé perso).
3. Redéployer. L'URL du proxy est `https://argumentactif.jfb4plai.com/api/classify`.
4. Pour un usage à large échelle, remplacer les compteurs mémoire par un rate-limit
   persistant (Vercel KV / Upstash).

## Scénario A — critiquer une réponse d'IA

1. **Avant la séance** : demande à une IA (ChatGPT, Claude, Gemini…) une réponse sur
   un sujet. Copie-la telle quelle dans le champ **Texte de départ** ; note la
   provenance (quelle IA, quel prompt).
2. **En classe** : la projection affiche le texte en grand — phase de lecture commune.
3. **Débat** : les élèves critiquent le texte. ArgumentActif étiquette **leurs**
   mouvements argumentatifs pendant qu'ils argumentent. Dès la première unité, la
   projection bascule sur le débat ; le bouton « Remontrer le texte de départ »
   permet d'y revenir.
4. **Débriefing** : mode « Masquer les étiquettes » pour faire re-identifier les
   élèves, puis le sous-panneau « Repérer un mouvement dans le texte de l'IA » : la
   classe étiquette à la main des passages du texte. L'export sépare les deux.

**L'outil n'analyse jamais le texte de l'IA automatiquement.** Il ne reçoit que ce que
tu tapes dans « Propos entendu ». L'étiquetage du texte de départ est toujours un clic
humain.

### Ancrage scientifique (corpus RISS, vérifié le 2026-09-06)

- Pallares, *Développer les compétences argumentatives de lycéens par des débats
  numériques sur des QSS*, thèse 2019 — HAL `tel-02934427`
- Pallarès, de Checchi & Bächtold, *Quelle didactique pour « l'esprit critique » ?*,
  RDST 2023 — DOI 10.4000/rdst.5221
- de Checchi, *Liens entre croyances épistémiques et argumentation de lycéens sur des
  QSS*, thèse 2021 — HAL `tel-03371644`
- Barrué, *Débat sur une question socioscientifique : expertise de l'information*,
  2017 — DOI 10.24452/sjer.39.1.5006
- Bouazouni, *Le rôle du professeur documentaliste dans la promotion d'une approche
  raisonnée de l'IA générative*, 2024 — HAL `dumas-04741267`
- Clédat & Sablayrolles, *ChatGPT pour la géomatique, potentiel d'utilisation et
  limites*, 2023 — HAL `hal-04424653`
- Lacroux & Martin-Lacroux, *Croire ou ne pas croire les algorithmes… ?*, 2022 —
  HAL `hal-04095500` (biais d'automation — le risque que ce format combat)

Aucun travail du corpus n'évalue empiriquement un outil d'étiquetage en direct couplé
à la critique d'une sortie d'IA : le dispositif est cohérent avec la recherche, pas
validé par elle.

## Choix pédagogiques du classement

Les 10 catégories sont regroupées en **3 familles** pour alléger le choix en direct
(« avare cognitif » — Salès-Wuillemin, *La catégorisation en psychologie sociale*,
2006, HAL `halshs-00596051`) :

1. **Est-ce un fait ou un avis ?** — affirmation factuelle, opinion
2. **Le raisonnement tient-il ?** — généralisation abusive, fausse dichotomie, pente
   glissante, argument d'autorité non sourcé
3. **On déplace le débat** — appel à l'émotion, homme de paille, ad hominem, question
   rhétorique

Il n'existe **pas de classification canonique des sophismes** (Plantin, *Dictionnaire
de l'argumentation*, 2025, DOI 10.13140/RG.2.2.32342.97600 ; Bonnemaison 2022,
HAL `tel-04578348`) : ce regroupement est un choix didactique assumé. Un bouton
**« Je ne suis pas sûr·e → à revoir au débriefing »** (= *non classé*) évite de forcer
une catégorie sous la pression du direct.

La **banque de sujets** propose des *questions socialement vives* (Bastide & Morin,
*Éducation formelle, éducation non-formelle…*, 2022, HAL `hal-03807719` ; Morin,
thèse 2013, HAL `tel-00962300`), ancrées dans le contexte FWB.

## Limites connues

- **Nommer ≠ comprendre.** Le risque connu est la « chasse aux sophismes » : l'élève
  apprend à étiqueter comme coup de débat au lieu d'examiner le raisonnement. L'étiquette
  n'a de valeur que si le débriefing la transforme en discussion sur le fond.
- **L'étiquette est une interprétation, pas un fait.** Pas de classification canonique des
  sophismes ; l'IA propose la catégorie *dominante*. À présenter comme discutable en classe.
- **Exposition de l'élève fragile.** L'étiquetage projeté juste après une prise de parole
  peut faire taire — même sans nom affiché. Protéger la parole ; privilégier le Scénario A.
- **Le 20 % enseignant est requis** : choix du texte/sujet, reclassement, animation du
  débriefing. Accepter les étiquettes telles quelles ne produit rien d'utile.
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

