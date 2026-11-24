# Décisions d'architecture

Contrainte directrice : **gratuit, simple, et pratique**. Une entrée par choix : la décision, la raison, ce qui a été écarté.

## D1 — GitHub Actions + fichiers dans le dépôt + GitHub Pages
**Décision.** Pas de serveur. Les scripts tournent dans GitHub Actions, écrivent des fichiers dans le dépôt, et le dashboard est un site statique sur GitHub Pages.
**Raison.** Seule combinaison à la fois gratuite, sans maintenance et qui tourne PC éteint.
**Écarté.**
- VPS avec Spring Boot et PostgreSQL (première version) : payant, et un serveur à administrer.
- Hébergements « gratuits à vie » de machines virtuelles : inscription lourde, carte bancaire, risque de suppression du compte.
- Faire tourner l'outil sur ton PC : gratuit, mais rate le passage de 19 h dès que le PC est éteint.

## D2 — Dépôt public
**Décision.** Le dépôt et le dashboard sont publics.
**Raison.** C'est la condition pour avoir Actions illimité et Pages gratuitement. Les données sont des informations publiques (sorties, prix).
**Conséquence.** Pas de mot de passe sur le dashboard. Les secrets restent protégés dans les secrets GitHub.

## D3 — TypeScript partout
**Décision.** Scripts de collecte en TypeScript sur Node, front en Vue 3 / TypeScript.
**Raison.** Un seul langage, un seul outillage, démarrage en quelques secondes dans Actions.
**Écarté.** Java / Spring Boot : pensé pour une application qui tourne en continu, ce qui n'existe plus ici.

## D4 — Fichiers plutôt que base de données
**Décision.** Fiches en JSON, historique de prix en CSV mensuels.
**Raison.** Volume minuscule (environ 2 000 lignes de prix par jour, quelques centaines de fiches). Git apporte gratuitement la sauvegarde et l'historique des modifications.
**Écarté.** Base hébergée gratuite : un compte de plus, des quotas, une mise en veille en cas d'inactivité.

## D5 — Fusion par affirmations
**Décision.** Chaque valeur extraite est gardée avec sa source ; les champs de la fiche sont recalculés (officiel > relais > leak).
**Raison.** C'est ce qui permet le passage « non confirmé → confirmé », la correction d'un leak par l'officiel et l'historique d'une fiche, sans intervention.
**Écarté.** Écraser la fiche à chaque passage : le dernier arrivé gagnerait, même s'il est le moins fiable.

## D6 — Règles d'abord, LLM gratuit en complément, mode dégradé
**Décision.** Tri par mots-clés, lecture directe des sources structurées, LLM gratuit seulement pour le texte libre (API Gemini depuis D13). Si le LLM échoue, le document est signalé « à lire » sur Discord.
**Raison.** Les offres gratuites ont des quotas et peuvent changer : l'outil ne doit pas en dépendre pour remplir sa mission première, ne rater aucune sortie.
**Écarté.** API Claude payante ; tout faire au LLM ; ne pas utiliser de LLM du tout (les posts Reddit et les articles ne se lisent pas de façon fiable avec des règles).

## D7 — Veille toutes les 2 h, sans mode chaud
**Décision.** Un passage toutes les 2 heures en permanence.
**Raison.** Gratuit sur un dépôt public, donc inutile de gérer deux rythmes. Couvre largement le créneau de 19 h.
**Écart par rapport au CLAUDE.md.** Les trois créneaux fixes et le mode chaud temporaire disparaissent, remplacés par mieux.

## D8 — Alertes par webhook Discord
**Décision.** Deux webhooks : critique et fil.
**Raison.** Gratuit, rien à héberger, notification push sur le téléphone, réglage du son par salon.
**Écarté.** Telegram (équivalent, ajoutable) ; application mobile.

## D9 — Cardmarket : fichiers publics, ingestion idempotente
**Décision.** Trois téléchargements par jour, écriture seulement si le `createdAt` est nouveau.
**Raison.** Scraping interdit par leurs CGU ; heure de publication irrégulière.

## D10 — Les prix avant la veille
**Décision.** L'ingestion Cardmarket est le premier jalon.
**Raison.** L'historique de prix ne se rattrape pas ; la veille ne perd rien à démarrer deux semaines plus tard.

## D11 — Watchlist : scellé automatique, cartes par fichier
**Décision.** Tout le scellé anglais est suivi d'office. Les cartes s'ajoutent dans `config/watchlist.yml` ; le dashboard propose aussi des favoris locaux au navigateur.
**Raison.** Un site statique ne peut pas enregistrer un clic côté serveur. Le fichier se modifie depuis GitHub en une minute, téléphone compris, et le cœur du besoin (le scellé) reste sans aucune action.

## D12 — Pas d'image pour les cartes en v1
**Décision.** Images pour le scellé (reprises de la veille), lien Cardmarket pour les cartes.
**Raison.** Les fichiers Cardmarket n'ont pas d'images, et l'objectif du projet est le scellé.

## D13 — Gemini à la place de GitHub Models
**Décision.** Extraction par l'offre gratuite de l'API Gemini (clé AI Studio dans le secret `GEMINI_API_KEY`), modèle principal et modèle de secours.
**Raison.** GitHub Models a été retiré par GitHub le 30/07/2026 (constaté au jalon 3). Gemini était la solution de repli prévue : offre gratuite sans carte bancaire, sortie JSON contrainte par schéma.
**Coût.** Une clé à créer (2 minutes). Les données envoyées sont des articles publics, ce qui rend acceptable leur réutilisation par Google prévue par l'offre gratuite.

## D14 — Sources officielles lues par leurs données embarquées
**Décision.** Le site Riftbound (playriftbound.com) et la boutique Riot (merch.riotgames.com) sont lus via le JSON que leurs pages embarquent (Next.js), pas par analyse du HTML affiché.
**Raison.** Plus robuste et plus précis : la liste des actualités donne titre, date, catégorie et image en une requête ; la boutique donne prix, disponibilité et précommande sans LLM. Les deux `robots.txt` autorisent l'accès.

## D15 — Reddit abandonné
**Décision.** Pas de source Reddit.
**Raison.** Constaté au jalon 4 (24/11/2026) : le `robots.txt` de Reddit interdit tout (`Disallow: /`) et l'API n'accepte plus de nouvelles applications. Conformément à la règle « une source bloquée est retirée, pas contournée ». Compensé par les boutiques (qui listent les produits avant l'annonce officielle, voir D16), les notifications du téléphone et, au jalon 6, les salons Discord suivis.

## D16 — Boutiques Shopify en relais, prix boutique ≠ prix officiel
**Décision.** Quatre boutiques sous Shopify (2 en Europe, 2 en Amérique du Nord) sont lues par leur liste JSON publique, collection Riftbound seulement. Leurs prix vont dans « Où l'acheter », jamais dans le prix officiel ; elles peuvent créer une fiche (non confirmée) et lui donner le statut « précommande » ou « sorti ».
**Raison.** Les boutiques listent les produits des semaines avant l'annonce de Riot (sets 6 et 7 vus ainsi le 24/11/2026), avec stock et photos, sans LLM. Un prix de revente (ex. 672 € pour une édition limitée) ne doit pas passer pour le prix officiel.
**Garde-fous.** Premier passage d'une nouvelle boutique : un seul message de résumé. Les boutiques protégées par un défi anti-robots (Cloudflare) sont écartées.

