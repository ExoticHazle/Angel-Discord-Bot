# Angel

Angel est un bot Discord francophone qui réunit la modération, les notes du staff, les quotas, les niveaux, les Orëlyss, une boutique, des quêtes et un inventaire.

## Lancer et exploiter

- `pnpm install --frozen-lockfile` — installer les dépendances.
- `pnpm run typecheck` — vérifier tous les packages TypeScript.
- `PORT=8081 BASE_PATH=/__mockup pnpm run build` — vérifier puis compiler tous les packages, y compris l'artefact de prévisualisation.
- `pnpm --filter @workspace/db run push` — appliquer le schéma au PostgreSQL de développement.
- `pnpm --filter @workspace/discord-bot run build` — compiler le bot.
- `pnpm --filter @workspace/discord-bot run start` — connecter Angel à Discord.
- `pnpm --filter @workspace/discord-bot run deploy` — publier les commandes slash. Sans `DISCORD_GUILD_ID`, Discord remplace la liste globale existante par celle du dépôt ; avec cette variable, les commandes ne sont publiées que sur le serveur indiqué.

Variables nécessaires au bot :

- `DISCORD_BOT_TOKEN` — secret du bot.
- `DISCORD_CLIENT_ID` — identifiant public de l’application Discord, utilisé pour publier les commandes.
- `DISCORD_GUILD_ID` — facultatif ; serveur ciblé pour un déploiement de test.
- `DATABASE_URL` — PostgreSQL géré par Replit.

Le bot a besoin des intents **Server Members** et **Message Content** activés dans le portail développeur Discord. Il doit être invité avec les scopes `bot` et `applications.commands`, et avec les permissions correspondant aux commandes que le serveur utilisera.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Bot : discord.js 14
- Données de communauté : PostgreSQL + Drizzle ORM
- API partagée : Express 5
- Client API : OpenAPI, Orval et Zod

## Organisation du dépôt

- `artifacts/discord-bot` — commandes slash, événements Discord et règles de jeu.
- `artifacts/discord-bot/src/utils/store.ts` — accès aux données du bot.
- `artifacts/discord-bot/src/utils/time.ts` — dates quotidiennes et périodes de quotas en heure de Paris.
- `artifacts/discord-bot/src/utils/scheduler.ts` — rappels, bilans de quotas et suivi vocal.
- `lib/db/src/schema/index.ts` — schéma PostgreSQL.
- `artifacts/api-server` — API Express conservée depuis le dépôt source.
- `artifacts/mockup-sandbox` — espace de prévisualisation de composants conservé depuis le dépôt source.

## Commandes

La commande `/commandes` présente les commandes en trois catégories : administration, modération et membres. Discord choisit lui-même l’ordre de sa liste slash ; les permissions du bot limitent l’accès aux commandes admin et modération.

Les quotas doivent être configurés pour les rôles du serveur avec `/quota role` et le salon de rapports avec `/quota salon-admin`. Le rôle Animateur utilise 200 messages et le rôle Modérateur 250 par défaut lorsque leur nom correspond ; les autres rôles demandent un quota explicite. `/quota salon-niveaux` choisit le salon des messages de montée de niveau.

## Données et règles

- Les profils, monnaies, inventaires, quêtes, achats, notes et configurations sont conservés en PostgreSQL.
- Les données historiques de modération et les avertissements staff restent dans les fichiers de données du dépôt source.
- Les daily et les quotas suivent le fuseau `Europe/Paris`.
- Les quotas se réinitialisent toutes les deux semaines le dimanche ; le rappel est envoyé le dimanche précédent.
- Le niveau 0 est conservé en interne, mais n'est pas affiché dans le profil ni le classement.

## Pointeurs et contraintes

- Voir `.agents/memory/discord-command-constraints.md` avant de modifier les commandes slash : Discord impose l'ordre des options et applique les permissions au niveau de la commande racine.
- Voir `.agents/memory/workspace-db-runtime-packaging.md` avant de modifier les exports de `@workspace/db` : les services compilés ont besoin des exports JavaScript dans `dist`.
