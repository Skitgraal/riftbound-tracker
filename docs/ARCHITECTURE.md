# Architecture — Riftbound Tracker

Version « gratuit et simple ». Les choix sont justifiés dans [DECISIONS.md](DECISIONS.md), les formats de données dans [DATA_MODEL.md](DATA_MODEL.md), les sources dans [SOURCES.md](SOURCES.md), l'ordre de construction dans [ROADMAP.md](ROADMAP.md).

## 1. Principe

Aucun serveur, aucune base de données, aucun abonnement. Tout repose sur un dépôt GitHub public :

- **GitHub Actions** exécute les scripts de collecte à heures fixes, même PC éteint.
- **Le dépôt lui-même** sert de stockage : les données sont des fichiers committés par les scripts.
- **GitHub Pages** héberge le dashboard, un site statique qui lit ces fichiers.
- **Un webhook Discord** envoie les alertes sur le téléphone.

```
 Sources externes            GitHub (gratuit)                                   Toi
 ────────────────            ─────────────────────────────────────────          ───────────────
 Site Riot / Riftbound ──┐
 Boutique Riot ──────────┤   ┌─ Actions (planifié) ────────────────────┐
 Reddit ─────────────────┼──▶│ scripts de collecte ─▶ tri ─▶ extraction │──────▶ Discord (alertes)
 Retailers ──────────────┤   │        │                  (LLM gratuit)  │
 Discord (relais) ───────┘   │        ▼                                 │
                             │  data/ (fichiers committés dans le dépôt)│
 Fichiers Cardmarket ───────▶│        │                                 │
                             │        ▼                                 │
                             │  construction du site ─▶ GitHub Pages ───┼──────▶ dashboard (navigateur, téléphone)
                             └──────────────────────────────────────────┘
```

Coût : 0 €. Comptes nécessaires : GitHub et Discord.

## 2. Stack

| Couche | Choix | Pourquoi |
|---|---|---|
| Exécution planifiée | GitHub Actions | gratuit et illimité sur un dépôt public |
| Scripts de collecte | TypeScript sur Node 22 | un seul langage pour la collecte et le front ; Node est déjà installé |
| Stockage | fichiers JSON et CSV dans le dépôt | pas de base à héberger ; l'historique Git sert d'audit |
| Extraction | règles d'abord, LLM gratuit en complément (GitHub Models) | voir §5 |
| Dashboard | Vue 3, Vite, TypeScript, Tailwind CSS, Apache ECharts | site statique |
| Hébergement | GitHub Pages | gratuit, HTTPS inclus |
| Alertes | webhooks Discord | gratuit, notification push sur téléphone |
| Tests | Vitest, avec des pages et des JSON réels enregistrés | |

Abandonnés par rapport à la première version : Java / Spring Boot, PostgreSQL, Docker, VPS, nom de domaine, API Claude payante.

## 3. Arborescence du dépôt

```
riftbound-tracker/
├─ collector/            scripts TypeScript
│  ├─ prices/            ingestion Cardmarket
│  ├─ watch/             veille : collecteurs, tri, extraction, fusion
│  ├─ alerts/            envoi Discord
│  └─ build-data/        prépare les fichiers lus par le site
├─ site/                 dashboard Vue 3
├─ config/
│  ├─ sources.yml        sources suivies
│  ├─ watchlist.yml      cartes suivies en plus du scellé
│  └─ settings.yml       seuils d'alerte
├─ prompts/              prompts d'extraction versionnés
├─ data/                 écrit uniquement par les scripts
├─ .github/workflows/    planification
├─ docs/
└─ CLAUDE.md
```

## 4. Module 1 — veille des sorties

Un passage **toutes les 2 heures**, en permanence. C'est gratuit, donc autant garder le rythme « période chaude » tout le temps : plus besoin de mode chaud ni de créneaux horaires.

Étapes d'un passage, source par source (une source en panne ne bloque pas les autres) :

