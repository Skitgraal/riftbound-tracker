# Ce que tu dois faire

Trois actions avant le build, environ 15 minutes. Elles passent par tes comptes personnels, donc l'IA ne peut pas les faire à ta place. Le reste est pris en charge pendant le build.

## 1. Compte GitHub — 5 min

**Pourquoi** : GitHub héberge tout gratuitement : le code, les données, les passages automatiques et le dashboard.

1. Va sur github.com et crée un compte (passe cette étape si tu en as déjà un).
2. Choisis bien ton nom d'utilisateur : il apparaîtra dans l'adresse du dashboard, `https://<nom>.github.io/riftbound-tracker`.
3. Active la double authentification quand GitHub le propose (il l'exige de toute façon).

Ne crée pas le dépôt : il sera créé pendant le build.

## 2. Serveur Discord et webhooks — 5 min

**Pourquoi** : les alertes arrivent dans deux salons Discord, avec une notification sur ton téléphone. Un webhook est une adresse secrète qui permet à un script de poster dans un salon.

1. Dans Discord, clique sur **+** (« Ajouter un serveur ») → **Créer le mien** → **Pour moi et mes amis**. Nomme-le par exemple « Riftbound Tracker ».
2. Crée deux salons textuels : `alertes-critiques` et `fil`.
3. Pour **chaque** salon : roue dentée du salon → **Intégrations** → **Webhooks** → **Nouveau webhook** → **Copier l'URL du webhook**.
4. Colle les deux URL dans une note privée, en notant laquelle va avec quel salon.

**Important** : ne colle jamais ces URL dans la conversation ni dans un fichier du projet. Quiconque les possède peut poster dans ton serveur. On les rangera dans les secrets GitHub au jalon 1.

Réglages des notifications sur le téléphone (clic long sur le salon → Paramètres de notification) :
- `alertes-critiques` : **Tous les messages**, c'est là qu'arrivent les tirages et les précommandes.
- `fil` : **Mentions uniquement**, à consulter quand tu veux.

Vérifie aussi que les notifications de l'application Discord sont autorisées dans les réglages du téléphone.

## 3. Notifications X sur le téléphone — 3 min

**Pourquoi** : X ne peut pas être lu automatiquement gratuitement. Le compromis prévu est de suivre 2 ou 3 comptes clés à la main.

Dans l'application X, sur le profil du compte officiel Riftbound et de ton leaker de référence : icône de cloche → **Tous les posts**.

## Pendant le build, au moment où on te le demande

| Moment | Action | Durée |
|---|---|---|
| Jalon 0 | dans un terminal, `gh auth login` → GitHub.com → HTTPS → « Login with a web browser » → copier le code affiché et valider dans le navigateur | 1 min |
| Jalon 0 | rouvrir VS Code dans le nouveau dossier `C:\dev\riftbound-tracker` | 1 min |
| Jalon 1 | `gh secret set DISCORD_WEBHOOK_CRITICAL` puis `gh secret set DISCORD_WEBHOOK_FEED`, et coller l'URL quand c'est demandé (elle ne s'affiche pas) | 1 min |
| Jalon 2 | ouvrir le dashboard sur le téléphone → menu du navigateur → **Ajouter à l'écran d'accueil** | 1 min |
| Jalon 3 | créer une clé API Gemini gratuite sur aistudio.google.com (**Get API key** → **Create API key**), puis `gh secret set GEMINI_API_KEY` et coller la clé | 2 min |
| Jalon 4 | valider la liste des boutiques suivies (`config/sources.yml`) ; Reddit abandonné, rien à créer | 2 min |
| Jalon 6 | créer le bot Discord qui lit les salons d'annonces suivis (guide ci-dessous) ; facultatif, l'outil marche sans | 5 min |

L'outil GitHub en ligne de commande (`gh`) est installé par l'IA au jalon 0, en version portable : `winget` est absent du poste, et la version portable ne demande pas de droits administrateur.

## Bot Discord (source « leaks », facultatif)

Tant que ces étapes ne sont pas faites, la source `discord-relay` reste inactive (grise dans l'onglet État), sans erreur.

1. **Créer le bot** : https://discord.com/developers/applications → **New Application** → nom `Riftbound Tracker` → onglet **Bot** :
   - **Reset Token** → copier le jeton (il ne s'affiche qu'une fois) ;
   - activer **Message Content Intent** (sans lui, le bot voit les messages vides).
2. **L'inviter dans ton serveur** : onglet **OAuth2** → **URL Generator** → cocher `bot`, puis les permissions **View Channels** et **Read Message History** → ouvrir l'URL générée → choisir ton serveur.
3. **Donner le jeton à GitHub** (il ne passe jamais par la conversation) :
   `& "$env:LOCALAPPDATA\gh-cli\bin\gh.exe" secret set DISCORD_BOT_TOKEN -R Skitgraal/riftbound-tracker`
4. **Brancher des sources** dans ton serveur :
   - créer un salon, par exemple `#veille-leaks` ;
   - sur un serveur communautaire Riftbound, dans un salon d'**annonces** (icône mégaphone) → bouton **Suivre** → choisir `#veille-leaks`. Ses messages seront recopiés chez toi ;
   - tu peux aussi y coller à la main un lien ou un texte de leak vu ailleurs (X, etc.) : il sera lu et extrait comme le reste.

Au premier passage, l'historique des salons est marqué « vu » sans alerte ; seuls les messages suivants sont lus. Les salons `#alertes-critiques` et `#fil` sont ignorés, ainsi que tout message de bot ou de webhook (les alertes de l'outil ne reviennent pas en boucle).
