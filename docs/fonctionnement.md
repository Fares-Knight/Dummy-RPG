# Jouer à Lisière

Lisière est une aventure solo en français, centrée sur la lecture et la décision. Vous incarnez Aëlin, rôdeur des terres d’Elderwyn. L’application n’a qu’un rôle joueur ; elle n’offre pas d’éditeur de monde ou de mode multijoueur.

## Parcours principal

1. Démarrer le serveur et ouvrir le jeu. Si aucune partie valide n’est sauvegardée, Codex invente la première situation et une quête.
2. Lire la scène et choisir l’une des trois actions, à la souris ou avec les touches `1`, `2`, `3`. Les coûts en instinct et en or ainsi que les probabilités sont affichés avant le choix. Une action trop coûteuse est désactivée.
3. Attendre la réponse du narrateur. Le moteur a déjà calculé le résultat ; l’IA en écrit la conséquence et la scène suivante. La sauvegarde change seulement après réception d’une réponse valide.
4. Consulter le journal, la carte ou la mémoire du narrateur, et utiliser une potion si nécessaire.
5. Accumuler cinq points de progression pour conclure la quête. « Explorer au-delà de la brume » conserve le personnage et commence une nouvelle quête. Si la vitalité atteint zéro, l’IA écrit l’épilogue et propose un nouveau départ.

Une action gratuite, garantie et faisant progresser la quête est toujours exigée dans une scène non terminale. Les autres choix peuvent ne pas avancer la quête ou échouer : cinq points de progression ne signifient donc pas nécessairement cinq décisions.

## Règles chiffrées

| Élément | Comportement actuel |
| --- | --- |
| Départ | 20 vitalité, 10 instinct, 12 pièces, une dague, deux potions, aucun fragment |
| Coûts par choix | 0 à 3 instinct, 0 à 8 pièces ; dépensés avant le résultat |
| Réussite | Probabilité de 50 à 100 % ; effets définis par le choix, dans les bornes du moteur |
| Gains possibles | 0 à 5 vitalité, 0 à 3 instinct, 0 à 6 pièces, 0 ou 1 progression ; éventuellement une potion ou un fragment |
| Échec | Perte de 1 à 5 vitalité et récupération de 1 instinct, sans butin ni progression |
| Limites | Vitalité entre 0 et 20 ; instinct entre 0 et 10 |
| Potion | Rend au plus 7 vitalité ; n’est pas consommée si la vitalité est déjà maximale |
| Nouvelle quête | Vitalité et instinct restaurés, une potion et 10 pièces ajoutées ; inventaire, journal et mémoire conservés |

La dague et les fragments sont des éléments d’inventaire connus du narrateur ; ils n’ont pas d’action de combat ou d’usage direct dédiée. Le badge affiche le numéro de la quête en cours, à partir de un ; il n’existe pas de système d’expérience ou de compétences.

## Journal, carte et ambiance

Le journal affiche les décisions passées et leurs conséquences, dans la limite des 100 dernières. La carte montre les cinq régions prédéfinies, celles visitées et la région actuelle choisie par le narrateur. Elle sert au repérage ; ses marqueurs ne sont pas des commandes de déplacement.

Le bouton de son active une ambiance calculée dans le navigateur avec Web Audio. Il ne s’agit pas d’une piste enregistrée. L’aide rappelle les commandes. Le bouton « Narrateur Codex » expose la mémoire cumulative ainsi que le modèle et la durée annoncés pour la dernière génération.

## Sauvegarde et erreurs

La progression reste dans le stockage du navigateur, pour cette adresse et ce port. Elle n’est ni envoyée dans une base de données de jeu, ni partagée entre appareils. Si le stockage est indisponible, la partie peut continuer en mémoire pour la session, mais le rechargement risque de la perdre.

Pendant une génération, les commandes modifiant la partie sont bloquées. Une erreur conserve la dernière partie valide et la demande en attente. « Réessayer » renvoie la même décision. Une reprise sur le même serveur peut retrouver son résultat en cache ; après redémarrage du serveur, une nouvelle génération peut être nécessaire. L’interface permet aussi de demander une nouvelle aventure avec confirmation du remplacement de la précédente.

Chaque nouvelle scène fait appel au compte Codex connecté. Le jeu ne cache pas une panne derrière un texte préécrit. Les tests automatiques utilisent des réponses fictives pour vérifier les règles ; ces réponses ne sont pas utilisées dans une partie normale.

## Limites connues

La mémoire cumulative est elle-même produite par le modèle. Les contrôles refusent un JSON invalide, des choix hors bornes, une quête remplacée en cours de route ou une conclusion contraire à la progression. Ils ne peuvent pas vérifier automatiquement toutes les promesses, tous les lieux et toutes les contradictions d’une histoire longue.

Le prototype n’inclut pas de saisie d’action libre, de création de personnage, de déplacement manuel sur la carte, de synchronisation de sauvegarde, de multijoueur ou de mode narratif hors ligne. Ces limites ne constituent pas des fonctionnalités annoncées pour une prochaine version ; voir [le reste à faire](roadmap.md) pour les travaux identifiés et les suggestions séparées.
