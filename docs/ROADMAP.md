# Plan de build

Sept jalons. Chacun se termine par quelque chose qui tourne et qui se vérifie.

## Avant de commencer

Checklist détaillée et expliquée : [SETUP.md](SETUP.md). Presque tout est pris en charge par l'IA au jalon 0. Il te reste environ dix minutes d'actions, parce qu'elles passent par tes comptes personnels.

| Tâche | Qui | Détail |
|---|---|---|
| Sortir le projet de OneDrive | IA | le projet est créé directement dans `C:\dev\riftbound-tracker`, les docs y sont copiées ; tu rouvres VS Code dans ce dossier |
| Installer l'outil GitHub en ligne de commande (`gh`) | IA | absent du poste, et `winget` aussi : version portable, sans droits administrateur |
| Se connecter à GitHub | **toi**, 1 min | `gh auth login` ouvre le navigateur, tu valides. Créer un compte avant si tu n'en as pas |
| Créer le dépôt public, activer Pages, pousser le code | IA | via `gh`, une fois connecté |
| Créer le serveur Discord, deux salons, un webhook par salon | **toi**, 5 min | guide pas à pas fourni au jalon 1 ; l'IA n'a pas accès à ton compte Discord |
| Enregistrer les deux adresses de webhook dans les secrets GitHub | **toi**, 1 min | une commande fournie, où tu colles l'adresse ; elle ne doit pas transiter par la conversation |
| Liste des retailers et des subreddits | IA | recherche web au jalon 4, test de chaque source, proposition que tu valides ou ajustes |
| Application Reddit (jalon 4) et bot Discord (jalon 6) | **toi**, 5 min chacun | création sur ton compte, guide fourni |

Déjà en place sur le poste : Node 22 et Git. Rien à payer.

## Jalon 0 — Socle
- Dépôt, arborescence, projet `collector` et projet `site` vides.
- Workflow de tests.
- Publication d'une page vide sur GitHub Pages.

**Fini quand** : la page s'affiche à l'adresse GitHub Pages et les tests passent.

## Jalon 1 — Ingestion des prix
*Prioritaire : chaque jour sans ingestion est un jour d'historique perdu.*
- Téléchargement des trois fichiers Cardmarket, idempotence, catalogue, CSV mensuel.
- Workflow `prices` trois fois par jour.
- Envoi Discord minimal, alerte en cas d'échec.

**Fini quand** : une nouvelle journée de prix est committée seule pendant 3 jours de suite.

## Jalon 2 — Dashboard des prix
- Génération des fichiers dérivés.
- Vues Prix, Watchlist et État ; recherche ; courbes.
- Watchlist automatique du scellé anglais, alertes de variation.
- Lien Cardmarket filtré sur l'anglais (format à valider ici).

**Fini quand** : on cherche un produit sur le site, on voit sa courbe, et une variation au-delà du seuil arrive sur Discord.

## Jalon 3 — Veille officielle
- Registre des sources, collecteurs `html` et `rss`, détection de nouveauté, tri par mots-clés.
- Extraction LLM via l'API Gemini gratuite (GitHub Models a été retiré, voir D13) : vérification sur les articles réels.
- Mode dégradé « à lire ».
- Fiches, affirmations, statut et fiabilité, images.
- Vues Sorties et Fiche produit. Workflow `watch` toutes les 2 h.

**Fini quand** : les produits actuellement annoncés par Riot apparaissent seuls avec image, date et lien, et couper le LLM produit bien une alerte « à lire ».

## Jalon 4 — Sources relais et fusion
- Collecteurs `shopify` et `reddit`.
- Rapprochement des fiches, offres retailers, lien fiche ↔ produit Cardmarket.

**Fini quand** : un produit vu par trois sources donne une seule fiche, et un leak repris par Riot passe à « confirmé » sans intervention.

## Jalon 5 — Tirages
- Extraction des fenêtres de tirage, workflow `reminders`, vue Tirages.

**Fini quand** : un tirage de test déclenche les rappels d'ouverture, de 24 h et de 2 h.

## Jalon 6 — Finitions
- Collecteur `discord`.
- Purges, bandeau de données périmées, réglage des seuils et des mots-clés à l'usage.

**Fini quand** : l'outil tourne deux semaines sans intervention.

## Tests

| Niveau | Cible |
|---|---|
| Unitaire | règles de fusion, statuts, calcul des variations, clés d'alertes |
| Fixtures | chaque collecteur testé sur des pages et des JSON réels enregistrés dans le dépôt |
| LLM | jeu d'essai annoté, rejoué à la main à chaque changement de prompt ou de modèle |

Les tests automatiques n'appellent ni site externe ni LLM.
