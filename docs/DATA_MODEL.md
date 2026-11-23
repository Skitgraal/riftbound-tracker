# Modèle de données

Pas de base de données : tout est en fichiers dans le dépôt. Les dates-heures sont en ISO 8601 UTC, affichées en heure de Paris par le dashboard.

Deux familles de fichiers :
- `data/` : la vérité, écrite par les scripts et committée.
- fichiers dérivés : générés à chaque publication pour le dashboard, **non committés**.

## Vue d'ensemble de `data/`

```
data/
├─ products/                 une fiche par produit (Module 1)
│  └─ spiritforged-booster-box.json
├─ media/                    images réduites des produits
├─ seen.json                 empreintes des documents déjà vus
├─ pending.json              documents en attente d'extraction (mode dégradé)
├─ alerts.json               alertes déjà envoyées
├─ status.json               état de chaque source et de chaque workflow
└─ prices/
   ├─ catalog.json           catalogue Cardmarket (cartes + scellé)
   ├─ expansions.json        idExpansion → nom
   ├─ meta.json              dernier fichier intégré
   └─ history/
      ├─ 2026-11.csv         un fichier par mois
      └─ 2026-12.csv
```

## Module 1 — veille

### Fiche produit — `data/products/{slug}.json`

Le `slug` est la clé normalisée (set + type + variante) ; c'est elle qui sert au rapprochement.

| Champ | Type | Note |
|---|---|---|
| `slug` | texte | identifiant stable |
| `name`, `set` | texte | |
| `type` | texte | `display`, `booster`, `box_exclusive`, `deck`, `bundle`, `draw_product`, `other` |
| `language` | texte | `EN` |
| `msrp` | `{ amount, currency }` | prix officiel |
| `announcedAt` | date | |
| `releaseDate` | `{ value, precision }` | précision : `day`, `month`, `quarter`, `unknown` |
| `status` | texte | `rumor`, `announced`, `preorder`, `released`, `cancelled` |
| `reliability` | texte | `unconfirmed`, `confirmed` |
| `image` | texte ou vide | chemin dans `data/media/` ; vide = « image à venir » |
| `officialUrl` | texte | lien direct |
| `cmProductId` | nombre ou vide | rapprochement avec Cardmarket |
| `possibleDuplicateOf` | texte ou vide | rapprochement incertain |
| `draws` | liste | `{ opensAt, closesAt, url, region }` |
| `offers` | liste | `{ source, url, price, availability, lastSeenAt }` |
| `claims` | liste | voir ci-dessous |
| `createdAt`, `updatedAt` | date-heure | |

Les champs du haut sont **recalculés** à partir de `claims` à chaque passage ; on ne les modifie pas à la main.

### Affirmation — élément de `claims`

| Champ | Note |
|---|---|
| `field` | `name`, `releaseDate`, `msrp`, `image`, `status`… |
| `value` | la valeur vue |
| `source` | identifiant de la source |
| `tier` | `official`, `relay`, `leak` |
| `url` | document d'origine |
| `evidence` | citation du texte |
| `observedAt` | date-heure |
| `invalid` | `true` pour écarter une extraction fautive (seule correction manuelle possible, et rarement utile) |

Règle de résolution d'un champ : parmi les affirmations valides, le niveau le plus fiable, puis la plus récente.

### `seen.json`
URL → `{ hash, firstSeenAt, lastSeenAt }`. Sert à ne traiter que le neuf. Les entrées de plus de 12 mois sont purgées.

### `pending.json`
Documents qui ont passé le tri mais dont l'extraction a échoué : `{ url, source, title, attempts, firstSeenAt }`. Retentés à chaque passage, abandonnés après 10 essais (l'alerte « à lire » a déjà été envoyée).

### `alerts.json`
Liste des clés d'alertes déjà envoyées, avec la date. Empêche les doublons, y compris pour les rappels de tirage. Purge après 6 mois.

### `status.json`
Par source : `lastSuccessAt`, `consecutiveFailures`, `lastError`, `documentsNew`. Par workflow : date du dernier passage réussi. Alimente la vue État.

## Module 2 — prix

### `prices/catalog.json`
Une entrée par produit Cardmarket.

| Champ | Note |
|---|---|
| `id` | `idProduct` |
| `name` | |
| `kind` | `single` ou `sealed` |
| `category` | nom de catégorie Cardmarket |
| `expansionId` | |
| `languageTag` | `ZH` si le nom l'indique, sinon vide |
| `dateAdded` | |
| `firstSeenAt` | première apparition dans les fichiers |
| `removedAt` | absent tant que le produit figure dans les fichiers ; un produit retiré reste au catalogue avec cette date |

### `prices/history/AAAA-MM.csv`
Une ligne par produit et par jour, ajoutée en fin de fichier.

```
date,id,avg,low,trend,avg1,avg7,avg30,avg_foil,low_foil,trend_foil,avg1_foil,avg7_foil,avg30_foil
2026-11-13,845721,183.85,64.97,178.6,,,,,,0,,,
```

La date est celle du `createdAt` du fichier Cardmarket. Volume : environ 2 000 lignes par jour, soit 2 à 3 Mo par mois. Le dépôt grossit d'environ 30 Mo par an, bien en dessous des limites de GitHub.

### `prices/meta.json`
`createdAt` du dernier guide de prix et du dernier catalogue intégrés. C'est ce qui rend l'ingestion idempotente.

### `prices/expansions.json`
`idExpansion` → nom déduit ; `Extension #id` tant qu'il n'a pas pu être déduit.

## Configuration (modifiable à la main)

| Fichier | Contenu |
|---|---|
| `config/sources.yml` | par source : `id`, `name`, `kind`, `tier`, `url`, `enabled`, options du collecteur |
| `config/watchlist.yml` | liste d'`idProduct` de cartes à suivre, seuils particuliers éventuels |
| `config/settings.yml` | seuils de variation, prix plancher, mots-clés du tri |

## Fichiers dérivés pour le dashboard

Générés par `collector/build-data` à chaque publication, pour que le navigateur ne charge que de petits fichiers.

| Fichier | Contenu |
|---|---|
| `products.json` | toutes les fiches sans leurs affirmations, pour la grille et la frise |
| `products/{slug}.json` | fiche complète |
| `draws.json` | tirages ouverts et à venir |
| `prices/index.json` | catalogue allégé avec dernier prix et variations 1 j / 7 j / 30 j, pour la recherche |
| `prices/{id}.json` | historique complet d'un produit, pour la courbe |
| `watchlist.json` | produits suivis avec variations |
| `status.json` | état des sources |
