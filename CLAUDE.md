# Riftbound Tracker — contexte du projet

## Objectif
Outil perso centralisé pour suivre la collection Riftbound **anglais** (produits scellés : displays, boosters, box exclusives, produits à tirage Riot…) et ne rater aucune sortie.
Tout doit être automatique : quand l'outil tourne, il collecte, trie et met à jour seul. Aucun ajout manuel.

## Module 1 — Veille des sorties

### Sources (classées par fiabilité)
- **Officiel** → statut "confirmé" : site Riftbound / Riot (news, pages produits, tirages), newsletter Riot.
- **Relais** : distributeurs, retailers (précommandes, prix), subreddit Riftbound, Discord communautaires.
- **Leaks** → statut "non confirmé", passe en "confirmé" quand Riot officialise.
- **X/Twitter : exclu** (API payante, scraping bloqué). Compensé par les notifs X sur téléphone pour 2-3 comptes clés (officiel + meilleur leaker) et par Reddit, qui relaie vite.

### Fiche produit
- nom, set, type (display, booster, box exclusive…), langue (EN)
- prix, date d'annonce, date de sortie
- tirage : dates d'ouverture / fermeture
- **image** (page officielle Riot ou retailer ; "image à venir" si leak sans visuel, mise à jour ensuite)
- lien direct, source(s), niveau de fiabilité
- statut : rumeur → annoncé → précommande → sorti

### Pipeline
collecte → extraction en données structurées (LLM) → dédoublonnage/fusion (même produit vu par plusieurs sources = une fiche) → stockage → dashboard + **alertes** (critique pour les tirages à fenêtre courte).

### Fréquence
3 passages par jour : ~8 h, 13 h, **19 h** (le plus important : Riot est à Los Angeles, les annonces tombent en soirée heure FR).
En période chaude (révélation d'un set, tirage ouvert) : passage toutes les 2 h temporairement.
**Décision finale** : passage toutes les 2 h en permanence (gratuit sur GitHub Actions), donc plus de créneaux fixes ni de mode chaud.

## Module 2 — Tracker de prix (Cardmarket)
- Source : **price guide + product catalog officiels de Cardmarket**, téléchargeables publiquement, mis à jour une fois par jour, incluant les non-singles (boosters, displays). **Pas de scraping** (interdit par leurs CGU + protection anti-bot).
- À vérifier au démarrage : présence de Riftbound dans les fichiers.
- Fonctions :
  - recherche (carte ou produit) → image, prix tendance, prix le plus bas, moyennes 1/7/30 j
  - **historique** construit en stockant chaque fichier quotidien → courbes
  - watchlist + alerte sur grosse variation
  - lien direct vers la fiche Cardmarket (pour filtrer par langue anglaise)
- Limites connues :
  - 1 mise à jour par jour, pas de temps réel
  - scellé : pas de moyennes de vente, seulement tendance + offre la plus basse
  - pas de détail par langue/état (le prix EN exact demande l'API officielle, réservée aux pros/powersellers)

## Contrainte directrice
**Gratuit et simple**, tout en restant de qualité. Si le 100 % automatique est impossible sur un point, une solution pratique suffit.

## Stack retenue (0 €, sans serveur)
- Exécution : GitHub Actions (dépôt public), scripts de collecte en TypeScript / Node
- Stockage : fichiers JSON et CSV committés dans le dépôt (pas de base de données)
- Extraction : règles et mots-clés d'abord, LLM gratuit (GitHub Models) pour le texte libre, alerte « à lire » si le LLM échoue
- Front : Vue 3, site statique sur GitHub Pages (dashboard des sorties + tracker de prix)
- Alertes : webhooks Discord
- Abandonné : Java / Spring Boot, PostgreSQL, VPS, API LLM payante

## Documentation d'architecture
L'architecture détaillée est dans `docs/` et fait référence pour le build. En cas de divergence avec ce fichier, `docs/` l'emporte.
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — vue d'ensemble, pipelines, planification, limites
- [docs/DATA_MODEL.md](docs/DATA_MODEL.md) — format des fichiers de données
- [docs/SOURCES.md](docs/SOURCES.md) — registre des sources
- [docs/DECISIONS.md](docs/DECISIONS.md) — choix et raisons
- [docs/ROADMAP.md](docs/ROADMAP.md) — jalons et critères de fin
- [docs/DESIGN.md](docs/DESIGN.md) — direction visuelle, couleurs, composants ; maquettes sources dans `docs/design/`
- [docs/SETUP.md](docs/SETUP.md) — actions à faire par l'utilisateur
- Maquettes : canvas https://claude.ai/artifact/PEAM7n55rPqePJcbzdqNtu

Vérifié le 14/11/2026 : Riftbound est présent dans les fichiers Cardmarket (`idGame` 22).

## Préférences de travail
- Explications en français
- Code livré en un seul bloc
- J'exécute le code moi-même, puis on interprète les résultats ensemble

## Questions ouvertes
- ~~Canal d'alertes~~ : tranché, webhooks Discord
- Liste précise des comptes / subreddits / Discord / retailers à suivre
