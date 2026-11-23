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
| `reddit` | API officielle, application gratuite de type « script » | oui | les accès anonymes sont souvent bloqués depuis les serveurs de GitHub ; Reddit a durci la création d'accès à son API, à vérifier au jalon 4. Si l'accès est refusé, Reddit est retiré et compensé par les autres sources |
| `discord` | bot gratuit dans **ton propre serveur**, qui lit par l'API les salons où tu as « suivi » les salons d'annonces des serveurs communautaires | oui | lire un serveur tiers avec un compte utilisateur est interdit par Discord |

Tous fonctionnent par simple requête HTTP depuis GitHub Actions : aucun programme ne doit rester allumé en permanence.

## Sources candidates

Liste de départ. **Chaque URL et chaque méthode d'accès est à valider au jalon correspondant** : rien n'a encore été testé ici, sauf Cardmarket. Un site peut bloquer les serveurs de GitHub ; dans ce cas la source est remplacée, pas contournée.

### Officiel
| Id | Source | Type envisagé | Apporte |
|---|---|---|---|
| `riot-riftbound-news` | actualités du site Riftbound | `html` ou `rss` | annonces de sets et de produits |
| `riot-riftbound-products` | pages produits du site Riftbound | `html` | fiche, image, date |
| `riot-merch` | boutique Riot | `html` ou `shopify` | box exclusives, tirages, prix |

### Relais
| Id | Source | Type envisagé | Apporte |
|---|---|---|---|
| `distributor-en` | distributeur de la version anglaise | `html` | dates et gammes |
| `retailer-*` | 3 à 5 boutiques vendant le scellé anglais, de préférence sous Shopify | `shopify` ou `html` | précommandes, prix, images |
| `cardmarket-catalog` | nouveaux produits au catalogue Cardmarket | interne (Module 2) | signal de sortie imminente |

### Leaks
| Id | Source | Type envisagé | Apporte |
|---|---|---|---|
| `reddit-riftbound` | subreddit principal Riftbound | `reddit` | leaks, relais rapides des annonces |
| `discord-relay` | salons d'annonces suivis dans ton serveur | `discord` | leaks précoces |

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
