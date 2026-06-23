# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Stack & layout

pnpm workspace monorepo with three packages:

- `frontend/` — React 18 + Vite 6 + TypeScript + Tailwind v4 + socket.io-client. SPA with `react-router-dom` v7.
- `backend/` — Node 18+ ESM, Express + Socket.IO 4, TypeScript via `tsx` (no build step in dev). `better-sqlite3` for the tickets table only.
- `shared/` — `@onskone/shared`, the contract between front and back: types (player, lobby, round, game, decks, socket-events) + `GAME_CONSTANTS` + `RoundPhase`/`GameStatus`/`GameMode` enums.

The shared package is **built**, not watched-into-source. Frontend and backend import the compiled `dist/`. **Always rebuild shared before backend/frontend** when its types change, or run it in watch mode in parallel.

## Common commands

```bash
# Dev (parallel front + back)
pnpm dev                # ⚠️ ne lance QUE front + back (shared n'a pas de script `dev`, seulement `watch`)
pnpm dev:frontend       # http://localhost:3000
pnpm dev:backend        # http://localhost:8080
pnpm dev:shared         # rebuild shared types on change (alias de `pnpm --filter @onskone/shared watch`)
# Pour un vrai parallèle front+back+shared:watch, lancer `pnpm dev` ET `pnpm dev:shared` côte à côte
# (ou utiliser les scripts scripts/start-dev.* qui buildent shared une fois avant de spawn back+front).

# Or via the launcher scripts in scripts/ (build shared once, then spawn back+front)
./scripts/start-dev.sh          # Linux/macOS
scripts\start-dev.bat           # Windows (opens two cmd windows)

# Build (must be ordered: shared first)
pnpm build:shared
pnpm build:frontend
pnpm build:backend       # ⚠️ NO-OP : backend n'a pas de script `build` (tourne via tsx, jamais compilé)
pnpm build               # recursive — build shared (tsc) puis frontend (tsc && vite build), PAS le backend

# Mobile (Capacitor — Android local, iOS buildé sur CI Codemagic)
./scripts/start-mobile.sh       # live reload sur device/émulateur (le tel charge le Vite du PC)
./scripts/build-mobile.sh       # build statique final + cap sync + ouvre Android Studio
# (équivalents .bat pour Windows). build-mobile attend VITE_SERVER_URL (URL du backend).
# iOS : pas de build local (pas de Mac). codemagic.yaml génère frontend/ios à la
# volée (cap add ios) sur Mac cloud, signe, et publie sur TestFlight.

# Checks
pnpm typecheck           # ⚠️ NO-OP — aucun package ne définit le script `typecheck`, sort en code 0 sans rien vérifier
pnpm lint                # ⚠️ NO-OP — pas d'ESLint installé/configuré dans le repo
# Pour vraiment typer un package : tsc -p <pkg>/tsconfig.json --noEmit
#   tsc -p shared/tsconfig.json --noEmit
#   tsc -p frontend/tsconfig.json --noEmit
#   tsc -p backend/tsconfig.json --noEmit

# Backend tests (Jest, only package with tests)
pnpm --filter backend test
pnpm --filter backend test -- path/to/file.test.ts
pnpm --filter backend test -- -t "name of test"

# Regenerate the question deck from the Excel source (génère questions_fr.json + questions_en.json)
node backend/src/data/build-questions.mjs
```

Adding deps: `pnpm --filter frontend add <pkg>`, `pnpm --filter backend add <pkg>`, `pnpm --filter @onskone/shared add -D <pkg>`. Root devDeps: `pnpm add -w -D <pkg>`.

## Architecture

### Real-time game model (backend)

The game runs entirely in-memory; SQLite is only used for the tickets table (`backend/src/db/database.ts`, schema `tickets`).

- `LobbyManager` (singleton-style module in `backend/src/managers/`) holds the `Map<lobbyCode, Lobby>` of active lobbies and runs a cleanup interval for stale ones.
- `GameManager` orchestrates round transitions and scoring against the `Game`/`Round`/`Player` models in `backend/src/models/`.
- `SocketHandler` (single class in `backend/src/sockets/SocketHandler.ts`) wires every `ClientToServerEvents` socket event to the managers. **All gameplay actions go through Socket.IO**, not REST — the HTTP routes (`backend/src/routes/`) only cover tickets and admin auth.
- Each lobby is a Socket.IO room keyed by the 6-char `lobbyCode`. The handler maintains several disconnect/reconnect maps:
  - `disconnectTimeouts` / `RECONNECT_GRACE_PERIOD = 30s` — preserves a player slot when their socket drops.
  - `leaderDisconnectTimeouts` / `LEADER_DISCONNECT_DELAY = 15s` — skips the round if the leader doesn't come back (mobile background tolerance).
  - `inactiveTimeouts` / `INACTIVE_DELAY = 5s` — marks a player inactive without removing them.
  - `kickedPlayers` / `KICK_BLOCK_DURATION = 5min` — temporary ban after a kick.
