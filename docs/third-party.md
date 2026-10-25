# Éléments tiers et droits

Le code du projet est publié sous [licence MIT](../LICENSE). Cette licence ne modifie pas les conditions des services utilisés ni celles des composants tiers.

## Inventaire du dépôt

| Élément | Présence et provenance observables |
| --- | --- |
| Modules applicatifs, HTML et CSS | Sources conservées dans ce dépôt ; aucune dépendance npm applicative déclarée dans `package.json` |
| `assets/forest.svg` | Paysage vectoriel local ; `scripts/create_art.py` fournit un générateur déterministe utilisant la bibliothèque standard Python |
| `assets/ranger.svg`, `assets/emblem.svg` | Illustrations SVG locales, sans référence à une ressource distante ni notice de tiers embarquée |
| `src/icons.js` | Tracés SVG intégrés au code ; aucune bibliothèque d’icônes externe importée |
| Ambiance sonore | Oscillateurs et bruit synthétisés par `toggleSound()` dans `src/app.js` ; aucun enregistrement audio distribué |
| Texte des fixtures | Réponses fictives dans `tests/fixtures.mjs`, destinées aux tests automatiques |

La présence d’une source locale ou d’un générateur ne démontre pas à elle seule l’identité de son auteur. Cette notice décrit les fichiers vérifiables ; elle n’attribue pas une origine ou une contribution personnelle non documentée.

## Services et composants externes

- **Codex CLI et OpenAI** : le programme utilise une installation existante de Codex et le compte connecté. Il ne redistribue pas la CLI. La narration nécessite un accès au service et utilise son quota. Voir [la documentation de Codex CLI](https://learn.chatgpt.com/docs/cli).
- **Google Fonts** : `styles.css` importe Cormorant Garamond et DM Sans depuis `fonts.googleapis.com`, avec les fichiers servis par `fonts.gstatic.com`. Aucune police n’est embarquée dans le dépôt. Le navigateur contacte ces services pour les charger ; des polices système sont prévues en repli. Avant un auto-hébergement éventuel, récupérer les licences et notices avec les fichiers concernés.
- **Node.js** : environnement d’exécution externe, non redistribué dans le dépôt. Le projet utilise ses modules standard.
- **Python** : uniquement nécessaire pour reconstruire le paysage avec `scripts/create_art.py`, pas pour jouer.

Les histoires générées pendant une partie dépendent des réponses du service. Ne pas utiliser de données personnelles ou confidentielles comme données de démonstration. Les traces des essais et les rapports locaux restent dans `.runtime/`, hors versionnement.