1. **Collecte.** Un collecteur par type de source (`html`, `rss`, `shopify`, `reddit`, `discord`), configuré dans `config/sources.yml`.
2. **Nouveauté.** Empreinte du contenu par URL, comparée à `data/seen.json`. Ce qui est déjà vu et inchangé s'arrête là.
3. **Tri par mots-clés.** Seuls les documents qui parlent de produits (booster, display, box, bundle, preorder, raffle, release, noms de sets connus…) continuent. Liste réglable.
4. **Extraction.**
   - Sources structurées (boutiques Shopify, catalogue Cardmarket) : lecture directe des champs, sans LLM.
   - Texte libre (articles, posts Reddit, messages Discord) : un appel LLM avec sortie JSON contrainte, qui renvoie les produits, leurs champs et une citation comme preuve.
5. **Rapprochement.** Clé normalisée (set + type + variante), puis similarité de nom. Un match incertain crée une nouvelle fiche marquée « doublon possible », signalée dans l'alerte.
6. **Fusion.** Chaque valeur est ajoutée à la fiche comme une *affirmation* datée et sourcée. Les champs affichés sont recalculés : **officiel > relais > leak**, et à niveau égal la plus récente l'emporte.
7. **Statut.** La fiabilité passe à « confirmé » dès qu'une source officielle mentionne le produit. Le statut suit `rumeur → annoncé → précommande → sorti` ; le passage à « sorti » se fait seul quand la date est atteinte.
8. **Alertes, commit, publication.** Les changements partent sur Discord, les fichiers sont committés, le site est reconstruit.

**Mode dégradé — rien n'est jamais perdu.** Si le LLM est indisponible, hors quota, ou renvoie une sortie invalide, le document est quand même signalé sur Discord en « à lire » avec son titre et son lien, puis retenté au passage suivant. Tu ne rates donc pas une annonce parce qu'un service gratuit a flanché ; au pire tu lis le lien toi-même.

**Images.** L'image retenue suit la même règle de priorité, est réduite et copiée dans `data/media/`. Sans visuel : « image à venir », remplacée dès qu'une source en fournit un.

**Dates.** Chaque date porte une précision (`jour`, `mois`, `trimestre`, `inconnue`), car les leaks donnent rarement un jour exact.

**Tirages.** Rattachés à une fiche : ouverture, fermeture, lien. Un workflow léger tourne toutes les 30 minutes et envoie les rappels à l'ouverture, 24 h avant et 2 h avant la fermeture.

## 5. Le LLM, gratuit et optionnel

| Point | Choix |
|---|---|
| Fournisseur | **GitHub Models**, appelé depuis Actions avec le jeton fourni automatiquement : pas de compte ni de clé en plus |
| Modèle | choisi au jalon 3 parmi le catalogue gratuit, sur un jeu d'essai de documents réels |
| Volume | faible : seuls les documents nouveaux, en texte libre, et passés par le tri par mots-clés |
| Si le quota gratuit est atteint | mode dégradé (alerte « à lire »), reprise au passage suivant |
| Solution de repli | l'offre gratuite de l'API Gemini ; le fournisseur est isolé derrière une interface |

Les quotas et conditions des offres gratuites changent : ils sont à vérifier au jalon 3. L'architecture ne dépend pas du LLM pour fonctionner, seulement pour remplir les fiches automatiquement.

## 6. Module 2 — tracker de prix

Vérifié le 14/11/2026 sur les fichiers publics Cardmarket (Riftbound = `idGame` 22) :

| Fichier | Contenu observé |
|---|---|
| `products_singles_22.json` | 1 879 cartes |
| `products_nonsingles_22.json` | 122 produits scellés : Display, Booster, Champion Decks, Box Sets, Set |
| `price_guide_22.json` | 2 001 lignes : `avg`, `low`, `trend`, `avg1`, `avg7`, `avg30` et les mêmes en `-foil` |

Constats :
- **Scellé** : `avg`, `low`, `trend` renseignés ; `avg1/7/30` vides.
- **Pas de nom d'extension** dans les fichiers : il est déduit des produits « *X* Booster Box ».
- **Pas d'image** : pour le scellé, on réutilise l'image de la fiche du Module 1 ; pour les cartes, pas d'image en v1, le lien Cardmarket suffit.
- **Versions chinoises** : produits distincts, repérables au nom, masqués par défaut. Le reste est toutes langues confondues.
- **Heure de publication irrégulière** : le 14/11, le guide de prix datait encore de la veille.

