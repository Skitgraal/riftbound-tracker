# Registre des sources

Les sources sont déclarées dans `config/sources.yml`. Ajouter une source d'un type déjà géré ne demande aucun code : seulement une entrée dans ce fichier.

## Niveaux de fiabilité

| Niveau | Effet sur la fiche | Exemples |
|---|---|---|
| `official` | fiabilité « confirmé », l'emporte sur tout | site Riftbound, boutique Riot |
| `relay` | complète la fiche (prix, précommande, image), ne confirme pas seul | distributeur, retailers |
| `leak` | crée une fiche « non confirmé », statut « rumeur » | Reddit, Discord communautaires |

## Types de collecteurs

| Type | Méthode | LLM | Points d'attention |
|---|---|---|---|
| `html` | téléchargement de la page, extraction du texte principal et des images | oui | préférer le flux de données embarqué dans la page s'il existe |
| `rss` | lecture du flux | oui | le plus robuste quand il existe |
| `shopify` | endpoint JSON public des boutiques Shopify | non | donne prix, stock et images directement |
| ~~`reddit`~~ | abandonné au jalon 4 : `robots.txt` interdit tout et l'API est fermée aux nouvelles applications (D15) | — | — |
| `discord` | bot gratuit dans **ton propre serveur**, qui lit par l'API les salons où tu as « suivi » les salons d'annonces des serveurs communautaires | oui | lire un serveur tiers avec un compte utilisateur est interdit par Discord |

Tous fonctionnent par simple requête HTTP depuis GitHub Actions : aucun programme ne doit rester allumé en permanence.

## Sources candidates

Liste de départ. **Chaque URL et chaque méthode d'accès est à valider au jalon correspondant** : rien n'a encore été testé ici, sauf Cardmarket. Un site peut bloquer les serveurs de GitHub ; dans ce cas la source est remplacée, pas contournée.

### Officiel — en service depuis le jalon 3 (vérifié le 23/11/2026)
| Id | Source | Type | Apporte |
|---|---|---|---|
| `riot-news` | `https://playriftbound.com/en-us/news/` (l'ancien domaine riftbound.leagueoflegends.com y redirige) | `riot-news` : JSON `__NEXT_DATA__` de la page de liste, puis corps de l'article (blocs `articleRichText*`) | annonces de sets et de produits, tirages, prix ; extraction par LLM |
| `riot-merch` | `https://merch.riotgames.com/en-us/category/riftbound/` | `riot-merch` : liste `initialProducts` du flux React de la page | nom, prix, disponibilité, précommande, photos ; sans LLM |

Constats :
- `robots.txt` : tout est autorisé sur les deux sites.
- Le site Riftbound n'a pas de flux RSS, et n'a pas de pages produits : les produits sont annoncés dans les articles. La source `riot-riftbound-products` envisagée est donc abandonnée.
- La boutique Riot n'est pas une boutique Shopify (`/products.json` répond 500) : elle est lue par sa page de catégorie. Elle ne liste que les produits en vente ou récemment épuisés ; les accessoires (sleeves, playmats…) sont ignorés.
- Les articles récents (moins de 21 jours) sont relus à chaque passage, car Riot les complète souvent (dates de tirage). Le carrousel « articles liés » est exclu du texte : il change à chaque chargement.
- Catégorie `organized_play` ignorée (tournois).

### Relais — en service depuis le jalon 4 (vérifié le 24/11/2026 depuis GitHub Actions)
| Id | Boutique | Collections lues | Devise |
|---|---|---|---|
| `universe-tcg` | universetcg.com (Espagne) | `riftbound` | EUR |
| `cardcosmos` | cardcosmos.de (Allemagne) | `riftbound-league-of-legends-trading-card-game`, `riftbound-release-2026`, `riftbound-legacy-kaufen`, `riftbound-set-7-the-reckoning` | EUR |
| `stomping-grounds` | stompinggroundstcg.com (États-Unis) | `riftbound` | USD |
| `face-to-face` | facetofacegames.com (Canada) | `riftbound-sealed` | CAD |

Type `shopify` : `/collections/{handle}/products.json`, pages de 250. Apporte nom, prix, stock, précommande (étiquettes ou titre), photos ; sans LLM. Seul le scellé anglais est gardé : autres langues (titre ou variante), lots (« case »), kits de boutique, accessoires et singles sont écartés.

Constats :
- `robots.txt` : `products.json` autorisé sur les quatre (seuls `sort_by`, `+` et les recommandations sont interdits).
- Depuis une connexion personnelle, Shopify répond souvent 429 (limite par IP) ; depuis GitHub Actions, tout répond 200. Tester une source avec le workflow `probe`.
- Écartées : Wayland Games et La Cité des Nuages (défi anti-robots Cloudflare, 403), Boardtopia (catalogue Riftbound à l'abandon), Poke-Collect (pas de collection Riftbound scellé).
- Pour ajouter une boutique Shopify : trouver la collection avec `/search/suggest.json?q=riftbound&resources[type]=collection`, la tester avec `probe`, puis l'ajouter à `config/sources.yml`.

Pistes non retenues pour l'instant : `cardmarket-catalog` (nouveau produit scellé au catalogue Cardmarket = sortie imminente), distributeur anglais (UVS Games).

### Leaks
| Id | Source | Type envisagé | Apporte |
|---|---|---|---|
| `discord-relay` | salons d'annonces suivis dans ton serveur (jalon 6) | `discord` | leaks précoces |

Reddit abandonné : `robots.txt` en `Disallow: /` et API fermée aux nouvelles applications (D15).

### Hors périmètre
- **X / Twitter** : API payante et scraping bloqué. Compensé par les notifications du téléphone pour 2 ou 3 comptes clés, et par Reddit.
- **Newsletter Riot** : demanderait une boîte mail dédiée lue par script. Abandonnée : son contenu est repris par le site officiel.

## Cardmarket (Module 2) — vérifié le 14/11/2026

Riftbound est présent sous `idGame` **22**.

| Fichier | URL |
|---|---|
| Catalogue cartes | `https://downloads.s3.cardmarket.com/productCatalog/productList/products_singles_22.json` |
| Catalogue scellé | `https://downloads.s3.cardmarket.com/productCatalog/productList/products_nonsingles_22.json` |
| Guide de prix | `https://downloads.s3.cardmarket.com/productCatalog/priceGuide/price_guide_22.json` |

Détail dans [ARCHITECTURE.md](ARCHITECTURE.md), section 6.

## Règles de collecte

- Respect du `robots.txt` et des conditions d'utilisation de chaque site.
- User-Agent identifiable, une requête à la fois par domaine.
- Requêtes conditionnelles pour ne pas retélécharger ce qui n'a pas changé.

## À fournir avant le jalon concerné

| Élément | Jalon |
|---|---|
| Serveur Discord personnel et deux webhooks | 1 |
| Liste des retailers et des subreddits à suivre | 4 |
| Application Reddit (identifiant et secret) | 4 |
| Bot Discord et liste des serveurs à suivre | 6 |
