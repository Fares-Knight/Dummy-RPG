# Limites et reste à faire

Cette liste décrit des travaux vérifiables, sans date ni estimation d’avancement. **P1** désigne un besoin de fiabilité ou de reproductibilité prioritaire ; **P2** une limite à traiter selon l’usage ; **P3** une suggestion facultative. Ce n’est pas une promesse de développement.

Les corrections nécessaires à la publication sont documentées avec les preuves de vérification dans le [rapport de validation](validation.md). Aucun catalogue de fonctionnalités futures n’est déduit des éléments décoratifs de l’interface. Aucun `TODO` ou `FIXME` applicatif n’a été trouvé lors de la revue initiale.

## Dette technique et limites attestées

| Priorité | Élément, source et impact | Dépendance ou décision | Critère d’acceptation |
| --- | --- | --- | --- |
| P1 | **Compatibilité de Codex CLI.** `server/narrator.mjs`, `codexArguments()` et `findCodex()` : découverte locale et options dépendantes de la version ; une autre installation peut échouer avant la génération. | Définir les systèmes et versions CLI pris en charge. | Documenter une version vérifiée et exécuter un démarrage puis un choix réel sur chaque combinaison annoncée ; afficher un diagnostic exploitable pour une version incompatible. |
| P2 | **Reprise limitée à la mémoire serveur.** `server.mjs`, cache `results` : 24 réussites, perdues au redémarrage ; une demande peut être générée de nouveau. | Choisir si une persistance locale des résultats est utile au-delà du prototype. | Un test de redémarrage démontre la récupération du même résultat, ou la limite reste explicitement documentée et acceptée. |
| P2 | **Continuité narrative sur une longue partie.** `server/narrator.mjs`, `buildPrompt()` et `validateNarration()` dans `src/engine.js` : six étapes détaillées et mémoire produite par le modèle ; la validation ne prouve pas la cohérence sémantique. | Définir un protocole d’évaluation et un budget d’essais réels. | Vérifier un ensemble déclaré de parties avec des faits récurrents ; consigner les contradictions observées et les limites sans généraliser à toutes les générations. |
| P2 | **Sauvegarde locale seulement.** `src/app.js`, fonctions `save()` et lecture de `localStorage` : perte possible après effacement du stockage ou changement de navigateur, profil, adresse ou port. | Décider si la portabilité des sauvegardes fait partie du produit. | Si retenue, importer/exporter une sauvegarde versionnée, valider les données et tester les entrées invalides ; sinon conserver la limite visible. |
| P2 | **Application non conçue pour un hébergement public.** `server.mjs` : écoute locale, pas de comptes applicatifs ; narrateur lié à un compte Codex local. | Le périmètre de publication actuel est le code et des captures, sans démo hébergée. Toute extension exige un choix d’accès, de fournisseur et de budget. | Avant tout hébergement éventuel : contrôler l’accès, l’isolation, les quotas et les coûts, puis vérifier les parcours dans un environnement de test distinct. |
| P2 | **Dépendance aux polices distantes.** `styles.css`, import Google Fonts : le rendu exact dépend d’une requête externe. | Choisir entre polices système ou auto-hébergement avec notices appropriées. | Vérifier le rendu sans réseau et la présence des notices pour tout fichier de police redistribué. |
| P2 | **Validation des sauvegardes éditées.** `src/engine.js`, `restoreGame()` : les champs sont bornés mais certaines incohérences, comme une quête marquée terminée avant 5/5, restent acceptées. Le jeu normal ne produit pas cet état. | Conserver la compatibilité des sauvegardes valides ; pas de besoin anti-triche multijoueur. | Rejeter les états incohérents avec des tests, sans invalider les sauvegardes produites normalement. |
| P2 | **Demande locale corrompue.** `src/app.js`, chargement de `.pending` : l'action et l'identifiant sont vérifiés, pas toute la requête. Un stockage modifié peut provoquer des erreurs 400 répétées. | Définir une récupération qui conserve la dernière partie valide. | Détecter la demande incohérente et proposer de la retirer explicitement sans perdre la sauvegarde. |
| P1 | **Captures et contrôle visuel.** L'automatisation navigateur n'a pas pu démarrer pendant l'audit ; les tests DOM simulés ne vérifient pas le rendu. | Accès à un navigateur pris en charge ou vérification manuelle. | Vérifier le parcours principal, les petits écrans, le clavier et le son ; ajouter des captures réelles avec données fictives. |

## Suggestions nouvelles, sans engagement

| Priorité | Suggestion et motivation | Dépendance ou décision | Critère d’acceptation si retenue |
| --- | --- | --- | --- |
| P3 | Ajouter un petit protocole d’évaluation de l’accessibilité : le code comporte des libellés, des raccourcis et des modales, mais cela ne constitue pas un audit complet. | Choisir les navigateurs et technologies d’assistance cibles. | Réaliser le parcours principal au clavier et avec un lecteur d’écran, puis consigner et corriger les obstacles observés. |
| P3 | Proposer un export lisible du journal, pour conserver une aventure sans recopier le stockage du navigateur. | Confirmer l’intérêt utilisateur et le format d’export. | Exporter les entrées présentes avec ordre, choix et conséquences, sans y inclure de jeton ou d’information de compte. |

La carte décorative, le niveau de quête et les objets narratifs ne prouvent pas l’existence de fonctionnalités inachevées de déplacement, d’expérience ou de combat. Ces développements ne sont donc pas présentés ici comme des engagements antérieurs.
