# Design

Référence visuelle du dashboard. Les maquettes sont dans le canvas « Riftbound Tracker — Design » et leurs sources dans [design/](design/) : le build doit les reproduire.

## Intention

Un outil de collectionneur, pas un site marchand : sombre, calme, dense en information mais aéré. Une seule couleur vive par signification. Ce qui demande une action (un tirage ouvert, une précommande) est la seule chose qui ressort à l'écran.

## Couleurs

Thème sombre unique. Les contrastes de texte respectent 4,5:1 minimum.

| Jeton | Valeur | Usage |
|---|---|---|
| `bg` | `#0B0D12` | fond de page |
| `surface` | `#12151C` | cartes, panneaux |
| `surface-2` | `#181C25` | survol, élément actif |
| `border` | `#232836` | bordures |
| `border-soft` | `#1A1E28` | séparateurs internes |
| `text` | `#E8EAF0` | texte principal |
| `text-muted` | `#9AA3B5` | texte secondaire |
| `text-faint` | `#7D8698` | libellés, unités |
| `accent` | `#4FD1C5` | marque, liens, « confirmé », hausse |
| `accent-text` | `#7FE3D6` | texte sur fond sombre |
| `urgent` | `#FFCB6B` | tirage ouvert, précommande, boutons d'action urgente |
| `urgent-bg` / `urgent-border` | `#1C1710` / `#4A3818` | bloc urgent |
| `down` | `#FF9B7A` | baisse de prix |

### Statuts
Chaque statut a une pastille : fond sombre teinté, texte clair de la même teinte.

| Statut | Fond | Texte |
|---|---|---|
| Rumeur | `#2A2140` | `#C9B5FF` |
| Annoncé | `#1A2A45` | `#9CC3FF` |
| Précommande | `#3A2C12` | `#FFCB6B` |
| Sorti | `#123430` | `#7FE3D6` |

Les niveaux de source réutilisent ces couples : leak = violet, relais = bleu, officiel = turquoise. Hausse et baisse se distinguent par la couleur **et** par le signe (+/−).

## Typographie

| Rôle | Police | Taille / graisse |
|---|---|---|
| Titres, prix, chiffres | Space Grotesk | 40 / 700 (h1), 22 / 600 (h2), 16–20 / 600 (cartes) |
| Texte | Inter | 14–16 / 400–500 |
| Libellés | Inter | 11–12 / 500–600, capitales, interlettrage 0,06–0,08 em |

Polices chargées depuis Google Fonts (gratuit).

## Espacement et formes

- Grille de 4 px. Espacements courants : 8, 12, 16, 20, 24, 32, 40, 48.
- Contenu centré, largeur max 1 280 px, marges latérales 24 px (16 px sur mobile).
- Rayons : 999 px pastilles, 8–10 px boutons et champs, 14–16 px cartes, 20 px grande image.
- Pas d'ombre portée : la profondeur vient des surfaces et des bordures.
- Cibles tactiles de 44 px minimum.

## Composants

| Composant | Description |
|---|---|
| Barre de navigation | logo losange, 5 onglets (Sorties, Tirages, Prix, Watchlist, État), indicateur de fraîcheur à droite |
| Bloc urgent | fond ambré sombre, compte à rebours en tuiles, bouton ambré plein ; un seul visible en tête de page |
| Carte produit | visuel 4:3, pastille de statut en haut à gauche, nom, set · type · langue, date et prix marché, ligne de fiabilité et nombre de sources ; légère élévation au survol |
| Visuel absent | fond teinté par set, monogramme du set (ex. « S3 »), mention « Image à venir » ; remplacé dès qu'une image existe |
| Calendrier | une colonne par mois, jour en grand, pastille de statut ; une date imprécise s'affiche « T1 2027 » avec « date ? » |
| Historique d'une fiche | frise verticale, point coloré par niveau de source, citation de la source |
| Graphique de prix | courbe tendance pleine + plus bas en pointillé, aire très légère, sélecteur 7 j / 30 j / 90 j / Tout |
| Tableau watchlist | variations 1 j / 7 j / 30 j colorées et signées, mini-courbe 7 jours ; défile horizontalement sur mobile |
| Barre d'onglets mobile | 5 onglets avec icône et libellé, en bas d'écran |

## Règles

- Icônes au trait (bibliothèque Lucide, gratuite), jamais d'emoji.
- Pas de dégradés décoratifs.
- Toute date est affichée en heure de Paris ; toute donnée indique sa fraîcheur.
- États vides prévus : « Aucun tirage ouvert », « Historique en construction depuis le … », « — » pour un prix inconnu.
- Mobile d'abord pour Sorties et Tirages (consultés depuis la notification Discord) ; Prix et Watchlist pensés pour l'ordinateur mais utilisables sur téléphone.
- Le site s'installe sur l'écran d'accueil du téléphone (manifeste web, icône losange).
