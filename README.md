# Riftbound Tracker

Suivi automatique des sorties de produits scellés Riftbound (anglais) et de leurs prix Cardmarket.

Tout tourne gratuitement sur GitHub : les passages planifiés dans GitHub Actions, les données dans ce dépôt, le dashboard sur GitHub Pages, les alertes sur Discord.

- Architecture : [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- Plan de build : [docs/ROADMAP.md](docs/ROADMAP.md)
- Design : [docs/DESIGN.md](docs/DESIGN.md)

## Développement

```sh
npm install
npm run dev        # dashboard en local
npm test           # tests
npm run typecheck  # vérification des types
npm run build      # build du dashboard
```

Node 22 ou plus.