Fonctionnement :
1. **Ingestion 3 fois par jour.** Si le `createdAt` du fichier est déjà connu, le script s'arrête sans rien écrire.
2. **Historique** : une ligne par produit et par jour, ajoutée à un fichier CSV mensuel.
3. **Nouveau produit scellé au catalogue** : alerte, et signal transmis à la veille.
4. **Watchlist** : tout le scellé anglais d'office ; les cartes s'ajoutent dans `config/watchlist.yml` (modifiable depuis le site GitHub, y compris sur téléphone).
5. **Alerte de variation** : tendance à ±10 % sur 1 jour ou ±20 % sur 7 jours, avec un prix plancher pour ignorer les cartes à quelques centimes. Seuils dans `config/settings.yml`.
6. **Lien Cardmarket** construit depuis `idProduct`, filtré sur l'anglais. Format à valider au jalon 2.

> **L'historique ne se rattrape pas** : chaque jour sans ingestion est perdu. L'ingestion des prix est donc le premier jalon.

## 7. Planification (GitHub Actions)

| Workflow | Fréquence | Rôle |
|---|---|---|
| `prices` | 3 fois par jour | ingestion Cardmarket, alertes de variation |
| `watch` | toutes les 2 h | veille des sorties |
| `reminders` | toutes les 30 min | rappels de tirages ; se termine en quelques secondes s'il n'y a rien |
| `ci` | à chaque modification du code | tests |

Chaque workflow qui modifie `data/` reconstruit et publie le site dans la foulée. Un verrou de concurrence empêche deux workflows d'écrire en même temps.

## 8. Alertes

Deux webhooks Discord, pour régler les notifications du téléphone par salon.

| Salon | Événements |
|---|---|
| Critique | tirage ouvert, tirage qui ferme dans 24 h / 2 h, précommande ouverte |
| Fil | nouveau produit, leak confirmé, date ou prix modifié, « à lire », variation de prix, source en panne |

Les alertes déjà envoyées sont notées dans `data/alerts.json` pour ne jamais envoyer deux fois la même.

## 9. Dashboard

Site statique, lecture seule.

| Vue | Contenu |
|---|---|
| Sorties | frise chronologique et grille de fiches, filtres par statut, type, set, fiabilité |
| Fiche produit | image, champs, prix du marché, sources, historique des affirmations |
| Tirages | ouverts et à venir, compte à rebours |
| Prix | recherche instantanée, fiche avec courbe |
| Watchlist | produits suivis et variations ; favoris personnels mémorisés dans le navigateur |
| État | date de dernière mise à jour de chaque source, en rouge si trop ancienne |

## 10. Fiabilité

- **Panne d'un workflow** : GitHub envoie un mail automatiquement.
- **Source en panne** : après 3 échecs consécutifs, alerte Discord.
- **Panne silencieuse** : la vue État affiche l'âge de chaque donnée ; un bandeau rouge apparaît si les prix ont plus de 36 h.
- **Sauvegarde** : le dépôt Git est la sauvegarde, avec tout l'historique.

## 11. Sécurité et règles de collecte

- Les secrets (webhooks, identifiants Reddit et Discord) sont dans les secrets GitHub Actions, jamais dans le dépôt.
- `robots.txt` respecté, User-Agent identifiable, une requête à la fois par domaine.
- Aucun scraping de Cardmarket : uniquement les fichiers publics.
- Le texte collecté est traité comme une donnée non fiable, et la sortie du LLM est contrainte par un schéma.

## 12. Limites assumées

| Limite | Conséquence |
|---|---|
| Dépôt et dashboard publics | n'importe qui avec l'adresse peut voir le dashboard ; il ne contient que des infos publiques |
| Horaires GitHub Actions approximatifs | un passage peut démarrer avec 5 à 30 minutes de retard ; les rappels de tirage sont précis à une demi-heure près |
| Offres gratuites de LLM variables | couvert par le mode dégradé |
| Pas de X / Twitter | compensé par les notifications du téléphone et Reddit |
| Prix : 1 mise à jour par jour, pas de détail par langue | limite de la source Cardmarket |
| Cartes ajoutées à la watchlist à la main | via un fichier, pas un bouton ; le scellé est automatique |
| Planifications suspendues par GitHub après 60 jours sans activité sur le dépôt | les commits quotidiens de données devraient l'éviter ; à surveiller, la vue État le rendrait visible |
