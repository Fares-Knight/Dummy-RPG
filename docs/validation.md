# Vérifications de publication

Audit du 25 octobre 2026. Périmètre : ce dépôt, son serveur local et sa publication GitHub. Aucune démonstration hébergée n'est prévue.

## Résultats observés

- État initial : 16 tests réussis. Aucun dépôt Git ni historique n'existait dans le dossier.
- Après corrections : 28/28 tests réussis sous Windows, couvrant règles, narrateur, routes HTTP et reprise côté interface ; commande `node --test tests/*.test.mjs`. Le test de PATH Windows est ignoré sur les autres systèmes.
- Syntaxe des modules : `node scripts/check.mjs`.
- Copie propre sans `.runtime`, `.env`, paquets ou identifiants Codex : syntaxe, tests et démarrage HTTP vérifiés ; l'indisponibilité volontaire du narrateur est correctement annoncée.
- Intégration réelle sous Windows : démarrage puis choix gratuit via HTTP, deux réponses Codex valides et sauvegardes restaurables. Node.js 24.22.1, Codex CLI `0.164.0-alpha.11.1`, modèle annoncé `gpt-6.1-sol`. Durées observées : 33,1 s et 32,8 s ; ces deux mesures ne garantissent pas les performances futures.
- Gitleaks 8.30.1 : contenu destiné à la publication analysé avec masquage intégral des résultats sensibles. Aucun secret détecté dans les sources du projet. Les rapports et traces restent dans `.runtime/audit/`, exclu de Git et non servi par HTTP.
- Aucun paquet npm applicatif déclaré ; pas de compilation, de transpilation, de source maps, de typage statique ou de linter configuré. Le contrôle de syntaxe n'est pas un lint.

Le [workflow CI](../.github/workflows/ci.yml) exécute la syntaxe et les tests sur Node.js 22/24, Ubuntu/Windows. Les résultats distants sont consultables dans l'onglet Actions du dépôt. Les essais Codex réels ne sont pas lancés en CI et aucun identifiant n'y est fourni.

## Corrections et preuves

| Constat confirmé | Gravité et impact | Correction et vérification |
| --- | --- | --- |
| Une réponse IA pouvait proposer de nouveaux choix à cinq points de progression. | Moyenne, fonctionnelle : quête sans conclusion obligatoire. | Validation de la conclusion dans `src/engine.js` ; test de régression avec fin normale, mort et sauvegarde. |
| Après une erreur réseau, une autre décision pouvait remplacer la demande en attente. | Moyenne, fonctionnelle : récupération du résultat initial perdue. | Blocage des nouveaux choix et de la poursuite tant que la demande existe ; tests de la vraie source avec DOM, réseau et stockage simulés, y compris réessai et rechargement. |
| Aucune protection contre l'encadrement par une page tierce. | Moyenne : le chargement du jeu peut déclencher une génération avec le compte local. | CSP `frame-ancestors 'none'`, `X-Frame-Options: DENY` et refus cross-site ; tests HTTP. |
| `/api/status` pouvait déclencher plusieurs vérifications CLI simultanées et acceptait une origine externe. | Faible : processus superflus et surface d'appel locale inutile. | Contrôle d'origine et Fetch Metadata, regroupement des requêtes et cache de cinq secondes ; tests HTTP. |
| Un chemin encodé sous Windows contournait les préfixes des ressources autorisées. | Faible : accès possible à un autre fichier de type public dans le dossier projet. | Liste exacte de huit ressources ; test du chemin encodé et des fichiers privés. |
| Le badge de quête était nommé « Niveau du personnage ». | Faible : présentation trompeuse d'un système d'expérience absent. | Libellé remplacé par « Numéro de quête ». |
| La découverte Windows cherchait seulement `codex.exe` sur le PATH. | Moyenne, reproductibilité : une installation npm ne proposant que `codex.cmd` n'était pas reconnue sans extension VS Code. | Résolution du binaire natif du paquet npm, sans shell ; tests des installations globale/locale, des architectures, des fichiers manquants et d'un PATH npm isolé sous Windows. L'inférence réelle a été vérifiée avec la CLI de l'extension. |

## Limites des vérifications

Le contrôle navigateur a été arrêté par l'outil d'automatisation : le contrôle des URL n'était pas pris en charge pour le navigateur Windows disponible. **Aucun résultat de test visuel ni capture de partie n'est revendiqué.** L'image du README est un SVG réellement utilisé dans le jeu. Les tests DOM simulés ne couvrent ni le rendu, ni le son, ni les technologies d'assistance.

Le scanner détecte des motifs connus, pas tous les secrets ou données sensibles possibles. La revue ciblée des sources complète ce contrôle sans garantir une sécurité absolue. Le premier scan du dossier local incluait les outils téléchargés : deux exemples dans le README de Gitleaks ont été signalés, hors projet et hors publication. Les binaires de ces outils ne sont pas distribués.

L'essai réel couvre deux scènes, pas une campagne longue ni tous les modèles ou systèmes. L'état reste fourni par le navigateur et modifiable par son utilisateur ; il convient à ce prototype solo local. Le [reste à faire](roadmap.md) distingue ces limites des fonctionnalités disponibles.