- Round state machine: `RoundPhase` enum in `shared/src/types/round.ts` (`QUESTION_SELECTION → SUBSTITUTE_SELECTION? → ANSWERING → SUBSTITUTE_ANSWERING? → GUESSING → REVEAL`). Two game modes branch through it: **Classique** (no substitute) and **Devine ma réponse** (leader picks a substitute who writes the leader's answer).
- Similarity scoring (`backend/src/utils/similarity.ts`) merges near-duplicate answers so the guesser doesn't get punished for paraphrases. Validation/sanitization lives in `backend/src/utils/validation.ts`; per-event rate limiters in `backend/src/utils/rateLimiter.ts`.

### CORS / origin policy

`backend/src/index.ts` builds the Socket.IO and HTTP CORS allowlists from `process.env.ALLOWED_ORIGINS` (comma-separated). In **production**, an unset `ALLOWED_ORIGINS` rejects all browser requests — logged as a security warning at boot. In dev, only `localhost`, `127.0.0.1`, and `192.168.x.x:*` are allowed.

### Frontend routing

`frontend/src/App.tsx` registers the public routes: `/`, `/lobby/:lobbyCode`, `/game/:lobbyCode`, `/endgame/:lobbyCode`, `/privacy` et `/mentions` (tous deux rendus par `Legal` avec une prop `kind`), `/admin`, et la dev-only `/studio` (guarded by `import.meta.env.DEV`). **Pages lazy** (`React.lazy`) : `Lobby`, `Game`, `EndGame` et `Admin`. Eager : `Home`, `NotFound`, `Studio`, `Legal`.

The single socket connection lives in `frontend/src/utils/socket.ts`; pages subscribe via `useSocketEvent` (`frontend/src/hooks/`). Most game state arrives through `gameStateUpdate`/`gameEnded` payloads — components do not refetch.

### Studio (dev-only test harness)

`frontend/src/pages/Studio.tsx` is a multi-iframe rig that lets one developer simulate a whole lobby locally. Each iframe is a real frontend instance loaded with `?studioSlot=N&playerName=…&avatarId=…&autoCreate=1|autoJoin=1`. Critical pieces:

- `frontend/src/utils/studioStorage.ts` namespaces `localStorage` per slot using the `studioSlot` URL param (captured at module load), with `window.name` as a same-origin reload fallback. **Never write directly to `localStorage` from app code that runs inside a studio iframe** — go through `studioStorage` or the Studio slot's state will leak across iframes.
- `frontend/src/hooks/useStudioBot.ts` reads `?bot=1` or a `studio:setBot` postMessage from the parent and auto-plays the current phase (leader: select question, pick substitute, submit guesses, reveal+next; non-leaders: submit a random answer). Used by the Studio's "Tous bots" toggle.
- The "Composants" tab in Studio is `frontend/src/pages/studio/Gallery.tsx`, a live design-system inspector. The ShareCard preview section calls `buildShareCard` from `frontend/src/utils/shareCard.ts` (canvas 1080×1920 image used by the end-game share button).

### Admin

`/admin` (frontend) hits `backend/src/routes/admin.ts`. Auth is a custom HMAC token (`ADMIN_PASSWORD` → 7-day signed token via `ADMIN_TOKEN_SECRET`). No session middleware. Tickets CRUD is at `/api/tickets` (`backend/src/routes/tickets.ts`).

### Questions deck

Le deck est par locale : `backend/src/data/questions_fr.json` + `backend/src/data/questions_en.json` sont la source de vérité en jeu, **générés** depuis `Onskoné_2405.xlsx` via `node backend/src/data/build-questions.mjs` (la xlsx vit à côté dans `backend/src/data/`). Ne pas éditer ces JSON à la main ; éditer la xlsx et relancer le script. `GameManager` charge `questions_${locale}.json` selon la langue.

`backend/src/data/themes.json` est un fichier **distinct, maintenu à la main** (PAS généré par le script) : métadonnées de thèmes (`category`, `emoji`, `mature?`, `labels.{fr,en}`, `descriptions.{fr,en}`). `GameManager.loadThemesMeta()` le fusionne avec les questions pour construire le catalogue de decks ; un thème présent dans les questions mais absent de `themes.json` est ignoré avec un warning.

### Design system (frontend)

All design tokens live in `@theme` inside [frontend/src/index.css](frontend/src/index.css). **Never hardcode a hex color, font family, or repeat the same display-size pattern in components.** If a value would be used in more than one place, it belongs in `@theme` first.

**Color tokens** (the only sanctioned source of color):

- `brand-700 / 500 / 400 / 200` - bleu Onskoné, du plus foncé au plus clair (gradient, UI primaire, halo, slider "à distance")
- `success-700 / 500 / 400` - vert validation (boutons, réponses correctes)
- `danger-700 / 500 / 400` - rouge danger (boutons quit, croix supprimer, réponses incorrectes)
- `warning-700 / 500 / 400 / 350 / 300 / 200 / 100 / 50 / orange` - jaune chaud (CTA warning, achievements, target magnetic, pulse, kraft)
- `cream-player / question / answer / paper / warm / kraft` - papiers cartonnés (chaque cream a un usage narratif distinct, ne pas les interchanger)
- `quit / quit-hover` - boutons de retrait neutres
- `podium-gold / silver / bronze` - médailles EndGame (codes universels)

**Couleurs intentionnellement hors-tokens** (story palette, ne pas généraliser) :
- `TIERS` dans `constants/tiers.ts` (6 paliers de couleur du score d'équipe ; le 6e = violet Onskoné `#b46cff`)
- `CATEGORY_COLORS` dans `constants/game.ts` (couleur narrative par thème de carte)
- Onskoné violet (`#b46cff` etc.) dans EndGame, climax visuel
- Palette sombre `Admin.tsx` / `Studio.tsx` / `pages/studio/Gallery.tsx` (dev tooling, isolée)
- `shareCard.ts` peint sur canvas, ne peut pas lire les vars CSS

**Typographie** : trois familles, à composer avec les classes de hiérarchie.

- `font-sans` (Nunito) - body par défaut
- `font-display` (Fredoka) - titres ronds, CTA, badges
- `font-accent` (Fraunces) - **rare**, 1-2 mots-clés par écran pour casser la monotonie Fredoka

**Hiérarchie typo** (utiliser ces classes plutôt que `font-display font-bold text-Xl`) :
- `text-display-xl` (32-44px, poids 700) - titre d'écran principal
- `text-display-lg` (24-30px, poids 700) - h1 / titre de carte
- `text-display-md` (18-22px, poids 600) - h2 / sous-titre
- `text-display-sm` (16px, poids 600) - h3 / label fort
- `text-display-xs` (11px, poids 600, uppercase, tracking large) - labels & metadata

**Identité visuelle** (toujours dispo en utility) :
- `.stack-shadow` / `.stack-shadow-sm` / `.stack-shadow-lg` - ombres de carte empilées
- `.texture-paper` - grain papier appliqué via ::after avec mix-blend multiply
- `.bg-pattern-dots` / `.bg-pattern-diagonal` / `.bg-pattern-zigzag` - motifs de fond par ambiance

**Conventions animations** :
- Animations one-shot pour entrées/transitions (`animate-modal-pop`, `animate-card-deal-in`, etc.)
- Animations idle infinies : **max 1 par écran**, sur l'élément qui porte l'action en cours. Si une carte clignote pour guider l'œil, suspendre les `animate-float` décoratifs alentour.

### Mobile (Capacitor)

Le même build web `frontend/build` est embarqué dans une coquille native via Capacitor. Config dans [frontend/capacitor.config.ts](frontend/capacitor.config.ts) (`appId: com.onskone.app`, `webDir: build`). La plateforme **Android** est commitée (`frontend/android/`, build local). La plateforme **iOS** n'est **pas** commitée : elle est régénérée à neuf (`cap add ios`) à chaque build sur le Mac cloud Codemagic (cf [codemagic.yaml](codemagic.yaml)), signée, puis publiée sur TestFlight. Donc tout réglage iOS qui doit persister (entitlements Universal Links, icônes, version) est réinjecté par le pipeline, pas posé en dur dans `frontend/ios/`. App Store ID (Apple ID numérique) : `6782334531` ; Team ID : `KRJ3L83RCL`.

- `vite.config.ts` a `base: './'` (chemins relatifs obligatoires : la page est servie depuis le filesystem de l'app, pas la racine d'un domaine).
- **URL backend** : en natif, `window.location.origin` vaut `https://localhost` (Android) / `capacitor://localhost` (iOS), donc inexploitable. Le build mobile doit fournir `VITE_SERVER_URL` (URL absolue du backend) — c'est la première branche de `getServerUrl()` dans `frontend/src/constants/game.ts`. En live reload, l'origine devient l'IP du PC (`http://192.168.x.x:3000`) et retombe sur la branche réseau local.
- **CORS** : `CAPACITOR_ORIGINS` (`capacitor://localhost`, `https://localhost`) est toujours autorisé dans `backend/src/index.ts`, indépendamment de `ALLOWED_ORIGINS`.
- Scripts : `scripts/start-mobile.*` (live reload) et `scripts/build-mobile.*` (build final + Android Studio).

## Gotchas

- **Shared package is consumed from `dist/`** — if you change a type in `shared/src/types/` and front/back don't pick it up, you forgot to rebuild. `pnpm dev:shared` keeps watch.
- **Two players with the same name fuse**: `SocketHandler.joinLobby` treats a same-name join as a reconnection. The Studio's `start()` enforces unique names+avatars across slots — preserve that invariant if you touch it.
- **Studio route is dev-only** — gated by `import.meta.env.DEV`. Don't reference it from production pages.
- **Backend is ESM with `.js` import extensions** in TypeScript (`from '../utils/logger.js'`) — required for `tsx`/native ESM resolution. Keep this convention when adding imports.
- **Tailwind v4** is configured via `@tailwindcss/vite` and `@import "tailwindcss"` in `index.css`, with the design tokens (`--font-display`, `--color-cream-player`, etc.) declared in `@theme`. There is no `tailwind.config.js`.
