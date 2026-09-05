# ArgumentActif — cas limites

Règle générale : en cas de doute, l'app retient la catégorie la moins accusatoire
(ex. pas de « homme de paille » sans déformation nette) et l'enseignant reclasse d'un
clic. Cette liste est ouverte — y ajouter tout cas rencontré en classe.

| Cas | Comment l'app le gère |
|---|---|
| Une phrase relève de plusieurs catégories | Le modèle renvoie **une seule** catégorie, la dominante. Reclassement manuel possible. La pluralité se discute au débriefing. |
| Question rhétorique vs vraie question | `question-rhetorique` seulement si la formulation n'attend pas de réponse ou sert d'esquive. Sinon `opinion` / `affirmation-factuelle`, ou reclassement manuel. |
| Ironie, second degré | Le modèle classe le sens littéral. Limite assumée : l'enseignant reclasse. |
| Reformulation de l'adversaire fidèle vs déformée | `homme-de-paille` uniquement si déformation. Une reformulation fidèle n'est pas étiquetée. |
| Fait + opinion dans la même phrase | Le modèle découpe en deux unités (`affirmation-factuelle` + `opinion`). |
| Segment vocal mal reconnu | Relecture humaine imposée dans la zone éditable avant classification. |
| Débit rapide / plusieurs locuteurs | L'enseignant segmente à la saisie. Aucune attribution de locuteur. |
| Catégories hors corpus FR (pente glissante, fausse dichotomie, homme de paille) | Documentées comme issues de la logique informelle (Hamblin 1970). Définitions calées sur Plantin 2025. |
| Nature de la liste des 10 catégories | Typologie pédagogique, pas taxonomie scientifique exhaustive. |
| Échec réseau / clé invalide | Bascule automatique en mode manuel, message clair, texte saisi conservé. |
